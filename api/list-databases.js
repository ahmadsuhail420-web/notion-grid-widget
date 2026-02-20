export default async function handler(req, res) {
  try {
    const { slug } = req.query;
    if (!slug) return res.status(400).json({ error: "Missing slug" });

    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    const headers = {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    };

    // 1) customer
    const customerRes = await fetch(
      `${supabaseUrl}/rest/v1/customers?slug=eq.${slug}&select=id`,
      { headers }
    );
    const [customer] = await customerRes.json();
    if (!customer) return res.status(404).json({ error: "Customer not found" });

    // 2) connection
    const connRes = await fetch(
      `${supabaseUrl}/rest/v1/notion_connections?customer_id=eq.${customer.id}&select=id`,
      { headers }
    );
    const [connection] = await connRes.json();
    if (!connection) return res.status(404).json({ error: "No Notion connection found" });

    // 3) databases (✅ database_id)
    const dbRes = await fetch(
      `${supabaseUrl}/rest/v1/notion_databases?connection_id=eq.${connection.id}&select=id,database_id,label,is_primary&order=created_at.asc`,
      { headers }
    );
    const databases = await dbRes.json();

    return res.json(databases);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}