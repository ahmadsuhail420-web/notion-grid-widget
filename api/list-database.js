import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  try {
    const slug = req.query.slug;
    if (!slug) return res.status(400).json({ error: "Missing slug" });

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .select("id, plan")
      .eq("slug", slug)
      .single();

    if (customerError || !customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    const plan = customer.plan || "free";

    const { data: databases, error: dbError } = await supabase
      .from("notion_databases")
      .select("id, label, database_id, is_primary")
      .eq("customer_id", customer.id)
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: true });

    if (dbError) {
      return res.status(500).json({ error: dbError.message });
    }

    return res.status(200).json({ plan, databases: databases || [] });
  } catch (e) {
    console.error("list-database error:", e);
    return res.status(500).json({ error: "Server error" });
  }
}