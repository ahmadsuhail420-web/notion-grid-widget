const { createClient } = require("@supabase/supabase-js");

/**
 * Validates setup token.
 *
 * Updated for your flow:
 * - If token is unused: { valid:true, plan, dashboard_token }
 * - If token is already used: { valid:false, already_used:true, dashboard_token }
 *
 * setup.html will redirect to:
 *   /database.html?token=<dashboard_token>
 *
 * NOTE: This file uses CommonJS (module.exports) to match Vercel Node serverless style.
 */
module.exports = async function handler(req, res) {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({ valid: false, error: "Missing token" });
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // 1) Lookup customer by setup token
    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .select("id, plan, setup_used, dashboard_token")
      .eq("setup_token", token)
      .eq("status", "active")
      .single();

    if (customerError || !customer) {
      return res.status(401).json({
        valid: false,
        error: "Invalid or expired setup token",
      });
    }

    // 2) If setup not used yet, allow user to proceed
    if (!customer.setup_used) {
      return res.json({
        valid: true,
        plan: customer.plan || "free",
        dashboard_token: customer.dashboard_token || null,
      });
    }

    // 3) setup_used=true => redirect to dashboard (preferred)
    if (customer.dashboard_token) {
      return res.json({
        valid: false,
        already_used: true,
        dashboard_token: customer.dashboard_token,
      });
    }

    // 4) Fallback: keep old widget lookup (in case some old customers have no dashboard_token)
    const { data: widgets, error: widgetError } = await supabase
      .from("widgets")
      .select("slug, created_at")
      .eq("customer_id", customer.id)
      .order("created_at", { ascending: true })
      .limit(1);

    if (widgetError) {
      return res.status(500).json({
        valid: false,
        already_used: true,
        error: "Failed to lookup widget for customer",
      });
    }

    const widget_slug = widgets?.[0]?.slug;

    if (!widget_slug) {
      return res.status(409).json({
        valid: false,
        already_used: true,
        error: "Setup already used but no dashboard token exists for this customer.",
      });
    }

    // If you *still* have any slug-based fallback logic elsewhere, you can keep returning it.
    return res.json({
      valid: false,
      already_used: true,
      widget_slug,
    });
  } catch (err) {
    console.error("Token validation error:", err);
    return res.status(500).json({ valid: false, error: "Server error" });
  }
};
