import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RecommendationRequest {
  cargoWeight: number;
  cargoVolume: number;
  origin: string;
  destination: string;
  budget?: number;
  deliveryDeadline?: string;
  containers: any[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { cargoWeight, cargoVolume, origin, destination, budget, deliveryDeadline, containers }: RecommendationRequest = await req.json();

    if (!cargoWeight || !cargoVolume || containers.length === 0) {
      return new Response(JSON.stringify({ error: "Missing required parameters" }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // Prepare container data summary for AI
    const containerSummary = containers.map((c, idx) => ({
      index: idx,
      type: c.container_type,
      origin: `${c.origin_city}, ${c.origin_country}`,
      destination: `${c.destination_city}, ${c.destination_country}`,
      availableVolume: c.available_volume_m3,
      availableWeight: c.available_weight_kg,
      pricePerM3: c.price_per_m3,
      totalPrice: c.price_usd,
      utilization: c.utilization_rate,
      verified: c.providers?.verified || false,
      availableFrom: c.available_from,
      availableUntil: c.available_until,
    }));

    const prompt = `You are a logistics optimization AI. Analyze these containers and recommend the top 3 best options for the cargo.

Cargo Requirements:
- Weight: ${cargoWeight} kg
- Volume: ${cargoVolume} m³
- Origin: ${origin}
- Destination: ${destination}
${budget ? `- Budget: $${budget}` : ''}
${deliveryDeadline ? `- Delivery Deadline: ${deliveryDeadline}` : ''}

Available Containers:
${JSON.stringify(containerSummary, null, 2)}

Analyze based on:
1. Space efficiency (how well the cargo fits)
2. Cost effectiveness (price per m³ or total price)
3. Route match (origin/destination proximity)
4. Provider reliability (verified status)
5. Availability timing
6. Current utilization (prefer containers with some space already booked for shared shipping)

Return ONLY a JSON array of the top 3 container indices with reasoning, like this:
[
  {
    "index": 0,
    "score": 95,
    "reason": "Perfect fit with 85% space utilization, lowest cost per m³, verified provider, ideal timing"
  },
  {
    "index": 2,
    "score": 88,
    "reason": "Good value, slightly larger capacity provides flexibility, available immediately"
  },
  {
    "index": 5,
    "score": 82,
    "reason": "Economical shared container option, reduces environmental impact"
  }
]`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'You are a logistics optimization expert. Always respond with valid JSON only.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI service requires payment. Please contact support." }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      throw new Error('AI recommendation service unavailable');
    }

    const data = await response.json();
    const aiResponse = data.choices?.[0]?.message?.content || '[]';
    
    // Parse AI response
    let recommendations;
    try {
      // Extract JSON from markdown code blocks if present
      const jsonMatch = aiResponse.match(/```json\s*([\s\S]*?)\s*```/) || aiResponse.match(/\[[\s\S]*\]/);
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : aiResponse;
      recommendations = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('Failed to parse AI response:', aiResponse);
      throw new Error('Invalid AI response format');
    }

    // Validate and enrich recommendations
    const validRecommendations = recommendations
      .filter((r: any) => r.index >= 0 && r.index < containers.length)
      .map((r: any) => ({
        ...r,
        container: containers[r.index]
      }));

    return new Response(JSON.stringify({ recommendations: validRecommendations }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in recommend-containers:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
