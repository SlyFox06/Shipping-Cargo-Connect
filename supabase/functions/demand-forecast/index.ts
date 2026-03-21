import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Last 90 days of bookings across the whole platform
    const { data: bookings } = await supabase
      .from('bookings')
      .select('origin, destination, cargo_category, created_at, price_usd')
      .gte('created_at', new Date(Date.now() - 90 * 86400000).toISOString())
      .limit(200)

    // Active searches / saved searches to see what traders WANT right now
    const { data: savedSearches } = await supabase
      .from('saved_searches')
      .select('search_criteria, created_at')
      .gte('created_at', new Date(Date.now() - 30 * 86400000).toISOString())
      .limit(100)

    // Current containers with low fill rate — unmet supply
    const { data: containers } = await supabase
      .from('containers')
      .select('origin, destination, available_volume_m3, total_volume_m3, departure_date')
      .eq('status', 'active')
      .gte('departure_date', new Date().toISOString().split('T')[0])
      .limit(50)

    const result = await callGroq(
      `You are a logistics demand analyst for ShipConnect, a shared container marketplace.
Analyze booking patterns, search trends, and container availability to forecast which 
routes will have high trader demand in the next 30 days.
Always respond with valid JSON only, no extra text.`,

      `Platform booking data (last 90 days): ${JSON.stringify(bookings ?? [])}
Recent trader searches (last 30 days): ${JSON.stringify(savedSearches ?? [])}
Current active containers: ${JSON.stringify(containers ?? [])}
Today's date: ${new Date().toISOString().split('T')[0]}

Identify the top 5 high-demand routes and return this exact JSON:
{
  "hotRoutes": [
    {
      "origin": "string",
      "destination": "string",
      "demandScore": number,
      "demandLevel": "low"|"medium"|"high"|"very_high",
      "bookingTrend": "rising"|"stable"|"falling",
      "avgBookingsPerWeek": number,
      "topCargoTypes": ["string"],
      "supplyGap": "oversupplied"|"balanced"|"undersupplied",
      "opportunityScore": number,
      "insight": "one sentence why this route is hot"
    }
  ],
  "emergingRoutes": [
    {
      "origin": "string",
      "destination": "string",
      "signal": "one sentence explaining early demand signal"
    }
  ],
  "peakPeriod": {
    "startDate": "YYYY-MM-DD",
    "endDate": "YYYY-MM-DD",
    "reason": "string"
  },
  "summary": "2 sentence overall demand outlook for next 30 days"
}`
    )

    return new Response(result, {
      headers: { ...cors, 'Content-Type': 'application/json' }
    })

  } catch (err) {
    console.error('demand-forecast error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' }
    })
  }
})

async function callGroq(system: string, user: string) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${Deno.env.get('GROQ_API_KEY')}`,
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ],
      response_format: { type: 'json_object' },
      max_tokens: 1000,
      temperature: 0.3
    })
  })
  if (!res.ok) throw new Error(await res.text())
  const d = await res.json()
  return d.choices[0].message.content
}
