const crypto = require('crypto');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  if (!process.env.RAZORPAY_KEY_SECRET) {
      return res.status(500).json({ error: "Razorpay keys not configured" });
  }

  try {
      const shasum = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET);
      shasum.update(`${razorpay_order_id}|${razorpay_payment_id}`);
      const digest = shasum.digest('hex');

      if (digest !== razorpay_signature) {
          return res.status(400).json({ error: "Payment verification failed" });
      }

      res.status(200).json({ success: true, message: "Payment verified successfully" });
  } catch (error) {
      console.error("Signature verification error: ", error);
      res.status(500).json({ error: "Verification error" });
  }
};
