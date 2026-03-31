export const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

export function isOnline() {
  return navigator.onLine
}

/** Thrown when a request fails due to network unavailability (not a server error) */
export class NetworkError extends Error {
  constructor() {
    super('Network unavailable')
    this.name = 'NetworkError'
  }
}

// ── Refresh mutex ─────────────────────────────────────────────────────────────
// Ensures only one refresh attempt is in-flight at a time.
// All concurrent requests that hit 401 await the same promise.
let refreshPromise = null

async function attemptRefresh() {
  if (refreshPromise) return refreshPromise
  refreshPromise = fetch(BASE + '/api/auth/refresh', {
    method: 'POST',
    credentials: 'include',
  }).then(r => {
    if (!r.ok) throw new Error('refresh_failed')
    return r.json()
  }).finally(() => {
    refreshPromise = null
  })
  return refreshPromise
}

// ── Core request ──────────────────────────────────────────────────────────────

/**
 * @param {'GET'|'POST'|'PATCH'|'DELETE'} method
 * @param {string} path
 * @param {unknown} [body]
 * @param {boolean} [isRetry]  internal flag — prevents infinite retry loops
 */
async function request(method, path, body, isRetry = false) {
  let res
  try {
    res = await fetch(BASE + path, {
      method,
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
      credentials: 'include',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    // fetch() throws TypeError on network failure (offline, DNS, etc.)
    throw new NetworkError()
  }

  // Auto-refresh on 401, unless this is already a retry or the auth routes themselves
  const isAuthRoute = path.startsWith('/api/auth/')
  if (res.status === 401 && !isRetry && !isAuthRoute) {
    try {
      await attemptRefresh()
      // Retry original request once with the new access token cookie
      return request(method, path, body, true)
    } catch {
      // Refresh failed — throw the original 401 so AuthContext can log out
      const json = await res.json().catch(() => ({ error: 'Unauthorized' }))
      const err = new Error(json.error ?? 'Unauthorized')
      err.status = 401
      throw err
    }
  }

  const json = await res.json().catch(() => ({ error: res.statusText }))
  if (!res.ok) {
    const err = new Error(json.error ?? res.statusText)
    err.status = res.status
    throw err
  }
  return json
}

export const api = {
  get:    (path)        => request('GET',    path),
  post:   (path, body)  => request('POST',   path, body),
  patch:  (path, body)  => request('PATCH',  path, body),
  delete: (path)        => request('DELETE', path),
}

async function uploadRequest(path, formData, isRetry = false) {
  const res = await fetch(BASE + path, {
    method: 'POST',
    credentials: 'include',
    body: formData,
  })

  if (res.status === 401 && !isRetry) {
    try {
      await attemptRefresh()
      return uploadRequest(path, formData, true)
    } catch {
      const json = await res.json().catch(() => ({ error: 'Unauthorized' }))
      const err = new Error(json.error ?? 'Unauthorized')
      err.status = 401
      throw err
    }
  }

  const json = await res.json().catch(() => ({ error: res.statusText }))
  if (!res.ok) {
    const err = new Error(json.error ?? res.statusText)
    err.status = res.status
    throw err
  }
  return json
}

export function apiUpload(path, formData) {
  return uploadRequest(path, formData)
}
