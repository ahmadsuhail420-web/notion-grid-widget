import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  try {
    const { token } = req.query;

    if (!token) return res.status(400).json({ error: "Missing token" });

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .select("id, plan, setup_used")
      .eq("setup_token", token)
      .eq("status", "active")
      .single();

    if (customerError || !customer) {
      return res.status(401).json({ valid: false, error: "Invalid or expired setup token" });
    }

    // Find the customer's first widget (if it exists)
    const { data: widgetRows, error: widgetError } = await supabase
      .from("widgets")
      .select("slug")
      .eq("customer_id", customer.id)
      .order("created_at", { ascending: true })
      .limit(1);

    if (widgetError) {
      return res.status(500).json({ valid: false, error: "Failed to lookup widget" });
    }

    const widget_slug = widgetRows?.[0]?.slug || null;

    // If already used, we MUST have a widget slug to redirect
    if (customer.setup_used) {
      if (!widget_slug) {
        return res.status(409).json({
          valid: false,
          already_used: true,
          error: "Setup already used but no widget exists for this customer.",
        });
      }

      return res.json({
        valid: false,
        already_used: true,
        widget_slug,
      });
    }

    return res.json({
      valid: true,
      plan: customer.plan,
      widget_slug, // may be null until callback creates it (that's OK)
    });
  } catch (err) {
    console.error("Token validation error:", err);
    return res.status(500).json({ valid: false, error: "Server error" });
  }
}
