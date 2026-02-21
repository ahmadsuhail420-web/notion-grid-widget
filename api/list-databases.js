export default async function handler(req, res) {
  try {
    const { slug, token } = req.query;

    if (!slug && !token) {
      return res.status(400).json({ error: "Missing slug or token" });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    const headers = {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    };

    let customer;

    // 🔹 If dashboard (token)
    if (token) {
      const customerRes = await fetch(
        `${supabaseUrl}/rest/v1/customers?setup_token=eq.${token}&select=id,plan`,
        { headers }
      );
      const result = await customerRes.json();
      customer = result[0];
    }

    // 🔹 If widget (slug)
    if (slug) {
      const customerRes = await fetch(
        `${supabaseUrl}/rest/v1/customers?slug=eq.${slug}&select=id,plan`,
        { headers }
      );
      const result = await customerRes.json();
      customer = result[0];
    }

    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    // 🔹 Get connection
    const connRes = await fetch(
      `${supabaseUrl}/rest/v1/notion_connections?customer_id=eq.${customer.id}&select=id`,
      { headers }
    );
    const connections = await connRes.json();
    const connection = connections[0];

    if (!connection) {
      return res.status(404).json({ error: "No Notion connection found" });
    }

    // 🔹 Get ALL databases
    const dbRes = await fetch(
      `${supabaseUrl}/rest/v1/notion_databases?connection_id=eq.${connection.id}&select=id,database_id,label,is_primary&order=created_at.asc`,
      { headers }
    );

    const databases = await dbRes.json();

    // 🔥 Return plan also (needed for limits)
    return res.json({
      plan: customer.plan || "free",
      databases
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}