import { CheckCircle, XCircle, Info, X } from 'lucide-react'
import { useToastState } from '../context/ToastContext.jsx'

const CONFIG = {
  success: {
    icon: CheckCircle,
    color: 'var(--success)',
    bg: 'rgba(34, 197, 94, 0.12)',
    border: 'rgba(34, 197, 94, 0.25)',
  },
  error: {
    icon: XCircle,
    color: 'var(--accent2)',
    bg: 'rgba(255, 61, 61, 0.12)',
    border: 'rgba(255, 61, 61, 0.25)',
  },
  info: {
    icon: Info,
    color: 'var(--accent3)',
    bg: 'rgba(0, 212, 255, 0.10)',
    border: 'rgba(0, 212, 255, 0.22)',
  },
}

export default function ToastRenderer() {
  const { toasts, dismiss } = useToastState()
  if (!toasts.length) return null

  return (
    <div style={{
      position: 'fixed',
      bottom: 'calc(72px + env(safe-area-inset-bottom, 0px))',
      left: '50%',
      transform: 'translateX(-50%)',
      width: 'calc(100% - 32px)',
      maxWidth: 420,
      zIndex: 9000,
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      pointerEvents: 'none',
    }}>
      {toasts.map(toast => {
        const cfg = CONFIG[toast.type] ?? CONFIG.info
        const Icon = cfg.icon
        return (
          <div
            key={toast.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '12px 14px',
              borderRadius: 12,
              background: 'var(--surface)',
              border: `1px solid ${cfg.border}`,
              boxShadow: `0 4px 20px rgba(0,0,0,0.5), inset 0 0 0 1px ${cfg.bg}`,
              backdropFilter: 'blur(8px)',
              pointerEvents: 'auto',
              animation: toast.exiting
                ? 'toast-out 0.26s cubic-bezier(0.4,0,1,1) forwards'
                : 'toast-in 0.28s cubic-bezier(0,0,0.2,1) forwards',
            }}
          >
            <Icon size={18} color={cfg.color} style={{ flexShrink: 0 }} />
            <span style={{
              flex: 1,
              fontSize: '0.88rem',
              fontWeight: 500,
              color: 'var(--text)',
              lineHeight: 1.4,
            }}>
              {toast.message}
            </span>
            <button
              onClick={() => dismiss(toast.id)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text3)',
                padding: 4,
                borderRadius: 6,
                display: 'flex',
                alignItems: 'center',
                flexShrink: 0,
                transition: 'color 0.12s',
              }}
            >
              <X size={14} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
