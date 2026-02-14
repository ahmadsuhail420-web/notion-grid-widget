export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { slug, database_id } = req.body;

  if (!slug || !database_id) {
    return res.status(400).json({ error: "Missing slug or database_id" });
  }

  // Update workspace row
  await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/workspaces?slug=eq.${slug}`,
    {
      method: "PATCH",
      headers: {
        apikey: process.env.SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        notion_database_id: database_id,
      }),
    }
  );

  res.json({ success: true });
}
