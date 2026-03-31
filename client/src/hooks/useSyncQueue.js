import { useState, useEffect, useCallback, useRef } from 'react'
import { processQueue, getQueueStats, retryErrors } from '../db/sync-queue.js'

const POLL_INTERVAL_MS = 30_000  // retry errored items every 30s while online

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

  useEffect(() => {
    // Run on mount (catches items queued while offline); sync() calls refreshStats() internally
    sync()

    // Sync whenever the browser comes back online
    window.addEventListener('online', sync)

    // Poll every 30s to retry errors (only when online)
    pollRef.current = setInterval(() => {
      if (navigator.onLine) sync()
    }, POLL_INTERVAL_MS)

    return () => {
      window.removeEventListener('online', sync)
      clearInterval(pollRef.current)
    }
  }, [sync, refreshStats])

  return { stats, sync, retry }
}
