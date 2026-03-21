import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const { documentType, content, context } = await req.json()

    const result = await callAI(
      `You are a shipping document verification expert. Analyze the provided text from a ${documentType}.
Verify if the document is authentic, complete, and correct for shipping logistics.
Return this exact JSON:
{
  "isValid": boolean,
  "confidence": number,
  "flags": [{"type": "string", "severity": "low"|"medium"|"high", "detail": "string"}],
  "recommendation": "one sentence"
}`,
      `Document content: ${content}
Context: ${JSON.stringify(context)}`
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
      temperature: 0.1 // lowest for highest consistency
    })
  })
  if (!res.ok) throw new Error(await res.text())
  const d = await res.json()
  return d.choices[0].message.content
}
