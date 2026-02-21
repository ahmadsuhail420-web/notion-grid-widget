export default async function handler(req, res) {
  const { token, slug } = req.query;

  if (!token) {
    return res.status(400).send("Missing token or slug");
  }

  const notionAuthUrl =
    "https://api.notion.com/v1/oauth/authorize" +
    `?client_id=${process.env.NOTION_CLIENT_ID}` +
    `&response_type=code` +
    `&owner=user` +
    `&redirect_uri=${encodeURIComponent(process.env.NOTION_REDIRECT_URI)}` +
    `&state=${encodeURIComponent(token + ":" + slug)}`;

  res.redirect(notionAuthUrl);
}
