export default async function handler(req, res) {
  try {
    const { token, databaseId } = req.body;

    if (!token || !databaseId) {
      return res.status(400).json({ error: "Missing token or databaseId" });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    // 1. Find customer
    const customerRes = await fetch(
      `${supabaseUrl}/rest/v1/customers?setup_token=eq.${token}&select=id,slug`,
      {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
      }
    );

    const customers = await customerRes.json();
    if (!customers.length) {
      return res.status(404).json({ error: "Customer not found" });
    }

    const customer = customers[0];

    // 2. Save database ID to notion_connections
    await fetch(
      `${supabaseUrl}/rest/v1/notion_connections?customer_id=eq.${customer.id}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({
          database_id: databaseId,
        }),
      }
    );

    // 3. Return embed URL
    const embedUrl = `${process.env.APP_URL}/grid.html?slug=${customer.slug}`;

    res.json({ url: embedUrl });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
