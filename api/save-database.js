export default async function handler(req, res) {
  try {
    const { token, databaseId, label } = req.body;

    if (!token || !databaseId) {
      return res.status(400).json({ error: "Missing token or databaseId" });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    const headers = {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    };

    /* 1️⃣ Get customer using setup token */
    const customerRes = await fetch(
      `${supabaseUrl}/rest/v1/customers?setup_token=eq.${token}&select=id,slug`,
      { headers }
    );

    const [customer] = await customerRes.json();
    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    /* 2️⃣ Get notion connection for this customer */
    const connRes = await fetch(
      `${supabaseUrl}/rest/v1/notion_connections?customer_id=eq.${customer.id}&select=id`,
      { headers }
    );

    const [connection] = await connRes.json();
    if (!connection) {
      return res.status(404).json({ error: "Connection not found" });
    }

    /* 3️⃣ Insert into notion_databases */
    const insertRes = await fetch(
      `${supabaseUrl}/rest/v1/notion_databases`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          customer_id: customer.id,
          connection_id: connection.id,
          database_id: databaseId,
          label: label || "Untitled",
          is_primary: true
        }),
      }
    );

    if (!insertRes.ok) {
      const err = await insertRes.text();
      console.error(err);
      return res.status(500).json({ error: "Insert failed" });
    }

    /* 4️⃣ Return embed URL */
    const embedUrl = `${process.env.APP_URL}/grid.html?slug=${customer.slug}`;

    res.json({ url: embedUrl });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}