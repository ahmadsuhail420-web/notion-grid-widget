export default async function handler(req, res) {
  const { code, slug } = req.query;

  if (!code || !slug) {
    return res.status(400).send("Missing code or slug");
  }

  try {
    // 1️⃣ Exchange code for token
    const tokenRes = await fetch("https://api.notion.com/v1/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization:
          "Basic " +
          Buffer.from(
            `${process.env.NOTION_CLIENT_ID}:${process.env.NOTION_CLIENT_SECRET}`
          ).toString("base64"),
      },
      body: JSON.stringify({
        grant_type: "authorization_code",
        code,
        redirect_uri: process.env.NOTION_REDIRECT_URI,
      }),
    });

    const tokenData = await tokenRes.json();

    // ✅ DEFINE IT HERE
    const accessToken = tokenData.access_token;
    const workspaceId = tokenData.workspace_id;

    if (!accessToken) {
      return res.status(400).json(tokenData);
    }

    // 2️⃣ Save to Supabase
    await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/workspaces?on_conflict=slug`,
      {
        method: "POST",
        headers: {
          apikey: process.env.SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates",
        },
        body: JSON.stringify({
          slug,
          notion_access_token: accessToken,
          notion_workspace_id: workspaceId,
          is_active: true,
        }),
      }
    );

    // 3️⃣ Redirect to next step
    res.redirect(`/setup-database.html?slug=${slug}`);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}