import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const { origin, destination, cargoType, weightKg, cbm, departureDate } = await req.json()

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: history } = await supabase
      .from('bookings')
      .select('total_price, weight_kg, cbm, cargo_type, created_at')
      .eq('origin', origin)
      .eq('destination', destination)
      .gte('created_at', new Date(Date.now() - 90 * 86400000).toISOString())
      .limit(20)

    // Parallel weather fetch
    const [originWeather, destWeather] = await Promise.all([
      fetch(`https://wttr.in/${encodeURIComponent(origin)}?format=j1`).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch(`https://wttr.in/${encodeURIComponent(destination)}?format=j1`).then(r => r.ok ? r.json() : null).catch(() => null),
    ])

    const originCond = originWeather?.current_condition?.[0]
    const destCond = destWeather?.current_condition?.[0]

    const weatherContext = {
      origin: originCond ? { temp: originCond.temp_C, desc: originCond.weatherDesc?.[0]?.value, wind: originCond.windspeedKmph } : "Unknown",
      destination: destCond ? { temp: destCond.temp_C, desc: destCond.weatherDesc?.[0]?.value, wind: destCond.windspeedKmph } : "Unknown"
    }

    const result = await callAI(
      `You are a freight pricing analyst for a shipping marketplace. 
Always respond with valid JSON only, no extra text.`,
      `Historical bookings for ${origin} → ${destination} (last 90 days): ${JSON.stringify(history ?? [])}
      
Current Weather Conditions:
Origin (${origin}): ${JSON.stringify(weatherContext.origin)}
Destination (${destination}): ${JSON.stringify(weatherContext.destination)}

Predict price for: ${weightKg}kg, ${cbm} CBM, ${cargoType}, departing ${departureDate}.

Return this exact JSON format:
{
  "min": number,
  "max": number,
  "recommended": number,
  "confidence": "low"|"medium"|"high",
  "trend": "rising"|"stable"|"falling",
  "reasoning": "one sentence explaining price factors + impact of current weather on this route",
  "peakWarning": boolean,
  "weatherImpact": "favorable"|"unfavorable"|"neutral",
  "breakdown": {
    "baseFreight": number,
    "fuelSurcharge": number,
    "portHandling": number,
    "insurance": number
  }
}

The sum of breakdown fields should approximately equal the recommended price.`
    )

    return new Response(result, {
      headers: { ...cors, 'Content-Type': 'application/json' }
    })
  } catch (err) {
    console.error('predict-price-ai error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' }
    })
  }
})

async function callAI(system: string, user: string) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${Deno.env.get('GROQ_API_KEY')}`,
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      response_format: { type: 'json_object' },
      max_tokens: 400,
      temperature: 0.3
    })
  })
  if (!res.ok) throw new Error(await res.text())
  const d = await res.json()
  return d.choices[0].message.content
}
