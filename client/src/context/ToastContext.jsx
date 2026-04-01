import { createContext, useCallback, useContext, useRef, useState } from 'react'

const ToastContext = createContext(null)

let _id = 0
const nextId = () => ++_id

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timers = useRef({})

  const dismiss = useCallback((id) => {
    clearTimeout(timers.current[id])
    delete timers.current[id]
    // Mark as exiting to play the out-animation before removal
    setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t))
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 280)
  }, [])

  const show = useCallback((message, type = 'info', duration) => {
    const id = nextId()
    const ms = duration ?? (type === 'error' ? 5000 : 3000)
    setToasts(prev => [...prev.slice(-2), { id, message, type, exiting: false }])
    timers.current[id] = setTimeout(() => dismiss(id), ms)
    return id
  }, [dismiss])

  const toast = {
    success: (msg, duration) => show(msg, 'success', duration),
    error:   (msg, duration) => show(msg, 'error',   duration),
    info:    (msg, duration) => show(msg, 'info',    duration),
  }

  return (
    <ToastContext.Provider value={{ toasts, dismiss, toast }}>
      {children}
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside ToastProvider')
  return ctx.toast
}

export function useToastState() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToastState must be used inside ToastProvider')
  return { toasts: ctx.toasts, dismiss: ctx.dismiss }
}
