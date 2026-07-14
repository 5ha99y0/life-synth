// Stripe Webhook Handler for Vercel Serverless Functions
// Handles subscription lifecycle events and syncs status to Supabase

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client with Service Role Key to bypass RLS policies securely
const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

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

  console.log(`Received Stripe event: ${event.type}`);

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.client_reference_id; // Passed during checkout
        const customerId = session.customer;
        const email = session.customer_email || session.customer_details?.email;

        console.log(`Checkout completed for user ID: ${userId}, customer: ${customerId}, email: ${email}`);

        if (userId) {
          // Update profile based on Supabase Auth User ID passed from frontend
          const { error } = await supabase
            .from('profiles')
            .update({
              stripe_customer_id: customerId,
              is_premium: true,
              subscription_status: 'active',
              updated_at: new Date().toISOString()
            })
            .eq('id', userId);

          if (error) {
            console.error(`Error updating profile for user ${userId}:`, error.message);
          } else {
            console.log(`Successfully activated premium for user ${userId}`);
          }
        } else if (email) {
          // Fallback: lookup user profile by email if client_reference_id was missing
          const { error } = await supabase
            .from('profiles')
            .update({
              stripe_customer_id: customerId,
              is_premium: true,
              subscription_status: 'active',
              updated_at: new Date().toISOString()
            })
            .eq('email', email);

          if (error) {
            console.error(`Error updating profile by email ${email}:`, error.message);
          } else {
            console.log(`Successfully activated premium for user by email ${email}`);
          }
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const customerId = subscription.customer;
        const status = subscription.status;
        const isPremium = status === 'active' || status === 'trialing';

        console.log(`Subscription updated for customer ${customerId}. Status: ${status}`);

        const { error } = await supabase
          .from('profiles')
          .update({
            is_premium: isPremium,
            subscription_status: status,
            updated_at: new Date().toISOString()
          })
          .eq('stripe_customer_id', customerId);

        if (error) {
          console.error(`Error updating subscription for customer ${customerId}:`, error.message);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const customerId = subscription.customer;

        console.log(`Subscription cancelled/deleted for customer ${customerId}`);

        const { error } = await supabase
          .from('profiles')
          .update({
            is_premium: false,
            subscription_status: 'canceled',
            updated_at: new Date().toISOString()
          })
          .eq('stripe_customer_id', customerId);

        if (error) {
          console.error(`Error revoking premium for customer ${customerId}:`, error.message);
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const customerId = invoice.customer;

        console.log(`Payment failed for customer ${customerId}`);

        const { error } = await supabase
          .from('profiles')
          .update({
            is_premium: false,
            subscription_status: 'past_due',
            updated_at: new Date().toISOString()
          })
          .eq('stripe_customer_id', customerId);

        if (error) {
          console.error(`Error updating status to past_due for customer ${customerId}:`, error.message);
        }
        break;
      }

      default:
        console.log('Unhandled event type:', event.type);
    }
  } catch (err) {
    console.error('Error handling database sync:', err.message);
    return res.status(500).json({ error: 'Internal Server Error' });
  }

  res.status(200).json({ received: true });
};

// Disable body parsing (Stripe needs raw body)
module.exports.config = {
  api: {
    bodyParser: false,
  },
};
