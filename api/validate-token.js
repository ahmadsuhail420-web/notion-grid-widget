const { createClient } = require("@supabase/supabase-js");

/**
 * Validates setup token.
 *
 * Updated behavior (for dashboard_token redirect):
 * - If token is unused: allow setup to continue, return { valid:true, plan, dashboard_token }.
 * - If token is already used: return { valid:false, already_used:true, dashboard_token } so setup.html can redirect to:
 *   /database.html?token=<dashboard_token>
 *
 * NOTE:
 * - We keep widget lookup as a fallback for older data, but primary redirect is now dashboard_token.
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

    // 3) setup_used=true => redirect to dashboard token (preferred)
    if (customer.dashboard_token) {
      return res.json({
        valid: false,
        already_used: true,
        dashboard_token: customer.dashboard_token,
      });
    }

    // 4) Fallback: older rows may not have dashboard_token; try to derive via widget/customer relationship
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

    // Last-resort (if you still support slug-based dashboards somewhere)
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
