import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ChevronDown, ChevronUp, Flame, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { getAllSessionsWithVolume, deleteSession, mergeServerSessions } from '../db/index.js'
import { getExerciseById, exImageUrl } from '../lib/exercises.js'
import { useWeightUnit, toDisplay } from '../hooks/useWeightUnit.js'
import { api, fetchWithFallback } from '../lib/api.js'
import ConfirmModal from '../components/ConfirmModal.jsx'

function fmt(sec) {
  if (!sec) return '—'
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return m > 0 ? `${m}m${s > 0 ? ` ${s}s` : ''}` : `${s}s`
}

export default function Sessions() {
  const nav = useNavigate()
  const { t, i18n } = useTranslation()
  const locale = i18n.language
  const [unit] = useWeightUnit()
  const [sessions, setSessions] = useState([])
  const [expanded, setExpanded] = useState(null)
  const [loading, setLoading] = useState(true)
  const [confirmDelete, setConfirmDelete] = useState(null) // session id to delete

  useEffect(() => {
    load()
    window.addEventListener('online', load)
    return () => window.removeEventListener('online', load)
  }, [])

  async function load() {
    const data = await fetchWithFallback(
      async () => {
        const json = await api.get('/api/workouts/sessions?limit=200')
        if (!json.success) throw new Error('bad response')
        await mergeServerSessions(json.data)
        return getAllSessionsWithVolume()
      },
      () => getAllSessionsWithVolume(),
    )
    setSessions(data)
    setLoading(false)
  }

  function handleDeleteClick(e, id) {
    e.stopPropagation()
    setConfirmDelete(id)
  }

  async function handleDeleteConfirm() {
    const id = confirmDelete
    setConfirmDelete(null)
    await deleteSession(id)
    setSessions(prev => prev.filter(s => s.id !== id))
    if (expanded === id) setExpanded(null)
  }

  // Chart: volume per session (last 20), oldest → newest
  const chartSessions = [...sessions].reverse().slice(-20)
  const chartData = chartSessions.map(s => ({
    label: new Date(s.startedAt).toLocaleDateString(locale, { month: 'short', day: 'numeric' }),
    volume: Math.round(toDisplay(s.totalVolKg, unit)),
    duration: Math.round((s.durationSec || 0) / 60),
  }))

  const totalVol = sessions.reduce((a, s) => a + s.totalVolKg, 0)
  const totalSets = sessions.reduce((a, s) => a + s.sets.filter(x => x.completed).length, 0)

  if (loading) return <div className="page" />

  return (
    <div className="page">
      {confirmDelete !== null && (
        <ConfirmModal
          title={t('sessions.delete_title')}
          message={t('sessions.delete_message')}
          confirmLabel={t('sessions.delete_label')}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button className="btn btn-ghost" style={{ padding: '6px 0' }} onClick={() => nav(-1)}>
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 style={{ margin: 0, lineHeight: 1 }}>{t('sessions.title')}<br /><span style={{ color: 'var(--accent)' }}>{t('sessions.title_accent')}</span></h1>
        </div>
      </div>

      {sessions.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <div style={{ fontSize: '3rem', marginBottom: 12 }}>🏋️</div>
          <p style={{ color: 'var(--text3)' }}>{t('sessions.no_sessions')}</p>
        </div>
      )}

      {sessions.length > 0 && (
        <>
          {/* Totals */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
            <div className="stat-box">
              <div className="stat-value">{sessions.length}</div>
              <div className="stat-label">{t('sessions.workouts')}</div>
            </div>
            <div className="stat-box">
              <div className="stat-value">{totalSets}</div>
              <div className="stat-label">{t('sessions.total_sets')}</div>
            </div>
            <div className="stat-box">
              <div className="stat-value">{Math.round(toDisplay(totalVol, unit)).toLocaleString()}</div>
              <div className="stat-label">{t('sessions.vol_unit', { unit })}</div>
            </div>
          </div>

          {/* Volume evolution chart */}
          {chartData.length >= 2 && (
            <div className="card" style={{ marginBottom: 16 }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>
                {t('sessions.volume_per_session', { unit })}
              </div>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--text3)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--text3)' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 8, fontSize: '0.8rem' }}
                    itemStyle={{ color: 'var(--accent)' }}
                    labelStyle={{ color: 'var(--text3)' }}
                    formatter={v => [`${v.toLocaleString()} ${unit}`, 'Volume']}
                  />
                  <Line type="monotone" dataKey="volume" stroke="var(--accent)" strokeWidth={2}
                    dot={{ fill: 'var(--accent)', r: 3 }} activeDot={{ r: 5 }} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Session list */}
          <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>
            {sessions.length} {t('sessions.workouts').toLowerCase()}
          </div>

          {sessions.map(s => {
            const isOpen = expanded === s.id
            const date = new Date(s.startedAt)
            const dateStr = date.toLocaleDateString(locale, { weekday: 'long', month: 'long', day: 'numeric' })
            const timeStr = date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
            const completedSets = s.sets.filter(x => x.completed)
            const vol = Math.round(toDisplay(s.totalVolKg, unit))

            // Group sets by tutorialId for expanded view
            const order = []
            const byEx = {}
            for (const set of completedSets) {
              if (!byEx[set.tutorialId]) { byEx[set.tutorialId] = []; order.push(set.tutorialId) }
              byEx[set.tutorialId].push(set)
            }

            return (
              <div key={s.id} className="card" style={{ marginBottom: 10, padding: 0, overflow: 'hidden' }}>
                {/* Row header — tap to expand */}
                <div
                  onClick={() => setExpanded(isOpen ? null : s.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', cursor: 'pointer' }}
                >
                  <div style={{
                    width: 40, height: 40, borderRadius: 8, background: 'var(--surface2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <Flame size={18} color="var(--accent)" />
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: '1rem', lineHeight: 1.2 }}>{dateStr}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text3)', marginTop: 2 }}>
                      {timeStr} · {fmt(s.durationSec)} · {completedSets.length} sets
                      {vol > 0 ? ` · ${vol.toLocaleString()} ${unit}` : ''}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button
                      onClick={e => handleDeleteClick(e, s.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 6 }}
                    >
                      <Trash2 size={15} />
                    </button>
                    {isOpen ? <ChevronUp size={16} color="var(--text3)" /> : <ChevronDown size={16} color="var(--text3)" />}
                  </div>
                </div>

                {/* Expanded exercise breakdown */}
                {isOpen && (
                  <div style={{ borderTop: '1px solid var(--border)', padding: '12px 14px' }}>
                    {order.length === 0 ? (
                      <p style={{ color: 'var(--text3)', fontSize: '0.85rem', margin: 0 }}>{t('sessions.no_sets_logged')}</p>
                    ) : order.map((tutId, ei) => {
                      const info = getExerciseById(tutId)
                      const sets = byEx[tutId].sort((a, b) => a.setNumber - b.setNumber)
                      const maxW = Math.max(...sets.map(x => x.weight ?? 0))

                      return (
                        <div key={tutId} style={{ marginBottom: ei < order.length - 1 ? 16 : 0 }}>
                          {/* Exercise header */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                            <img
                              src={exImageUrl(tutId)}
                              alt=""
                              style={{ width: 32, height: 32, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }}
                              onError={e => e.target.style.display = 'none'}
                            />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: '0.95rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {info?.name ?? tutId.split(':').pop()}
                              </div>
                              {maxW > 0 && (
                                <div style={{ fontSize: '0.7rem', color: 'var(--text3)' }}>
                                  max {toDisplay(maxW, unit)}{unit}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Set grid */}
                          <div style={{ display: 'grid', gridTemplateColumns: '20px 1fr 1fr', gap: '3px 8px', paddingLeft: 40 }}>
                            <div style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>#</div>
                            <div style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{t('exercises.reps')}</div>
                            <div style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{t('exercises.weight')}</div>
                            {sets.map(set => [
                              <div key={`n${set.id}`} style={{ fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: '0.85rem', color: 'var(--accent)' }}>{set.setNumber}</div>,
                              <div key={`r${set.id}`} style={{ fontSize: '0.85rem', color: 'var(--text)' }}>{set.reps ?? '—'}</div>,
                              <div key={`w${set.id}`} style={{ fontSize: '0.85rem', color: 'var(--text)' }}>
                                {set.weight != null ? `${toDisplay(set.weight, unit)} ${unit}` : '—'}
                              </div>,
                            ])}
                          </div>
                        </div>
                      )
                    })}

                    {/* Full detail link */}
                    <button className="btn btn-ghost" style={{ width: '100%', marginTop: 14, fontSize: '0.85rem' }}
                      onClick={() => nav(`/workout/session/${s.id}`)}>
                      {t('sessions.view_full_summary')}
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}
