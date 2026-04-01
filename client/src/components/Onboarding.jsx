import { useState, useMemo } from 'react'
import { Home, Dumbbell, PlayCircle, BarChart2, User, ChevronRight, Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import i18n from '../i18n/index.js'
import { db } from '../db/index.js'
import { enqueue } from '../db/sync-queue.js'
import { toKg } from '../hooks/useWeightUnit.js'
import { api } from '../lib/api.js'
import { ftInToCm } from '../lib/bmi.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useNumericKeyboard } from '../context/NumericKeyboardContext.jsx'

// Tour step definitions — use translation keys, not hardcoded strings
const TOUR_STEP_KEYS = [
  { Icon: Home,       labelKey: 'nav.home',      titleKey: 'onboarding.tour_home_title',      descKey: 'onboarding.tour_home_desc' },
  { Icon: Dumbbell,   labelKey: 'nav.exercises',  titleKey: 'onboarding.tour_exercises_title', descKey: 'onboarding.tour_exercises_desc' },
  { Icon: PlayCircle, labelKey: 'nav.plan',       titleKey: 'onboarding.tour_planner_title',   descKey: 'onboarding.tour_planner_desc' },
  { Icon: BarChart2,  labelKey: 'nav.progress',   titleKey: 'onboarding.tour_progress_title',  descKey: 'onboarding.tour_progress_desc' },
  { Icon: User,       labelKey: 'nav.profile',    titleKey: 'onboarding.tour_profile_title',   descKey: 'onboarding.tour_profile_desc' },
]

const SEX_OPTION_KEYS = [
  { value: 'male',        labelKey: 'onboarding.sex_male' },
  { value: 'female',      labelKey: 'onboarding.sex_female' },
  { value: 'unspecified', labelKey: 'onboarding.sex_unspecified' },
]

const GOAL_TYPE_KEYS = [
  { value: 'FREQUENCY', labelKey: 'onboarding.goal_frequency', placeholder: '3' },
  { value: 'WEIGHT',    labelKey: 'onboarding.goal_weight',    placeholder: '75' },
]

// 0=language, 1=name, 2=unit, 3=weight, 4=sex, 5=height, 6=goal
const SETUP_STEPS = 7

export default function Onboarding({ onComplete }) {
  const { t } = useTranslation()
  const { user, refreshUser } = useAuth()
  const keyboard = useNumericKeyboard()
  const isMobile = useMemo(() => window.matchMedia('(pointer: coarse)').matches, [])
  const [phase, setPhase] = useState('tour')  // 'tour' | 'setup'
  const [tourStep, setTourStep] = useState(0)
  const [setupStep, setSetupStep] = useState(0)

  const [lang, setLang] = useState(() => localStorage.getItem('ft_language') ?? 'en')
  // Pre-populate name from the account they just registered
  const [name, setName] = useState(() => user?.name || localStorage.getItem('ft_name') || '')
  const [unit, setUnit] = useState('kg')
  const [weight, setWeight] = useState('')
  const [sex, setSex] = useState('')
  const [heightUnit, setHeightUnit] = useState('cm')
  const [heightCm, setHeightCm] = useState('')
  const [heightFt, setHeightFt] = useState('')
  const [heightIn, setHeightIn] = useState('0')
  const [goalType, setGoalType] = useState('FREQUENCY')
  const [goalValue, setGoalValue] = useState('')

  function selectLanguage(code) {
    setLang(code)
    i18n.changeLanguage(code)
    localStorage.setItem('ft_language', code)
  }

  function nextTour() {
    if (tourStep < TOUR_STEP_KEYS.length - 1) {
      setTourStep(i => i + 1)
    } else {
      setPhase('setup')
    }
  }

  async function finish() {
    if (name.trim()) localStorage.setItem('ft_name', name.trim())
    localStorage.setItem('ft_weight_unit', unit)

    if (weight && parseFloat(weight) > 0) {
      const weightKg = toKg(parseFloat(weight), unit)
      const loggedAt = new Date().toISOString()
      const localId = await db.bodyWeights.add({ weight: weightKg, unit: 'kg', loggedAt })
      enqueue('bodyWeights', localId, { weight: weightKg, unit: 'kg', loggedAt })
    }

    if (goalValue && parseFloat(goalValue) > 0) {
      await db.goals.add({
        type: goalType,
        targetValue: parseFloat(goalValue),
        achieved: false,
        createdAt: new Date().toISOString(),
      })
    }

    // Compute height in cm
    let computedHeightCm = null
    if (heightUnit === 'ft') {
      const val = ftInToCm(heightFt || 0, heightIn || 0)
      if (val >= 50) computedHeightCm = val
    } else if (heightCm && parseFloat(heightCm) >= 50) {
      computedHeightCm = parseFloat(heightCm)
    }

    // Sync profile to server — await so refreshUser gets the updated data
    const patch = { onboarded: true, language: lang }
    if (name.trim()) patch.name = name.trim()
    if (sex) patch.sex = sex
    if (computedHeightCm) { patch.heightCm = computedHeightCm; patch.heightUnit = heightUnit }
    try {
      const res = await api.patch('/api/auth/me', patch)
      if (res?.data) refreshUser(res.data)
    } catch { /* offline — ignore */ }

    localStorage.setItem('ft_onboarded', '1')
    onComplete()
  }

  // ── Tour ────────────────────────────────────────────────────────────────────

  if (phase === 'tour') {
    const step = TOUR_STEP_KEYS[tourStep]
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
          {t('onboarding.skip_tour')}
        </button>

        {/* Step dots */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 44 }}>
          {TOUR_STEP_KEYS.map((_, i) => (
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
            {t(step.titleKey)}
          </h2>
          <p style={{ margin: 0, color: 'var(--text2)', fontSize: '1rem', lineHeight: 1.65 }}>
            {t(step.descKey)}
          </p>
        </div>

        {/* Mini nav preview */}
        <div style={{
          display: 'flex', gap: 4,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 18, padding: '10px 12px', marginBottom: 40,
        }}>
          {TOUR_STEP_KEYS.map((ts, i) => {
            const TIcon = ts.Icon
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
                  {t(ts.labelKey)}
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
          {tourStep < TOUR_STEP_KEYS.length - 1
            ? <>{t('onboarding.next')} <ChevronRight size={18} /></>
            : t('onboarding.set_up_profile')}
        </button>
      </div>
    )
  }

  // ── Setup form ───────────────────────────────────────────────────────────────

  const setupTitles = [
    t('onboarding.step_language_title'),
    t('onboarding.step_name_title'),
    t('onboarding.step_unit_title'),
    t('onboarding.step_weight_title'),
    t('onboarding.step_sex_title'),
    t('onboarding.step_height_title'),
    t('onboarding.step_goal_title'),
  ]
  const setupSubs = [
    t('onboarding.step_language_sub'),
    t('onboarding.step_name_sub'),
    t('onboarding.step_unit_sub'),
    t('onboarding.step_weight_sub'),
    t('onboarding.step_sex_sub'),
    t('onboarding.step_height_sub'),
    t('onboarding.step_goal_sub'),
  ]

  function handleSetupNext() {
    if (setupStep < SETUP_STEPS - 1) {
      setSetupStep(i => i + 1)
    } else {
      finish()
    }
  }

  // Name is pre-populated from registration; block only if completely empty
  const canContinue = !(setupStep === 1 && !name.trim())

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
            {t('onboarding.step_label', { current: setupStep + 1, total: SETUP_STEPS })}
          </p>
          <h2 style={{ margin: '0 0 8px', fontFamily: 'Barlow Condensed', fontWeight: 800, fontSize: '2rem', lineHeight: 1.1 }}>
            {setupTitles[setupStep]}
          </h2>
          <p style={{ margin: 0, color: 'var(--text3)', fontSize: '0.88rem' }}>
            {setupSubs[setupStep]}
          </p>
        </div>

        {/* Step 0 — Language */}
        {setupStep === 0 && (
          <div style={{ display: 'flex', gap: 14 }}>
            {[
              { code: 'en',    label: t('onboarding.language_english') },
              { code: 'pt-BR', label: t('onboarding.language_portuguese') },
            ].map(({ code, label }) => (
              <button
                key={code}
                onClick={() => selectLanguage(code)}
                style={{
                  flex: 1, padding: '24px 8px', borderRadius: 16,
                  border: `2px solid ${lang === code ? 'var(--accent)' : 'var(--border)'}`,
                  background: lang === code ? 'rgba(232,255,0,0.1)' : 'var(--surface2)',
                  color: lang === code ? 'var(--accent)' : 'var(--text2)',
                  fontFamily: 'Barlow Condensed', fontWeight: 800, fontSize: '1.1rem',
                  cursor: 'pointer', letterSpacing: '0.02em',
                  transition: 'all 0.15s',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                {lang === code && <Check size={16} color="var(--accent)" />}
                {label}
              </button>
            ))}
          </div>
        )}

        {/* Step 1 — Name */}
        {setupStep === 1 && (
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && name.trim() && handleSetupNext()}
            placeholder={t('onboarding.name_input_placeholder')}
            autoFocus
            style={{
              fontSize: '1.25rem', padding: '16px', borderRadius: 12,
              border: '1px solid var(--border)', background: 'var(--surface2)',
              color: 'var(--text)', width: '100%', boxSizing: 'border-box',
              outline: 'none',
            }}
          />
        )}

        {/* Step 2 — Unit */}
        {setupStep === 2 && (
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

        {/* Step 3 — Current weight */}
        {setupStep === 3 && (
          <div style={{ position: 'relative' }}>
            <input
              type={isMobile ? 'text' : 'number'}
              inputMode={isMobile ? 'none' : undefined}
              readOnly={isMobile || undefined}
              value={weight}
              placeholder={unit === 'kg' ? '70' : '154'}
              autoFocus={!isMobile}
              min={!isMobile ? (unit === 'kg' ? 20 : 44) : undefined}
              max={!isMobile ? (unit === 'kg' ? 300 : 660) : undefined}
              style={{
                fontSize: '1.5rem', padding: '16px 72px 16px 18px',
                borderRadius: 12, border: '1px solid var(--border)',
                background: 'var(--surface2)', color: 'var(--text)',
                width: '100%', boxSizing: 'border-box', outline: 'none',
              }}
              onChange={isMobile ? undefined : e => setWeight(e.target.value)}
              onFocus={() => {
                if (!isMobile) return
                keyboard.open({
                  label: `Weight: ${unit === 'kg' ? '70' : '154'} ${unit}`,
                  value: weight,
                  onChange: v => setWeight(v),
                  isLastField: true,
                  onDone: () => keyboard.close(),
                })
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

        {/* Step 4 — Sex */}
        {setupStep === 4 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {SEX_OPTION_KEYS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setSex(opt.value)}
                style={{
                  padding: '18px 20px', borderRadius: 14, textAlign: 'left',
                  border: `2px solid ${sex === opt.value ? 'var(--accent)' : 'var(--border)'}`,
                  background: sex === opt.value ? 'rgba(232,255,0,0.1)' : 'var(--surface2)',
                  color: sex === opt.value ? 'var(--accent)' : 'var(--text)',
                  fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: '1.2rem',
                  cursor: 'pointer', transition: 'all 0.15s', letterSpacing: '0.02em',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}
              >
                {t(opt.labelKey)}
                {sex === opt.value && <Check size={18} color="var(--accent)" />}
              </button>
            ))}
          </div>
        )}

        {/* Step 5 — Height */}
        {setupStep === 5 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Unit toggle */}
            <div style={{ display: 'flex', gap: 8 }}>
              {['cm', 'ft'].map(u => (
                <button
                  key={u}
                  onClick={() => setHeightUnit(u)}
                  style={{
                    flex: 1, padding: '10px 0', borderRadius: 10,
                    border: `2px solid ${heightUnit === u ? 'var(--accent)' : 'var(--border)'}`,
                    background: heightUnit === u ? 'rgba(232,255,0,0.1)' : 'var(--surface2)',
                    color: heightUnit === u ? 'var(--accent)' : 'var(--text2)',
                    fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: '1.1rem',
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}
                >
                  {u === 'cm' ? 'cm' : 'ft / in'}
                </button>
              ))}
            </div>
            {/* Input */}
            {heightUnit === 'cm' ? (
              <div style={{ position: 'relative' }}>
                <input
                  type={isMobile ? 'text' : 'number'}
                  inputMode={isMobile ? 'none' : undefined}
                  readOnly={isMobile || undefined}
                  value={heightCm}
                  placeholder="170"
                  autoFocus={!isMobile}
                  min={!isMobile ? 50 : undefined}
                  max={!isMobile ? 275 : undefined}
                  style={{
                    fontSize: '1.5rem', padding: '16px 72px 16px 18px',
                    borderRadius: 12, border: '1px solid var(--border)',
                    background: 'var(--surface2)', color: 'var(--text)',
                    width: '100%', boxSizing: 'border-box', outline: 'none',
                  }}
                  onChange={isMobile ? undefined : e => setHeightCm(e.target.value)}
                  onFocus={() => {
                    if (!isMobile) return
                    keyboard.open({
                      label: 'Height: 170 cm',
                      value: heightCm,
                      onChange: v => setHeightCm(v),
                      isLastField: true,
                      onDone: () => keyboard.close(),
                    })
                  }}
                />
                <span style={{
                  position: 'absolute', right: 18, top: '50%', transform: 'translateY(-50%)',
                  color: 'var(--text3)', fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: '1.1rem',
                }}>cm</span>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <input
                    type={isMobile ? 'text' : 'number'}
                    inputMode={isMobile ? 'none' : undefined}
                    readOnly={isMobile || undefined}
                    value={heightFt}
                    placeholder="5"
                    autoFocus={!isMobile}
                    min={!isMobile ? 3 : undefined}
                    max={!isMobile ? 8 : undefined}
                    data-nk="ob-height-ft"
                    style={{
                      fontSize: '1.5rem', padding: '16px 52px 16px 18px',
                      borderRadius: 12, border: '1px solid var(--border)',
                      background: 'var(--surface2)', color: 'var(--text)',
                      width: '100%', boxSizing: 'border-box', outline: 'none',
                    }}
                    onChange={isMobile ? undefined : e => setHeightFt(e.target.value)}
                    onFocus={() => {
                      if (!isMobile) return
                      keyboard.open({
                        label: 'Height: 5 ft',
                        value: heightFt,
                        onChange: v => setHeightFt(v),
                        isLastField: false,
                        onNext: () => document.querySelector('[data-nk="ob-height-in"]')?.focus(),
                      })
                    }}
                  />
                  <span style={{
                    position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
                    color: 'var(--text3)', fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: '1.1rem',
                  }}>ft</span>
                </div>
                <div style={{ position: 'relative', flex: 1 }}>
                  <input
                    type={isMobile ? 'text' : 'number'}
                    inputMode={isMobile ? 'none' : undefined}
                    readOnly={isMobile || undefined}
                    value={heightIn}
                    placeholder="10"
                    min={!isMobile ? 0 : undefined}
                    max={!isMobile ? 11 : undefined}
                    data-nk="ob-height-in"
                    style={{
                      fontSize: '1.5rem', padding: '16px 52px 16px 18px',
                      borderRadius: 12, border: '1px solid var(--border)',
                      background: 'var(--surface2)', color: 'var(--text)',
                      width: '100%', boxSizing: 'border-box', outline: 'none',
                    }}
                    onChange={isMobile ? undefined : e => setHeightIn(e.target.value)}
                    onFocus={() => {
                      if (!isMobile) return
                      keyboard.open({
                        label: 'Inches: 10 in',
                        value: heightIn,
                        onChange: v => setHeightIn(v),
                        isLastField: true,
                        onDone: () => keyboard.close(),
                      })
                    }}
                  />
                  <span style={{
                    position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
                    color: 'var(--text3)', fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: '1.1rem',
                  }}>in</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 6 — Goal */}
        {setupStep === 6 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', gap: 10 }}>
              {GOAL_TYPE_KEYS.map(g => (
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
                  {t(g.labelKey)}
                </button>
              ))}
            </div>
            <div style={{ position: 'relative' }}>
              <input
                type={isMobile ? 'text' : 'number'}
                inputMode={isMobile ? 'none' : undefined}
                readOnly={isMobile || undefined}
                value={goalValue}
                placeholder={GOAL_TYPE_KEYS.find(g => g.value === goalType)?.placeholder}
                autoFocus={!isMobile}
                min={!isMobile ? 0 : undefined}
                style={{
                  fontSize: '1.5rem', padding: '16px 88px 16px 18px',
                  borderRadius: 12, border: '1px solid var(--border)',
                  background: 'var(--surface2)', color: 'var(--text)',
                  width: '100%', boxSizing: 'border-box', outline: 'none',
                }}
                onChange={isMobile ? undefined : e => setGoalValue(e.target.value)}
                onFocus={() => {
                  if (!isMobile) return
                  const suffix = goalType === 'FREQUENCY' ? t('onboarding.times_per_week') : unit
                  keyboard.open({
                    label: `Goal: ${GOAL_TYPE_KEYS.find(g => g.value === goalType)?.placeholder} ${suffix}`,
                    value: goalValue,
                    onChange: v => setGoalValue(v),
                    isLastField: true,
                    onDone: () => keyboard.close(),
                  })
                }}
              />
              <span style={{
                position: 'absolute', right: 18, top: '50%', transform: 'translateY(-50%)',
                color: 'var(--text3)', fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: '0.9rem',
              }}>
                {goalType === 'FREQUENCY' ? t('onboarding.times_per_week') : unit}
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
              {t('onboarding.back')}
            </button>
          )}
          <button
            className="btn btn-primary"
            style={{ flex: 1 }}
            onClick={handleSetupNext}
            disabled={!canContinue}
          >
            {setupStep < SETUP_STEPS - 1
              ? t('onboarding.continue')
              : <><Check size={16} /> {t('onboarding.finish')}</>
            }
          </button>
        </div>

        {/* Skip optional steps (all except name at step 1) */}
        {setupStep > 0 && setupStep !== 1 && (
          <button
            onClick={handleSetupNext}
            style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: '0.82rem', padding: '4px 0', textAlign: 'center' }}
          >
            {t('onboarding.skip_step')}
          </button>
        )}

        {/* Skip entire setup (only on language step, step 0) */}
        {setupStep === 0 && (
          <button
            onClick={finish}
            style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: '0.82rem', padding: '4px 0', textAlign: 'center' }}
          >
            {t('onboarding.skip_setup')}
          </button>
        )}
      </div>
    </div>
  )
}
