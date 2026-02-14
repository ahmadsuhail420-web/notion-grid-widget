export default async function handler(req, res) {
  const { slug, dbId } = req.body;

  if (!slug || !dbId) {
    return res.status(400).json({ error: "Missing data" });
  }

  await fetch(`${process.env.SUPABASE_URL}/rest/v1/workspaces`, {
    method: "PATCH",
    headers: {
      apikey: process.env.SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      notion_database_id: dbId,
    }),
  });

  res.json({ success: true });
}