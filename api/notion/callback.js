import { createClient } from "@supabase/supabase-js";

const DEBUG_OAUTH = true; // <-- set false after debugging

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  try {
    const { code, state } = req.query;

    if (!code || !state) {
      if (DEBUG_OAUTH) return res.status(400).json({ step: "missing_code_or_state", code, state });
      return res.redirect("/error.html?reason=missing_code");
    }

    const setupToken = state;

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
      if (DEBUG_OAUTH) {
        return res.status(401).json({
          step: "customer_lookup_failed",
          setupToken,
          customerError,
          customer,
        });
      }
      return res.redirect("/error.html?reason=invalid_setup_token");
    }

    // If already connected, just redirect forward
    if (customer.setup_used) {
      const appUrl =
        process.env.APP_URL ||
        (process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}`
          : "http://localhost:3000");
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
      if (DEBUG_OAUTH) {
        return res.status(400).json({
          step: "notion_token_exchange_failed",
          http_status: tokenRes.status,
          tokenData,
        });
      }
      const appUrl =
        process.env.APP_URL ||
        (process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}`
          : "http://localhost:3000");
      return res.redirect(`${appUrl}/error.html?reason=notion_auth_failed`);
    }

    // 3️⃣ Store Notion connection
    const insertPayload = {
      customer_id: customer.id,
      access_token: tokenData.access_token,
      workspace_id: tokenData.workspace_id,
      workspace_name: tokenData.workspace_name,
      bot_id: tokenData.bot_id,
    };

    const { data: insertData, error: insertError } = await supabase
      .from("notion_connections")
      .insert(insertPayload)
      .select()
      .single();

    if (insertError) {
      if (DEBUG_OAUTH) {
        return res.status(500).json({
          step: "supabase_insert_failed",
          insertPayload: {
            ...insertPayload,
            access_token: "[REDACTED]", // don't leak token
          },
          insertError,
        });
      }

      const appUrl =
        process.env.APP_URL ||
        (process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}`
          : "http://localhost:3000");
      return res.redirect(`${appUrl}/error.html?reason=db_insert_failed`);
    }

    // 4️⃣ Mark setup token as used
    const { error: updateError } = await supabase
      .from("customers")
      .update({ setup_used: true })
      .eq("id", customer.id);

    if (updateError && DEBUG_OAUTH) {
      return res.status(500).json({
        step: "mark_setup_used_failed",
        updateError,
        inserted: insertData ? { id: insertData.id } : null,
      });
    }

    // 5️⃣ Redirect to database page
    const appUrl =
      process.env.APP_URL ||
      (process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000");
    return res.redirect(`${appUrl}/database.html?slug=${customer.slug}`);
  } catch (err) {
    if (DEBUG_OAUTH) {
      return res.status(500).json({
        step: "unhandled_exception",
        message: err?.message,
        stack: err?.stack,
      });
    }

    const appUrl =
      process.env.APP_URL ||
      (process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000");
    return res.redirect(`${appUrl}/error.html?reason=server_error`);
  }
}