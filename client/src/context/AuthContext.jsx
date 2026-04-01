import { createContext, useContext, useState, useEffect } from 'react'
import { api, NetworkError } from '../lib/api.js'
import i18n from '../i18n/index.js'

const AuthContext = createContext(null)
const USER_CACHE_KEY = 'ft_user_cache'

function getCachedUser() {
  try { return JSON.parse(localStorage.getItem(USER_CACHE_KEY)) } catch { return null }
}
function setCachedUser(user) {
  if (user) localStorage.setItem(USER_CACHE_KEY, JSON.stringify(user))
  else localStorage.removeItem(USER_CACHE_KEY)
}

/**
 * user === undefined  → loading (checking cookie)
 * user === null       → not authenticated
 * user === { id, email, name } → authenticated
 */
export function AuthProvider({ children }) {
  // Seed from cache immediately so PWA shows content without a flash
  const [user, setUser] = useState(() => getCachedUser())

  useEffect(() => {
    api.get('/api/auth/me')
      .then(res => {
        setUser(res.data)
        setCachedUser(res.data)
        if (res.data?.language) {
          i18n.changeLanguage(res.data.language)
          localStorage.setItem('ft_language', res.data.language)
        }
      })
      .catch(err => {
        if (err instanceof NetworkError) {
          // Offline — keep the cached user; they're still authenticated
          // If nothing was cached, set null to show the login screen
          if (!getCachedUser()) setUser(null)
          // else leave the cached user as-is
        } else {
          // Real auth failure (401, 403, etc.) — clear cache and force re-login
          setCachedUser(null)
          setUser(null)
        }
      })
  }, [])

  /** @param {string} email @param {string} password @param {boolean} rememberMe */
  async function login(email, password, rememberMe = false) {
    const res = await api.post('/api/auth/login', { email, password, rememberMe })
    setUser(res.data)
    setCachedUser(res.data)
    if (res.data?.language) {
      i18n.changeLanguage(res.data.language)
      localStorage.setItem('ft_language', res.data.language)
    }
    return res.data
  }

  /** @param {string} name @param {string} email @param {string} password */
  async function register(name, email, password) {
    const res = await api.post('/api/auth/register', { name, email, password })
    setUser(res.data)
    setCachedUser(res.data)
    if (res.data?.language) {
      i18n.changeLanguage(res.data.language)
      localStorage.setItem('ft_language', res.data.language)
    }
    return res.data
  }

  async function logout() {
    await api.post('/api/auth/logout').catch(() => {})
    setCachedUser(null)
    setUser(null)
  }

  /** Call after profile updates so cached user stays fresh */
  function refreshUser(updated) {
    setUser(updated)
    setCachedUser(updated)
  }

  return (
    <AuthContext.Provider value={{ user, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
