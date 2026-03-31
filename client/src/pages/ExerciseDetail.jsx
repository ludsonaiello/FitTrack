import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Play, Pause, Plus, Lightbulb, Calendar, Dumbbell, BookOpen } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { getExerciseById, EQUIPMENT_LABELS, FOCUS_LABELS, LEVEL_LABELS, exImageUrl, exVideoUrl } from '../lib/exercises.js'
import { getExerciseHistory, getExercisePlans, getExerciseSessionHistory } from '../db/index.js'
import { getWeightUnit, toDisplay } from '../hooks/useWeightUnit.js'
import { BASE } from '../lib/api.js'

function resolveUrl(url) {
  if (!url) return null
  return url  // /images/... and /videos/... are same-origin static assets
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const SECTION_LABEL = {
  fontSize: '0.7rem', fontWeight: 700, color: 'var(--text3)',
  letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12,
}

// ── Active Plans ──────────────────────────────────────────────────────────────

function ActivePlans({ tutorialId }) {
  const [pairs, setPairs] = useState([])

  useEffect(() => {
    getExercisePlans(tutorialId).then(setPairs).catch(() => setPairs([]))
  }, [tutorialId])

  if (!pairs.length) return null

  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <BookOpen size={16} color="var(--accent)" />
        <div style={SECTION_LABEL}>Active in plans</div>
      </div>
      {pairs.map(({ plan, day }, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '8px 0',
          borderBottom: i < pairs.length - 1 ? '1px solid var(--border)' : 'none',
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 8,
            background: 'rgba(232,255,0,0.08)', border: '1px solid rgba(232,255,0,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Dumbbell size={16} color="var(--accent)" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: '1rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {plan.name}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text3)' }}>
              {day.name || DAYS[day.dayOfWeek]}
            </div>
          </div>
          {plan.isActive ? (
            <span style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--accent)', background: 'rgba(232,255,0,0.1)', padding: '2px 8px', borderRadius: 100 }}>
              ACTIVE
            </span>
          ) : null}
        </div>
      ))}
    </div>
  )
}

// ── Exercise History (chart + list) ──────────────────────────────────────────

function ExerciseHistory({ tutorialId }) {
  const [history, setHistory] = useState([])
  const [sessions, setSessions] = useState([])
  const [showAll, setShowAll] = useState(false)
  const unit = getWeightUnit()

  useEffect(() => {
    getExerciseHistory(tutorialId).then(setHistory).catch(() => setHistory([]))
    getExerciseSessionHistory(tutorialId).then(setSessions).catch(() => setSessions([]))
  }, [tutorialId])

  if (!sessions.length) return null

  const chartData = history.map(entry => ({
    label: entry.label,
    maxWeight: entry.maxWeight != null ? toDisplay(entry.maxWeight, unit) : null,
  }))

  const bestWeightKg = history.length ? Math.max(...history.map(e => e.maxWeight ?? 0)) : 0
  const bestWeight = toDisplay(bestWeightKg, unit)
  const prEntry = history.find(e => e.maxWeight === bestWeightKg)
  const prReps = prEntry?.reps

  const visibleSessions = showAll ? sessions : sessions.slice(0, 5)

  return (
    <>
      {/* Progress chart */}
      {history.length >= 2 && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={SECTION_LABEL}>Weight over time</div>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--text3)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--text3)' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 8, fontSize: '0.8rem' }}
                itemStyle={{ color: 'var(--accent)' }}
                labelStyle={{ color: 'var(--text3)' }}
                formatter={v => [`${v} ${unit}`, 'Max weight']}
              />
              <Line type="monotone" dataKey="maxWeight" stroke="var(--accent)" strokeWidth={2}
                dot={{ fill: 'var(--accent)', r: 3 }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
          {bestWeight > 0 && (
            <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
              <div style={{ flex: 1, background: 'var(--surface2)', borderRadius: 8, padding: '8px 12px', textAlign: 'center' }}>
                <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 800, fontSize: '1.2rem', color: 'var(--accent)' }}>
                  {bestWeight}{unit}{prReps ? ` × ${prReps}` : ''}
                </div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text3)', marginTop: 2 }}>PERSONAL RECORD</div>
              </div>
              <div style={{ flex: 1, background: 'var(--surface2)', borderRadius: 8, padding: '8px 12px', textAlign: 'center' }}>
                <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 800, fontSize: '1.2rem', color: 'var(--text)' }}>
                  {sessions.length}
                </div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text3)', marginTop: 2 }}>SESSIONS</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Session history list */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Calendar size={16} color="var(--accent)" />
          <div style={SECTION_LABEL}>Session history</div>
        </div>

        {visibleSessions.map(({ session, sets }, i) => {
          const date = new Date(session.startedAt)
          const dateStr = date.toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })
          const maxW = Math.max(...sets.map(s => s.weight ?? 0))
          const totalReps = sets.reduce((a, s) => a + (s.reps ?? 0), 0)

          return (
            <div key={session.id} style={{
              paddingBottom: 12, marginBottom: 12,
              borderBottom: i < visibleSessions.length - 1 ? '1px solid var(--border)' : 'none',
            }}>
              {/* Session header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: '0.95rem' }}>{dateStr}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text3)' }}>
                  {sets.length} set{sets.length !== 1 ? 's' : ''} · {totalReps} reps
                  {maxW > 0 ? ` · ${toDisplay(maxW, unit)}${unit} max` : ''}
                </div>
              </div>

              {/* Set rows */}
              <div style={{ display: 'grid', gridTemplateColumns: '24px 1fr 1fr 1fr', gap: '4px 8px' }}>
                <div style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>#</div>
                <div style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Reps</div>
                <div style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Weight</div>
                <div style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Vol</div>
                {sets.map((s) => {
                  const w = s.weight != null ? toDisplay(s.weight, unit) : null
                  const vol = w != null && s.reps ? Math.round(w * s.reps) : null
                  return [
                    <div key={`n-${s.id}`} style={{ fontSize: '0.85rem', fontFamily: 'Barlow Condensed', fontWeight: 700, color: 'var(--accent)' }}>{s.setNumber}</div>,
                    <div key={`r-${s.id}`} style={{ fontSize: '0.85rem', color: 'var(--text)' }}>{s.reps ?? '—'}</div>,
                    <div key={`w-${s.id}`} style={{ fontSize: '0.85rem', color: 'var(--text)' }}>{w != null ? `${w} ${unit}` : '—'}</div>,
                    <div key={`v-${s.id}`} style={{ fontSize: '0.85rem', color: 'var(--text3)' }}>{vol != null ? vol : '—'}</div>,
                  ]
                })}
              </div>
            </div>
          )
        })}

        {sessions.length > 5 && (
          <button className="btn btn-ghost" style={{ width: '100%', fontSize: '0.85rem', marginTop: 4 }}
            onClick={() => setShowAll(v => !v)}>
            {showAll ? 'Show less' : `Show all ${sessions.length} sessions`}
          </button>
        )}
      </div>
    </>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ExerciseDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const videoRef = useRef(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [ex, setEx] = useState(() => getExerciseById(decodeURIComponent(id)))
  const [loading, setLoading] = useState(!ex)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (ex) return
    const decoded = decodeURIComponent(id)
    fetch(`${BASE}/api/exercises/${encodeURIComponent(decoded)}`, { credentials: 'include' })
      .then(r => r.json())
      .then(json => {
        if (json.success) setEx(json.data)
        else setNotFound(true)
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [id, ex])

  if (loading) return (
    <div className="page">
      <button className="btn btn-ghost" onClick={() => nav(-1)}><ArrowLeft size={18} /> Back</button>
      <p style={{ color: 'var(--text3)' }}>Loading…</p>
    </div>
  )

  if (notFound || !ex) return (
    <div className="page">
      <button className="btn btn-ghost" onClick={() => nav(-1)}><ArrowLeft size={18} /> Back</button>
      <p style={{ color: 'var(--text3)' }}>Exercise not found.</p>
    </div>
  )

  const localImage = resolveUrl(ex.imageUrl) || exImageUrl(ex.id)
  const localVideo = resolveUrl(ex.mediaUrl) || exVideoUrl(ex.id)

  function togglePlay() {
    const v = videoRef.current
    if (!v) return
    if (v.paused) { v.play(); setPlaying(true) }
    else { v.pause(); setPlaying(false) }
  }

  function handleSeek(e) {
    const v = videoRef.current
    if (!v || !v.duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    v.currentTime = ((e.clientX - rect.left) / rect.width) * v.duration
  }

  return (
    <div className="page" style={{ padding: 0 }}>
      {/* Hero — video player with image fallback */}
      <div style={{ position: 'relative', height: 280, background: '#000', overflow: 'hidden' }}>

        <video
          ref={videoRef}
          src={localVideo}
          poster={localImage}
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
            ? 'linear-gradient(to bottom, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0) 40%, rgba(0,0,0,0.75) 100%)'
            : 'linear-gradient(to bottom, rgba(10,10,10,0.5) 0%, rgba(10,10,10,0.85) 100%)',
        }} />

        {/* Back button — z-index above the play tap target */}
        <button className="btn btn-icon" style={{ position: 'absolute', top: 16, left: 16, zIndex: 10 }} onClick={() => nav(-1)}>
          <ArrowLeft size={20} />
        </button>

        {/* Full-hero tap to play/pause — sits below back button */}
        <button onClick={togglePlay} style={{
          position: 'absolute', inset: 0, background: 'none', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 5,
        }}>
          {!playing && (
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              background: 'rgba(232,255,0,0.92)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
            }}>
              <Play size={28} color="#000" fill="#000" style={{ marginLeft: 3 }} />
            </div>
          )}
        </button>

        {/* Bottom: title + badges + controls */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0 16px 12px', zIndex: 6 }}>
          <h1 style={{ margin: '0 0 6px', lineHeight: 1.1 }}>{ex.name}</h1>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: playing ? 10 : 0 }}>
            <span className={`badge-${ex.experienceLevel.toLowerCase()}`}
              style={{ fontSize: '0.75rem', fontWeight: 700, padding: '3px 10px', borderRadius: 100 }}>
              {LEVEL_LABELS[ex.experienceLevel]}
            </span>
            {ex.focusArea.map(f => (
              <span key={f} style={{ fontSize: '0.75rem', color: 'var(--text2)', background: 'rgba(255,255,255,0.08)', padding: '3px 10px', borderRadius: 100 }}>
                {FOCUS_LABELS[f]}
              </span>
            ))}
          </div>

          {playing && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button onClick={e => { e.stopPropagation(); togglePlay() }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fff', padding: 0, flexShrink: 0, zIndex: 7 }}>
                <Pause size={20} />
              </button>
              <div onClick={handleSeek} style={{ flex: 1, height: 3, background: 'rgba(255,255,255,0.25)', borderRadius: 2, cursor: 'pointer' }}>
                <div style={{ width: `${progress * 100}%`, height: '100%', background: 'var(--accent)', borderRadius: 2 }} />
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={{ padding: '16px 16px 80px' }}>
        {/* Equipment */}
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>Equipment needed</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {ex.equipment.map(e => (
              <span key={e} style={{ background: 'var(--surface2)', border: '1px solid var(--border2)', fontSize: '0.85rem', padding: '5px 12px', borderRadius: 8, color: 'var(--text)' }}>
                {EQUIPMENT_LABELS[e] || e}
              </span>
            ))}
          </div>
        </div>

        {/* Tips */}
        {ex.tips?.length > 0 && (
          <div className="card" style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Lightbulb size={16} color="var(--accent)" />
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Coaching tips</div>
            </div>
            {ex.tips.map((tip, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, marginBottom: i < ex.tips.length - 1 ? 10 : 0 }}>
                <div style={{
                  width: 20, height: 20, borderRadius: '50%', background: 'rgba(232,255,0,0.12)',
                  border: '1px solid rgba(232,255,0,0.3)', flexShrink: 0, display: 'flex',
                  alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 800, color: 'var(--accent)',
                }}>
                  {i + 1}
                </div>
                <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text2)', lineHeight: 1.5 }}>{tip}</p>
              </div>
            ))}
          </div>
        )}

        {/* Which plans use this exercise */}
        <ActivePlans tutorialId={ex.id} />

        {/* Progress chart + full session history */}
        <ExerciseHistory tutorialId={ex.id} />

        <button className="btn btn-primary" style={{ width: '100%' }}
          onClick={() => nav('/planner', { state: { addExercise: ex } })}>
          <Plus size={18} /> Add to Plan
        </button>
      </div>
    </div>
  )
}
