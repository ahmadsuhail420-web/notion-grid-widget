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
      `${supabaseUrl}/rest/v1/customers?slug=eq.${encodeURIComponent(slug)}&select=id`,
      { headers }
    );
    
    if (!customerRes.ok) {
      return res.status(customerRes.status).json({ error: "Failed to fetch customer" });
    }
    
    const customers = await customerRes.json();
    if (!customers.length) {
      return res.status(404).json({ error: "Customer not found" });
    }
    const customerId = customers[0].id;

    /* ------------------ 2. Unset all primaries ------------------ */
    const unsetRes = await fetch(
      `${supabaseUrl}/rest/v1/notion_databases?customer_id=eq.${customerId}`,
      {
        method: "PATCH",
        headers,
        body: JSON.stringify({ is_primary: false }),
      }
    );
    
    if (!unsetRes.ok) {
      console.error("Failed to unset primaries:", unsetRes.status);
      return res.status(500).json({ error: "Failed to unset primary databases" });
    }

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
      console.error("Failed to set primary:", err);
      return res.status(setRes.status).json({ error: "Failed to set primary database" });
    }

    return res.json({ success: true });

  } catch (err) {
    console.error("set-primary-db error:", err);
    return res.status(500).json({ error: err.message });
  }
}