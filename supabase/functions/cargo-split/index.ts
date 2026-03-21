import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const { cargoItems, origin, destination, requiredArrivalDate } = await req.json()

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Pre-filter containers — same route, arrives in time, still has space
    const { data: containers } = await supabase
      .from('containers')
      .select('id, available_weight_kg, available_cbm, price_per_cbm, departure_date, arrival_date, cargo_types_allowed, refrigerated')
      .eq('origin', origin)
      .eq('destination', destination)
      .eq('status', 'active')
      .gt('available_cbm', 0)
      .lte('arrival_date', requiredArrivalDate)
      .gte('departure_date', new Date().toISOString().split('T')[0])
      .order('departure_date', { ascending: true })

    if (!containers?.length) {
      return new Response(JSON.stringify({
        splits: [], unallocated: cargoItems.map((i: any) => i.name),
        totalCost: 0, containersUsed: 0,
        recommendation: 'No matching containers found for this route and date.'
      }), { headers: { ...cors, 'Content-Type': 'application/json' } })
    }

    const result = await callAI(
      `You are a cargo optimization expert. Split cargo across containers efficiently.
Only use containers from the provided list. Never exceed weight or CBM limits.
Pack one container full before opening the next. Always respond with valid JSON only.`,
      `Cargo to split: ${JSON.stringify(cargoItems)}

Available containers (same route, compatible dates): ${JSON.stringify(containers)}

Origin: ${origin}, Destination: ${destination}
Must arrive by: ${requiredArrivalDate}

Return this exact JSON:
{
  "splits": [{
    "containerId": "string",
    "items": ["item names"],
    "totalWeightKg": number,
    "totalCBM": number,
    "utilizationPercent": number,
    "priceForSpace": number,
    "warnings": ["string"]
  }],
  "unallocated": ["item names"],
  "totalCost": number,
  "savingsVsSingleContainer": number,
  "containersUsed": number,
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
      max_tokens: 1000,
      temperature: 0.2
    })
  })
  if (!res.ok) throw new Error(await res.text())
  const d = await res.json()
  return d.choices[0].message.content
}
