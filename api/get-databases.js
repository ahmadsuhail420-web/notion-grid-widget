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

/* 2️⃣ Get Notion connection */
const connRes = await fetch(
  `${process.env.SUPABASE_URL}/rest/v1/notion_connections?customer_id=eq.${customer.id}&select=id`,
  { headers }
);

const [connection] = await connRes.json();

if (!connection) {
  return res.status(404).json({ error: "No Notion connection found" });
}

/* 3️⃣ Get databases */
const dbRes = await fetch(
  `${process.env.SUPABASE_URL}/rest/v1/notion_databases?connection_id=eq.${connection.id}&select=id,notion_database_id,label,is_primary&order=created_at.asc`,
  { headers }
);

const databases = await dbRes.json();

const primary = databases.find(db => db.is_primary) || null;

res.json({
  primary,
  databases,
});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
