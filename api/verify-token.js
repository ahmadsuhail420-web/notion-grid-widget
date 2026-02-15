export default async function handler(req, res) {
  try {
    const { token } = req.query;
    if (!token) return res.json({ valid: false });

    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    const customerRes = await fetch(
      `${supabaseUrl}/rest/v1/customers?setup_token=eq.${token}&select=id,status,setup_used`,
      {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
      }
    );

    const customers = await customerRes.json();

    // ❌ Token not found
    if (!customers.length) {
      return res.json({ valid: false, reason: "not_found" });
    }

    const customer = customers[0];

    // ❌ Status check
    if (customer.status !== "active") {
      return res.json({ valid: false, reason: "inactive" });
    }

    // ❌ Already used
    if (customer.setup_used === true) {
      return res.json({ valid: false, reason: "used" });
    }

    // ✅ VALID
    return res.json({ valid: true });

  } catch (err) {
    return res.status(500).json({ valid: false, error: err.message });
  }
}
