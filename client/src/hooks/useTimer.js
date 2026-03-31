import { useState, useEffect, useRef, useCallback } from 'react'

export function useRestTimer() {
  const [seconds, setSeconds] = useState(0)
  const [running, setRunning] = useState(false)
  const [total, setTotal] = useState(0)
  const intervalRef = useRef(null)
  const notifRef = useRef(null)

  const clear = useCallback(() => {
    clearInterval(intervalRef.current)
    setRunning(false)
    setSeconds(0)
  }, [])

  const start = useCallback((durationSec) => {
    clear()
    setTotal(durationSec)
    setSeconds(durationSec)
    setRunning(true)

    intervalRef.current = setInterval(() => {
      setSeconds(prev => {
        if (prev <= 1) {
          clearInterval(intervalRef.current)
          setRunning(false)
          // Fire notification via service worker (works on mobile background + iOS PWA)
          if ('Notification' in window && Notification.permission === 'granted') {
            const opts = {
              body: 'Time for your next set 💪',
              icon: '/android-chrome-192x192.png',
              badge: '/android-chrome-192x192.png',
              vibrate: [200, 100, 200],
              tag: 'rest-timer',
              renotify: true,
            }
            if ('serviceWorker' in navigator) {
              navigator.serviceWorker.ready
                .then(reg => reg.showNotification('Rest complete!', opts))
                .catch(() => { try { notifRef.current = new Notification('Rest complete!', opts) } catch {} })
            } else {
              try { notifRef.current = new Notification('Rest complete!', opts) } catch {}
            }
          }
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }, [clear])

  const requestPermission = useCallback(async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission()
    }
  }, [])

  useEffect(() => () => clearInterval(intervalRef.current), [])

  const progress = total > 0 ? 1 - seconds / total : 0

  return { seconds, running, progress, start, clear, requestPermission }
}

export function useStopwatch() {
  const [elapsed, setElapsed] = useState(0)
  const [running, setRunning] = useState(false)
  const startRef = useRef(null)
  const intervalRef = useRef(null)

  const start = useCallback(() => {
    startRef.current = Date.now() - elapsed * 1000
    setRunning(true)
    intervalRef.current = setInterval(() => {
      setElapsed(Math.round((Date.now() - startRef.current) / 1000))
    }, 1000)
  }, [elapsed])

  const pause = useCallback(() => {
    clearInterval(intervalRef.current)
    setRunning(false)
  }, [])

  const reset = useCallback(() => {
    clearInterval(intervalRef.current)
    setRunning(false)
    setElapsed(0)
  }, [])

  useEffect(() => () => clearInterval(intervalRef.current), [])

  const fmt = (s) => {
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const sec = s % 60
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  }

  return { elapsed, running, formatted: fmt(elapsed), start, pause, reset }
}
