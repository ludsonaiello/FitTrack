import { useState, useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { CheckCircle, X, Plus, Clock, ChevronLeft, ChevronRight, Trophy, Zap, Trash2, BarChart2, Info } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { db, logSet, completeSession, getSessionWithSets, compareWithLastSession, getLastSetsForExercise, getExercisePR, getExerciseSessionHistory } from '../db/index.js'
import { enqueue } from '../db/sync-queue.js'
import { api, fetchWithFallback } from '../lib/api.js'
import { getExerciseById, FOCUS_LABELS, LEVEL_LABELS, EQUIPMENT_LABELS, exImageUrl, exVideoUrl } from '../lib/exercises.js'
import { getRandomTip } from '../lib/workoutTips.js'
import { useRestTimer, useStopwatch } from '../hooks/useTimer.js'
import { useWeightUnit, toDisplay, toKg } from '../hooks/useWeightUnit.js'
import { useNumericKeyboard } from '../context/NumericKeyboardContext.jsx'

function RestTimerOverlay({ seconds, total, onSkip }) {
  const { t } = useTranslation()
  const pct = total > 0 ? 1 - seconds / total : 0
  const r = 54, circ = 2 * Math.PI * r
  return (
    <div className="overlay" onClick={onSkip}>
      <div className="sheet" style={{textAlign:'center'}} onClick={e=>e.stopPropagation()}>
        <div style={{fontSize:'0.75rem',fontWeight:700,color:'var(--text3)',letterSpacing:'0.1em',textTransform:'uppercase',marginBottom:16}}>{t('workout.rest_timer')}</div>
        <div style={{position:'relative',width:140,height:140,margin:'0 auto 20px'}}>
          <svg width="140" height="140" viewBox="0 0 140 140" className="ring">
            <circle className="ring-track" cx="70" cy="70" r={r} strokeWidth="6"/>
            <circle className="ring-fill" cx="70" cy="70" r={r} strokeWidth="6"
              strokeDasharray={circ}
              strokeDashoffset={circ * pct}/>
          </svg>
          <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}>
            <div style={{fontFamily:'Barlow Condensed',fontWeight:800,fontSize:'3rem',lineHeight:1,color:'var(--accent)'}}>{seconds}</div>
            <div style={{fontSize:'0.7rem',color:'var(--text3)',fontWeight:600,letterSpacing:'0.1em'}}>{t('workout.seconds')}</div>
          </div>
        </div>
        <p style={{color:'var(--text2)',marginBottom:20}}>{t('workout.tap_anywhere_skip')}</p>
        <button className="btn btn-ghost" style={{width:'100%'}} onClick={onSkip}>{t('workout.skip_rest')}</button>
      </div>
    </div>
  )
}

function ComparisonBadge({ comp, unit = 'kg' }) {
  const { t } = useTranslation()
  const pill = (bg, color, text) => (
    <span style={{
      display: 'inline-block', padding: '3px 10px', borderRadius: 20,
      fontSize: '0.78rem', fontWeight: 700, background: bg, color,
    }}>{text}</span>
  )

  if (!comp) return pill('rgba(232,255,0,0.15)', 'var(--accent)', t('workout.first_time'))

  if (comp.weightDiff > 0) {
    const d = toDisplay(comp.weightDiff, unit)
    return pill('rgba(232,255,0,0.15)', 'var(--accent)', t('workout.heavier', { diff: d, unit }))
  }
  if (comp.weightDiff === 0 && comp.volDiff > 0) {
    const d = toDisplay(comp.volDiff, unit)
    return pill('rgba(232,255,0,0.12)', 'var(--accent)', t('workout.more_volume', { diff: d, unit }))
  }
  if (comp.weightDiff < 0) {
    const d = toDisplay(Math.abs(comp.weightDiff), unit)
    return pill('var(--surface2)', 'var(--text3)', t('workout.lighter', { diff: d, unit }))
  }
  return pill('var(--surface2)', 'var(--text3)', t('workout.same_as_last'))
}

// ── Celebration components ───────────────────────────────────────────────────

/** Full-screen fireworks overlay — auto-dismisses after 5 s or on tap. */
function CelebrationOverlay({ onDone, prExercises = [] }) {
  const { t } = useTranslation()
  useEffect(() => {
    const timer = setTimeout(onDone, 5000)
    return () => clearTimeout(timer)
  }, [onDone])

  return createPortal(
    <div
      onClick={onDone}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: '#000',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        pointerEvents: 'all', cursor: 'pointer',
        overflow: 'hidden',
      }}
    >
      {/* GIF fills the screen */}
      <img
        src="/assets/celebration.gif"
        alt=""
        style={{
          position: 'absolute', inset: 0,
          width: '100%', height: '100%',
          objectFit: 'cover',
        }}
      />
      {/* Dark overlay so text is always readable */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'rgba(0,0,0,0.52)',
      }} />
      {/* Centred text on top */}
      <div style={{
        position: 'relative', zIndex: 1, textAlign: 'center',
        padding: '0 24px', width: '100%', maxWidth: 480,
        animation: 'fadeSlideUp 0.45s ease forwards',
      }}>
        <div style={{
          fontSize: 'clamp(5rem, 20vw, 7rem)', lineHeight: 1, marginBottom: 12,
          filter: 'drop-shadow(0 0 40px rgba(232,255,0,1)) drop-shadow(0 0 80px rgba(232,255,0,0.6))',
        }}>🏆</div>
        <div style={{
          fontFamily: 'Barlow Condensed', fontWeight: 900,
          fontSize: 'clamp(2.8rem, 12vw, 5rem)',
          color: 'var(--accent)', textTransform: 'uppercase', lineHeight: 1,
          textShadow: '0 0 60px rgba(232,255,0,1), 0 0 120px rgba(232,255,0,0.6), 0 2px 12px rgba(0,0,0,1)',
          letterSpacing: '0.04em', marginBottom: 8,
        }}>
          {t('workout.new_personal_record')}
        </div>
        <div style={{
          fontFamily: 'Barlow Condensed', fontWeight: 700,
          fontSize: 'clamp(1.2rem, 5vw, 1.8rem)',
          color: 'rgba(255,255,255,0.9)',
          textShadow: '0 2px 16px rgba(0,0,0,1)',
          letterSpacing: '0.06em', marginBottom: 24,
        }}>
          {t('workout.you_crushed_it')}
        </div>

        {/* PR exercise list */}
        {prExercises.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            {prExercises.slice(0, 4).map((ex, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                background: 'rgba(232,255,0,0.12)',
                border: '1px solid rgba(232,255,0,0.35)',
                borderRadius: 12, padding: '10px 16px',
                marginBottom: 8,
                backdropFilter: 'blur(8px)',
              }}>
                <span style={{ fontSize: '1.3rem', flexShrink: 0 }}>🏅</span>
                <div style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
                  <div style={{
                    fontFamily: 'Barlow Condensed', fontWeight: 800, fontSize: '1.05rem',
                    color: 'var(--accent)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{ex.name}</div>
                  {ex.detail && (
                    <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.65)' }}>{ex.detail}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <p style={{
          color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem',
          textShadow: '0 2px 8px rgba(0,0,0,1)', letterSpacing: '0.08em',
        }}>
          {t('workout.tap_to_continue')}
        </p>
      </div>
    </div>,
    document.body,
  )
}

/** Slide-down banner that appears mid-workout when an exercise sets a new PR. */
function ExercisePRBanner({ exerciseName, weightDiff, unit, onDone }) {
  const { t } = useTranslation()
  useEffect(() => {
    const timer = setTimeout(onDone, 2600)
    return () => clearTimeout(timer)
  }, [onDone])

  return createPortal(
    <div style={{
      position: 'fixed',
      top: 'calc(env(safe-area-inset-top, 0px) + 62px)',
      left: '50%', transform: 'translateX(-50%)',
      width: 'calc(100% - 32px)', maxWidth: 448,
      zIndex: 9990,
      animation: 'slideUp 0.28s cubic-bezier(0,0,0.2,1)',
    }}>
      <div style={{
        background: 'linear-gradient(135deg, rgba(232,255,0,0.14) 0%, rgba(232,255,0,0.06) 100%)',
        border: '1px solid rgba(232,255,0,0.45)',
        borderRadius: 14,
        padding: '11px 16px',
        display: 'flex', alignItems: 'center', gap: 12,
        boxShadow: '0 8px 32px rgba(0,0,0,0.65), 0 0 20px rgba(232,255,0,0.18)',
      }}>
        <span style={{ fontSize: '1.7rem', flexShrink: 0 }}>🏆</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: 'Barlow Condensed', fontWeight: 800, fontSize: '0.82rem',
            color: 'var(--accent)', letterSpacing: '0.1em', textTransform: 'uppercase',
          }}>
            {t('workout.new_personal_record')}
          </div>
          <div style={{
            fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: '1.05rem',
            color: 'var(--text)', lineHeight: 1.2,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {exerciseName}
            {weightDiff > 0 && (
              <span style={{ color: 'var(--accent)', marginLeft: 8 }}>
                +{weightDiff} {unit}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={onDone}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 4, flexShrink: 0 }}
        >
          <X size={16} />
        </button>
      </div>
    </div>,
    document.body,
  )
}

/* ── Overview tab ──────────────────────────────────────────────────────────── */
function OverviewTab({ ex }) {
  const { t } = useTranslation()
  const [videoError, setVideoError] = useState(false)
  const vidUrl = exVideoUrl(ex.id)

  return (
    <div style={{ paddingBottom: 16 }}>
      {/* Video */}
      {vidUrl && !videoError && (
        <div style={{ borderRadius: 14, overflow: 'hidden', marginBottom: 16, background: 'var(--surface2)' }}>
          <video
            src={vidUrl} autoPlay loop muted playsInline
            style={{ width: '100%', display: 'block', maxHeight: 240, objectFit: 'cover' }}
            onError={() => setVideoError(true)}
          />
        </div>
      )}

      {/* Description */}
      {ex.description && (
        <p style={{ color: 'var(--text2)', lineHeight: 1.65, fontSize: '0.88rem', margin: '0 0 16px' }}>
          {ex.description}
        </p>
      )}

      {/* Meta chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
        {(ex.focusArea ?? []).map(f => (
          <span key={f} style={{ fontSize: '0.72rem', fontWeight: 700, padding: '4px 10px', borderRadius: 100, background: 'rgba(232,255,0,0.1)', color: 'var(--accent)', border: '1px solid rgba(232,255,0,0.2)' }}>
            {t(`filters.focus.${f}`, { defaultValue: FOCUS_LABELS[f] ?? f })}
          </span>
        ))}
        {(ex.equipment ?? []).map(eq => (
          <span key={eq} style={{ fontSize: '0.72rem', fontWeight: 600, padding: '4px 10px', borderRadius: 100, background: 'var(--surface2)', color: 'var(--text3)', border: '1px solid var(--border)' }}>
            {t(`filters.equipment.${eq}`, { defaultValue: EQUIPMENT_LABELS[eq] ?? eq })}
          </span>
        ))}
        {ex.experienceLevel && (
          <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '4px 10px', borderRadius: 100, background: 'var(--surface2)', color: 'var(--text3)', border: '1px solid var(--border)' }}>
            {t(`filters.level.${ex.experienceLevel}`, { defaultValue: LEVEL_LABELS[ex.experienceLevel] ?? ex.experienceLevel })}
          </span>
        )}
      </div>

      {/* Tips */}
      {ex.tips?.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 8 }}>
            {t('workout.tips_label')}
          </div>
          {ex.tips.map((tip, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 8 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', marginTop: 6, flexShrink: 0 }} />
              <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--text2)', lineHeight: 1.55 }}>{tip}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── History tab ───────────────────────────────────────────────────────────── */
function HistoryTab({ tutId, data, unit, locale }) {
  const { t } = useTranslation()

  if (!data) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 0', gap: 10, color: 'var(--text3)' }}>
        <div style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid var(--accent)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
        <span style={{ fontSize: '0.85rem' }}>{t('workout.loading')}</span>
      </div>
    )
  }

  const { pr, sessions } = data

  // Estimated 1RM via Epley formula: w × (1 + r/30)
  const est1RM = pr?.weight && pr?.reps
    ? Math.round(toDisplay(pr.weight * (1 + pr.reps / 30), unit) * 10) / 10
    : null

  // Max volume: highest single-set weight × reps
  const maxVol = sessions.length
    ? Math.max(...sessions.flatMap(s => s.sets.map(set => (set.weight ?? 0) * (set.reps ?? 0))))
    : 0

  return (
    <div style={{ paddingBottom: 16 }}>
      {/* PR stats */}
      {pr ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 20 }}>
          <div className="stat-box" style={{ padding: '14px 8px', textAlign: 'center' }}>
            <div className="stat-value" style={{ fontSize: '1.3rem', textAlign: 'center' }}>{Math.round(toDisplay(pr.weight ?? 0, unit) * 10) / 10}</div>
            <div className="stat-label" style={{ fontSize: '0.6rem', textAlign: 'center', marginTop: 2 }}>{t('workout.max_weight')}<br />{unit}</div>
          </div>
          <div className="stat-box" style={{ padding: '14px 8px', textAlign: 'center' }}>
            <div className="stat-value" style={{ fontSize: '1.3rem', textAlign: 'center' }}>{Math.round(toDisplay(maxVol, unit))}</div>
            <div className="stat-label" style={{ fontSize: '0.6rem', textAlign: 'center', marginTop: 2 }}>{t('workout.max_volume')}<br />{unit}</div>
          </div>
          <div className="stat-box" style={{ padding: '14px 8px', textAlign: 'center' }}>
            <div className="stat-value" style={{ fontSize: '1.3rem', color: 'var(--accent)', textAlign: 'center' }}>{est1RM ?? '—'}</div>
            <div className="stat-label" style={{ fontSize: '0.6rem', textAlign: 'center', marginTop: 2 }}>{t('workout.est_1rm')}<br />{unit}</div>
          </div>
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '24px 0 16px', color: 'var(--text3)', fontSize: '0.88rem' }}>
          {t('workout.no_history')}
        </div>
      )}

      {/* Session history list */}
      {sessions.length > 0 && (
        <>
          <div style={{ fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 12 }}>
            {t('workout.history_label')}
          </div>
          {sessions.map((s, i) => (
            <div key={s.session.id} style={{
              marginBottom: 14, paddingBottom: 14,
              borderBottom: i < sessions.length - 1 ? '1px solid var(--border)' : 'none',
            }}>
              {/* Session date */}
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: '0.95rem', color: 'var(--accent)', marginBottom: 8, letterSpacing: '0.02em' }}>
                {new Date(s.session.startedAt).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
              </div>
              {/* Sets list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {s.sets.map((set, si) => {
                  const w = set.weight != null ? Math.round(toDisplay(set.weight, unit) * 10) / 10 : null
                  return (
                    <div key={si} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{
                        fontSize: '0.68rem', fontWeight: 700, color: 'var(--text3)',
                        minWidth: 38, fontFamily: "'Barlow Condensed', sans-serif",
                        letterSpacing: '0.04em', textTransform: 'uppercase',
                      }}>
                        Set {si + 1}
                      </span>
                      <div style={{ flex: 1, borderBottom: '1px dotted var(--border2)' }} />
                      <span style={{
                        fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
                        fontSize: '0.95rem', color: 'var(--text)', letterSpacing: '0.02em',
                      }}>
                        {set.reps ?? '—'}×{w ?? '—'} {w != null ? unit : ''}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  )
}

export default function ActiveWorkout() {
  const { t, i18n } = useTranslation()
  const locale = i18n.language
  const { sessionId: sessionIdParam } = useParams()
  const sessionId = Number(sessionIdParam)
  const nav = useNavigate()
  const loc = useLocation()
  const planDay = loc.state?.planDay
  const stopwatch = useStopwatch()
  const restTimer = useRestTimer()

  const keyboard = useNumericKeyboard()
  const isMobile = useMemo(() => window.matchMedia('(pointer: coarse)').matches, [])

  const [unit] = useWeightUnit()
  const [exercises, setExercises] = useState([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [sets, setSets] = useState({}) // tutorialId -> [{reps,weight,done}]
  const [prevSets, setPrevSets] = useState({}) // tutorialId -> [{setNumber,reps,weight}]
  const [showFinish, setShowFinish] = useState(false)
  const [finished, setFinished] = useState(false)
  const [summary, setSummary] = useState(null)
  const [showCelebration, setShowCelebration] = useState(false)
  const [exercisePRBanner, setExercisePRBanner] = useState(null) // { exerciseName, weightDiff }
  const [skipModal, setSkipModal] = useState(null)       // { targetIdx }
  const [addSetModal, setAddSetModal] = useState(null)   // { tutId }
  const [removeSetModal, setRemoveSetModal] = useState(null) // { tutId, setIdx }
  const [removeExModal, setRemoveExModal] = useState(null)   // { exIdx }
  const [confirmFinishModal, setConfirmFinishModal] = useState(false)
  const [exTabs, setExTabs] = useState({})     // tutId → 'track'|'overview'|'history'
  const [exHistory, setExHistory] = useState({}) // tutId → { pr, sessions }
  const [exTips, setExTips] = useState({})       // tutId → string tip

  useEffect(() => {
    stopwatch.start()
    restTimer.requestPermission()

    if (planDay?.exercises?.length > 0) {
      const exs = planDay.exercises.map(pe => ({
        ...pe,
        info: getExerciseById(pe.tutorialId),
      })).filter(e => e.info)
      setExercises(exs)

      // load previous sets and pre-fill current sets
      Promise.all(exs.map(e => getLastSetsForExercise(e.tutorialId))).then(lastSetsArr => {
        const prev = {}
        const initSets = {}
        exs.forEach((e, i) => {
          const last = lastSetsArr[i] || []
          prev[e.tutorialId] = last
          const count = e.targetSets || 3
          initSets[e.tutorialId] = Array.from({ length: count }, (_, idx) => {
            const prevSet = last[idx] ?? last[last.length - 1]
            const hintReps = prevSet?.reps ?? e.targetReps ?? null
            const hintWeight = prevSet?.weight != null
              ? toDisplay(prevSet.weight, unit)
              : (e.targetWeight != null ? toDisplay(e.targetWeight, unit) : null)
            return {
              setNumber: idx + 1,
              reps: '',
              weight: '',
              done: false,
              hintReps,
              hintWeight,
            }
          })
        })
        setPrevSets(prev)
        setSets(initSets)
        // Pre-generate a random tip per exercise
        const tips = {}
        exs.forEach(e => {
          tips[e.tutorialId] = getRandomTip(e.info.focusArea ?? [], locale)
        })
        setExTips(tips)
      })
    }
  }, [])

  function getExTab(tutId) { return exTabs[tutId] ?? 'track' }
  function switchExTab(tutId, tab) {
    setExTabs(prev => ({ ...prev, [tutId]: tab }))
    if (tab === 'history' && !exHistory[tutId]) {
      Promise.all([getExercisePR(tutId), getExerciseSessionHistory(tutId, 15)]).then(([pr, sessions]) => {
        setExHistory(prev => ({ ...prev, [tutId]: { pr, sessions } }))
      })
    }
  }

  const currentEx = exercises[currentIdx]
  const currentSets = currentEx ? (sets[currentEx.tutorialId] || []) : []
  const allDone = currentSets.every(s => s.done)

  function updateSet(tutId, idx, field, value) {
    setSets(prev => ({
      ...prev,
      [tutId]: prev[tutId].map((s, i) => i === idx ? {...s, [field]: value} : s)
    }))
  }

  /** Compares completed sets for tutId against prevSets (already in display unit). */
  function checkExercisePR(tutId) {
    const done = (sets[tutId] || []).filter(s => s.done)
    if (!done.length) return null
    const prev = prevSets[tutId] || []
    if (!prev.length) return { exerciseName: exercises.find(e => e.tutorialId === tutId)?.info?.name || tutId, weightDiff: 0 }

    const curMax = Math.max(...done.map(s => parseFloat(s.weight) || 0))
    const prevMax = Math.max(...prev.map(s => toDisplay(s.weight || 0, unit) || 0))
    if (curMax > prevMax) {
      const diff = Math.round((curMax - prevMax) * 10) / 10
      return { exerciseName: exercises.find(e => e.tutorialId === tutId)?.info?.name || tutId, weightDiff: diff }
    }
    const curVol = done.reduce((a, s) => a + (parseFloat(s.weight) || 0) * (parseInt(s.reps) || 0), 0)
    const prevVol = prev.reduce((a, s) => a + (toDisplay(s.weight || 0, unit) || 0) * (s.reps || 0), 0)
    if (curVol > prevVol) {
      return { exerciseName: exercises.find(e => e.tutorialId === tutId)?.info?.name || tutId, weightDiff: 0 }
    }
    return null
  }

  async function handleCompleteSet(tutId, setIdx) {
    const s = sets[tutId][setIdx]
    const repsVal = parseInt(s.reps)
    if (!repsVal || repsVal < 1) return   // reps required
    await logSet(sessionId, tutId, {
      setNumber: s.setNumber,
      reps: parseInt(s.reps) || null,
      weight: toKg(s.weight, unit),
      completed: true,
    })
    updateSet(tutId, setIdx, 'done', true)
    // start rest timer
    const ex = exercises.find(e => e.tutorialId === tutId)
    if (ex?.restSeconds) restTimer.start(ex.restSeconds)
  }

  function handleNextExercise() {
    const incomplete = currentSets.filter(s => !s.done).length
    if (incomplete > 0) {
      setSkipModal({ targetIdx: currentIdx + 1 })
      return
    }
    // Check for PR on the exercise we just finished
    if (currentEx) {
      const pr = checkExercisePR(currentEx.tutorialId)
      if (pr) {
        setExercisePRBanner(pr)
        setShowCelebration(true)
      }
    }
    setCurrentIdx(i => i + 1)
  }

  function handleRequestFinish() {
    const totalIncomplete = Object.values(sets).flat().filter(s => !s.done).length
    if (totalIncomplete > 0) {
      setConfirmFinishModal(true)
    } else {
      handleFinish()
    }
  }

  function confirmAddSet(saveToPlan) {
    const { tutId } = addSetModal
    const currentCount = sets[tutId]?.length || 0
    setSets(prev => ({
      ...prev,
      [tutId]: [...(prev[tutId] || []), { setNumber: currentCount + 1, reps: 10, weight: '', done: false }],
    }))
    if (saveToPlan) {
      const ex = exercises.find(e => e.tutorialId === tutId)
      if (ex?.id) db.planExercises.update(ex.id, { targetSets: currentCount + 1 })
    }
    setAddSetModal(null)
  }

  function confirmRemoveSet(saveToPlan) {
    const { tutId, setIdx } = removeSetModal
    const currentCount = sets[tutId]?.length || 0
    setSets(prev => ({
      ...prev,
      [tutId]: prev[tutId].filter((_, i) => i !== setIdx).map((s, i) => ({ ...s, setNumber: i + 1 })),
    }))
    if (saveToPlan) {
      const ex = exercises.find(e => e.tutorialId === tutId)
      if (ex?.id) db.planExercises.update(ex.id, { targetSets: Math.max(1, currentCount - 1) })
    }
    setRemoveSetModal(null)
  }

  function confirmRemoveExercise(saveToPlan) {
    const { exIdx } = removeExModal
    const ex = exercises[exIdx]
    if (saveToPlan && ex?.id) db.planExercises.delete(ex.id)
    const tutId = ex.tutorialId
    setExercises(prev => prev.filter((_, i) => i !== exIdx))
    setSets(prev => { const n = { ...prev }; delete n[tutId]; return n })
    setCurrentIdx(prev => {
      if (exIdx < prev) return prev - 1
      return Math.min(prev, exercises.length - 2)
    })
    setRemoveExModal(null)
  }

  async function handleFinish() {
    stopwatch.pause()
    const duration = await completeSession(sessionId)

    // gather stats — sets.weight is in display unit, convert back to kg for volume
    const totalSetsCount = Object.values(sets).flat().filter(s => s.done).length
    const totalVolKg = Object.values(sets).flat()
      .filter(s => s.done && s.weight !== '' && s.reps)
      .reduce((acc, s) => acc + (toKg(s.weight, unit) ?? 0) * parseInt(s.reps), 0)

    // compare with last session
    const comparison = await compareWithLastSession(sessionId)

    setSummary({ duration, totalSets: totalSetsCount, totalVolKg: Math.round(totalVolKg), comparison })
    setFinished(true)

    // Fire celebration for any PR — including first-time exercises (no prior session)
    const doneTutIds = Object.entries(sets).filter(([, arr]) => arr.some(s => s.done)).map(([id]) => id)
    const hasFirstTime = doneTutIds.some(tutId => !prevSets[tutId]?.length)
    const hasImprovement = comparison && comparison.some(c => c.isWeightPR || c.isVolPR)
    if (hasFirstTime || hasImprovement) {
      setShowCelebration(true)
    }

    // Sync session to server — online-first (3 retries), queue only if all fail
    getSessionWithSets(sessionId).then(async session => {
      if (!session) return
      const payload = {
        startedAt:   session.startedAt,
        completedAt: session.completedAt,
        durationSec: session.durationSec,
        notes:       session.notes || undefined,
        sets: (session.sets || []).map(s => ({
          tutorialId:  s.tutorialId,
          setNumber:   s.setNumber,
          reps:        s.reps ?? undefined,
          weight:      s.weight ?? undefined,
          durationSec: s.durationSec ?? undefined,
          restSec:     s.restSec ?? undefined,
          completed:   s.completed ?? true,
        })),
      }

      await fetchWithFallback(
        () => api.post('/api/workouts/sessions', payload),
        () => enqueue('sessions', sessionId, payload),
      )
    }).catch(() => {})
  }

  if (finished && summary) {
    // Build per-exercise rows: up to 5, using the exercises that were in this session
    const compMap = {}
    if (summary.comparison) {
      summary.comparison.forEach(c => { compMap[c.tutorialId] = c })
    }

    // Collect tutorialIds that had at least one done set
    const doneTutIds = Object.entries(sets)
      .filter(([, setArr]) => setArr.some(s => s.done))
      .map(([tutId]) => tutId)
      .slice(0, 5)

    const hasAnyPR = summary.comparison && summary.comparison.some(c => c.isWeightPR || c.isVolPR)

    // Build list of PR exercises to show on celebration overlay
    const prExercises = (() => {
      const list = []
      // First-time exercises
      Object.entries(sets).forEach(([tutId, setArr]) => {
        if (setArr.some(s => s.done) && !prevSets[tutId]?.length) {
          const info = getExerciseById(tutId)
          list.push({ name: info?.name || tutId, detail: t('workout.first_time_detail') })
        }
      })
      // Weight/volume PRs from comparison
      if (summary.comparison) {
        summary.comparison.filter(c => c.isWeightPR || c.isVolPR).forEach(c => {
          // Avoid duplicates with first-time entries
          if (!list.find(e => e.name === (getExerciseById(c.tutorialId)?.name || c.tutorialId))) {
            const info = getExerciseById(c.tutorialId)
            const diff = c.weightDiff > 0 ? `+${Math.round(toDisplay(c.weightDiff, unit) * 10) / 10} ${unit}` : null
            list.push({ name: info?.name || c.tutorialId, detail: diff })
          }
        })
      }
      return list
    })()

    return (
      <div className="page" style={{padding:'24px 16px',maxWidth:480,margin:'0 auto'}}>
        {/* Trophy + title */}
        <div style={{textAlign:'center',marginBottom:24}}>
          <div style={{fontSize:'4rem',marginBottom:12}}>🏆</div>
          <h1 style={{margin:'0 0 4px'}}>{t('workout.complete')}</h1>
          <p style={{color:'var(--text3)',margin:0,fontFamily:'Barlow Condensed',fontSize:'1.1rem',fontWeight:600,letterSpacing:'0.05em'}}>
            {planDay?.name || t('workout.free_workout')}
          </p>
        </div>

        {/* Stats grid */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:16}}>
          <div className="stat-box">
            <div className="stat-value">{Math.floor(summary.duration / 60)}</div>
            <div className="stat-label">{t('workout.duration')}</div>
          </div>
          <div className="stat-box">
            <div className="stat-value">{summary.totalSets}</div>
            <div className="stat-label">{t('workout.sets_done')}</div>
          </div>
        </div>

        {summary.totalVolKg > 0 && (
          <div className="stat-box" style={{marginBottom:24,textAlign:'center'}}>
            <div className="stat-value">{Math.round(toDisplay(summary.totalVolKg, unit)).toLocaleString()} {unit}</div>
            <div className="stat-label">{t('workout.total_volume')}</div>
          </div>
        )}

        {/* Per-exercise comparison */}
        {doneTutIds.length > 0 && (
          <div style={{marginBottom:20}}>
            <div style={{fontSize:'0.7rem',fontWeight:700,color:'var(--text3)',letterSpacing:'0.1em',textTransform:'uppercase',marginBottom:12}}>
              {t('workout.how_did_you_do')}
            </div>
            <div className="card" style={{padding:'4px 0'}}>
              {doneTutIds.map((tutId, idx) => {
                const info = getExerciseById(tutId)
                const name = info?.name || tutId
                const comp = compMap[tutId] || null
                return (
                  <div key={tutId} style={{
                    display:'flex',
                    alignItems:'center',
                    justifyContent:'space-between',
                    gap:12,
                    padding:'10px 14px',
                    borderBottom: idx < doneTutIds.length - 1 ? '1px solid var(--border2)' : 'none',
                  }}>
                    <span style={{
                      fontFamily:'Barlow Condensed',
                      fontWeight:700,
                      fontSize:'1rem',
                      color:'var(--text)',
                      flex:1,
                      minWidth:0,
                      overflow:'hidden',
                      textOverflow:'ellipsis',
                      whiteSpace:'nowrap',
                    }}>
                      {name}
                    </span>
                    <ComparisonBadge comp={comp} unit={unit} />
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* PR section — list each PR exercise */}
        {hasAnyPR && (
          <div style={{ marginBottom: 24 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              marginBottom: 12,
            }}>
              <span style={{ fontSize: '1.4rem' }}>🏆</span>
              <span style={{
                fontFamily: 'Barlow Condensed', fontWeight: 800, fontSize: '1.25rem',
                color: 'var(--accent)', letterSpacing: '0.05em', textTransform: 'uppercase',
              }}>
                {t('workout.new_personal_record')}
              </span>
            </div>
            <div className="card" style={{ padding: '4px 0' }}>
              {summary.comparison.filter(c => c.isWeightPR || c.isVolPR).map((c, idx, arr) => {
                const info = getExerciseById(c.tutorialId)
                const dispWeight = Math.round(toDisplay(c.curMaxWeight, unit) * 10) / 10
                const dispDiff   = Math.round(toDisplay(Math.abs(c.weightDiff), unit) * 10) / 10
                return (
                  <div key={c.tutorialId} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 16px',
                    borderBottom: idx < arr.length - 1 ? '1px solid var(--border)' : 'none',
                  }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%',
                      background: 'rgba(232,255,0,0.12)',
                      border: '1px solid rgba(232,255,0,0.3)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0, fontSize: '0.9rem',
                    }}>
                      🏅
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: '1rem',
                        color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {info?.name || c.tutorialId}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text3)' }}>
                        {dispWeight} {unit}
                        {c.isWeightPR && c.weightDiff > 0 && (
                          <span style={{ color: 'var(--accent)', marginLeft: 6, fontWeight: 700 }}>
                            ↑ +{dispDiff} {unit}
                          </span>
                        )}
                        {!c.isWeightPR && c.isVolPR && (
                          <span style={{ color: 'var(--accent)', marginLeft: 6, fontWeight: 700 }}>
                            ↑ {t('workout.more_volume', { diff: Math.round(toDisplay(c.volDiff, unit)), unit })}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <button className="btn btn-primary" style={{width:'100%'}} onClick={() => nav('/')}>
          {t('workout.back_to_home')}
        </button>

        {showCelebration && (
          <CelebrationOverlay onDone={() => setShowCelebration(false)} prExercises={prExercises} />
        )}
      </div>
    )
  }

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100dvh',background:'var(--bg)'}}>
      {/* iOS PWA safe area — pushes content below the notch/status bar */}
      <div style={{height:'env(safe-area-inset-top, 0px)',background:'var(--bg)',flexShrink:0}}/>

      {restTimer.running && (
        <RestTimerOverlay seconds={restTimer.seconds} total={restTimer.total} onSkip={restTimer.clear}/>
      )}

      {exercisePRBanner && (
        <ExercisePRBanner
          exerciseName={exercisePRBanner.exerciseName}
          weightDiff={exercisePRBanner.weightDiff}
          unit={unit}
          onDone={() => setExercisePRBanner(null)}
        />
      )}

      {/* Header */}
      <div style={{padding:'12px 16px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',gap:12,flexShrink:0}}>
        <button onClick={()=>setShowFinish(true)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text3)',padding:4}}>
          <X size={22}/>
        </button>
        <div style={{flex:1}}>
          <div style={{fontFamily:'Barlow Condensed',fontWeight:700,fontSize:'1.1rem'}}>{planDay?.name||t('workout.free_workout')}</div>
          <div style={{fontSize:'0.8rem',color:'var(--text3)'}}>{stopwatch.formatted}</div>
        </div>
        <button className="btn btn-danger" style={{padding:'8px 14px',fontSize:'0.85rem'}} onClick={handleRequestFinish}>
          {t('workout.finish')}
        </button>
      </div>

      {/* Exercise nav strip */}
      {exercises.length > 0 && (
        <div style={{ padding: '10px 16px 10px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, overflowX: 'auto', scrollbarWidth: 'none' }}>
          {exercises.map((ex, i) => {
            const exSets = sets[ex.tutorialId] || []
            const done = exSets.filter(s => s.done).length
            const total = exSets.length
            const allDoneEx = done === total && total > 0
            const active = i === currentIdx
            const shortName = ex.info.name.split(' ').slice(0, 2).join(' ')
            return (
              <button
                key={ex.tutorialId}
                onClick={() => setCurrentIdx(i)}
                style={{
                  flexShrink: 0, padding: '8px 12px', borderRadius: 10, cursor: 'pointer',
                  border: `1.5px solid ${active ? 'var(--accent)' : allDoneEx ? 'var(--success)' : 'var(--border)'}`,
                  background: active ? 'rgba(232,255,0,0.08)' : 'var(--surface2)',
                  minWidth: 72, textAlign: 'left', transition: 'all 0.15s',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                  <span style={{ fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: active ? 'var(--accent)' : allDoneEx ? 'var(--success)' : 'var(--text3)' }}>
                    {t('workout.ex_label', { num: i + 1 })}
                  </span>
                  {allDoneEx && <CheckCircle size={9} color="var(--success)" />}
                </div>
                <div style={{ fontSize: '0.73rem', fontWeight: 600, color: active ? 'var(--text)' : 'var(--text2)', maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 4 }}>
                  {shortName}
                </div>
                {/* Set progress dots */}
                <div style={{ display: 'flex', gap: 3 }}>
                  {Array.from({ length: total }).map((_, si) => (
                    <div key={si} style={{
                      width: 5, height: 5, borderRadius: '50%',
                      background: exSets[si]?.done ? (active ? 'var(--accent)' : 'var(--success)') : 'var(--border2)',
                      transition: 'background 0.2s',
                    }} />
                  ))}
                </div>
              </button>
            )
          })}
          <button
            onClick={() => nav('/exercises', { state: { quickAdd: sessionId } })}
            style={{ flexShrink: 0, width: 44, height: 44, borderRadius: 10, border: '1.5px dashed var(--border2)', background: 'transparent', cursor: 'pointer', color: 'var(--text3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <Plus size={16} />
          </button>
        </div>
      )}

      {/* Main content */}
      <div style={{flex:1,overflowY:'auto',padding:'16px'}}>
        {!currentEx ? (
          <div style={{textAlign:'center',padding:'40px 0'}}>
            <p style={{color:'var(--text3)'}}>{t('workout.no_exercises')}</p>
            <button className="btn btn-ghost" style={{marginTop:16}} onClick={()=>nav('/exercises')}>
              {t('workout.browse_exercises')}
            </button>
          </div>
        ) : (
          <>
            {/* ── Exercise header ─────────────────────────────────────────── */}
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
              <div style={{ width: 56, height: 56, borderRadius: 12, overflow: 'hidden', background: 'var(--surface2)', flexShrink: 0 }}>
                <img
                  src={exImageUrl(currentEx.info.id)} alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={e => { e.target.style.display = 'none' }}
                />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h2 style={{ margin: '0 0 3px', lineHeight: 1.15, fontSize: 'clamp(1.1rem, 4vw, 1.35rem)' }}>
                  {currentEx.info.name}
                </h2>
                <div style={{ fontSize: '0.75rem', color: 'var(--text3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {(currentEx.info.focusArea ?? []).map(f => t(`filters.focus.${f}`, { defaultValue: FOCUS_LABELS[f] ?? f })).join(' · ')}
                </div>
              </div>
              <button
                onClick={() => setRemoveExModal({ exIdx: currentIdx })}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 6, flexShrink: 0 }}
              >
                <Trash2 size={18} />
              </button>
            </div>

            {/* ── Tabs ─────────────────────────────────────────────────────── */}
            {(() => {
              const tutId = currentEx.tutorialId
              const currentTab = getExTab(tutId)
              const tabs = [
                { id: 'track',    label: t('workout.tab_track'),    icon: <Zap size={13}/> },
                { id: 'overview', label: t('workout.tab_overview'),  icon: <Info size={13}/> },
                { id: 'history',  label: t('workout.tab_history'),   icon: <BarChart2 size={13}/> },
              ]
              return (
                <>
                  <div style={{ display: 'flex', borderBottom: '1.5px solid var(--border)', marginBottom: 16, gap: 0 }}>
                    {tabs.map(tab => {
                      const active = currentTab === tab.id
                      return (
                        <button
                          key={tab.id}
                          onClick={() => switchExTab(tutId, tab.id)}
                          style={{
                            flex: 1, padding: '9px 4px', border: 'none', cursor: 'pointer',
                            background: 'transparent',
                            borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
                            marginBottom: -1.5,
                            color: active ? 'var(--accent)' : 'var(--text3)',
                            fontWeight: active ? 700 : 500,
                            fontSize: '0.75rem', letterSpacing: '0.04em', textTransform: 'uppercase',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                            transition: 'all 0.15s',
                          }}
                        >
                          {tab.icon} {tab.label}
                        </button>
                      )
                    })}
                  </div>

                  {/* ── Track tab ─────────────────────────────────────────── */}
                  {currentTab === 'track' && (
                    <>
                      <div className="card" style={{ padding: '14px 12px' }}>
                        {/* Header row */}
                        <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr 1fr 36px 32px', gap: 6, paddingBottom: 8, borderBottom: '1px solid var(--border2)', marginBottom: 6 }}>
                          <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text3)', letterSpacing: '0.08em', textTransform: 'uppercase', textAlign: 'center' }}>#</span>
                          <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text3)', letterSpacing: '0.08em', textTransform: 'uppercase', textAlign: 'center' }}>{t('exercises.reps')}</span>
                          <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text3)', letterSpacing: '0.08em', textTransform: 'uppercase', textAlign: 'center' }}>{t('exercises.weight')}</span>
                          <span /><span />
                        </div>

                        {currentSets.map((s, i) => {
                          const isLocked = i > 0 && !currentSets[i - 1].done
                          const hasReps = parseInt(s.reps) >= 1
                          return (
                            <div key={i} style={{ marginBottom: 2, borderBottom: i < currentSets.length - 1 ? '1px solid var(--border2)' : 'none', paddingBottom: 2 }}>
                              {/* Set row */}
                              <div style={{
                                display: 'grid', gridTemplateColumns: '28px 1fr 1fr 40px 32px', gap: 6, alignItems: 'center',
                                paddingTop: 10, paddingBottom: s.done || isLocked || !(s.hintReps != null || s.hintWeight != null) ? 10 : 4,
                                opacity: s.done ? 0.45 : isLocked ? 0.3 : 1,
                                transition: 'opacity 0.2s',
                              }}>
                                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: '1.15rem', color: s.done ? 'var(--success)' : isLocked ? 'var(--text3)' : 'var(--text)', textAlign: 'center', lineHeight: 1 }}>
                                  {i + 1}
                                </div>

                                {/* Reps input */}
                                <input
                                  className="input-num"
                                  type={isMobile ? 'text' : 'number'}
                                  inputMode={isMobile ? 'none' : undefined}
                                  readOnly={isMobile || undefined}
                                  value={String(s.reps ?? '')}
                                  placeholder={s.hintReps != null ? String(s.hintReps) : '0'}
                                  disabled={s.done || isLocked}
                                  min={!isMobile ? 1 : undefined}
                                  data-nk={`${tutId}-${i}-reps`}
                                  onChange={isMobile ? undefined : e => updateSet(tutId, i, 'reps', e.target.value)}
                                  style={{ padding: '7px 6px' }}
                                  onFocus={() => {
                                    if (!isMobile || s.done || isLocked) return
                                    keyboard.open({
                                      label: s.hintReps != null ? `${t('workout.reps_label')}: ${s.hintReps}` : t('exercises.reps'),
                                      value: String(s.reps ?? ''),
                                      onChange: v => updateSet(tutId, i, 'reps', v),
                                      isLastField: false,
                                      onNext: () => document.querySelector(`[data-nk="${tutId}-${i}-weight"]`)?.focus(),
                                    })
                                  }}
                                />

                                {/* Weight input */}
                                <input
                                  className="input-num"
                                  type={isMobile ? 'text' : 'number'}
                                  inputMode={isMobile ? 'none' : undefined}
                                  readOnly={isMobile || undefined}
                                  value={String(s.weight ?? '')}
                                  placeholder={s.hintWeight != null ? String(s.hintWeight) : unit}
                                  disabled={s.done || isLocked}
                                  min={!isMobile ? 0 : undefined}
                                  step={!isMobile ? (unit === 'lbs' ? 1 : 0.5) : undefined}
                                  data-nk={`${tutId}-${i}-weight`}
                                  onChange={isMobile ? undefined : e => updateSet(tutId, i, 'weight', e.target.value)}
                                  style={{ padding: '7px 6px' }}
                                  onFocus={() => {
                                    if (!isMobile || s.done || isLocked) return
                                    const isLastSet = i === currentSets.length - 1
                                    keyboard.open({
                                      label: s.hintWeight != null ? `${t('exercises.weight')}: ${s.hintWeight} ${unit}` : t('exercises.weight'),
                                      value: String(s.weight ?? ''),
                                      onChange: v => updateSet(tutId, i, 'weight', v),
                                      isLastField: isLastSet,
                                      onNext: !isLastSet ? () => document.querySelector(`[data-nk="${tutId}-${i + 1}-reps"]`)?.focus() : undefined,
                                      onDone: () => keyboard.close(),
                                    })
                                  }}
                                />

                                {/* Complete button — requires reps ≥ 1 */}
                                <button
                                  onClick={() => !s.done && !isLocked && hasReps && handleCompleteSet(tutId, i)}
                                  style={{
                                    background: 'none', border: 'none',
                                    cursor: s.done || isLocked || !hasReps ? 'default' : 'pointer',
                                    padding: '8px 4px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    opacity: !s.done && !isLocked && !hasReps ? 0.3 : 1,
                                  }}
                                >
                                  <CheckCircle size={26} color={s.done ? 'var(--success)' : isLocked ? 'var(--border)' : hasReps ? 'var(--accent)' : 'var(--border2)'} fill={s.done ? 'var(--success)' : 'none'} strokeWidth={s.done ? 2 : 1.5} />
                                </button>

                                {/* Remove set */}
                                {!s.done && !isLocked ? (
                                  <button
                                    onClick={() => setRemoveSetModal({ tutId, setIdx: i })}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px 4px', color: 'var(--text3)', display: 'flex', alignItems: 'center' }}
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                ) : <span />}
                              </div>

                              {/* Clickable "Last: X" hints */}
                              {!s.done && !isLocked && (s.hintReps != null || s.hintWeight != null) && (
                                <div style={{ display: 'flex', gap: 6, paddingLeft: 34, paddingBottom: 10 }}>
                                  {s.hintReps != null && (
                                    <button
                                      onClick={() => updateSet(tutId, i, 'reps', s.hintReps)}
                                      style={{
                                        display: 'flex', alignItems: 'center', gap: 4,
                                        background: 'var(--surface2)', border: '1px solid var(--border)',
                                        borderRadius: 100, padding: '5px 11px', cursor: 'pointer',
                                        fontSize: '0.72rem', color: 'var(--text2)', fontWeight: 600,
                                        WebkitTapHighlightColor: 'transparent', minHeight: 32,
                                      }}
                                    >
                                      <Clock size={10} /> {t('workout.last_label')}: {s.hintReps} {t('workout.reps_label')}
                                    </button>
                                  )}
                                  {s.hintWeight != null && (
                                    <button
                                      onClick={() => updateSet(tutId, i, 'weight', s.hintWeight)}
                                      style={{
                                        display: 'flex', alignItems: 'center', gap: 4,
                                        background: 'var(--surface2)', border: '1px solid var(--border)',
                                        borderRadius: 100, padding: '5px 11px', cursor: 'pointer',
                                        fontSize: '0.72rem', color: 'var(--text2)', fontWeight: 600,
                                        WebkitTapHighlightColor: 'transparent', minHeight: 32,
                                      }}
                                    >
                                      <Clock size={10} /> {t('workout.last_label')}: {s.hintWeight} {unit}
                                    </button>
                                  )}
                                </div>
                              )}

                              {isLocked && (
                                <div style={{ paddingLeft: 34, paddingBottom: 8, fontSize: '0.7rem', color: 'var(--text3)' }}>
                                  {t('workout.complete_set_first', { num: i })}
                                </div>
                              )}
                            </div>
                          )
                        })}

                        <button
                          className="btn btn-ghost"
                          style={{ width: '100%', marginTop: 8, fontSize: '0.82rem' }}
                          onClick={() => setAddSetModal({ tutId })}
                        >
                          <Plus size={15} /> {t('workout.add_set_button')}
                        </button>
                      </div>

                      {/* Dynamic tip */}
                      {exTips[tutId] && (
                        <div style={{ marginTop: 14, padding: '12px 14px', background: 'rgba(232,255,0,0.04)', border: '1px solid rgba(232,255,0,0.12)', borderRadius: 12, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                          <span style={{ fontSize: '1rem', flexShrink: 0, marginTop: 1 }}>💡</span>
                          <p style={{ margin: 0, fontSize: '0.83rem', color: 'var(--text2)', lineHeight: 1.55 }}>{exTips[tutId]}</p>
                        </div>
                      )}

                      {/* Nav */}
                      <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                        <button className="btn btn-ghost" style={{ flex: 1 }} disabled={currentIdx === 0} onClick={() => setCurrentIdx(i => i - 1)}>
                          <ChevronLeft size={18} /> {t('workout.prev')}
                        </button>
                        {currentIdx === exercises.length - 1 ? (
                          <button className="btn btn-primary" style={{ flex: 2 }} onClick={handleRequestFinish}>
                            <Trophy size={18} /> {t('workout.finish')}
                          </button>
                        ) : (
                          <button className="btn btn-primary" style={{ flex: 2 }} onClick={handleNextExercise}>
                            {t('workout.next')} <ChevronRight size={18} />
                          </button>
                        )}
                      </div>
                    </>
                  )}

                  {/* ── Overview tab ──────────────────────────────────────── */}
                  {currentTab === 'overview' && (
                    <>
                      <OverviewTab ex={currentEx.info} />
                      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                        <button className="btn btn-ghost" style={{ flex: 1 }} disabled={currentIdx === 0} onClick={() => setCurrentIdx(i => i - 1)}>
                          <ChevronLeft size={18} /> {t('workout.prev')}
                        </button>
                        {currentIdx === exercises.length - 1 ? (
                          <button className="btn btn-primary" style={{ flex: 2 }} onClick={handleRequestFinish}>
                            <Trophy size={18} /> {t('workout.finish')}
                          </button>
                        ) : (
                          <button className="btn btn-primary" style={{ flex: 2 }} onClick={handleNextExercise}>
                            {t('workout.next')} <ChevronRight size={18} />
                          </button>
                        )}
                      </div>
                    </>
                  )}

                  {/* ── History tab ───────────────────────────────────────── */}
                  {currentTab === 'history' && (
                    <>
                      <HistoryTab tutId={tutId} data={exHistory[tutId]} unit={unit} locale={locale} />
                      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                        <button className="btn btn-ghost" style={{ flex: 1 }} disabled={currentIdx === 0} onClick={() => setCurrentIdx(i => i - 1)}>
                          <ChevronLeft size={18} /> {t('workout.prev')}
                        </button>
                        {currentIdx === exercises.length - 1 ? (
                          <button className="btn btn-primary" style={{ flex: 2 }} onClick={handleRequestFinish}>
                            <Trophy size={18} /> {t('workout.finish')}
                          </button>
                        ) : (
                          <button className="btn btn-primary" style={{ flex: 2 }} onClick={handleNextExercise}>
                            {t('workout.next')} <ChevronRight size={18} />
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </>
              )
            })()}
          </>
        )}
      </div>

      {/* Mid-workout PR celebration overlay */}
      {showCelebration && (
        <CelebrationOverlay onDone={() => setShowCelebration(false)} prExercises={prExercises} />
      )}

      {/* Finish confirm (X button) */}
      {showFinish && (
        <div className="overlay">
          <div className="sheet">
            <h3 style={{margin:'0 0 8px'}}>{t('workout.end_workout_title')}</h3>
            <p style={{color:'var(--text2)',marginBottom:20}}>{t('workout.end_workout_message')}</p>
            <div style={{display:'flex',gap:10}}>
              <button className="btn btn-ghost" style={{flex:1}} onClick={()=>setShowFinish(false)}>{t('workout.continue_workout')}</button>
              <button className="btn btn-danger" style={{flex:1}} onClick={()=>{ setShowFinish(false); handleRequestFinish() }}>{t('workout.end')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Skip incomplete sets modal */}
      {skipModal && (
        <div className="overlay" onClick={() => setSkipModal(null)}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 8px' }}>{t('workout.sets_not_completed_title')}</h3>
            <p style={{ color: 'var(--text2)', margin: '0 0 24px', fontSize: '0.95rem', lineHeight: 1.5 }}>
              {currentSets.filter(s => !s.done).length !== 1
                ? t('workout.sets_not_completed_message_plural', { count: currentSets.filter(s => !s.done).length })
                : t('workout.sets_not_completed_message', { count: 1 })}
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setSkipModal(null)}>{t('workout.stay')}</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => { setCurrentIdx(skipModal.targetIdx); setSkipModal(null) }}>{t('workout.skip')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Finish with incomplete sets modal */}
      {confirmFinishModal && (
        <div className="overlay" onClick={() => setConfirmFinishModal(false)}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 8px' }}>{t('workout.finish_workout_title')}</h3>
            <p style={{ color: 'var(--text2)', margin: '0 0 24px', fontSize: '0.95rem', lineHeight: 1.5 }}>
              {Object.values(sets).flat().filter(s => !s.done).length !== 1
                ? t('workout.finish_workout_message_plural', { count: Object.values(sets).flat().filter(s => !s.done).length })
                : t('workout.finish_workout_message', { count: 1 })}
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setConfirmFinishModal(false)}>{t('workout.keep_going')}</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => { setConfirmFinishModal(false); handleFinish() }}>{t('workout.finish_save')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Add set modal */}
      {addSetModal && (
        <div className="overlay" onClick={() => setAddSetModal(null)}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 8px' }}>{t('workout.add_set_title')}</h3>
            <p style={{ color: 'var(--text2)', margin: '0 0 24px', fontSize: '0.95rem', lineHeight: 1.5 }}>
              {t('workout.add_set_message')}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button className="btn btn-primary" onClick={() => confirmAddSet(false)}>{t('workout.just_today')}</button>
              <button className="btn btn-ghost" onClick={() => confirmAddSet(true)}>{t('workout.save_to_plan')}</button>
              <button className="btn btn-ghost" style={{ color: 'var(--text3)' }} onClick={() => setAddSetModal(null)}>{t('common.cancel')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Remove set modal */}
      {removeSetModal && (
        <div className="overlay" onClick={() => setRemoveSetModal(null)}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 8px' }}>{t('workout.remove_set_title')}</h3>
            <p style={{ color: 'var(--text2)', margin: '0 0 24px', fontSize: '0.95rem', lineHeight: 1.5 }}>
              {t('workout.remove_set_message')}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button className="btn btn-danger" onClick={() => confirmRemoveSet(false)}>{t('workout.just_today')}</button>
              <button className="btn btn-ghost" onClick={() => confirmRemoveSet(true)}>{t('workout.update_plan_too')}</button>
              <button className="btn btn-ghost" style={{ color: 'var(--text3)' }} onClick={() => setRemoveSetModal(null)}>{t('common.cancel')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Remove exercise modal */}
      {removeExModal && (
        <div className="overlay" onClick={() => setRemoveExModal(null)}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 8px' }}>{t('workout.remove_exercise_title')}</h3>
            <p style={{ color: 'var(--text2)', margin: '0 0 24px', fontSize: '0.95rem', lineHeight: 1.5 }}>
              <strong>{exercises[removeExModal.exIdx]?.info?.name}</strong> {t('workout.remove_exercise_message')}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button className="btn btn-danger" onClick={() => confirmRemoveExercise(false)}>{t('workout.just_today')}</button>
              <button className="btn btn-ghost" onClick={() => confirmRemoveExercise(true)}>{t('workout.remove_from_plan')}</button>
              <button className="btn btn-ghost" style={{ color: 'var(--text3)' }} onClick={() => setRemoveExModal(null)}>{t('common.cancel')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
