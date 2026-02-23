import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  try {
    const { code, state } = req.query;

    if (!code || !state) {
      return res.redirect("/error.html?reason=missing_code");
    }

    const setupToken = state;

    if (!setupToken) {
      return res.redirect("/error.html?reason=invalid_state");
    }

    // Initialize Supabase (SERVICE ROLE)
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // 1️⃣ Validate setup token
    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .select("*")
      .eq("setup_token", setupToken)
      .single();

    if (customerError || !customer) {
      console.error("Token lookup failed:", setupToken);
      return res.redirect("/error.html?reason=invalid_setup_token");
    }

    // If already connected, just redirect forward
    if (customer.setup_used) {
      const appUrl = process.env.APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
      return res.redirect(`${appUrl}/database.html?slug=${customer.slug}`);
    }

    // 2️⃣ Exchange code for Notion access token
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
  const appUrl = process.env.APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
  return res.redirect(`${appUrl}/error.html?reason=notion_auth_failed`);
}

    // 3️⃣ Store Notion connection
    const { error: insertError } = await supabase
      .from("notion_connections")
      .insert({
        customer_id: customer.id,
        access_token: tokenData.access_token,
        workspace_id: tokenData.workspace_id,
        workspace_name: tokenData.workspace_name,
        bot_id: tokenData.bot_id,
      });

    if (insertError) {
  console.error("Insert error:", insertError);
  const appUrl = process.env.APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
  return res.redirect(`${appUrl}/error.html?reason=db_insert_failed`);
}

    // 4️⃣ Mark setup token as used
    await supabase
      .from("customers")
      .update({ setup_used: true })
      .eq("id", customer.id);

    // 5️⃣ Redirect to database page (✅ FIXED)
    const appUrl = process.env.APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
    return res.redirect(`${appUrl}/database.html?slug=${customer.slug}`);

  } catch (err) {
    console.error("Server error:", err);
    const appUrl = process.env.APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
    return res.redirect(`${appUrl}/error.html?reason=server_error`);
  }
}