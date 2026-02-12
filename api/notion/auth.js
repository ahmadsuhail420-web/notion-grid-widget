export default function handler(req, res) {
  const NOTION_CLIENT_ID = process.env.NOTION_CLIENT_ID;
  const REDIRECT_URI = "https://notion-grid-widget-psi.vercel.app/api/notion/callback";

  const authUrl =
    "https://api.notion.com/v1/oauth/authorize" +
    `?client_id=${NOTION_CLIENT_ID}` +
    `&response_type=code` +
    `&owner=user` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;

  res.redirect(authUrl);
}