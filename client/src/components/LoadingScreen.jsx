import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

// Stagger delays (ms) at which each step becomes "completed"
const STEP_COMPLETE_AT = [900, 2000, 3200, 4600, 6200]
const TIP_DURATION = 4000

/** Random integer in [min, max] inclusive */
function randBetween(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1))
}

const STEPS = [
  { key: 'loading_profile' },
  { key: 'loading_exercises', doneKey: 'loading_exercises_done', doneArgs: { count: 610 } },
  { key: 'loading_plans' },
  { key: 'checking_records' },
  { key: 'generating_reports' },
]

function CheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <circle cx="9" cy="9" r="9" fill="rgba(232,255,0,0.15)" />
      <path
        d="M5 9.2L7.8 12L13 6"
        stroke="#e8ff00"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function Spinner() {
  return (
    <svg
      width="18" height="18" viewBox="0 0 18 18" fill="none"
      style={{ animation: 'loaderSpin 0.9s linear infinite', flexShrink: 0 }}
      aria-hidden="true"
    >
      <circle cx="9" cy="9" r="7" stroke="var(--border2)" strokeWidth="2" />
      <path
        d="M9 2 A7 7 0 0 1 16 9"
        stroke="#e8ff00"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

export default function LoadingScreen({ onDone, userName }) {
  const { t, i18n } = useTranslation()

  // Random duration per session: 7 000 – 10 000 ms
  const totalMs = useRef(randBetween(7000, 10000)).current

  // Pick 2 random tips once on mount
  const [tips] = useState(() => {
    const all = t('loader.tips', { returnObjects: true, lng: i18n.language })
    const arr = Array.isArray(all) ? all : []
    const shuffled = [...arr].sort(() => Math.random() - 0.5)
    return shuffled.slice(0, 2)
  })

  const [completedSteps, setCompletedSteps] = useState([])    // indices
  const [visibleSteps, setVisibleSteps]     = useState([0])   // indices that have appeared
  const [tipIdx, setTipIdx]                 = useState(0)
  const [tipVisible, setTipVisible]         = useState(true)
  const [progress, setProgress]             = useState(0)
  const startRef = useRef(Date.now())

  // Smooth progress bar
  useEffect(() => {
    let raf
    function tick() {
      const elapsed = Date.now() - startRef.current
      setProgress(Math.min(elapsed / totalMs, 1))
      if (elapsed < totalMs) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  // Step visibility & completion
  useEffect(() => {
    const timers = []
    // Each step becomes visible 400ms before it completes
    STEP_COMPLETE_AT.forEach((completeAt, i) => {
      const showAt = Math.max(0, completeAt - 400)
      timers.push(setTimeout(() => setVisibleSteps(prev => prev.includes(i) ? prev : [...prev, i]), showAt))
      timers.push(setTimeout(() => setCompletedSteps(prev => [...prev, i]), completeAt))
    })
    // Show next step as soon as previous completes
    for (let i = 1; i < STEPS.length; i++) {
      timers.push(setTimeout(() => {
        setVisibleSteps(prev => prev.includes(i) ? prev : [...prev, i])
      }, STEP_COMPLETE_AT[i - 1]))
    }
    return () => timers.forEach(clearTimeout)
  }, [])

  // Tip cycling: tip 1 for first 4s, tip 2 for next 4s
  useEffect(() => {
    if (tips.length < 2) return
    const fade = setTimeout(() => setTipVisible(false), TIP_DURATION - 400)
    const swap = setTimeout(() => {
      setTipIdx(1)
      setTipVisible(true)
    }, TIP_DURATION)
    return () => { clearTimeout(fade); clearTimeout(swap) }
  }, [tips])

  // Done after totalMs
  useEffect(() => {
    const timer = setTimeout(onDone, totalMs)
    return () => clearTimeout(timer)
  }, [onDone])

  const allDone = completedSteps.length === STEPS.length

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10000,
      background: '#0a0a0a',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center',
      overflowY: 'auto',
      paddingBottom: 'env(safe-area-inset-bottom, 16px)',
    }}>
      <style>{`
        @keyframes loaderSpin { to { transform: rotate(360deg); } }
        @keyframes loaderFadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes loaderPulse {
          0%, 100% { box-shadow: 0 0 32px rgba(232,255,0,0.25), 0 0 64px rgba(232,255,0,0.1); }
          50%       { box-shadow: 0 0 48px rgba(232,255,0,0.45), 0 0 96px rgba(232,255,0,0.2); }
        }
        @keyframes loaderTipFade {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Top safe area spacer */}
      <div style={{ height: 'env(safe-area-inset-top, 24px)', flexShrink: 0 }} />

      {/* ── Logo block ────────────────────────────────────────── */}
      <div style={{
        flex: '0 0 auto',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        paddingTop: 48, marginBottom: 40,
        animation: 'loaderFadeUp 0.7s ease forwards',
      }}>
        <div style={{
          width: 96, height: 96,
          borderRadius: 24,
          background: 'rgba(232,255,0,0.06)',
          border: '1px solid rgba(232,255,0,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 20,
          animation: 'loaderPulse 2.8s ease-in-out infinite',
        }}>
          <img
            src="/assets/logo.png"
            alt="FitTrack"
            style={{ width: 68, height: 68, objectFit: 'contain' }}
          />
        </div>
        <div style={{
          fontFamily: 'Barlow Condensed', fontWeight: 900,
          fontSize: '2.2rem', letterSpacing: '0.04em',
          lineHeight: 1,
        }}>
          Fit<span style={{ color: 'var(--accent)' }}>Track</span>
        </div>
        {userName && (
          <div style={{
            marginTop: 6, fontSize: '0.9rem',
            color: 'var(--text3)', fontWeight: 500,
            animation: 'loaderFadeUp 0.5s 0.3s ease both',
          }}>
            {t('auth.welcome_back', { name: userName })}
          </div>
        )}
      </div>

      {/* ── Steps card ────────────────────────────────────────── */}
      <div style={{
        width: '100%', maxWidth: 380, padding: '0 20px',
        flex: '0 0 auto',
        animation: 'loaderFadeUp 0.7s 0.15s ease both',
      }}>
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          padding: '8px 0',
          overflow: 'hidden',
        }}>
          {STEPS.map((step, i) => {
            const isDone    = completedSteps.includes(i)
            const isVisible = visibleSteps.includes(i)
            const isActive  = isVisible && !isDone

            if (!isVisible) return null

            return (
              <div
                key={step.key}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '11px 18px',
                  borderBottom: i < STEPS.length - 1 ? '1px solid var(--border2)' : 'none',
                  animation: 'loaderFadeUp 0.35s ease both',
                }}
              >
                <div style={{ flexShrink: 0 }}>
                  {isDone ? <CheckIcon /> : <Spinner />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontFamily: 'Barlow Condensed', fontWeight: 700,
                    fontSize: '1.02rem',
                    color: isDone ? 'var(--text2)' : 'var(--text)',
                    lineHeight: 1.2,
                    transition: 'color 0.3s',
                  }}>
                    {isDone && step.doneKey
                      ? t(`loader.${step.doneKey}`, step.doneArgs)
                      : t(`loader.${step.key}`)}
                  </div>
                </div>
                {isDone && (
                  <div style={{
                    fontSize: '0.72rem', fontWeight: 700,
                    color: 'var(--accent)', letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    animation: 'loaderFadeUp 0.3s ease both',
                  }}>
                    ✓
                  </div>
                )}
              </div>
            )
          })}

          {/* "All set" row when everything is done */}
          {allDone && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 10, padding: '12px 18px',
              animation: 'loaderFadeUp 0.35s ease both',
            }}>
              <span style={{ fontSize: '1.2rem' }}>🚀</span>
              <span style={{
                fontFamily: 'Barlow Condensed', fontWeight: 800,
                fontSize: '1.05rem', color: 'var(--accent)',
                letterSpacing: '0.05em', textTransform: 'uppercase',
              }}>
                {t('loader.all_set')}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Tip card ──────────────────────────────────────────── */}
      {tips.length > 0 && (
        <div style={{
          width: '100%', maxWidth: 380, padding: '16px 20px 0',
          flex: '0 0 auto',
          animation: 'loaderFadeUp 0.7s 0.4s ease both',
        }}>
          <div style={{
            background: 'rgba(232,255,0,0.05)',
            border: '1px solid rgba(232,255,0,0.15)',
            borderRadius: 14, padding: '14px 18px',
          }}>
            <div style={{
              fontSize: '0.7rem', fontWeight: 700,
              color: 'var(--accent)', letterSpacing: '0.1em',
              textTransform: 'uppercase', marginBottom: 8,
            }}>
              {t('loader.tips_label')}
            </div>
            <div
              key={tipIdx}
              style={{
                fontSize: '0.88rem', color: 'var(--text2)',
                lineHeight: 1.55, fontWeight: 500,
                opacity: tipVisible ? 1 : 0,
                transition: 'opacity 0.4s ease',
                animation: 'loaderTipFade 0.5s ease both',
              }}
            >
              {tips[tipIdx]}
            </div>
          </div>
        </div>
      )}

      {/* Spacer to push progress bar to bottom */}
      <div style={{ flex: 1, minHeight: 24 }} />

      {/* ── Progress bar ──────────────────────────────────────── */}
      <div style={{
        width: '100%', maxWidth: 380, padding: '0 20px 28px',
        flex: '0 0 auto',
        animation: 'loaderFadeUp 0.7s 0.5s ease both',
      }}>
        <div style={{
          height: 3, borderRadius: 99,
          background: 'var(--border2)',
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            background: 'linear-gradient(90deg, rgba(232,255,0,0.6) 0%, #e8ff00 100%)',
            borderRadius: 99,
            width: `${Math.round(progress * 100)}%`,
            transition: 'width 0.12s linear',
          }} />
        </div>
      </div>
    </div>
  )
}
