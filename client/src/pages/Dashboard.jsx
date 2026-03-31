import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Flame, Zap, Trophy, ChevronRight, Plus, Share, X } from 'lucide-react'
import { db, startSession, getRecentSessions, getWorkoutFrequency, getActivePlan, getPlanWithDays, syncServerPlans } from '../db/index.js'
import { getExerciseById } from '../lib/exercises.js'
import { api, NetworkError } from '../lib/api.js'

const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

function setCookie(name, value, days) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString()
  document.cookie = `${name}=${value}; expires=${expires}; path=/; SameSite=Lax`
}
function getCookie(name) {
  return document.cookie.split('; ').find(r => r.startsWith(name + '='))?.split('=')[1] ?? null
}

function GptBanner() {
  const nav = useNavigate()
  const [show, setShow] = useState(() => getCookie('ft_gpt_banner_closed') !== '1')

  function dismiss() {
    setCookie('ft_gpt_banner_closed', '1', 365 * 100) // ~100 years
    setShow(false)
  }

  if (!show) return null

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(232,255,0,0.08) 0%, rgba(232,255,0,0.03) 100%)',
      border: '1px solid rgba(232,255,0,0.25)',
      borderRadius: 12,
      padding: '14px 14px 14px 16px',
      marginBottom: 16,
      display: 'flex',
      alignItems: 'center',
      gap: 12,
    }}>
      <span style={{ fontSize: '1.6rem', flexShrink: 0 }}>🤖</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: '1rem', color: 'var(--accent)', marginBottom: 2 }}>
          Generate your plan with ChatGPT
        </div>
        <div style={{ fontSize: '0.78rem', color: 'var(--text3)', lineHeight: 1.4, marginBottom: 10 }}>
          Let AI read your profile, pick exercises, and build a personalised plan saved directly to your account.
        </div>
        <button
          className="btn btn-primary"
          style={{ padding: '7px 16px', fontSize: '0.82rem' }}
          onClick={() => nav('/profile#gpt-instructions')}
        >
          Try it
        </button>
      </div>
      <button onClick={dismiss} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 4, flexShrink: 0, alignSelf: 'flex-start' }}>
        <X size={18} />
      </button>
    </div>
  )
}

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || !!navigator.standalone
}
function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream
}

function InstallBanner() {
  const deferredPromptRef = useRef(null)
  const [show, setShow] = useState(false)
  const [iosMode, setIosMode] = useState(false)

  useEffect(() => {
    if (isStandalone()) return // already installed
    if (localStorage.getItem('pwa_install_dismissed')) return

    if (isIOS()) {
      setIosMode(true)
      setShow(true)
      return
    }

    const handler = (e) => {
      e.preventDefault()
      deferredPromptRef.current = e
      setShow(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  function dismiss() {
    localStorage.setItem('pwa_install_dismissed', '1')
    setShow(false)
  }

  async function handleInstall() {
    if (!deferredPromptRef.current) return
    deferredPromptRef.current.prompt()
    const { outcome } = await deferredPromptRef.current.userChoice
    if (outcome === 'accepted') setShow(false)
    deferredPromptRef.current = null
  }

  if (!show) return null

  return (
    <div style={{
      background: 'var(--surface2)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      padding: '12px 14px',
      marginBottom: 16,
      display: 'flex',
      alignItems: 'flex-start',
      gap: 12,
    }}>
      <img src="/android-chrome-192x192.png" alt="" style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: '1rem', marginBottom: 2 }}>
          Add FitTrack to your Home Screen
        </div>
        {iosMode ? (
          <div style={{ fontSize: '0.78rem', color: 'var(--text3)', lineHeight: 1.5 }}>
            Tap the <Share size={12} style={{ display: 'inline', verticalAlign: 'middle' }} /> <strong style={{ color: 'var(--text2)' }}>Share</strong> button in Safari, then <strong style={{ color: 'var(--text2)' }}>Add to Home Screen</strong>.
          </div>
        ) : (
          <div style={{ fontSize: '0.78rem', color: 'var(--text3)' }}>
            Install for offline access and a better experience.
          </div>
        )}
        {!iosMode && (
          <button className="btn btn-primary" style={{ marginTop: 10, padding: '7px 16px', fontSize: '0.85rem' }} onClick={handleInstall}>
            Install App
          </button>
        )}
      </div>
      <button onClick={dismiss} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 2, flexShrink: 0 }}>
        <X size={18} />
      </button>
    </div>
  )
}

function Heatmap({ freq }) {
  const today = new Date()
  const cells = []
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0,10)
    const count = freq[key] || 0
    cells.push({ key, count })
  }
  return (
    <div style={{display:'grid',gridTemplateColumns:'repeat(10,1fr)',gap:4}}>
      {cells.map(c => (
        <div key={c.key} className={`heat-cell${c.count>=3?' heat-3':c.count===2?' heat-2':c.count===1?' heat-1':''}`}
          style={{aspectRatio:'1'}}/>
      ))}
    </div>
  )
}

export default function Dashboard() {
  const nav = useNavigate()
  const [plan, setPlan] = useState(null)
  const [todayDay, setTodayDay] = useState(null)
  const [sessions, setSessions] = useState([])
  const [freq, setFreq] = useState({})
  const [streak, setStreak] = useState(0)

  useEffect(() => {
    const dow = new Date().getDay()
    setTodayDay(dow)
    loadAll()
  }, [])

  async function loadAll() {
    // Plans — server first, local fallback when offline
    try {
      const json = await api.get('/api/workouts/plans')
      if (json.success && Array.isArray(json.data)) {
        if (json.data.length > 0) {
          const newlyActiveId = await syncServerPlans(json.data)
          if (newlyActiveId) getPlanWithDays(newlyActiveId).then(setPlan)
        }
      }
    } catch (e) {
      if (e instanceof NetworkError) {
        // Offline — read from local cache
        const localActive = await getActivePlan()
        if (localActive) getPlanWithDays(localActive.id).then(setPlan)
      } else {
        console.warn('plan sync:', e.message)
      }
    }

    // Sessions — server first, local fallback
    try {
      const json = await api.get('/api/workouts/sessions?limit=5')
      if (json.success && Array.isArray(json.data)) {
        setSessions(json.data.map(s => ({
          id: s.id,
          startedAt: s.startedAt,
          completedAt: s.completedAt,
          durationSec: s.durationSec,
        })))
      }
    } catch (e) {
      if (e instanceof NetworkError) {
        getRecentSessions(5).then(setSessions)
      }
    }

    // Frequency — always from local (derived from synced sessions)
    getWorkoutFrequency(30).then(f => {
      setFreq(f)
      let s = 0, d = new Date()
      while (true) {
        const k = d.toISOString().slice(0,10)
        if (!f[k]) break
        s++; d.setDate(d.getDate()-1)
      }
      setStreak(s)
    })
  }

  const todayPlanDay = plan?.days?.find(d => d.dayOfWeek === todayDay)

  async function handleStartWorkout() {
    const id = await startSession(plan?.id || null, todayPlanDay?.id || null)
    nav(`/workout/active/${id}`, { state: { planDay: todayPlanDay } })
  }

  const totalThisMonth = Object.values(freq).reduce((a,b)=>a+b,0)

  return (
    <div className="page">
      {/* Header */}
      <div style={{marginBottom:16}}>
        <p style={{color:'var(--text3)',fontSize:'0.8rem',fontWeight:600,letterSpacing:'0.1em',textTransform:'uppercase',margin:0}}>
          {new Date().toLocaleDateString('en',{weekday:'long',month:'long',day:'numeric'})}
        </p>
        <h1 style={{margin:'4px 0 0',lineHeight:1}}>Let's<br/><span style={{color:'var(--accent)'}}>Get After It</span></h1>
      </div>

      <InstallBanner />

      {/* Stats row */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,marginBottom:20}}>
        <div className="stat-box">
          <Flame size={18} color="var(--accent2)" />
          <div className="stat-value">{streak}</div>
          <div className="stat-label">Day streak</div>
        </div>
        <div className="stat-box">
          <Zap size={18} color="var(--accent)" />
          <div className="stat-value">{totalThisMonth}</div>
          <div className="stat-label">This month</div>
        </div>
        <div className="stat-box">
          <Trophy size={18} color="var(--warning)" />
          <div className="stat-value">{sessions.length}</div>
          <div className="stat-label">Recent</div>
        </div>
      </div>

      {/* Today's plan */}
      <div className="card" style={{marginBottom:16}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
          <div>
            <div style={{fontSize:'0.7rem',fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase',color:'var(--text3)'}}>Today</div>
            <h3 style={{margin:0}}>{todayPlanDay?.name || (plan ? 'Rest day' : 'No active plan')}</h3>
          </div>
          {todayPlanDay && <span style={{background:'rgba(232,255,0,0.1)',color:'var(--accent)',fontSize:'0.75rem',fontWeight:700,padding:'4px 10px',borderRadius:100,letterSpacing:'0.05em'}}>{todayPlanDay.exercises?.length || 0} exercises</span>}
        </div>

        {todayPlanDay?.exercises?.length > 0 && (
          <div style={{marginBottom:14}}>
            {todayPlanDay.exercises.slice(0,3).map((ex,i) => {
              const info = getExerciseById(ex.tutorialId)
              return (
                <div key={ex.id} style={{display:'flex',alignItems:'center',gap:8,padding:'5px 0',borderBottom:i<2?'1px solid var(--border)':'none'}}>
                  <div style={{width:6,height:6,borderRadius:'50%',background:'var(--accent)',flexShrink:0}}/>
                  <span style={{fontSize:'0.9rem',color:'var(--text2)'}}>{info?.name ?? ex.tutorialId.split(':').pop()}</span>
                  <span style={{marginLeft:'auto',fontSize:'0.8rem',color:'var(--text3)'}}>{ex.targetSets}×{ex.targetReps}</span>
                </div>
              )
            })}
            {todayPlanDay.exercises.length > 3 && (
              <div style={{fontSize:'0.8rem',color:'var(--text3)',paddingTop:6}}>+{todayPlanDay.exercises.length-3} more</div>
            )}
          </div>
        )}

        <button className="btn btn-primary" style={{width:'100%'}} onClick={handleStartWorkout}>
          <Zap size={18}/> Start Workout
        </button>
      </div>

      <GptBanner />

      {/* Activity heatmap */}
      <div className="card" style={{marginBottom:16}}>
        <h3 style={{margin:'0 0 12px'}}>30-Day Activity</h3>
        <Heatmap freq={freq}/>
        <div style={{display:'flex',justifyContent:'flex-end',gap:6,marginTop:8,alignItems:'center'}}>
          <span style={{fontSize:'0.7rem',color:'var(--text3)'}}>Less</span>
          {[0,1,2,3].map(n=><div key={n} className={`heat-cell heat-${n}`} style={{width:10,height:10}}/>)}
          <span style={{fontSize:'0.7rem',color:'var(--text3)'}}>More</span>
        </div>
      </div>

      {/* Recent sessions */}
      {sessions.length > 0 && (
        <div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
            <h3 style={{margin:0}}>Recent Sessions</h3>
            <button className="btn btn-ghost" style={{fontSize:'0.8rem',padding:'4px 8px'}}
              onClick={() => nav('/workout/sessions')}>
              View all
            </button>
          </div>
          {sessions.map(s => (
            <div key={s.id} className="card-sm" style={{marginBottom:8,display:'flex',alignItems:'center',gap:12,cursor:'pointer'}}
              onClick={() => nav(`/workout/session/${s.id}`)}>
              <div style={{width:40,height:40,borderRadius:8,background:'var(--surface2)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                <Flame size={18} color={s.completedAt?'var(--accent)':'var(--text3)'}/>
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontFamily:'Barlow Condensed',fontWeight:700,fontSize:'1rem'}}>
                  {new Date(s.startedAt).toLocaleDateString('en',{weekday:'short',month:'short',day:'numeric'})}
                </div>
                <div style={{fontSize:'0.8rem',color:'var(--text3)'}}>
                  {s.completedAt ? `${Math.round(s.durationSec/60)} min` : 'Incomplete'}
                </div>
              </div>
              <ChevronRight size={16} color="var(--text3)"/>
            </div>
          ))}
        </div>
      )}

      {sessions.length === 0 && (
        <div style={{textAlign:'center',padding:'40px 0'}}>
          <div style={{fontSize:'3rem',marginBottom:12}}>🏋️</div>
          <p style={{color:'var(--text3)',margin:0}}>No workouts yet.<br/>Start your first session above!</p>
        </div>
      )}
    </div>
  )
}
