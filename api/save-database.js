export default async function handler(req, res) {
  try {
    const { token, databaseId } = req.body;

    if (!databaseId) {
      return res.status(400).json({ error: "Missing databaseId" });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    // 1. Get the latest notion connection (OAuth already proved identity)
    const connRes = await fetch(
      `${supabaseUrl}/rest/v1/notion_connections?select=customer_id&order=created_at.desc&limit=1`,
      {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
      }
    );

    const connections = await connRes.json();

    if (!connections.length) {
      return res.status(404).json({ error: "Notion connection not found" });
    }

    const customerId = connections[0].customer_id;

    // 2. Save database ID
    await fetch(
      `${supabaseUrl}/rest/v1/notion_connections?customer_id=eq.${customerId}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({ database_id: databaseId }),
      }
    );

    // 3. Get slug for embed URL
    const customerRes = await fetch(
      `${supabaseUrl}/rest/v1/customers?id=eq.${customerId}&select=slug`,
      {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
      }
    );

    const customers = await customerRes.json();
    const slug = customers[0].slug;

    const embedUrl = `${process.env.APP_URL}/grid.html?slug=${slug}`;

    res.json({ url: embedUrl });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
