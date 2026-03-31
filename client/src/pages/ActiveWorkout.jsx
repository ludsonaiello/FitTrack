import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { CheckCircle, X, Plus, Minus, Clock, ChevronLeft, ChevronRight, Trophy, Zap, Trash2 } from 'lucide-react'
import { db, logSet, completeSession, getSessionWithSets, compareWithLastSession, getLastSetsForExercise } from '../db/index.js'
import { enqueue } from '../db/sync-queue.js'
import { api, isOnline } from '../lib/api.js'
import { getExerciseById, FOCUS_LABELS, exImageUrl } from '../lib/exercises.js'
import { useRestTimer, useStopwatch } from '../hooks/useTimer.js'
import { useWeightUnit, toDisplay, toKg } from '../hooks/useWeightUnit.js'

function RestTimerOverlay({ seconds, total, onSkip }) {
  const pct = total > 0 ? 1 - seconds / total : 0
  const r = 54, circ = 2 * Math.PI * r
  return (
    <div className="overlay" onClick={onSkip}>
      <div className="sheet" style={{textAlign:'center'}} onClick={e=>e.stopPropagation()}>
        <div style={{fontSize:'0.75rem',fontWeight:700,color:'var(--text3)',letterSpacing:'0.1em',textTransform:'uppercase',marginBottom:16}}>Rest Timer</div>
        <div style={{position:'relative',width:140,height:140,margin:'0 auto 20px'}}>
          <svg width="140" height="140" viewBox="0 0 140 140" className="ring">
            <circle className="ring-track" cx="70" cy="70" r={r} strokeWidth="6"/>
            <circle className="ring-fill" cx="70" cy="70" r={r} strokeWidth="6"
              strokeDasharray={circ}
              strokeDashoffset={circ * pct}/>
          </svg>
          <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}>
            <div style={{fontFamily:'Barlow Condensed',fontWeight:800,fontSize:'3rem',lineHeight:1,color:'var(--accent)'}}>{seconds}</div>
            <div style={{fontSize:'0.7rem',color:'var(--text3)',fontWeight:600,letterSpacing:'0.1em'}}>SECONDS</div>
          </div>
        </div>
        <p style={{color:'var(--text2)',marginBottom:20}}>Tap anywhere or skip to continue</p>
        <button className="btn btn-ghost" style={{width:'100%'}} onClick={onSkip}>Skip Rest</button>
      </div>
    </div>
  )
}

function ComparisonBadge({ comp, unit = 'kg' }) {
  const pill = (bg, color, text) => (
    <span style={{
      display: 'inline-block', padding: '3px 10px', borderRadius: 20,
      fontSize: '0.78rem', fontWeight: 700, background: bg, color,
    }}>{text}</span>
  )

  if (!comp) return pill('rgba(232,255,0,0.15)', 'var(--accent)', 'First time! 🎉')

  if (comp.weightDiff > 0) {
    const d = toDisplay(comp.weightDiff, unit)
    return pill('rgba(232,255,0,0.15)', 'var(--accent)', `↑ ${d} ${unit} heavier`)
  }
  if (comp.weightDiff === 0 && comp.volDiff > 0) {
    const d = toDisplay(comp.volDiff, unit)
    return pill('rgba(232,255,0,0.12)', 'var(--accent)', `↑ ${d} ${unit} more volume`)
  }
  if (comp.weightDiff < 0) {
    const d = toDisplay(Math.abs(comp.weightDiff), unit)
    return pill('var(--surface2)', 'var(--text3)', `↓ ${d} ${unit} lighter`)
  }
  return pill('var(--surface2)', 'var(--text3)', 'Same as last time')
}

export default function ActiveWorkout() {
  const { sessionId: sessionIdParam } = useParams()
  const sessionId = Number(sessionIdParam)
  const nav = useNavigate()
  const loc = useLocation()
  const planDay = loc.state?.planDay
  const stopwatch = useStopwatch()
  const restTimer = useRestTimer()

  const [unit] = useWeightUnit()
  const [exercises, setExercises] = useState([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [sets, setSets] = useState({}) // tutorialId -> [{reps,weight,done}]
  const [prevSets, setPrevSets] = useState({}) // tutorialId -> [{setNumber,reps,weight}]
  const [showFinish, setShowFinish] = useState(false)
  const [finished, setFinished] = useState(false)
  const [summary, setSummary] = useState(null)
  const [skipModal, setSkipModal] = useState(null)       // { targetIdx }
  const [addSetModal, setAddSetModal] = useState(null)   // { tutId }
  const [removeSetModal, setRemoveSetModal] = useState(null) // { tutId, setIdx }
  const [removeExModal, setRemoveExModal] = useState(null)   // { exIdx }
  const [confirmFinishModal, setConfirmFinishModal] = useState(false)

  useEffect(() => {
    stopwatch.start()
    restTimer.requestPermission()

    if (planDay?.exercises?.length > 0) {
      const exs = planDay.exercises.map(pe => ({
        ...pe,
        info: getExerciseById(pe.tutorialId),
      })).filter(e => e.info)
      setExercises(exs)

      // load previous sets and pre-fill current sets
      Promise.all(exs.map(e => getLastSetsForExercise(e.tutorialId))).then(lastSetsArr => {
        const prev = {}
        const initSets = {}
        exs.forEach((e, i) => {
          const last = lastSetsArr[i] || []
          prev[e.tutorialId] = last
          const count = e.targetSets || 3
          initSets[e.tutorialId] = Array.from({ length: count }, (_, idx) => {
            const prevSet = last[idx] ?? last[last.length - 1]
            return {
              setNumber: idx + 1,
              reps: prevSet?.reps ?? e.targetReps ?? 10,
              weight: prevSet?.weight != null ? toDisplay(prevSet.weight, unit) : (e.targetWeight != null ? toDisplay(e.targetWeight, unit) : ''),
              done: false,
            }
          })
        })
        setPrevSets(prev)
        setSets(initSets)
      })
    }
  }, [])

  const currentEx = exercises[currentIdx]
  const currentSets = currentEx ? (sets[currentEx.tutorialId] || []) : []
  const allDone = currentSets.every(s => s.done)

  function updateSet(tutId, idx, field, value) {
    setSets(prev => ({
      ...prev,
      [tutId]: prev[tutId].map((s, i) => i === idx ? {...s, [field]: value} : s)
    }))
  }

  async function handleCompleteSet(tutId, setIdx) {
    const s = sets[tutId][setIdx]
    await logSet(sessionId, tutId, {
      setNumber: s.setNumber,
      reps: parseInt(s.reps) || null,
      weight: toKg(s.weight, unit),
      completed: true,
    })
    updateSet(tutId, setIdx, 'done', true)
    // start rest timer
    const ex = exercises.find(e => e.tutorialId === tutId)
    if (ex?.restSeconds) restTimer.start(ex.restSeconds)
  }

  function handleNextExercise() {
    const incomplete = currentSets.filter(s => !s.done).length
    if (incomplete > 0) {
      setSkipModal({ targetIdx: currentIdx + 1 })
    } else {
      setCurrentIdx(i => i + 1)
    }
  }

  function handleRequestFinish() {
    const totalIncomplete = Object.values(sets).flat().filter(s => !s.done).length
    if (totalIncomplete > 0) {
      setConfirmFinishModal(true)
    } else {
      handleFinish()
    }
  }

  function confirmAddSet(saveToPlan) {
    const { tutId } = addSetModal
    const currentCount = sets[tutId]?.length || 0
    setSets(prev => ({
      ...prev,
      [tutId]: [...(prev[tutId] || []), { setNumber: currentCount + 1, reps: 10, weight: '', done: false }],
    }))
    if (saveToPlan) {
      const ex = exercises.find(e => e.tutorialId === tutId)
      if (ex?.id) db.planExercises.update(ex.id, { targetSets: currentCount + 1 })
    }
    setAddSetModal(null)
  }

  function confirmRemoveSet(saveToPlan) {
    const { tutId, setIdx } = removeSetModal
    const currentCount = sets[tutId]?.length || 0
    setSets(prev => ({
      ...prev,
      [tutId]: prev[tutId].filter((_, i) => i !== setIdx).map((s, i) => ({ ...s, setNumber: i + 1 })),
    }))
    if (saveToPlan) {
      const ex = exercises.find(e => e.tutorialId === tutId)
      if (ex?.id) db.planExercises.update(ex.id, { targetSets: Math.max(1, currentCount - 1) })
    }
    setRemoveSetModal(null)
  }

  function confirmRemoveExercise(saveToPlan) {
    const { exIdx } = removeExModal
    const ex = exercises[exIdx]
    if (saveToPlan && ex?.id) db.planExercises.delete(ex.id)
    const tutId = ex.tutorialId
    setExercises(prev => prev.filter((_, i) => i !== exIdx))
    setSets(prev => { const n = { ...prev }; delete n[tutId]; return n })
    setCurrentIdx(prev => {
      if (exIdx < prev) return prev - 1
      return Math.min(prev, exercises.length - 2)
    })
    setRemoveExModal(null)
  }

  async function handleFinish() {
    stopwatch.pause()
    const duration = await completeSession(sessionId)

    // gather stats — sets.weight is in display unit, convert back to kg for volume
    const totalSetsCount = Object.values(sets).flat().filter(s => s.done).length
    const totalVolKg = Object.values(sets).flat()
      .filter(s => s.done && s.weight !== '' && s.reps)
      .reduce((acc, s) => acc + (toKg(s.weight, unit) ?? 0) * parseInt(s.reps), 0)

    // compare with last session
    const comparison = await compareWithLastSession(sessionId)

    setSummary({ duration, totalSets: totalSetsCount, totalVolKg: Math.round(totalVolKg), comparison })
    setFinished(true)

    // Sync session to server — directly if online, via queue if offline
    getSessionWithSets(sessionId).then(async session => {
      if (!session) return
      const payload = {
        startedAt:   session.startedAt,
        completedAt: session.completedAt,
        durationSec: session.durationSec,
        notes:       session.notes || undefined,
        sets: (session.sets || []).map(s => ({
          tutorialId:  s.tutorialId,
          setNumber:   s.setNumber,
          reps:        s.reps ?? undefined,
          weight:      s.weight ?? undefined,
          durationSec: s.durationSec ?? undefined,
          restSec:     s.restSec ?? undefined,
          completed:   s.completed ?? true,
        })),
      }

      if (isOnline()) {
        try {
          await api.post('/api/workouts/sessions', payload)
          return // synced directly — no need to queue
        } catch {
          // Fall through to queue on any server/network error
        }
      }
      enqueue('sessions', sessionId, payload)
    }).catch(() => {})
  }

  if (finished && summary) {
    // Build per-exercise rows: up to 5, using the exercises that were in this session
    const compMap = {}
    if (summary.comparison) {
      summary.comparison.forEach(c => { compMap[c.tutorialId] = c })
    }

    // Collect tutorialIds that had at least one done set
    const doneTutIds = Object.entries(sets)
      .filter(([, setArr]) => setArr.some(s => s.done))
      .map(([tutId]) => tutId)
      .slice(0, 5)

    const hasAnyPR = summary.comparison && summary.comparison.some(c => c.isWeightPR || c.isVolPR)

    return (
      <div className="page" style={{padding:'24px 16px',maxWidth:480,margin:'0 auto'}}>
        {/* Trophy + title */}
        <div style={{textAlign:'center',marginBottom:24}}>
          <div style={{fontSize:'4rem',marginBottom:12}}>🏆</div>
          <h1 style={{margin:'0 0 4px'}}>Workout Complete!</h1>
          <p style={{color:'var(--text3)',margin:0,fontFamily:'Barlow Condensed',fontSize:'1.1rem',fontWeight:600,letterSpacing:'0.05em'}}>
            {planDay?.name || 'Free Workout'}
          </p>
        </div>

        {/* Stats grid */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:16}}>
          <div className="stat-box">
            <div className="stat-value">{Math.floor(summary.duration / 60)}</div>
            <div className="stat-label">Duration</div>
          </div>
          <div className="stat-box">
            <div className="stat-value">{summary.totalSets}</div>
            <div className="stat-label">Sets done</div>
          </div>
        </div>

        {summary.totalVolKg > 0 && (
          <div className="stat-box" style={{marginBottom:24,textAlign:'center'}}>
            <div className="stat-value">{Math.round(toDisplay(summary.totalVolKg, unit)).toLocaleString()} {unit}</div>
            <div className="stat-label">Total Volume</div>
          </div>
        )}

        {/* Per-exercise comparison */}
        {doneTutIds.length > 0 && (
          <div style={{marginBottom:20}}>
            <div style={{fontSize:'0.7rem',fontWeight:700,color:'var(--text3)',letterSpacing:'0.1em',textTransform:'uppercase',marginBottom:12}}>
              How did you do?
            </div>
            <div className="card" style={{padding:'4px 0'}}>
              {doneTutIds.map((tutId, idx) => {
                const info = getExerciseById(tutId)
                const name = info?.name || tutId
                const comp = compMap[tutId] || null
                return (
                  <div key={tutId} style={{
                    display:'flex',
                    alignItems:'center',
                    justifyContent:'space-between',
                    gap:12,
                    padding:'10px 14px',
                    borderBottom: idx < doneTutIds.length - 1 ? '1px solid var(--border2)' : 'none',
                  }}>
                    <span style={{
                      fontFamily:'Barlow Condensed',
                      fontWeight:700,
                      fontSize:'1rem',
                      color:'var(--text)',
                      flex:1,
                      minWidth:0,
                      overflow:'hidden',
                      textOverflow:'ellipsis',
                      whiteSpace:'nowrap',
                    }}>
                      {name}
                    </span>
                    <ComparisonBadge comp={comp} unit={unit} />
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* PR banner */}
        {hasAnyPR && (
          <div style={{
            background:'rgba(232,255,0,0.1)',
            border:'1px solid rgba(232,255,0,0.3)',
            borderRadius:12,
            padding:'12px 16px',
            textAlign:'center',
            marginBottom:24,
          }}>
            <div style={{
              fontFamily:'Barlow Condensed',
              fontWeight:800,
              fontSize:'1.3rem',
              color:'var(--accent)',
              letterSpacing:'0.05em',
            }}>
              🔥 New Personal Record!
            </div>
          </div>
        )}

        <button className="btn btn-primary" style={{width:'100%'}} onClick={() => nav('/')}>
          Back to Home
        </button>
      </div>
    )
  }

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100dvh',background:'var(--bg)'}}>
      {restTimer.running && (
        <RestTimerOverlay seconds={restTimer.seconds} total={restTimer.total} onSkip={restTimer.clear}/>
      )}

      {/* Header */}
      <div style={{padding:'calc(12px + env(safe-area-inset-top, 0px)) 16px 12px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',gap:12,flexShrink:0}}>
        <button onClick={()=>setShowFinish(true)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text3)',padding:4}}>
          <X size={22}/>
        </button>
        <div style={{flex:1}}>
          <div style={{fontFamily:'Barlow Condensed',fontWeight:700,fontSize:'1.1rem'}}>{planDay?.name||'Free Workout'}</div>
          <div style={{fontSize:'0.8rem',color:'var(--text3)'}}>{stopwatch.formatted}</div>
        </div>
        <button className="btn btn-danger" style={{padding:'8px 14px',fontSize:'0.85rem'}} onClick={handleRequestFinish}>
          Finish
        </button>
      </div>

      {/* Exercise nav */}
      {exercises.length > 0 && (
        <div style={{padding:'12px 16px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',gap:8,flexShrink:0,overflowX:'auto'}}>
          {exercises.map((ex, i) => {
            const exSets = sets[ex.tutorialId] || []
            const done = exSets.filter(s=>s.done).length
            const total = exSets.length
            const allDoneEx = done === total && total > 0
            return (
              <button key={ex.tutorialId} onClick={()=>setCurrentIdx(i)}
                style={{flexShrink:0,padding:'6px 12px',borderRadius:8,border:`1px solid ${i===currentIdx?'var(--accent)':allDoneEx?'var(--success)':'var(--border2)'}`,background:i===currentIdx?'rgba(232,255,0,0.1)':'var(--surface2)',cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',gap:2,minWidth:64}}>
                <span style={{fontSize:'0.65rem',fontWeight:600,color:i===currentIdx?'var(--accent)':allDoneEx?'var(--success)':'var(--text3)',letterSpacing:'0.05em',textTransform:'uppercase'}}>Ex {i+1}</span>
                <span style={{fontSize:'0.7rem',color:'var(--text2)'}}>{done}/{total}</span>
              </button>
            )
          })}
          <button onClick={()=>nav('/exercises',{state:{quickAdd:sessionId}})}
            style={{flexShrink:0,padding:'6px 12px',borderRadius:8,border:'1px dashed var(--border2)',background:'transparent',cursor:'pointer',color:'var(--text3)',display:'flex',alignItems:'center',gap:4,minWidth:48}}>
            <Plus size={14}/>
          </button>
        </div>
      )}

      {/* Main content */}
      <div style={{flex:1,overflowY:'auto',padding:'16px'}}>
        {!currentEx ? (
          <div style={{textAlign:'center',padding:'40px 0'}}>
            <p style={{color:'var(--text3)'}}>No exercises loaded. This is a free workout.</p>
            <button className="btn btn-ghost" style={{marginTop:16}} onClick={()=>nav('/exercises')}>
              Browse Exercises
            </button>
          </div>
        ) : (
          <>
            {/* Exercise header */}
            <div style={{display:'flex',gap:12,alignItems:'center',marginBottom:20}}>
              <img src={exImageUrl(currentEx.info.id)} style={{width:64,height:64,borderRadius:10,objectFit:'cover',flexShrink:0}} alt=""
                onError={e => e.target.style.display='none'}/>
              <div style={{flex:1,minWidth:0}}>
                <h2 style={{margin:'0 0 4px',lineHeight:1.2}}>{currentEx.info.name}</h2>
                <div style={{fontSize:'0.8rem',color:'var(--text3)'}}>
                  {currentEx.info.focusArea.map(f=>FOCUS_LABELS[f]).join(' · ')}
                </div>
              </div>
              <button
                onClick={() => setRemoveExModal({ exIdx: currentIdx })}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 6, flexShrink: 0 }}
                title="Remove exercise"
              >
                <Trash2 size={18} />
              </button>
            </div>

            {/* Sets table */}
            <div className="card">
              <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr 1fr 32px 32px', gap: 6, borderBottom: '1px solid var(--border2)', marginBottom: 4, paddingBottom: 4 }}>
                <span style={{fontSize:'0.7rem',fontWeight:700,color:'var(--text3)',letterSpacing:'0.08em',textTransform:'uppercase'}}>#</span>
                <span style={{fontSize:'0.7rem',fontWeight:700,color:'var(--text3)',letterSpacing:'0.08em',textTransform:'uppercase',textAlign:'center'}}>Reps</span>
                <span style={{fontSize:'0.7rem',fontWeight:700,color:'var(--text3)',letterSpacing:'0.08em',textTransform:'uppercase',textAlign:'center'}}>Weight</span>
                <span/><span/>
              </div>

              {currentSets.map((s, i) => {
                const isLocked = i > 0 && !currentSets[i - 1].done
                const prevArr = prevSets[currentEx.tutorialId] || []
                const prevSet = prevArr[i] ?? prevArr[prevArr.length - 1] ?? null
                const prevW = prevSet?.weight != null ? toDisplay(prevSet.weight, unit) : null
                const prevR = prevSet?.reps ?? null
                const hasPrev = prevW != null || prevR != null
                return (
                  <div key={i} style={{ opacity: s.done ? 0.45 : isLocked ? 0.35 : 1 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr 1fr 32px 32px', gap: 6, alignItems: 'center' }}>
                      <div style={{fontFamily:'Barlow Condensed',fontWeight:700,fontSize:'1.1rem',color:s.done?'var(--success)':isLocked?'var(--text3)':'var(--text)',textAlign:'center'}}>{i+1}</div>
                      <input className="input-num" type="number" value={s.reps} disabled={s.done || isLocked}
                        onChange={e=>updateSet(currentEx.tutorialId,i,'reps',e.target.value)} min={0}/>
                      <input className="input-num" type="number" value={s.weight} disabled={s.done || isLocked}
                        onChange={e=>updateSet(currentEx.tutorialId,i,'weight',e.target.value)}
                        placeholder={unit} min={0} step={unit==='lbs'?1:0.5}/>
                      <button
                        onClick={() => !s.done && !isLocked && handleCompleteSet(currentEx.tutorialId, i)}
                        style={{ background: 'none', border: 'none', cursor: s.done || isLocked ? 'default' : 'pointer', padding: 4 }}>
                        <CheckCircle size={22} color={s.done ? 'var(--success)' : 'var(--border2)'} fill={s.done ? 'var(--success)' : 'none'} />
                      </button>
                      {!s.done && !isLocked ? (
                        <button
                          onClick={() => setRemoveSetModal({ tutId: currentEx.tutorialId, setIdx: i })}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text3)' }}>
                          <Trash2 size={15} />
                        </button>
                      ) : <span />}
                    </div>
                    {hasPrev && !s.done && !isLocked && (
                      <div style={{ paddingLeft: 34, paddingBottom: 6, marginTop: -2, fontSize: '0.72rem', color: 'var(--text3)', fontStyle: 'italic' }}>
                        prev: {prevR != null ? `${prevR} reps` : ''}{prevR != null && prevW != null ? ' · ' : ''}{prevW != null ? `${prevW} ${unit}` : ''}
                      </div>
                    )}
                    {isLocked && (
                      <div style={{ paddingLeft: 34, paddingBottom: 4, fontSize: '0.72rem', color: 'var(--text3)' }}>
                        Complete set {i} first
                      </div>
                    )}
                  </div>
                )
              })}

              <button className="btn btn-ghost" style={{width:'100%',marginTop:10,fontSize:'0.85rem'}}
                onClick={() => setAddSetModal({ tutId: currentEx.tutorialId })}>
                <Plus size={16}/> Add Set
              </button>
            </div>

            {/* Tips */}
            {currentEx.info.tips?.length > 0 && (
              <div style={{marginTop:14,padding:'12px',background:'rgba(232,255,0,0.04)',border:'1px solid rgba(232,255,0,0.1)',borderRadius:10}}>
                <div style={{fontSize:'0.7rem',fontWeight:700,color:'var(--accent)',letterSpacing:'0.1em',textTransform:'uppercase',marginBottom:8}}>Tip</div>
                <p style={{margin:0,fontSize:'0.85rem',color:'var(--text2)',lineHeight:1.5}}>{currentEx.info.tips[0]}</p>
              </div>
            )}

            {/* Nav */}
            <div style={{display:'flex',gap:10,marginTop:16}}>
              <button className="btn btn-ghost" style={{flex:1}} disabled={currentIdx===0}
                onClick={()=>setCurrentIdx(i=>i-1)}>
                <ChevronLeft size={18}/> Prev
              </button>
              {currentIdx === exercises.length - 1 ? (
                <button className="btn btn-primary" style={{flex:2}} onClick={handleRequestFinish}>
                  <Trophy size={18}/> Finish
                </button>
              ) : (
                <button className="btn btn-primary" style={{flex:2}} onClick={handleNextExercise}>
                  Next <ChevronRight size={18}/>
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* Finish confirm (X button) */}
      {showFinish && (
        <div className="overlay">
          <div className="sheet">
            <h3 style={{margin:'0 0 8px'}}>End workout?</h3>
            <p style={{color:'var(--text2)',marginBottom:20}}>Your progress will be saved.</p>
            <div style={{display:'flex',gap:10}}>
              <button className="btn btn-ghost" style={{flex:1}} onClick={()=>setShowFinish(false)}>Continue</button>
              <button className="btn btn-danger" style={{flex:1}} onClick={()=>{ setShowFinish(false); handleRequestFinish() }}>End</button>
            </div>
          </div>
        </div>
      )}

      {/* Skip incomplete sets modal */}
      {skipModal && (
        <div className="overlay" onClick={() => setSkipModal(null)}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 8px' }}>Sets not completed</h3>
            <p style={{ color: 'var(--text2)', margin: '0 0 24px', fontSize: '0.95rem', lineHeight: 1.5 }}>
              You have {currentSets.filter(s => !s.done).length} incomplete set{currentSets.filter(s => !s.done).length !== 1 ? 's' : ''}. Skip to the next exercise anyway?
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setSkipModal(null)}>Stay</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => { setCurrentIdx(skipModal.targetIdx); setSkipModal(null) }}>Skip</button>
            </div>
          </div>
        </div>
      )}

      {/* Finish with incomplete sets modal */}
      {confirmFinishModal && (
        <div className="overlay" onClick={() => setConfirmFinishModal(false)}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 8px' }}>Finish workout?</h3>
            <p style={{ color: 'var(--text2)', margin: '0 0 24px', fontSize: '0.95rem', lineHeight: 1.5 }}>
              You have {Object.values(sets).flat().filter(s => !s.done).length} incomplete set{Object.values(sets).flat().filter(s => !s.done).length !== 1 ? 's' : ''}. Finish and save what you've done?
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setConfirmFinishModal(false)}>Keep going</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => { setConfirmFinishModal(false); handleFinish() }}>Finish & save</button>
            </div>
          </div>
        </div>
      )}

      {/* Add set modal */}
      {addSetModal && (
        <div className="overlay" onClick={() => setAddSetModal(null)}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 8px' }}>Add a set</h3>
            <p style={{ color: 'var(--text2)', margin: '0 0 24px', fontSize: '0.95rem', lineHeight: 1.5 }}>
              Save this extra set to the plan for future workouts too?
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button className="btn btn-primary" onClick={() => confirmAddSet(false)}>Just today</button>
              <button className="btn btn-ghost" onClick={() => confirmAddSet(true)}>Save to plan</button>
              <button className="btn btn-ghost" style={{ color: 'var(--text3)' }} onClick={() => setAddSetModal(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Remove set modal */}
      {removeSetModal && (
        <div className="overlay" onClick={() => setRemoveSetModal(null)}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 8px' }}>Remove set</h3>
            <p style={{ color: 'var(--text2)', margin: '0 0 24px', fontSize: '0.95rem', lineHeight: 1.5 }}>
              Also reduce sets in your plan for future workouts?
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button className="btn btn-danger" onClick={() => confirmRemoveSet(false)}>Just today</button>
              <button className="btn btn-ghost" onClick={() => confirmRemoveSet(true)}>Update plan too</button>
              <button className="btn btn-ghost" style={{ color: 'var(--text3)' }} onClick={() => setRemoveSetModal(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Remove exercise modal */}
      {removeExModal && (
        <div className="overlay" onClick={() => setRemoveExModal(null)}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 8px' }}>Remove exercise</h3>
            <p style={{ color: 'var(--text2)', margin: '0 0 24px', fontSize: '0.95rem', lineHeight: 1.5 }}>
              Remove <strong>{exercises[removeExModal.exIdx]?.info?.name}</strong> from your plan for future workouts too?
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button className="btn btn-danger" onClick={() => confirmRemoveExercise(false)}>Just today</button>
              <button className="btn btn-ghost" onClick={() => confirmRemoveExercise(true)}>Remove from plan</button>
              <button className="btn btn-ghost" style={{ color: 'var(--text3)' }} onClick={() => setRemoveExModal(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
