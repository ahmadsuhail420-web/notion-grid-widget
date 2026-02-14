export default async function handler(req, res) {
  try {
    const { code, state } = req.query;

    if (!code || !state) {
      return res.status(400).send("Missing code or state");
    }

    // state = token:slug
    const [setupToken, slug] = state.split(":");

    // Exchange code for Notion access token
    const tokenRes = await fetch("https://api.notion.com/v1/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization":
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
      return res.status(500).json(tokenData);
    }

    // Save to Supabase using REST
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    // Find customer
    const customerRes = await fetch(
      `${supabaseUrl}/rest/v1/customers?setup_token=eq.${setupToken}&select=id`,
      {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
      }
    );

    const customers = await customerRes.json();
    if (!customers.length) {
      return res.status(404).send("Customer not found");
    }

    const customerId = customers[0].id;

    // Insert Notion connection
    await fetch(`${supabaseUrl}/rest/v1/notion_connections`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        customer_id: customerId,
        access_token: tokenData.access_token,
        workspace_id: tokenData.workspace_id,
        workspace_name: tokenData.workspace_name,
        bot_id: tokenData.bot_id,
      }),
    });

    // Mark setup used
    await fetch(
      `${supabaseUrl}/rest/v1/customers?setup_token=eq.${setupToken}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({ setup_used: true }),
      }
    );

    // Redirect to database setup page
    res.redirect(`/database.html?token=${setupToken}`);

  } catch (err) {
    res.status(500).send(err.message);
  }
}
