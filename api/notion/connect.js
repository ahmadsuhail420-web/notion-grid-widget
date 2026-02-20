export default async function handler(req, res) {
  const { token } = req.query;

  if (!token) {
    return res.status(400).send("Missing token");
  }

  const notionAuthUrl =
    "https://api.notion.com/v1/oauth/authorize" +
    `?client_id=${process.env.NOTION_CLIENT_ID}` +
    `&response_type=code` +
    `&owner=user` +
    `&redirect_uri=${encodeURIComponent(process.env.NOTION_REDIRECT_URI)}` +
    `&state=${encodeURIComponent(token)}`;

  res.redirect(notionAuthUrl);
}