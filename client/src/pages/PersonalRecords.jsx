import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Trophy, ChevronRight, Search, X, SlidersHorizontal } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { getAllPRs, mergeServerSessions } from '../db/index.js'
import { allExercises, FOCUS_LABELS, LEVEL_LABELS } from '../lib/exercises.js'
import { useWeightUnit, toDisplay } from '../hooks/useWeightUnit.js'
import { api, fetchWithFallback } from '../lib/api.js'

const LEVEL_COLORS = {
  beginner:     { text: '#4ade80', bg: 'rgba(74,222,128,0.12)' },
  intermediate: { text: '#fbbf24', bg: 'rgba(251,191,36,0.12)' },
  advanced:     { text: '#f87171', bg: 'rgba(248,113,113,0.12)' },
}

const SORT_OPTIONS = ['date_desc', 'date_asc', 'weight_desc', 'volume_desc', 'name_asc']

export default function PersonalRecords() {
  const { t, i18n } = useTranslation()
  const locale = i18n.language
  const nav = useNavigate()
  const [unit] = useWeightUnit()

  const [prs, setPRs] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [sortBy, setSortBy] = useState('date_desc')
  const [filterFocus, setFilterFocus] = useState(null)
  const [filterLevel, setFilterLevel] = useState(null)
  const [showFilters, setShowFilters] = useState(false)

  useEffect(() => {
    async function load() {
      // Online-first: sync sessions from server before reading PRs from local DB
      await fetchWithFallback(
        async () => {
          const json = await api.get('/api/workouts/sessions?limit=500')
          if (!json.success || !Array.isArray(json.data)) throw new Error('bad response')
          await mergeServerSessions(json.data)
        },
        () => {}, // offline: skip merge, render from whatever is local
      )
      const raw = await getAllPRs()
      const enriched = raw
        .map(pr => {
          const info = allExercises.find(e => e.id === pr.tutorialId)
          if (!info) return null
          return {
            ...pr,
            name: info.name,
            focusArea: info.focusArea ?? [],
            level: info.experienceLevel ?? 'beginner',
            equipment: info.equipment ?? [],
            displayWeight: pr.weight != null ? Math.round(toDisplay(pr.weight, unit) * 10) / 10 : null,
            displayVolume: pr.volume > 0 ? Math.round(toDisplay(pr.volume, unit) * 10) / 10 : null,
          }
        })
        .filter(Boolean)
      setPRs(enriched)
      setLoading(false)
    }
    load()
  }, [unit])

  const focuses = useMemo(() => [...new Set(prs.flatMap(p => p.focusArea))].sort(), [prs])
  const levels  = useMemo(() => [...new Set(prs.map(p => p.level))].sort(), [prs])

  const filtered = useMemo(() => {
    let out = prs
    if (query.trim()) {
      const q = query.toLowerCase()
      out = out.filter(p => p.name.toLowerCase().includes(q))
    }
    if (filterFocus) out = out.filter(p => p.focusArea.includes(filterFocus))
    if (filterLevel) out = out.filter(p => p.level === filterLevel)
    return out
  }, [prs, query, filterFocus, filterLevel])

  const sorted = useMemo(() => {
    const out = [...filtered]
    switch (sortBy) {
      case 'date_asc':    return out.sort((a, b) => a.achievedAt.localeCompare(b.achievedAt))
      case 'weight_desc': return out.sort((a, b) => (b.displayWeight ?? 0) - (a.displayWeight ?? 0))
      case 'volume_desc': return out.sort((a, b) => (b.displayVolume ?? 0) - (a.displayVolume ?? 0))
      case 'name_asc':    return out.sort((a, b) => a.name.localeCompare(b.name))
      default:            return out.sort((a, b) => b.achievedAt.localeCompare(a.achievedAt))
    }
  }, [filtered, sortBy])

  const activeFilterCount = (filterFocus ? 1 : 0) + (filterLevel ? 1 : 0)

  function formatDate(iso) {
    return new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })
  }

  if (loading) {
    return (
      <div className="page">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <button onClick={() => nav(-1)} className="btn btn-ghost" style={{ padding: '6px 10px' }}>←</button>
          <h1 style={{ margin: 0 }}>{t('pr.title')}</h1>
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="card" style={{ marginBottom: 10, height: 80, opacity: 0.4, animation: 'pulse 1.5s ease-in-out infinite' }} />
        ))}
      </div>
    )
  }

  if (!prs.length) {
    return (
      <div className="page">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <button onClick={() => nav(-1)} className="btn btn-ghost" style={{ padding: '6px 10px' }}>←</button>
          <h1 style={{ margin: 0 }}>{t('pr.title')}</h1>
        </div>
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <div style={{ fontSize: '3.5rem', marginBottom: 16 }}>🏅</div>
          <p style={{ color: 'var(--text3)', margin: 0, fontSize: '0.95rem' }}>{t('pr.empty')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <button onClick={() => nav(-1)} className="btn btn-ghost" style={{ padding: '6px 10px', flexShrink: 0 }}>←</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ margin: 0, lineHeight: 1 }}>
            {t('pr.title_line1')}<br />
            <span style={{ color: 'var(--accent)' }}>{t('pr.title_line2')}</span>
          </h1>
        </div>
      </div>
      <p style={{ margin: '0 0 16px', color: 'var(--text3)', fontSize: '0.82rem' }}>
        {t('pr.subtitle', { count: prs.length })}
      </p>

      {/* Search + filter bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <Search size={15} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', pointerEvents: 'none' }} />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={t('pr.search_placeholder')}
            style={{ width: '100%', paddingLeft: 34, paddingRight: query ? 32 : 12, boxSizing: 'border-box' }}
          />
          {query && (
            <button onClick={() => setQuery('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', display: 'flex', padding: 0 }}>
              <X size={14} />
            </button>
          )}
        </div>
        <button
          onClick={() => setShowFilters(v => !v)}
          className={showFilters || activeFilterCount > 0 ? 'btn btn-primary' : 'btn btn-ghost'}
          style={{ padding: '0 14px', flexShrink: 0, position: 'relative', display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <SlidersHorizontal size={15} />
          {activeFilterCount > 0 && (
            <span style={{ background: 'var(--accent)', color: '#0a0a0a', borderRadius: '50%', width: 16, height: 16, fontSize: '0.65rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* Filters panel */}
      {showFilters && (
        <div className="card" style={{ marginBottom: 12, padding: '12px 14px' }}>
          {/* Sort */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 6 }}>
              {t('pr.sort_by')}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {SORT_OPTIONS.map(opt => (
                <button
                  key={opt}
                  onClick={() => setSortBy(opt)}
                  style={{
                    padding: '5px 12px', borderRadius: 100, fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
                    background: sortBy === opt ? 'var(--accent)' : 'var(--surface2)',
                    color: sortBy === opt ? '#0a0a0a' : 'var(--text2)',
                    border: `1px solid ${sortBy === opt ? 'var(--accent)' : 'var(--border2)'}`,
                  }}
                >
                  {t(`pr.sort.${opt}`)}
                </button>
              ))}
            </div>
          </div>

          {/* Focus filter */}
          {focuses.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 6 }}>
                {t('pr.filter_focus')}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {focuses.map(f => (
                  <button
                    key={f}
                    onClick={() => setFilterFocus(prev => prev === f ? null : f)}
                    style={{
                      padding: '5px 12px', borderRadius: 100, fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
                      background: filterFocus === f ? 'var(--accent)' : 'var(--surface2)',
                      color: filterFocus === f ? '#0a0a0a' : 'var(--text2)',
                      border: `1px solid ${filterFocus === f ? 'var(--accent)' : 'var(--border2)'}`,
                    }}
                  >
                    {t(`filters.focus.${f}`, { defaultValue: FOCUS_LABELS[f] ?? f })}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Level filter */}
          {levels.length > 0 && (
            <div>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 6 }}>
                {t('pr.filter_level')}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {levels.map(lv => {
                  const c = LEVEL_COLORS[lv] ?? LEVEL_COLORS.beginner
                  const active = filterLevel === lv
                  return (
                    <button
                      key={lv}
                      onClick={() => setFilterLevel(prev => prev === lv ? null : lv)}
                      style={{
                        padding: '5px 12px', borderRadius: 100, fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
                        background: active ? c.bg : 'var(--surface2)',
                        color: active ? c.text : 'var(--text2)',
                        border: `1px solid ${active ? c.text + '66' : 'var(--border2)'}`,
                      }}
                    >
                      {t(`filters.level.${lv}`, { defaultValue: LEVEL_LABELS[lv] ?? lv })}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Results count */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: '0.78rem', color: 'var(--text3)', fontWeight: 600 }}>
          {t('pr.results_count', { count: sorted.length })}
        </span>
        {(filterFocus || filterLevel) && (
          <button
            onClick={() => { setFilterFocus(null); setFilterLevel(null) }}
            className="btn btn-ghost"
            style={{ fontSize: '0.75rem', padding: '3px 8px' }}
          >
            {t('pr.clear_filters')}
          </button>
        )}
      </div>

      {/* PR List */}
      {sorted.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text3)', fontSize: '0.9rem' }}>
          {t('pr.no_results')}
        </div>
      ) : (
        sorted.map((pr, i) => {
          const lvl = LEVEL_COLORS[pr.level] ?? LEVEL_COLORS.beginner
          return (
            <div
              key={pr.tutorialId}
              onClick={() => nav(`/exercises/${pr.tutorialId}`)}
              style={{
                display: 'flex', alignItems: 'center', gap: 14,
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 14, padding: '14px 14px 14px 16px',
                marginBottom: 10, cursor: 'pointer',
                opacity: 0, animation: `fadeSlideUp 0.22s ease forwards`,
                animationDelay: `${Math.min(i * 30, 300)}ms`,
                WebkitTapHighlightColor: 'transparent',
              }}
              onPointerDown={e => e.currentTarget.style.background = 'var(--surface2)'}
              onPointerUp={e => e.currentTarget.style.background = 'var(--surface)'}
              onPointerLeave={e => e.currentTarget.style.background = 'var(--surface)'}
            >
              {/* Medal icon */}
              <div style={{
                width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                background: 'rgba(245,158,11,0.1)',
                border: '1px solid rgba(245,158,11,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1.3rem',
              }}>
                🏅
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
                  fontSize: '1.05rem', lineHeight: 1.2, marginBottom: 4,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {pr.name}
                </div>

                {/* Badges row */}
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 5 }}>
                  <span style={{
                    fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.05em',
                    padding: '2px 7px', borderRadius: 100,
                    color: lvl.text, background: lvl.bg, textTransform: 'uppercase',
                  }}>
                    {t(`filters.level.${pr.level}`, { defaultValue: LEVEL_LABELS[pr.level] ?? pr.level })}
                  </span>
                  {pr.focusArea.slice(0, 2).map(f => (
                    <span key={f} style={{
                      fontSize: '0.65rem', color: 'var(--text3)',
                      background: 'var(--surface2)', padding: '2px 7px', borderRadius: 100,
                    }}>
                      {t(`filters.focus.${f}`, { defaultValue: FOCUS_LABELS[f] ?? f })}
                    </span>
                  ))}
                </div>

                {/* Date + sets */}
                <div style={{ fontSize: '0.72rem', color: 'var(--text3)' }}>
                  {formatDate(pr.achievedAt)} · {t('pr.sets_count', { count: pr.totalSets })}
                </div>
              </div>

              {/* Weight / reps */}
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                {pr.displayWeight != null ? (
                  <>
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: '1.5rem', color: 'var(--warning)', lineHeight: 1 }}>
                      {pr.displayWeight}
                    </div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text3)', lineHeight: 1.4 }}>
                      {unit} · {pr.reps} {t('pr.reps')}
                    </div>
                  </>
                ) : pr.reps ? (
                  <>
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: '1.5rem', color: 'var(--accent)', lineHeight: 1 }}>
                      {pr.reps}
                    </div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text3)' }}>{t('pr.reps')}</div>
                  </>
                ) : null}
                <ChevronRight size={14} color="var(--text3)" style={{ marginTop: 4 }} />
              </div>
            </div>
          )
        })
      )}

      <div style={{ height: 24 }} />
    </div>
  )
}
