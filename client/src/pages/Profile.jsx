import { useState, useEffect } from 'react'
import { User, Target, Bell, Trash2, Download, LogOut, Scale, Key, Copy, Plus, ExternalLink, Shield } from 'lucide-react'
import { db } from '../db/index.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useWeightUnit } from '../hooks/useWeightUnit.js'
import ConfirmModal from '../components/ConfirmModal.jsx'
import { useNavigate, Link } from 'react-router-dom'
import { api } from '../lib/api.js'
import { enqueue } from '../db/sync-queue.js'

const GOAL_TYPES = [
  {value:'WEIGHT',label:'Target Body Weight',unit:'kg'},
  {value:'FREQUENCY',label:'Workouts per Week',unit:'x/week'},
]

export default function Profile() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [weightUnit, setWeightUnit] = useWeightUnit()
  const [name, setName] = useState(() => user?.name || localStorage.getItem('ft_name') || '')
  const [goals, setGoals] = useState([])
  const [newGoalType, setNewGoalType] = useState('weight')
  const [newGoalValue, setNewGoalValue] = useState('')
  const [dbStats, setDbStats] = useState({sessions:0,sets:0,weights:0})
  const [notifPerm, setNotifPerm] = useState(typeof Notification!=='undefined'?Notification.permission:'unsupported')
  const [confirmClear, setConfirmClear] = useState(false)

  // API Keys state
  const [apiKeys, setApiKeys] = useState([])
  const [newKeyLabel, setNewKeyLabel] = useState('')
  const [keyError, setKeyError] = useState('')
  const [confirmRevokeId, setConfirmRevokeId] = useState(null)
  const [copiedId, setCopiedId] = useState(null)

  useEffect(() => {
    db.goals.toArray().then(setGoals)
    Promise.all([
      db.sessions.count(),
      db.exerciseSets.count(),
      db.bodyWeights.count(),
    ]).then(([sessions,sets,weights])=>setDbStats({sessions,sets,weights}))
    api.get('/api/api-keys').then(r => setApiKeys(r.data || [])).catch(() => {})
  },[])

  function saveName() { localStorage.setItem('ft_name', name) }

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

  async function generateApiKey() {
    setKeyError('')
    if (!newKeyLabel.trim()) { setKeyError('Enter a label for this key'); return }
    try {
      await api.post('/api/api-keys', { label: newKeyLabel.trim() })
      setNewKeyLabel('')
      const updated = await api.get('/api/api-keys')
      setApiKeys(updated.data || [])
    } catch (e) {
      setKeyError(e.message)
    }
  }

  function copyKey(id, rawKey) {
    navigator.clipboard.writeText(rawKey)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  async function revokeApiKey(id) {
    try {
      await api.delete(`/api/api-keys/${id}`)
      setApiKeys(prev => prev.filter(k => k.id !== id))
      setConfirmRevokeId(null)
    } catch (e) {
      setKeyError(e.message)
    }
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

      {/* API Keys */}
      <div className="card" style={{marginBottom:12}}>
        {confirmRevokeId && (
          <ConfirmModal
            title="Revoke API key?"
            message="This key will stop working immediately. Any GPT using it will lose access."
            confirmLabel="Revoke"
            onConfirm={() => revokeApiKey(confirmRevokeId)}
            onCancel={() => setConfirmRevokeId(null)}
          />
        )}
        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:14}}>
          <Key size={16} color="var(--accent)"/>
          <div style={{fontSize:'0.7rem',fontWeight:700,color:'var(--text3)',letterSpacing:'0.1em',textTransform:'uppercase'}}>GPT API Keys</div>
        </div>
        <div style={{fontSize:'0.8rem',color:'var(--text3)',marginBottom:12,lineHeight:1.5}}>
          Generate keys to connect a Custom ChatGPT to your FitTrack account.
        </div>

        {/* Existing keys */}
        {apiKeys.map(k => (
          <div key={k.id} style={{padding:'10px 0',borderBottom:'1px solid var(--border)'}}>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
              <div style={{flex:1,fontWeight:600,fontSize:'0.85rem',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{k.label}</div>
              <button onClick={() => setConfirmRevokeId(k.id)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text3)',padding:4,flexShrink:0}}>
                <Trash2 size={15}/>
              </button>
            </div>
            {k.rawKey ? (
              <div style={{display:'flex',gap:6,alignItems:'center'}}>
                <div style={{
                  flex:1, fontFamily:'monospace', fontSize:'0.72rem', color:'var(--text)',
                  background:'var(--surface2)', padding:'7px 10px', borderRadius:8,
                  wordBreak:'break-all', letterSpacing:'0.02em',
                }}>
                  {k.rawKey}
                </div>
                <button
                  onClick={() => copyKey(k.id, k.rawKey)}
                  title="Copy key"
                  style={{background:'none',border:'none',cursor:'pointer',color: copiedId === k.id ? 'var(--accent)' : 'var(--text3)',padding:4,flexShrink:0}}>
                  <Copy size={15}/>
                </button>
              </div>
            ) : (
              <div style={{fontSize:'0.72rem',color:'var(--text3)',fontFamily:'monospace'}}>{k.prefix}••••••••</div>
            )}
            <div style={{fontSize:'0.68rem',color:'var(--text3)',marginTop:4}}>
              Created {new Date(k.createdAt).toLocaleDateString()}
              {k.lastUsed ? ` · Last used ${new Date(k.lastUsed).toLocaleDateString()}` : ' · Never used'}
            </div>
          </div>
        ))}

        {/* Generate new key */}
        <div style={{display:'flex',gap:8,marginTop:12}}>
          <input
            value={newKeyLabel}
            onChange={e => setNewKeyLabel(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && generateApiKey()}
            placeholder="Key label, e.g. My GPT"
            style={{flex:1,fontSize:'0.85rem'}}
          />
          <button className="btn btn-primary" onClick={generateApiKey} style={{padding:'8px 12px',fontSize:'0.85rem'}}>
            <Plus size={14}/> Generate
          </button>
        </div>
        {keyError && <div style={{fontSize:'0.75rem',color:'var(--accent2)',marginTop:6}}>{keyError}</div>}
        {apiKeys.length === 0 && (
          <div style={{fontSize:'0.75rem',color:'var(--text3)',marginTop:8}}>No keys yet — generate one above.</div>
        )}
      </div>

      {/* FitTrack Planner GPT — how to connect */}
      <div className="card" style={{marginBottom:12}}>
        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:14}}>
          <span style={{fontSize:'1rem'}}>🤖</span>
          <div style={{fontSize:'0.7rem',fontWeight:700,color:'var(--text3)',letterSpacing:'0.1em',textTransform:'uppercase'}}>FitTrack Planner GPT</div>
        </div>
        <div style={{fontSize:'0.8rem',color:'var(--text3)',marginBottom:14,lineHeight:1.6}}>
          Connect ChatGPT to your account — it will read your goals, browse all 610 exercises and build a personalised plan saved directly here.
        </div>

        {[
          { n:1, label:'Generate an API key', detail:'Use the "GPT API Keys" section above — give it any label, then copy the key.' },
          { n:2, label:'Open FitTrack Planner', detail:'Tap the button below to open the Custom GPT in ChatGPT.' },
          { n:3, label:'Authorise when prompted', detail:'ChatGPT will ask for an API key — paste the key you copied.' },
          { n:4, label:'Chat to build your plan', detail:'Tell the GPT your goals, schedule, or equipment. It will browse exercises and create the plan.' },
          { n:5, label:'Come back to check', detail:'Your new plan appears in the Planner tab automatically once the GPT saves it.' },
        ].map(({ n, label, detail }) => (
          <div key={n} style={{display:'flex',gap:12,marginBottom:12,alignItems:'flex-start'}}>
            <div style={{
              flexShrink:0, width:24, height:24, borderRadius:'50%',
              background:'var(--accent)', color:'#000',
              display:'flex', alignItems:'center', justifyContent:'center',
              fontFamily:'Barlow Condensed', fontWeight:800, fontSize:'0.8rem',
            }}>{n}</div>
            <div>
              <div style={{fontFamily:'Barlow Condensed',fontWeight:700,fontSize:'0.95rem'}}>{label}</div>
              <div style={{fontSize:'0.75rem',color:'var(--text3)',marginTop:2,lineHeight:1.4}}>{detail}</div>
            </div>
          </div>
        ))}

        <a
          href="https://chatgpt.com/g/g-69cbfbc4f7948191bb3efca20b21871b-fittrack-planner"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display:'flex', alignItems:'center', justifyContent:'center', gap:8,
            width:'100%', padding:'11px 0', borderRadius:10, marginTop:4,
            background:'var(--accent)', color:'#000',
            fontFamily:'Barlow Condensed', fontWeight:800, fontSize:'1rem',
            letterSpacing:'0.05em', textDecoration:'none', border:'none', cursor:'pointer',
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
