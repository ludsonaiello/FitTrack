import { useState, useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useLocation } from 'react-router-dom'
import { Plus, ChevronDown, ChevronUp, Trash2, Play, Pause, Edit2, Check, X, Lightbulb, ArrowRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  db, createPlan, getPlanWithDays, getActivePlan, addExerciseToDay, startSession,
  syncServerPlans, getAllPlans, setActivePlan as dbSetActivePlan, deletePlan as dbDeletePlan, renamePlan,
} from '../db/index.js'
import { api, NetworkError } from '../lib/api.js'
import { getExerciseById, exImageUrl, exVideoUrl, EQUIPMENT_LABELS, FOCUS_LABELS, LEVEL_LABELS } from '../lib/exercises.js'
import ConfirmModal from '../components/ConfirmModal.jsx'
import { useWeightUnit, toDisplay, toKg } from '../hooks/useWeightUnit.js'
import { useNumericKeyboard } from '../context/NumericKeyboardContext.jsx'
import { useToast } from '../context/ToastContext.jsx'

// Day names derived from locale at runtime — no hardcoded strings
// Jan 5 2025 = Sunday, so +0..+6 covers Sun→Sat
function getDayNames(locale) {
  return Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(new Date(2025, 0, 5 + i))
  )
}
function getDayShort(locale) {
  return Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(new Date(2025, 0, 5 + i))
  )
}

const REST_OPTIONS = [
  { label: '30s', value: 30 },
  { label: '45s', value: 45 },
  { label: '60s', value: 60 },
  { label: '90s', value: 90 },
  { label: '2min', value: 120 },
  { label: '3min', value: 180 },
]

const TEMPLATES = [
  {
    name: 'Push / Pull / Legs',
    days: [
      { name: 'Push Day', dow: 1 }, { name: 'Pull Day', dow: 2 }, { name: 'Leg Day', dow: 3 },
      { name: 'Rest', dow: 4 }, { name: 'Push Day', dow: 5 }, { name: 'Pull Day', dow: 6 },
    ],
  },
  {
    name: 'Full Body 3×',
    days: [
      { name: 'Full Body', dow: 1 }, { name: 'Rest', dow: 2 }, { name: 'Full Body', dow: 3 },
      { name: 'Rest', dow: 4 }, { name: 'Full Body', dow: 5 },
    ],
  },
  {
    name: 'Upper / Lower',
    days: [
      { name: 'Upper Body', dow: 1 }, { name: 'Lower Body', dow: 2 }, { name: 'Rest', dow: 3 },
      { name: 'Upper Body', dow: 4 }, { name: 'Lower Body', dow: 5 },
    ],
  },
]

function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

// ── Exercise Config Sheet ─────────────────────────────────────────────────────

function ExerciseConfigSheet({ tutorialId, initial, onConfirm, onCancel, confirmLabel }) {
  const { t } = useTranslation()
  const info = getExerciseById(tutorialId)
  const [unit] = useWeightUnit()
  const keyboard = useNumericKeyboard()
  const isMobile = useMemo(() => window.matchMedia('(pointer: coarse)').matches, [])
  const [sets, setSets] = useState(initial?.sets ?? 3)
  const [reps, setReps] = useState(initial?.reps ?? 10)
  const [weight, setWeight] = useState(initial?.weight != null ? String(toDisplay(initial.weight, unit)) : '')
  const [rest, setRest] = useState(initial?.rest ?? 60)

  const sheet = (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'flex-end', zIndex: 400,
    }}>
      <div style={{
        background: 'var(--surface)', borderRadius: '16px 16px 0 0',
        padding: 20, width: '100%', maxWidth: 480, margin: '0 auto',
      }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
          {info && (
            <img src={exImageUrl(info.id)} alt="" style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover' }} />
          )}
          <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: '1.1rem' }}>
            {info?.name ?? tutorialId}
          </div>
        </div>

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <span style={{ fontWeight: 600 }}>{t('planner.sets_label')}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <button className="btn btn-ghost" style={{ padding: '4px 12px' }} onClick={() => setSets(s => Math.max(1, s - 1))}>−</button>
              <span style={{ fontFamily: 'Barlow Condensed', fontSize: '1.3rem', fontWeight: 700, minWidth: 24, textAlign: 'center' }}>{sets}</span>
              <button className="btn btn-ghost" style={{ padding: '4px 12px' }} onClick={() => setSets(s => s + 1)}>+</button>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <span style={{ fontWeight: 600 }}>{t('planner.reps_label')}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <button className="btn btn-ghost" style={{ padding: '4px 12px' }} onClick={() => setReps(r => Math.max(1, r - 1))}>−</button>
              <span style={{ fontFamily: 'Barlow Condensed', fontSize: '1.3rem', fontWeight: 700, minWidth: 24, textAlign: 'center' }}>{reps}</span>
              <button className="btn btn-ghost" style={{ padding: '4px 12px' }} onClick={() => setReps(r => r + 1)}>+</button>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <span style={{ fontWeight: 600 }}>{t('exercises.weight')} <span style={{ color: 'var(--text3)', fontWeight: 400, fontSize: '0.8rem' }}>{t('exercises.weight_optional')}</span></span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type={isMobile ? 'text' : 'number'}
                inputMode={isMobile ? 'none' : undefined}
                readOnly={isMobile || undefined}
                value={weight}
                placeholder="—"
                style={{ width: 72, textAlign: 'center' }}
                min={!isMobile ? 0 : undefined}
                step={!isMobile ? (unit === 'lbs' ? 1 : 0.5) : undefined}
                onChange={isMobile ? undefined : e => setWeight(e.target.value)}
                onFocus={() => {
                  if (!isMobile) return
                  keyboard.open({
                    label: `Target weight (${unit})`,
                    value: weight,
                    onChange: v => setWeight(v),
                    isLastField: true,
                    onDone: () => keyboard.close(),
                  })
                }}
              />
              <span style={{ color: 'var(--text3)', fontSize: '0.85rem' }}>{unit}</span>
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>{t('exercises.rest')}</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {REST_OPTIONS.map(o => (
                <button key={o.value} onClick={() => setRest(o.value)} style={{
                  padding: '6px 12px', borderRadius: 20, border: '1px solid var(--border)',
                  background: rest === o.value ? 'var(--accent)' : 'var(--surface2)',
                  color: rest === o.value ? '#000' : 'var(--text)',
                  fontWeight: rest === o.value ? 700 : 400,
                  cursor: 'pointer', fontSize: '0.85rem',
                }}>{o.label}</button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onCancel}>{t('planner.cancel')}</button>
            <button className="btn btn-primary" style={{ flex: 2 }}
              onClick={() => onConfirm({ sets, reps, weight: toKg(weight, unit), rest })}>
              {confirmLabel ?? t('planner.add_to_plan')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  return createPortal(sheet, document.body)
}

// ── Wizard ────────────────────────────────────────────────────────────────────

function CreateWizard({ onDone, onCancel }) {
  const { t, i18n } = useTranslation()
  const dayNames = getDayNames(i18n.language)
  const dayShort = getDayShort(i18n.language)
  const [step, setStep] = useState(1)
  const [name, setName] = useState('')
  const [trainingDays, setTrainingDays] = useState(new Set([1, 2, 3, 4, 5]))
  const [dayConfigs, setDayConfigs] = useState(() => {
    const names = getDayNames(navigator.language || 'en')
    const cfg = {}
    for (let i = 0; i < 7; i++) cfg[i] = { name: names[i], rest: 60 }
    return cfg
  })

  function toggleDay(dow) {
    setTrainingDays(prev => {
      const next = new Set(prev)
      if (next.has(dow)) next.delete(dow)
      else next.add(dow)
      return next
    })
  }

  function updateDayConfig(dow, field, value) {
    setDayConfigs(prev => ({ ...prev, [dow]: { ...prev[dow], [field]: value } }))
  }

  async function handleFinish() {
    const planId = await createPlan(name)
    for (let i = 0; i < 7; i++) {
      await db.planDays.add({
        planId, dayOfWeek: i,
        name: trainingDays.has(i) ? dayConfigs[i].name : 'Rest',
        restSeconds: dayConfigs[i].rest,
        order: i,
      })
    }
    onDone(planId)
  }

  if (step === 1) {
    return (
      <div>
        <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: '1.2rem', marginBottom: 16, color: 'var(--text)' }}>
          {t('planner.step1_title')}
        </div>
        <input value={name} onChange={e => setName(e.target.value)}
          placeholder={t('planner.plan_name_placeholder')} style={{ marginBottom: 16 }}
          onKeyDown={e => e.key === 'Enter' && name && setStep(2)} autoFocus />
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onCancel}>{t('planner.cancel')}</button>
          <button className="btn btn-primary" style={{ flex: 2 }} disabled={!name} onClick={() => setStep(2)}>
            {t('planner.next_arrow')}
          </button>
        </div>
      </div>
    )
  }

  if (step === 2) {
    return (
      <div>
        <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: '1.2rem', marginBottom: 4, color: 'var(--text)' }}>
          {t('planner.step2_title')}
        </div>
        <div style={{ color: 'var(--text3)', fontSize: '0.85rem', marginBottom: 16 }}>
          {t('planner.step2_sub')}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
          {dayShort.map((d, i) => (
            <button key={i} onClick={() => toggleDay(i)} style={{
              padding: '8px 14px', borderRadius: 20, border: '1px solid var(--border)',
              background: trainingDays.has(i) ? 'var(--accent)' : 'var(--surface2)',
              color: trainingDays.has(i) ? '#000' : 'var(--text)',
              fontWeight: trainingDays.has(i) ? 700 : 400, cursor: 'pointer',
            }}>{d}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setStep(1)}>{t('planner.back_arrow')}</button>
          <button className="btn btn-primary" style={{ flex: 2 }} disabled={trainingDays.size === 0} onClick={() => setStep(3)}>
            {t('planner.next_arrow')}
          </button>
        </div>
      </div>
    )
  }

  const trainingDowList = [...trainingDays].sort((a, b) => a - b)
  return (
    <div>
      <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: '1.2rem', marginBottom: 4, color: 'var(--text)' }}>
        {t('planner.step3_title')}
      </div>
      <div style={{ color: 'var(--text3)', fontSize: '0.85rem', marginBottom: 16 }}>
        {t('planner.step3_sub')}
      </div>
      {trainingDowList.map(dow => (
        <div key={dow} style={{ marginBottom: 16, padding: 12, background: 'var(--surface2)', borderRadius: 10 }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
            {dayNames[dow]}
          </div>
          <input value={dayConfigs[dow].name} onChange={e => updateDayConfig(dow, 'name', e.target.value)} style={{ marginBottom: 10 }} />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {REST_OPTIONS.map(o => (
              <button key={o.value} onClick={() => updateDayConfig(dow, 'rest', o.value)} style={{
                padding: '5px 10px', borderRadius: 16, border: '1px solid var(--border)',
                background: dayConfigs[dow].rest === o.value ? 'var(--accent)' : 'var(--surface)',
                color: dayConfigs[dow].rest === o.value ? '#000' : 'var(--text)',
                fontWeight: dayConfigs[dow].rest === o.value ? 700 : 400,
                cursor: 'pointer', fontSize: '0.8rem',
              }}>{o.label}</button>
            ))}
          </div>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
        <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setStep(2)}>{t('planner.back_arrow')}</button>
        <button className="btn btn-primary" style={{ flex: 2 }} onClick={handleFinish}>
          <Check size={16} /> {t('planner.create_plan')}
        </button>
      </div>
    </div>
  )
}

// ── Inline Edit Form ──────────────────────────────────────────────────────────

function InlineEditForm({ ex, onSave, onCancel }) {
  const { t } = useTranslation()
  const [unit] = useWeightUnit()
  const [sets, setSets] = useState(ex.targetSets ?? 3)
  const [reps, setReps] = useState(ex.targetReps ?? 10)
  const [weight, setWeight] = useState(ex.targetWeight != null ? String(toDisplay(ex.targetWeight, unit)) : '')
  const [rest, setRest] = useState(ex.restSeconds ?? 60)

  return (
    <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: 12, marginBottom: 4 }}>
      <div style={{ display: 'flex', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text3)' }}>{t('planner.sets_label')}</span>
          <button className="btn btn-ghost" style={{ padding: '2px 8px' }} onClick={() => setSets(s => Math.max(1, s - 1))}>−</button>
          <span style={{ fontFamily: 'Barlow Condensed', fontWeight: 700 }}>{sets}</span>
          <button className="btn btn-ghost" style={{ padding: '2px 8px' }} onClick={() => setSets(s => s + 1)}>+</button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text3)' }}>{t('planner.reps_label')}</span>
          <button className="btn btn-ghost" style={{ padding: '2px 8px' }} onClick={() => setReps(r => Math.max(1, r - 1))}>−</button>
          <span style={{ fontFamily: 'Barlow Condensed', fontWeight: 700 }}>{reps}</span>
          <button className="btn btn-ghost" style={{ padding: '2px 8px' }} onClick={() => setReps(r => r + 1)}>+</button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text3)' }}>{unit}</span>
          <input type="number" value={weight} onChange={e => setWeight(e.target.value)}
            placeholder="—" style={{ width: 60, textAlign: 'center', padding: '4px 8px', fontSize: '0.9rem' }}
            min={0} step={unit === 'lbs' ? 1 : 0.5} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 10 }}>
        {REST_OPTIONS.map(o => (
          <button key={o.value} onClick={() => setRest(o.value)} style={{
            padding: '4px 9px', borderRadius: 14, border: '1px solid var(--border)',
            background: rest === o.value ? 'var(--accent)' : 'var(--surface)',
            color: rest === o.value ? '#000' : 'var(--text)',
            fontWeight: rest === o.value ? 700 : 400,
            cursor: 'pointer', fontSize: '0.78rem',
          }}>{o.label}</button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-ghost" style={{ flex: 1, padding: '6px' }} onClick={onCancel}>
          <X size={14} /> {t('planner.cancel')}
        </button>
        <button className="btn btn-primary" style={{ flex: 2, padding: '6px' }}
          onClick={() => onSave({ sets, reps, weight: toKg(weight, unit), rest })}>
          <Check size={14} /> {t('planner.save')}
        </button>
      </div>
    </div>
  )
}

const LEVEL_COLORS = {
  beginner:     { text: '#4ade80', bg: 'rgba(74,222,128,0.12)' },
  intermediate: { text: '#fbbf24', bg: 'rgba(251,191,36,0.12)' },
  advanced:     { text: '#f87171', bg: 'rgba(248,113,113,0.12)' },
}

// ── Exercise Detail Modal (portal) ────────────────────────────────────────────

function ExerciseDetailModal({ ex, onClose, onNavigate }) {
  const { t } = useTranslation()
  const videoRef = useRef(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)

  const lvl = LEVEL_COLORS[ex.experienceLevel?.toLowerCase()] ?? LEVEL_COLORS.beginner

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

      {/* Sheet */}
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

        {/* Video player */}
        <div style={{ position: 'relative', height: 200, background: '#000', flexShrink: 0, overflow: 'hidden' }}>
          <video
            ref={videoRef}
            src={exVideoUrl(ex.id)}
            poster={exImageUrl(ex.id)}
            playsInline loop
            onTimeUpdate={() => {
              const v = videoRef.current
              if (v && v.duration) setProgress(v.currentTime / v.duration)
            }}
            onEnded={() => setPlaying(false)}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />

          {/* Gradient */}
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            background: playing
              ? 'linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0) 50%, rgba(0,0,0,0.7) 100%)'
              : 'linear-gradient(to bottom, rgba(10,10,10,0.4) 0%, rgba(10,10,10,0.8) 100%)',
          }} />

          {/* Close */}
          <button
            onPointerDown={e => { e.preventDefault(); onClose() }}
            style={{
              position: 'absolute', top: 10, right: 10, zIndex: 10,
              background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 8, padding: 6, cursor: 'pointer', color: '#fff',
              display: 'flex', alignItems: 'center',
            }}
          >
            <X size={16} />
          </button>

          {/* Tap to play */}
          <button onClick={togglePlay} style={{
            position: 'absolute', inset: 0, background: 'none', border: 'none',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 5,
          }}>
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

          {/* Name + badges + seekbar at bottom */}
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
                {LEVEL_LABELS[ex.experienceLevel]}
              </span>
              {ex.focusArea?.slice(0, 2).map(f => (
                <span key={f} style={{
                  fontSize: '0.65rem', color: 'rgba(255,255,255,0.65)',
                  background: 'rgba(255,255,255,0.1)', padding: '2px 8px', borderRadius: 100,
                }}>
                  {FOCUS_LABELS[f]}
                </span>
              ))}
            </div>
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

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: 'auto', overscrollBehavior: 'contain', padding: '14px 16px' }}>

          {/* Equipment */}
          {ex.equipment?.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
                {t('exercises.equipment_needed')}
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {ex.equipment.map(e => (
                  <span key={e} style={{
                    background: 'var(--surface2)', border: '1px solid var(--border2)',
                    fontSize: '0.82rem', padding: '4px 10px', borderRadius: 8, color: 'var(--text)',
                  }}>
                    {EQUIPMENT_LABELS[e] || e}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Tips */}
          {ex.tips?.length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
                <Lightbulb size={14} color="var(--accent)" />
                <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  {t('exercises.coaching_tips')}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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
            </div>
          )}
        </div>

        {/* Footer — "View full details" button */}
        <div style={{
          flexShrink: 0, padding: '12px 16px',
          paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
          borderTop: '1px solid rgba(255,255,255,0.07)',
          background: '#111111',
        }}>
          <button
            className="btn btn-ghost"
            style={{ width: '100%', justifyContent: 'space-between' }}
            onClick={() => onNavigate(ex.id)}
          >
            <span>{t('exercises.view_full_details')}</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </>,
    document.body
  )
}

// ── Day Row ───────────────────────────────────────────────────────────────────

function DayRow({ day, isActive, expandedDays, onToggle, onStartDay, onAddExercise, onEditEx, onRemoveEx, onRemoveDay, editingEx, onSaveEdit, onCancelEdit, onExerciseClick }) {
  const { t, i18n } = useTranslation()
  const dayShort = getDayShort(i18n.language)
  const isRest = day.name === 'Rest'
  const isExpanded = expandedDays[day.id]
  const exCount = day.exercises?.length ?? 0

  if (isRest) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 0', opacity: 0.45,
        borderBottom: '1px solid var(--border2)',
      }}>
        <span style={{
          fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '0.1em', color: 'var(--text3)', minWidth: 32,
        }}>
          {dayShort[day.dayOfWeek]}
        </span>
        <span style={{ fontFamily: 'DM Sans', fontSize: '0.9rem', color: 'var(--text3)', flex: 1 }}>Rest</span>
      </div>
    )
  }

  return (
    <div style={{ borderBottom: '1px solid var(--border2)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0' }}>
        <span style={{
          fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '0.1em', color: isActive ? 'var(--accent)' : 'var(--text3)',
          minWidth: 32,
        }}>
          {dayShort[day.dayOfWeek]}
        </span>

        <div style={{ flex: 1, minWidth: 0 }}>
          {isActive ? (
            <input
              value={day.name}
              onChange={e => {
                if (typeof onAddExercise === 'function') {
                  // trigger name change via parent — handled outside DayRow for active plan
                }
              }}
              style={{
                background: 'none', border: 'none', padding: 0,
                fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: '1rem',
                color: 'var(--text)', width: '100%',
              }}
              readOnly
            />
          ) : (
            <span style={{ fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: '1rem', color: 'var(--text)' }}>
              {day.name}
            </span>
          )}
        </div>

        <span style={{
          fontSize: '0.72rem', fontWeight: 700, padding: '2px 7px',
          background: 'var(--surface2)', borderRadius: 10,
          color: exCount > 0 ? 'var(--accent)' : 'var(--text3)',
          fontFamily: 'JetBrains Mono',
        }}>
          {exCount}
        </span>

        {exCount > 0 && isActive && onStartDay && (
          <button className="btn btn-primary" style={{ padding: '6px 12px' }} onClick={() => onStartDay(day)}>
            <Play size={14} />
          </button>
        )}

        {isActive && onRemoveDay && (
          <button
            onClick={() => onRemoveDay(day)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 4, display: 'flex', alignItems: 'center' }}
            title={t('planner.remove_day_title')}
          >
            <Trash2 size={15} />
          </button>
        )}

        <button
          onClick={() => onToggle(day.id)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 4 }}
        >
          {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
      </div>

      {isExpanded && (
        <div style={{ paddingBottom: 10 }}>
          {day.exercises?.map(ex => {
            const info = getExerciseById(ex.tutorialId)
            const isEditing = editingEx?.ex?.id === ex.id
            return (
              <div key={ex.id}>
                <div style={{
                  display: 'flex', gap: 10, alignItems: 'center',
                  padding: '8px 0', borderBottom: '1px solid var(--border)',
                }}>
                  <button
                    onClick={() => info && onExerciseClick?.(info)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      flex: 1, minWidth: 0, background: 'none', border: 'none',
                      cursor: info ? 'pointer' : 'default', padding: 0, textAlign: 'left',
                      WebkitTapHighlightColor: 'transparent',
                    }}
                  >
                    {info && (
                      <img
                        src={exImageUrl(info.id)}
                        style={{ width: 36, height: 36, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }}
                        alt=""
                      />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: '0.95rem',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text)',
                      }}>
                        {info?.name ?? ex.tutorialId}
                      </div>
                      <div style={{ fontFamily: 'JetBrains Mono', fontSize: '0.82rem', color: 'var(--text3)' }}>
                        {ex.targetSets}×{ex.targetReps}
                        {ex.restSeconds ? ` · ${t('planner.rest_seconds', { seconds: ex.restSeconds })}` : ''}
                      </div>
                    </div>
                  </button>
                  {isActive && onEditEx && (
                    <button
                      onClick={() => onEditEx(isEditing ? null : { ex, dayId: day.id })}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: isEditing ? 'var(--accent)' : 'var(--text3)', padding: 4 }}
                    >
                      <Edit2 size={15} />
                    </button>
                  )}
                  {isActive && onRemoveEx && (
                    <button
                      onClick={() => onRemoveEx(ex.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 4 }}
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
                {isEditing && isActive && (
                  <InlineEditForm
                    ex={ex}
                    onSave={opts => onSaveEdit(ex.id, opts)}
                    onCancel={onCancelEdit}
                  />
                )}
              </div>
            )
          })}

          {isActive && onAddExercise && (
            <button
              className="btn btn-ghost"
              style={{ width: '100%', marginTop: 8, fontSize: '0.85rem' }}
              onClick={() => onAddExercise(day)}
            >
              <Plus size={16} /> {t('planner.add_exercise')}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Create Sheet (portal) ─────────────────────────────────────────────────────

function CreateSheet({ onClose, onWizardDone, onTemplate }) {
  const { t } = useTranslation()
  const [wizardActive, setWizardActive] = useState(false)

  const sheet = (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'flex-end', zIndex: 300,
    }}>
      <div style={{
        background: 'var(--surface)', borderRadius: '16px 16px 0 0',
        padding: 24, width: '100%', maxWidth: 480, margin: '0 auto',
        maxHeight: '80dvh', overflowY: 'auto',
        animation: 'sheetIn 0.28s ease',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <span style={{ fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: '1.2rem' }}>
            {wizardActive ? t('planner.create_custom_plan') : t('planner.new_plan')}
          </span>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 4 }}
          >
            <X size={20} />
          </button>
        </div>

        {wizardActive ? (
          <CreateWizard
            onDone={planId => { onWizardDone(planId); onClose() }}
            onCancel={() => setWizardActive(false)}
          />
        ) : (
          <>
            <button
              className="btn btn-primary"
              style={{ width: '100%', marginBottom: 20, padding: '14px 16px', fontSize: '1rem', justifyContent: 'center' }}
              onClick={() => setWizardActive(true)}
            >
              <Plus size={18} /> {t('planner.from_scratch')}
            </button>

            <div style={{
              fontSize: '0.7rem', fontWeight: 700, color: 'var(--text3)',
              textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12,
            }}>
              {t('planner.or_use_template')}
            </div>

            {TEMPLATES.map(tpl => (
              <button
                key={tpl.name}
                className="btn btn-ghost"
                style={{ width: '100%', marginBottom: 10, justifyContent: 'flex-start', padding: '12px 16px' }}
                onClick={() => { onTemplate(tpl); onClose() }}
              >
                <div>
                  <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: '1rem' }}>{tpl.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text3)', marginTop: 2 }}>
                    {tpl.days.filter(d => d.name !== 'Rest').length} {t('planner.training_days_count')}
                  </div>
                </div>
              </button>
            ))}
          </>
        )}
      </div>
    </div>
  )

  return createPortal(sheet, document.body)
}

// ── Add Day Sheet ─────────────────────────────────────────────────────────────

function AddDaySheet({ plan, onConfirm, onClose }) {
  const { t, i18n } = useTranslation()
  const dayNames = getDayNames(i18n.language)

  // Days already in the plan
  const usedDows = new Set((plan?.days ?? []).map(d => d.dayOfWeek))
  const availableDows = [0, 1, 2, 3, 4, 5, 6].filter(d => !usedDows.has(d))

  const [selectedDow, setSelectedDow] = useState(availableDows[0] ?? 0)
  const [name, setName] = useState('')
  const [rest, setRest] = useState(60)

  const canAdd = name.trim().length > 0

  function handleSubmit() {
    if (!canAdd) return
    onConfirm({ dayOfWeek: selectedDow, name: name.trim(), restSeconds: rest })
  }

  return createPortal(
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: '1.1rem' }}>
            {t('planner.add_day')}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 4 }}>
            <X size={20} />
          </button>
        </div>

        {/* Day name */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text3)', marginBottom: 6 }}>
            {t('planner.day_name_label')}
          </label>
          <input
            className="input"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder={t('planner.day_name_placeholder')}
            autoFocus
            style={{ width: '100%', boxSizing: 'border-box' }}
          />
        </div>

        {/* Day of week */}
        {availableDows.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text3)', marginBottom: 8 }}>
              {t('planner.day_of_week_label')}
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {availableDows.map(dow => (
                <button
                  key={dow}
                  onClick={() => setSelectedDow(dow)}
                  style={{
                    padding: '7px 14px', borderRadius: 100, border: '1px solid',
                    borderColor: selectedDow === dow ? 'var(--accent)' : 'var(--border)',
                    background: selectedDow === dow ? 'rgba(232,255,0,0.1)' : 'var(--surface2)',
                    color: selectedDow === dow ? 'var(--accent)' : 'var(--text2)',
                    fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer',
                    WebkitTapHighlightColor: 'transparent',
                  }}
                >
                  {dayNames[dow]}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Rest time */}
        <div style={{ marginBottom: 24 }}>
          <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text3)', marginBottom: 8 }}>
            {t('planner.rest_label')}
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {REST_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setRest(opt.value)}
                style={{
                  padding: '7px 14px', borderRadius: 100, border: '1px solid',
                  borderColor: rest === opt.value ? 'var(--accent)' : 'var(--border)',
                  background: rest === opt.value ? 'rgba(232,255,0,0.1)' : 'var(--surface2)',
                  color: rest === opt.value ? 'var(--accent)' : 'var(--text2)',
                  fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>{t('common.cancel')}</button>
          <button className="btn btn-primary" style={{ flex: 1 }} disabled={!canAdd} onClick={handleSubmit}>
            <Plus size={16} /> {t('planner.add_day')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ── GPT Planner Card (empty state) ───────────────────────────────────────────

const GPT_URL = 'https://chatgpt.com/g/g-69cbfbc4f7948191bb3efca20b21871b-fittrack-planner'

function GptHowItWorksSheet({ onClose }) {
  const { t } = useTranslation()
  const steps = [
    { n: 1, title: t('planner.gpt_how_step1_title'), desc: t('planner.gpt_how_step1_desc') },
    { n: 2, title: t('planner.gpt_how_step2_title'), desc: t('planner.gpt_how_step2_desc') },
    { n: 3, title: t('planner.gpt_how_step3_title'), desc: t('planner.gpt_how_step3_desc') },
    { n: 4, title: t('planner.gpt_how_step4_title'), desc: t('planner.gpt_how_step4_desc') },
  ]
  return createPortal(
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()} style={{ maxHeight: '90dvh', overflowY: 'auto' }}>
        {/* Handle */}
        <div style={{ width: 36, height: 4, borderRadius: 99, background: 'var(--border2)', margin: '0 auto 20px' }} />

        {/* Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12, flexShrink: 0,
            background: 'linear-gradient(135deg, rgba(232,255,0,0.15) 0%, rgba(232,255,0,0.05) 100%)',
            border: '1px solid rgba(232,255,0,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.4rem',
          }}>🤖</div>
          <div>
            <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 800, fontSize: '1.25rem' }}>
              {t('planner.gpt_how_title')}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text3)' }}>FitTrack Planner GPT</div>
          </div>
        </div>

        {/* Steps */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0, marginBottom: 24 }}>
          {steps.map((s, i) => (
            <div key={s.n} style={{ display: 'flex', gap: 14, paddingBottom: i < steps.length - 1 ? 20 : 0 }}>
              {/* Step number + connector line */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: 'var(--accent)', color: '#0a0a0a',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'Barlow Condensed', fontWeight: 800, fontSize: '0.85rem',
                  flexShrink: 0,
                }}>{s.n}</div>
                {i < steps.length - 1 && (
                  <div style={{ width: 2, flex: 1, background: 'var(--border)', marginTop: 4 }} />
                )}
              </div>
              <div style={{ paddingTop: 4 }}>
                <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: '1rem', marginBottom: 4 }}>
                  {s.title}
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text3)', lineHeight: 1.6 }}>
                  {s.desc}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <a
          href={GPT_URL}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            width: '100%', padding: '14px 0', borderRadius: 12,
            background: 'var(--accent)', color: '#0a0a0a',
            fontFamily: 'Barlow Condensed', fontWeight: 800, fontSize: '1rem',
            letterSpacing: '0.05em', textDecoration: 'none', marginBottom: 10,
          }}
        >
          {t('planner.gpt_how_open')} <ArrowRight size={16} />
        </a>
        <button
          onClick={onClose}
          style={{
            width: '100%', padding: '13px 0', borderRadius: 12,
            background: 'transparent', border: '1px solid var(--border)',
            color: 'var(--text3)', fontFamily: 'Barlow Condensed',
            fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer',
          }}
        >
          {t('planner.gpt_how_close')}
        </button>
      </div>
    </div>,
    document.body,
  )
}

function GptPlannerCard({ onManual }) {
  const { t } = useTranslation()
  const [showHow, setShowHow] = useState(false)

  const steps = [
    t('planner.gpt_empty_step1'),
    t('planner.gpt_empty_step2'),
    t('planner.gpt_empty_step3'),
  ]

  return (
    <>
      <div style={{
        background: 'linear-gradient(160deg, rgba(232,255,0,0.07) 0%, rgba(232,255,0,0.02) 60%, transparent 100%)',
        border: '1px solid rgba(232,255,0,0.2)',
        borderRadius: 20, padding: '24px 20px 20px',
        marginBottom: 20,
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 16 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14, flexShrink: 0,
            background: 'linear-gradient(135deg, rgba(232,255,0,0.18) 0%, rgba(232,255,0,0.06) 100%)',
            border: '1px solid rgba(232,255,0,0.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.6rem',
            boxShadow: '0 0 20px rgba(232,255,0,0.1)',
          }}>🤖</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontFamily: 'Barlow Condensed', fontWeight: 900,
              fontSize: '1.35rem', lineHeight: 1.1, marginBottom: 6,
            }}>
              {t('planner.gpt_empty_title')}
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text3)', lineHeight: 1.55 }}>
              {t('planner.gpt_empty_desc')}
            </div>
          </div>
        </div>

        {/* Steps */}
        <div style={{
          background: 'rgba(0,0,0,0.25)', border: '1px solid var(--border)',
          borderRadius: 12, padding: '12px 14px', marginBottom: 18,
        }}>
          {steps.map((step, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              paddingBottom: i < steps.length - 1 ? 10 : 0,
              marginBottom: i < steps.length - 1 ? 10 : 0,
              borderBottom: i < steps.length - 1 ? '1px solid var(--border2)' : 'none',
            }}>
              <div style={{
                width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                background: 'var(--accent)', color: '#0a0a0a',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'Barlow Condensed', fontWeight: 800, fontSize: '0.75rem',
              }}>{i + 1}</div>
              <span style={{ fontSize: '0.83rem', color: 'var(--text2)', fontWeight: 500 }}>{step}</span>
            </div>
          ))}
        </div>

        {/* Primary CTA */}
        <a
          href={GPT_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => setShowHow(false)}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            width: '100%', padding: '14px 0', borderRadius: 12,
            background: 'var(--accent)', color: '#0a0a0a',
            fontFamily: 'Barlow Condensed', fontWeight: 800, fontSize: '1rem',
            letterSpacing: '0.05em', textDecoration: 'none',
            marginBottom: 10,
            boxShadow: '0 0 24px rgba(232,255,0,0.2)',
          }}
        >
          {t('planner.gpt_empty_cta')} <ArrowRight size={16} />
        </a>

        {/* How it works link */}
        <button
          onClick={() => setShowHow(true)}
          style={{
            width: '100%', padding: '10px 0', borderRadius: 12,
            background: 'transparent', border: '1px solid rgba(232,255,0,0.2)',
            color: 'rgba(232,255,0,0.7)',
            fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: '0.88rem',
            letterSpacing: '0.04em', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}
        >
          <Lightbulb size={14} /> {t('planner.gpt_how_title')}
        </button>
      </div>

      {/* Divider with "or" */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16,
      }}>
        <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        <span style={{ fontSize: '0.75rem', color: 'var(--text3)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          {t('planner.gpt_empty_or')}
        </span>
        <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
      </div>

      {/* Manual create button */}
      <button
        className="btn btn-ghost"
        style={{ width: '100%', gap: 8 }}
        onClick={onManual}
      >
        <Plus size={16} /> {t('planner.gpt_empty_manual')}
      </button>

      {showHow && <GptHowItWorksSheet onClose={() => setShowHow(false)} />}
    </>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function Planner() {
  const nav = useNavigate()
  const loc = useLocation()
  const { t, i18n } = useTranslation()
  const dayNames = getDayNames(i18n.language)
  const toast = useToast()

  const [plan, setPlan] = useState(null)
  const [allPlans, setAllPlans] = useState([])
  const [expandedDays, setExpandedDays] = useState({})
  const [switching, setSwitching] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [removeExTarget, setRemoveExTarget] = useState(null) // { id, name }
  const [removeDayTarget, setRemoveDayTarget] = useState(null) // { id, name, exCount }
  const [addDayOpen, setAddDayOpen] = useState(false)
  const [editingEx, setEditingEx] = useState(null)
  const [previewEx, setPreviewEx] = useState(null)
  const [sessionCount, setSessionCount] = useState(0)

  // Inline plan name editing
  const [editingName, setEditingName] = useState(false)
  const [draftName, setDraftName] = useState('')
  const nameInputRef = useRef(null)

  // Incoming exercise from ExerciseDetail "Add to Plan"
  const [incomingExercise, setIncomingExercise] = useState(loc.state?.addExercise ?? null)
  const [dayPickerOpen, setDayPickerOpen] = useState(false)  // opened after plan loads
  const [pendingDay, setPendingDay] = useState(null)
  // Ref so we only auto-open once after the plan finishes loading
  const pendingPickerRef = useRef(!!loc.state?.addExercise)

  // Create sheet
  const [createSheet, setCreateSheet] = useState(false)

  // Lazy plan details for inactive plans
  const [planDetails, setPlanDetails] = useState({})
  const [expandedInactive, setExpandedInactive] = useState({})

  useEffect(() => {
    async function init() {
      try {
        const json = await api.get('/api/workouts/plans')
        if (json.success && Array.isArray(json.data)) {
          if (json.data.length > 0) {
            const newlyActiveId = await syncServerPlans(json.data)
            if (newlyActiveId) {
              await loadPlan(newlyActiveId)
            } else {
              // Plans already synced locally — just load whichever is active
              const localActive = await getActivePlan()
              if (localActive) await loadPlan(localActive.id)
            }
          } else {
            // Server has no plans — load from local cache
            const localActive = await getActivePlan()
            if (localActive) await loadPlan(localActive.id)
          }
          await refreshAllPlans()
        }
      } catch (e) {
        if (e instanceof NetworkError) {
          const localActive = await getActivePlan()
          if (localActive) await loadPlan(localActive.id)
          await refreshAllPlans()
        }
      }
    }
    init()
  }, [])

  async function refreshAllPlans() {
    const plans = await getAllPlans()
    for (const p of plans) {
      try { p.sessionCount = await db.sessions.where('planId').equals(p.id).count() }
      catch { p.sessionCount = 0 }
    }
    setAllPlans(plans)
  }

  async function loadPlan(id) {
    const p = await getPlanWithDays(id)
    setPlan(p)
    // Auto-expand all training days (not Rest) when a plan is loaded
    const initial = {}
    p.days?.forEach(day => { if (day.name !== 'Rest') initial[day.id] = true })
    setExpandedDays(initial)
    try {
      const count = await db.sessions.where('planId').equals(id).count()
      setSessionCount(count)
    } catch {
      setSessionCount(0)
    }
    // Open the day picker now that plan data is available
    if (pendingPickerRef.current) {
      pendingPickerRef.current = false
      setDayPickerOpen(true)
    }
  }

  async function expandPlan(planId) {
    if (planDetails[planId]) return
    const p = await getPlanWithDays(planId)
    setPlanDetails(prev => ({ ...prev, [planId]: p }))
  }

  // ── Plan switching ─────────────────────────────────────────────────────────

  async function handleSwitchPlan(planId) {
    if (switching) return
    setSwitching(true)
    try {
      await dbSetActivePlan(planId)
      await loadPlan(planId)
      await refreshAllPlans()
      toast.success(t('planner.plan_activated'))
      const target = allPlans.find(p => p.id === planId)
      if (target?.serverId) {
        api.patch(`/api/workouts/plans/${target.serverId}`, { isActive: true }).catch(() => {})
      }
    } finally {
      setSwitching(false)
    }
  }

  // ── Plan deletion ──────────────────────────────────────────────────────────

  async function handleDeleteConfirm() {
    if (!deleteTarget) return
    const deletingId = deleteTarget.id
    const serverId = deleteTarget.serverId
    setDeleteTarget(null)

    await dbDeletePlan(deletingId)

    const remaining = allPlans.filter(p => p.id !== deletingId)
    if (plan?.id === deletingId) {
      if (remaining.length > 0) {
        await dbSetActivePlan(remaining[0].id)
        await loadPlan(remaining[0].id)
      } else {
        setPlan(null)
      }
    }

    await refreshAllPlans()

    if (serverId) {
      api.delete(`/api/workouts/plans/${serverId}`).catch(() => {})
    }
    toast.success(t('planner.plan_deleted'))
  }

  // ── Plan rename ────────────────────────────────────────────────────────────

  function startEditName() {
    setDraftName(plan.name)
    setEditingName(true)
    setTimeout(() => nameInputRef.current?.select(), 0)
  }

  async function commitRename() {
    const trimmed = draftName.trim()
    setEditingName(false)
    if (!trimmed || trimmed === plan.name) return
    await renamePlan(plan.id, trimmed)
    setPlan(prev => ({ ...prev, name: trimmed }))
    await refreshAllPlans()
    if (plan.serverId) {
      api.patch(`/api/workouts/plans/${plan.serverId}`, { name: trimmed }).catch(() => {})
    }
  }

  // ── Wizard ─────────────────────────────────────────────────────────────────

  async function handleWizardDone(planId) {
    await loadPlan(planId)
    await refreshAllPlans()
  }

  async function handleCreateFromTemplate(tpl) {
    const planId = await createPlan(tpl.name)
    for (let i = 0; i < 7; i++) {
      const d = tpl.days.find(day => day.dow === i)
      await db.planDays.add({
        planId, dayOfWeek: i, name: d?.name ?? 'Rest', restSeconds: 60, order: i,
      })
    }
    await loadPlan(planId)
    await refreshAllPlans()
  }

  // ── Day / exercise editing ─────────────────────────────────────────────────

  async function handleStartDay(day) {
    const id = await startSession(plan.id, day.id)
    nav(`/workout/active/${id}`, { state: { planDay: day, plan } })
  }

  function handleRemoveExercise(exId) {
    const planEx = plan?.days?.flatMap(d => d.exercises ?? []).find(e => e.id === exId)
    const name = planEx ? (getExerciseById(planEx.tutorialId)?.name ?? planEx.tutorialId) : ''
    setRemoveExTarget({ id: exId, name })
  }

  async function confirmRemoveExercise() {
    if (!removeExTarget) return
    await db.planExercises.delete(removeExTarget.id)
    setRemoveExTarget(null)
    loadPlan(plan.id)
  }

  function handleRemoveDay(day) {
    setRemoveDayTarget({ id: day.id, name: day.name, exCount: day.exercises?.length ?? 0 })
  }

  async function confirmRemoveDay() {
    if (!removeDayTarget) return
    // Delete all exercises in the day first, then the day itself
    await db.planExercises.where('dayId').equals(removeDayTarget.id).delete()
    await db.planDays.delete(removeDayTarget.id)
    setRemoveDayTarget(null)
    loadPlan(plan.id)
  }

  async function handleAddDay({ dayOfWeek, name, restSeconds }) {
    const order = (plan?.days?.length ?? 0)
    await db.planDays.add({ planId: plan.id, dayOfWeek, name, restSeconds, order })
    setAddDayOpen(false)
    loadPlan(plan.id)
  }

  async function handleDayNameChange(dayId, name) {
    await db.planDays.update(dayId, { name })
    loadPlan(plan.id)
  }

  async function handleSaveEdit(exId, opts) {
    await db.planExercises.update(exId, {
      targetSets: opts.sets, targetReps: opts.reps,
      targetWeight: opts.weight, restSeconds: opts.rest,
    })
    setEditingEx(null)
    loadPlan(plan.id)
  }

  function toggleDay(dayId) {
    setExpandedDays(prev => ({ ...prev, [dayId]: !prev[dayId] }))
  }

  // ── Incoming exercise from ExerciseDetail ──────────────────────────────────

  async function handleDayPicked(day) {
    setPendingDay(day)
    setDayPickerOpen(false)
  }

  async function handleIncomingConfirm(opts) {
    if (!pendingDay || !incomingExercise) return
    await addExerciseToDay(pendingDay.id, incomingExercise.id, {
      targetSets: opts.sets, targetReps: opts.reps,
      targetWeight: opts.weight, restSeconds: opts.rest,
    })
    setPendingDay(null)
    setIncomingExercise(null)
    window.history.replaceState({}, '')
    await loadPlan(plan.id)
    toast.success(t('planner.exercise_added'))
  }

  // ── Derived values ─────────────────────────────────────────────────────────

  const trainingDays = plan?.days?.filter(d => d.name !== 'Rest') ?? []
  const totalExCount = plan?.days?.reduce((acc, d) => acc + (d.exercises?.length ?? 0), 0) ?? 0
  const inactivePlans = allPlans.filter(p => !p.isActive && p.id !== plan?.id)

  // ── Empty state ────────────────────────────────────────────────────────────

  if (!plan && allPlans.length === 0) {
    return (
      <div className="page">
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ margin: 0 }}>
            {t('planner.title')}<br /><span style={{ color: 'var(--accent)' }}>{t('planner.title_accent')}</span>
          </h1>
        </div>

        <GptPlannerCard onManual={() => setCreateSheet(true)} />

        {createSheet && (
          <CreateSheet
            onClose={() => setCreateSheet(false)}
            onWizardDone={handleWizardDone}
            onTemplate={handleCreateFromTemplate}
          />
        )}

        {deleteTarget && (
          <ConfirmModal
            title={t('planner.delete_plan_title', { name: deleteTarget.name })}
            message={t('planner.delete_plan_message')}
            confirmLabel={t('planner.delete')}
            onConfirm={handleDeleteConfirm}
            onCancel={() => setDeleteTarget(null)}
          />
        )}

        {/* If arriving from ExerciseDetail with no plan, prompt to create one */}
        {incomingExercise && createPortal(
          <div className="overlay" onClick={() => setIncomingExercise(null)}>
            <div className="sheet" onClick={e => e.stopPropagation()}>
              <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: '1.1rem', marginBottom: 12 }}>
                {t('planner.add_to_which_day')}
              </div>
              <div style={{ padding: '8px 14px', borderRadius: 10, marginBottom: 16, background: 'rgba(232,255,0,0.07)', border: '1px solid rgba(232,255,0,0.15)', fontSize: '0.85rem', color: 'var(--accent)', fontWeight: 600 }}>
                {incomingExercise.name}
              </div>
              <p style={{ color: 'var(--text3)', fontSize: '0.9rem', marginBottom: 20 }}>{t('planner.subtitle')}</p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setIncomingExercise(null)}>{t('common.cancel')}</button>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => setCreateSheet(true)}>{t('planner.create_first_plan')}</button>
              </div>
            </div>
          </div>,
          document.body
        )}
      </div>
    )
  }

  // ── Main view ──────────────────────────────────────────────────────────────

  return (
    <div className="page">
      {removeExTarget && (
        <ConfirmModal
          title={t('planner.remove_exercise_title')}
          message={t('planner.remove_exercise_message', { name: removeExTarget.name })}
          confirmLabel={t('planner.delete')}
          onConfirm={confirmRemoveExercise}
          onCancel={() => setRemoveExTarget(null)}
        />
      )}

      {removeDayTarget && (
        <ConfirmModal
          title={t('planner.remove_day_title')}
          message={t('planner.remove_day_message', { name: removeDayTarget.name, count: removeDayTarget.exCount })}
          confirmLabel={t('planner.delete')}
          onConfirm={confirmRemoveDay}
          onCancel={() => setRemoveDayTarget(null)}
        />
      )}

      {deleteTarget && (
        <ConfirmModal
          title={t('planner.delete_plan_title', { name: deleteTarget.name })}
          message={deleteTarget.id === plan?.id
            ? t('planner.delete_active_plan_message')
            : t('planner.delete_plan_message')}
          confirmLabel={t('planner.delete')}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {/* Exercise preview modal */}
      {previewEx && (
        <ExerciseDetailModal
          ex={previewEx}
          onClose={() => setPreviewEx(null)}
          onNavigate={exId => {
            setPreviewEx(null)
            nav(`/exercises/${encodeURIComponent(exId)}`)
          }}
        />
      )}

      {/* Create sheet */}
      {createSheet && (
        <CreateSheet
          onClose={() => setCreateSheet(false)}
          onWizardDone={handleWizardDone}
          onTemplate={handleCreateFromTemplate}
        />
      )}

      {/* Page header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0 }}>
            MY<br /><span style={{ color: 'var(--accent)' }}>PLANS</span>
          </h1>
        </div>
        <button className="btn btn-primary" style={{ padding: '10px 16px' }} onClick={() => setCreateSheet(true)}>
          <Plus size={18} /> {t('planner.new_plan')}
        </button>
      </div>

      {/* Active Plan Card */}
      {plan && (
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 16, padding: 16, marginBottom: 20,
        }}>
          {/* ACTIVE badge + delete */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{
                background: 'rgba(232,255,0,0.12)', color: 'var(--accent)',
                border: '1px solid rgba(232,255,0,0.25)', borderRadius: 100,
                fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.1em',
                textTransform: 'uppercase', padding: '3px 10px',
              }}>
                {t('planner.active_plan')}
              </span>
              {plan.serverId && (
                <span style={{
                  fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.08em',
                  textTransform: 'uppercase', color: '#000',
                  background: 'var(--accent)', padding: '2px 7px', borderRadius: 100,
                }}>AI</span>
              )}
            </div>
            <button
              onClick={() => setDeleteTarget(plan)}
              title={t('planner.delete')}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text3)', padding: 6, borderRadius: 8,
                display: 'flex', alignItems: 'center',
                transition: 'color 0.15s',
              }}
            >
              <Trash2 size={16} />
            </button>
          </div>

          {/* Plan name with inline edit */}
          {editingName ? (
            <input
              ref={nameInputRef}
              value={draftName}
              onChange={e => setDraftName(e.target.value)}
              onBlur={commitRename}
              onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setEditingName(false) }}
              style={{
                fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: '1.4rem',
                background: 'var(--surface2)', border: '1px solid var(--accent)',
                borderRadius: 8, padding: '2px 8px', color: 'var(--text)', width: '100%',
                marginBottom: 8,
              }}
            />
          ) : (
            <button
              onClick={startEditName}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, background: 'none',
                border: 'none', cursor: 'pointer', padding: 0, color: 'var(--text)', marginBottom: 8,
              }}
            >
              <h2 style={{ margin: 0, fontFamily: 'Barlow Condensed' }}>{plan.name}</h2>
              <Edit2 size={14} color="var(--text3)" />
            </button>
          )}

          {/* Stats row */}
          <div style={{ fontSize: '0.78rem', color: 'var(--text3)', marginBottom: 4 }}>
            <span style={{ fontFamily: 'JetBrains Mono' }}>{plan.dayCount || trainingDays.length}</span>
            {' '}{t('planner.days_label')}
            {' · '}
            <span style={{ fontFamily: 'JetBrains Mono' }}>{plan.exCount || totalExCount}</span>
            {' '}{t('planner.exercises_label')}
            {' · '}
            <span style={{ fontFamily: 'JetBrains Mono' }}>{sessionCount}</span>
            {' '}{t('planner.sessions_count')}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text3)', marginBottom: 16 }}>
            {t('planner.created_on')} {formatDate(plan.createdAt)}
          </div>

          {/* Day rows */}
          {plan.days?.map(day => (
            <DayRow
              key={day.id}
              day={day}
              isActive
              expandedDays={expandedDays}
              onToggle={toggleDay}
              onStartDay={handleStartDay}
              onAddExercise={day => nav('/exercises', {
                state: { selectForDay: day.id, dayName: day.name, defaultRest: day.restSeconds ?? 60 },
              })}
              onEditEx={setEditingEx}
              onRemoveEx={handleRemoveExercise}
              onRemoveDay={handleRemoveDay}
              editingEx={editingEx}
              onSaveEdit={handleSaveEdit}
              onCancelEdit={() => setEditingEx(null)}
              onExerciseClick={setPreviewEx}
            />
          ))}

          {/* Add Day button */}
          {plan && (
            <button
              className="btn btn-ghost"
              style={{ width: '100%', marginTop: 10, fontSize: '0.85rem' }}
              onClick={() => setAddDayOpen(true)}
            >
              <Plus size={16} /> {t('planner.add_day')}
            </button>
          )}
        </div>
      )}

      {/* Add Day sheet */}
      {addDayOpen && createPortal(
        <AddDaySheet
          plan={plan}
          onConfirm={handleAddDay}
          onClose={() => setAddDayOpen(false)}
        />,
        document.body
      )}

      {/* Other Plans section */}
      {inactivePlans.length > 0 && (
        <>
          <div style={{
            fontSize: '0.7rem', fontWeight: 700, color: 'var(--text3)',
            textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12,
          }}>
            {t('planner.my_plans')}
          </div>

          {inactivePlans.map(p => {
            const isExpanded = expandedInactive[p.id]
            const details = planDetails[p.id]
            return (
              <div
                key={p.id}
                style={{
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 10, padding: '10px 12px', marginBottom: 8,
                }}
              >
                {/* Compact header row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button
                    onClick={() => {
                      const next = !isExpanded
                      setExpandedInactive(prev => ({ ...prev, [p.id]: next }))
                      if (next) expandPlan(p.id)
                    }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 2, flexShrink: 0 }}
                  >
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: '0.95rem',
                      color: 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {p.name}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text3)', marginTop: 1 }}>
                      {p.dayCount ?? 0} {t('planner.days_label')}
                      {' · '}
                      {p.exCount ?? 0} {t('planner.exercises_label')}
                      {' · '}
                      {p.sessionCount ?? 0} {t('planner.sessions_count')}
                      {' · '}
                      {formatDate(p.createdAt)}
                    </div>
                  </div>

                  <button
                    className="btn btn-ghost"
                    style={{ padding: '5px 10px', fontSize: '0.75rem', flexShrink: 0, borderColor: 'var(--border2)' }}
                    disabled={switching}
                    onClick={() => handleSwitchPlan(p.id)}
                  >
                    {t('planner.activate')}
                  </button>

                  <button
                    onClick={() => setDeleteTarget(p)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 4, flexShrink: 0 }}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>

                {/* Expanded days */}
                {isExpanded && (
                  <div style={{ marginTop: 12 }}>
                    {!details ? (
                      <div style={{ padding: '12px 0' }}>
                        {[1, 2, 3].map(i => (
                          <div key={i} style={{
                            height: 32, background: 'var(--surface2)', borderRadius: 6,
                            marginBottom: 8, opacity: 0.5,
                          }} />
                        ))}
                      </div>
                    ) : (
                      details.days?.map(day => (
                        <DayRow
                          key={day.id}
                          day={day}
                          isActive={false}
                          expandedDays={expandedDays}
                          onToggle={toggleDay}
                          onExerciseClick={setPreviewEx}
                        />
                      ))
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </>
      )}

      {/* Day picker for incoming exercise from ExerciseDetail */}
      {dayPickerOpen && incomingExercise && createPortal(
        <div className="overlay" onClick={() => { setDayPickerOpen(false); setIncomingExercise(null) }}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: '1.1rem' }}>
                {t('planner.add_to_which_day')}
              </div>
              <button onClick={() => { setDayPickerOpen(false); setIncomingExercise(null) }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 4 }}>
                <X size={20} />
              </button>
            </div>
            {/* Exercise name pill */}
            <div style={{
              padding: '8px 14px', borderRadius: 10, marginBottom: 16,
              background: 'rgba(232,255,0,0.07)', border: '1px solid rgba(232,255,0,0.15)',
              fontSize: '0.85rem', color: 'var(--accent)', fontWeight: 600,
            }}>
              {incomingExercise.name}
            </div>

            {trainingDays.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '16px 0 8px', color: 'var(--text3)', fontSize: '0.9rem' }}>
                {!plan ? t('common.loading') : t('planner.no_training_days')}
              </div>
            ) : trainingDays.map(d => (
              <button key={d.id} className="btn btn-ghost"
                style={{ width: '100%', marginBottom: 8, justifyContent: 'flex-start' }}
                onClick={() => handleDayPicked(d)}>
                <span style={{ color: 'var(--text3)', fontSize: '0.8rem', marginRight: 8 }}>{dayNames[d.dayOfWeek]}</span>
                {d.name}
              </button>
            ))}
          </div>
        </div>,
        document.body
      )}

      {/* Exercise config sheet for incoming exercise after day is picked */}
      {pendingDay && incomingExercise && (
        <ExerciseConfigSheet
          tutorialId={incomingExercise.id}
          initial={{ rest: pendingDay.restSeconds ?? 60 }}
          confirmLabel={t('planner.add_to_plan')}
          onConfirm={handleIncomingConfirm}
          onCancel={() => { setPendingDay(null); setIncomingExercise(null) }}
        />
      )}
    </div>
  )
}
