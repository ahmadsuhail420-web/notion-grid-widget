export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { slug, databaseUrl, label } = req.body;
    if (!slug || !databaseUrl) {
      return res.status(400).json({ error: "Missing slug or databaseUrl" });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    const headers = {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    };

    /* ------------------ 1. Find customer ------------------ */
    const customerRes = await fetch(
      `${supabaseUrl}/rest/v1/customers?slug=eq.${slug}&status=eq.active&select=id`,
      { headers }
    );
    const customers = await customerRes.json();
    if (!customers.length) {
      return res.status(404).json({ error: "Customer not found" });
    }
    const customerId = customers[0].id;

    /* ------------------ 2. Get Notion token ------------------ */
    const connRes = await fetch(
      `${supabaseUrl}/rest/v1/notion_connections?customer_id=eq.${customerId}&select=access_token`,
      { headers }
    );
    const conns = await connRes.json();
    if (!conns.length || !conns[0].access_token) {
      return res.status(400).json({ error: "Notion not connected" });
    }
    const accessToken = conns[0].access_token;

    /* ------------------ 3. Extract database_id ------------------ */
    const match = databaseUrl.match(/[a-f0-9]{32}/i);
    if (!match) {
      return res.status(400).json({ error: "Invalid Notion database URL" });
    }
    const databaseId = match[0];

    /* ------------------ 4. Validate database via Notion ------------------ */
    const notionCheck = await fetch(
      `https://api.notion.com/v1/databases/${databaseId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Notion-Version": "2022-06-28",
        },
      }
    );

    if (!notionCheck.ok) {
      return res.status(400).json({ error: "Notion database not accessible" });
    }

    const notionDb = await notionCheck.json();
    const dbLabel = label || notionDb.title?.[0]?.plain_text || "Untitled";

    /* ------------------ 5. Check existing DBs ------------------ */
    const dbListRes = await fetch(
      `${supabaseUrl}/rest/v1/notion_databases?customer_id=eq.${customerId}&select=id`,
      { headers }
    );
    const existingDbs = await dbListRes.json();
    const isFirst = existingDbs.length === 0;

    /* ------------------ 6. Insert database ------------------ */
    const insertRes = await fetch(
      `${supabaseUrl}/rest/v1/notion_databases`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          customer_id: customerId,
          database_id: databaseId,
          label: dbLabel,
          is_primary: isFirst,
        }),
      }
    );

    if (!insertRes.ok) {
      const err = await insertRes.text();
      throw new Error(err);
    }

    return res.json({
      success: true,
      database_id: databaseId,
      label: dbLabel,
      is_primary: isFirst,
    });

  } catch (err) {
    console.error("add-database error:", err);
    res.status(500).json({ error: err.message });
  }
}
