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
  confirmLabel = 'Delete',
  onConfirm,
  onCancel,
  danger = true,
}) {
  return (
    <div className="overlay" onClick={onCancel}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 8px' }}>{title}</h3>
        {message && (
          <p style={{ color: 'var(--text2)', margin: '0 0 24px', fontSize: '0.95rem', lineHeight: 1.5 }}>
            {message}
          </p>
        )}
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onCancel}>
            Cancel
          </button>
          <button
            className={danger ? 'btn btn-danger' : 'btn btn-primary'}
            style={{ flex: 1 }}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
