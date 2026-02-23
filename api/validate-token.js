import { createClient } from "@supabase/supabase-js";

/**
 * Validates setup token and returns customer data
 * Called before setup flow to ensure token is valid
 */
export default async function handler(req, res) {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({ error: "Missing token" });
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // 1️⃣ Validate token exists and is not used
    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .select("id, slug, plan, setup_used")
      .eq("setup_token", token)
      .eq("status", "active")
      .single();

    if (customerError || !customer) {
      return res.status(401).json({ 
        error: "Invalid or expired setup token",
        valid: false 
      });
    }

    // 2️⃣ Check if already used
    if (customer.setup_used) {
      // Token already used, redirect to dashboard
      return res.json({ 
        valid: false,
        already_used: true,
        slug: customer.slug
      });
    }

    // ✅ Token is valid
    return res.json({ 
      valid: true,
      slug: customer.slug,
      plan: customer.plan
    });

  } catch (err) {
    console.error("Token validation error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}
