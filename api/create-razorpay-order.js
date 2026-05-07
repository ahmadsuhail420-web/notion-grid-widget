const Razorpay = require('razorpay');
const { createClient } = require('@supabase/supabase-js');

const instance = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', 'https://syncandstyle.com');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const TEMPLATE_ALIASES = {
    'islamic-invitation': 'template01',
    'islamic-invitation-premium': 'template02',
    tp1: 'template01',
    tp2: 'template02'
  };

  const rawTemplateId = req.body.templateId;
  const templateId = TEMPLATE_ALIASES[rawTemplateId] || rawTemplateId;

  let amount;
  try {
    const sb = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
    );

    if (templateId) {
      const candidateIds = [...new Set([templateId, rawTemplateId].filter(Boolean))];
      const { data: tplRows, error } = await sb
        .from('template_configs')
        .select('id, price, is_active')
        .in('id', candidateIds);
      const tpl = (tplRows || []).find(t => t.id === templateId) || (tplRows || [])[0];

      if (error || !tpl) {
        return res.status(400).json({ error: 'Invalid template ID' });
      }
      if (!tpl.is_active) {
        return res.status(400).json({ error: 'This template is not currently available' });
      }
      amount = Math.round(Number(tpl.price) * 100);
    } else {
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
    res.status(500).json({ success: false, error: error.message });
  }
};
