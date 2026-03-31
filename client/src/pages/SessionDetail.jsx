import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Flame, Trash2 } from 'lucide-react'
import { getSessionWithSets, deleteSession } from '../db/index.js'
import { getExerciseById, exImageUrl } from '../lib/exercises.js'
import { getWeightUnit, toDisplay } from '../hooks/useWeightUnit.js'
import ConfirmModal from '../components/ConfirmModal.jsx'

function fmt(sec) {
  if (!sec) return '—'
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return m > 0 ? `${m}m ${s > 0 ? `${s}s` : ''}`.trim() : `${s}s`
}

export default function SessionDetail() {
  const { sessionId } = useParams()
  const nav = useNavigate()
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const unit = getWeightUnit()
  const [confirmDelete, setConfirmDelete] = useState(false)

  async function handleDelete() {
    await deleteSession(Number(sessionId))
    nav(-1)
  }

  useEffect(() => {
    getSessionWithSets(Number(sessionId)).then(s => {
      setSession(s)
      setLoading(false)
    })
  }, [sessionId])

  if (loading) return <div className="page" />

  if (!session) return (
    <div className="page">
      <button className="btn btn-ghost" onClick={() => nav(-1)}><ArrowLeft size={18} /> Back</button>
      <p style={{ color: 'var(--text3)' }}>Session not found.</p>
    </div>
  )

  const date = new Date(session.startedAt)
  const dateStr = date.toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric' })
  const timeStr = date.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })

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

  const totalSets = (session.sets || []).filter(s => s.completed).length
  const totalVolKg = (session.sets || [])
    .filter(s => s.completed && s.weight && s.reps)
    .reduce((acc, s) => acc + s.weight * s.reps, 0)
  const totalVol = Math.round(toDisplay(totalVolKg, unit))

  return (
    <div className="page">
      {confirmDelete && (
        <ConfirmModal
          title="Delete session?"
          message="This workout session will be permanently deleted. This cannot be undone."
          confirmLabel="Delete"
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <button className="btn btn-ghost" style={{ padding: '6px 0' }} onClick={() => nav(-1)}>
          <ArrowLeft size={18} /> Back
        </button>
        <button className="btn btn-ghost" style={{ color: 'var(--error, #ef4444)', padding: '6px 10px' }}
          onClick={() => setConfirmDelete(true)}>
          <Trash2 size={16} /> Delete
        </button>
      </div>

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          {dateStr}
        </div>
        <h1 style={{ margin: '4px 0 0', lineHeight: 1 }}>
          Workout<br /><span style={{ color: 'var(--accent)' }}>Summary</span>
        </h1>
        <div style={{ color: 'var(--text3)', fontSize: '0.85rem', marginTop: 4 }}>{timeStr}</div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 20 }}>
        <div className="stat-box">
          <div className="stat-value">{fmt(session.durationSec)}</div>
          <div className="stat-label">Duration</div>
        </div>
        <div className="stat-box">
          <div className="stat-value">{totalSets}</div>
          <div className="stat-label">Sets</div>
        </div>
        <div className="stat-box">
          <div className="stat-value">{totalVol > 0 ? `${totalVol.toLocaleString()}` : '—'}</div>
          <div className="stat-label">Vol ({unit})</div>
        </div>
      </div>

      {/* Exercises */}
      {order.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text3)' }}>
          No sets were logged in this session.
        </div>
      ) : (
        order.map(tutId => {
          const info = getExerciseById(tutId)
          const sets = byExercise[tutId].sort((a, b) => a.setNumber - b.setNumber)
          const exVol = sets
            .filter(s => s.completed && s.weight && s.reps)
            .reduce((acc, s) => acc + s.weight * s.reps, 0)

          return (
            <div key={tutId} className="card" style={{ marginBottom: 12 }}>
              {/* Exercise header */}
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
                {info && (
                  <img
                    src={exImageUrl(tutId)}
                    alt=""
                    style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }}
                    onError={e => e.target.style.display = 'none'}
                  />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: '1.05rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {info?.name ?? tutId}
                  </div>
                  {exVol > 0 && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text3)' }}>
                      {Math.round(toDisplay(exVol, unit)).toLocaleString()} {unit} volume
                    </div>
                  )}
                </div>
              </div>

              {/* Set rows */}
              <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr 1fr', gap: 4 }}>
                <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', paddingBottom: 4 }}>#</div>
                <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', paddingBottom: 4 }}>Reps</div>
                <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', paddingBottom: 4 }}>Weight</div>
                {sets.map((s, i) => (
                  <>
                    <div key={`n-${i}`} style={{ fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: '1rem', color: s.completed ? 'var(--accent)' : 'var(--text3)' }}>{s.setNumber}</div>
                    <div key={`r-${i}`} style={{ fontSize: '0.95rem', color: 'var(--text)' }}>{s.reps ?? '—'}</div>
                    <div key={`w-${i}`} style={{ fontSize: '0.95rem', color: 'var(--text)' }}>
                      {s.weight != null ? `${toDisplay(s.weight, unit)} ${unit}` : '—'}
                    </div>
                  </>
                ))}
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
