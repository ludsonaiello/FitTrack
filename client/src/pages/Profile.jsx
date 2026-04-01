import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import {
  User, Target, Bell, Trash2, Download, LogOut, AlertTriangle,
  Scale, Plus, ExternalLink, Shield, Ruler, Globe, Check,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useLanguage } from '../hooks/useLanguage.js'
import { db } from '../db/index.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useNumericKeyboard } from '../context/NumericKeyboardContext.jsx'
import { useWeightUnit } from '../hooks/useWeightUnit.js'
import ConfirmModal from '../components/ConfirmModal.jsx'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { api } from '../lib/api.js'
import { enqueue } from '../db/sync-queue.js'
import { calculateBmi, classifyBmi, cmToFtIn, ftInToCm } from '../lib/bmi.js'
import { useToast } from '../context/ToastContext.jsx'

const GOAL_TYPE_KEYS = {
  WEIGHT: 'profile.goal_weight',
  FREQUENCY: 'profile.goal_frequency',
}

// ── Reusable profile UI primitives ──────────────────────────────────────────

function SectionLabel({ children }) {
  return (
    <div style={{
      fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: '0.68rem',
      color: 'var(--accent)', letterSpacing: '0.12em', textTransform: 'uppercase',
      padding: '20px 2px 8px',
    }}>
      {children}
    </div>
  )
}

function SegmentPicker({ options, value, onChange, compact = false }) {
  return (
    <div style={{
      display: 'flex', background: 'var(--surface2)', borderRadius: compact ? 8 : 10,
      padding: compact ? 2 : 3, border: '1px solid var(--border)', gap: 2,
    }}>
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          style={{
            flex: 1, padding: compact ? '5px 10px' : '8px 4px',
            borderRadius: compact ? 6 : 8, border: 'none',
            background: value === opt.value ? 'var(--accent)' : 'transparent',
            color: value === opt.value ? '#0a0a0a' : 'var(--text3)',
            fontFamily: 'Barlow Condensed', fontWeight: 700,
            fontSize: compact ? '0.8rem' : '0.95rem',
            cursor: 'pointer', letterSpacing: '0.04em', whiteSpace: 'nowrap',
            transition: 'background 0.15s ease, color 0.15s ease',
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

function IconBox({ icon: Icon, color = 'var(--accent)' }) {
  return (
    <div style={{
      width: 34, height: 34, borderRadius: 8,
      background: 'var(--surface2)', border: '1px solid var(--border)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    }}>
      <Icon size={16} color={color} />
    </div>
  )
}

function Divider() {
  return <div style={{ height: 1, background: 'var(--border)', marginLeft: 68 }} />
}

function GroupCard({ children, style }) {
  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden', ...style }}>
      {children}
    </div>
  )
}

// ── Delete account modal ─────────────────────────────────────────────────────

function DeleteAccountModal({ onClose, onConfirm, deleting }) {
  const { t } = useTranslation()
  const [typed, setTyped] = useState('')
  const confirmWord = t('profile.delete_account_confirm_word')
  const isMatch = typed.trim().toUpperCase() === confirmWord.toUpperCase()

  return createPortal(
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9100,
        background: 'rgba(0,0,0,0.75)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        padding: '0 0 env(safe-area-inset-bottom, 0px)',
      }}
      onClick={e => { if (!deleting && e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        width: '100%', maxWidth: 480,
        background: 'var(--surface)',
        borderRadius: '20px 20px 0 0',
        padding: '24px 20px 32px',
        border: '1px solid var(--border)',
        borderBottom: 'none',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10, flexShrink: 0,
            background: 'rgba(255,61,61,0.12)',
            border: '1px solid rgba(255,61,61,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <AlertTriangle size={20} color="var(--accent2)" />
          </div>
          <div>
            <div style={{
              fontFamily: 'Barlow Condensed', fontWeight: 800,
              fontSize: '1.2rem', color: 'var(--text)',
            }}>
              {t('profile.delete_account_title')}
            </div>
          </div>
        </div>

        {/* Warning text */}
        <div style={{
          background: 'rgba(255,61,61,0.07)',
          border: '1px solid rgba(255,61,61,0.2)',
          borderRadius: 10, padding: '12px 14px',
          fontSize: '0.85rem', color: 'var(--text2)',
          lineHeight: 1.6, marginBottom: 20,
        }}>
          {t('profile.delete_account_warning')}
        </div>

        {/* Confirm input */}
        <div style={{ marginBottom: 16 }}>
          <div style={{
            fontSize: '0.75rem', fontWeight: 700,
            color: 'var(--text3)', letterSpacing: '0.06em',
            textTransform: 'uppercase', marginBottom: 8,
          }}>
            {t('profile.delete_account_confirm_label')}
          </div>
          <input
            type="text"
            value={typed}
            onChange={e => setTyped(e.target.value)}
            placeholder={t('profile.delete_account_confirm_placeholder')}
            disabled={deleting}
            autoCapitalize="characters"
            style={{
              width: '100%', boxSizing: 'border-box',
              textAlign: 'center',
              fontFamily: 'Barlow Condensed', fontWeight: 800,
              fontSize: '1.1rem', letterSpacing: '0.12em',
              borderColor: isMatch ? 'rgba(255,61,61,0.5)' : undefined,
            }}
          />
        </div>

        {/* Buttons */}
        <button
          onClick={onConfirm}
          disabled={!isMatch || deleting}
          style={{
            width: '100%', padding: '14px 0', borderRadius: 12,
            background: isMatch ? 'rgba(255,61,61,0.15)' : 'var(--surface2)',
            border: `1px solid ${isMatch ? 'rgba(255,61,61,0.4)' : 'var(--border)'}`,
            color: isMatch ? '#ff5555' : 'var(--text3)',
            fontFamily: 'Barlow Condensed', fontWeight: 800,
            fontSize: '0.95rem', letterSpacing: '0.05em', textTransform: 'uppercase',
            cursor: isMatch && !deleting ? 'pointer' : 'not-allowed',
            transition: 'all 0.15s',
            marginBottom: 10,
          }}
        >
          {deleting ? t('profile.delete_account_deleting') : t('profile.delete_account_btn')}
        </button>

        <button
          onClick={onClose}
          disabled={deleting}
          style={{
            width: '100%', padding: '13px 0', borderRadius: 12,
            background: 'transparent', border: '1px solid var(--border)',
            color: 'var(--text3)',
            fontFamily: 'Barlow Condensed', fontWeight: 700,
            fontSize: '0.95rem', cursor: 'pointer',
          }}
        >
          {t('common.cancel')}
        </button>
      </div>
    </div>,
    document.body,
  )
}

// ── Main component ───────────────────────────────────────────────────────────

export default function Profile() {
  const { user, logout, refreshUser } = useAuth()
  const { t } = useTranslation()
  const { language, changeLanguage } = useLanguage()
  const navigate = useNavigate()
  const location = useLocation()
  const keyboard = useNumericKeyboard()
  const toast = useToast()
  const isMobile = useMemo(() => window.matchMedia('(pointer: coarse)').matches, [])

  const [weightUnit, setWeightUnit] = useWeightUnit()
  const [name, setName] = useState(() => user?.name || localStorage.getItem('ft_name') || '')
  const [goals, setGoals] = useState([])
  const [newGoalType, setNewGoalType] = useState('WEIGHT')
  const [newGoalValue, setNewGoalValue] = useState('')
  const [dbStats, setDbStats] = useState({ sessions: 0, sets: 0, weights: 0 })
  const [notifPerm, setNotifPerm] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
  )
  const [confirmClear, setConfirmClear] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteDeleting, setDeleteDeleting] = useState(false)
  const [mounted, setMounted] = useState(false)

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
    const timer = setTimeout(() => setMounted(true), 50)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (user?.sex) setSex(user.sex)
    if (user?.heightUnit) setHeightUnit(user.heightUnit)
    if (user?.heightCm) {
      setHeightCm(String(Math.round(user.heightCm)))
      const { feet, inches } = cmToFtIn(user.heightCm)
      setHeightFt(String(feet))
      setHeightIn(String(inches))
    }
    if (user?.name) setName(user.name)
  }, [user])

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
    ]).then(([sessions, sets, weights]) => setDbStats({ sessions, sets, weights }))
    db.bodyWeights.orderBy('loggedAt').reverse().first().then(w => {
      if (w) setLatestWeightKg(w.weight)
    })
  }, [])

  async function saveName() {
    if (!name.trim()) return
    localStorage.setItem('ft_name', name.trim())
    try {
      const res = await api.patch('/api/auth/me', { name: name.trim() })
      if (res?.data) refreshUser(res.data)
      toast.success(t('profile.toast_name_saved'))
    } catch {
      toast.error(t('profile.toast_save_error'))
    }
  }

  async function saveBodyStats() {
    setBodyStatsSaving(true)
    const computed = heightUnit === 'ft'
      ? ftInToCm(heightFt || 0, heightIn || 0)
      : parseFloat(heightCm) || 0
    const patch = { heightUnit }
    if (sex) patch.sex = sex
    if (computed >= 50) patch.heightCm = computed
    try {
      const res = await api.patch('/api/auth/me', patch)
      if (res?.data) refreshUser(res.data)
      toast.success(t('profile.toast_body_saved'))
    } catch {
      toast.error(t('profile.toast_save_error'))
    }
    setBodyStatsSaving(false)
  }

  async function addGoal() {
    if (!newGoalValue) return
    const payload = { type: newGoalType, targetValue: parseFloat(newGoalValue) }
    const id = await db.goals.add({ ...payload, achieved: false, createdAt: new Date().toISOString() })
    setGoals(await db.goals.toArray())
    setNewGoalValue('')
    enqueue('goals', id, payload)
    toast.success(t('profile.toast_goal_added'))
  }

  async function deleteGoal(id) {
    await db.goals.delete(id)
    setGoals(await db.goals.toArray())
    toast.info(t('profile.toast_goal_removed'))
  }

  async function requestNotif() {
    if (typeof Notification === 'undefined') return
    const perm = await Notification.requestPermission()
    setNotifPerm(perm)
    if (perm === 'granted') toast.success(t('profile.toast_notif_enabled'))
    else if (perm === 'denied') toast.error(t('profile.toast_notif_denied'))
  }

  async function clearData() {
    await db.sessions.clear()
    await db.exerciseSets.clear()
    await db.bodyWeights.clear()
    await db.goals.clear()
    await db.plans.clear()
    await db.planDays.clear()
    await db.planExercises.clear()
    setDbStats({ sessions: 0, sets: 0, weights: 0 })
    setGoals([])
    toast.info(t('profile.toast_data_cleared'))
  }

  function exportData() {
    Promise.all([db.sessions.toArray(), db.exerciseSets.toArray(), db.bodyWeights.toArray()])
      .then(([sessions, sets, weights]) => {
        const blob = new Blob([JSON.stringify({ sessions, sets, weights }, null, 2)], { type: 'application/json' })
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = `fittrack-export-${new Date().toISOString().slice(0, 10)}.json`
        a.click()
        toast.success(t('profile.toast_export_done'))
      })
      .catch(() => toast.error(t('profile.toast_save_error')))
  }

  async function handleDeleteAccount() {
    setDeleteDeleting(true)
    try {
      await api.delete('/api/auth/me')
      // Wipe local data before logging out
      await Promise.all([
        db.plans.clear(), db.planDays.clear(), db.planExercises.clear(),
        db.sessions.clear(), db.exerciseSets.clear(),
        db.bodyWeights.clear(), db.goals.clear(), db.syncQueue.clear(),
      ])
      localStorage.clear()
      sessionStorage.clear()
      await logout()
    } catch {
      toast.error(t('profile.delete_account_error'))
      setDeleteDeleting(false)
    }
  }

  const initials = useMemo(() => {
    const n = name || user?.email || '?'
    return n.split(/[\s@]/)[0]?.slice(0, 2).toUpperCase() || '?'
  }, [name, user?.email])

  const computedHeightCm = heightUnit === 'ft'
    ? ftInToCm(heightFt || 0, heightIn || 0)
    : parseFloat(heightCm) || 0
  const bmi = calculateBmi(latestWeightKg, computedHeightCm >= 50 ? computedHeightCm : user?.heightCm)
  const cls = classifyBmi(bmi)

  const anim = (i) => ({
    opacity: mounted ? 1 : 0,
    transform: mounted ? 'translateY(0)' : 'translateY(12px)',
    transition: `opacity 0.3s ease ${i * 55}ms, transform 0.3s ease ${i * 55}ms`,
  })

  const rowStyle = { display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px' }
  const fieldLabelStyle = {
    fontSize: '0.68rem', color: 'var(--text3)', fontWeight: 700,
    letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8,
  }

  return (
    <div className="page">
      {confirmClear && (
        <ConfirmModal
          title={t('profile.delete_all_title')}
          message={t('profile.delete_all_message')}
          confirmLabel={t('profile.delete_all_confirm')}
          onConfirm={() => { setConfirmClear(false); clearData() }}
          onCancel={() => setConfirmClear(false)}
        />
      )}

      {/* ── Page header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', ...anim(0) }}>
        <h1 style={{ margin: 0 }}>{t('profile.title')}</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          {user?.isAdmin && (
            <button className="btn-icon" onClick={() => navigate('/admin')} title={t('profile.admin')}>
              <Shield size={18} color="var(--accent)" />
            </button>
          )}
          <button className="btn-icon" onClick={logout} title={t('profile.sign_out')}>
            <LogOut size={18} />
          </button>
        </div>
      </div>

      {/* ── Hero ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '20px 2px 8px', ...anim(1) }}>
        <div style={{
          width: 68, height: 68, borderRadius: '50%', flexShrink: 0,
          background: 'rgba(232,255,0,0.08)', border: '2px solid rgba(232,255,0,0.35)',
          boxShadow: '0 0 20px rgba(232,255,0,0.10)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'Barlow Condensed', fontWeight: 800, fontSize: '1.7rem', color: 'var(--accent)',
        }}>
          {initials}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: 'Barlow Condensed', fontWeight: 800, fontSize: '1.45rem',
            color: 'var(--text)', lineHeight: 1.1, marginBottom: 4,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {name || t('profile.name_placeholder')}
          </div>
          <div style={{
            fontSize: '0.8rem', color: 'var(--text3)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {user?.email}
          </div>
        </div>
      </div>

      {/* ── ACCOUNT ── */}
      <div style={anim(2)}>
        <SectionLabel>Account</SectionLabel>
        <GroupCard>
          {/* Name */}
          <div style={rowStyle}>
            <IconBox icon={User} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={fieldLabelStyle}>{t('profile.your_name')}</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder={t('profile.name_placeholder')}
                  style={{ flex: 1 }}
                />
                <button
                  className="btn btn-primary"
                  style={{ padding: '10px 14px', flexShrink: 0, borderRadius: 8 }}
                  onClick={saveName}
                  aria-label={t('profile.save')}
                >
                  <Check size={18} strokeWidth={2.5} />
                </button>
              </div>
            </div>
          </div>

          <Divider />

          {/* Weight unit */}
          <div style={rowStyle}>
            <IconBox icon={Scale} />
            <div style={{ flex: 1 }}>
              <div style={fieldLabelStyle}>{t('profile.weight_unit')}</div>
              <SegmentPicker
                options={[{ value: 'kg', label: 'KG' }, { value: 'lbs', label: 'LBS' }]}
                value={weightUnit}
                onChange={setWeightUnit}
              />
              <div style={{ fontSize: '0.72rem', color: 'var(--text3)', marginTop: 6 }}>
                {t('profile.weight_unit_note')}
              </div>
            </div>
          </div>

          <Divider />

          {/* Language */}
          <div style={rowStyle}>
            <IconBox icon={Globe} />
            <div style={{ flex: 1 }}>
              <div style={fieldLabelStyle}>{t('profile.language')}</div>
              <SegmentPicker
                options={[
                  { value: 'en', label: t('profile.language_en') },
                  { value: 'pt-BR', label: t('profile.language_pt_br') },
                ]}
                value={language}
                onChange={changeLanguage}
              />
            </div>
          </div>
        </GroupCard>
      </div>

      {/* ── BODY STATS ── */}
      <div style={anim(3)}>
        <SectionLabel>{t('profile.body_stats')}</SectionLabel>
        <GroupCard>
          {/* Sex */}
          <div style={rowStyle}>
            <IconBox icon={User} />
            <div style={{ flex: 1 }}>
              <div style={fieldLabelStyle}>{t('profile.biological_sex')}</div>
              <SegmentPicker
                options={[
                  { value: 'male', label: t('profile.sex_male') },
                  { value: 'female', label: t('profile.sex_female') },
                  { value: 'unspecified', label: t('profile.sex_other') },
                ]}
                value={sex}
                onChange={setSex}
              />
            </div>
          </div>

          <Divider />

          {/* Height */}
          <div style={{ ...rowStyle, alignItems: 'flex-start' }}>
            <IconBox icon={Ruler} />
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={fieldLabelStyle}>{t('profile.height')}</div>
                <SegmentPicker
                  compact
                  options={[
                    { value: 'cm', label: t('common.cm') },
                    { value: 'ft', label: t('profile.ft_in') },
                  ]}
                  value={heightUnit}
                  onChange={setHeightUnit}
                />
              </div>

              {heightUnit === 'cm' ? (
                <div style={{ position: 'relative' }}>
                  <input
                    type={isMobile ? 'text' : 'number'}
                    inputMode={isMobile ? 'none' : undefined}
                    readOnly={isMobile || undefined}
                    value={heightCm}
                    placeholder="170"
                    min={!isMobile ? 50 : undefined}
                    max={!isMobile ? 275 : undefined}
                    style={{ width: '100%', boxSizing: 'border-box', paddingRight: 48 }}
                    onChange={isMobile ? undefined : e => setHeightCm(e.target.value)}
                    onFocus={() => {
                      if (!isMobile) return
                      const hint = user?.heightCm ? `${Math.round(user.heightCm)} cm` : ''
                      keyboard.open({
                        label: hint ? `Height: ${hint}` : 'Height (cm)',
                        value: heightCm,
                        onChange: v => setHeightCm(v),
                        isLastField: true,
                        onDone: () => keyboard.close(),
                      })
                    }}
                  />
                  <span style={{
                    position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
                    color: 'var(--text3)', fontSize: '0.85rem', fontFamily: 'Barlow Condensed', fontWeight: 700,
                  }}>cm</span>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <input
                      type={isMobile ? 'text' : 'number'}
                      inputMode={isMobile ? 'none' : undefined}
                      readOnly={isMobile || undefined}
                      value={heightFt}
                      placeholder="5"
                      min={!isMobile ? 3 : undefined}
                      max={!isMobile ? 8 : undefined}
                      style={{ width: '100%', boxSizing: 'border-box', paddingRight: 36 }}
                      data-nk="height-ft"
                      onChange={isMobile ? undefined : e => setHeightFt(e.target.value)}
                      onFocus={() => {
                        if (!isMobile) return
                        const hint = user?.heightCm ? `${cmToFtIn(user.heightCm).feet} ft` : ''
                        keyboard.open({
                          label: hint ? `Height: ${hint}` : 'Height (ft)',
                          value: heightFt,
                          onChange: v => setHeightFt(v),
                          isLastField: false,
                          onNext: () => document.querySelector('[data-nk="height-in"]')?.focus(),
                        })
                      }}
                    />
                    <span style={{
                      position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                      color: 'var(--text3)', fontSize: '0.85rem', fontFamily: 'Barlow Condensed', fontWeight: 700,
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
                      style={{ width: '100%', boxSizing: 'border-box', paddingRight: 36 }}
                      data-nk="height-in"
                      onChange={isMobile ? undefined : e => setHeightIn(e.target.value)}
                      onFocus={() => {
                        if (!isMobile) return
                        const hint = user?.heightCm ? `${cmToFtIn(user.heightCm).inches} in` : ''
                        keyboard.open({
                          label: hint ? `Inches: ${hint}` : 'Inches',
                          value: heightIn,
                          onChange: v => setHeightIn(v),
                          isLastField: true,
                          onDone: () => keyboard.close(),
                        })
                      }}
                    />
                    <span style={{
                      position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                      color: 'var(--text3)', fontSize: '0.85rem', fontFamily: 'Barlow Condensed', fontWeight: 700,
                    }}>in</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* BMI */}
          {bmi !== null ? (
            <>
              <Divider />
              <div style={{ padding: '14px 20px' }}>
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '14px 16px', borderRadius: 10,
                  background: cls.bg, border: `1px solid ${cls.color}30`,
                }}>
                  <div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text3)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
                      {t('profile.your_bmi')}
                    </div>
                    <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 800, fontSize: '2.2rem', color: cls.color, lineHeight: 1 }}>
                      {bmi}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{
                      display: 'inline-block', padding: '5px 14px', borderRadius: 100,
                      background: cls.color, color: '#000',
                      fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: '0.85rem', letterSpacing: '0.05em',
                    }}>
                      {cls.label}
                    </div>
                    {cls.label !== 'Normal' && (
                      <div style={{ fontSize: '0.7rem', color: 'var(--text3)', marginTop: 5 }}>
                        {t('profile.bmi_normal_range')}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              <Divider />
              <div style={{ padding: '12px 20px 14px' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text3)', lineHeight: 1.5 }}>
                  {t('profile.enter_height_bmi')}
                </div>
              </div>
            </>
          )}

          <div style={{ padding: '0 20px 16px' }}>
            <button
              className="btn btn-primary"
              style={{ width: '100%', gap: 8 }}
              onClick={saveBodyStats}
              disabled={bodyStatsSaving}
            >
              {bodyStatsSaving
                ? <>{t('profile.saving')}</>
                : <><Check size={16} strokeWidth={2.5} /> {t('profile.save_body_stats')}</>
              }
            </button>
          </div>
        </GroupCard>
      </div>

      {/* ── GOALS ── */}
      <div style={anim(4)}>
        <SectionLabel>{t('profile.goals')}</SectionLabel>
        <GroupCard>
          {goals.map((g, i) => {
            const labelKey = GOAL_TYPE_KEYS[g.type]
            return (
              <div key={g.id}>
                {i > 0 && <Divider />}
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px' }}>
                  <IconBox icon={Target} color="var(--warning)" />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text3)', marginBottom: 2 }}>
                      {labelKey ? t(labelKey) : g.type}
                    </div>
                    <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: '1.15rem', color: 'var(--accent)', lineHeight: 1.1 }}>
                      {g.targetValue}&thinsp;{g.type === 'FREQUENCY' ? 'x / week' : weightUnit}
                    </div>
                  </div>
                  <button
                    onClick={() => deleteGoal(g.id)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--text3)', padding: 8, borderRadius: 8,
                      transition: 'color 0.12s',
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            )
          })}

          {goals.length > 0 && <Divider />}

          {/* Add new goal */}
          <div style={{ padding: '14px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 10 }}>
              <IconBox icon={Plus} color="var(--text3)" />
              <div style={fieldLabelStyle}>{t('profile.goals')}</div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <select
                value={newGoalType}
                onChange={e => setNewGoalType(e.target.value)}
                style={{ flex: 2 }}
              >
                {Object.entries(GOAL_TYPE_KEYS).map(([value, key]) => (
                  <option key={value} value={value}>{t(key)}</option>
                ))}
              </select>
              <input
                type={isMobile ? 'text' : 'number'}
                inputMode={isMobile ? 'none' : undefined}
                readOnly={isMobile || undefined}
                value={newGoalValue}
                placeholder={t('profile.goal_value_placeholder')}
                style={{ flex: 1, textAlign: 'center', fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: '1rem' }}
                min={!isMobile ? 0 : undefined}
                onChange={isMobile ? undefined : e => setNewGoalValue(e.target.value)}
                onFocus={() => {
                  if (!isMobile) return
                  const suffix = newGoalType === 'FREQUENCY' ? 'x/week' : weightUnit
                  keyboard.open({
                    label: `Goal: ${suffix}`,
                    value: newGoalValue,
                    onChange: v => setNewGoalValue(v),
                    isLastField: true,
                    onDone: () => keyboard.close(),
                  })
                }}
              />
              <button
                className="btn btn-primary"
                onClick={addGoal}
                disabled={!newGoalValue}
                style={{ padding: '10px 14px', flexShrink: 0 }}
              >
                <Plus size={18} />
              </button>
            </div>
          </div>
        </GroupCard>
      </div>

      {/* ── NOTIFICATIONS ── */}
      <div style={anim(5)}>
        <SectionLabel>Notifications</SectionLabel>
        <GroupCard>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '14px 20px' }}>
            <IconBox icon={Bell} color="var(--accent3)" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.92rem', color: 'var(--text)', fontWeight: 500, marginBottom: 2 }}>
                {t('profile.rest_timer_notif')}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text3)' }}>
                {notifPerm === 'granted'
                  ? t('profile.notif_enabled')
                  : notifPerm === 'denied'
                  ? t('profile.notif_blocked')
                  : t('profile.notif_tap_to_enable')}
              </div>
              {notifPerm !== 'granted' && (
                <div style={{ fontSize: '0.72rem', color: 'var(--text3)', marginTop: 5, lineHeight: 1.5 }}>
                  {t('profile.notif_ios_note')} <strong style={{ color: 'var(--text2)' }}>{t('profile.notif_ios_version')}</strong> {t('profile.notif_ios_suffix')}
                </div>
              )}
            </div>
            {notifPerm === 'granted' ? (
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--success)', marginTop: 5, flexShrink: 0 }} />
            ) : notifPerm === 'default' ? (
              <button className="btn btn-ghost" style={{ padding: '8px 14px', fontSize: '0.82rem', flexShrink: 0 }} onClick={requestNotif}>
                {t('profile.enable')}
              </button>
            ) : null}
          </div>
        </GroupCard>
      </div>

      {/* ── YOUR DATA ── */}
      <div style={anim(6)}>
        <SectionLabel>{t('profile.stored_data')}</SectionLabel>
        <GroupCard>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr' }}>
            {[
              { value: dbStats.sessions, label: t('profile.sessions_label') },
              { value: dbStats.sets,     label: t('profile.sets_label') },
              { value: dbStats.weights,  label: t('profile.weighins_label') },
            ].map(({ value, label }, i) => (
              <div key={label} style={{
                textAlign: 'center', padding: '20px 8px',
                borderRight: i < 2 ? '1px solid var(--border)' : 'none',
              }}>
                <div style={{
                  fontFamily: 'Barlow Condensed', fontWeight: 800,
                  fontSize: '2rem', color: 'var(--accent)', lineHeight: 1,
                }}>
                  {value}
                </div>
                <div style={{
                  fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.07em',
                  textTransform: 'uppercase', color: 'var(--text3)', marginTop: 5,
                }}>
                  {label}
                </div>
              </div>
            ))}
          </div>

          <div style={{ height: 1, background: 'var(--border)' }} />

          <div style={{ display: 'flex' }}>
            <button
              onClick={exportData}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: '14px 0', background: 'transparent', border: 'none', cursor: 'pointer',
                fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: '0.9rem',
                color: 'var(--text2)', letterSpacing: '0.04em', textTransform: 'uppercase',
                transition: 'background 0.12s',
              }}
            >
              <Download size={15} /> {t('profile.export')}
            </button>
            <div style={{ width: 1, background: 'var(--border)' }} />
            <button
              onClick={() => setConfirmClear(true)}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: '14px 0', background: 'transparent', border: 'none', cursor: 'pointer',
                fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: '0.9rem',
                color: 'var(--accent2)', letterSpacing: '0.04em', textTransform: 'uppercase',
                transition: 'background 0.12s',
              }}
            >
              <Trash2 size={15} /> {t('profile.clear_all')}
            </button>
          </div>
        </GroupCard>
      </div>

      {/* ── FITTRACK GPT ── */}
      <div id="gpt-instructions" style={anim(7)}>
        <SectionLabel>{t('profile.fittrack_gpt')}</SectionLabel>
        <GroupCard style={{ padding: 20 }}>
          <p style={{ fontSize: '0.82rem', color: 'var(--text3)', margin: '0 0 20px', lineHeight: 1.65 }}>
            {t('profile.fittrack_gpt_desc')}
          </p>

          {[
            { n: 1, label: t('profile.gpt_open'),      detail: t('profile.gpt_open_detail') },
            { n: 2, label: t('profile.gpt_signin'),     detail: t('profile.gpt_signin_detail') },
            { n: 3, label: t('profile.gpt_authorize'),  detail: t('profile.gpt_authorize_detail') },
            { n: 4, label: t('profile.gpt_answer'),     detail: t('profile.gpt_answer_detail') },
            { n: 5, label: t('profile.gpt_review'),     detail: t('profile.gpt_review_detail') },
            { n: 6, label: t('profile.gpt_saved'),      detail: t('profile.gpt_saved_detail') },
          ].map(({ n, label, detail }) => (
            <div key={n} style={{ display: 'flex', gap: 12, marginBottom: 14, alignItems: 'flex-start' }}>
              <div style={{
                flexShrink: 0, width: 24, height: 24, borderRadius: '50%',
                background: 'var(--accent)', color: '#0a0a0a',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'Barlow Condensed', fontWeight: 800, fontSize: '0.8rem',
              }}>
                {n}
              </div>
              <div>
                <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: '0.95rem', marginBottom: 2 }}>
                  {label}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text3)', lineHeight: 1.55 }}>
                  {detail}
                </div>
              </div>
            </div>
          ))}

          <a
            href="https://chatgpt.com/g/g-69cbfbc4f7948191bb3efca20b21871b-fittrack-planner"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              width: '100%', padding: '14px 0', borderRadius: 10, marginTop: 4,
              background: 'var(--accent)', color: '#0a0a0a',
              fontFamily: 'Barlow Condensed', fontWeight: 800, fontSize: '1rem',
              letterSpacing: '0.05em', textDecoration: 'none',
              transition: 'opacity 0.15s',
            }}
          >
            {t('profile.open_gpt_button')} <ExternalLink size={14} />
          </a>
        </GroupCard>
      </div>

      {/* ── Footer ── */}
      <div style={{ textAlign: 'center', padding: '28px 0 8px', color: 'var(--text3)', fontSize: '0.75rem', lineHeight: 1.9, ...anim(8) }}>
        {t('profile.signed_in_as')} <strong style={{ color: 'var(--text2)' }}>{user?.email}</strong><br />
        {t('profile.footer_note')}<br />
        <Link to="/privacy" style={{ color: 'var(--text3)', textDecoration: 'underline' }}>
          {t('profile.privacy_policy')}
        </Link>
        {' · '}4Brazucas, LLC
      </div>

      {/* ── Account actions ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '8px 0 40px', ...anim(8) }}>
        <button
          onClick={logout}
          style={{
            width: '100%', padding: '13px 0', borderRadius: 12,
            background: 'transparent',
            border: '1px solid var(--border)',
            color: 'var(--text2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: '0.95rem',
            letterSpacing: '0.04em', cursor: 'pointer',
            transition: 'border-color 0.15s, color 0.15s',
          }}
        >
          <LogOut size={16} />
          {t('profile.sign_out')}
        </button>

        <button
          onClick={() => setShowDeleteModal(true)}
          style={{
            width: '100%', padding: '12px 0', borderRadius: 12,
            background: 'transparent',
            border: '1px solid rgba(255,61,61,0.25)',
            color: 'rgba(255,100,100,0.75)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: '0.88rem',
            letterSpacing: '0.04em', cursor: 'pointer',
            transition: 'border-color 0.15s, color 0.15s',
          }}
        >
          <Trash2 size={14} />
          {t('profile.delete_account')}
        </button>
      </div>

      {showDeleteModal && (
        <DeleteAccountModal
          onClose={() => setShowDeleteModal(false)}
          onConfirm={handleDeleteAccount}
          deleting={deleteDeleting}
        />
      )}
    </div>
  )
}
