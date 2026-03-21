import { useState, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/hooks/useAuth'

export function useRevenueForecast() {
  const { user } = useAuth()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user?.id) return

    const cacheKey = `revenue-forecast-${user.id}`
    const cached = sessionStorage.getItem(cacheKey)
    if (cached) {
      setData(JSON.parse(cached))
      setLoading(false)
      return
    }

    supabase.functions.invoke('revenue-forecast', {
      body: { providerId: user.id }
    })
      .then(({ data: result, error: err }) => {
        if (err) throw err
        sessionStorage.setItem(cacheKey, JSON.stringify(result))
        setData(result)
      })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }, [user?.id])

  return { data, loading, error }
}
