import { loadStripe, Stripe } from "@stripe/stripe-js";

let stripePromise: Promise<Stripe | null>;

/**
 * Get Stripe instance with public key from env variables.
 * @returns {Promise<Stripe | null>}
 */
export const getStripe = () => {
  if (!stripePromise) {
    const publicKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
    if (!publicKey) {
      console.warn("VITE_STRIPE_PUBLISHABLE_KEY is not defined. Stripe features will be limited.");
      return Promise.resolve(null);
    }
    stripePromise = loadStripe(publicKey);
  }
  return stripePromise;
};
