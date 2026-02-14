export default async function handler(req, res) {
  const { code, state } = req.query;
  const slug = state; // ✅ THIS WAS MISSING

  if (!code || !slug) {
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
    const supabaseRes = await fetch(
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

const text = await supabaseRes.text();
console.log("SUPABASE RESPONSE:", text);

    // 3️⃣ Redirect to next setup step
    res.redirect(`/setup-database.html?slug=${state}`);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
