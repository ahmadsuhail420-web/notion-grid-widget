export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  try {
    const { code, state } = req.query;

    if (!code || !state) {
      return res.redirect("/error.html?reason=missing_code");
    }

    const setupToken = state;

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

    if (!tokenRes.ok || !tokenData.access_token) {
      console.error("OAuth error:", tokenData);
      return res.redirect("/error.html?reason=notion_auth_failed");
    }

    // 🔥 NEXT STEP: find customer by setupToken
    // 🔥 save tokenData.access_token to notion_connections
    // 🔥 mark setup_used = true

    return res.redirect(`/database.html?token=${setupToken}`);
  } catch (err) {
    console.error(err);
    return res.redirect("/error.html?reason=server_error");
  }
}