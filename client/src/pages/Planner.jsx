import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Plus, ChevronDown, ChevronUp, Trash2, Play, Edit2, Check, X, BookOpen } from 'lucide-react'
import {
  db, createPlan, getPlanWithDays, getActivePlan, addExerciseToDay, startSession,
  syncServerPlans, getAllPlans, setActivePlan as dbSetActivePlan, deletePlan as dbDeletePlan, renamePlan,
} from '../db/index.js'
import { api } from '../lib/api.js'
import { getExerciseById, exImageUrl } from '../lib/exercises.js'
import ConfirmModal from '../components/ConfirmModal.jsx'
import PlanPickerSheet from '../components/PlanPickerSheet.jsx'
import { useWeightUnit, toDisplay, toKg } from '../hooks/useWeightUnit.js'

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const REST_OPTIONS = [
  { label: '30s', value: 30 },
  { label: '45s', value: 45 },
  { label: '60s', value: 60 },
  { label: '90s', value: 90 },
  { label: '2min', value: 120 },
  { label: '3min', value: 180 },
]

const TEMPLATES = [
  {
    name: 'Push / Pull / Legs',
    days: [
      { name: 'Push Day', dow: 1 }, { name: 'Pull Day', dow: 2 }, { name: 'Leg Day', dow: 3 },
      { name: 'Rest', dow: 4 }, { name: 'Push Day', dow: 5 }, { name: 'Pull Day', dow: 6 },
    ],
  },
  {
    name: 'Full Body 3×',
    days: [
      { name: 'Full Body', dow: 1 }, { name: 'Rest', dow: 2 }, { name: 'Full Body', dow: 3 },
      { name: 'Rest', dow: 4 }, { name: 'Full Body', dow: 5 },
    ],
  },
  {
    name: 'Upper / Lower',
    days: [
      { name: 'Upper Body', dow: 1 }, { name: 'Lower Body', dow: 2 }, { name: 'Rest', dow: 3 },
      { name: 'Upper Body', dow: 4 }, { name: 'Lower Body', dow: 5 },
    ],
  },
]

// ── Exercise Config Sheet ─────────────────────────────────────────────────────

function ExerciseConfigSheet({ tutorialId, initial, onConfirm, onCancel, confirmLabel = 'Add to Plan' }) {
  const info = getExerciseById(tutorialId)
  const [unit] = useWeightUnit()
  const [sets, setSets] = useState(initial?.sets ?? 3)
  const [reps, setReps] = useState(initial?.reps ?? 10)
  const [weight, setWeight] = useState(initial?.weight != null ? String(toDisplay(initial.weight, unit)) : '')
  const [rest, setRest] = useState(initial?.rest ?? 60)

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'flex-end', zIndex: 200,
    }}>
      <div style={{
        background: 'var(--surface)', borderRadius: '16px 16px 0 0',
        padding: 20, width: '100%', maxWidth: 480, margin: '0 auto',
      }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
          {info && (
            <img src={exImageUrl(info.id)} alt="" style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover' }} />
          )}
          <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: '1.1rem' }}>
            {info?.name ?? tutorialId}
          </div>
        </div>

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <span style={{ fontWeight: 600 }}>Sets</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <button className="btn btn-ghost" style={{ padding: '4px 12px' }} onClick={() => setSets(s => Math.max(1, s - 1))}>−</button>
              <span style={{ fontFamily: 'Barlow Condensed', fontSize: '1.3rem', fontWeight: 700, minWidth: 24, textAlign: 'center' }}>{sets}</span>
              <button className="btn btn-ghost" style={{ padding: '4px 12px' }} onClick={() => setSets(s => s + 1)}>+</button>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <span style={{ fontWeight: 600 }}>Reps</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <button className="btn btn-ghost" style={{ padding: '4px 12px' }} onClick={() => setReps(r => Math.max(1, r - 1))}>−</button>
              <span style={{ fontFamily: 'Barlow Condensed', fontSize: '1.3rem', fontWeight: 700, minWidth: 24, textAlign: 'center' }}>{reps}</span>
              <button className="btn btn-ghost" style={{ padding: '4px 12px' }} onClick={() => setReps(r => r + 1)}>+</button>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <span style={{ fontWeight: 600 }}>Weight <span style={{ color: 'var(--text3)', fontWeight: 400, fontSize: '0.8rem' }}>(optional)</span></span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="number" value={weight} onChange={e => setWeight(e.target.value)}
                placeholder="—" style={{ width: 72, textAlign: 'center' }}
                min={0} step={unit === 'lbs' ? 1 : 0.5}
              />
              <span style={{ color: 'var(--text3)', fontSize: '0.85rem' }}>{unit}</span>
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Rest</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {REST_OPTIONS.map(o => (
                <button key={o.value} onClick={() => setRest(o.value)} style={{
                  padding: '6px 12px', borderRadius: 20, border: '1px solid var(--border)',
                  background: rest === o.value ? 'var(--accent)' : 'var(--surface2)',
                  color: rest === o.value ? '#000' : 'var(--text)',
                  fontWeight: rest === o.value ? 700 : 400,
                  cursor: 'pointer', fontSize: '0.85rem',
                }}>{o.label}</button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onCancel}>Cancel</button>
            <button className="btn btn-primary" style={{ flex: 2 }}
              onClick={() => onConfirm({ sets, reps, weight: toKg(weight, unit), rest })}>
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Wizard ────────────────────────────────────────────────────────────────────

function CreateWizard({ onDone, onCancel }) {
  const [step, setStep] = useState(1)
  const [name, setName] = useState('')
  const [trainingDays, setTrainingDays] = useState(new Set([1, 2, 3, 4, 5]))
  const [dayConfigs, setDayConfigs] = useState(() => {
    const cfg = {}
    for (let i = 0; i < 7; i++) cfg[i] = { name: DAY_NAMES[i], rest: 60 }
    return cfg
  })

  function toggleDay(dow) {
    setTrainingDays(prev => {
      const next = new Set(prev)
      if (next.has(dow)) next.delete(dow)
      else next.add(dow)
      return next
    })
  }

  function updateDayConfig(dow, field, value) {
    setDayConfigs(prev => ({ ...prev, [dow]: { ...prev[dow], [field]: value } }))
  }

  async function handleFinish() {
    const planId = await createPlan(name)
    for (let i = 0; i < 7; i++) {
      await db.planDays.add({
        planId, dayOfWeek: i,
        name: trainingDays.has(i) ? dayConfigs[i].name : 'Rest',
        restSeconds: dayConfigs[i].rest,
        order: i,
      })
    }
    onDone(planId)
  }

  if (step === 1) {
    return (
      <div className="card">
        <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: '1.2rem', marginBottom: 16 }}>
          Step 1 of 3 — Plan Name
        </div>
        <input value={name} onChange={e => setName(e.target.value)}
          placeholder="e.g. Summer Shred 2025" style={{ marginBottom: 16 }}
          onKeyDown={e => e.key === 'Enter' && name && setStep(2)} autoFocus />
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onCancel}>Cancel</button>
          <button className="btn btn-primary" style={{ flex: 2 }} disabled={!name} onClick={() => setStep(2)}>
            Next →
          </button>
        </div>
      </div>
    )
  }

  if (step === 2) {
    return (
      <div className="card">
        <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: '1.2rem', marginBottom: 4 }}>
          Step 2 of 3 — Training Days
        </div>
        <div style={{ color: 'var(--text3)', fontSize: '0.85rem', marginBottom: 16 }}>
          Tap the days you will train. Rest days are unchecked.
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
          {DAY_SHORT.map((d, i) => (
            <button key={i} onClick={() => toggleDay(i)} style={{
              padding: '8px 14px', borderRadius: 20, border: '1px solid var(--border)',
              background: trainingDays.has(i) ? 'var(--accent)' : 'var(--surface2)',
              color: trainingDays.has(i) ? '#000' : 'var(--text)',
              fontWeight: trainingDays.has(i) ? 700 : 400, cursor: 'pointer',
            }}>{d}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setStep(1)}>← Back</button>
          <button className="btn btn-primary" style={{ flex: 2 }} disabled={trainingDays.size === 0} onClick={() => setStep(3)}>
            Next →
          </button>
        </div>
      </div>
    )
  }

  const trainingDowList = [...trainingDays].sort((a, b) => a - b)
  return (
    <div className="card">
      <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: '1.2rem', marginBottom: 4 }}>
        Step 3 of 3 — Configure Days
      </div>
      <div style={{ color: 'var(--text3)', fontSize: '0.85rem', marginBottom: 16 }}>
        Name each training day and set the default rest time.
      </div>
      {trainingDowList.map(dow => (
        <div key={dow} style={{ marginBottom: 16, padding: 12, background: 'var(--surface2)', borderRadius: 10 }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
            {DAY_NAMES[dow]}
          </div>
          <input value={dayConfigs[dow].name} onChange={e => updateDayConfig(dow, 'name', e.target.value)} style={{ marginBottom: 10 }} />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {REST_OPTIONS.map(o => (
              <button key={o.value} onClick={() => updateDayConfig(dow, 'rest', o.value)} style={{
                padding: '5px 10px', borderRadius: 16, border: '1px solid var(--border)',
                background: dayConfigs[dow].rest === o.value ? 'var(--accent)' : 'var(--surface)',
                color: dayConfigs[dow].rest === o.value ? '#000' : 'var(--text)',
                fontWeight: dayConfigs[dow].rest === o.value ? 700 : 400,
                cursor: 'pointer', fontSize: '0.8rem',
              }}>{o.label}</button>
            ))}
          </div>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
        <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setStep(2)}>← Back</button>
        <button className="btn btn-primary" style={{ flex: 2 }} onClick={handleFinish}>
          <Check size={16} /> Create Plan
        </button>
      </div>
    </div>
  )
}

// ── Inline Edit Form ──────────────────────────────────────────────────────────

function InlineEditForm({ ex, onSave, onCancel }) {
  const [unit] = useWeightUnit()
  const [sets, setSets] = useState(ex.targetSets ?? 3)
  const [reps, setReps] = useState(ex.targetReps ?? 10)
  const [weight, setWeight] = useState(ex.targetWeight != null ? String(toDisplay(ex.targetWeight, unit)) : '')
  const [rest, setRest] = useState(ex.restSeconds ?? 60)

  return (
    <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: 12, marginBottom: 4 }}>
      <div style={{ display: 'flex', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text3)' }}>Sets</span>
          <button className="btn btn-ghost" style={{ padding: '2px 8px' }} onClick={() => setSets(s => Math.max(1, s - 1))}>−</button>
          <span style={{ fontFamily: 'Barlow Condensed', fontWeight: 700 }}>{sets}</span>
          <button className="btn btn-ghost" style={{ padding: '2px 8px' }} onClick={() => setSets(s => s + 1)}>+</button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text3)' }}>Reps</span>
          <button className="btn btn-ghost" style={{ padding: '2px 8px' }} onClick={() => setReps(r => Math.max(1, r - 1))}>−</button>
          <span style={{ fontFamily: 'Barlow Condensed', fontWeight: 700 }}>{reps}</span>
          <button className="btn btn-ghost" style={{ padding: '2px 8px' }} onClick={() => setReps(r => r + 1)}>+</button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text3)' }}>{unit}</span>
          <input type="number" value={weight} onChange={e => setWeight(e.target.value)}
            placeholder="—" style={{ width: 60, textAlign: 'center', padding: '4px 8px', fontSize: '0.9rem' }}
            min={0} step={unit === 'lbs' ? 1 : 0.5} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 10 }}>
        {REST_OPTIONS.map(o => (
          <button key={o.value} onClick={() => setRest(o.value)} style={{
            padding: '4px 9px', borderRadius: 14, border: '1px solid var(--border)',
            background: rest === o.value ? 'var(--accent)' : 'var(--surface)',
            color: rest === o.value ? '#000' : 'var(--text)',
            fontWeight: rest === o.value ? 700 : 400,
            cursor: 'pointer', fontSize: '0.78rem',
          }}>{o.label}</button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-ghost" style={{ flex: 1, padding: '6px' }} onClick={onCancel}>
          <X size={14} /> Cancel
        </button>
        <button className="btn btn-primary" style={{ flex: 2, padding: '6px' }}
          onClick={() => onSave({ sets, reps, weight: toKg(weight, unit), rest })}>
          <Check size={14} /> Save
        </button>
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function Planner() {
  const nav = useNavigate()
  const loc = useLocation()

  const [plan, setPlan] = useState(null)
  const [allPlans, setAllPlans] = useState([])
  const [expandedDays, setExpandedDays] = useState({})
  const [showWizard, setShowWizard] = useState(false)
  const [showPicker, setShowPicker] = useState(false)
  const [switching, setSwitching] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null) // plan object pending confirmation
  const [editingEx, setEditingEx] = useState(null)

  // Inline plan name editing
  const [editingName, setEditingName] = useState(false)
  const [draftName, setDraftName] = useState('')
  const nameInputRef = useRef(null)

  // Incoming exercise from ExerciseDetail "Add to Plan"
  const [incomingExercise, setIncomingExercise] = useState(loc.state?.addExercise ?? null)
  const [dayPickerOpen, setDayPickerOpen] = useState(!!loc.state?.addExercise)
  const [pendingDay, setPendingDay] = useState(null)
  const [toast, setToast] = useState(null)

  useEffect(() => {
    async function init() {
      const localActive = await getActivePlan()
      if (localActive) loadPlan(localActive.id)
      await refreshAllPlans()

      try {
        const json = await api.get('/api/workouts/plans')
        if (json.success && Array.isArray(json.data) && json.data.length > 0) {
          const newlyActiveId = await syncServerPlans(json.data)
          if (newlyActiveId && !localActive) loadPlan(newlyActiveId)
          await refreshAllPlans()
        }
      } catch {
        // offline — skip
      }
    }
    init()
  }, [])

  async function refreshAllPlans() {
    const plans = await getAllPlans()
    setAllPlans(plans)
  }

  async function loadPlan(id) {
    const p = await getPlanWithDays(id)
    setPlan(p)
  }

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(null), 2200)
  }

  // ── Plan switching ─────────────────────────────────────────────────────────

  async function handleSwitchPlan(planId) {
    if (switching) return
    setSwitching(true)
    try {
      await dbSetActivePlan(planId)
      await loadPlan(planId)
      await refreshAllPlans()
      setShowPicker(false)
      showToast('Plan activated')
      // Fire-and-forget server sync
      const target = allPlans.find(p => p.id === planId)
      if (target?.serverId) {
        api.patch(`/api/workouts/plans/${target.serverId}`, { isActive: true }).catch(() => {})
      }
    } finally {
      setSwitching(false)
    }
  }

  // ── Plan deletion ──────────────────────────────────────────────────────────

  async function handleDeleteConfirm() {
    if (!deleteTarget) return
    const deletingId = deleteTarget.id
    const serverId = deleteTarget.serverId
    setDeleteTarget(null)

    await dbDeletePlan(deletingId)

    // If we deleted the active plan, load the next most recent
    const remaining = allPlans.filter(p => p.id !== deletingId)
    if (plan?.id === deletingId) {
      if (remaining.length > 0) {
        await dbSetActivePlan(remaining[0].id)
        await loadPlan(remaining[0].id)
      } else {
        setPlan(null)
      }
    }

    await refreshAllPlans()
    if (remaining.length === 0) setShowPicker(false)

    // Fire-and-forget server delete
    if (serverId) {
      api.delete(`/api/workouts/plans/${serverId}`).catch(() => {})
    }
    showToast('Plan deleted')
  }

  // ── Plan rename ────────────────────────────────────────────────────────────

  function startEditName() {
    setDraftName(plan.name)
    setEditingName(true)
    setTimeout(() => nameInputRef.current?.select(), 0)
  }

  async function commitRename() {
    const trimmed = draftName.trim()
    setEditingName(false)
    if (!trimmed || trimmed === plan.name) return
    await renamePlan(plan.id, trimmed)
    setPlan(prev => ({ ...prev, name: trimmed }))
    await refreshAllPlans()
    if (plan.serverId) {
      api.patch(`/api/workouts/plans/${plan.serverId}`, { name: trimmed }).catch(() => {})
    }
  }

  // ── Wizard ─────────────────────────────────────────────────────────────────

  async function handleWizardDone(planId) {
    await loadPlan(planId)
    await refreshAllPlans()
    setShowWizard(false)
  }

  async function handleCreateFromTemplate(tpl) {
    const planId = await createPlan(tpl.name)
    for (let i = 0; i < 7; i++) {
      const t = tpl.days.find(d => d.dow === i)
      await db.planDays.add({
        planId, dayOfWeek: i, name: t?.name ?? 'Rest', restSeconds: 60, order: i,
      })
    }
    await loadPlan(planId)
    await refreshAllPlans()
  }

  function handleNewPlan() {
    setShowPicker(false)
    setPlan(null)
    setShowWizard(true)
  }

  // ── Day / exercise editing ─────────────────────────────────────────────────

  async function handleStartDay(day) {
    const id = await startSession(plan.id, day.id)
    nav(`/workout/active/${id}`, { state: { planDay: day, plan } })
  }

  async function handleRemoveExercise(exId) {
    await db.planExercises.delete(exId)
    loadPlan(plan.id)
  }

  async function handleDayNameChange(dayId, name) {
    await db.planDays.update(dayId, { name })
    loadPlan(plan.id)
  }

  async function handleSaveEdit(exId, opts) {
    await db.planExercises.update(exId, {
      targetSets: opts.sets, targetReps: opts.reps,
      targetWeight: opts.weight, restSeconds: opts.rest,
    })
    setEditingEx(null)
    loadPlan(plan.id)
  }

  function toggleDay(dayId) {
    setExpandedDays(prev => ({ ...prev, [dayId]: !prev[dayId] }))
  }

  // ── Incoming exercise from ExerciseDetail ──────────────────────────────────

  async function handleDayPicked(day) {
    setPendingDay(day)
    setDayPickerOpen(false)
  }

  async function handleIncomingConfirm(opts) {
    if (!pendingDay || !incomingExercise) return
    await addExerciseToDay(pendingDay.id, incomingExercise.id, {
      targetSets: opts.sets, targetReps: opts.reps,
      targetWeight: opts.weight, restSeconds: opts.rest,
    })
    setPendingDay(null)
    setIncomingExercise(null)
    window.history.replaceState({}, '')
    await loadPlan(plan.id)
    showToast('Exercise added!')
  }

  // ── Empty state ────────────────────────────────────────────────────────────

  if (!plan) {
    return (
      <div className="page">
        <h1 style={{ margin: '0 0 4px' }}>Workout<br /><span style={{ color: 'var(--accent)' }}>Planner</span></h1>
        <p style={{ color: 'var(--text3)', marginBottom: 24 }}>Create a weekly plan to organize your training.</p>

        {showWizard ? (
          <CreateWizard onDone={handleWizardDone} onCancel={() => setShowWizard(false)} />
        ) : (
          <>
            {allPlans.length > 0 && (
              <button className="btn btn-ghost" style={{ width: '100%', marginBottom: 12, justifyContent: 'flex-start' }}
                onClick={() => setShowPicker(true)}>
                <BookOpen size={16} /> Switch to saved plan ({allPlans.length})
              </button>
            )}
            <button className="btn btn-primary" style={{ width: '100%', marginBottom: 16 }} onClick={() => setShowWizard(true)}>
              <Plus size={18} /> Create Custom Plan
            </button>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>
              Or start from a template
            </div>
            {TEMPLATES.map(t => (
              <button key={t.name} className="btn btn-ghost" style={{ width: '100%', marginBottom: 10, justifyContent: 'flex-start' }}
                onClick={() => handleCreateFromTemplate(t)}>
                {t.name}
              </button>
            ))}
          </>
        )}

        {showPicker && (
          <PlanPickerSheet
            plans={allPlans}
            activePlanId={null}
            switching={switching}
            onSelect={handleSwitchPlan}
            onDelete={planId => setDeleteTarget(allPlans.find(p => p.id === planId))}
            onCreate={handleNewPlan}
            onClose={() => setShowPicker(false)}
          />
        )}

        {deleteTarget && (
          <ConfirmModal
            title={`Delete "${deleteTarget.name}"?`}
            message="This will permanently remove this plan and all its days and exercises."
            confirmLabel="Delete"
            onConfirm={handleDeleteConfirm}
            onCancel={() => setDeleteTarget(null)}
          />
        )}
      </div>
    )
  }

  // ── Active plan view ───────────────────────────────────────────────────────

  const trainingDays = plan.days?.filter(d => d.name !== 'Rest') ?? []

  return (
    <div className="page">
      {/* Modals */}
      {deleteTarget && (
        <ConfirmModal
          title={`Delete "${deleteTarget.name}"?`}
          message="This will permanently remove this plan and all its days and exercises."
          confirmLabel="Delete"
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--accent)', color: '#000', padding: '10px 20px',
          borderRadius: 20, fontWeight: 700, zIndex: 300, whiteSpace: 'nowrap',
        }}>{toast}</div>
      )}

      {/* Plan Picker Sheet */}
      {showPicker && (
        <PlanPickerSheet
          plans={allPlans}
          activePlanId={plan.id}
          switching={switching}
          onSelect={handleSwitchPlan}
          onDelete={planId => setDeleteTarget(allPlans.find(p => p.id === planId))}
          onCreate={handleNewPlan}
          onClose={() => setShowPicker(false)}
        />
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              Active Plan
            </div>
            {plan.serverId && (
              <span style={{
                fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.08em',
                textTransform: 'uppercase', color: '#000',
                background: 'var(--accent)', padding: '2px 7px', borderRadius: 100,
              }}>AI</span>
            )}
          </div>

          {editingName ? (
            <input
              ref={nameInputRef}
              value={draftName}
              onChange={e => setDraftName(e.target.value)}
              onBlur={commitRename}
              onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setEditingName(false) }}
              style={{
                fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: '1.4rem',
                background: 'var(--surface2)', border: '1px solid var(--accent)',
                borderRadius: 8, padding: '2px 8px', color: 'var(--text)', width: '100%',
              }}
            />
          ) : (
            <button
              onClick={startEditName}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, background: 'none',
                border: 'none', cursor: 'pointer', padding: 0, color: 'var(--text)',
              }}
            >
              <h2 style={{ margin: 0, fontFamily: 'Barlow Condensed' }}>{plan.name}</h2>
              <Edit2 size={14} color="var(--text3)" />
            </button>
          )}
        </div>

        <button
          className="btn btn-ghost"
          style={{ fontSize: '0.75rem', padding: '8px 12px', flexShrink: 0, marginLeft: 12 }}
          onClick={() => setShowPicker(true)}
        >
          <BookOpen size={14} />
          {allPlans.length > 1 ? ` ${allPlans.length} plans` : ' Plans'}
        </button>
      </div>

      {/* Day cards */}
      {plan.days?.map(day => (
        <div key={day.id} className="card" style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text3)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                {DAY_NAMES[day.dayOfWeek]}
              </div>
              <input
                value={day.name}
                onChange={e => handleDayNameChange(day.id, e.target.value)}
                style={{ background: 'none', border: 'none', padding: 0, fontSize: '1.1rem', fontFamily: 'Barlow Condensed', fontWeight: 700, color: 'var(--text)', width: '100%' }}
              />
            </div>
            <span style={{
              fontSize: '0.75rem', fontWeight: 700, padding: '2px 8px',
              background: 'var(--surface2)', borderRadius: 10,
              color: day.exercises?.length > 0 ? 'var(--accent)' : 'var(--text3)',
            }}>
              {day.exercises?.length ?? 0}
            </span>
            {day.exercises?.length > 0 && (
              <button className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                onClick={() => handleStartDay(day)}>
                <Play size={14} />
              </button>
            )}
            <button onClick={() => toggleDay(day.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 4 }}>
              {expandedDays[day.id] ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>
          </div>

          {expandedDays[day.id] && (
            <div style={{ marginTop: 12 }}>
              {day.exercises?.map(ex => {
                const info = getExerciseById(ex.tutorialId)
                const isEditing = editingEx?.ex.id === ex.id
                return (
                  <div key={ex.id}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                      {info && (
                        <img src={exImageUrl(info.id)} style={{ width: 36, height: 36, borderRadius: 6, objectFit: 'cover' }} alt="" />
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 600, fontSize: '0.95rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {info?.name ?? ex.tutorialId}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text3)' }}>
                          {ex.targetSets}×{ex.targetReps} · {ex.restSeconds}s rest
                        </div>
                      </div>
                      <button
                        onClick={() => setEditingEx(isEditing ? null : { ex, dayId: day.id })}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: isEditing ? 'var(--accent)' : 'var(--text3)', padding: 4 }}>
                        <Edit2 size={15} />
                      </button>
                      <button onClick={() => handleRemoveExercise(ex.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 4 }}>
                        <Trash2 size={16} />
                      </button>
                    </div>

                    {isEditing && (
                      <InlineEditForm
                        ex={ex}
                        onSave={opts => handleSaveEdit(ex.id, opts)}
                        onCancel={() => setEditingEx(null)}
                      />
                    )}
                  </div>
                )
              })}

              <button className="btn btn-ghost" style={{ width: '100%', marginTop: 10, fontSize: '0.85rem' }}
                onClick={() => nav('/exercises', {
                  state: { selectForDay: day.id, dayName: day.name, defaultRest: day.restSeconds ?? 60 },
                })}>
                <Plus size={16} /> Add Exercise
              </button>
            </div>
          )}
        </div>
      ))}

      {/* Day picker modal for incoming exercise from ExerciseDetail */}
      {dayPickerOpen && incomingExercise && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'flex-end', zIndex: 200,
        }}>
          <div style={{
            background: 'var(--surface)', borderRadius: '16px 16px 0 0',
            padding: 20, width: '100%', maxWidth: 480, margin: '0 auto',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: '1.1rem' }}>
                Add to which day?
              </div>
              <button onClick={() => { setDayPickerOpen(false); setIncomingExercise(null) }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)' }}>
                <X size={20} />
              </button>
            </div>
            {trainingDays.map(d => (
              <button key={d.id} className="btn btn-ghost"
                style={{ width: '100%', marginBottom: 8, justifyContent: 'flex-start' }}
                onClick={() => handleDayPicked(d)}>
                <span style={{ color: 'var(--text3)', fontSize: '0.8rem', marginRight: 8 }}>{DAY_NAMES[d.dayOfWeek]}</span>
                {d.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Exercise config sheet for incoming exercise after day is picked */}
      {pendingDay && incomingExercise && (
        <ExerciseConfigSheet
          tutorialId={incomingExercise.id}
          initial={{ rest: pendingDay.restSeconds ?? 60 }}
          confirmLabel="Add to Plan"
          onConfirm={handleIncomingConfirm}
          onCancel={() => { setPendingDay(null); setIncomingExercise(null) }}
        />
      )}
    </div>
  )
}
