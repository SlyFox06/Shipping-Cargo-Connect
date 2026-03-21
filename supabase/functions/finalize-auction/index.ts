import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
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
    const { auctionId } = await req.json();

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // 1. Get auction details
    // @ts-ignore - Tables generated after initial build may not show in types
    const { data: auction, error: fetchError } = await supabaseClient
      .from("auctions")
      .select("*, containers(*)")
      .eq("id", auctionId)
      .single();

    if (fetchError || !auction) {
      throw new Error("Auction not found.");
    }

    if (auction.status !== "active") {
      throw new Error(`Auction is already ${auction.status}.`);
    }

    // Check if end_time has passed
    const now = new Date();
    const endTime = new Date(auction.end_time);
    if (endTime > now) {
      throw new Error("Auction has not ended yet.");
    }

    // 2. Identify winner (highest bid)
    // @ts-ignore
    const { data: highestBid, error: bidError } = await supabaseClient
      .from("bids")
      .select("*")
      .eq("auction_id", auctionId)
      .order("amount", { ascending: false })
      .limit(1)
      .single();

    if (bidError || !highestBid) {
      // No bids case
      console.log("No bids found for auction:", auctionId);
      // @ts-ignore
      await supabaseClient
        .from("auctions")
        .update({ status: "completed", winner_id: null })
        .eq("id", auctionId);
        
      return new Response(JSON.stringify({ success: true, message: "Auction closed with no bids." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    console.log(`Finalizing auction: ${auctionId}, Winner: ${highestBid.bidder_id}, Amount: ${highestBid.amount}`);

    // 3. Finalize winners
    // @ts-ignore
    const { error: finalizeError } = await supabaseClient
      .from("auctions")
      .update({ 
        status: "completed", 
        winner_id: highestBid.bidder_id,
        current_bid: highestBid.amount
      })
      .eq("id", auctionId);

    if (finalizeError) throw finalizeError;

    // 4. Create a booking automatically for the winner
    const booking_number = `BK-AUC-${Date.now()}`;
    const { data: booking, error: bookingError } = await supabaseClient
      .from("bookings")
      .insert({
        booking_number: booking_number,
        trader_id: highestBid.bidder_id,
        container_id: auction.container_id,
        provider_id: auction.provider_id,
        price_usd: highestBid.amount,
        final_delivery_date: auction.end_time,
        cargo_description: `Won Auction: ${auction.title}`,
        status: "pending", // Winner still needs to pay
        cargo_weight_kg: auction.containers?.capacity_kg || 0
      })
      .select()
      .single();

    if (bookingError) throw bookingError;

    // 5. Update Container status
    await supabaseClient
      .from("containers")
      .update({ status: "booked" })
      .eq("id", auction.container_id);

    // 6. Notify winner
    await supabaseClient.from("notifications").insert({
      user_id: highestBid.bidder_id,
      type: "booking",
      title: "🎉 Congratulations! You won an auction!",
      message: `You won the auction from ${auction.containers.origin} to ${auction.containers.destination} for $${highestBid.amount}. Proceed to pay within 24 hours.`,
      link: "/dashboard/trader/bookings"
    });

    return new Response(JSON.stringify({ success: true, bookingId: booking.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("Error finalizing auction:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
