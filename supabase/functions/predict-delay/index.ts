import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { containerId, route, departureDate, historicalData } = await req.json();

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch historical performance data
    const { data: performance } = await supabase
      .from('container_performance')
      .select('*')
      .eq('container_id', containerId)
      .single();

    // Prepare context for AI
    const context = {
      route,
      departureDate,
      historicalAverageDelay: performance?.average_delay_days || 0,
      onTimeRate: performance?.total_bookings > 0 
        ? (performance.on_time_deliveries / performance.total_bookings * 100).toFixed(1)
        : 'No history',
      totalBookings: performance?.total_bookings || 0,
      currentMonth: new Date().getMonth() + 1,
      currentSeason: ['Winter', 'Winter', 'Spring', 'Spring', 'Spring', 'Summer', 'Summer', 'Summer', 'Fall', 'Fall', 'Fall', 'Winter'][new Date().getMonth()]
    };

    // Call Lovable AI for prediction
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `You are a shipping delay prediction AI. Analyze the following data and predict:
1. Delay risk score (low/medium/high)
2. Predicted delay in days (0-10)
3. Confidence score (0-100)
4. Key factors affecting the prediction

Consider: historical performance, seasonal patterns, route complexity, and current month.
Respond in JSON format: { "riskScore": "low|medium|high", "delayDays": number, "confidence": number, "factors": ["factor1", "factor2"] }`
          },
          {
            role: 'user',
            content: `Route: ${context.route}
Departure: ${context.departureDate}
Historical avg delay: ${context.historicalAverageDelay} days
On-time rate: ${context.onTimeRate}%
Total bookings: ${context.totalBookings}
Current season: ${context.currentSeason}
Month: ${context.currentMonth}

Predict the delay risk for this shipment.`
          }
        ],
        temperature: 0.3
      })
    });

    if (!aiResponse.ok) {
      throw new Error('AI prediction failed');
    }

    const aiResult = await aiResponse.json();
    const prediction = JSON.parse(
      aiResult.choices[0].message.content
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim()
    );

    // Store prediction in database
    const { data: savedPrediction, error: saveError } = await supabase
      .from('delay_predictions')
      .insert({
        container_id: containerId,
        risk_score: prediction.riskScore,
        predicted_delay_days: prediction.delayDays,
        confidence_score: prediction.confidence,
        factors: { factors: prediction.factors }
      })
      .select()
      .single();

    if (saveError) {
      console.error('Error saving prediction:', saveError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        prediction: {
          riskScore: prediction.riskScore,
          delayDays: prediction.delayDays,
          confidence: prediction.confidence,
          factors: prediction.factors,
          id: savedPrediction?.id
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in predict-delay:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
