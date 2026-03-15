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
    const { sessionId, paymentId } = await req.json();

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    console.log("Verifying payment for session:", sessionId);

    // Retrieve the checkout session
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (!session) {
      throw new Error("Session not found");
    }

    let status: string;
    let stripePaymentIntentId: string | null = null;

    if (session.payment_status === "paid") {
      status = "succeeded";
      stripePaymentIntentId = session.payment_intent as string;
    } else if (session.payment_status === "unpaid") {
      status = "failed";
    } else {
      status = "processing";
    }

    console.log("Payment status:", status);

    // Update payment in database
    const { data: payment, error: updateError } = await supabaseClient
      .from("payments")
      .update({
        status,
        stripe_payment_intent_id: stripePaymentIntentId,
        stripe_customer_id: session.customer as string,
      })
      .eq("id", paymentId)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating payment:", updateError);
      throw updateError;
    }

    // If payment succeeded, update booking status and create invoice
    if (status === "succeeded") {
      console.log("Payment succeeded, updating booking status");

      // Update booking status
      const { error: bookingError } = await supabaseClient
        .from("bookings")
        .update({ status: "confirmed" })
        .eq("id", payment.booking_id);

      if (bookingError) {
        console.error("Error updating booking:", bookingError);
      }

      // Create notification for trader
      const { data: traderBooking } = await supabaseClient
        .from("bookings")
        .select("trader_id, booking_number")
        .eq("id", payment.booking_id)
        .single();

      if (traderBooking) {
        await supabaseClient.from("notifications").insert({
          user_id: traderBooking.trader_id,
          type: "payment",
          title: "Payment Successful",
          message: `Your payment for booking ${traderBooking.booking_number} was successful. Waiting for provider to start shipment.`,
          link: "/dashboard/trader/bookings",
        });
      }

      // Generate invoice number
      const { data: invoiceNumberData } = await supabaseClient
        .rpc("generate_invoice_number");

      const invoiceNumber = invoiceNumberData || `INV-${Date.now()}`;

      // Create invoice
      const { error: invoiceError } = await supabaseClient
        .from("invoices")
        .insert({
          booking_id: payment.booking_id,
          payment_id: payment.id,
          invoice_number: invoiceNumber,
          subtotal: payment.amount,
          tax_amount: 0,
          total_amount: payment.amount,
          currency: payment.currency,
          paid_date: new Date().toISOString(),
        });

      if (invoiceError) {
        console.error("Error creating invoice:", invoiceError);
      } else {
        console.log("Invoice created:", invoiceNumber);
      }

      // Create transaction record
      const { data: booking } = await supabaseClient
        .from("bookings")
        .select("trader_id, provider_id, booking_number")
        .eq("id", payment.booking_id)
        .single();

      if (booking) {
        await supabaseClient.from("transactions").insert({
          user_id: booking.trader_id,
          type: "payment",
          amount: payment.amount,
          currency: payment.currency,
          description: `Payment for booking ${payment.booking_id}`,
          reference_id: payment.id,
        });

        // Get provider user_id
        const { data: provider } = await supabaseClient
          .from("providers")
          .select("user_id")
          .eq("id", booking.provider_id)
          .single();

        // Create notification for provider
        if (provider) {
          await supabaseClient.from("notifications").insert({
            user_id: provider.user_id,
            type: "payment",
            title: "Payment Received",
            message: `Payment received for booking ${booking.booking_number}. You can now start shipment.`,
            link: "/dashboard/provider/payments",
          });
        }
      }

      // Initialize shipment milestones
      const milestones = [
        "booking_confirmed",
        "container_assigned",
        "cargo_loaded",
        "in_transit",
        "at_destination_port",
        "customs_clearance",
        "out_for_delivery",
        "delivered",
      ];

      const milestoneRecords = milestones.map((milestone, index) => ({
        booking_id: payment.booking_id,
        milestone,
        status: index === 0 ? "completed" : "pending",
        completed_date: index === 0 ? new Date().toISOString() : null,
      }));

      await supabaseClient.from("shipment_milestones").insert(milestoneRecords);

      console.log("Shipment milestones initialized");
    }

    return new Response(
      JSON.stringify({ success: true, payment }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error in verify-payment:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
