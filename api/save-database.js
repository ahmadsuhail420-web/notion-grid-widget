export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).end();
  }

  const { slug, databaseId } = req.body;

  if (!slug || !databaseId) {
    return res.status(400).json({ error: "Missing slug or databaseId" });
  }

  await fetch(`${process.env.SUPABASE_URL}/rest/v1/workspaces?slug=eq.${slug}`, {
    method: "PATCH",
    headers: {
      apikey: process.env.SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      notion_database_id: databaseId,
    }),
  });

  res.status(200).json({ success: true });
}
