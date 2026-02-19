import { Client } from "@notionhq/client";

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

    /* -------------------------------------------------
       1. Find customer by setup_token
    ------------------------------------------------- */
    const customerRes = await fetch(
      `${supabaseUrl}/rest/v1/customers?setup_token=eq.${token}&select=id,status`,
      { headers }
    );

    const customers = await customerRes.json();

    if (!customers.length) {
      return res.status(404).json({ error: "Invalid or expired token" });
    }

    const customer = customers[0];

    if (customer.status !== "active") {
      return res.status(403).json({ error: "Customer not active" });
    }

    const customerId = customer.id;

    /* -------------------------------------------------
       2. Get Notion access token
    ------------------------------------------------- */
    const connRes = await fetch(
      `${supabaseUrl}/rest/v1/notion_connections?customer_id=eq.${customerId}&select=access_token`,
      { headers }
    );

    const connections = await connRes.json();

    if (!connections.length || !connections[0].access_token) {
      return res.status(400).json({ error: "Notion not connected" });
    }

    const notion = new Client({
      auth: connections[0].access_token,
    });

    /* -------------------------------------------------
       3. Validate database access in Notion
    ------------------------------------------------- */
    let notionDb;
    try {
      notionDb = await notion.databases.retrieve({
        database_id: databaseId,
      });
    } catch (err) {
      return res
        .status(400)
        .json({ error: "Notion database not accessible" });
    }

    const finalLabel =
      label || notionDb.title?.[0]?.plain_text || "Untitled";

    /* -------------------------------------------------
       4. Check existing databases
    ------------------------------------------------- */
    const dbListRes = await fetch(
      `${supabaseUrl}/rest/v1/notion_databases?customer_id=eq.${customerId}&select=id`,
      { headers }
    );

    const existingDbs = await dbListRes.json();
    const isFirst = existingDbs.length === 0;

    /* -------------------------------------------------
       5. Prevent duplicate database
    ------------------------------------------------- */
    const duplicateRes = await fetch(
      `${supabaseUrl}/rest/v1/notion_databases?customer_id=eq.${customerId}&database_id=eq.${databaseId}`,
      { headers }
    );

    const duplicates = await duplicateRes.json();
    if (duplicates.length) {
      return res.status(409).json({ error: "Database already added" });
    }

    /* -------------------------------------------------
       6. Insert database
    ------------------------------------------------- */
    const insertRes = await fetch(
      `${supabaseUrl}/rest/v1/notion_databases`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          customer_id: customerId,
          database_id: databaseId,
          label: finalLabel,
          is_primary: isFirst,
        }),
      }
    );

    if (!insertRes.ok) {
      const errText = await insertRes.text();
      throw new Error(errText);
    }

    /* -------------------------------------------------
       7. Respond
    ------------------------------------------------- */
    return res.json({
  success: true,
  database_id,
  label: dbLabel,
  is_primary: isFirst,
  embed_url: `${process.env.PUBLIC_BASE_URL}/widget?token=${slug}`
});
  } catch (err) {
    console.error("add-database error:", err);
    return res.status(500).json({
      error: "Internal server error",
    });
  }
}