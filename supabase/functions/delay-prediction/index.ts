import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const { origin, destination, departureDate, cargoType } = await req.json()

    // Free weather API — no key needed for basic forecast
    let weatherInfo = 'Weather data unavailable'
    try {
      const weatherRes = await fetch(
        `https://wttr.in/${encodeURIComponent(destination)}?format=j1`
      )
      const weather = await weatherRes.json()
      const current = weather.current_condition?.[0]
      weatherInfo = `${destination}: ${current?.weatherDesc?.[0]?.value}, ${current?.temp_C}°C, wind ${current?.windspeedKmph}km/h`
    } catch { /* weather fetch failed, continue without it */ }

    const result = await callAI(
      `You are a shipping delay risk analyst. Always respond with valid JSON only, no extra text.`,
      `Route: ${origin} → ${destination}
Departure: ${departureDate}
Cargo: ${cargoType}
Current weather at destination: ${weatherInfo}

Assess delay risk. Return this exact JSON:
{
  "risk": "low"|"medium"|"high"|"critical",
  "delayProbabilityPercent": number,
  "expectedDelayDays": number,
  "worstCaseDelayDays": number,
  "factors": [{"name": "string", "impact": "low"|"medium"|"high", "detail": "string"}],
  "recommendation": "one sentence"
}`
    )

    return new Response(result, {
      headers: { ...cors, 'Content-Type': 'application/json' }
    })
  } catch (err) {
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
