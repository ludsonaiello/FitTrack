import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { Flame, Zap, Trophy, ChevronRight, Plus, Share, X, Lock } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { db, startSession, getRecentSessions, getWorkoutFrequency, getActivePlan, getPlanWithDays, syncServerPlans, mergeServerSessions, getAllPRs } from '../db/index.js'
import { getExerciseById, allExercises } from '../lib/exercises.js'
import { api, fetchWithFallback } from '../lib/api.js'
import { computeBadges, detectNewBadge, RARITY } from '../lib/badges.js'
import { useWeightUnit, toDisplay } from '../hooks/useWeightUnit.js'

function setCookie(name, value, days) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString()
  document.cookie = `${name}=${value}; expires=${expires}; path=/; SameSite=Lax`
}
function getCookie(name) {
  return document.cookie.split('; ').find(r => r.startsWith(name + '='))?.split('=')[1] ?? null
}

function GptBanner() {
  const nav = useNavigate()
  const { t } = useTranslation()
  const [show, setShow] = useState(() => getCookie('ft_gpt_banner_closed') !== '1')

  function dismiss() {
    setCookie('ft_gpt_banner_closed', '1', 365 * 100) // ~100 years
    setShow(false)
  }

  if (!show) return null

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(232,255,0,0.08) 0%, rgba(232,255,0,0.03) 100%)',
      border: '1px solid rgba(232,255,0,0.25)',
      borderRadius: 12,
      padding: '14px 14px 14px 16px',
      marginBottom: 16,
      display: 'flex',
      alignItems: 'center',
      gap: 12,
    }}>
      <span style={{ fontSize: '1.6rem', flexShrink: 0 }}>🤖</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: '1rem', color: 'var(--accent)', marginBottom: 2 }}>
          {t('dashboard.gpt_banner_title')}
        </div>
        <div style={{ fontSize: '0.78rem', color: 'var(--text3)', lineHeight: 1.4, marginBottom: 10 }}>
          {t('dashboard.gpt_banner_desc')}
        </div>
        <button
          className="btn btn-primary"
          style={{ padding: '7px 16px', fontSize: '0.82rem' }}
          onClick={() => nav('/profile#gpt-instructions')}
        >
          {t('dashboard.gpt_try_it')}
        </button>
      </div>
      <button onClick={dismiss} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 4, flexShrink: 0, alignSelf: 'flex-start' }}>
        <X size={18} />
      </button>
    </div>
  )
}

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || !!navigator.standalone
}
function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream
}

function InstallBanner() {
  const { t } = useTranslation()
  const deferredPromptRef = useRef(null)
  const [show, setShow] = useState(false)
  const [iosMode, setIosMode] = useState(false)

  useEffect(() => {
    if (isStandalone()) return // already installed
    if (localStorage.getItem('pwa_install_dismissed')) return

    if (isIOS()) {
      setIosMode(true)
      setShow(true)
      return
    }

    const handler = (e) => {
      e.preventDefault()
      deferredPromptRef.current = e
      setShow(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  function dismiss() {
    localStorage.setItem('pwa_install_dismissed', '1')
    setShow(false)
  }

  async function handleInstall() {
    if (!deferredPromptRef.current) return
    deferredPromptRef.current.prompt()
    const { outcome } = await deferredPromptRef.current.userChoice
    if (outcome === 'accepted') setShow(false)
    deferredPromptRef.current = null
  }

  if (!show) return null

  return (
    <div style={{
      background: 'var(--surface2)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      padding: '12px 14px',
      marginBottom: 16,
      display: 'flex',
      alignItems: 'flex-start',
      gap: 12,
    }}>
      <img src="/android-chrome-192x192.png" alt="" style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: '1rem', marginBottom: 2 }}>
          {t('dashboard.install_title')}
        </div>
        {iosMode ? (
          <div style={{ fontSize: '0.78rem', color: 'var(--text3)', lineHeight: 1.5 }}>
            Tap the <Share size={12} style={{ display: 'inline', verticalAlign: 'middle' }} /> <strong style={{ color: 'var(--text2)' }}>Share</strong> {t('dashboard.install_ios_desc')} <strong style={{ color: 'var(--text2)' }}>{t('dashboard.install_ios_add')}</strong>.
          </div>
        ) : (
          <div style={{ fontSize: '0.78rem', color: 'var(--text3)' }}>
            {t('dashboard.install_android_desc')}
          </div>
        )}
        {!iosMode && (
          <button className="btn btn-primary" style={{ marginTop: 10, padding: '7px 16px', fontSize: '0.85rem' }} onClick={handleInstall}>
            {t('dashboard.install_button')}
          </button>
        )}
      </div>
      <button onClick={dismiss} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 2, flexShrink: 0 }}>
        <X size={18} />
      </button>
    </div>
  )
}

function WorkoutCalendar({ freq, locale }) {
  const { t } = useTranslation()
  const [view, setView] = useState('7d')

  const today = useRef(null)
  if (!today.current) {
    today.current = new Date()
    today.current.setHours(0, 0, 0, 0)
  }
  const todayDate = today.current

  function dateKey(d) {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  const todayKey = dateKey(todayDate)

  // 7-day strip — today + 6 prior days
  const days7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(todayDate)
    d.setDate(d.getDate() - (6 - i))
    return d
  })

  const week7Count = days7.filter(d => (freq[dateKey(d)] || 0) > 0).length

  // 30-day grid — week-aligned, starting Sunday of the week containing D-29
  const thirtyAgo = new Date(todayDate)
  thirtyAgo.setDate(todayDate.getDate() - 29)
  const gridStart = new Date(thirtyAgo)
  gridStart.setDate(thirtyAgo.getDate() - thirtyAgo.getDay())

  const gridDays = []
  const cur = new Date(gridStart)
  while (cur <= todayDate || gridDays.length % 7 !== 0) {
    gridDays.push(new Date(cur))
    cur.setDate(cur.getDate() + 1)
    if (cur > todayDate && gridDays.length % 7 === 0) break
  }

  const month30Count = Object.values(freq).reduce((a, b) => a + b, 0)

  // Locale-aware narrow day headers (Sun–Sat)
  const dayHeaders = Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(locale, { weekday: 'narrow' }).format(new Date(2025, 0, 5 + i))
  )

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h3 style={{ margin: 0 }}>{t('dashboard.workout_calendar')}</h3>
        <div style={{
          display: 'flex', background: 'var(--surface2)', borderRadius: 8, padding: 2, gap: 2,
          border: '1px solid var(--border)',
        }}>
          {['7d', '30d'].map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              style={{
                padding: '4px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
                fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.03em',
                background: view === v ? 'var(--border2)' : 'transparent',
                color: view === v ? 'var(--text)' : 'var(--text3)',
                transition: 'all 0.15s',
              }}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {view === '7d' ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
            {days7.map(d => {
              const key = dateKey(d)
              const count = freq[key] || 0
              const isToday = key === todayKey
              const hasWorkout = count > 0
              return (
                <div key={key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                  <span style={{
                    fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                    color: isToday ? 'var(--accent)' : 'var(--text3)',
                  }}>
                    {new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(d).slice(0, 3)}
                  </span>
                  <div style={{
                    width: 38, height: 38, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: hasWorkout ? 'var(--accent)' : 'var(--surface2)',
                    border: isToday && !hasWorkout
                      ? '2px solid var(--accent)'
                      : hasWorkout ? '2px solid var(--accent)' : '2px solid var(--border)',
                    boxShadow: hasWorkout ? '0 0 12px rgba(232,255,0,0.3)' : 'none',
                    transition: 'all 0.15s',
                  }}>
                    <span style={{
                      fontSize: '0.85rem', fontWeight: 700, lineHeight: 1,
                      color: hasWorkout ? '#0a0a0a' : isToday ? 'var(--accent)' : 'var(--text3)',
                    }}>
                      {d.getDate()}
                    </span>
                  </div>
                  <span style={{
                    fontSize: '0.6rem', fontWeight: 700, lineHeight: 1,
                    color: hasWorkout ? 'var(--accent)' : 'transparent',
                    userSelect: 'none',
                  }}>
                    {count > 1 ? `×${count}` : '✓'}
                  </span>
                </div>
              )
            })}
          </div>

          {/* Week summary */}
          <div style={{
            marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text3)' }}>
              {t('dashboard.this_week')}
            </span>
            <span style={{
              fontFamily: 'Barlow Condensed', fontWeight: 800, fontSize: '1rem',
              color: week7Count > 0 ? 'var(--accent)' : 'var(--text3)',
            }}>
              {week7Count} <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text3)' }}>
                {t('dashboard.workouts_label')}
              </span>
            </span>
          </div>
        </>
      ) : (
        <>
          {/* Day headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3, marginBottom: 6 }}>
            {dayHeaders.map((h, i) => (
              <div key={i} style={{
                textAlign: 'center', fontSize: '0.58rem', fontWeight: 700,
                color: 'var(--text3)', letterSpacing: '0.04em', textTransform: 'uppercase',
              }}>
                {h}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
            {gridDays.map(d => {
              const key = dateKey(d)
              const count = freq[key] || 0
              const isToday = key === todayKey
              const inRange = d >= thirtyAgo && d <= todayDate
              const hasWorkout = count > 0 && inRange
              return (
                <div key={key} style={{
                  aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  borderRadius: '50%',
                  background: hasWorkout ? 'var(--accent)' : 'transparent',
                  border: isToday && !hasWorkout ? '1.5px solid var(--accent)' : '1.5px solid transparent',
                  boxShadow: hasWorkout ? '0 0 8px rgba(232,255,0,0.25)' : 'none',
                  opacity: !inRange ? 0.15 : 1,
                  transition: 'all 0.12s',
                }}>
                  <span style={{
                    fontSize: '0.68rem',
                    fontWeight: isToday || hasWorkout ? 700 : 400,
                    color: hasWorkout ? '#0a0a0a' : isToday ? 'var(--accent)' : 'var(--text3)',
                    lineHeight: 1,
                  }}>
                    {d.getDate()}
                  </span>
                </div>
              )
            })}
          </div>

          {/* Month summary */}
          <div style={{
            marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text3)' }}>
              {t('dashboard.last_30_days')}
            </span>
            <span style={{
              fontFamily: 'Barlow Condensed', fontWeight: 800, fontSize: '1rem',
              color: month30Count > 0 ? 'var(--accent)' : 'var(--text3)',
            }}>
              {month30Count} <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text3)' }}>
                {t('dashboard.workouts_label')}
              </span>
            </span>
          </div>
        </>
      )}
    </div>
  )
}

// ── Badge components ─────────────────────────────────────────────────────────

function BadgeIcon({ badge, size = 56, showLock = true }) {
  const r = RARITY[badge.rarity]
  const locked = !badge.earned
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: locked ? 'var(--surface2)' : r.bg,
      border: `1.5px solid ${locked ? 'var(--border)' : r.color}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      position: 'relative', flexShrink: 0,
      boxShadow: locked ? 'none' : `0 0 ${size * 0.25}px ${r.color}44`,
      filter: locked ? 'grayscale(1)' : 'none',
      opacity: locked ? 0.45 : 1,
      transition: 'all 0.15s',
    }}>
      <span style={{ fontSize: size * 0.42, lineHeight: 1, userSelect: 'none' }}>{badge.icon}</span>
      {locked && showLock && (
        <div style={{
          position: 'absolute', bottom: -2, right: -2,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: '50%', width: Math.round(size * 0.38), height: Math.round(size * 0.38),
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Lock size={Math.round(size * 0.2)} color="var(--text3)" />
        </div>
      )}
    </div>
  )
}

/** Slide-up toast shown once per newly earned badge. Auto-dismisses in 5 s. */
function BadgeUnlockNotification({ badge, onDismiss, onViewAll }) {
  const { t } = useTranslation()
  const r = RARITY[badge.rarity]
  const [progress, setProgress] = useState(100)
  const rafRef = useRef(null)
  const startRef = useRef(Date.now())
  const DURATION = 5000

  useEffect(() => {
    const tick = () => {
      const pct = Math.max(0, 100 - ((Date.now() - startRef.current) / DURATION) * 100)
      setProgress(pct)
      if (pct > 0) rafRef.current = requestAnimationFrame(tick)
      else onDismiss()
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return createPortal(
    <div style={{
      position: 'fixed',
      bottom: `calc(68px + env(safe-area-inset-bottom, 0px) + 10px)`,
      left: '50%', transform: 'translateX(-50%)',
      width: 'calc(100% - 32px)', maxWidth: 448,
      zIndex: 9985,
      animation: 'slideUp 0.32s cubic-bezier(0,0,0.2,1)',
    }}>
      <div style={{
        background: 'var(--surface)',
        border: `1px solid ${r.color}55`,
        borderRadius: 16, overflow: 'hidden',
        boxShadow: `0 12px 40px rgba(0,0,0,0.7), 0 0 0 1px ${r.color}22`,
      }}>
        {/* Countdown progress bar */}
        <div style={{ height: 3, background: 'var(--border)' }}>
          <div style={{
            height: '100%', background: r.color, borderRadius: 2,
            width: `${progress}%`, transition: 'width 0.08s linear',
          }} />
        </div>

        <div style={{ padding: '14px 14px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <BadgeIcon badge={badge} size={54} showLock={false} />

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.1em',
              textTransform: 'uppercase', color: r.color, marginBottom: 3,
            }}>
              {t('badges.unlocked')} · {t(`badges.rarity_${badge.rarity}`)}
            </div>
            <div style={{
              fontFamily: 'Barlow Condensed', fontWeight: 800, fontSize: '1.2rem',
              lineHeight: 1.1, color: 'var(--text)',
            }}>
              {t(`badges.${badge.id}.name`)}
            </div>
            <div style={{ fontSize: '0.76rem', color: 'var(--text3)', marginTop: 3, lineHeight: 1.4 }}>
              {t(`badges.${badge.id}.desc`)}
            </div>
            <button
              onClick={onViewAll}
              style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginTop: 7,
                fontSize: '0.78rem', fontWeight: 700, color: r.color,
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              {t('badges.view_achievements')} →
            </button>
          </div>

          <button
            onClick={onDismiss}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text3)', padding: 4, flexShrink: 0, alignSelf: 'flex-start',
            }}
          >
            <X size={18} />
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

function AllBadgesSheet({ badges, onClose }) {
  const { t } = useTranslation()
  const earnedCount = badges.filter(b => b.earned).length
  const rarityOrder = ['platinum', 'gold', 'silver', 'bronze']

  return createPortal(
    <div className="overlay" onClick={onClose} style={{ zIndex: 9990, alignItems: 'flex-end' }}>
      <div
        className="sheet"
        onClick={e => e.stopPropagation()}
        style={{
          maxHeight: '90dvh', display: 'flex', flexDirection: 'column',
          paddingBottom: 'calc(24px + env(safe-area-inset-bottom, 0px))',
        }}
      >
        {/* Handle */}
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border2)', margin: '0 auto 16px' }} />

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <div>
            <h2 style={{ margin: 0, lineHeight: 1 }}>{t('dashboard.achievements')}</h2>
            <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--text3)' }}>
              {t('dashboard.badges_earned', { count: earnedCount, total: badges.length })}
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 4 }}>
            <X size={22} />
          </button>
        </div>

        {/* Scrollable grid */}
        <div style={{ overflowY: 'auto', marginTop: 16, paddingRight: 2 }}>
          {rarityOrder.map(rarity => {
            const group = badges.filter(b => b.rarity === rarity)
            const r = RARITY[rarity]
            const groupEarned = group.filter(b => b.earned).length
            return (
              <div key={rarity} style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: r.color, boxShadow: `0 0 6px ${r.color}` }} />
                  <span style={{
                    fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: '0.9rem',
                    letterSpacing: '0.1em', textTransform: 'uppercase', color: r.color,
                  }}>
                    {t(`badges.rarity_${rarity}`)}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text3)', marginLeft: 'auto' }}>
                    {groupEarned}/{group.length}
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                  {group.map(badge => (
                    <div key={badge.id} style={{
                      background: badge.earned ? RARITY[badge.rarity].bg : 'var(--surface2)',
                      border: `1px solid ${badge.earned ? RARITY[badge.rarity].color + '44' : 'var(--border)'}`,
                      borderRadius: 12, padding: '14px 10px 12px',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                      transition: 'all 0.15s',
                    }}>
                      <BadgeIcon badge={badge} size={52} />
                      <div style={{ textAlign: 'center' }}>
                        <div style={{
                          fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: '0.88rem',
                          lineHeight: 1.2, color: badge.earned ? 'var(--text)' : 'var(--text3)',
                        }}>
                          {t(`badges.${badge.id}.name`)}
                        </div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--text3)', marginTop: 3, lineHeight: 1.3 }}>
                          {t(`badges.${badge.id}.desc`)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>,
    document.body
  )
}

function PRsSection({ prs, onViewAll }) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language
  const [unit] = useWeightUnit()

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Trophy size={18} color="var(--warning)" /> {t('pr.title_short')}
        </h3>
        <button className="btn btn-ghost" style={{ fontSize: '0.78rem', padding: '5px 12px' }} onClick={onViewAll}>
          {t('dashboard.view_all')}
        </button>
      </div>
      {prs.map((pr, i) => {
        const displayWeight = pr.weight != null ? Math.round(toDisplay(pr.weight, unit) * 10) / 10 : null
        return (
          <div key={pr.tutorialId} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '10px 0',
            borderBottom: i < prs.length - 1 ? '1px solid var(--border)' : 'none',
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10, flexShrink: 0,
              background: 'rgba(245,158,11,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1rem',
            }}>
              🏅
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
                fontSize: '0.95rem', lineHeight: 1.2,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {pr.name}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text3)', marginTop: 2 }}>
                {new Date(pr.achievedAt).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })}
              </div>
            </div>
            {displayWeight != null ? (
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: '1.3rem', color: 'var(--warning)', lineHeight: 1 }}>
                  {displayWeight}
                </div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text3)' }}>{unit} · {pr.reps} {t('pr.reps')}</div>
              </div>
            ) : pr.reps ? (
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: '1.3rem', color: 'var(--accent)', lineHeight: 1 }}>
                  {pr.reps}
                </div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text3)' }}>{t('pr.reps')}</div>
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

function BadgesSection({ badges, onViewAll }) {
  const { t } = useTranslation()
  const earned = badges.filter(b => b.earned)

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div>
          <h3 style={{ margin: 0 }}>{t('dashboard.achievements')}</h3>
          {earned.length > 0 && (
            <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'var(--text3)' }}>
              {t('dashboard.badges_earned', { count: earned.length, total: badges.length })}
            </p>
          )}
        </div>
        <button
          className="btn btn-ghost"
          style={{ fontSize: '0.78rem', padding: '5px 12px' }}
          onClick={onViewAll}
        >
          {t('dashboard.view_all')}
        </button>
      </div>

      {earned.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '20px 0 8px' }}>
          <div style={{ fontSize: '2.4rem', marginBottom: 8 }}>🎖️</div>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text3)', lineHeight: 1.5 }}>
            {t('dashboard.no_badges_yet')}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 10 }}>
          {earned.slice(-3).reverse().map(badge => {
            const r = RARITY[badge.rarity]
            return (
              <div
                key={badge.id}
                onClick={onViewAll}
                style={{
                  flex: 1, background: r.bg,
                  border: `1px solid ${r.color}44`,
                  borderRadius: 12, padding: '12px 8px 10px',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7,
                  cursor: 'pointer', transition: 'all 0.15s',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                <BadgeIcon badge={badge} size={46} showLock={false} />
                <div style={{
                  fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: '0.82rem',
                  lineHeight: 1.2, textAlign: 'center', color: 'var(--text)',
                }}>
                  {t(`badges.${badge.id}.name`)}
                </div>
                <span style={{
                  fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.08em',
                  textTransform: 'uppercase', color: r.color,
                }}>
                  {t(`badges.rarity_${badge.rarity}`)}
                </span>
              </div>
            )
          })}
          {/* Teaser: next locked badge */}
          {earned.length < badges.length && (() => {
            const next = badges.find(b => !b.earned)
            if (!next || earned.length >= 3) return null
            return (
              <div
                key="teaser"
                onClick={onViewAll}
                style={{
                  flex: 1, background: 'var(--surface2)',
                  border: '1px solid var(--border)',
                  borderRadius: 12, padding: '12px 8px 10px',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7,
                  cursor: 'pointer', opacity: 0.6,
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                <BadgeIcon badge={next} size={46} />
                <div style={{
                  fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: '0.82rem',
                  lineHeight: 1.2, textAlign: 'center', color: 'var(--text3)',
                }}>
                  {t(`badges.${next.id}.name`)}
                </div>
                <span style={{
                  fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.08em',
                  textTransform: 'uppercase', color: 'var(--text3)',
                }}>
                  {t(`badges.rarity_${next.rarity}`)}
                </span>
              </div>
            )
          })()}
        </div>
      )}
    </div>
  )
}

export default function Dashboard() {
  const nav = useNavigate()
  const { t, i18n } = useTranslation()
  const locale = i18n.language
  const [plan, setPlan] = useState(null)
  const [todayDay, setTodayDay] = useState(null)
  const [sessions, setSessions] = useState([])
  const [freq, setFreq] = useState({})
  const [streak, setStreak] = useState(0)
  const [badges, setBadges] = useState([])
  const [showAllBadges, setShowAllBadges] = useState(false)
  const [newBadge, setNewBadge] = useState(null)
  const [topPRs, setTopPRs] = useState([])

  useEffect(() => {
    const dow = new Date().getDay()
    setTodayDay(dow)
    loadAll()
    window.addEventListener('online', loadAll)
    return () => window.removeEventListener('online', loadAll)
  }, [])

  async function loadAll() {
    // Plans — online-first, 3 retries, local fallback
    await fetchWithFallback(
      async () => {
        const json = await api.get('/api/workouts/plans')
        if (!json.success || !Array.isArray(json.data)) throw new Error('bad response')
        if (json.data.length > 0) {
          const newlyActiveId = await syncServerPlans(json.data)
          if (newlyActiveId) {
            getPlanWithDays(newlyActiveId).then(setPlan)
          } else {
            // Plan already synced — always load active from local DB
            const localActive = await getActivePlan()
            if (localActive) getPlanWithDays(localActive.id).then(setPlan)
          }
        } else {
          const localActive = await getActivePlan()
          if (localActive) getPlanWithDays(localActive.id).then(setPlan)
        }
      },
      async () => {
        const localActive = await getActivePlan()
        if (localActive) getPlanWithDays(localActive.id).then(setPlan)
      },
    )

    // Sessions — online-first: merge server sessions into local DB, then read local IDs
    await fetchWithFallback(
      async () => {
        const json = await api.get('/api/workouts/sessions?limit=5')
        if (!json.success || !Array.isArray(json.data)) throw new Error('bad response')
        await mergeServerSessions(json.data)
        const local = await getRecentSessions(5)
        setSessions(local)
      },
      () => getRecentSessions(5).then(setSessions),
    )

    // Frequency — local (derived from synced sessions)
    getWorkoutFrequency(30).then(f => {
      setFreq(f)
      let s = 0, d = new Date()
      while (true) {
        const k = d.toISOString().slice(0,10)
        if (!f[k]) break
        s++; d.setDate(d.getDate()-1)
      }
      setStreak(s)
    })

    // Badges — derived from local DB; detect newly earned for the one-time popup
    computeBadges().then(result => {
      setBadges(result)
      const justEarned = detectNewBadge(result)
      if (justEarned) setNewBadge(justEarned)
    })

    // Top PRs for dashboard widget — latest 3 by achievedAt
    getAllPRs().then(raw => {
      const enriched = raw
        .map(pr => {
          const info = allExercises.find(e => e.id === pr.tutorialId)
          return info ? { ...pr, name: info.name } : null
        })
        .filter(Boolean)
        .sort((a, b) => b.achievedAt.localeCompare(a.achievedAt))
        .slice(0, 3)
      setTopPRs(enriched)
    })
  }

  const todayPlanDay = plan?.days?.find(d => d.dayOfWeek === todayDay)

  async function handleStartWorkout() {
    const id = await startSession(plan?.id || null, todayPlanDay?.id || null)
    nav(`/workout/active/${id}`, { state: { planDay: todayPlanDay } })
  }

  const totalThisMonth = Object.values(freq).reduce((a,b)=>a+b,0)

  return (
    <div className="page">
      {/* Header */}
      <div style={{marginBottom:16}}>
        <p style={{color:'var(--text3)',fontSize:'0.8rem',fontWeight:600,letterSpacing:'0.1em',textTransform:'uppercase',margin:0}}>
          {new Date().toLocaleDateString(locale,{weekday:'long',month:'long',day:'numeric'})}
        </p>
        <h1 style={{margin:'4px 0 0',lineHeight:1}}>{t('dashboard.hero_line1')}<br/><span style={{color:'var(--accent)'}}>{t('dashboard.hero_line2')}</span></h1>
      </div>

      <InstallBanner />

      {/* Stats row */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,marginBottom:20}}>
        <div className="stat-box">
          <Flame size={18} color="var(--accent2)" />
          <div className="stat-value">{streak}</div>
          <div className="stat-label">{t('dashboard.day_streak')}</div>
        </div>
        <div className="stat-box">
          <Zap size={18} color="var(--accent)" />
          <div className="stat-value">{totalThisMonth}</div>
          <div className="stat-label">{t('dashboard.this_month')}</div>
        </div>
        <div className="stat-box">
          <Trophy size={18} color="var(--warning)" />
          <div className="stat-value">{sessions.length}</div>
          <div className="stat-label">{t('dashboard.recent')}</div>
        </div>
      </div>

      {/* Today's plan */}
      <div className="card" style={{marginBottom:16}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
          <div>
            <div style={{fontSize:'0.7rem',fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase',color:'var(--text3)'}}>{t('dashboard.today')}</div>
            <h3 style={{margin:0}}>{todayPlanDay?.name || (plan ? t('dashboard.rest_day') : t('dashboard.no_active_plan'))}</h3>
          </div>
          {todayPlanDay && <span style={{background:'rgba(232,255,0,0.1)',color:'var(--accent)',fontSize:'0.75rem',fontWeight:700,padding:'4px 10px',borderRadius:100,letterSpacing:'0.05em'}}>{t('dashboard.exercises_count', { count: todayPlanDay.exercises?.length || 0 })}</span>}
        </div>

        {todayPlanDay?.exercises?.length > 0 && (
          <div style={{marginBottom:14}}>
            {todayPlanDay.exercises.slice(0,3).map((ex,i) => {
              const info = getExerciseById(ex.tutorialId)
              return (
                <div key={ex.id} style={{display:'flex',alignItems:'center',gap:8,padding:'5px 0',borderBottom:i<2?'1px solid var(--border)':'none'}}>
                  <div style={{width:6,height:6,borderRadius:'50%',background:'var(--accent)',flexShrink:0}}/>
                  <span style={{fontSize:'0.9rem',color:'var(--text2)'}}>{info?.name ?? ex.tutorialId.split(':').pop()}</span>
                  <span style={{marginLeft:'auto',fontSize:'0.8rem',color:'var(--text3)'}}>{ex.targetSets}×{ex.targetReps}</span>
                </div>
              )
            })}
            {todayPlanDay.exercises.length > 3 && (
              <div style={{fontSize:'0.8rem',color:'var(--text3)',paddingTop:6}}>{t('dashboard.more_exercises', { count: todayPlanDay.exercises.length - 3 })}</div>
            )}
          </div>
        )}

        {plan ? (
          <button className="btn btn-primary" style={{width:'100%'}} onClick={handleStartWorkout}>
            <Zap size={18}/> {t('dashboard.start_workout')}
          </button>
        ) : (
          <button className="btn btn-primary" style={{width:'100%'}} onClick={() => nav('/planner')}>
            <Plus size={18}/> {t('planner.create_plan')}
          </button>
        )}
      </div>

      <GptBanner />

      {/* Workout Calendar */}
      <WorkoutCalendar freq={freq} locale={locale} />

      {/* Personal Records */}
      {topPRs.length > 0 && (
        <PRsSection prs={topPRs} onViewAll={() => nav('/progress/personal-records')} />
      )}

      {/* Achievements / Badges */}
      {badges.length > 0 && (
        <BadgesSection badges={badges} onViewAll={() => setShowAllBadges(true)} />
      )}

      {/* Recent sessions */}
      {sessions.length > 0 && (
        <div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
            <h3 style={{margin:0}}>{t('dashboard.recent_sessions')}</h3>
            <button className="btn btn-ghost" style={{fontSize:'0.8rem',padding:'4px 8px'}}
              onClick={() => nav('/workout/sessions')}>
              {t('dashboard.view_all')}
            </button>
          </div>
          {sessions.map(s => (
            <div key={s.id} className="card-sm" style={{marginBottom:8,display:'flex',alignItems:'center',gap:12,cursor:'pointer'}}
              onClick={() => nav(`/workout/session/${s.id}`)}>
              <div style={{width:40,height:40,borderRadius:8,background:'var(--surface2)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                <Flame size={18} color={s.completedAt?'var(--accent)':'var(--text3)'}/>
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontFamily:'Barlow Condensed',fontWeight:700,fontSize:'1rem'}}>
                  {new Date(s.startedAt).toLocaleDateString(locale,{weekday:'short',month:'short',day:'numeric'})}
                </div>
                <div style={{fontSize:'0.8rem',color:'var(--text3)'}}>
                  {s.completedAt ? `${Math.round(s.durationSec/60)} min` : t('dashboard.incomplete')}
                </div>
              </div>
              <ChevronRight size={16} color="var(--text3)"/>
            </div>
          ))}
        </div>
      )}

      {sessions.length === 0 && (
        <div style={{textAlign:'center',padding:'40px 0'}}>
          <div style={{fontSize:'3rem',marginBottom:12}}>🏋️</div>
          <p style={{color:'var(--text3)',margin:0}}>{t('dashboard.no_workouts_yet').split('\n').map((l,i)=><span key={i}>{l}{i===0?<br/>:null}</span>)}</p>
        </div>
      )}

      {showAllBadges && badges.length > 0 && (
        <AllBadgesSheet badges={badges} onClose={() => setShowAllBadges(false)} />
      )}

      {newBadge && (
        <BadgeUnlockNotification
          badge={newBadge}
          onDismiss={() => setNewBadge(null)}
          onViewAll={() => { setNewBadge(null); setShowAllBadges(true) }}
        />
      )}
    </div>
  )
}
