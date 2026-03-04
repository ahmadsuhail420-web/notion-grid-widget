const { createClient } = require("@supabase/supabase-js");

/**
 * Validates setup token.
 *
 * For setup.html:
 * - If token is unused: { valid:true, plan, dashboard_token }
 * - If token is already used: { valid:false, already_used:true, dashboard_token }
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

    if (!customer.setup_used) {
      return res.json({
        valid: true,
        plan: customer.plan || "free",
        dashboard_token: customer.dashboard_token || null,
      });
    }

    if (customer.dashboard_token) {
      return res.json({
        valid: false,
        already_used: true,
        dashboard_token: customer.dashboard_token,
      });
    }

    // fallback (optional): keep old widget lookup
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

    return res.status(409).json({
      valid: false,
      already_used: true,
      error:
        widget_slug
          ? "Setup already used but customer has no dashboard_token (add dashboard_token migration)."
          : "Setup already used but no widget exists for this customer.",
    });
  } catch (err) {
    console.error("Token validation error:", err);
    return res.status(500).json({ valid: false, error: "Server error" });
  }
};
