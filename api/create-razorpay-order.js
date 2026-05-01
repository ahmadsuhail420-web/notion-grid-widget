const Razorpay = require('razorpay');
const { createClient } = require('@supabase/supabase-js');

const instance = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { templateId } = req.body;

  // ── FIX: Resolve price server-side — never trust client-sent amount ──
  let amount;
  try {
    const sb = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
    );

    if (templateId) {
      const { data: tpl, error } = await sb
        .from('template_configs')
        .select('price, is_active')
        .eq('id', templateId)
        .single();

      if (error || !tpl) {
        return res.status(400).json({ error: 'Invalid template ID' });
      }
      if (!tpl.is_active) {
        return res.status(400).json({ error: 'This template is not currently available' });
      }
      amount = Math.round(Number(tpl.price) * 100); // convert ₹ → paisa
    } else {
      // Fallback: validate client-sent amount is a reasonable positive integer
      const clientAmount = Number(req.body.amount);
      if (!Number.isInteger(clientAmount) || clientAmount < 100 || clientAmount > 1000000) {
        return res.status(400).json({ error: 'Invalid payment amount' });
      }
      amount = clientAmount;
    }
  } catch (err) {
    return res.status(500).json({ error: 'Failed to resolve template price: ' + err.message });
  }

  try {
    const options = {
      amount,
      currency: 'INR',
      receipt: `receipt_${Date.now()}`
    };

    const order = await instance.orders.create(options);

    res.status(200).json({
      success: true,
      id: order.id,
      amount: order.amount,
      currency: order.currency,
      key: process.env.RAZORPAY_KEY_ID
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
