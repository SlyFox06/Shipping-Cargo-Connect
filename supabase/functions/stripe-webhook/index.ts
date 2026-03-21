import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2025-02-24.patch_v2",
});

const endpointSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

serve(async (req) => {
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return new Response("No signature", { status: 400 });
  }

  try {
    const body = await req.text();
    let event;

    if (endpointSecret) {
      try {
        event = await stripe.webhooks.constructEventAsync(body, signature, endpointSecret);
      } catch (err) {
        console.error(`Webhook signature verification failed: ${err.message}`);
        return new Response(`Webhook Error: ${err.message}`, { status: 400 });
      }
    } else {
      event = JSON.parse(body);
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceRoleKey);

    console.log(`Processing event: ${event.type}`);

    switch (event.type) {
      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object;
        const { payment_id, booking_id } = paymentIntent.metadata;

        console.log(`Payment succeeded for payment_id: ${payment_id}`);

        // 1. Update Payment Record
        const { data: payment, error: paymentError } = await supabaseClient
          .from("payments")
          .update({ 
            status: "succeeded",
            payment_method: paymentIntent.payment_method_types?.[0] || "card"
          })
          .eq("id", payment_id)
          .select()
          .single();

        if (paymentError) throw paymentError;

        // 2. Update Booking Status
        const { error: bookingError } = await supabaseClient
          .from("bookings")
          .update({ status: "confirmed" })
          .eq("id", booking_id);

        if (bookingError) throw bookingError;

        // 3. Automated Notifications and Invoices
        // (Similar logic to verify-payment)
        await handlePostPayment(supabaseClient, payment);
        
        break;
      }
      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object;
        const { payment_id } = paymentIntent.metadata;
        
        await supabaseClient
          .from("payments")
          .update({ status: "failed" })
          .eq("id", payment_id);
          
        break;
      }
    }

    return new Response(JSON.stringify({ received: true }), { 
      status: 200, 
      headers: { "Content-Type": "application/json" } 
    });
  } catch (err) {
    console.error(`Error processing webhook: ${err.message}`);
    return new Response(`Webhook Error: ${err.message}`, { status: 500 });
  }
});

async function handlePostPayment(supabase: any, payment: any) {
  // Fetch booking details
  const { data: booking } = await supabase
    .from("bookings")
    .select("*, profiles!bookings_trader_id_fkey(email)")
    .eq("id", payment.booking_id)
    .single();

  if (!booking) return;

  // Create Notification
  await supabase.from("notifications").insert({
    user_id: booking.trader_id,
    type: "payment",
    title: "Payment Confirmed",
    message: `Your payment for booking ${booking.booking_number} was successful.`,
    link: `/dashboard/trader/bookings`
  });

  // Create Invoice if it doesn't exist
  const { data: existingInvoices } = await supabase
    .from("invoices")
    .select("id")
    .eq("booking_id", booking.id)
    .limit(1);

  if (!existingInvoices || existingInvoices.length === 0) {
    await supabase.from("invoices").insert({
      booking_id: booking.id,
      payment_id: payment.id,
      invoice_number: `INV-${Date.now()}`,
      subtotal: payment.amount,
      tax_amount: 0,
      total_amount: payment.amount,
      currency: payment.currency,
      issued_date: new Date().toISOString()
    });
  }
}
