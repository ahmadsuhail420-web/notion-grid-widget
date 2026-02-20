import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { token, databaseId, label } = req.body;

    if (!token || !databaseId) {
      return res.status(400).json({ error: "Missing token or databaseId" });
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // 1) Find customer by setup token
    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .select("id, slug")
      .eq("setup_token", token)
      .single();

    if (customerError || !customer) {
      return res.status(400).json({ error: "Invalid setup token" });
    }

    // 2) Find notion connection for that customer
    const { data: conn, error: connError } = await supabase
      .from("notion_connections")
      .select("id")
      .eq("customer_id", customer.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (connError || !conn) {
      return res.status(400).json({ error: "Notion connection not found" });
    }

    // 3) If no databases exist yet, make this one primary
    const { data: existing } = await supabase
      .from("notion_databases")
      .select("id")
      .eq("connection_id", conn.id)
      .limit(1);

    const shouldBePrimary = !existing || existing.length === 0;

    // 4) Insert DB row WITH connection_id
    const { data: inserted, error: insertError } = await supabase
      .from("notion_databases")
      .insert({
        customer_id: customer.id,
        connection_id: conn.id,
        database_id: databaseId,
        label: label || "Database",
        is_primary: shouldBePrimary,
      })
      .select("id, database_id, label, is_primary")
      .single();

    if (insertError) {
      return res.status(500).json({ error: insertError.message });
    }

    const embed_url = `${process.env.APP_URL}/grid.html?slug=${encodeURIComponent(customer.slug)}`;

    return res.json({
      ok: true,
      embed_url,
      database: inserted,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}