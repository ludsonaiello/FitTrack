import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'

/**
 * Reusable confirmation bottom-sheet modal.
 *
 * Props:
 *   title      – bold heading
 *   message    – supporting text
 *   confirmLabel – label for the destructive button (default "Delete")
 *   onConfirm  – called when user confirms
 *   onCancel   – called when user cancels (or taps backdrop)
 *   danger     – if true (default), confirm button uses btn-danger style
 */
export default function ConfirmModal({
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
  danger = true,
}) {
  const { t } = useTranslation()
  return createPortal(
    <div
      className="overlay"
      onClick={onCancel}
      style={{ zIndex: 9995 }}
    >
      <div
        className="sheet"
        onClick={e => e.stopPropagation()}
        style={{ paddingBottom: 'calc(32px + env(safe-area-inset-bottom, 0px))' }}
      >
        <h3 style={{ margin: '0 0 8px' }}>{title}</h3>
        {message && (
          <p style={{ color: 'var(--text2)', margin: '0 0 24px', fontSize: '0.95rem', lineHeight: 1.5 }}>
            {message}
          </p>
        )}
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onCancel}>
            {t('common.cancel')}
          </button>
          <button
            className={danger ? 'btn btn-danger' : 'btn btn-primary'}
            style={{ flex: 1 }}
            onClick={onConfirm}
          >
            {confirmLabel ?? t('common.delete')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
