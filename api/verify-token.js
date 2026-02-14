export default async function handler(req, res) {
  try {
    const { token } = req.query;

    if (!token) {
      return res.json({ valid: false });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      return res.status(500).json({
        error: "Missing Supabase env vars"
      });
    }

    const response = await fetch(
      `${supabaseUrl}/rest/v1/customers?setup_token=eq.${token}&select=id,setup_used`,
      {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        }
      }
    );

    const data = await response.json();

    if (!Array.isArray(data) || data.length === 0) {
      return res.json({ valid: false });
    }

    if (data[0].setup_used) {
      return res.json({ valid: false });
    }

    return res.json({ valid: true });

  } catch (err) {
    return res.status(500).json({
      error: err.message
    });
  }
}