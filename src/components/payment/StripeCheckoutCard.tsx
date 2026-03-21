import React, { useState, useEffect } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, ShieldCheck, CreditCard, Lock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";

// Get Stripe public key from env
const STRIPE_PK = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
const stripePromise = STRIPE_PK ? loadStripe(STRIPE_PK) : null;

interface CheckoutFormProps {
  amount: number;
  currency: string;
  onSuccess: () => void;
  onCancel: () => void;
  bookingId: string;
}

const CheckoutForm = ({ amount, currency, onSuccess, onCancel, bookingId }: CheckoutFormProps) => {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/payment-success`,
      },
      redirect: "if_required",
    });

    if (error) {
      setErrorMessage(error.message || "An unexpected error occurred.");
      toast.error(error.message || "Payment failed");
      setIsProcessing(false);
    } else if (paymentIntent && paymentIntent.status === "succeeded") {
      toast.success("Payment Received! Your booking is confirmed.");
      onSuccess();
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="p-4 bg-background/50 rounded-xl border border-white/10 backdrop-blur-md">
        <PaymentElement options={{ layout: "tabs" }} />
      </div>

      {errorMessage && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3 text-sm text-destructive bg-destructive/10 rounded-lg border border-destructive/20"
        >
          {errorMessage}
        </motion.div>
      )}

      <div className="flex gap-3 pt-2">
        <Button
          type="button"
          variant="ghost"
          onClick={onCancel}
          disabled={isProcessing}
          className="flex-1 hover:bg-white/5"
        >
          Back
        </Button>
        <Button
          type="submit"
          disabled={!stripe || isProcessing}
          className="flex-1 bg-gradient-to-r from-primary to-secondary hover:opacity-90 shadow-lg shadow-primary/20"
        >
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              Pay {currency} {amount.toFixed(2)}
            </>
          )}
        </Button>
      </div>

      <div className="flex items-center justify-center gap-4 text-[10px] text-muted-foreground pt-2">
        <div className="flex items-center gap-1">
          <ShieldCheck className="h-3 w-3" />
          SECURE PAY
        </div>
        <div className="flex items-center gap-1">
          <Lock className="h-3 w-3" />
          ENCRYPTED
        </div>
        <div className="flex items-center gap-1">
          <CreditCard className="h-3 w-3" />
          PCI-DSS
        </div>
      </div>
    </form>
  );
};

export const StripeCheckoutCard = ({
  amount,
  currency = "USD",
  bookingId,
  onSuccess,
  onCancel,
}: CheckoutFormProps) => {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchClientSecret = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("create-payment-intent", {
          body: { bookingId, amount, currency },
        });

        if (error) throw error;
        setClientSecret(data.clientSecret);
      } catch (err: any) {
        console.error("Error fetching stripe client secret:", err);
        toast.error("Could not initialize payment system.");
      } finally {
        setIsLoading(false);
      }
    };

    if (bookingId && amount > 0 && STRIPE_PK) {
      fetchClientSecret();
    }
  }, [bookingId, amount, currency]);

  if (!STRIPE_PK) {
    return (
      <Card className="p-12 text-center bg-amber-500/5 border-amber-500/20">
        <CreditCard className="h-12 w-12 mx-auto mb-4 text-amber-500 opacity-20" />
        <h3 className="text-xl font-semibold mb-2">Payment Gateway Not Configured</h3>
        <p className="text-muted-foreground max-w-sm mx-auto">
          The Stripe publishable key is missing. For development, your booking has been created but payment is simulated.
        </p>
        <Button className="mt-6" onClick={onSuccess}>
          Simulate Payment & Confirm
        </Button>
      </Card>
    );
  }

  return (
    <Card className="relative overflow-hidden border-border/40 bg-card/30 backdrop-blur-xl shadow-2xl">
      {/* Premium Background Accents */}
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-secondary to-primary opacity-50" />
      <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/10 rounded-full blur-3xl" />
      <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-secondary/10 rounded-full blur-3xl" />

      <div className="p-6 relative z-10">
        <div className="mb-6 text-center">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="inline-flex items-center justify-center h-12 w-12 rounded-2xl bg-primary/20 text-primary mb-3 shadow-inner"
          >
            <ShieldCheck className="h-6 w-6" />
          </motion.div>
          <h3 className="text-xl font-bold tracking-tight">Complete Booking</h3>
          <p className="text-sm text-muted-foreground">Secure transaction powered by Stripe</p>
        </div>

        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div
              key="loader"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="py-12 flex flex-col items-center justify-center space-y-4"
            >
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-xs text-muted-foreground animate-pulse font-medium uppercase tracking-widest">
                Initializing Secure Vault...
              </p>
            </motion.div>
          ) : clientSecret ? (
            <motion.div
              key="content"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
            >
              <div className="mb-6 p-4 rounded-2xl bg-white/5 border border-white/5 flex justify-between items-center">
                <span className="text-sm font-medium text-muted-foreground">Total Payable</span>
                <span className="text-2xl font-black text-primary">
                  {currency} {amount.toFixed(2)}
                </span>
              </div>

              <Elements
                stripe={stripePromise}
                options={{
                  clientSecret,
                  appearance: {
                    theme: "night",
                    variables: {
                      colorPrimary: "#0EA5E9",
                      colorBackground: "transparent",
                      colorText: "#FFFFFF",
                      borderRadius: "12px",
                      spacingUnit: "4px",
                    },
                    rules: {
                      ".Input": {
                        backgroundColor: "rgba(255, 255, 255, 0.03)",
                        border: "1px solid rgba(255, 255, 255, 0.1)",
                        boxShadow: "inset 0 2px 4px 0 rgba(0, 0, 0, 0.05)",
                      },
                      ".Tab": {
                        backgroundColor: "rgba(255, 255, 255, 0.03)",
                        border: "1px solid rgba(255, 255, 255, 0.1)",
                      },
                      ".Tab--selected": {
                        backgroundColor: "rgba(14, 165, 233, 0.1)",
                        border: "1px solid #0EA5E9",
                      },
                    },
                  },
                }}
              >
                <CheckoutForm
                  amount={amount}
                  currency={currency}
                  onSuccess={onSuccess}
                  onCancel={onCancel}
                  bookingId={bookingId}
                />
              </Elements>
            </motion.div>
          ) : (
            <div className="py-8 text-center text-destructive">
              Failed to load configuration. Please try again later.
            </div>
          )}
        </AnimatePresence>
      </div>
    </Card>
  );
};
