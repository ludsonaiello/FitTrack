import { useState } from 'react'
import { Dumbbell } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'

export default function Login() {
  const { login, register } = useAuth()
  const [mode, setMode] = useState('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // No useNavigate needed — AppRoutes re-renders and redirects to / once user is set

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (mode === 'register' && !name.trim()) {
      setError('Name is required')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    setLoading(true)
    try {
      if (mode === 'login') {
        await login(email.trim().toLowerCase(), password)
      } else {
        await register(name.trim(), email.trim().toLowerCase(), password)
      }
      // AuthContext sets user → AppRoutes re-renders → Navigate to="/" fires automatically
    } catch (err) {
      setError(err.message ?? 'Something went wrong. Please try again.')
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
          Planet Fitness Edition
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
          { key: 'login',    label: 'Sign In' },
          { key: 'register', label: 'Create Account' },
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
            placeholder="Your name"
            value={name}
            onChange={e => setName(e.target.value)}
            autoComplete="name"
            disabled={loading}
          />
        )}
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          autoComplete="email"
          disabled={loading}
        />
        <input
          type="password"
          placeholder="Password (min 8 chars)"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          disabled={loading}
        />

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
            ? 'Please wait…'
            : mode === 'login' ? 'Sign In' : 'Create Account'}
        </button>
      </form>

      <p style={{ marginTop: 24, color: 'var(--text3)', fontSize: '0.8rem', textAlign: 'center' }}>
        Your data stays on-device first.<br />Syncs to server when online.
      </p>
    </div>
  )
}
