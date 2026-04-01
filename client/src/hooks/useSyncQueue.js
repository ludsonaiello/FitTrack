import { useState, useEffect, useCallback, useRef } from 'react'
import { processQueue, getQueueStats, retryErrors } from '../db/sync-queue.js'
import { mergeServerSessions, mergeServerWeights } from '../db/index.js'
import { api } from '../lib/api.js'

const POLL_INTERVAL_MS = 30_000  // retry errored items every 30s while online

/** Pull fresh data from the server and merge into local DB (server wins). */
async function pullServerData() {
  if (!navigator.onLine) return
  try {
    const [sessJson, weightJson] = await Promise.all([
      api.get('/api/workouts/sessions?limit=200'),
      api.get('/api/progress/weight?limit=365'),
    ])
    if (sessJson.success && Array.isArray(sessJson.data)) {
      await mergeServerSessions(sessJson.data)
    }
    if (weightJson.success && Array.isArray(weightJson.data)) {
      await mergeServerWeights(weightJson.data)
    }
  } catch {
    // Silently ignore — pages handle their own fallback
  }
}

export function useSyncQueue() {
  const [stats, setStats] = useState({ pending: 0, syncing: 0, errors: 0, total: 0 })
  const pollRef = useRef(null)

  const refreshStats = useCallback(async () => {
    const s = await getQueueStats()
    setStats(s)
  }, [])

  const sync = useCallback(async () => {
    if (!navigator.onLine) return
    await processQueue()
    await refreshStats()
  }, [refreshStats])

  const retry = useCallback(async () => {
    await retryErrors()
    await sync()
  }, [sync])

  const syncAndPull = useCallback(async () => {
    if (!navigator.onLine) return
    await processQueue()    // push pending local data → server first
    await pullServerData()  // then pull fresh server data → local (server wins)
    await refreshStats()
  }, [refreshStats])

  useEffect(() => {
    // On mount: push any queued items, then pull fresh server data
    syncAndPull()

    // On reconnect: push + pull
    window.addEventListener('online', syncAndPull)

    // Poll every 30s to retry errors (only when online)
    pollRef.current = setInterval(() => {
      if (navigator.onLine) sync()
    }, POLL_INTERVAL_MS)

    return () => {
      window.removeEventListener('online', syncAndPull)
      clearInterval(pollRef.current)
    }
  }, [sync, syncAndPull, refreshStats])

  return { stats, sync, retry }
}
