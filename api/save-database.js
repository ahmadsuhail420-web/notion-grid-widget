export default async function handler(req, res) {
  try {
    const { databaseId, label } = req.body;

    if (!databaseId) {
      return res.status(400).json({ error: "Missing databaseId" });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    const headers = {
      "Content-Type": "application/json",
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    };

    /* --------------------------------------------------
       1️⃣ Get latest Notion connection
    -------------------------------------------------- */
    const connRes = await fetch(
      `${supabaseUrl}/rest/v1/notion_connections?select=id,customer_id&order=created_at.desc&limit=1`,
      { headers }
    );

    const connections = await connRes.json();

    if (!connections.length) {
      return res.status(404).json({ error: "Notion connection not found" });
    }

    const connection = connections[0];

    /* --------------------------------------------------
       2️⃣ Insert into notion_databases
    -------------------------------------------------- */
    await fetch(
      `${supabaseUrl}/rest/v1/notion_databases`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          customer_id: connection.customer_id,
          connection_id: connection.id,
          database_id: databaseId,
          label: label || "Default",
          is_primary: true
        }),
      }
    );

    /* --------------------------------------------------
       3️⃣ Get slug
    -------------------------------------------------- */
    const customerRes = await fetch(
      `${supabaseUrl}/rest/v1/customers?id=eq.${connection.customer_id}&select=slug`,
      { headers }
    );

    const customers = await customerRes.json();
    const slug = customers[0]?.slug;

    const embedUrl = `${process.env.APP_URL}/grid.html?slug=${slug}`;

    res.json({ url: embedUrl });

  } catch (err) {
    console.error("save-database error:", err);
    res.status(500).json({ error: err.message });
  }
}