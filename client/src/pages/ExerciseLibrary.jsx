import { useState, useMemo, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useLocation } from 'react-router-dom'
import { Search, X, SlidersHorizontal, ChevronRight, Play, Pause, Lightbulb } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { filterExercises, EQUIPMENT_LABELS, FOCUS_LABELS, LEVEL_LABELS, exImageUrl, exVideoUrl } from '../lib/exercises.js'
import { useExercises } from '../hooks/useExercises.js'
import { addExerciseToDay } from '../db/index.js'
import { useNumericKeyboard } from '../context/NumericKeyboardContext.jsx'
import { getWeightUnit } from '../hooks/useWeightUnit.js'

const FOCUSES    = Object.keys(FOCUS_LABELS)
const EQUIPMENTS = Object.keys(EQUIPMENT_LABELS)
const LEVELS     = Object.keys(LEVEL_LABELS)

const REST_CHIPS = [
  { v: 30,  l: '30s'  },
  { v: 45,  l: '45s'  },
  { v: 60,  l: '1min' },
  { v: 90,  l: '90s'  },
  { v: 120, l: '2min' },
  { v: 180, l: '3min' },
]

const LEVEL_COLORS = {
  beginner:     { text: '#4ade80', bg: 'rgba(74,222,128,0.12)' },
  intermediate: { text: '#fbbf24', bg: 'rgba(251,191,36,0.12)' },
  advanced:     { text: '#f87171', bg: 'rgba(248,113,113,0.12)' },
}

/* ── Exercise Card ─────────────────────────────── */
function ExCard({ ex, onClick, index = 0 }) {
  const { t } = useTranslation()
  const [imgSrc, setImgSrc] = useState(() => exImageUrl(ex.id))
  const lvl = LEVEL_COLORS[ex.experienceLevel?.toLowerCase()] ?? LEVEL_COLORS.beginner

  return (
    <div
      onClick={() => onClick(ex)}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 12, overflow: 'hidden', cursor: 'pointer',
        transition: 'border-color 0.15s, background 0.12s',
        marginBottom: 10,
        opacity: 0,
        animation: `fadeSlideUp 0.22s ease forwards`,
        animationDelay: `${Math.min(index * 35, 350)}ms`,
        WebkitTapHighlightColor: 'transparent',
      }}
      onPointerDown={e => e.currentTarget.style.background = 'var(--surface2)'}
      onPointerUp={e => e.currentTarget.style.background = 'var(--surface)'}
      onPointerLeave={e => e.currentTarget.style.background = 'var(--surface)'}
    >
      {/* Thumbnail */}
      <div style={{
        width: 76, height: 76, flexShrink: 0, background: 'var(--surface2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
      }}>
        {imgSrc ? (
          <img
            src={imgSrc} alt={ex.name} loading="lazy"
            onError={() => setImgSrc(null)}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <div style={{ fontSize: '1.6rem', opacity: 0.3 }}>💪</div>
        )}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0, padding: '10px 0' }}>
        <div style={{
          fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
          fontSize: '1.05rem', lineHeight: 1.2, marginBottom: 5,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {ex.name}
        </div>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{
            fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.06em',
            padding: '2px 8px', borderRadius: 100,
            color: lvl.text, background: lvl.bg,
            textTransform: 'uppercase',
          }}>
            {t(`filters.level.${ex.experienceLevel}`, { defaultValue: LEVEL_LABELS[ex.experienceLevel] })}
          </span>
          {ex.focusArea.slice(0, 2).map(f => (
            <span key={f} style={{
              fontSize: '0.68rem', color: 'var(--text3)',
              background: 'var(--surface2)', padding: '2px 8px', borderRadius: 100,
            }}>
              {t(`filters.focus.${f}`, { defaultValue: FOCUS_LABELS[f] })}
            </span>
          ))}
        </div>
        <div style={{
          marginTop: 4, fontSize: '0.72rem', color: 'var(--text3)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {ex.equipment.map(e => t(`filters.equipment.${e}`, { defaultValue: EQUIPMENT_LABELS[e] || e })).join(' · ')}
        </div>
      </div>

      {/* Arrow */}
      <div style={{ paddingRight: 12, flexShrink: 0, color: 'var(--text3)' }}>
        <ChevronRight size={18} />
      </div>
    </div>
  )
}

/* ── Stepper ──────────────────────────────────── */
function Stepper({ value, onChange, min = 1, onTap }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
      <button
        onPointerDown={e => { e.stopPropagation(); onChange(Math.max(min, value - 1)) }}
        style={{
          width: 40, height: 40, border: '1px solid var(--border2)',
          background: 'var(--surface2)', borderRadius: '8px 0 0 8px',
          cursor: 'pointer', color: 'var(--text)', fontSize: '1.2rem',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'background 0.1s',
        }}>
        −
      </button>
      <button
        onPointerDown={e => { e.stopPropagation(); onTap?.() }}
        style={{
          minWidth: 52, height: 40,
          border: '1px solid var(--border2)', borderLeft: 'none', borderRight: 'none',
          background: 'var(--surface)',
          fontFamily: "'JetBrains Mono', monospace", fontSize: '1.05rem', fontWeight: 600,
          color: 'var(--text)', cursor: onTap ? 'pointer' : 'default',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          WebkitTapHighlightColor: 'transparent',
        }}>
        {value}
      </button>
      <button
        onPointerDown={e => { e.stopPropagation(); onChange(value + 1) }}
        style={{
          width: 40, height: 40, border: '1px solid var(--border2)',
          background: 'var(--surface2)', borderRadius: '0 8px 8px 0',
          cursor: 'pointer', color: 'var(--text)', fontSize: '1.2rem',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'background 0.1s',
        }}>
        +
      </button>
    </div>
  )
}

/* ── Config Sheet (portal, 80 dvh) ──────────────── */
function ConfigSheet({ ex, dayName, dayId, defaultRest, onClose, onAdded }) {
  const { t }    = useTranslation()
  const keyboard = useNumericKeyboard()
  const videoRef = useRef(null)

  const [sets, setSets]     = useState(3)
  const [reps, setReps]     = useState(10)
  const [weight, setWeight] = useState('')
  const [rest, setRest]     = useState(defaultRest ?? 60)
  const [saving, setSaving] = useState(false)
  const [done, setDone]     = useState(false)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [vidSrc]  = useState(() => exVideoUrl(ex.id))
  const [imgSrc]  = useState(() => exImageUrl(ex.id))

  function openWeightKeyboard() {
    keyboard.open({
      label: t('exercises.weight'),
      value: weight,
      onChange: v => setWeight(v),
      isLastField: true,
      onDone: () => {},
    })
  }

  function openRepsKeyboard() {
    keyboard.open({
      label: `${t('exercises.reps')}: ${reps}`,
      value: String(reps),
      onChange: v => { const n = parseInt(v); if (n >= 1 && !isNaN(n)) setReps(n) },
      isLastField: false,
      onNext: openWeightKeyboard,
    })
  }

  function openSetsKeyboard() {
    keyboard.open({
      label: `${t('exercises.sets')}: ${sets}`,
      value: String(sets),
      onChange: v => { const n = parseInt(v); if (n >= 1 && !isNaN(n)) setSets(n) },
      isLastField: false,
      onNext: openRepsKeyboard,
    })
  }

  const lvl        = LEVEL_COLORS[ex.experienceLevel?.toLowerCase()] ?? LEVEL_COLORS.beginner
  const weightUnit = getWeightUnit()

  async function handleAdd() {
    setSaving(true)
    try {
      await addExerciseToDay(dayId, ex.id, {
        targetSets:   sets,
        targetReps:   reps,
        targetWeight: weight !== '' ? parseFloat(weight) : null,
        restSeconds:  rest,
      })
      setDone(true)
      setTimeout(() => onAdded(), 600)
    } catch {
      setSaving(false)
    }
  }

  function togglePlay() {
    const v = videoRef.current
    if (!v) return
    if (v.paused) { v.play(); setPlaying(true) }
    else          { v.pause(); setPlaying(false) }
  }

  function handleSeek(e) {
    const v = videoRef.current
    if (!v || !v.duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    v.currentTime = ((e.clientX - rect.left) / rect.width) * v.duration
  }

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        aria-hidden="true"
        onPointerDown={e => { e.preventDefault(); onClose() }}
        style={{
          position: 'fixed', inset: 0, zIndex: 9980,
          background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)',
          animation: 'fadeIn 0.18s ease forwards',
        }}
      />

      {/* Sheet — 80dvh, flex column */}
      <div
        role="dialog"
        aria-modal="true"
        style={{
          position: 'fixed', bottom: 0, left: '50%', zIndex: 9981,
          width: '100%', maxWidth: 480,
          height: '80dvh',
          display: 'flex', flexDirection: 'column',
          background: '#111111',
          borderRadius: '20px 20px 0 0',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 -8px 48px rgba(0,0,0,0.8)',
          overflow: 'hidden',
          animation: 'sheetIn 0.30s cubic-bezier(0.32,0.72,0,1) forwards',
        }}
      >
        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 10, paddingBottom: 6, flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.14)' }} />
        </div>

        {/* ── Video player ── */}
        <div style={{ position: 'relative', height: 200, background: '#000', flexShrink: 0, overflow: 'hidden' }}>
          <video
            ref={videoRef}
            src={vidSrc}
            poster={imgSrc}
            playsInline
            loop
            onTimeUpdate={() => {
              const v = videoRef.current
              if (v && v.duration) setProgress(v.currentTime / v.duration)
            }}
            onEnded={() => setPlaying(false)}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />

          {/* Gradient overlay */}
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            background: playing
              ? 'linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0) 50%, rgba(0,0,0,0.7) 100%)'
              : 'linear-gradient(to bottom, rgba(10,10,10,0.4) 0%, rgba(10,10,10,0.8) 100%)',
          }} />

          {/* Close button */}
          <button
            onPointerDown={e => { e.preventDefault(); onClose() }}
            style={{
              position: 'absolute', top: 10, right: 10, zIndex: 10,
              background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 8, padding: 6, cursor: 'pointer', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <X size={16} />
          </button>

          {/* Tap to play */}
          <button
            onClick={togglePlay}
            style={{
              position: 'absolute', inset: 0, background: 'none', border: 'none',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 5,
            }}
          >
            {!playing && (
              <div style={{
                width: 52, height: 52, borderRadius: '50%',
                background: 'rgba(232,255,0,0.92)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
              }}>
                <Play size={22} color="#000" fill="#000" style={{ marginLeft: 2 }} />
              </div>
            )}
          </button>

          {/* Name + level overlay (bottom) */}
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0 14px 10px', zIndex: 6 }}>
            <div style={{
              fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800,
              fontSize: '1.3rem', lineHeight: 1.15, marginBottom: 5, color: '#fff',
            }}>
              {ex.name}
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{
                fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.06em',
                padding: '2px 8px', borderRadius: 100, textTransform: 'uppercase',
                color: lvl.text, background: lvl.bg,
              }}>
                {t(`filters.level.${ex.experienceLevel}`, { defaultValue: LEVEL_LABELS[ex.experienceLevel] })}
              </span>
              {ex.focusArea.slice(0, 2).map(f => (
                <span key={f} style={{
                  fontSize: '0.65rem', color: 'rgba(255,255,255,0.65)',
                  background: 'rgba(255,255,255,0.1)', padding: '2px 8px', borderRadius: 100,
                }}>
                  {t(`filters.focus.${f}`, { defaultValue: FOCUS_LABELS[f] })}
                </span>
              ))}
            </div>

            {/* Seek bar (visible when playing) */}
            {playing && (
              <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                <button onClick={e => { e.stopPropagation(); togglePlay() }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fff', padding: 0, flexShrink: 0 }}>
                  <Pause size={16} />
                </button>
                <div onClick={handleSeek} style={{ flex: 1, height: 3, background: 'rgba(255,255,255,0.25)', borderRadius: 2, cursor: 'pointer' }}>
                  <div style={{ width: `${progress * 100}%`, height: '100%', background: 'var(--accent)', borderRadius: 2 }} />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Scrollable body ── */}
        <div style={{ flex: 1, overflowY: 'auto', overscrollBehavior: 'contain' }}>

          {/* Tips */}
          {ex.tips?.length > 0 && (
            <div style={{ padding: '14px 16px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
                <Lightbulb size={15} color="var(--accent)" />
                <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  {t('exercises.coaching_tips')}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                {ex.tips.map((tip, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <div style={{
                      width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                      background: 'rgba(232,255,0,0.1)', border: '1px solid rgba(232,255,0,0.25)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.65rem', fontWeight: 800, color: 'var(--accent)',
                    }}>
                      {i + 1}
                    </div>
                    <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text2)', lineHeight: 1.5 }}>{tip}</p>
                  </div>
                ))}
              </div>
              <div style={{ height: 1, background: 'var(--border)', marginBottom: 14 }} />
            </div>
          )}

          {/* Sets / Reps / Weight / Rest */}
          <div style={{ padding: '0 16px 16px' }}>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{t('exercises.sets')}</div>
              <Stepper value={sets} onChange={setSets} onTap={openSetsKeyboard} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{t('exercises.reps')}</div>
              <Stepper value={reps} onChange={setReps} onTap={openRepsKeyboard} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{t('exercises.weight')}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  readOnly
                  value={weight}
                  placeholder="–"
                  onFocus={e => { e.target.blur(); openWeightKeyboard() }}
                  onPointerDown={e => { e.preventDefault(); openWeightKeyboard() }}
                  style={{
                    width: 80, textAlign: 'center', padding: '6px 10px',
                    fontFamily: "'JetBrains Mono', monospace", fontWeight: 600,
                    cursor: 'pointer',
                  }}
                />
                <span style={{ color: 'var(--text3)', fontSize: '0.85rem', minWidth: 20 }}>{weightUnit}</span>
              </div>
            </div>

            <div>
              <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: 10 }}>{t('exercises.rest')}</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {REST_CHIPS.map(chip => (
                  <button
                    key={chip.v}
                    onPointerDown={e => { e.stopPropagation(); setRest(chip.v) }}
                    style={{
                      padding: '6px 14px', borderRadius: 100,
                      fontSize: '0.82rem', fontWeight: 600,
                      border: `1px solid ${rest === chip.v ? 'var(--accent)' : 'var(--border2)'}`,
                      background: rest === chip.v ? 'var(--accent)' : 'var(--surface2)',
                      color: rest === chip.v ? '#0a0a0a' : 'var(--text)',
                      cursor: 'pointer', transition: 'all 0.12s',
                    }}>
                    {chip.l}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Fixed footer with safe-area padding ── */}
        <div style={{
          flexShrink: 0,
          padding: '12px 16px',
          paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
          borderTop: '1px solid rgba(255,255,255,0.07)',
          background: '#111111',
          display: 'flex', gap: 10,
        }}>
          <button
            className="btn btn-ghost"
            style={{ flex: 1 }}
            onPointerDown={e => { e.stopPropagation(); onClose() }}
            disabled={saving}>
            {t('exercises.cancel')}
          </button>
          <button
            className="btn btn-primary"
            style={{ flex: 2, opacity: done ? 0.7 : 1 }}
            onPointerDown={e => { e.stopPropagation(); if (!saving && !done) handleAdd() }}
            disabled={saving || done}>
            {done ? t('exercises.added') : saving ? t('exercises.adding') : t('exercises.add_to_day', { day: dayName })}
          </button>
        </div>
      </div>
    </>,
    document.body
  )
}

const PAGE_SIZE = 10

/* ── Pagination ────────────────────────────────── */
function Pagination({ page, pageCount, onPage }) {
  if (pageCount <= 1) return null

  function buildPages() {
    if (pageCount <= 9) return Array.from({ length: pageCount }, (_, i) => i + 1)
    const first2 = [1, 2]
    const last2  = [pageCount - 1, pageCount]
    const mid    = []
    for (let i = Math.max(3, page - 1); i <= Math.min(pageCount - 2, page + 1); i++) mid.push(i)
    const out = [...first2]
    if (mid[0] > 3) out.push('…')
    mid.forEach(p => { if (!out.includes(p)) out.push(p) })
    if (mid[mid.length - 1] < pageCount - 2) out.push('…')
    last2.forEach(p => { if (!out.includes(p)) out.push(p) })
    return out
  }

  const btnBase = {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 36, height: 36, borderRadius: 8,
    border: '1px solid var(--border2)',
    background: 'var(--surface2)',
    color: 'var(--text2)',
    fontFamily: "'DM Sans', sans-serif",
    fontWeight: 600, fontSize: '0.85rem',
    cursor: 'pointer', transition: 'all 0.12s',
    flexShrink: 0,
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '16px 0 4px' }}>
      <button
        onClick={() => onPage(page - 1)}
        disabled={page === 1}
        style={{ ...btnBase, opacity: page === 1 ? 0.3 : 1, pointerEvents: page === 1 ? 'none' : 'auto' }}
      >
        ‹
      </button>

      {buildPages().map((p, i) =>
        p === '…'
          ? <span key={`e${i}`} style={{ width: 28, textAlign: 'center', color: 'var(--text3)', fontSize: '0.85rem' }}>…</span>
          : <button
              key={p}
              onClick={() => onPage(p)}
              style={{
                ...btnBase,
                background: p === page ? 'var(--accent)' : 'var(--surface2)',
                color: p === page ? '#0a0a0a' : 'var(--text2)',
                borderColor: p === page ? 'var(--accent)' : 'var(--border2)',
              }}
            >
              {p}
            </button>
      )}

      <button
        onClick={() => onPage(page + 1)}
        disabled={page === pageCount}
        style={{ ...btnBase, opacity: page === pageCount ? 0.3 : 1, pointerEvents: page === pageCount ? 'none' : 'auto' }}
      >
        ›
      </button>
    </div>
  )
}

/* ── Main Screen ───────────────────────────────── */
export default function ExerciseLibrary() {
  const nav      = useNavigate()
  const location = useLocation()
  const { t }    = useTranslation()

  const selectMode  = !!location.state?.selectForDay
  const dayName     = location.state?.dayName    ?? 'Day'
  const dayId       = location.state?.selectForDay ?? null
  const defaultRest = location.state?.defaultRest  ?? 60

  const [query, setQuery]         = useState('')
  const [selFocus, setSelFocus]   = useState([])
  const [selEquip, setSelEquip]   = useState([])
  const [selLevel, setSelLevel]   = useState([])
  const [showFilters, setShowFilters] = useState(false)
  const [sheetEx, setSheetEx]     = useState(null)
  const [page, setPage]           = useState(1)
  const pageRef                   = useRef(null)

  const { data: apiData, isLoading, isOnline } = useExercises({
    q: query, equipment: selEquip[0], focus: selFocus[0], level: selLevel[0],
  })

  const localResults = useMemo(
    () => filterExercises({ query, focus: selFocus, equipment: selEquip, level: selLevel }),
    [query, selFocus, selEquip, selLevel]
  )
  const results = localResults

  // Reset to page 1 whenever filters or search change
  useEffect(() => { setPage(1) }, [query, selFocus, selEquip, selLevel])

  const totalCount = results.length
  const pageCount  = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const pageResults = results.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function goToPage(p) {
    setPage(p)
    pageRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function toggle(arr, setArr, val) {
    setArr(arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val])
  }

  function handleExerciseTap(ex) {
    if (selectMode) setSheetEx(ex)
    else nav(`/exercises/${encodeURIComponent(ex.id)}`)
  }

  const activeFilterCount = selFocus.length + selEquip.length + selLevel.length

  return (
    <div className="page">

      {/* Select-mode banner */}
      {selectMode && (
        <div style={{
          background: 'rgba(232,255,0,0.07)', border: '1px solid rgba(232,255,0,0.25)',
          borderRadius: 12, padding: '10px 14px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 14,
        }}>
          <div>
            <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--accent)', marginBottom: 2 }}>
              {t('exercises.adding_to')}
            </div>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: '1rem' }}>
              {dayName}
            </div>
          </div>
          <button
            className="btn btn-ghost"
            style={{ padding: '6px 14px', fontSize: '0.8rem' }}
            onClick={() => nav(-1)}>
            {t('exercises.cancel')}
          </button>
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ margin: '0 0 2px' }}>
          {t('exercises.title')}<br />
          <span style={{ color: 'var(--accent)' }}>{t('exercises.title_accent')}</span>
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: 'var(--text3)', fontSize: '0.82rem' }}>
            {totalCount} {t('exercises.exercises').toLowerCase()}
            {pageCount > 1 && ` · ${t('exercises.page_of', { page, total: pageCount })}`}
          </span>
          {!isOnline && (
            <span style={{
              background: 'var(--surface2)', color: 'var(--text3)',
              fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.08em',
              padding: '2px 8px', borderRadius: 100, textTransform: 'uppercase',
            }}>
              {t('exercises.offline')}
            </span>
          )}
        </div>
      </div>

      {/* Search + Filter row */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={15} style={{
            position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
            color: 'var(--text3)', pointerEvents: 'none',
          }} />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={t('exercises.search_placeholder')}
            style={{ paddingLeft: 36, paddingRight: query ? 36 : 14 }}
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              style={{
                position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 4,
                display: 'flex', alignItems: 'center',
              }}>
              <X size={14} />
            </button>
          )}
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '0 14px', borderRadius: 8, border: '1px solid var(--border2)',
            background: activeFilterCount > 0 ? 'rgba(232,255,0,0.08)' : 'var(--surface2)',
            borderColor: activeFilterCount > 0 ? 'rgba(232,255,0,0.35)' : 'var(--border2)',
            cursor: 'pointer', color: activeFilterCount > 0 ? 'var(--accent)' : 'var(--text2)',
            fontSize: '0.85rem', fontWeight: 600, flexShrink: 0, height: 42,
            transition: 'all 0.15s',
          }}>
          <SlidersHorizontal size={16} />
          {activeFilterCount > 0 && (
            <span style={{
              background: 'var(--accent)', color: '#0a0a0a',
              borderRadius: '50%', width: 16, height: 16,
              fontSize: '0.65rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800,
            }}>
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 12, padding: '14px 16px', marginBottom: 14,
          animation: 'fadeSlideUp 0.18s ease',
        }}>
          {/* Focus */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
              {t('exercises.focus_area')}
            </div>
            <div className="chip-row" style={{ flexWrap: 'wrap', height: 'auto' }}>
              {FOCUSES.map(f => (
                <div key={f} className={`chip${selFocus.includes(f) ? ' active' : ''}`} onClick={() => toggle(selFocus, setSelFocus, f)}>
                  {t(`filters.focus.${f}`, { defaultValue: FOCUS_LABELS[f] })}
                </div>
              ))}
            </div>
          </div>

          {/* Level */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
              {t('exercises.level')}
            </div>
            <div className="chip-row" style={{ flexWrap: 'wrap', height: 'auto' }}>
              {LEVELS.map(l => (
                <div key={l} className={`chip${selLevel.includes(l) ? ' active' : ''}`} onClick={() => toggle(selLevel, setSelLevel, l)}>
                  {t(`filters.level.${l}`, { defaultValue: LEVEL_LABELS[l] })}
                </div>
              ))}
            </div>
          </div>

          {/* Equipment */}
          <div>
            <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
              {t('exercises.equipment')}
            </div>
            <div className="chip-row" style={{ flexWrap: 'wrap', height: 'auto' }}>
              {EQUIPMENTS.map(e => (
                <div key={e} className={`chip${selEquip.includes(e) ? ' active' : ''}`} onClick={() => toggle(selEquip, setSelEquip, e)}>
                  {t(`filters.equipment.${e}`, { defaultValue: EQUIPMENT_LABELS[e] })}
                </div>
              ))}
            </div>
          </div>

          {activeFilterCount > 0 && (
            <button className="btn btn-ghost" style={{ width: '100%', marginTop: 12 }}
              onClick={() => { setSelFocus([]); setSelEquip([]); setSelLevel([]) }}>
              {t('exercises.clear_all_filters')}
            </button>
          )}
        </div>
      )}

      {/* Loading */}
      {isOnline && isLoading && (
        <div style={{ textAlign: 'center', padding: '12px 0', color: 'var(--text3)', fontSize: '0.8rem' }}>
          {t('exercises.loading')}
        </div>
      )}

      {/* Results */}
      <div ref={pageRef}>
        {pageResults.map((ex, i) => (
          <ExCard key={ex.id} ex={ex} index={i} onClick={handleExerciseTap} />
        ))}
        {totalCount === 0 && !isLoading && (
          <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text3)' }}>
            <div style={{ fontSize: '2rem', marginBottom: 8, opacity: 0.4 }}>🔍</div>
            {t('exercises.no_results')}
          </div>
        )}
      </div>

      <Pagination page={page} pageCount={pageCount} onPage={goToPage} />

      {/* Config sheet (portal — renders to body, not clipped by page container) */}
      {sheetEx && (
        <ConfigSheet
          ex={sheetEx}
          dayName={dayName}
          dayId={dayId}
          defaultRest={defaultRest}
          onClose={() => setSheetEx(null)}
          onAdded={() => nav(-1)}
        />
      )}
    </div>
  )
}
