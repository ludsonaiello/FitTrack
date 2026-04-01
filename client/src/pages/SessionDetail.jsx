import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Trash2, Clock, Zap, TrendingUp, CheckCircle, Circle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { getSessionWithSets, deleteSession } from '../db/index.js'
import { getExerciseById, exImageUrl, FOCUS_LABELS } from '../lib/exercises.js'
import { getWeightUnit, toDisplay } from '../hooks/useWeightUnit.js'
import ConfirmModal from '../components/ConfirmModal.jsx'

function fmt(sec) {
  if (!sec) return '—'
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return m > 0 ? `${m}m ${s > 0 ? `${s}s` : ''}`.trim() : `${s}s`
}

function LoadingSkeleton() {
  return (
    <div className="page" style={{ paddingTop: 'calc(16px + env(safe-area-inset-top, 0px))' }}>
      {/* Header bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div style={{ width: 80, height: 32, background: 'var(--surface2)', borderRadius: 8 }} />
        <div style={{ width: 80, height: 32, background: 'var(--surface2)', borderRadius: 8 }} />
      </div>
      {/* Hero */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ width: 120, height: 14, background: 'var(--surface2)', borderRadius: 4, marginBottom: 8 }} />
        <div style={{ width: 200, height: 36, background: 'var(--surface2)', borderRadius: 8, marginBottom: 8 }} />
        <div style={{ width: 80, height: 14, background: 'var(--surface2)', borderRadius: 4 }} />
      </div>
      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 20 }}>
        {[0,1,2].map(i => (
          <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', height: 76 }} />
        ))}
      </div>
      {/* Exercise cards */}
      {[0,1,2].map(i => (
        <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 12, height: 120,
          animationDelay: `${i * 80}ms` }} />
      ))}
    </div>
  )
}

function SetRow({ set, unit, index }) {
  const weight = set.weight != null ? `${toDisplay(set.weight, unit)} ${unit}` : '—'
  const reps = set.reps ?? '—'
  const done = !!set.completed

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '28px 1fr 1fr 24px',
      gap: 8,
      alignItems: 'center',
      padding: '8px 0',
      borderBottom: '1px solid rgba(255,255,255,0.05)',
      background: done ? 'rgba(0,230,118,0.03)' : 'transparent',
      borderRadius: 4,
      transition: 'background 150ms',
      animationDelay: `${index * 30}ms`,
    }}>
      <div style={{
        fontFamily: 'Barlow Condensed',
        fontWeight: 700,
        fontSize: '1rem',
        color: done ? '#00E676' : 'var(--text3)',
        lineHeight: 1,
      }}>
        {set.setNumber}
      </div>
      <div style={{
        fontFamily: 'JetBrains Mono',
        fontWeight: 600,
        fontSize: '0.95rem',
        color: done ? 'var(--text)' : 'var(--text3)',
      }}>
        {reps}
      </div>
      <div style={{
        fontFamily: 'JetBrains Mono',
        fontWeight: 600,
        fontSize: '0.95rem',
        color: done ? 'var(--text)' : 'var(--text3)',
      }}>
        {weight}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        {done
          ? <CheckCircle size={14} color="#00E676" strokeWidth={2.5} />
          : <Circle size={14} color="var(--text3)" strokeWidth={1.5} />
        }
      </div>
    </div>
  )
}

function ExerciseCard({ tutId, sets, unit, index }) {
  const { t } = useTranslation()
  const info = getExerciseById(tutId)
  const completedSets = sets.filter(s => s.completed)
  const exVolKg = completedSets
    .filter(s => s.weight && s.reps)
    .reduce((acc, s) => acc + s.weight * s.reps, 0)
  const exVol = Math.round(toDisplay(exVolKg, unit))
  const bestSet = completedSets.reduce((best, s) => {
    if (!s.weight || !s.reps) return best
    const score = s.weight * s.reps
    return !best || score > best.weight * best.reps ? s : best
  }, null)

  const focusLabel = info?.focusArea?.[0] ? (FOCUS_LABELS[info.focusArea[0]] ?? info.focusArea[0]) : null

  return (
    <div
      className="card"
      style={{
        marginBottom: 12,
        padding: 0,
        overflow: 'hidden',
        animation: 'fadeSlideUp 300ms ease both',
        animationDelay: `${index * 50}ms`,
      }}
    >
      {/* Exercise header */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '14px 16px 12px' }}>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <img
            src={exImageUrl(tutId)}
            alt=""
            style={{ width: 48, height: 48, borderRadius: 10, objectFit: 'cover', background: 'var(--surface2)', display: 'block' }}
            onError={e => { e.target.style.display = 'none' }}
          />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: 'Barlow Condensed',
            fontWeight: 700,
            fontSize: '1.1rem',
            lineHeight: 1.2,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            color: 'var(--text)',
          }}>
            {info?.name ?? tutId.split(':').pop()}
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
            {focusLabel && (
              <span style={{
                fontSize: '0.65rem',
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: '#00E676',
                background: 'rgba(0,230,118,0.08)',
                border: '1px solid rgba(0,230,118,0.20)',
                borderRadius: 100,
                padding: '2px 8px',
              }}>
                {focusLabel}
              </span>
            )}
            <span style={{
              fontSize: '0.65rem',
              fontWeight: 600,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: 'var(--text3)',
            }}>
              {t('sessions.sets_ratio', { done: completedSets.length, total: sets.length })}
            </span>
          </div>
        </div>
        {/* Volume + best set */}
        <div style={{ flexShrink: 0, textAlign: 'right' }}>
          {exVol > 0 && (
            <>
              <div style={{
                fontFamily: 'JetBrains Mono',
                fontWeight: 600,
                fontSize: '1rem',
                color: 'var(--text)',
                lineHeight: 1,
              }}>
                {exVol.toLocaleString()}
              </div>
              <div style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2 }}>
                {unit} {t('sessions.volume_label')}
              </div>
            </>
          )}
          {bestSet && (
            <div style={{
              marginTop: 4,
              fontSize: '0.7rem',
              color: 'var(--text3)',
              fontFamily: 'JetBrains Mono',
            }}>
              {t('sessions.best_set', { weight: toDisplay(bestSet.weight, unit), unit, reps: bestSet.reps })}
            </div>
          )}
        </div>
      </div>

      {/* Set table */}
      <div style={{ padding: '0 16px 14px' }}>
        {/* Column headers */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '28px 1fr 1fr 24px',
          gap: 8,
          paddingBottom: 6,
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          marginBottom: 2,
        }}>
          {['#', t('exercises.reps'), t('exercises.weight'), ''].map((h, i) => (
            <div key={i} style={{
              fontSize: '0.6rem',
              fontWeight: 700,
              letterSpacing: '0.09em',
              textTransform: 'uppercase',
              color: 'var(--text3)',
            }}>
              {h}
            </div>
          ))}
        </div>
        {sets.sort((a, b) => a.setNumber - b.setNumber).map((s, i) => (
          <SetRow key={s.id ?? i} set={s} unit={unit} index={i} />
        ))}
      </div>
    </div>
  )
}

export default function SessionDetail() {
  const { sessionId } = useParams()
  const nav = useNavigate()
  const { t, i18n } = useTranslation()
  const locale = i18n.language
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const unit = getWeightUnit()
  const [confirmDelete, setConfirmDelete] = useState(false)

  async function handleDelete() {
    await deleteSession(Number(sessionId))
    nav(-1)
  }

  useEffect(() => {
    const id = Number(sessionId)
    if (isNaN(id)) {
      setError(true)
      setLoading(false)
      return
    }
    getSessionWithSets(id)
      .then(s => {
        setSession(s)
        setLoading(false)
      })
      .catch(() => {
        setError(true)
        setLoading(false)
      })
  }, [sessionId])

  if (loading) return <LoadingSkeleton />

  if (error || !session) {
    return (
      <div className="page">
        <button
          className="btn btn-ghost"
          style={{ padding: '8px 0', marginBottom: 24 }}
          onClick={() => nav(-1)}
        >
          <ArrowLeft size={18} /> {t('sessions.back')}
        </button>
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <div style={{ fontSize: '3rem', marginBottom: 12 }}>🔍</div>
          <p style={{ color: 'var(--text3)', margin: 0 }}>{t('sessions.session_not_found')}</p>
        </div>
      </div>
    )
  }

  const date = new Date(session.startedAt)
  const dayStr = date.toLocaleDateString(locale, { weekday: 'long' })
  const dateStr = date.toLocaleDateString(locale, { month: 'long', day: 'numeric', year: 'numeric' })
  const timeStr = date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
  const isComplete = !!session.completedAt

  // Group sets by tutorialId preserving first-seen order
  const order = []
  const byExercise = {}
  for (const s of (session.sets || [])) {
    if (!byExercise[s.tutorialId]) {
      byExercise[s.tutorialId] = []
      order.push(s.tutorialId)
    }
    byExercise[s.tutorialId].push(s)
  }

  const completedSets = (session.sets || []).filter(s => s.completed)
  const totalSets = completedSets.length
  const totalVolKg = completedSets
    .filter(s => s.weight && s.reps)
    .reduce((acc, s) => acc + s.weight * s.reps, 0)
  const totalVol = Math.round(toDisplay(totalVolKg, unit))
  const exerciseCount = order.length

  return (
    <div className="page" style={{ paddingTop: 'calc(16px + env(safe-area-inset-top, 0px))' }}>
      {confirmDelete && (
        <ConfirmModal
          title={t('sessions.delete_title')}
          message={t('sessions.delete_message')}
          confirmLabel={t('sessions.delete_label')}
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(false)}
        />
      )}

      {/* Top navigation bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <button
          className="btn btn-ghost"
          style={{ padding: '8px 12px', gap: 6, fontSize: '0.85rem' }}
          onClick={() => nav(-1)}
        >
          <ArrowLeft size={16} strokeWidth={2.5} />
          {t('sessions.back')}
        </button>
        <button
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: 'rgba(255,77,77,0.08)',
            border: '1px solid rgba(255,77,77,0.20)',
            color: '#FF4D4D',
            borderRadius: 8, padding: '8px 12px',
            fontSize: '0.85rem', fontWeight: 600,
            cursor: 'pointer', transition: 'all 150ms',
          }}
          onClick={() => setConfirmDelete(true)}
        >
          <Trash2 size={14} strokeWidth={2} />
          {t('sessions.delete_button')}
        </button>
      </div>

      {/* Hero header */}
      <div style={{ marginBottom: 20, animation: 'fadeSlideUp 280ms ease both' }}>
        <div style={{
          fontSize: '0.7rem',
          fontWeight: 700,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: '#00E676',
          marginBottom: 4,
        }}>
          {dayStr} · {timeStr}
        </div>
        <h1 style={{ margin: '0 0 6px', lineHeight: 1.05, fontSize: '2rem' }}>
          {dateStr}
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            fontSize: '0.7rem',
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            padding: '3px 10px',
            borderRadius: 100,
            background: isComplete ? 'rgba(0,230,118,0.10)' : 'rgba(255,179,0,0.10)',
            color: isComplete ? '#00E676' : '#FFB300',
            border: `1px solid ${isComplete ? 'rgba(0,230,118,0.25)' : 'rgba(255,179,0,0.25)'}`,
          }}>
            {isComplete ? `✓ ${t('sessions.complete')}` : `⏸ ${t('sessions.incomplete_label')}`}
          </span>
          {exerciseCount > 0 && (
            <span style={{ fontSize: '0.8rem', color: 'var(--text3)', fontWeight: 500 }}>
              {t('sessions.exercise_count', { count: exerciseCount })}
            </span>
          )}
        </div>
      </div>

      {/* Stats strip */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        gap: 10,
        marginBottom: 24,
        animation: 'fadeSlideUp 280ms ease both',
        animationDelay: '40ms',
      }}>
        {/* Duration */}
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          padding: '14px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          alignItems: 'flex-start',
        }}>
          <Clock size={16} color="var(--text3)" strokeWidth={1.8} />
          <div style={{ fontFamily: 'JetBrains Mono', fontWeight: 600, fontSize: '1.3rem', color: '#00E676', lineHeight: 1 }}>
            {fmt(session.durationSec)}
          </div>
          <div style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text3)' }}>
            {t('sessions.duration')}
          </div>
        </div>

        {/* Sets */}
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          padding: '14px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          alignItems: 'flex-start',
        }}>
          <Zap size={16} color="var(--text3)" strokeWidth={1.8} />
          <div style={{ fontFamily: 'JetBrains Mono', fontWeight: 600, fontSize: '1.3rem', color: '#00E676', lineHeight: 1 }}>
            {totalSets}
          </div>
          <div style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text3)' }}>
            {t('sessions.sets')}
          </div>
        </div>

        {/* Volume */}
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          padding: '14px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          alignItems: 'flex-start',
        }}>
          <TrendingUp size={16} color="var(--text3)" strokeWidth={1.8} />
          <div style={{ fontFamily: 'JetBrains Mono', fontWeight: 600, fontSize: '1.3rem', color: '#00E676', lineHeight: 1 }}>
            {totalVol > 0 ? totalVol.toLocaleString() : '—'}
          </div>
          <div style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text3)' }}>
            {t('sessions.vol_unit', { unit })}
          </div>
        </div>
      </div>

      {/* Exercises section */}
      {order.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '50px 0',
          color: 'var(--text3)',
          animation: 'fadeSlideUp 280ms ease both',
          animationDelay: '80ms',
        }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>📋</div>
          <p style={{ margin: 0, fontSize: '0.9rem' }}>{t('sessions.no_sets_in_session')}</p>
        </div>
      ) : (
        <>
          <div style={{
            fontSize: '0.65rem',
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: '#00E676',
            marginBottom: 12,
            animation: 'fadeSlideUp 280ms ease both',
            animationDelay: '60ms',
          }}>
            {t('exercises.exercises')} · {order.length}
          </div>
          {order.map((tutId, i) => (
            <ExerciseCard
              key={tutId}
              tutId={tutId}
              sets={byExercise[tutId]}
              unit={unit}
              index={i}
            />
          ))}
        </>
      )}

      {/* Notes */}
      {session.notes && (
        <div style={{
          marginTop: 8,
          padding: '14px 16px',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          animation: 'fadeSlideUp 280ms ease both',
        }}>
          <div style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 8 }}>
            {t('sessions.notes')}
          </div>
          <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text2)', lineHeight: 1.5 }}>
            {session.notes}
          </p>
        </div>
      )}
    </div>
  )
}
