// Stripe Webhook Handler for Vercel Serverless Functions
// Handles subscription lifecycle events (created, cancelled, payment failed)
//
// Setup:
// 1. Set environment variables in Vercel Dashboard (Settings > Environment Variables):
//    - STRIPE_SECRET_KEY: sk_live_...
//    - STRIPE_WEBHOOK_SECRET: whsec_...
// 2. In Stripe Dashboard > Developers > Webhooks, add endpoint:
//    URL: https://your-domain.vercel.app/api/webhook
//    Events: customer.subscription.created, customer.subscription.deleted,
//            invoice.payment_failed, checkout.session.completed

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sig = req.headers['stripe-signature'];
  let event;

  try {
    // Read raw body for signature verification
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const rawBody = Buffer.concat(chunks).toString('utf8');

    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  // Handle events
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      console.log('Checkout completed for customer:', session.customer_email);
      // In production: save subscription to database
      // await db.users.update({ email: session.customer_email, premium: true });
      break;
    }

    case 'customer.subscription.created': {
      const subscription = event.data.object;
      console.log('Subscription created:', subscription.id);
      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object;
      console.log('Subscription cancelled:', subscription.id);
      // In production: revoke premium
      // await db.users.update({ stripeCustomerId: subscription.customer, premium: false });
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object;
      console.log('Payment failed for customer:', invoice.customer);
      // In production: notify user, grace period, etc.
      break;
    }

    default:
      console.log('Unhandled event type:', event.type);
  }

  res.status(200).json({ received: true });
};

// Disable body parsing (Stripe needs raw body)
module.exports.config = {
  api: {
    bodyParser: false,
  },
};
