// Unified admin API for home/products/about/contact + uploads
// Uses GitHub Contents API to read/write JSON in /public/content and upload files into /public/uploads

const OWNER = process.env.GITHUB_REPO_OWNER;
const REPO = process.env.GITHUB_REPO_NAME;
const BRANCH = process.env.GITHUB_DEFAULT_BRANCH || "main";
const GH_TOKEN = process.env.GITHUB_TOKEN;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

const BASE = "https://api.github.com";

function json(res, code, data) {
  res.statusCode = code;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(data, null, 2));
}

function text(res, code, msg) {
  res.statusCode = code;
  res.setHeader("content-type", "text/plain; charset=utf-8");
  res.end(msg);
}

function b64encode(str) {
  return Buffer.from(str, "utf8").toString("base64");
}
function b64decodeToString(b64) {
  return Buffer.from(b64, "base64").toString("utf8");
}

async function gh(path, opts = {}) {
  if (!GH_TOKEN) throw new Error("Missing GITHUB_TOKEN");
  if (!OWNER || !REPO) throw new Error("Missing GITHUB_REPO_OWNER/GITHUB_REPO_NAME");

  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      "authorization": `token ${GH_TOKEN}`,
      "accept": "application/vnd.github+json",
      ...(opts.headers || {})
    }
  });

  const bodyText = await res.text();
  let body = null;
  try { body = bodyText ? JSON.parse(bodyText) : null; } catch { body = bodyText; }

  if (!res.ok) {
    const msg = typeof body === "string" ? body : (body && body.message) ? body.message : "GitHub API error";
    throw new Error(msg);
  }
  return body;
}

function requireAuth(req) {
  const t = req.headers["x-admin-token"] || "";
  if (!ADMIN_PASSWORD) throw new Error("Server missing ADMIN_PASSWORD");
  if (!t || String(t) !== String(ADMIN_PASSWORD)) {
    const err = new Error("Unauthorized");
    err.status = 401;
    throw err;
  }
}

function pageToPath(page) {
  if (page === "home") return "public/content/home.json";
  if (page === "products") return "public/content/products.json";
  if (page === "about") return "public/content/about.json";
  if (page === "contact") return "public/content/contact.json";
  return null;
}

// Basic sanitizers / clamps
function clampStr(s, max) {
  s = String(s || "");
  if (s.length > max) s = s.slice(0, max);
  return s;
}
function clampNum(n, min, max) {
  n = Number.isFinite(n) ? n : min;
  return Math.max(min, Math.min(max, n));
}
function sanitizeHome(input) {
  const out = {};
  out.tickerText = clampStr(input.tickerText || "New drops weekly", 80);

  // heroHtml is allowed to contain <br> and <span class="hero-italic"> only.
  // We'll do a conservative sanitize: strip script tags and limit length.
  out.heroHtml = clampStr(input.heroHtml || "Short form<br>done <span class=\"hero-italic\">right</span>", 600);
  out.heroHtml = out.heroHtml.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "");
  out.heroHtml = out.heroHtml.replace(/on\w+="[^"]*"/gi, "");

  out.subtext = clampStr(input.subtext || "", 500);

  out.theme = input.theme && typeof input.theme === "object" ? input.theme : {};
  out.theme.headingColor = clampStr(out.theme.headingColor || "", 24);
  out.theme.subtextColor = clampStr(out.theme.subtextColor || "", 24);
  out.theme.heroAlign = (out.theme.heroAlign === "center") ? "center" : "left";

  const slides = Array.isArray(input.storySlides) ? input.storySlides.slice(0, 5) : [];
  out.storySlides = slides.map((s) => {
    const slide = {};
    slide.type = (s.type === "video") ? "video" : "image";
    slide.src = clampStr(s.src || "", 700);
    slide.alt = clampStr(s.alt || "", 140);
    slide.caption = clampStr(s.caption || "", 60);
    slide.overlay = s.overlay && typeof s.overlay === "object" ? s.overlay : {};
    slide.overlay.enabled = slide.overlay.enabled !== false;
    slide.overlay.opacity = clampNum(parseFloat(slide.overlay.opacity ?? 0.45), 0, 0.85);
    return slide;
  });

  return out;
}

function sanitizeProducts(input) {
  const out = {};
  const items = Array.isArray(input.items) ? input.items : [];
  out.items = items.slice(0, 500).map((p) => ({
    id: clampStr(p.id || ("p" + Date.now()), 40),
    title: clampStr(p.title || "Product", 80),
    price: clampNum(parseFloat(p.price ?? 0), 0, 100000),
    currency: ["USD","EUR","GBP","PKR","INR","AED"].includes(p.currency) ? p.currency : "USD",
    image: clampStr(p.image || "", 700),
    category: clampStr(p.category || "", 40),
    badge: clampStr(p.badge || "", 20),
    description: clampStr(p.description || "", 800),
    buyLink: clampStr(p.buyLink || "", 700),
  }));
  return out;
}

function sanitizeAbout(input) {
  return {
    heading: clampStr(input.heading || "About", 100),
    body: clampStr(input.body || "", 4000),
    image: clampStr(input.image || "", 700)
  };
}

function sanitizeContact(input) {
  const social = input.social && typeof input.social === "object" ? input.social : {};
  return {
    heading: clampStr(input.heading || "Contact", 100),
    intro: clampStr(input.intro || "", 2000),
    email: clampStr(input.email || "", 140),
    phone: clampStr(input.phone || "", 80),
    address: clampStr(input.address || "", 400),
    social: {
      instagram: clampStr(social.instagram || "", 400),
      tiktok: clampStr(social.tiktok || "", 400),
      youtube: clampStr(social.youtube || "", 400)
    }
  };
}

function sanitizeByPage(page, data) {
  if (page === "home") return sanitizeHome(data || {});
  if (page === "products") return sanitizeProducts(data || {});
  if (page === "about") return sanitizeAbout(data || {});
  if (page === "contact") return sanitizeContact(data || {});
  return data || {};
}

async function readJsonFile(path) {
  const file = await gh(`/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(BRANCH)}`);
  const content = b64decodeToString(file.content || "");
  return JSON.parse(content || "{}");
}

async function writeFile(path, contentStr, message) {
  // fetch existing to get sha (if exists)
  let sha = null;
  try {
    const existing = await gh(`/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(BRANCH)}`);
    sha = existing.sha;
  } catch {
    sha = null;
  }

  const payload = {
    message: message || `Update ${path}`,
    content: b64encode(contentStr),
    branch: BRANCH,
    ...(sha ? { sha } : {})
  };

  await gh(`/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(path)}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (e) {
        reject(new Error("Invalid JSON body"));
      }
    });
  });
}

function safeFilename(name) {
  name = String(name || "upload").replace(/[^a-zA-Z0-9.\-_]/g, "_");
  if (!name.includes(".")) name += ".bin";
  return name.slice(0, 80);
}

module.exports = async (req, res) => {
  try {
    requireAuth(req);

    if (req.method === "GET") {
      const page = String(req.query.page || "");
      const path = pageToPath(page);
      if (!path) return text(res, 400, "Invalid page");
      const data = await readJsonFile(path);
      return json(res, 200, data);
    }

    if (req.method === "POST") {
      const body = await parseBody(req);
      const action = body.action;

      if (action === "save") {
        const page = String(body.page || "");
        const path = pageToPath(page);
        if (!path) return text(res, 400, "Invalid page");
        const sanitized = sanitizeByPage(page, body.data || {});
        await writeFile(path, JSON.stringify(sanitized, null, 2) + "\n", `Update ${page} content (admin builder)`);
        return json(res, 200, { ok: true, message: `Saved ${page}.` });
      }

      if (action === "upload") {
        const filename = safeFilename(body.filename || "upload.bin");
        const contentType = String(body.contentType || "application/octet-stream");
        const base64 = String(body.base64 || "");
        if (!base64) return text(res, 400, "Missing base64");

        // store under public/uploads/<timestamp>-<filename>
        const stamp = new Date().toISOString().replace(/[:.]/g, "-");
        const outName = `${stamp}-${filename}`;
        const path = `public/uploads/${outName}`;

        // base64 passed is raw, not data-url
        const payload = {
          message: `Upload ${outName} (admin builder)`,
          content: base64,
          branch: BRANCH
        };

        // create file
        await gh(`/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(path)}`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload)
        });

        return json(res, 200, { ok: true, url: `/uploads/${outName}`, contentType });
      }

      return text(res, 400, "Invalid action");
    }

    return text(res, 405, "Method not allowed");
  } catch (e) {
    const status = e.status || 500;
    return text(res, status, e.message || "Server error");
  }
};
