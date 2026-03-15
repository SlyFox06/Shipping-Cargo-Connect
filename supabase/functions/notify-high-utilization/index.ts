import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get all containers with utilization >= 80%
    const { data: highUtilizationContainers, error: containersError } = await supabaseClient
      .from("containers")
      .select(`
        id, 
        container_type, 
        origin, 
        destination, 
        utilization_rate, 
        provider_id,
        providers!inner(user_id)
      `)
      .gte("utilization_rate", 80)
      .eq("status", "available");

    if (containersError) throw containersError;

    if (!highUtilizationContainers || highUtilizationContainers.length === 0) {
      return new Response(
        JSON.stringify({ message: "No high utilization containers found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Notify providers
    for (const container of highUtilizationContainers) {
      const providerUserId = (container.providers as any)?.user_id;
      if (providerUserId) {
        await supabaseClient.from("notifications").insert({
          user_id: providerUserId,
          type: "alert",
          title: "High Container Utilization",
          message: `Your ${container.container_type} (${container.origin} → ${container.destination}) is ${container.utilization_rate.toFixed(1)}% utilized. Consider adding more containers for this route.`,
          link: "/dashboard/provider/containers",
        });
      }
    }

    // Find traders with similar routes and notify them
    for (const container of highUtilizationContainers) {
      // Get traders who have booked similar routes in the past
      const { data: similarBookings } = await supabaseClient
        .from("bookings")
        .select("trader_id, containers(origin, destination)")
        .eq("containers.origin", container.origin)
        .eq("containers.destination", container.destination)
        .in("status", ["delivered", "in_transit"]);

      if (similarBookings) {
        const uniqueTraders = [...new Set(similarBookings.map(b => b.trader_id))];
        
        for (const traderId of uniqueTraders) {
          await supabaseClient.from("notifications").insert({
            user_id: traderId,
            type: "recommendation",
            title: "Container Availability Alert",
            message: `A ${container.container_type} on your preferred route (${container.origin} → ${container.destination}) is filling up fast! Book now before it's full.`,
            link: "/dashboard/trader/search",
          });
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        notified: highUtilizationContainers.length,
        message: `Notified providers and traders for ${highUtilizationContainers.length} high utilization containers` 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error: any) {
    console.error("Error in notify-high-utilization:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
