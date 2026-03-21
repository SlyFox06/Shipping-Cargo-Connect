import { useState, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'

export function useDemandForecast() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const cached = sessionStorage.getItem('demand-forecast')
    if (cached) {
      setData(JSON.parse(cached))
      setLoading(false)
      return
    }

    supabase.functions.invoke('demand-forecast', { body: {} })
      .then(({ data: result, error: err }) => {
        if (err) throw err
        sessionStorage.setItem('demand-forecast', JSON.stringify(result))
        setData(result)
      })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  return { data, loading, error }
}
