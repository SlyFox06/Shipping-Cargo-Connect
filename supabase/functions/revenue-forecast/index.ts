import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const { providerId } = await req.json()

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Provider's own earnings history — last 6 months
    const { data: earnings } = await supabase
      .from('bookings')
      .select('price_usd, cargo_category, created_at, status')
      .eq('provider_id', providerId)
      .gte('created_at', new Date(Date.now() - 180 * 86400000).toISOString())
      .order('created_at', { ascending: true })

    // Provider's current containers and their fill rates
    const { data: containers } = await supabase
      .from('containers')
      .select('id, origin, destination, total_volume_m3, available_volume_m3, price_usd, departure_date')
      .eq('provider_id', providerId)
      .gte('departure_date', new Date().toISOString().split('T')[0])

    // Upcoming bookings already confirmed
    const { data: upcomingBookings } = await supabase
      .from('bookings')
      .select('price_usd, created_at')
      .eq('provider_id', providerId)
      .eq('status', 'confirmed')
      .gte('created_at', new Date().toISOString())

    // Group earnings by month for trend analysis
    const monthlyEarnings = (earnings ?? []).reduce((acc: any, b) => {
      const month = b.created_at.substring(0, 7)  // "YYYY-MM"
      acc[month] = (acc[month] ?? 0) + (b.price_usd ?? 0)
      return acc
    }, {})

    const result = await callGroq(
      `You are a revenue forecasting analyst for a shipping container provider on ShipConnect.
Analyze their historical earnings, current container fill rates, and confirmed upcoming bookings
to predict their revenue for the next 30 and 90 days.
Always respond with valid JSON only, no extra text.`,

      `Provider monthly earnings history: ${JSON.stringify(monthlyEarnings)}
Raw booking data: ${JSON.stringify(earnings ?? [])}
Current containers (with fill rates): ${JSON.stringify(containers ?? [])}
Already confirmed upcoming bookings: ${JSON.stringify(upcomingBookings ?? [])}
Today: ${new Date().toISOString().split('T')[0]}

Return this exact JSON:
{
  "currentMonthForecast": {
    "estimatedRevenue": number,
    "confirmedRevenue": number,
    "potentialRevenue": number,
    "confidence": "low"|"medium"|"high"
  },
  "next30Days": {
    "estimatedRevenue": number,
    "vsLastMonth": "up"|"down"|"flat",
    "vsLastMonthPercent": number,
    "confidence": "low"|"medium"|"high"
  },
  "next90Days": {
    "estimatedRevenue": number,
    "trend": "growing"|"stable"|"declining",
    "confidence": "low"|"medium"|"high"
  },
  "fillRateAnalysis": {
    "currentAvgFillRate": number,
    "targetFillRate": number,
    "revenueIfTargetMet": number,
    "recommendation": "one sentence to improve fill rate"
  },
  "topEarningRoutes": [
    {
      "origin": "string",
      "destination": "string",
      "totalEarned": number,
      "avgPerBooking": number
    }
  ],
  "alerts": [
    {
      "type": "opportunity"|"risk"|"warning",
      "message": "one sentence actionable alert"
    }
  ],
  "summary": "2 sentence revenue outlook"
}`
    )

    return new Response(result, {
      headers: { ...cors, 'Content-Type': 'application/json' }
    })

  } catch (err) {
    console.error('revenue-forecast error:', err)
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
