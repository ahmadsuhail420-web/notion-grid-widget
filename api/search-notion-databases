import { Client } from "@notionhq/client";

export default async function handler(req, res) {
  try {
    const { slug } = req.query;
    if (!slug) return res.status(400).json({ error: "Missing slug" });

    const headers = {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    };

    /* 1️⃣ Get customer */
    const customerRes = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/customers?slug=eq.${slug}&select=id`,
      { headers }
    );

    const [customer] = await customerRes.json();
    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    /* 2️⃣ Get Notion token */
    const connRes = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/notion_connections?customer_id=eq.${customer.id}&select=access_token`,
      { headers }
    );

    const [conn] = await connRes.json();
    if (!conn?.access_token) {
      return res.status(401).json({ error: "Not connected to Notion" });
    }

    /* 3️⃣ Search databases */
    const notion = new Client({ auth: conn.access_token });

    const result = await notion.search({
      filter: { property: "object", value: "database" },
    });

    res.json({
      databases: result.results.map(db => ({
        notion_database_id: db.id,
        title: db.title?.[0]?.plain_text || "Untitled",
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
