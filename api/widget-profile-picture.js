// Pro-only: upload widget profile picture to Supabase Storage and persist URL in widget_settings.
// Security: requires slug + key (widgets.admin_secret)
//
// Payload (JSON):
// { slug, key, filename, contentType, fileBase64 }  // fileBase64 WITHOUT data: prefix

const { createClient } = require("@supabase/supabase-js");
const crypto = require("crypto");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const BUCKET = process.env.SUPABASE_PROFILE_PICS_BUCKET || "widget-profile-pics";

async function supabaseRest(path, { method = "GET", body, preferReturn = true } = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      ...(preferReturn ? { Prefer: "return=representation" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    const msg = (data && data.message) || (data && data.error) || `Supabase error (${res.status})`;
    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

function safeExt(filename, contentType) {
  const f = String(filename || "").toLowerCase();
  if (f.endsWith(".png")) return "png";
  if (f.endsWith(".jpg") || f.endsWith(".jpeg")) return "jpg";
  if (f.endsWith(".webp")) return "webp";

  const ct = String(contentType || "").toLowerCase();
  if (ct.includes("png")) return "png";
  if (ct.includes("jpeg") || ct.includes("jpg")) return "jpg";
  if (ct.includes("webp")) return "webp";
  return "png";
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ error: "Missing Supabase env vars" });
    }

    const { slug, key, edit_token, filename, contentType, fileBase64 } = req.body || {};
if (!slug) return res.status(400).json({ error: "Missing slug" });
if (!fileBase64) return res.status(400).json({ error: "Missing fileBase64" });

// 1) Resolve widget
const widgets = await supabaseRest(
  `widgets?slug=eq.${encodeURIComponent(slug)}&select=id,customer_id,slug,name,admin_secret&limit=1`
);
const widget = Array.isArray(widgets) ? widgets[0] : null;
if (!widget) return res.status(404).json({ error: "Widget not found" });

// Require edit_token only!
if (!edit_token) {
  return res.status(401).json({ error: "Unauthorized" });
}
const sessions = await supabaseRest(
  `customer_edit_sessions?token=eq.${encodeURIComponent(edit_token)}` +
  `&customer_id=eq.${encodeURIComponent(widget.customer_id)}` +
  `&select=token,expires_at&limit=1`
);
const session = Array.isArray(sessions) ? sessions[0] : null;
const expiresAt = session?.expires_at ? new Date(session.expires_at).getTime() : 0;
if (!session || expiresAt < Date.now()) {
  return res.status(401).json({ error: "Unauthorized or session expired" });
}

    // 2) Check plan
    const customers = await supabaseRest(
      `customers?id=eq.${encodeURIComponent(widget.customer_id)}&status=eq.active&select=id,plan&limit=1`
    );
    const customer = Array.isArray(customers) ? customers[0] : null;
    if (!customer) return res.status(403).json({ error: "Customer not active" });

    const plan = (customer.plan || "free") === "pro" ? "pro" : "free";
    if (plan !== "pro") return res.status(403).json({ error: "Pro required" });

    // 3) Upload to Storage
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const buf = Buffer.from(String(fileBase64), "base64");

    // (Optional) basic size guard (2.5MB)
    if (buf.length > 2.5 * 1024 * 1024) {
      return res.status(413).json({ error: "File too large (max 2.5MB)" });
    }

    const ext = safeExt(filename, contentType);
    const hash = crypto.randomBytes(12).toString("hex");
    const path = `widgets/${widget.id}/profile-${Date.now()}-${hash}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, buf, {
        contentType: contentType || "image/png",
        upsert: true,
      });

    if (upErr) throw new Error(upErr.message || "Upload failed");

    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
    const publicUrl = pub?.publicUrl || null;
    if (!publicUrl) throw new Error("Failed to get public URL");

    // 4) Upsert widget_settings.profile_picture_url
    const existing = await supabaseRest(
      `widget_settings?widget_id=eq.${encodeURIComponent(widget.id)}&select=widget_id&limit=1`,
      { preferReturn: false }
    );
    const exists = Array.isArray(existing) && existing.length > 0;

    if (!exists) {
      await supabaseRest("widget_settings", {
        method: "POST",
        body: [{ widget_id: widget.id, profile_picture_url: publicUrl }],
      });
    } else {
      await supabaseRest(`widget_settings?widget_id=eq.${encodeURIComponent(widget.id)}`, {
        method: "PATCH",
        body: { profile_picture_url: publicUrl },
      });
    }

    // 5) Return updated profile (with fallbacks)
    const settingsRows = await supabaseRest(
      `widget_settings?widget_id=eq.${encodeURIComponent(widget.id)}&select=profile_name,profile_note,profile_picture_url&limit=1`
    );
    const settings = Array.isArray(settingsRows) ? settingsRows[0] : null;

    const profile = {
      name: settings?.profile_name || widget.name || "Grid Planner",
      note: settings?.profile_note || "",
      picture: settings?.profile_picture_url || "/icons/profile-placeholder.png",
    };

    return res.status(200).json({ ok: true, profile });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Server error" });
  }
};
