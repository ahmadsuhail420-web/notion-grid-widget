export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  try {
    const { slug } = req.query;
    if (!slug) return res.status(400).json({ error: "Missing slug" });

    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    const headers = {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    };

    // 1️⃣ Customer
    const customerRes = await fetch(
      `${supabaseUrl}/rest/v1/customers?slug=eq.${encodeURIComponent(slug)}&select=id,plan`,
      { headers }
    );
    
    if (!customerRes.ok) {
      console.error("Customer fetch failed:", customerRes.status);
      return res.status(customerRes.status).json({ error: "Failed to fetch customer" });
    }
    
    const [customer] = await customerRes.json();
    if (!customer) return res.status(404).json({ error: "Customer not found" });

    // 2️⃣ Connection
    const connRes = await fetch(
      `${supabaseUrl}/rest/v1/notion_connections?customer_id=eq.${customer.id}&select=id`,
      { headers }
    );
    
    if (!connRes.ok) {
      console.error("Connection fetch failed:", connRes.status);
      return res.json({ databases: [], plan: customer.plan });
    }
    
    const [connection] = await connRes.json();
    if (!connection) return res.json({ databases: [], plan: customer.plan });

    // 3️⃣ Databases
    const dbRes = await fetch(
      `${supabaseUrl}/rest/v1/notion_databases?connection_id=eq.${connection.id}&select=id,label,database_id,is_primary&order=created_at.asc`,
      { headers }
    );

    if (!dbRes.ok) {
      console.error("Database fetch failed:", dbRes.status);
      return res.json({ databases: [], plan: customer.plan });
    }

    const databases = await dbRes.json();

    return res.json({
      plan: customer.plan || "free",
      databases: databases || [],
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to load databases" });
  }
}