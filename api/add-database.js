export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

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

    /* ------------------ 1. Find customer by token ------------------ */
    const customerRes = await fetch(
      `${supabaseUrl}/rest/v1/customers?setup_token=eq.${token}&setup_used=eq.false&select=id`,
      { headers }
    );

    const [customer] = await customerRes.json();
    if (!customer) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    const customerId = customer.id;

    /* ------------------ 2. Get Notion access token ------------------ */
    const connRes = await fetch(
      `${supabaseUrl}/rest/v1/notion_connections?customer_id=eq.${customerId}&select=access_token`,
      { headers }
    );

    const [conn] = await connRes.json();
    if (!conn?.access_token) {
      return res.status(400).json({ error: "Notion not connected" });
    }

    const accessToken = conn.access_token;

    /* ------------------ 3. Validate database with Notion ------------------ */
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
    const dbLabel =
      label || notionDb.title?.[0]?.plain_text || "Untitled";

    /* ------------------ 4. Check if this is first database ------------------ */
    const dbListRes = await fetch(
      `${supabaseUrl}/rest/v1/notion_databases?customer_id=eq.${customerId}&select=id`,
      { headers }
    );

    const existing = await dbListRes.json();
    const isFirst = existing.length === 0;

    /* ------------------ 5. Insert database ------------------ */
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