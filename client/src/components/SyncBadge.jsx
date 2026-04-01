import { RefreshCw, AlertTriangle, CheckCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'

/**
 * Shows sync queue status as a small badge.
 * Hidden when queue is empty and no errors.
 *
 * @param {{ stats: import('../hooks/useSyncQueue').QueueStats, retry: () => void }} props
 */
export default function SyncBadge({ stats, retry }) {
  const { t } = useTranslation()
  const { pending, syncing, errors } = stats

  if (syncing > 0) {
    return (
      <div title={t('sync.syncing', { count: syncing })} style={badge('#1a1a1a', 'var(--accent)')}>
        <RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} />
        <span>{syncing}</span>
      </div>
    )
  }

  if (errors > 0) {
    return (
      <button
        onClick={retry}
        title={t('sync.errors', { count: errors })}
        style={{ ...badge('#1a1a1a', 'var(--accent2)'), cursor: 'pointer', border: 'none' }}
      >
        <AlertTriangle size={12} />
        <span>{errors}</span>
      </button>
    )
  }

  if (pending > 0) {
    return (
      <div title={t('sync.pending', { count: pending })} style={badge('#1a1a1a', 'var(--text3)')}>
        <RefreshCw size={12} />
        <span>{pending}</span>
      </div>
    )
  }

  return null
}

function badge(bg, color) {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '3px 7px',
    borderRadius: 20,
    background: bg,
    color,
    fontSize: '0.7rem',
    fontWeight: 700,
    border: `1px solid ${color}`,
    opacity: 0.85,
  }
}
