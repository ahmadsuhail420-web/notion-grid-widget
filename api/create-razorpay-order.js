// Updated API for creating Razorpay order

const Razorpay = require('razorpay');
const dotenv = require('dotenv');

dotenv.config();

const instance = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

exports.createOrder = async (req, res) => {
  const options = {
    amount: req.body.amount,
    currency: req.body.currency,
    receipt: req.body.receipt,
    payment_capture: 1 // auto capture
  };

  try {
    const order = await instance.orders.create(options);
    res.json({
      success: true,
      order: order
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating order',
      error: error.message
    });
  }
};
