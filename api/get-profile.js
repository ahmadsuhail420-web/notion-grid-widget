export default async function handler(req, res) {
  try {
    const { slug } = req.query;
    if (!slug) return res.status(400).json({});

    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    // 1️⃣ Get customer
    const customerRes = await fetch(
      `${supabaseUrl}/rest/v1/customers?slug=eq.${slug}&status=eq.active&select=id`,
      {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
      }
    );

    const customers = await customerRes.json();
    if (!customers.length) return res.json({});

    const customerId = customers[0].id;

    // 2️⃣ Get Notion connection
    const connRes = await fetch(
      `${supabaseUrl}/rest/v1/notion_connections?customer_id=eq.${customerId}&select=access_token,database_id`,
      {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
      }
    );

    const conns = await connRes.json();
    if (!conns.length) return res.json({});

    const { access_token, database_id } = conns[0];

    // 3️⃣ Get database metadata
    const notionRes = await fetch(
      `https://api.notion.com/v1/databases/${database_id}`,
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
          "Notion-Version": "2022-06-28",
        },
      }
    );

    const db = await notionRes.json();

    const name =
      db.properties?.["Profile Name"]?.title?.[0]?.plain_text || "Grid Planner";

    const picture =
      db.properties?.["Profile Picture"]?.files?.[0]?.file?.url ||
      db.properties?.["Profile Picture"]?.files?.[0]?.external?.url ||
      null;

    res.json({ name, picture });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
