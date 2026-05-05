const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, user_id, template_type } = req.body;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ error: 'Missing required payment fields' });
  }

  if (!process.env.RAZORPAY_KEY_SECRET) {
    return res.status(500).json({ error: 'Razorpay keys not configured' });
  }

  // ── Step 1: Verify signature ──
  let digest;
  try {
    const shasum = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET);
    shasum.update(`${razorpay_order_id}|${razorpay_payment_id}`);
    digest = shasum.digest('hex');
  } catch (error) {
    console.error('Signature computation error:', error);
    return res.status(500).json({ error: 'Verification error' });
  }

  if (digest !== razorpay_signature) {
    console.warn('Payment signature mismatch for order:', razorpay_order_id);
    return res.status(400).json({ error: 'Payment verification failed' });
  }

  // ── Step 2: Mark payment as verified in DB ──
  // Only runs if signature is valid — protects against replay/fake payments
  try {
    const sb = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
    );

    const { error: updateError } = await sb
      .from('customer_invitations')
      .update({
        payment_verified: true,
        payment_id: razorpay_payment_id,
        order_id: razorpay_order_id,
        status: 'draft' // ready to edit after payment
      })
      .eq('order_id', razorpay_order_id);

    if (updateError) {
      // Non-fatal: payment is verified, DB update failed
      // Log it and still return success so the user isn't stuck
      console.error('DB update after payment verification failed:', updateError.message);
    }
  } catch (dbError) {
    console.error('DB connection error after payment verification:', dbError.message);
    // Still return success — payment IS verified, DB can be fixed manually
  }

  return res.status(200).json({ success: true, message: 'Payment verified successfully' });
};
