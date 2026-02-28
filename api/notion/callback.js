const { createClient } = require("@supabase/supabase-js");
const { Buffer } = require("buffer");

const DEBUG_OAUTH = false; // set true only while debugging

function makeSlugBase(input) {
  return String(input || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function randomSuffix(len = 6) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function randomTokenHex(len = 48) {
  const chars = "abcdef0123456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  const appUrl =
    process.env.APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

  try {
    const { code, state } = req.query;

    if (!code || !state) {
      if (DEBUG_OAUTH) return res.status(400).json({ step: "missing_code_or_state", code, state });
      return res.redirect(`${appUrl}/error.html?reason=missing_code`);
    }

    const setupToken = state;

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    // 1) Validate setup token -> customer
    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .select("id,slug,setup_used,dashboard_token,default_widget_slug")
      .eq("setup_token", setupToken)
      .single();

    if (customerError || !customer) {
      if (DEBUG_OAUTH) {
        return res.status(401).json({ step: "customer_lookup_failed", setupToken, customerError, customer });
      }
      return res.redirect(`${appUrl}/error.html?reason=invalid_setup_token`);
    }

    // 2) Exchange code for Notion access token
    const tokenRes = await fetch("https://api.notion.com/v1/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization:
          "Basic " +
          Buffer.from(`${process.env.NOTION_CLIENT_ID}:${process.env.NOTION_CLIENT_SECRET}`).toString("base64"),
      },
      body: JSON.stringify({
        grant_type: "authorization_code",
        code,
        redirect_uri: process.env.NOTION_REDIRECT_URI,
      }),
    });

    const tokenData = await tokenRes.json().catch(() => ({}));

    if (!tokenRes.ok || !tokenData.access_token) {
      if (DEBUG_OAUTH) {
        return res.status(400).json({
          step: "notion_token_exchange_failed",
          http_status: tokenRes.status,
          tokenData,
        });
      }
      return res.redirect(`${appUrl}/error.html?reason=notion_auth_failed`);
    }

    // 3) Upsert Notion connection (avoid duplicates)
    const upsertPayload = {
      customer_id: customer.id,
      access_token: tokenData.access_token,
      workspace_id: tokenData.workspace_id || null,
      workspace_name: tokenData.workspace_name || null,
      bot_id: tokenData.bot_id || null,
      updated_at: new Date().toISOString(),
    };

    const { error: upsertError } = await supabase
      .from("notion_connections")
      .upsert(upsertPayload, { onConflict: "customer_id" });

    if (upsertError) {
      if (DEBUG_OAUTH) {
        return res.status(500).json({
          step: "supabase_upsert_failed",
          upsertPayload: { ...upsertPayload, access_token: "[REDACTED]" },
          upsertError,
        });
      }
      return res.redirect(`${appUrl}/error.html?reason=db_upsert_failed`);
    }

    // 4) Ensure a widget exists for this customer (create default if none)
    const { data: existingWidgets, error: widgetListError } = await supabase
      .from("widgets")
      .select("id,slug,name,created_at")
      .eq("customer_id", customer.id)
      .order("created_at", { ascending: true })
      .limit(1);

    if (widgetListError) {
      if (DEBUG_OAUTH) return res.status(500).json({ step: "widget_lookup_failed", widgetListError });
      return res.redirect(`${appUrl}/error.html?reason=widget_lookup_failed`);
    }

    let widget = existingWidgets?.[0] || null;

    if (!widget) {
      const base = makeSlugBase(customer.slug) || "widget";
      // slug must be unique globally, so add suffix
      const newSlug = `${base}-${randomSuffix(6)}`;

      const { data: createdWidget, error: createWidgetError } = await supabase
        .from("widgets")
        .insert({
          customer_id: customer.id,
          slug: newSlug,
          name: "My Grid",
        })
        .select("id,slug,name")
        .single();

      if (createWidgetError || !createdWidget) {
        if (DEBUG_OAUTH) return res.status(500).json({ step: "widget_create_failed", createWidgetError });
        return res.redirect(`${appUrl}/error.html?reason=widget_create_failed`);
      }

      widget = createdWidget;
    }

    // 5) Mark setup token used (optional: keep this behavior)
    if (!customer.setup_used) {
      const { error: updateError } = await supabase
        .from("customers")
        .update({ setup_used: true })
        .eq("id", customer.id);

      if (updateError && DEBUG_OAUTH) {
        return res.status(500).json({ step: "mark_setup_used_failed", updateError, widget });
      }
    }

    // 6) Ensure dashboard_token exists (for dashboard access)
let dashboardToken = customer.dashboard_token;

if (!dashboardToken) {
  dashboardToken = randomTokenHex(48);

  const { error: dashTokenErr } = await supabase
    .from("customers")
    .update({
      dashboard_token: dashboardToken,
      dashboard_token_created_at: new Date().toISOString(),
      default_widget_slug: customer.default_widget_slug || widget.slug,
    })
    .eq("id", customer.id);

  if (dashTokenErr) {
    if (DEBUG_OAUTH) return res.status(500).json({ step: "dashboard_token_update_failed", dashTokenErr });
    return res.redirect(`${appUrl}/error.html?reason=dashboard_token_update_failed`);
  }
}
    if (!customer.default_widget_slug) {
  await supabase
    .from("customers")
    .update({ default_widget_slug: widget.slug })
    .eq("id", customer.id);
}

// 7) Redirect to dashboard (token-based)
return res.redirect(`${appUrl}/database.html?token=${encodeURIComponent(dashboardToken)}`);
