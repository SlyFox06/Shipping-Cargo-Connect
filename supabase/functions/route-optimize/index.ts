import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CargoItem {
  name: string;
  weightKg: number;
  volumeCBM: number;
  category: string;
}

interface AvailableContainer {
  id: string;
  containerType: string;
  origin: string;
  destination: string;
  maxWeightKg: number;
  maxVolumeCBM: number;
  pricePerCBM: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const { cargoItems, containers, origin, destination } = await req.json()

    const result = await callAI(
      `You are a logistics cargo optimization expert for ShipConnect. Analyze cargo and split them optimally across available containers.
Rules:
1. Only use containers that match the route: ${origin} to ${destination}.
2. Never exceed weight or volume limits.
3. Pack as full as possible.`,
      `Cargo items: ${JSON.stringify(cargoItems)}
Available containers: ${JSON.stringify(containers)}

Return this exact JSON:
{
  "splits": [{
    "containerId": "string",
    "items": ["item names"],
    "totalWeightKg": number,
    "totalCBM": number,
    "utilizationPercent": number,
    "warnings": ["string"]
  }],
  "unallocated": ["item names"],
  "costEstimate": number,
  "savingsVsSingleContainer": number,
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
