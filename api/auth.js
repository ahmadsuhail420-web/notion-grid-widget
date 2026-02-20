export default async function handler(req, res) {
  const { token, slug } = req.query;

  if (!token || !slug) {
    return res.status(400).json({ error: "Missing token or slug" });
  }

  const notionAuthUrl = `https://api.notion.com/v1/oauth/authorize?client_id=${process.env.NOTION_CLIENT_ID}&response_type=code&owner=user&redirect_uri=${encodeURIComponent(process.env.NOTION_REDIRECT_URI)}&state=${token}__${slug}`;

  return res.redirect(notionAuthUrl);
}