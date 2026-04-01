import { useState, useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { TrendingUp, Target, Dumbbell, Calendar, Activity, ChevronRight, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceArea } from 'recharts'
import { db, getBodyWeightHistory, getActivityCalendar, getExercisePR, mergeServerWeights, mergeServerSessions } from '../db/index.js'
import { allExercises } from '../lib/exercises.js'
import { enqueue } from '../db/sync-queue.js'
import { useWeightUnit, toDisplay, toKg } from '../hooks/useWeightUnit.js'
import { api, fetchWithFallback } from '../lib/api.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useNumericKeyboard } from '../context/NumericKeyboardContext.jsx'
import { calculateBmi, classifyBmi, WHO_BANDS } from '../lib/bmi.js'

/** Format YYYY-MM-DD → short label, e.g. "Jan 5" or "Jan 5 '24" when data spans >1 year */
function makeTickFormatter(data) {
  if (!data.length) return v => v
  const years = new Set(data.map(d => d.date.slice(0, 4)))
  const multiYear = years.size > 1
  return (dateStr) => {
    const [, m, d] = dateStr.split('-')
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    const label = `${months[parseInt(m, 10) - 1]} ${parseInt(d, 10)}`
    return multiYear ? `${label} '${dateStr.slice(2, 4)}` : label
  }
}

function WeightChart({ data }) {
  const { t } = useTranslation()
  if (!data.length) return (
    <div style={{textAlign:'center',padding:'30px 0',color:'var(--text3)'}}>
      <p>{t('progress.no_weight_data')}</p>
    </div>
  )
  const tickFormatter = makeTickFormatter(data)
  // Limit number of X-axis ticks so they don't crowd on large datasets
  const interval = data.length > 60 ? Math.floor(data.length / 10) : data.length > 20 ? Math.floor(data.length / 6) : 0
  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={data} margin={{top:5,right:5,left:-20,bottom:0}}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)"/>
        <XAxis dataKey="date" tick={{fill:'var(--text3)',fontSize:11}} tickLine={false} axisLine={false}
          interval={interval} tickFormatter={tickFormatter}/>
        <YAxis tick={{fill:'var(--text3)',fontSize:11}} tickLine={false} axisLine={false}/>
        <Tooltip contentStyle={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:8,color:'var(--text)',fontSize:13}}
          labelFormatter={tickFormatter}/>
        <Line type="monotone" dataKey="weight" stroke="var(--accent)" strokeWidth={2} dot={data.length < 60} activeDot={{r:4,fill:'var(--accent)'}}/>
      </LineChart>
    </ResponsiveContainer>
  )
}

function BmiChart({ data }) {
  if (!data.length) return null
  const values = data.map(d => d.bmi)
  const minBmi = Math.min(...values)
  const maxBmi = Math.max(...values)
  const yMin = Math.max(10, Math.floor(minBmi) - 2)
  const yMax = Math.min(50, Math.ceil(maxBmi) + 2)
  const tickFormatter = makeTickFormatter(data)
  const interval = data.length > 60 ? Math.floor(data.length / 10) : data.length > 20 ? Math.floor(data.length / 6) : 0
  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={data} margin={{top:5,right:5,left:-20,bottom:0}}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)"/>
        {WHO_BANDS.map(b => (
          <ReferenceArea key={b.label} y1={Math.max(yMin, b.min)} y2={Math.min(yMax, b.max)}
            fill={b.bg} ifOverflow="hidden"/>
        ))}
        <XAxis dataKey="date" tick={{fill:'var(--text3)',fontSize:11}} tickLine={false} axisLine={false}
          interval={interval} tickFormatter={tickFormatter}/>
        <YAxis domain={[yMin, yMax]} tick={{fill:'var(--text3)',fontSize:11}} tickLine={false} axisLine={false}/>
        <Tooltip
          contentStyle={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:8,color:'var(--text)',fontSize:13}}
          labelFormatter={tickFormatter}
          formatter={(val) => {
            const cls = classifyBmi(val)
            return [`${val} — ${cls?.label ?? ''}`, 'BMI']
          }}
        />
        <Line type="monotone" dataKey="bmi" stroke="var(--accent)" strokeWidth={2} dot={data.length < 60} activeDot={{r:4,fill:'var(--accent)'}}/>
      </LineChart>
    </ResponsiveContainer>
  )
}

const CAL_VIEWS = ['7d', '30d', '60d', '90d']

function ActivityCalendar({ activity, locale }) {
  const { t } = useTranslation()
  const nav = useNavigate()
  const [view, setView] = useState('30d')
  const [selectedKey, setSelectedKey] = useState(null)

  const today = useRef(null)
  if (!today.current) {
    today.current = new Date()
    today.current.setHours(0, 0, 0, 0)
  }
  const todayDate = today.current

  function dk(d) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
  }
  const todayKey = dk(todayDate)
  const days = parseInt(view)

  // Period window for count
  const periodStart = new Date(todayDate)
  periodStart.setDate(todayDate.getDate() - (days - 1))
  const periodStartKey = dk(periodStart)

  const periodCount = useMemo(() =>
    Object.entries(activity)
      .filter(([k]) => k >= periodStartKey)
      .reduce((s, [, v]) => s + v.count, 0)
  , [activity, periodStartKey])

  // 7-day strip
  const days7 = useMemo(() => view === '7d'
    ? Array.from({ length: 7 }, (_, i) => { const d = new Date(todayDate); d.setDate(d.getDate() - (6 - i)); return d })
    : []
  , [view, todayDate])

  // Calendar grid rows for 30/60/90d
  const gridRows = useMemo(() => {
    if (view === '7d') return []
    const start = new Date(periodStart)
    start.setDate(start.getDate() - start.getDay()) // align to Sunday
    const rows = []
    let cur = new Date(start)
    let lastMonth = -1
    while (cur <= todayDate || rows.length === 0) {
      const weekDays = Array.from({ length: 7 }, () => { const d = new Date(cur); cur.setDate(cur.getDate() + 1); return d })
      const firstInRange = weekDays.find(d => d >= periodStart && d <= todayDate)
      if (firstInRange && firstInRange.getMonth() !== lastMonth) {
        lastMonth = firstInRange.getMonth()
        rows.push({ type: 'month', label: firstInRange.toLocaleDateString(locale, { month: 'long', year: 'numeric' }) })
      }
      rows.push({ type: 'week', days: weekDays })
      if (cur > todayDate) break
    }
    return rows
  }, [view, periodStart, todayDate, locale])

  const dayHeaders = Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(locale, { weekday: 'narrow' }).format(new Date(2025, 0, 5 + i))
  )

  const selectedData = selectedKey ? activity[selectedKey] : null

  function DayCell({ d, inRange = true }) {
    const key = dk(d)
    const data = activity[key]
    const count = data?.count ?? 0
    const isToday = key === todayKey
    const hasActivity = count > 0 && inRange
    const opacity = !inRange ? 0.12 : 1
    return (
      <div
        onClick={() => hasActivity && setSelectedKey(key)}
        style={{
          aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: '50%', cursor: hasActivity ? 'pointer' : 'default',
          background: hasActivity
            ? count >= 2 ? 'var(--accent)' : 'rgba(232,255,0,0.55)'
            : 'transparent',
          border: isToday && !hasActivity ? '1.5px solid var(--accent)' : '1.5px solid transparent',
          boxShadow: hasActivity ? '0 0 10px rgba(232,255,0,0.28)' : 'none',
          opacity, transition: 'transform 0.1s',
          WebkitTapHighlightColor: 'transparent',
        }}
        onPointerDown={e => hasActivity && (e.currentTarget.style.transform = 'scale(0.88)')}
        onPointerUp={e => { e.currentTarget.style.transform = 'scale(1)' }}
        onPointerLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
      >
        <span style={{
          fontSize: '0.68rem', fontWeight: isToday || hasActivity ? 700 : 400, lineHeight: 1,
          color: hasActivity && count >= 2 ? '#0a0a0a' : isToday ? 'var(--accent)' : 'var(--text3)',
        }}>
          {d.getDate()}
        </span>
      </div>
    )
  }

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h3 style={{ margin: 0 }}>{t('progress.activity_title')}</h3>
        <div style={{ display: 'flex', background: 'var(--surface2)', borderRadius: 8, padding: 2, gap: 2, border: '1px solid var(--border)' }}>
          {CAL_VIEWS.map(v => (
            <button key={v} onClick={() => setView(v)} style={{
              padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
              fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.03em',
              background: view === v ? 'var(--border2)' : 'transparent',
              color: view === v ? 'var(--text)' : 'var(--text3)',
              transition: 'all 0.15s',
            }}>
              {v}
            </button>
          ))}
        </div>
      </div>

      {view === '7d' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
          {days7.map(d => {
            const key = dk(d)
            const count = activity[key]?.count ?? 0
            const isToday = key === todayKey
            const hasActivity = count > 0
            return (
              <div key={key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                <span style={{ fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: isToday ? 'var(--accent)' : 'var(--text3)' }}>
                  {new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(d).slice(0, 3)}
                </span>
                <div
                  onClick={() => hasActivity && setSelectedKey(key)}
                  style={{
                    width: 38, height: 38, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: hasActivity ? 'pointer' : 'default',
                    background: hasActivity ? 'var(--accent)' : 'var(--surface2)',
                    border: isToday && !hasActivity ? '2px solid var(--accent)' : hasActivity ? '2px solid var(--accent)' : '2px solid var(--border)',
                    boxShadow: hasActivity ? '0 0 12px rgba(232,255,0,0.3)' : 'none',
                    transition: 'all 0.15s',
                  }}
                >
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, lineHeight: 1, color: hasActivity ? '#0a0a0a' : isToday ? 'var(--accent)' : 'var(--text3)' }}>
                    {d.getDate()}
                  </span>
                </div>
                <span style={{ fontSize: '0.6rem', fontWeight: 700, lineHeight: 1, color: hasActivity ? 'var(--accent)' : 'transparent', userSelect: 'none' }}>
                  {count > 1 ? `×${count}` : count === 1 ? '✓' : '·'}
                </span>
              </div>
            )
          })}
        </div>
      ) : (
        <>
          {/* Day headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3, marginBottom: 4 }}>
            {dayHeaders.map((h, i) => (
              <div key={i} style={{ textAlign: 'center', fontSize: '0.58rem', fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                {h}
              </div>
            ))}
          </div>

          {/* Grid with month labels */}
          {gridRows.map((row, ri) =>
            row.type === 'month' ? (
              <div key={`m${ri}`} style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.06em', textTransform: 'uppercase', padding: '8px 0 4px', marginTop: ri === 0 ? 0 : 4 }}>
                {row.label}
              </div>
            ) : (
              <div key={`w${ri}`} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3, marginBottom: 2 }}>
                {row.days.map(d => (
                  <DayCell key={dk(d)} d={d} inRange={d >= periodStart && d <= todayDate} />
                ))}
              </div>
            )
          )}
        </>
      )}

      {/* Summary footer */}
      <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '0.78rem', color: 'var(--text3)' }}>
          {t('progress.activity_period', { days })}
        </span>
        <span style={{ fontFamily: 'Barlow Condensed', fontWeight: 800, fontSize: '1rem', color: periodCount > 0 ? 'var(--accent)' : 'var(--text3)' }}>
          {periodCount} <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text3)' }}>{t('progress.workouts_label')}</span>
        </span>
      </div>

      {/* Day detail sheet */}
      {selectedKey && selectedData && createPortal(
        <div className="overlay" onClick={() => setSelectedKey(null)} style={{ zIndex: 9990, alignItems: 'flex-end' }}>
          <div
            className="sheet"
            onClick={e => e.stopPropagation()}
            style={{ maxHeight: '75dvh', display: 'flex', flexDirection: 'column', paddingBottom: 'calc(24px + env(safe-area-inset-bottom, 0px))' }}
          >
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border2)', margin: '0 auto 16px' }} />

            {/* Sheet header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexShrink: 0 }}>
              <div>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: '1.5rem', lineHeight: 1 }}>
                  {new Date(selectedKey + 'T12:00:00').toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text3)', marginTop: 3 }}>
                  {selectedData.count === 1 ? t('progress.one_session') : t('progress.n_sessions', { count: selectedData.count })}
                </div>
              </div>
              <button onClick={() => setSelectedKey(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 4 }}>
                <X size={20} />
              </button>
            </div>

            {/* Sessions list */}
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {selectedData.sessions.map((s, si) => {
                const exNames = s.tutorialIds.map(id => allExercises.find(e => e.id === id)?.name).filter(Boolean)
                return (
                  <div
                    key={s.id}
                    onClick={() => { setSelectedKey(null); nav(`/workout/session/${s.id}`) }}
                    style={{
                      background: 'var(--surface2)', borderRadius: 14, padding: '14px 16px',
                      marginBottom: 10, cursor: 'pointer',
                      border: '1px solid var(--border)',
                      WebkitTapHighlightColor: 'transparent',
                    }}
                    onPointerDown={e => e.currentTarget.style.opacity = '0.7'}
                    onPointerUp={e => e.currentTarget.style.opacity = '1'}
                    onPointerLeave={e => e.currentTarget.style.opacity = '1'}
                  >
                    {/* Session meta */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: '0.95rem' }}>
                          {t('progress.session_label')} {si + 1}
                        </span>
                        {s.durationSec > 0 && (
                          <span style={{ fontSize: '0.72rem', color: 'var(--text3)', background: 'var(--surface)', padding: '2px 8px', borderRadius: 100, border: '1px solid var(--border)' }}>
                            {Math.round(s.durationSec / 60)} min
                          </span>
                        )}
                      </div>
                      <ChevronRight size={16} color="var(--text3)" />
                    </div>

                    {/* Exercise chips */}
                    {exNames.length > 0 ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                        {exNames.map(name => (
                          <span key={name} style={{
                            fontSize: '0.72rem', fontWeight: 600,
                            padding: '4px 10px', borderRadius: 100,
                            background: 'rgba(232,255,0,0.08)',
                            color: 'var(--accent)',
                            border: '1px solid rgba(232,255,0,0.2)',
                          }}>
                            {name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span style={{ fontSize: '0.78rem', color: 'var(--text3)' }}>{t('progress.no_exercises_logged')}</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

export default function Progress() {
  const { t, i18n } = useTranslation()
  const locale = i18n.language
  const { user } = useAuth()
  const [weightData, setWeightData] = useState([])
  const [bmiData, setBmiData] = useState([])
  const [activity, setActivity] = useState({})
  const [newWeight, setNewWeight] = useState('')
  const [prs, setPRs] = useState([])
  const [totalSessions, setTotalSessions] = useState(0)
  const [totalSets, setTotalSets] = useState(0)
  const keyboard = useNumericKeyboard()
  const isMobile = useMemo(() => window.matchMedia('(pointer: coarse)').matches, [])

  const [unit] = useWeightUnit()

  useEffect(() => {
    loadAll()
    window.addEventListener('online', loadAll)
    return () => window.removeEventListener('online', loadAll)
  }, [unit])

  async function loadAll() {
    const heightCm = user?.heightCm

    function applyWeights(weights) {
      setWeightData(weights.map(w=>({date:w.loggedAt.slice(0,10),weight:Math.round(toDisplay(w.weight, unit) * 10) / 10})))
      if (heightCm) {
        setBmiData(weights
          .map(w => ({ date: w.loggedAt.slice(0,10), bmi: calculateBmi(w.weight, heightCm) }))
          .filter(d => d.bmi !== null)
        )
      }
    }

    // Online-first: fetch from server (3 retries), merge into local, render from local
    await fetchWithFallback(
      async () => {
        const json = await api.get('/api/progress/weight?limit=3650')
        if (!json.success || !Array.isArray(json.data)) throw new Error('bad response')
        await mergeServerWeights(json.data)
      },
      () => {}, // offline: skip merge, render from whatever is local
    )

    // Online-first: sync sessions so activity calendar and PRs reflect server data
    await fetchWithFallback(
      async () => {
        const json = await api.get('/api/workouts/sessions?limit=500')
        if (!json.success || !Array.isArray(json.data)) throw new Error('bad response')
        await mergeServerSessions(json.data)
      },
      () => {},
    )

    const weights = await getBodyWeightHistory()
    applyWeights(weights)
    const f = await getActivityCalendar(90)
    setActivity(f)
    const sessions = await db.sessions.filter(s=>!!s.completedAt).count()
    setTotalSessions(sessions)
    const sets = await db.exerciseSets.count()
    setTotalSets(sets)

    // Get PRs for top exercises
    const exerciseCounts = {}
    const allSets = await db.exerciseSets.toArray()
    allSets.forEach(s=>{exerciseCounts[s.tutorialId]=(exerciseCounts[s.tutorialId]||0)+1})
    const topIds = Object.entries(exerciseCounts).sort((a,b)=>b[1]-a[1]).slice(0,5).map(e=>e[0])
    const prData = await Promise.all(topIds.map(async id=>{
      const pr = await getExercisePR(id)
      const info = allExercises.find(e=>e.id===id)
      return pr && info ? {name:info.name,weight:pr.weight != null ? Math.round(toDisplay(pr.weight, unit) * 10) / 10 : null,reps:pr.reps} : null
    }))
    setPRs(prData.filter(Boolean))
  }

  async function handleLogWeight() {
    const w = parseFloat(newWeight)
    const minVal = unit === 'lbs' ? 44 : 20
    const maxVal = unit === 'lbs' ? 660 : 300
    if (!w || w < minVal || w > maxVal) return
    const weightKg = toKg(w, unit)
    const loggedAt = new Date().toISOString()
    const localId = await db.bodyWeights.add({ weight: weightKg, unit: 'kg', loggedAt })
    setNewWeight('')
    loadAll()
    // Online-first: try server (3 retries), queue if all fail
    await fetchWithFallback(
      () => api.post('/api/progress/weight', { weight: weightKg, unit: 'kg', loggedAt }),
      () => enqueue('bodyWeights', localId, { weight: weightKg, unit: 'kg', loggedAt }),
    )
  }

  return (
    <div className="page">
      <h1 style={{margin:'0 0 4px'}}>{t('progress.title')}<br/><span style={{color:'var(--accent)'}}>{t('progress.title_accent')}</span></h1>
      <p style={{margin:'0 0 20px',color:'var(--text3)',fontSize:'0.85rem'}}>{t('progress.subtitle')}</p>

      {/* Stats */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:20}}>
        <div className="stat-box">
          <Calendar size={16} color="var(--accent3)"/>
          <div className="stat-value">{totalSessions}</div>
          <div className="stat-label">{t('progress.total_sessions')}</div>
        </div>
        <div className="stat-box">
          <Dumbbell size={16} color="var(--accent)"/>
          <div className="stat-value">{totalSets}</div>
          <div className="stat-label">{t('progress.total_sets')}</div>
        </div>
      </div>

      {/* Weight chart */}
      <div className="card" style={{marginBottom:16}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
          <h3 style={{margin:0,display:'flex',alignItems:'center',gap:8}}>
            <TrendingUp size={18} color="var(--accent)"/> {t('progress.body_weight')}
          </h3>
          {weightData.length>0&&<span style={{fontSize:'0.85rem',color:'var(--accent)',fontFamily:'Barlow Condensed',fontWeight:700}}>
            {weightData[weightData.length-1].weight} {unit}
          </span>}
        </div>
        <WeightChart data={weightData}/>
        <div style={{display:'flex',gap:8,marginTop:12}}>
          <input
            type={isMobile ? 'text' : 'number'}
            inputMode={isMobile ? 'none' : undefined}
            readOnly={isMobile || undefined}
            value={newWeight}
            placeholder={t('progress.log_weight_placeholder', { unit })}
            step={!isMobile ? 0.1 : undefined}
            min={!isMobile ? (unit === 'lbs' ? 44 : 20) : undefined}
            max={!isMobile ? (unit === 'lbs' ? 660 : 300) : undefined}
            style={{flex:1}}
            onChange={isMobile ? undefined : e => setNewWeight(e.target.value)}
            onKeyDown={!isMobile ? e => e.key === 'Enter' && handleLogWeight() : undefined}
            onFocus={() => {
              if (!isMobile) return
              const lastVal = weightData.length ? `${weightData[weightData.length - 1].weight} ${unit}` : ''
              keyboard.open({
                label: lastVal ? `Last: ${lastVal}` : `Body Weight (${unit})`,
                value: newWeight,
                onChange: v => setNewWeight(v),
                isLastField: true,
                onDone: () => keyboard.close(),
              })
            }}
          />
          <button className="btn btn-primary" onClick={handleLogWeight} disabled={!newWeight}>{t('progress.log')}</button>
        </div>
      </div>

      {/* BMI tracker */}
      {user?.heightCm ? (
        <div className="card" style={{marginBottom:16}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
            <h3 style={{margin:0,display:'flex',alignItems:'center',gap:8}}>
              <Activity size={18} color="var(--accent)"/> {t('progress.bmi_tracker')}
            </h3>
            {bmiData.length > 0 && (() => {
              const latest = bmiData[bmiData.length - 1].bmi
              const cls = classifyBmi(latest)
              return (
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <span style={{fontFamily:'Barlow Condensed',fontWeight:800,fontSize:'1.1rem',color:cls.color}}>{latest}</span>
                  <span style={{
                    padding:'2px 8px',borderRadius:100,
                    background:cls.color,color:'#fff',
                    fontFamily:'Barlow Condensed',fontWeight:700,fontSize:'0.75rem',
                  }}>{cls.label}</span>
                </div>
              )
            })()}
          </div>

          {bmiData.length > 0 ? (
            <>
              <BmiChart data={bmiData}/>
              {/* WHO alert */}
              {(() => {
                const latest = bmiData[bmiData.length - 1].bmi
                const cls = classifyBmi(latest)
                if (cls.label === 'Normal') return null
                const messages = {
                  'Underweight': t('progress.bmi_underweight'),
                  'Overweight':  t('progress.bmi_overweight'),
                  'Obese I':     t('progress.bmi_obese_1'),
                  'Obese II':    t('progress.bmi_obese_2'),
                  'Obese III':   t('progress.bmi_obese_3'),
                }
                return (
                  <div style={{
                    marginTop:12, padding:'10px 14px', borderRadius:10,
                    background:`${cls.bg}`, border:`1px solid ${cls.color}44`,
                    fontSize:'0.78rem', color:'var(--text2)', lineHeight:1.6,
                  }}>
                    {messages[cls.label]}
                  </div>
                )
              })()}
              {/* Legend */}
              <div style={{display:'flex',flexWrap:'wrap',gap:'6px 12px',marginTop:12}}>
                {WHO_BANDS.slice(0,4).map(b=>(
                  <div key={b.label} style={{display:'flex',alignItems:'center',gap:5,fontSize:'0.68rem',color:'var(--text3)'}}>
                    <div style={{width:10,height:10,borderRadius:2,background:b.color,flexShrink:0}}/>
                    {b.label} {b.min}–{b.max === 60 ? '40+' : b.max}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div style={{textAlign:'center',padding:'24px 0',color:'var(--text3)',fontSize:'0.88rem'}}>
              {t('progress.log_weight_for_bmi')}
            </div>
          )}
        </div>
      ) : (
        <div className="card" style={{marginBottom:16,display:'flex',alignItems:'center',gap:12,padding:'14px 16px'}}>
          <Activity size={18} color="var(--text3)"/>
          <div style={{fontSize:'0.85rem',color:'var(--text3)'}}>
            {t('progress.add_height_for_bmi')} <strong style={{color:'var(--text)'}}>{t('progress.add_height_link')}</strong> {t('progress.add_height_suffix')}
          </div>
        </div>
      )}

      {/* Activity Calendar */}
      <ActivityCalendar activity={activity} locale={locale} />

      {/* PRs */}
      {prs.length > 0 && (
        <div className="card">
          <h3 style={{margin:'0 0 14px',display:'flex',alignItems:'center',gap:8}}>
            <Target size={18} color="var(--warning)"/> {t('progress.personal_records')}
          </h3>
          {prs.map((pr,i)=>(
            <div key={i} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 0',borderBottom:i<prs.length-1?'1px solid var(--border)':'none'}}>
              <div style={{width:32,height:32,borderRadius:8,background:'rgba(245,158,11,0.1)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                <span style={{fontSize:'0.9rem'}}>🏅</span>
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontFamily:'Barlow Condensed',fontWeight:700,fontSize:'0.95rem',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{pr.name}</div>
                <div style={{fontSize:'0.75rem',color:'var(--text3)'}}>{pr.reps} {t('progress.reps_label')}</div>
              </div>
              {pr.weight && <div style={{fontFamily:'Barlow Condensed',fontWeight:800,fontSize:'1.3rem',color:'var(--warning)'}}>{pr.weight}<span style={{fontSize:'0.7rem',fontWeight:400,color:'var(--text3)'}}>{unit}</span></div>}
            </div>
          ))}
        </div>
      )}

      {totalSessions === 0 && (
        <div style={{textAlign:'center',padding:'40px 0'}}>
          <div style={{fontSize:'3rem',marginBottom:12}}>📊</div>
          <p style={{color:'var(--text3)'}}>{t('progress.no_sessions')}</p>
        </div>
      )}
    </div>
  )
}
