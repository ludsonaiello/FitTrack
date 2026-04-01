import { useState } from 'react'
import { Dumbbell } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext.jsx'

export default function Login() {
  const { login, register } = useAuth()
  const { t } = useTranslation()
  const [mode, setMode] = useState('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(true)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // No useNavigate needed — AppRoutes re-renders and redirects to / once user is set

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (mode === 'register' && !name.trim()) {
      setError(t('auth.name_required'))
      return
    }
    if (password.length < 8) {
      setError(t('auth.password_too_short'))
      return
    }

    setLoading(true)
    try {
      if (mode === 'login') {
        await login(email.trim().toLowerCase(), password, rememberMe)
      } else {
        await register(name.trim(), email.trim().toLowerCase(), password)
      }
      // Signal AppRoutes to show the loading screen before entering the app
      sessionStorage.setItem('ft_show_loader', '1')
      // AuthContext sets user → AppRoutes re-renders → Navigate to="/" fires automatically
    } catch (err) {
      setError(err.message ?? t('auth.generic_error'))
    } finally {
      setLoading(false)
    }
  }

  function switchMode(m) {
    setMode(m)
    setError('')
  }

  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 16px',
      background: 'var(--bg)',
    }}>
      {/* Logo */}
      <div style={{ marginBottom: 32, textAlign: 'center' }}>
        <div style={{
          width: 64, height: 64, borderRadius: 16,
          background: 'var(--accent)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 12px',
        }}>
          <Dumbbell size={32} color="#0a0a0a" />
        </div>
        <h1 style={{ margin: 0, lineHeight: 1 }}>
          Fit<span style={{ color: 'var(--accent)' }}>Track</span>
        </h1>
        <p style={{ margin: '4px 0 0', color: 'var(--text3)', fontSize: '0.85rem' }}>
          {t('auth.tagline')}
        </p>
      </div>

      {/* Tab switcher */}
      <div style={{
        display: 'flex',
        background: 'var(--surface2)',
        borderRadius: 10,
        padding: 3,
        marginBottom: 24,
        width: '100%',
        maxWidth: 360,
      }}>
        {[
          { key: 'login',    label: t('auth.sign_in') },
          { key: 'register', label: t('auth.create_account') },
        ].map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => switchMode(key)}
            style={{
              flex: 1,
              padding: '8px 0',
              borderRadius: 8,
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'Barlow Condensed',
              fontWeight: 700,
              fontSize: '1rem',
              letterSpacing: '0.05em',
              background: mode === key ? 'var(--surface)' : 'transparent',
              color:      mode === key ? 'var(--accent)'  : 'var(--text3)',
              transition: 'all 0.15s',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Form */}
      <form
        onSubmit={handleSubmit}
        style={{ width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 12 }}
      >
        {mode === 'register' && (
          <input
            type="text"
            placeholder={t('auth.name_placeholder')}
            value={name}
            onChange={e => setName(e.target.value)}
            autoComplete="name"
            disabled={loading}
          />
        )}
        <input
          type="email"
          placeholder={t('auth.email')}
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          autoComplete="email"
          disabled={loading}
        />
        <input
          type="password"
          placeholder={t('auth.password_placeholder')}
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          disabled={loading}
        />

        {mode === 'login' && (
          <label style={{
            display: 'flex', alignItems: 'center', gap: 10,
            cursor: 'pointer', userSelect: 'none',
            padding: '2px 0',
          }}>
            <div
              onClick={() => setRememberMe(v => !v)}
              style={{
                width: 20, height: 20, borderRadius: 5, flexShrink: 0,
                border: `2px solid ${rememberMe ? 'var(--accent)' : 'var(--border2)'}`,
                background: rememberMe ? 'var(--accent)' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.15s',
              }}
            >
              {rememberMe && (
                <svg width="11" height="9" viewBox="0 0 11 9" fill="none">
                  <path d="M1 4L4 7.5L10 1" stroke="#0a0a0a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </div>
            <span style={{ fontSize: '0.88rem', color: 'var(--text2)' }}>
              {t('auth.keep_signed_in')}
            </span>
          </label>
        )}

        {error && (
          <div style={{
            background: 'rgba(255,61,61,0.1)',
            border: '1px solid rgba(255,61,61,0.3)',
            color: 'var(--accent2)',
            padding: '10px 14px',
            borderRadius: 8,
            fontSize: '0.85rem',
          }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          className="btn btn-primary"
          disabled={loading}
          style={{ marginTop: 4 }}
        >
          {loading
            ? t('auth.loading')
            : mode === 'login' ? t('auth.sign_in') : t('auth.create_account')}
        </button>
      </form>

      <p style={{ marginTop: 24, color: 'var(--text3)', fontSize: '0.8rem', textAlign: 'center' }}>
        {t('auth.data_note').split('\n').map((line, i) => <span key={i}>{line}{i === 0 ? <br /> : null}</span>)}
      </p>
      <p style={{ marginTop: 12, color: 'var(--text3)', fontSize: '0.75rem', textAlign: 'center' }}>
        <Link to="/privacy" style={{ color: 'var(--text3)', textDecoration: 'underline' }}>{t('auth.privacy_policy')}</Link>
        {' · '}4Brazucas, LLC
      </p>
    </div>
  )
}
