import { createPortal } from 'react-dom'
import { useEffect, useMemo } from 'react'
import { ArrowRight, Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNumericKeyboard } from '../context/NumericKeyboardContext'

const KEY_ROWS = [
  ['7', '8', '9'],
  ['4', '5', '6'],
  ['1', '2', '3'],
  ['.', '0', 'BS'],
]

export default function NumericKeyboard() {
  const isMobile = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches,
    []
  )

  const { t } = useTranslation()
  const { state, append, backspace, confirm, close } = useNumericKeyboard()
  const { isOpen, label, value, isLastField } = state

  useEffect(() => {
    if (!isOpen) return
    const handler = () => close()
    window.addEventListener('popstate', handler)
    return () => window.removeEventListener('popstate', handler)
  }, [isOpen, close])

  if (!isMobile) return null

  // "Field Name: last value hint" → split on first colon
  const colonIdx = label.indexOf(':')
  const fieldName = colonIdx !== -1 ? label.slice(0, colonIdx).trim() : label
  const fieldHint = colonIdx !== -1 ? label.slice(colonIdx + 1).trim() : ''

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        aria-hidden="true"
        onPointerDown={e => { e.preventDefault(); close() }}
        style={{
          position: 'fixed', inset: 0, zIndex: 9990,
          background: 'rgba(0,0,0,0.55)',
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'auto' : 'none',
          transition: 'opacity 0.22s ease',
        }}
      />

      {/* Keyboard panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Numeric keyboard"
        style={{
          position: 'fixed',
          bottom: 0,
          left: '50%',
          width: '100%',
          maxWidth: 480,
          transform: `translateX(-50%) translateY(${isOpen ? '0%' : '108%'})`,
          transition: isOpen
            ? 'transform 0.30s cubic-bezier(0.32, 0.72, 0, 1)'
            : 'transform 0.22s cubic-bezier(0.4, 0, 1, 1)',
          willChange: 'transform',
          zIndex: 9991,
          background: '#161616',
          borderRadius: '20px 20px 0 0',
          borderTop: '1px solid rgba(255,255,255,0.07)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          touchAction: 'manipulation',
          boxShadow: '0 -8px 48px rgba(0,0,0,0.75)',
          overscrollBehavior: 'contain',
        }}
      >
        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 10, paddingBottom: 2 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.14)' }} />
        </div>

        {/* ── Value display ── */}
        <div
          key={label}
          className="nk-label-panel"
          style={{
            padding: '10px 20px 14px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          {/* Field name label */}
          <div style={{
            fontSize: '0.58rem', fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.12em', color: 'var(--text3)', marginBottom: 8,
            fontFamily: "'Barlow Condensed', sans-serif",
          }}>
            {fieldName || 'Value'}
          </div>

          {/* Current value (left) + Last value (bottom-right) */}
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>

            {/* Live value with cursor */}
            <div style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontWeight: 800, fontSize: '2.6rem',
              color: value ? 'var(--text)' : 'rgba(255,255,255,0.18)',
              lineHeight: 1, letterSpacing: '0.01em',
              flex: 1, minWidth: 0,
            }}>
              {value || '0'}
              <span
                className="nk-cursor"
                style={{
                  display: 'inline-block', width: 2, height: '1.9rem',
                  background: 'var(--accent)', marginLeft: 3,
                  verticalAlign: 'text-bottom', borderRadius: 1,
                }}
              />
            </div>

            {/* Last value — bottom right */}
            {fieldHint && (
              <div style={{ textAlign: 'right', flexShrink: 0, paddingBottom: 3 }}>
                <div style={{
                  fontSize: '0.55rem', fontWeight: 700, textTransform: 'uppercase',
                  letterSpacing: '0.1em', color: 'var(--text3)', marginBottom: 4,
                  fontFamily: "'Barlow Condensed', sans-serif",
                }}>
                  {t('common.last_value')}
                </div>
                <div style={{
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontWeight: 700, fontSize: '1.5rem',
                  color: 'var(--accent)', lineHeight: 1,
                  opacity: 0.75,
                }}>
                  {fieldHint}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Toolbar ── */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '8px 16px 6px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
          <button
            className="nk-toolbar-cancel"
            onPointerDown={e => { e.preventDefault(); close() }}
            aria-label="Close keyboard"
          >
            {t('common.cancel')}
          </button>

          {/* Icon-only confirm: thick arrow → or check ✓ */}
          <button
            className={`nk-toolbar-confirm ${isLastField ? 'nk-toolbar-done' : ''}`}
            onPointerDown={e => { e.preventDefault(); confirm() }}
            aria-label={isLastField ? 'Done' : 'Next field'}
          >
            {isLastField
              ? <Check size={20} strokeWidth={3} />
              : <ArrowRight size={20} strokeWidth={3} />
            }
          </button>
        </div>

        {/* ── Keypad ── */}
        <div style={{ padding: '10px 12px 10px' }}>
          {KEY_ROWS.map((row, rowIdx) => (
            <div
              key={rowIdx}
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 10,
                marginBottom: rowIdx < KEY_ROWS.length - 1 ? 10 : 0,
              }}
            >
              {row.map(k =>
                k === 'BS' ? (
                  <button
                    key="bs"
                    className="nk-key nk-key-action"
                    onPointerDown={e => { e.preventDefault(); backspace() }}
                    aria-label="Backspace"
                  >
                    ⌫
                  </button>
                ) : (
                  <button
                    key={k}
                    className={k === '.' ? 'nk-key nk-key-action' : 'nk-key'}
                    onPointerDown={e => { e.preventDefault(); append(k) }}
                    aria-label={k}
                  >
                    {k}
                  </button>
                )
              )}
            </div>
          ))}
        </div>
      </div>
    </>,
    document.body
  )
}
