import { db } from './index.js'
import { api } from '../lib/api.js'

// ── Endpoint map ──────────────────────────────────────────────────────────────

const ENDPOINT_MAP = {
  sessions:    '/api/workouts/sessions',
  bodyWeights: '/api/progress/weight',
  goals:       '/api/progress/goals',
}

// ── Enqueue ───────────────────────────────────────────────────────────────────

/**
 * Add a record to the sync queue.
 * @param {'sessions'|'bodyWeights'|'goals'} table
 * @param {number} localId  The Dexie auto-increment ID of the local record
 * @param {object} payload  Snapshot of the POST body to send to the server
 */
export async function enqueue(table, localId, payload) {
  await db.syncQueue.add({
    table,
    localId,
    payload: JSON.stringify(payload),
    status: 'pending',
    createdAt: new Date().toISOString(),
    retryCount: 0,
    lastAttempt: null,
    error: null,
  })
}

// ── Process queue ─────────────────────────────────────────────────────────────

/**
 * Process all pending entries in the sync queue.
 * Already-syncing entries are skipped (guarded by status field).
 * Safe to call concurrently from multiple tabs — each entry is locked
 * by the status transition pending → syncing before the API call.
 */
export async function processQueue() {
  const pending = await db.syncQueue
    .where('status').equals('pending')
    .toArray()

  if (!pending.length) return { synced: 0, errors: 0 }

  let synced = 0
  let errors = 0

  for (const entry of pending) {
    const endpoint = ENDPOINT_MAP[entry.table]
    if (!endpoint) {
      await db.syncQueue.update(entry.id, { status: 'error', error: `Unknown table: ${entry.table}` })
      errors++
      continue
    }

    // Lock the entry so concurrent tabs don't double-process it
    const affected = await db.syncQueue
      .where({ id: entry.id, status: 'pending' })
      .modify({ status: 'syncing', lastAttempt: new Date().toISOString() })

    if (affected === 0) continue // Another tab grabbed it

    try {
      let payload
      try {
        payload = JSON.parse(entry.payload)
      } catch {
        throw new Error('Corrupted payload — cannot parse JSON')
      }

      await api.post(endpoint, payload)
      await db.syncQueue.update(entry.id, { status: 'done' })
      synced++
    } catch (err) {
      const retryCount = (entry.retryCount || 0) + 1
      const isAuthError = err.status === 401
      // After 5 retries or auth error, mark as permanent error
      const newStatus = (retryCount >= 5 || isAuthError) ? 'error' : 'pending'
      await db.syncQueue.update(entry.id, {
        status: newStatus,
        retryCount,
        error: err.message,
        lastAttempt: new Date().toISOString(),
      })
      errors++
    }
  }

  // Prune completed entries older than 48h to avoid table bloat
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
  await db.syncQueue
    .where('status').equals('done')
    .and(e => e.createdAt < cutoff)
    .delete()

  return { synced, errors }
}

// ── Stats ─────────────────────────────────────────────────────────────────────

export async function getQueueStats() {
  const all = await db.syncQueue
    .where('status').anyOf(['pending', 'syncing', 'error'])
    .toArray()

  return {
    pending:  all.filter(e => e.status === 'pending').length,
    syncing:  all.filter(e => e.status === 'syncing').length,
    errors:   all.filter(e => e.status === 'error').length,
    total:    all.length,
  }
}

/** Reset errored entries back to pending so they can be retried */
export async function retryErrors() {
  await db.syncQueue
    .where('status').equals('error')
    .modify(entry => {
      // Preserve retryCount so the 5-attempt guard remains in effect
      entry.status = 'pending'
      entry.error  = null
    })
}
