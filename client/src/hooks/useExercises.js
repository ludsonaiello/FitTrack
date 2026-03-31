import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useOnlineStatus } from './useOnlineStatus.js'

const BASE_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:3001') + '/api/exercises'

/**
 * Fetch exercises from the API with optional filters.
 * Falls back gracefully (returns undefined) when offline or on error.
 *
 * @param {{ q?: string, equipment?: string, focus?: string, level?: string }} filters
 * @returns {{ data: Array<object> | undefined, isLoading: boolean, isOnline: boolean }}
 */
export function useExercises({ q = '', equipment = '', focus = '', level = '' } = {}) {
  const isOnline = useOnlineStatus()

  const [debouncedQ, setDebouncedQ] = useState(q)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQ(q), 300)
    return () => clearTimeout(timer)
  }, [q])

  const { data, isLoading } = useQuery({
    queryKey: ['exercises', { q: debouncedQ, equipment, focus, level }],
    enabled: isOnline,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const params = new URLSearchParams()
      if (debouncedQ) params.set('q', debouncedQ)
      if (equipment) params.set('equipment', equipment)
      if (focus) params.set('focus', focus)
      if (level) params.set('level', level)

      const url = params.toString() ? `${BASE_URL}?${params.toString()}` : BASE_URL

      try {
        const res = await fetch(url)
        if (!res.ok) {
          console.warn(`[useExercises] API responded with ${res.status} ${res.statusText}`)
          return undefined
        }
        const json = await res.json()
        return json.data
      } catch (err) {
        console.warn('[useExercises] Fetch or parse error:', err)
        return undefined
      }
    },
  })

  return { data, isLoading, isOnline }
}
