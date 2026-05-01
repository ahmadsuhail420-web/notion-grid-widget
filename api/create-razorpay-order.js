// Updated function to return order details along with Razorpay key ID.

const razorpay = require('razorpay');

const instance = new razorpay({
  key_id: process.env.RAZORPAY_KEY_ID, // Ensure to set this in your .env
  key_secret: process.env.RAZORPAY_SECRET
});

const createRazorpayOrder = async (req, res) => {
  const options = {
    amount: req.body.amount, // Amount is in currency subunits. Default currency is INR.
    currency: "INR",
    receipt: "receipt#1",
  };

  try {
    const order = await instance.orders.create(options);
    // Here we return both order details and the Razorpay key ID
    res.json({
      orderDetails: order,
      RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = createRazorpayOrder;
