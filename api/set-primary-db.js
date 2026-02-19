export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { slug, databaseRowId } = req.body;
    if (!slug || !databaseRowId) {
      return res.status(400).json({ error: "Missing slug or databaseRowId" });
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
      `${supabaseUrl}/rest/v1/customers?slug=eq.${slug}&select=id`,
      { headers }
    );
    const customers = await customerRes.json();
    if (!customers.length) {
      return res.status(404).json({ error: "Customer not found" });
    }
    const customerId = customers[0].id;

    /* ------------------ 2. Unset all primaries ------------------ */
    await fetch(
      `${supabaseUrl}/rest/v1/notion_databases?customer_id=eq.${customerId}`,
      {
        method: "PATCH",
        headers,
        body: JSON.stringify({ is_primary: false }),
      }
    );

    /* ------------------ 3. Set selected DB as primary ------------------ */
    const setRes = await fetch(
      `${supabaseUrl}/rest/v1/notion_databases?id=eq.${databaseRowId}&customer_id=eq.${customerId}`,
      {
        method: "PATCH",
        headers,
        body: JSON.stringify({ is_primary: true }),
      }
    );

    if (!setRes.ok) {
      const err = await setRes.text();
      throw new Error(err);
    }

    return res.json({ success: true });

  } catch (err) {
    console.error("set-primary-db error:", err);
    res.status(500).json({ error: err.message });
  }
}
