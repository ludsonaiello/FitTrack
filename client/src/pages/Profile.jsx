import { useState, useEffect } from 'react'
import { User, Target, Bell, Trash2, Download, LogOut, Scale, Key, Copy, Eye, EyeOff, Plus } from 'lucide-react'
import { db } from '../db/index.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useWeightUnit } from '../hooks/useWeightUnit.js'
import ConfirmModal from '../components/ConfirmModal.jsx'
import { api } from '../lib/api.js'

const GOAL_TYPES = [
  {value:'weight',label:'Target Body Weight',unit:'kg'},
  {value:'frequency',label:'Workouts per Week',unit:'x/week'},
]

export default function Profile() {
  const { user, logout } = useAuth()
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
  const [newKeyResult, setNewKeyResult] = useState(null) // { key, label } — shown once
  const [keyVisible, setKeyVisible] = useState(false)
  const [keyError, setKeyError] = useState('')
  const [confirmRevokeId, setConfirmRevokeId] = useState(null)

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
    const id = await db.goals.add({
      type: newGoalType,
      targetValue: parseFloat(newGoalValue),
      achieved: false,
      createdAt: new Date().toISOString(),
    })
    setGoals(await db.goals.toArray())
    setNewGoalValue('')
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
      const r = await api.post('/api/api-keys', { label: newKeyLabel.trim() })
      setNewKeyResult({ key: r.data.key, label: r.data.label })
      setKeyVisible(false)
      setNewKeyLabel('')
      const updated = await api.get('/api/api-keys')
      setApiKeys(updated.data || [])
    } catch (e) {
      setKeyError(e.message)
    }
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
        <button className="btn btn-ghost" style={{padding:'8px 12px',fontSize:'0.85rem',gap:6}} onClick={logout}>
          <LogOut size={15}/> Sign out
        </button>
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
          <div key={k.id} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 0',borderBottom:'1px solid var(--border)'}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontWeight:600,fontSize:'0.85rem',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{k.label}</div>
              <div style={{fontSize:'0.72rem',color:'var(--text3)',fontFamily:'monospace'}}>{k.prefix}••••••••</div>
              <div style={{fontSize:'0.68rem',color:'var(--text3)'}}>
                Created {new Date(k.createdAt).toLocaleDateString()}
                {k.lastUsed ? ` · Last used ${new Date(k.lastUsed).toLocaleDateString()}` : ' · Never used'}
              </div>
            </div>
            <button onClick={() => setConfirmRevokeId(k.id)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text3)',padding:4}}>
              <Trash2 size={15}/>
            </button>
          </div>
        ))}

        {/* One-time key reveal */}
        {newKeyResult && (
          <div style={{marginTop:12,padding:12,background:'rgba(232,255,0,0.07)',borderRadius:10,border:'1px solid rgba(232,255,0,0.25)'}}>
            <div style={{fontSize:'0.75rem',fontWeight:700,color:'var(--accent)',marginBottom:6}}>
              ✓ Key generated for "{newKeyResult.label}" — copy it now, it won't be shown again
            </div>
            <div style={{display:'flex',gap:6,alignItems:'center'}}>
              <div style={{
                flex:1, fontFamily:'monospace', fontSize:'0.75rem', color:'var(--text)',
                background:'var(--surface2)', padding:'8px 10px', borderRadius:8,
                wordBreak:'break-all', letterSpacing:'0.03em',
              }}>
                {keyVisible ? newKeyResult.key : newKeyResult.key.slice(0,10) + '•'.repeat(newKeyResult.key.length - 10)}
              </div>
              <button onClick={() => setKeyVisible(v => !v)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text3)',padding:4}}>
                {keyVisible ? <EyeOff size={16}/> : <Eye size={16}/>}
              </button>
              <button
                onClick={() => navigator.clipboard.writeText(newKeyResult.key)}
                style={{background:'none',border:'none',cursor:'pointer',color:'var(--accent)',padding:4}}>
                <Copy size={16}/>
              </button>
            </div>
            <button onClick={() => setNewKeyResult(null)} style={{background:'none',border:'none',cursor:'pointer',fontSize:'0.72rem',color:'var(--text3)',marginTop:6,padding:0}}>
              I've saved it — dismiss
            </button>
          </div>
        )}

        {/* Generate new key */}
        {!newKeyResult && (
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
        )}
        {keyError && <div style={{fontSize:'0.75rem',color:'var(--accent2)',marginTop:6}}>{keyError}</div>}
        {apiKeys.length === 0 && !newKeyResult && (
          <div style={{fontSize:'0.75rem',color:'var(--text3)',marginTop:8}}>No keys yet — generate one above.</div>
        )}
      </div>

      <div style={{textAlign:'center',padding:'20px 0',color:'var(--text3)',fontSize:'0.75rem'}}>
        Signed in as <strong style={{color:'var(--text2)'}}>{user?.email}</strong><br/>
        FitTrack PWA · 610 exercises · Local-first · Works offline
      </div>
    </div>
  )
}
