import { createContext, useContext, useState, useEffect } from 'react'
import { api } from '../lib/api.js'

const AuthContext = createContext(null)

/**
 * user === undefined  → loading (checking cookie)
 * user === null       → not authenticated
 * user === { id, email, name } → authenticated
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined)

  useEffect(() => {
    api.get('/api/auth/me')
      .then(res => setUser(res.data))
      .catch(() => setUser(null))
  }, [])

  /** @param {string} email @param {string} password */
  async function login(email, password) {
    const res = await api.post('/api/auth/login', { email, password })
    setUser(res.data)
    return res.data
  }

  /** @param {string} name @param {string} email @param {string} password */
  async function register(name, email, password) {
    const res = await api.post('/api/auth/register', { name, email, password })
    setUser(res.data)
    return res.data
  }

  async function logout() {
    await api.post('/api/auth/logout').catch(() => {})
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
