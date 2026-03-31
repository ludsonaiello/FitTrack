import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Dumbbell, Lock } from 'lucide-react'
import { BASE } from '../lib/api.js'

export default function OAuthLogin() {
  const [params] = useSearchParams()
  const clientId   = params.get('client_id')   ?? ''
  const redirectUri = params.get('redirect_uri') ?? ''
  const state      = params.get('state')       ?? ''

  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch(`${BASE}/oauth/authorize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, client_id: clientId, redirect_uri: redirectUri, state }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        setError(json.error_description ?? json.error ?? 'Invalid email or password')
        return
      }
      window.location.href = json.redirectUrl
    } catch {
      setError('Connection error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100dvh', background: 'var(--bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px 16px',
    }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center', marginBottom: 32 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Dumbbell size={24} color="#000" />
          </div>
          <span style={{ fontFamily: 'Barlow Condensed', fontWeight: 800, fontSize: '1.6rem', color: 'var(--text)', letterSpacing: '0.02em' }}>
            FitTrack
          </span>
        </div>

        <div className="card" style={{ padding: '28px 24px' }}>
          <h2 style={{ fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: '1.3rem', margin: '0 0 6px', textAlign: 'center' }}>
            Authorize ChatGPT
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text3)', textAlign: 'center', margin: '0 0 24px', lineHeight: 1.5 }}>
            ChatGPT is requesting access to your FitTrack account
          </p>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                Email
              </label>
              <input
                type="email"
                className="input"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoComplete="email"
                style={{ width: '100%' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                Password
              </label>
              <input
                type="password"
                className="input"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                style={{ width: '100%' }}
              />
            </div>

            {error && (
              <div style={{ background: 'rgba(255,80,80,0.1)', border: '1px solid rgba(255,80,80,0.3)', borderRadius: 8, padding: '10px 14px', fontSize: '0.85rem', color: '#ff6b6b' }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{ marginTop: 4 }}
            >
              {loading ? 'Signing in…' : 'Sign in & Authorize'}
            </button>
          </form>

          {/* Security notice */}
          <div style={{
            marginTop: 20, padding: '12px 14px', borderRadius: 8,
            background: 'rgba(232,255,0,0.05)', border: '1px solid rgba(232,255,0,0.15)',
            display: 'flex', gap: 10, alignItems: 'flex-start',
          }}>
            <Lock size={14} color="var(--accent)" style={{ flexShrink: 0, marginTop: 1 }} />
            <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text3)', lineHeight: 1.5 }}>
              This will give ChatGPT access to your FitTrack exercise library and allow it to create workout plans on your behalf.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
