import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  try {
    const { slug } = req.query;

    if (!slug) {
      return res.status(400).json({ error: "Missing slug" });
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // 1️⃣ Find customer by slug
    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .select("id, plan")
      .eq("slug", slug)
      .single();

    if (customerError || !customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    // 2️⃣ Get latest Notion connection
    const { data: conn, error: connError } = await supabase
      .from("notion_connections")
      .select("id")
      .eq("customer_id", customer.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (connError || !conn) {
      return res.status(404).json({ error: "No Notion connection found" });
    }

    // 3️⃣ Get databases
    const { data: databases, error: dbError } = await supabase
      .from("notion_databases")
      .select("id, database_id, label, is_primary, created_at")
      .eq("connection_id", conn.id)
      .order("created_at", { ascending: true });

    if (dbError) {
      return res.status(500).json({ error: dbError.message });
    }

    return res.json({
      plan: customer.plan || "free",
      databases: databases || [],
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}