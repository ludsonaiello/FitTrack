import { useState, useEffect } from 'react'
import { User, Target, Bell, Trash2, Download, LogOut, Scale, Plus, ExternalLink, Shield, Ruler } from 'lucide-react'
import { db } from '../db/index.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useWeightUnit } from '../hooks/useWeightUnit.js'
import ConfirmModal from '../components/ConfirmModal.jsx'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { api } from '../lib/api.js'
import { enqueue } from '../db/sync-queue.js'
import { calculateBmi, classifyBmi, cmToFtIn, ftInToCm } from '../lib/bmi.js'

const GOAL_TYPES = [
  {value:'WEIGHT',label:'Target Body Weight',unit:'kg'},
  {value:'FREQUENCY',label:'Workouts per Week',unit:'x/week'},
]

export default function Profile() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [weightUnit, setWeightUnit] = useWeightUnit()
  const [name, setName] = useState(() => user?.name || localStorage.getItem('ft_name') || '')
  const [goals, setGoals] = useState([])
  const [newGoalType, setNewGoalType] = useState('weight')
  const [newGoalValue, setNewGoalValue] = useState('')
  const [dbStats, setDbStats] = useState({sessions:0,sets:0,weights:0})
  const [notifPerm, setNotifPerm] = useState(typeof Notification!=='undefined'?Notification.permission:'unsupported')
  const [confirmClear, setConfirmClear] = useState(false)

  // Body stats
  const [sex, setSex] = useState(user?.sex || '')
  const [heightUnit, setHeightUnit] = useState(user?.heightUnit || 'cm')
  const [heightCm, setHeightCm] = useState(() => user?.heightCm ? String(Math.round(user.heightCm)) : '')
  const [heightFt, setHeightFt] = useState(() => {
    if (!user?.heightCm) return ''
    const { feet } = cmToFtIn(user.heightCm)
    return String(feet)
  })
  const [heightIn, setHeightIn] = useState(() => {
    if (!user?.heightCm) return '0'
    const { inches } = cmToFtIn(user.heightCm)
    return String(inches)
  })
  const [latestWeightKg, setLatestWeightKg] = useState(null)
  const [bodyStatsSaving, setBodyStatsSaving] = useState(false)

  useEffect(() => {
    if (location.hash) {
      const el = document.getElementById(location.hash.slice(1))
      if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
    }
  }, [location.hash])

  useEffect(() => {
    db.goals.toArray().then(setGoals)
    Promise.all([
      db.sessions.count(),
      db.exerciseSets.count(),
      db.bodyWeights.count(),
    ]).then(([sessions,sets,weights])=>setDbStats({sessions,sets,weights}))
    db.bodyWeights.orderBy('loggedAt').reverse().first().then(w => {
      if (w) setLatestWeightKg(w.weight)
    })
  },[])

  function saveName() { localStorage.setItem('ft_name', name) }

  async function saveBodyStats() {
    setBodyStatsSaving(true)
    const computed = heightUnit === 'ft'
      ? ftInToCm(heightFt || 0, heightIn || 0)
      : parseFloat(heightCm) || 0
    const patch = { heightUnit }
    if (sex) patch.sex = sex
    if (computed >= 50) patch.heightCm = computed
    try {
      await api.patch('/api/auth/me', patch)
    } catch { /* offline — ignore */ }
    setBodyStatsSaving(false)
  }

  async function addGoal() {
    if (!newGoalValue) return
    const payload = {
      type: newGoalType,
      targetValue: parseFloat(newGoalValue),
    }
    const id = await db.goals.add({
      ...payload,
      achieved: false,
      createdAt: new Date().toISOString(),
    })
    setGoals(await db.goals.toArray())
    setNewGoalValue('')
    // Queue for sync
    enqueue('goals', id, payload)
  }

  async function deleteGoal(id) {
    await db.goals.delete(id)
    setGoals(await db.goals.toArray())
  }

  async function requestNotif() {
    if (typeof Notification === 'undefined') return
    const perm = await Notification.requestPermission()
    setNotifPerm(perm)
  }

  async function clearData() {
    await db.sessions.clear()
    await db.exerciseSets.clear()
    await db.bodyWeights.clear()
    await db.goals.clear()
    await db.plans.clear()
    await db.planDays.clear()
    await db.planExercises.clear()
    setDbStats({sessions:0,sets:0,weights:0})
    setGoals([])
  }

  function exportData() {
    Promise.all([
      db.sessions.toArray(),
      db.exerciseSets.toArray(),
      db.bodyWeights.toArray(),
    ]).then(([sessions,sets,weights]) => {
      const blob = new Blob([JSON.stringify({sessions,sets,weights},null,2)],{type:'application/json'})
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `fittrack-export-${new Date().toISOString().slice(0,10)}.json`
      a.click()
    })
  }

  return (
    <div className="page">
      {confirmClear && (
        <ConfirmModal
          title="Delete all data?"
          message="This will permanently delete all sessions, sets, weight logs, goals, and plans. This cannot be undone."
          confirmLabel="Delete all"
          onConfirm={() => { setConfirmClear(false); clearData() }}
          onCancel={() => setConfirmClear(false)}
        />
      )}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:20}}>
        <h1 style={{margin:0}}>Profile &<br/><span style={{color:'var(--accent)'}}>Settings</span></h1>
        <div style={{display:'flex',gap:8}}>
          {user?.isAdmin && (
            <button className="btn btn-ghost" style={{padding:'8px 12px',fontSize:'0.85rem',gap:6,color:'var(--accent)'}} onClick={() => navigate('/admin')}>
              <Shield size={15}/> Admin
            </button>
          )}
          <button className="btn btn-ghost" style={{padding:'8px 12px',fontSize:'0.85rem',gap:6}} onClick={logout}>
            <LogOut size={15}/> Sign out
          </button>
        </div>
      </div>

      {/* Name */}
      <div className="card" style={{marginBottom:12}}>
        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12}}>
          <User size={16} color="var(--accent)"/>
          <div style={{fontSize:'0.7rem',fontWeight:700,color:'var(--text3)',letterSpacing:'0.1em',textTransform:'uppercase'}}>Your Name</div>
        </div>
        <div style={{display:'flex',gap:8}}>
          <input value={name} onChange={e=>setName(e.target.value)} placeholder="Enter your name" style={{flex:1}}/>
          <button className="btn btn-primary" onClick={saveName}>Save</button>
        </div>
      </div>

      {/* Weight Unit */}
      <div className="card" style={{marginBottom:12}}>
        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12}}>
          <Scale size={16} color="var(--accent)"/>
          <div style={{fontSize:'0.7rem',fontWeight:700,color:'var(--text3)',letterSpacing:'0.1em',textTransform:'uppercase'}}>Weight Unit</div>
        </div>
        <div style={{display:'flex',gap:8}}>
          {['kg','lbs'].map(u => (
            <button
              key={u}
              onClick={() => setWeightUnit(u)}
              style={{
                flex:1, padding:'10px 0', borderRadius:10, border:'1px solid var(--border)',
                background: weightUnit === u ? 'var(--accent)' : 'var(--surface2)',
                color: weightUnit === u ? '#000' : 'var(--text)',
                fontFamily:'Barlow Condensed', fontWeight:700, fontSize:'1.1rem',
                cursor:'pointer', letterSpacing:'0.05em',
              }}
            >{u}</button>
          ))}
        </div>
        <div style={{marginTop:8,fontSize:'0.75rem',color:'var(--text3)'}}>
          Affects workout tracking and progress displays.
        </div>
      </div>

      {/* Body Stats */}
      {(() => {
        const computedHeightCm = heightUnit === 'ft'
          ? ftInToCm(heightFt || 0, heightIn || 0)
          : parseFloat(heightCm) || 0
        const bmi = calculateBmi(latestWeightKg, computedHeightCm >= 50 ? computedHeightCm : user?.heightCm)
        const cls = classifyBmi(bmi)
        return (
          <div className="card" style={{marginBottom:12}}>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:14}}>
              <Ruler size={16} color="var(--accent)"/>
              <div style={{fontSize:'0.7rem',fontWeight:700,color:'var(--text3)',letterSpacing:'0.1em',textTransform:'uppercase'}}>Body Stats & BMI</div>
            </div>

            {/* Sex */}
            <div style={{marginBottom:14}}>
              <div style={{fontSize:'0.75rem',color:'var(--text3)',marginBottom:8}}>Biological sex</div>
              <div style={{display:'flex',gap:8}}>
                {[{v:'male',l:'Male'},{v:'female',l:'Female'},{v:'unspecified',l:'Other'}].map(opt=>(
                  <button key={opt.v} onClick={()=>setSex(opt.v)} style={{
                    flex:1, padding:'10px 4px', borderRadius:10,
                    border:`1px solid ${sex===opt.v?'var(--accent)':'var(--border)'}`,
                    background:sex===opt.v?'rgba(232,255,0,0.1)':'var(--surface2)',
                    color:sex===opt.v?'var(--accent)':'var(--text)',
                    fontFamily:'Barlow Condensed', fontWeight:700, fontSize:'0.9rem',
                    cursor:'pointer', transition:'all 0.15s',
                  }}>{opt.l}</button>
                ))}
              </div>
            </div>

            {/* Height */}
            <div style={{marginBottom:14}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                <div style={{fontSize:'0.75rem',color:'var(--text3)'}}>Height</div>
                <div style={{display:'flex',gap:6}}>
                  {['cm','ft'].map(u=>(
                    <button key={u} onClick={()=>setHeightUnit(u)} style={{
                      padding:'3px 10px', borderRadius:6,
                      border:`1px solid ${heightUnit===u?'var(--accent)':'var(--border)'}`,
                      background:heightUnit===u?'rgba(232,255,0,0.1)':'transparent',
                      color:heightUnit===u?'var(--accent)':'var(--text3)',
                      fontSize:'0.75rem', fontWeight:700, cursor:'pointer',
                    }}>{u==='cm'?'cm':'ft/in'}</button>
                  ))}
                </div>
              </div>
              {heightUnit==='cm' ? (
                <div style={{position:'relative'}}>
                  <input type="number" value={heightCm} onChange={e=>setHeightCm(e.target.value)}
                    placeholder="170" min={50} max={275}
                    style={{width:'100%',boxSizing:'border-box',paddingRight:48}}/>
                  <span style={{position:'absolute',right:12,top:'50%',transform:'translateY(-50%)',color:'var(--text3)',fontSize:'0.85rem',fontFamily:'Barlow Condensed',fontWeight:700}}>cm</span>
                </div>
              ) : (
                <div style={{display:'flex',gap:8}}>
                  <div style={{position:'relative',flex:1}}>
                    <input type="number" value={heightFt} onChange={e=>setHeightFt(e.target.value)}
                      placeholder="5" min={3} max={8} style={{width:'100%',boxSizing:'border-box',paddingRight:36}}/>
                    <span style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',color:'var(--text3)',fontSize:'0.85rem',fontFamily:'Barlow Condensed',fontWeight:700}}>ft</span>
                  </div>
                  <div style={{position:'relative',flex:1}}>
                    <input type="number" value={heightIn} onChange={e=>setHeightIn(e.target.value)}
                      placeholder="10" min={0} max={11} style={{width:'100%',boxSizing:'border-box',paddingRight:36}}/>
                    <span style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',color:'var(--text3)',fontSize:'0.85rem',fontFamily:'Barlow Condensed',fontWeight:700}}>in</span>
                  </div>
                </div>
              )}
            </div>

            {/* BMI display */}
            {bmi !== null && (
              <div style={{
                display:'flex', alignItems:'center', justifyContent:'space-between',
                padding:'12px 14px', borderRadius:10, marginBottom:14,
                background:`${cls.bg}`, border:`1px solid ${cls.color}33`,
              }}>
                <div>
                  <div style={{fontSize:'0.7rem',color:'var(--text3)',fontWeight:700,letterSpacing:'0.08em',textTransform:'uppercase',marginBottom:2}}>Your BMI</div>
                  <div style={{fontFamily:'Barlow Condensed',fontWeight:800,fontSize:'1.8rem',color:cls.color,lineHeight:1}}>{bmi}</div>
                </div>
                <div style={{textAlign:'right'}}>
                  <div style={{
                    display:'inline-block', padding:'4px 12px', borderRadius:100,
                    background:cls.color, color:'#fff',
                    fontFamily:'Barlow Condensed', fontWeight:700, fontSize:'0.85rem',
                    letterSpacing:'0.04em',
                  }}>{cls.label}</div>
                  {cls.label !== 'Normal' && (
                    <div style={{fontSize:'0.7rem',color:'var(--text3)',marginTop:4}}>WHO: normal 18.5–24.9</div>
                  )}
                </div>
              </div>
            )}
            {bmi === null && (
              <div style={{fontSize:'0.78rem',color:'var(--text3)',marginBottom:14,lineHeight:1.5}}>
                Enter your height and log a weight to see your BMI.
              </div>
            )}

            <button className="btn btn-primary" style={{width:'100%'}} onClick={saveBodyStats} disabled={bodyStatsSaving}>
              {bodyStatsSaving ? 'Saving…' : 'Save body stats'}
            </button>
          </div>
        )
      })()}

      {/* Goals */}
      <div className="card" style={{marginBottom:12}}>
        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:14}}>
          <Target size={16} color="var(--warning)"/>
          <div style={{fontSize:'0.7rem',fontWeight:700,color:'var(--text3)',letterSpacing:'0.1em',textTransform:'uppercase'}}>Goals</div>
        </div>

        {goals.map(g=>{
          const gt = GOAL_TYPES.find(t=>t.value===g.type)
          return (
            <div key={g.id} style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
              <div style={{flex:1}}>
                <div style={{fontFamily:'Barlow Condensed',fontWeight:700}}>{gt?.label||g.type}</div>
                <div style={{fontSize:'0.8rem',color:'var(--accent)'}}>{g.targetValue} {gt?.unit}</div>
              </div>
              <button onClick={()=>deleteGoal(g.id)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text3)',padding:4}}>
                <Trash2 size={16}/>
              </button>
            </div>
          )
        })}

        <div style={{display:'flex',gap:8,marginTop:goals.length?12:0}}>
          <select value={newGoalType} onChange={e=>setNewGoalType(e.target.value)} style={{flex:2}}>
            {GOAL_TYPES.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <input type="number" value={newGoalValue} onChange={e=>setNewGoalValue(e.target.value)}
            placeholder="Value" style={{flex:1}} min={0}/>
          <button className="btn btn-primary" onClick={addGoal} disabled={!newGoalValue}>+</button>
        </div>
      </div>

      {/* Notifications */}
      <div className="card" style={{marginBottom:12}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <Bell size={16} color="var(--accent3)"/>
          <div style={{flex:1}}>
            <div style={{fontFamily:'Barlow Condensed',fontWeight:700}}>Rest Timer Notifications</div>
            <div style={{fontSize:'0.8rem',color:'var(--text3)'}}>
              {notifPerm==='granted'?'✅ Enabled':notifPerm==='denied'?'❌ Blocked in browser settings':'Tap to enable'}
            </div>
            {notifPerm !== 'granted' && (
              <div style={{fontSize:'0.72rem',color:'var(--text3)',marginTop:4,lineHeight:1.5}}>
                iOS: requires <strong style={{color:'var(--text2)'}}>iOS 16.4+</strong> and the app added to your Home Screen.
              </div>
            )}
          </div>
          {notifPerm==='default'&&(
            <button className="btn btn-ghost" style={{padding:'8px 12px',fontSize:'0.8rem'}} onClick={requestNotif}>Enable</button>
          )}
        </div>
      </div>

      {/* Data stats */}
      <div className="card" style={{marginBottom:12}}>
        <div style={{fontSize:'0.7rem',fontWeight:700,color:'var(--text3)',letterSpacing:'0.1em',textTransform:'uppercase',marginBottom:12}}>Stored Data</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,marginBottom:14}}>
          <div style={{textAlign:'center'}}>
            <div style={{fontFamily:'Barlow Condensed',fontWeight:800,fontSize:'1.5rem',color:'var(--accent)'}}>{dbStats.sessions}</div>
            <div style={{fontSize:'0.7rem',color:'var(--text3)'}}>Sessions</div>
          </div>
          <div style={{textAlign:'center'}}>
            <div style={{fontFamily:'Barlow Condensed',fontWeight:800,fontSize:'1.5rem',color:'var(--accent)'}}>{dbStats.sets}</div>
            <div style={{fontSize:'0.7rem',color:'var(--text3)'}}>Sets</div>
          </div>
          <div style={{textAlign:'center'}}>
            <div style={{fontFamily:'Barlow Condensed',fontWeight:800,fontSize:'1.5rem',color:'var(--accent)'}}>{dbStats.weights}</div>
            <div style={{fontSize:'0.7rem',color:'var(--text3)'}}>Weigh-ins</div>
          </div>
        </div>
        <div style={{display:'flex',gap:10}}>
          <button className="btn btn-ghost" style={{flex:1,fontSize:'0.85rem'}} onClick={exportData}>
            <Download size={15}/> Export
          </button>
          <button className="btn btn-ghost" style={{flex:1,fontSize:'0.85rem',color:'var(--accent2)',borderColor:'rgba(255,61,61,0.3)'}}
            onClick={() => setConfirmClear(true)}>
            <Trash2 size={15}/> Clear All
          </button>
        </div>
      </div>

      {/* FitTrack Planner GPT */}
      <div id="gpt-instructions" className="card" style={{marginBottom:12}}>
        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
          <span style={{fontSize:'1rem'}}>🤖</span>
          <div style={{fontSize:'0.7rem',fontWeight:700,color:'var(--text3)',letterSpacing:'0.1em',textTransform:'uppercase'}}>FitTrack Planner GPT</div>
        </div>
        <p style={{fontSize:'0.82rem',color:'var(--text3)',marginBottom:16,lineHeight:1.6}}>
          Your AI personal trainer — reads your profile and goals, browses 610 exercises, and builds a personalised plan saved directly to your account.
        </p>

        {[
          {
            n: 1,
            label: 'Open the GPT',
            detail: 'Tap the button below. You\'ll need a ChatGPT account (free or Plus).',
          },
          {
            n: 2,
            label: 'Sign in to FitTrack',
            detail: 'ChatGPT will redirect you to the FitTrack login page. Enter your FitTrack email and password — the same credentials you use here.',
          },
          {
            n: 3,
            label: 'Authorise access',
            detail: 'After signing in, tap "Allow" to grant the GPT access to your account. This only happens once.',
          },
          {
            n: 4,
            label: 'Answer the questions',
            detail: 'The GPT will ask about your goals, available equipment, training days per week, and experience level. Answer as best you can.',
          },
          {
            n: 5,
            label: 'Review and approve the plan',
            detail: 'The GPT presents the full plan before saving — review the days and exercises, then tell it to go ahead.',
          },
          {
            n: 6,
            label: 'Plan saved — check the Planner tab',
            detail: 'Your new plan appears automatically in the Planner. It\'s set as your active plan and ready to use.',
          },
        ].map(({ n, label, detail }) => (
          <div key={n} style={{display:'flex',gap:12,marginBottom:14,alignItems:'flex-start'}}>
            <div style={{
              flexShrink:0, width:24, height:24, borderRadius:'50%',
              background:'var(--accent)', color:'#000',
              display:'flex', alignItems:'center', justifyContent:'center',
              fontFamily:'Barlow Condensed', fontWeight:800, fontSize:'0.8rem',
            }}>{n}</div>
            <div>
              <div style={{fontFamily:'Barlow Condensed',fontWeight:700,fontSize:'0.95rem'}}>{label}</div>
              <div style={{fontSize:'0.75rem',color:'var(--text3)',marginTop:2,lineHeight:1.5}}>{detail}</div>
            </div>
          </div>
        ))}

        <a
          href="https://chatgpt.com/g/g-69cbfbc4f7948191bb3efca20b21871b-fittrack-planner"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display:'flex', alignItems:'center', justifyContent:'center', gap:8,
            width:'100%', padding:'13px 0', borderRadius:10, marginTop:4,
            background:'var(--accent)', color:'#000',
            fontFamily:'Barlow Condensed', fontWeight:800, fontSize:'1rem',
            letterSpacing:'0.05em', textDecoration:'none',
          }}
        >
          Open FitTrack Planner <ExternalLink size={14}/>
        </a>
      </div>

      <div style={{textAlign:'center',padding:'20px 0',color:'var(--text3)',fontSize:'0.75rem'}}>
        Signed in as <strong style={{color:'var(--text2)'}}>{user?.email}</strong><br/>
        FitTrack PWA · 610 exercises · Local-first · Works offline<br/>
        <Link to="/privacy" style={{color:'var(--text3)',textDecoration:'underline',marginTop:6,display:'inline-block'}}>Privacy Policy</Link>
        {' · '}4Brazucas, LLC
      </div>
    </div>
  )
}
