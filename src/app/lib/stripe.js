// Server-side Stripe helper
import Stripe from 'stripe';

let stripe = null;

export function getStripe() {
  if (stripe) return stripe;
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) throw new Error('Missing STRIPE_SECRET_KEY');
  stripe = new Stripe(secret, {
    apiVersion: '2024-06-20',
    typescript: false,
  });
  return stripe;
}

const stripeApi = { getStripe };
export default stripeApi;
