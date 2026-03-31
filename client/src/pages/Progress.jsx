import { useState, useEffect } from 'react'
import { TrendingUp, Target, Dumbbell, Calendar } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { db, getBodyWeightHistory, getWorkoutFrequency, getExercisePR } from '../db/index.js'
import { allExercises } from '../lib/exercises.js'
import { enqueue } from '../db/sync-queue.js'
import { useWeightUnit, toDisplay, toKg } from '../hooks/useWeightUnit.js'

function WeightChart({ data }) {
  if (!data.length) return (
    <div style={{textAlign:'center',padding:'30px 0',color:'var(--text3)'}}>
      <p>No weight data yet. Log your first weigh-in below.</p>
    </div>
  )
  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={data} margin={{top:5,right:5,left:-20,bottom:0}}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)"/>
        <XAxis dataKey="date" tick={{fill:'var(--text3)',fontSize:11}} tickLine={false} axisLine={false}/>
        <YAxis tick={{fill:'var(--text3)',fontSize:11}} tickLine={false} axisLine={false}/>
        <Tooltip contentStyle={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:8,color:'var(--text)',fontSize:13}}/>
        <Line type="monotone" dataKey="weight" stroke="var(--accent)" strokeWidth={2} dot={false} activeDot={{r:4,fill:'var(--accent)'}}/>
      </LineChart>
    </ResponsiveContainer>
  )
}

function Heatmap({ freq }) {
  const today = new Date()
  const cells = []
  for (let i=83;i>=0;i--) {
    const d=new Date(today); d.setDate(d.getDate()-i)
    const key=d.toISOString().slice(0,10)
    const count=freq[key]||0
    cells.push({key,count,day:d.getDay()})
  }
  return (
    <div style={{display:'grid',gridTemplateColumns:'repeat(12,1fr)',gap:3}}>
      {cells.map(c=>(
        <div key={c.key} className={`heat-cell${c.count>=3?' heat-3':c.count===2?' heat-2':c.count===1?' heat-1':''}`}
          style={{aspectRatio:'1'}} title={`${c.key}: ${c.count} workout(s)`}/>
      ))}
    </div>
  )
}

export default function Progress() {
  const [weightData, setWeightData] = useState([])
  const [freq, setFreq] = useState({})
  const [newWeight, setNewWeight] = useState('')
  const [prs, setPRs] = useState([])
  const [totalSessions, setTotalSessions] = useState(0)
  const [totalSets, setTotalSets] = useState(0)
  const [unit] = useWeightUnit()

  useEffect(() => {
    loadAll()
  }, [unit])

  async function loadAll() {
    const weights = await getBodyWeightHistory(90)
    setWeightData(weights.map(w=>({date:w.loggedAt.slice(5,10),weight:Math.round(toDisplay(w.weight, unit) * 10) / 10})))
    const f = await getWorkoutFrequency(84)
    setFreq(f)
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
    // Queue for sync — will fire when online
    enqueue('bodyWeights', localId, { weight: weightKg, unit: 'kg', loggedAt })
  }

  const monthlyCount = Object.values(freq).reduce((a,b)=>a+b,0)

  return (
    <div className="page">
      <h1 style={{margin:'0 0 4px'}}>Your<br/><span style={{color:'var(--accent)'}}>Progress</span></h1>
      <p style={{margin:'0 0 20px',color:'var(--text3)',fontSize:'0.85rem'}}>Track your evolution over time</p>

      {/* Stats */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:20}}>
        <div className="stat-box">
          <Calendar size={16} color="var(--accent3)"/>
          <div className="stat-value">{totalSessions}</div>
          <div className="stat-label">Total sessions</div>
        </div>
        <div className="stat-box">
          <Dumbbell size={16} color="var(--accent)"/>
          <div className="stat-value">{totalSets}</div>
          <div className="stat-label">Total sets</div>
        </div>
      </div>

      {/* Weight chart */}
      <div className="card" style={{marginBottom:16}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
          <h3 style={{margin:0,display:'flex',alignItems:'center',gap:8}}>
            <TrendingUp size={18} color="var(--accent)"/> Body Weight
          </h3>
          {weightData.length>0&&<span style={{fontSize:'0.85rem',color:'var(--accent)',fontFamily:'Barlow Condensed',fontWeight:700}}>
            {weightData[weightData.length-1].weight} {unit}
          </span>}
        </div>
        <WeightChart data={weightData}/>
        <div style={{display:'flex',gap:8,marginTop:12}}>
          <input type="number" value={newWeight} onChange={e=>setNewWeight(e.target.value)}
            placeholder={`Log weight (${unit})`} step={0.1} min={unit==='lbs'?44:20} max={unit==='lbs'?660:300}
            style={{flex:1}} onKeyDown={e=>e.key==='Enter'&&handleLogWeight()}/>
          <button className="btn btn-primary" onClick={handleLogWeight} disabled={!newWeight}>Log</button>
        </div>
      </div>

      {/* Activity heatmap 84 days */}
      <div className="card" style={{marginBottom:16}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
          <h3 style={{margin:0}}>Activity (84 days)</h3>
          <span style={{fontSize:'0.8rem',color:'var(--text3)'}}>{monthlyCount} workouts</span>
        </div>
        <Heatmap freq={freq}/>
      </div>

      {/* PRs */}
      {prs.length > 0 && (
        <div className="card">
          <h3 style={{margin:'0 0 14px',display:'flex',alignItems:'center',gap:8}}>
            <Target size={18} color="var(--warning)"/> Personal Records
          </h3>
          {prs.map((pr,i)=>(
            <div key={i} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 0',borderBottom:i<prs.length-1?'1px solid var(--border)':'none'}}>
              <div style={{width:32,height:32,borderRadius:8,background:'rgba(245,158,11,0.1)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                <span style={{fontSize:'0.9rem'}}>🏅</span>
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontFamily:'Barlow Condensed',fontWeight:700,fontSize:'0.95rem',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{pr.name}</div>
                <div style={{fontSize:'0.75rem',color:'var(--text3)'}}>{pr.reps} reps</div>
              </div>
              {pr.weight && <div style={{fontFamily:'Barlow Condensed',fontWeight:800,fontSize:'1.3rem',color:'var(--warning)'}}>{pr.weight}<span style={{fontSize:'0.7rem',fontWeight:400,color:'var(--text3)'}}>{unit}</span></div>}
            </div>
          ))}
        </div>
      )}

      {totalSessions === 0 && (
        <div style={{textAlign:'center',padding:'40px 0'}}>
          <div style={{fontSize:'3rem',marginBottom:12}}>📊</div>
          <p style={{color:'var(--text3)'}}>Complete workouts to see your progress stats here.</p>
        </div>
      )}
    </div>
  )
}
