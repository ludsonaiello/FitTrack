import { useState } from 'react'
import { Home, Dumbbell, PlayCircle, BarChart2, User, ChevronRight, Check } from 'lucide-react'
import { db } from '../db/index.js'
import { toKg } from '../hooks/useWeightUnit.js'

const TOUR_STEPS = [
  {
    Icon: Home,
    label: 'Home',
    title: 'Your Dashboard',
    description: 'See today\'s plan, your workout streak, 30-day activity heatmap, and recent sessions — all in one place.',
  },
  {
    Icon: Dumbbell,
    label: 'Exercises',
    title: 'Exercise Library',
    description: '610 exercises. Search by muscle group, watch video demos, track history, and add any exercise to your plan.',
  },
  {
    Icon: PlayCircle,
    label: 'Plan',
    title: 'Weekly Planner',
    description: 'Build your weekly training schedule. Set exercises per day with target sets, reps, weight, and rest time.',
  },
  {
    Icon: BarChart2,
    label: 'Progress',
    title: 'Track Progress',
    description: 'Log your body weight and review strength PRs for every exercise. Watch your gains over time with charts.',
  },
  {
    Icon: User,
    label: 'Profile',
    title: 'Profile & Settings',
    description: 'Set your fitness goals, switch between kg and lbs, enable rest timer notifications, and export your data.',
  },
]

const GOAL_TYPES = [
  { value: 'frequency', label: 'Workouts / week', placeholder: '3' },
  { value: 'weight',    label: 'Target body weight', placeholder: '75' },
]

const SETUP_STEPS = 4

export default function Onboarding({ onComplete }) {
  const [phase, setPhase] = useState('tour')  // 'tour' | 'setup'
  const [tourStep, setTourStep] = useState(0)
  const [setupStep, setSetupStep] = useState(0)

  const [name, setName] = useState('')
  const [unit, setUnit] = useState('kg')
  const [weight, setWeight] = useState('')
  const [goalType, setGoalType] = useState('frequency')
  const [goalValue, setGoalValue] = useState('')

  function nextTour() {
    if (tourStep < TOUR_STEPS.length - 1) {
      setTourStep(i => i + 1)
    } else {
      setPhase('setup')
    }
  }

  async function finish() {
    if (name.trim()) localStorage.setItem('ft_name', name.trim())
    localStorage.setItem('ft_weight_unit', unit)

    if (weight && parseFloat(weight) > 0) {
      await db.bodyWeights.add({
        weight: toKg(parseFloat(weight), unit),
        date: new Date().toISOString().slice(0, 10),
        recordedAt: new Date().toISOString(),
      })
    }

    if (goalValue && parseFloat(goalValue) > 0) {
      await db.goals.add({
        type: goalType,
        targetValue: parseFloat(goalValue),
        achieved: false,
        createdAt: new Date().toISOString(),
      })
    }

    localStorage.setItem('ft_onboarded', '1')
    onComplete()
  }

  // ── Tour ────────────────────────────────────────────────────────────────────

  if (phase === 'tour') {
    const step = TOUR_STEPS[tourStep]
    const { Icon } = step

    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.93)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '24px 24px 48px',
      }}>
        {/* Skip */}
        <button
          onClick={() => setPhase('setup')}
          style={{ position: 'absolute', top: 20, right: 20, background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, padding: 8 }}
        >
          Skip tour
        </button>

        {/* Step dots */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 44 }}>
          {TOUR_STEPS.map((_, i) => (
            <div key={i} style={{
              width: i === tourStep ? 22 : 6,
              height: 6, borderRadius: 3,
              background: i === tourStep ? 'var(--accent)' : 'rgba(255,255,255,0.15)',
              transition: 'all 0.3s ease',
            }} />
          ))}
        </div>

        {/* Icon */}
        <div style={{
          width: 100, height: 100, borderRadius: 28,
          background: 'rgba(232,255,0,0.08)',
          border: '1.5px solid rgba(232,255,0,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 32,
        }}>
          <Icon size={48} color="var(--accent)" strokeWidth={1.4} />
        </div>

        {/* Text */}
        <div style={{ textAlign: 'center', marginBottom: 44, maxWidth: 340 }}>
          <h2 style={{ margin: '0 0 14px', fontFamily: 'Barlow Condensed', fontWeight: 800, fontSize: '1.9rem', letterSpacing: '0.01em' }}>
            {step.title}
          </h2>
          <p style={{ margin: 0, color: 'var(--text2)', fontSize: '1rem', lineHeight: 1.65 }}>
            {step.description}
          </p>
        </div>

        {/* Mini nav preview */}
        <div style={{
          display: 'flex', gap: 4,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 18, padding: '10px 12px', marginBottom: 40,
        }}>
          {TOUR_STEPS.map((t, i) => {
            const TIcon = t.Icon
            const active = i === tourStep
            return (
              <div key={i} onClick={() => setTourStep(i)} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                padding: '8px 14px', borderRadius: 12, cursor: 'pointer',
                background: active ? 'rgba(232,255,0,0.12)' : 'transparent',
                transition: 'background 0.2s',
              }}>
                <TIcon size={20} color={active ? 'var(--accent)' : 'var(--text3)'} strokeWidth={active ? 2.5 : 1.8} />
                <span style={{ fontSize: '0.6rem', fontWeight: 700, color: active ? 'var(--accent)' : 'var(--text3)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  {t.label}
                </span>
              </div>
            )
          })}
        </div>

        <button
          className="btn btn-primary"
          style={{ width: '100%', maxWidth: 340, padding: '14px' }}
          onClick={nextTour}
        >
          {tourStep < TOUR_STEPS.length - 1
            ? <>Next <ChevronRight size={18} /></>
            : 'Set up your profile'}
        </button>
      </div>
    )
  }

  // ── Setup form ───────────────────────────────────────────────────────────────

  const setupTitles = ["What's your name?", 'Weight unit', 'Starting weight', 'Set a goal']
  const setupSubs   = [
    'We\'ll use this to personalize your experience.',
    'You can change this anytime in Profile.',
    'Optional — we\'ll track your progress from here.',
    'Optional — helps you stay focused and motivated.',
  ]

  function handleSetupNext() {
    if (setupStep < SETUP_STEPS - 1) {
      setSetupStep(i => i + 1)
    } else {
      finish()
    }
  }

  const canContinue = !(setupStep === 0 && !name.trim())

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'var(--bg)',
      display: 'flex', flexDirection: 'column',
      padding: '28px 24px 40px',
      maxWidth: 480, margin: '0 auto',
      boxSizing: 'border-box',
    }}>
      {/* Progress bar */}
      <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, marginBottom: 36, overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: 2,
          background: 'var(--accent)',
          width: `${((setupStep + 1) / SETUP_STEPS) * 100}%`,
          transition: 'width 0.35s ease',
        }} />
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        {/* Step label + heading */}
        <div style={{ marginBottom: 36 }}>
          <p style={{ color: 'var(--text3)', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', margin: '0 0 10px' }}>
            {setupStep + 1} of {SETUP_STEPS}
          </p>
          <h2 style={{ margin: '0 0 8px', fontFamily: 'Barlow Condensed', fontWeight: 800, fontSize: '2rem', lineHeight: 1.1 }}>
            {setupTitles[setupStep]}
          </h2>
          <p style={{ margin: 0, color: 'var(--text3)', fontSize: '0.88rem' }}>
            {setupSubs[setupStep]}
          </p>
        </div>

        {/* Step 0 — Name */}
        {setupStep === 0 && (
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && name.trim() && handleSetupNext()}
            placeholder="Your name"
            autoFocus
            style={{
              fontSize: '1.25rem', padding: '16px', borderRadius: 12,
              border: '1px solid var(--border)', background: 'var(--surface2)',
              color: 'var(--text)', width: '100%', boxSizing: 'border-box',
              outline: 'none',
            }}
          />
        )}

        {/* Step 1 — Unit */}
        {setupStep === 1 && (
          <div style={{ display: 'flex', gap: 14 }}>
            {['kg', 'lbs'].map(u => (
              <button
                key={u}
                onClick={() => setUnit(u)}
                style={{
                  flex: 1, padding: '24px 0', borderRadius: 16,
                  border: `2px solid ${unit === u ? 'var(--accent)' : 'var(--border)'}`,
                  background: unit === u ? 'rgba(232,255,0,0.1)' : 'var(--surface2)',
                  color: unit === u ? 'var(--accent)' : 'var(--text2)',
                  fontFamily: 'Barlow Condensed', fontWeight: 800, fontSize: '2rem',
                  cursor: 'pointer', letterSpacing: '0.04em',
                  transition: 'all 0.15s',
                }}
              >
                {u}
              </button>
            ))}
          </div>
        )}

        {/* Step 2 — Current weight */}
        {setupStep === 2 && (
          <div style={{ position: 'relative' }}>
            <input
              type="number"
              value={weight}
              onChange={e => setWeight(e.target.value)}
              placeholder={unit === 'kg' ? '70' : '154'}
              autoFocus
              min={unit === 'kg' ? 20 : 44}
              max={unit === 'kg' ? 300 : 660}
              style={{
                fontSize: '1.5rem', padding: '16px 72px 16px 18px',
                borderRadius: 12, border: '1px solid var(--border)',
                background: 'var(--surface2)', color: 'var(--text)',
                width: '100%', boxSizing: 'border-box', outline: 'none',
              }}
            />
            <span style={{
              position: 'absolute', right: 18, top: '50%', transform: 'translateY(-50%)',
              color: 'var(--text3)', fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: '1.1rem',
            }}>
              {unit}
            </span>
          </div>
        )}

        {/* Step 3 — Goal */}
        {setupStep === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', gap: 10 }}>
              {GOAL_TYPES.map(g => (
                <button
                  key={g.value}
                  onClick={() => { setGoalType(g.value); setGoalValue('') }}
                  style={{
                    flex: 1, padding: '14px 8px', borderRadius: 12, textAlign: 'center',
                    border: `2px solid ${goalType === g.value ? 'var(--accent)' : 'var(--border)'}`,
                    background: goalType === g.value ? 'rgba(232,255,0,0.1)' : 'var(--surface2)',
                    color: goalType === g.value ? 'var(--accent)' : 'var(--text2)',
                    fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer',
                    transition: 'all 0.15s',
                    lineHeight: 1.4,
                  }}
                >
                  {g.label}
                </button>
              ))}
            </div>
            <div style={{ position: 'relative' }}>
              <input
                type="number"
                value={goalValue}
                onChange={e => setGoalValue(e.target.value)}
                placeholder={GOAL_TYPES.find(g => g.value === goalType)?.placeholder}
                autoFocus
                min={0}
                style={{
                  fontSize: '1.5rem', padding: '16px 88px 16px 18px',
                  borderRadius: 12, border: '1px solid var(--border)',
                  background: 'var(--surface2)', color: 'var(--text)',
                  width: '100%', boxSizing: 'border-box', outline: 'none',
                }}
              />
              <span style={{
                position: 'absolute', right: 18, top: '50%', transform: 'translateY(-50%)',
                color: 'var(--text3)', fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: '0.9rem',
              }}>
                {goalType === 'frequency' ? 'times/wk' : unit}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', gap: 10 }}>
          {setupStep > 0 && (
            <button className="btn btn-ghost" onClick={() => setSetupStep(i => i - 1)}>
              Back
            </button>
          )}
          <button
            className="btn btn-primary"
            style={{ flex: 1 }}
            onClick={handleSetupNext}
            disabled={!canContinue}
          >
            {setupStep < SETUP_STEPS - 1
              ? 'Continue'
              : <><Check size={16} /> Let's go!</>
            }
          </button>
        </div>

        {/* Skip optional steps */}
        {setupStep > 1 && (
          <button
            onClick={handleSetupNext}
            style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: '0.82rem', padding: '4px 0', textAlign: 'center' }}
          >
            Skip this step
          </button>
        )}

        {/* Skip entire setup (only on first step) */}
        {setupStep === 0 && (
          <button
            onClick={finish}
            style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: '0.82rem', padding: '4px 0', textAlign: 'center' }}
          >
            Skip setup
          </button>
        )}
      </div>
    </div>
  )
}
