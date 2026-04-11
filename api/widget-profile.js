// Pro-only: update widget profile name/note/picture stored in widget_settings.
// Security: requires slug + key (widgets.admin_secret)

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function supabaseFetch(path, { method = "GET", body, preferReturn = true } = {}) {
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
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }

  if (!res.ok) {
    const msg = (data && data.message) || (data && data.error) || `Supabase error (${res.status})`;
    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ error: "Missing Supabase env vars" });
    }

    const { slug, edit_token, name, note, picture } = req.body || {};
if (!slug) return res.status(400).json({ error: "Missing slug" });

// 1) Resolve widget (need customer_id)
const widgets = await supabaseFetch(
  `widgets?slug=eq.${encodeURIComponent(slug)}&select=id,customer_id,slug,name&limit=1`
);
const widget = Array.isArray(widgets) ? widgets[0] : null;
if (!widget) return res.status(404).json({ error: "Widget not found" });

// 2) Auth: require valid edit_token session only
if (!edit_token) {
  return res.status(401).json({ error: "Unauthorized" });
}
const sessions = await supabaseFetch(
  `customer_edit_sessions?token=eq.${encodeURIComponent(edit_token)}` +
  `&customer_id=eq.${encodeURIComponent(widget.customer_id)}` +
  `&select=token,expires_at&limit=1`
);
const session = Array.isArray(sessions) ? sessions[0] : null;
const expiresAt = session?.expires_at ? new Date(session.expires_at).getTime() : 0;
if (!session || expiresAt < Date.now()) {
  return res.status(401).json({ error: "Unauthorized or session expired" });
}

    // 2) Check customer plan is pro
    const customers = await supabaseFetch(
      `customers?id=eq.${encodeURIComponent(widget.customer_id)}&status=eq.active&select=id,plan&limit=1`
    );
    const customer = Array.isArray(customers) ? customers[0] : null;
    if (!customer) return res.status(403).json({ error: "Customer not active" });

    const plan = (customer.plan || "free") === "pro" ? "pro" : "free";
    if (plan !== "pro") return res.status(403).json({ error: "Pro required" });

    // 3) Upsert widget_settings row (if missing)
    const existing = await supabaseFetch(
      `widget_settings?widget_id=eq.${encodeURIComponent(widget.id)}&select=widget_id&limit=1`,
      { preferReturn: false }
    );
    const exists = Array.isArray(existing) && existing.length > 0;

    const payload = {};
    if (typeof name === "string") payload.profile_name = name;
    if (typeof note === "string") payload.profile_note = note;

    // picture: allow explicit null to clear
    if (Object.prototype.hasOwnProperty.call(req.body || {}, "picture")) {
      payload.profile_picture_url = picture === null ? null : String(picture);
    }

    if (!exists) {
      await supabaseFetch("widget_settings", {
        method: "POST",
        body: [{ widget_id: widget.id, ...payload }],
      });
    } else {
      await supabaseFetch(`widget_settings?widget_id=eq.${encodeURIComponent(widget.id)}`, {
        method: "PATCH",
        body: payload,
      });
    }

    // 4) Return updated profile (with fallbacks)
    const settingsRows = await supabaseFetch(
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
