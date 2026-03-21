import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { bookingId, refundAmount, reason } = await req.json();

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // 1. Get payment record
    const { data: payment, error: paymentError } = await supabaseClient
      .from("payments")
      .select("*")
      .eq("booking_id", bookingId)
      .eq("status", "succeeded")
      .single();

    if (paymentError || !payment) {
      throw new Error("Successful payment not found for this booking.");
    }

    if (!payment.stripe_payment_intent_id) {
      throw new Error("Stripe PaymentIntent ID not found.");
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-02-24.patch_v2",
    });

    console.log(`Processing refund for booking: ${bookingId}, payment intent: ${payment.stripe_payment_intent_id}`);

    // 2. Create Stripe refund
    const refund = await stripe.refunds.create({
      payment_intent: payment.stripe_payment_intent_id,
      amount: Math.round(refundAmount * 100), // Convert to cents
      reason: "requested_by_customer",
      metadata: {
        booking_id: bookingId,
        payment_id: payment.id,
        reason: reason || "User cancelled booking",
      },
    });

    console.log("Refund successful on Stripe:", refund.id);

    // 3. Update payment status
    await supabaseClient
      .from("payments")
      .update({ 
        status: refundAmount < payment.amount ? "partially_refunded" : "refunded",
        metadata: {
          ...payment.metadata,
          stripe_refund_id: refund.id,
          refunded_amount: refundAmount,
          refund_date: new Date().toISOString(),
        }
      })
      .eq("id", payment.id);

    return new Response(
      JSON.stringify({ success: true, refundId: refund.id }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error in process-refund:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
