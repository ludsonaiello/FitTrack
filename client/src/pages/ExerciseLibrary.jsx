import { useState, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Search, X } from 'lucide-react'
import { filterExercises, EQUIPMENT_LABELS, FOCUS_LABELS, LEVEL_LABELS, exImageUrl } from '../lib/exercises.js'
import { useExercises } from '../hooks/useExercises.js'
import { addExerciseToDay } from '../db/index.js'

const FOCUSES = Object.keys(FOCUS_LABELS)
const EQUIPMENTS = Object.keys(EQUIPMENT_LABELS)
const LEVELS = Object.keys(LEVEL_LABELS)

const REST_CHIPS = [
  { v: 30,  l: '30s'  },
  { v: 45,  l: '45s'  },
  { v: 60,  l: '1min' },
  { v: 90,  l: '90s'  },
  { v: 120, l: '2min' },
  { v: 180, l: '3min' },
]

function ExCard({ ex, onClick, onSelect }) {
  const handler = onSelect ?? onClick
  const [imgSrc, setImgSrc] = useState(() => exImageUrl(ex.id))
  function handleImgError() {
    if (ex.imageUrl && imgSrc !== ex.imageUrl) setImgSrc(ex.imageUrl)
    else setImgSrc(null)
  }
  return (
    <div className="ex-card" onClick={() => handler(ex)} style={{ marginBottom: 10 }}>
      {imgSrc && <img src={imgSrc} alt={ex.name} loading="lazy" onError={handleImgError}
        style={{ width: 80, height: 80, objectFit: 'cover', flexShrink: 0, background: 'var(--surface2)' }} />}
      <div style={{ padding: '10px 12px 10px 0', flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: '1.05rem', lineHeight: 1.2, marginBottom: 4 }}>{ex.name}</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <span className={`badge-${ex.experienceLevel.toLowerCase()}`}
            style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.06em', padding: '2px 8px', borderRadius: 100 }}>
            {LEVEL_LABELS[ex.experienceLevel]}
          </span>
          {ex.focusArea.map(f => (
            <span key={f} style={{ fontSize: '0.7rem', color: 'var(--text3)', background: 'var(--surface2)', padding: '2px 8px', borderRadius: 100 }}>
              {FOCUS_LABELS[f]}
            </span>
          ))}
        </div>
        <div style={{ marginTop: 5, fontSize: '0.75rem', color: 'var(--text3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {ex.equipment.map(e => EQUIPMENT_LABELS[e] || e).join(' · ')}
        </div>
      </div>
    </div>
  )
}

function Counter({ value, onChange, min = 1 }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
      <button
        onClick={() => onChange(Math.max(min, value - 1))}
        style={{
          width: 32, height: 32, border: '1px solid var(--border2)', background: 'var(--surface2)',
          borderRadius: '100px 0 0 100px', cursor: 'pointer', color: 'var(--text)',
          fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>−</button>
      <div style={{
        minWidth: 36, height: 32, border: '1px solid var(--border2)', borderLeft: 'none', borderRight: 'none',
        background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '0.95rem', fontWeight: 700, color: 'var(--text)',
      }}>{value}</div>
      <button
        onClick={() => onChange(value + 1)}
        style={{
          width: 32, height: 32, border: '1px solid var(--border2)', background: 'var(--surface2)',
          borderRadius: '0 100px 100px 0', cursor: 'pointer', color: 'var(--text)',
          fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>+</button>
    </div>
  )
}

function ConfigSheet({ ex, dayName, dayId, defaultRest, onClose, onAdded }) {
  const [sets, setSets]       = useState(3)
  const [reps, setReps]       = useState(10)
  const [weight, setWeight]   = useState('')
  const [rest, setRest]       = useState(defaultRest ?? 60)
  const [saving, setSaving]   = useState(false)
  const [done, setDone]       = useState(false)

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
      setTimeout(() => onAdded(), 700)
    } catch (err) {
      setSaving(false)
    }
  }

  return (
    <>
      {/* Dark backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
          zIndex: 100,
        }}
      />

      {/* Sheet */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 101,
        background: 'var(--surface)', borderRadius: '20px 20px 0 0',
        padding: '20px 16px 32px',
        boxShadow: '0 -4px 32px rgba(0,0,0,0.5)',
      }}>
        {/* Exercise header */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
          <img
            src={exImageUrl(ex.id)} alt={ex.name}
            style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 10, background: 'var(--surface2)', flexShrink: 0 }}
            onError={e => e.target.style.display = 'none'}
          />
          <div>
            <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: '1.1rem', lineHeight: 1.2 }}>{ex.name}</div>
            <span className={`badge-${ex.experienceLevel.toLowerCase()}`}
              style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.06em', padding: '2px 8px', borderRadius: 100, marginTop: 4, display: 'inline-block' }}>
              {LEVEL_LABELS[ex.experienceLevel]}
            </span>
          </div>
        </div>

        <div style={{ height: 1, background: 'var(--border2)', marginBottom: 16 }} />

        {/* Sets */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Sets</div>
          <Counter value={sets} onChange={setSets} />
        </div>

        {/* Reps */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Reps</div>
          <Counter value={reps} onChange={setReps} />
        </div>

        {/* Weight */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Weight</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="number"
              value={weight}
              onChange={e => setWeight(e.target.value)}
              placeholder="optional"
              style={{ width: 90, textAlign: 'right', padding: '6px 10px' }}
            />
            <span style={{ color: 'var(--text3)', fontSize: '0.85rem' }}>kg</span>
          </div>
        </div>

        {/* Rest */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: 8 }}>Rest</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {REST_CHIPS.map(chip => (
              <button
                key={chip.v}
                onClick={() => setRest(chip.v)}
                style={{
                  padding: '5px 12px', borderRadius: 100, fontSize: '0.8rem', fontWeight: 700,
                  border: `1px solid ${rest === chip.v ? 'var(--accent)' : 'var(--border2)'}`,
                  background: rest === chip.v ? 'var(--accent)' : 'var(--surface2)',
                  color: rest === chip.v ? '#0a0a0a' : 'var(--text)',
                  cursor: 'pointer',
                }}>
                {chip.l}
              </button>
            ))}
          </div>
        </div>

        <div style={{ height: 1, background: 'var(--border2)', marginBottom: 16 }} />

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            className="btn btn-ghost"
            style={{ flex: 1 }}
            onClick={onClose}
            disabled={saving}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            style={{ flex: 2 }}
            onClick={handleAdd}
            disabled={saving || done}>
            {done ? '✓ Added!' : saving ? 'Adding…' : `✓ Add to ${dayName}`}
          </button>
        </div>
      </div>
    </>
  )
}

export default function ExerciseLibrary() {
  const nav = useNavigate()
  const location = useLocation()

  const selectMode = !!location.state?.selectForDay
  const dayName    = location.state?.dayName ?? 'Day'
  const dayId      = location.state?.selectForDay ?? null
  const defaultRest = location.state?.defaultRest ?? 60

  const [query, setQuery]       = useState('')
  const [selFocus, setSelFocus] = useState([])
  const [selEquip, setSelEquip] = useState([])
  const [selLevel, setSelLevel] = useState([])
  const [showFilters, setShowFilters] = useState(false)
  const [sheetEx, setSheetEx]   = useState(null)

  const { data: apiData, isLoading, isOnline } = useExercises({
    q: query,
    equipment: selEquip[0],
    focus: selFocus[0],
    level: selLevel[0],
  })

  const localResults = useMemo(
    () => filterExercises({ query, focus: selFocus, equipment: selEquip, level: selLevel }),
    [query, selFocus, selEquip, selLevel]
  )
  const results = (isOnline && apiData) ? apiData : localResults

  function toggle(arr, setArr, val) {
    setArr(arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val])
  }

  function handleExerciseTap(ex) {
    if (selectMode) {
      setSheetEx(ex)
    } else {
      nav(`/exercises/${encodeURIComponent(ex.id)}`)
    }
  }

  const activeFilterCount = selFocus.length + selEquip.length + selLevel.length

  return (
    <div className="page">
      {/* Select-mode sticky banner */}
      {selectMode && (
        <div style={{
          background: 'var(--surface2)', border: '1px solid var(--border2)',
          borderRadius: 12, padding: '10px 14px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 14,
        }}>
          <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>
            Adding to{' '}
            <span style={{ color: 'var(--accent)' }}>{dayName}</span>
          </span>
          <button
            className="btn btn-ghost"
            style={{ padding: '4px 12px', fontSize: '0.8rem' }}
            onClick={() => nav(-1)}>
            Cancel
          </button>
        </div>
      )}

      <div style={{ marginBottom: 16 }}>
        <h1 style={{ margin: '0 0 4px' }}>Exercise<br /><span style={{ color: 'var(--accent)' }}>Library</span></h1>
        <p style={{ margin: 0, color: 'var(--text3)', fontSize: '0.85rem' }}>
          {results.length} of 610 exercises
          {!isOnline && (
            <span style={{
              marginLeft: 8, background: 'var(--surface2)', color: 'var(--text3)', fontSize: '0.65rem',
              fontWeight: 700, letterSpacing: '0.08em', padding: '2px 8px', borderRadius: 100, textTransform: 'uppercase',
            }}>
              Offline
            </span>
          )}
        </p>
      </div>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 10 }}>
        <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
        <input value={query} onChange={e => setQuery(e.target.value)}
          placeholder="Search exercises…" style={{ paddingLeft: 38, paddingRight: query ? 38 : 14 }} />
        {query && (
          <button onClick={() => setQuery('')}
            style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 4 }}>
            <X size={16} />
          </button>
        )}
      </div>

      {/* Filter button */}
      <button className="btn btn-ghost" style={{ marginBottom: 12, gap: 8 }}
        onClick={() => setShowFilters(!showFilters)}>
        Filters {activeFilterCount > 0 && (
          <span style={{
            background: 'var(--accent)', color: '#0a0a0a', borderRadius: '50%',
            width: 18, height: 18, fontSize: '0.7rem', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontWeight: 800,
          }}>{activeFilterCount}</span>
        )}
      </button>

      {showFilters && (
        <div className="card" style={{ marginBottom: 14 }}>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>Focus Area</div>
            <div className="chip-row">
              {FOCUSES.map(f => (
                <div key={f} className={`chip${selFocus.includes(f) ? ' active' : ''}`} onClick={() => toggle(selFocus, setSelFocus, f)}>
                  {FOCUS_LABELS[f]}
                </div>
              ))}
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>Level</div>
            <div className="chip-row">
              {LEVELS.map(l => (
                <div key={l} className={`chip${selLevel.includes(l) ? ' active' : ''}`} onClick={() => toggle(selLevel, setSelLevel, l)}>
                  {LEVEL_LABELS[l]}
                </div>
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>Equipment</div>
            <div className="chip-row" style={{ flexWrap: 'wrap', height: 'auto' }}>
              {EQUIPMENTS.map(e => (
                <div key={e} className={`chip${selEquip.includes(e) ? ' active' : ''}`} onClick={() => toggle(selEquip, setSelEquip, e)}>
                  {EQUIPMENT_LABELS[e]}
                </div>
              ))}
            </div>
          </div>
          {activeFilterCount > 0 && (
            <button className="btn btn-ghost" style={{ width: '100%', marginTop: 12 }}
              onClick={() => { setSelFocus([]); setSelEquip([]); setSelLevel([]) }}>
              Clear all filters
            </button>
          )}
        </div>
      )}

      {isOnline && isLoading && (
        <div style={{ textAlign: 'center', padding: '12px 0', color: 'var(--text3)', fontSize: '0.8rem' }}>
          Loading…
        </div>
      )}

      {/* Results */}
      <div>
        {results.map(ex => (
          <ExCard
            key={ex.id}
            ex={ex}
            onSelect={selectMode ? handleExerciseTap : undefined}
            onClick={selectMode ? undefined : () => handleExerciseTap(ex)}
          />
        ))}
        {results.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text3)' }}>
            No exercises match your filters.
          </div>
        )}
      </div>

      {/* Config sheet (select mode only) */}
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
