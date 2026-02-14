export default async function handler(req, res) {
  const { code, state } = req.query; // state = slug

  if (!code || !state) {
    return res.status(400).send("Missing code or slug");
  }

  try {
    // 1️⃣ Exchange code for access token
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

    if (!tokenData.access_token) {
      return res.status(400).json(tokenData);
    }

    // 2️⃣ Save workspace to Supabase
    await fetch(`${process.env.SUPABASE_URL}/rest/v1/workspaces`, {
      method: "POST",
      headers: {
        apikey: process.env.SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify({
        slug: state,
        notion_access_token: tokenData.access_token,
        notion_workspace_id: tokenData.workspace_id,
        is_active: true,
      }),
    });

    // 3️⃣ Redirect to next setup step
    res.redirect(`/setup-database.html?slug=${state}`);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
