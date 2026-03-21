import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const { message, userId, userRole } = await req.json()

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Pull real user context
    let context = ''
    if (userRole === 'trader') {
      const { data: bookings } = await supabase
        .from('bookings')
        .select('id, status, origin, destination, total_price, created_at')
        .eq('trader_id', userId)
        .order('created_at', { ascending: false })
        .limit(5)
      const { data: bids } = await supabase
        .from('auction_bids')
        .select('auction_id, amount, created_at')
        .eq('bidder_id', userId)
        .limit(3)
      context = `Recent bookings: ${JSON.stringify(bookings ?? [])}
Active bids: ${JSON.stringify(bids ?? [])}`
    } else if (userRole === 'provider') {
      const { data: containers } = await supabase
        .from('containers')
        .select('id, origin, destination, available_cbm, departure_date, status')
        .eq('provider_id', userId)
        .limit(5)
      context = `Your containers: ${JSON.stringify(containers ?? [])}`
    }

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('GROQ_API_KEY')}`,
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          {
            role: 'system',
            content: `You are ShipConnect AI, a helpful shipping logistics assistant.
The user is a ${userRole}. Their account data: ${context}
Be concise, specific, and reference their real data when relevant.
Never make up booking IDs or amounts not shown in the data.`
          },
          { role: 'user', content: message }
        ],
        max_tokens: 500,
        temperature: 0.5
      })
    })

    const data = await res.json()
    const reply = data.choices[0].message.content

    return new Response(JSON.stringify({ reply }), {
      headers: { ...cors, 'Content-Type': 'application/json' }
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' }
    })
  }
})
