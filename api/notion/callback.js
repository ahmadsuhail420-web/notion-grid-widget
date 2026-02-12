import { createClient } from "@supabase/supabase-js";
import fetch from "node-fetch";
import { nanoid } from "nanoid";

export default async function handler(req, res) {
  const { code } = req.query;

  // 1. Exchange code for token
  const tokenRes = await fetch("https://api.notion.com/v1/oauth/token", {
    method: "POST",
    headers: {
      "Authorization":
        "Basic " +
        Buffer.from(
          process.env.NOTION_CLIENT_ID + ":" + process.env.NOTION_CLIENT_SECRET
        ).toString("base64"),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code,
      redirect_uri: "https://notion-grid-widget-psi.vercel.app/api/notion/callback",
    }),
  });

  const data = await tokenRes.json();

  // 2. Create slug
  const slug = nanoid(8);

  // 3. Save in Supabase
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  await supabase.from("workspaces").insert({
    slug,
    notion_access_token: data.access_token,
    notion_database_id: data.database_id,
    is_active: true,
  });

  // 4. Redirect to success
  res.redirect(`/success.html?slug=${slug}`);
}