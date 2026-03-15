import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, userId, userRole } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // System prompt based on role
    let systemPrompt = `You are a helpful logistics assistant for a container booking platform. 
You help ${userRole}s with their queries about bookings, containers, payments, and shipments.
Keep responses concise and actionable.`;

    // Fetch relevant context based on query
    let contextData = "";
    
    if (message.toLowerCase().includes("booking")) {
      const { data: bookings } = await supabase
        .from("bookings")
        .select("*, containers(container_type, origin, destination), profiles(full_name)")
        .eq(userRole === "trader" ? "trader_id" : "provider_id", userId)
        .order("created_at", { ascending: false })
        .limit(5);
      
      if (bookings && bookings.length > 0) {
        contextData += `\n\nRecent bookings:\n${bookings.map((b: any) => 
          `- ${b.booking_number}: ${b.containers?.container_type} from ${b.containers?.origin} to ${b.containers?.destination}, Status: ${b.status}`
        ).join('\n')}`;
      }
    }

    if (message.toLowerCase().includes("container")) {
      const { data: containers } = await supabase
        .from("containers")
        .select("*")
        .eq("status", "available")
        .limit(5);
      
      if (containers && containers.length > 0) {
        contextData += `\n\nAvailable containers:\n${containers.map((c: any) => 
          `- ${c.container_type}: ${c.origin} → ${c.destination}, Capacity: ${c.capacity_kg}kg, Price: $${c.price_usd}`
        ).join('\n')}`;
      }
    }

    if (message.toLowerCase().includes("payment")) {
      const { data: payments } = await supabase
        .from("payments")
        .select("*, bookings(booking_number)")
        .limit(5);
      
      if (payments && payments.length > 0) {
        contextData += `\n\nRecent payments:\n${payments.map((p: any) => 
          `- Booking ${p.bookings?.booking_number}: $${p.amount} ${p.currency}, Status: ${p.status}`
        ).join('\n')}`;
      }
    }

    // Call Lovable AI
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt + contextData },
          { role: "user", content: message }
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required. Please add credits to continue." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Log chatbot conversation
    await supabase.from("chatbot_logs").insert({
      user_id: userId,
      user_role: userRole,
      query: message,
      response_started: new Date().toISOString(),
    });

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });

  } catch (error) {
    console.error("Chatbot error:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
