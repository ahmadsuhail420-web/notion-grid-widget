// Vercel Serverless Function (Node runtime)
// - GET: returns public/content/home.json from GitHub repo
// - POST {action:"save"}: updates public/content/home.json in GitHub repo
// - POST {action:"upload"}: commits uploaded file into public/uploads/ and returns URL
//
// Required Vercel Environment Variables:
//   ADMIN_PASSWORD
//   GITHUB_TOKEN
//   GITHUB_REPO_OWNER=ahmadsuhail420-web
//   GITHUB_REPO_NAME=notion-grid-widget
//   GITHUB_DEFAULT_BRANCH=main
//
// Notes:
// - We authenticate using a simple password sent in header `x-admin-token`.
// - Admin UI stores the password in localStorage for the session (one-time per session).

const OWNER = process.env.GITHUB_REPO_OWNER;
const REPO = process.env.GITHUB_REPO_NAME;
const BRANCH = process.env.GITHUB_DEFAULT_BRANCH || "main";

const HOME_JSON_PATH = "public/content/home.json";
const UPLOAD_DIR = "public/uploads";

function sendJson(res, status, data) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(data));
}

function sendText(res, status, msg) {
  res.statusCode = status;
  res.setHeader("content-type", "text/plain; charset=utf-8");
  res.end(msg);
}

function requireAuth(req, res) {
  const token = String(req.headers["x-admin-token"] || "");
  const pw = String(process.env.ADMIN_PASSWORD || "");

  if (!pw) {
    sendText(res, 500, "Missing ADMIN_PASSWORD env var.");
    return false;
  }
  if (!token || token !== pw) {
    sendText(res, 401, "Unauthorized");
    return false;
  }
  return true;
}

async function readBody(req) {
  // Vercel usually parses req.body for JSON, but handle raw too.
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");

  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

async function gh(path, { method = "GET", body } = {}) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("Missing GITHUB_TOKEN env var.");

  const url = `https://api.github.com${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/vnd.github+json",
      "content-type": "application/json"
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }

  if (!res.ok) {
    const msg = typeof data === "string" ? data : (data && data.message) || "GitHub API error";
    throw new Error(msg);
  }
  return data;
}

async function getFile(path) {
  const data = await gh(
    `/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(BRANCH)}`
  );
  const content = Buffer.from(data.content || "", "base64").toString("utf8");
  return { content, sha: data.sha };
}

async function putFile(path, contentUtf8, message, sha) {
  const contentB64 = Buffer.from(contentUtf8, "utf8").toString("base64");
  return gh(`/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(path)}`, {
    method: "PUT",
    body: {
      message,
      content: contentB64,
      branch: BRANCH,
      sha
    }
  });
}

function safeFilename(name) {
  const base = String(name || "upload").split("/").pop();
  return base.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function clampStr(v, n) {
  return String(v || "").slice(0, n);
}

function normalizeHomeJson(input) {
  const storySlides = Array.isArray(input.storySlides)
    ? input.storySlides.slice(0, 5).map((s) => ({
        type: s && s.type === "video" ? "video" : "image",
        src: clampStr(s && s.src, 500),
        alt: clampStr(s && s.alt, 120)
      }))
    : [];

  return {
    tickerText: clampStr(input.tickerText, 120),
    heroLine1: clampStr(input.heroLine1, 80),
    heroLine2: clampStr(input.heroLine2, 80),
    heroItalic: clampStr(input.heroItalic, 80),
    subtext: clampStr(input.subtext, 400),
    storySlides
  };
}

module.exports = async function handler(req, res) {
  try {
    if (!OWNER || !REPO) return sendText(res, 500, "Missing GITHUB_REPO_OWNER/GITHUB_REPO_NAME env vars.");
    if (!requireAuth(req, res)) return;

    if (req.method === "GET") {
      const { content } = await getFile(HOME_JSON_PATH);
      res.statusCode = 200;
      res.setHeader("content-type", "application/json; charset=utf-8");
      res.end(content);
      return;
    }

    if (req.method !== "POST") return sendText(res, 405, "Method Not Allowed");

    const payload = await readBody(req);
    const action = payload && payload.action;

    if (action === "save") {
      const data = payload.data;
      if (!data || typeof data !== "object") return sendText(res, 400, "Missing data.");

      const normalized = normalizeHomeJson(data);

      const { sha } = await getFile(HOME_JSON_PATH);
      await putFile(
        HOME_JSON_PATH,
        JSON.stringify(normalized, null, 2) + "\n",
        "Update home content (admin)",
        sha
      );

      return sendJson(res, 200, { ok: true, message: "Saved. Vercel will redeploy shortly." });
    }

    if (action === "upload") {
      const filename = safeFilename(payload.filename);
      const base64 = String(payload.base64 || "");

      if (!filename || !base64) return sendText(res, 400, "Missing filename/base64.");

      // Unique filename
      const ext = filename.includes(".") ? filename.split(".").pop() : "";
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      const finalName = `${stamp}-${Math.random().toString(16).slice(2)}${ext ? "." + ext : ""}`;
      const path = `${UPLOAD_DIR}/${finalName}`;

      // IMPORTANT:
      // payload.base64 should be raw file bytes base64 (no "data:*;base64," prefix).
      await gh(`/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(path)}`, {
        method: "PUT",
        body: {
          message: `Upload ${finalName} (home admin)`,
          content: base64,
          branch: BRANCH
        }
      });

      // URL served by the same site
      const url = `/uploads/${finalName}`;
      return sendJson(res, 200, { ok: true, url });
    }

    return sendText(res, 400, "Invalid action.");
  } catch (e) {
    return sendText(res, 500, e.message || "Server error");
  }
};