import Dexie from 'dexie'

export const db = new Dexie('FitTrackDB')

db.version(1).stores({
  plans:         '++id, name, isActive, createdAt',
  planDays:      '++id, planId, dayOfWeek, name',
  planExercises: '++id, dayId, tutorialId, order',
  sessions:      '++id, planId, startedAt, completedAt, synced',
  exerciseSets:  '++id, sessionId, tutorialId, setNumber, loggedAt',
  bodyWeights:   '++id, loggedAt',
  goals:         '++id, type, tutorialId, achieved, createdAt',
  syncQueue:     '++id, type, payload, createdAt',
})

// v2: refine syncQueue schema + add status index on goals for uppercase enum migration
db.version(2).stores({
  // syncQueue gets a richer schema: table, localId, status are indexed
  syncQueue: '++id, table, localId, status, createdAt',
}).upgrade(async tx => {
  // Migrate existing syncQueue entries (if any) to new shape — just clear them
  // since the old format is incompatible and there's no data worth preserving
  await tx.table('syncQueue').clear()

  // Migrate Goal.type from lowercase to uppercase to match server enum
  await tx.table('goals').toCollection().modify(goal => {
    if (goal.type === 'weight')      goal.type = 'WEIGHT'
    else if (goal.type === 'frequency')   goal.type = 'FREQUENCY'
    else if (goal.type === 'exercise_pr') goal.type = 'EXERCISE_PR'
  })
})

// ── Plan helpers ──────────────────────────────────────────────────────────────

export async function getActivePlan() {
  return db.plans.where('isActive').equals(1).first()
}

export async function getPlanWithDays(planId) {
  const plan = await db.plans.get(planId)
  if (!plan) return null
  const days = await db.planDays.where('planId').equals(planId).sortBy('dayOfWeek')
  for (const day of days) {
    day.exercises = await db.planExercises.where('dayId').equals(day.id).sortBy('order')
  }
  plan.days = days
  return plan
}

export async function createPlan(name, description = '') {
  // deactivate all first
  await db.plans.toCollection().modify({ isActive: 0 })
  return db.plans.add({ name, description, isActive: 1, createdAt: new Date().toISOString() })
}

export async function addExerciseToDay(dayId, tutorialId, opts = {}) {
  const count = await db.planExercises.where('dayId').equals(dayId).count()
  return db.planExercises.add({
    dayId,
    tutorialId,
    targetSets: opts.targetSets ?? 3,
    targetReps: opts.targetReps ?? 10,
    targetWeight: opts.targetWeight ?? null,
    restSeconds: opts.restSeconds ?? 60,
    order: count,
    notes: opts.notes ?? '',
  })
}

// ── Session helpers ───────────────────────────────────────────────────────────

export async function startSession(planId = null, dayId = null) {
  return db.sessions.add({
    planId,
    dayId,
    startedAt: new Date().toISOString(),
    completedAt: null,
    durationSec: null,
    notes: '',
    synced: 0,
  })
}

export async function logSet(sessionId, tutorialId, setData) {
  return db.exerciseSets.add({
    sessionId,
    tutorialId,
    setNumber: setData.setNumber,
    reps: setData.reps ?? null,
    weight: setData.weight ?? null,
    durationSec: setData.durationSec ?? null,
    restSec: setData.restSec ?? null,
    completed: setData.completed ?? true,
    loggedAt: new Date().toISOString(),
  })
}

export async function completeSession(sessionId) {
  const session = await db.sessions.get(sessionId)
  if (!session) return
  const startMs = new Date(session.startedAt).getTime()
  const durationSec = Math.round((Date.now() - startMs) / 1000)
  await db.sessions.update(sessionId, {
    completedAt: new Date().toISOString(),
    durationSec,
  })
  return durationSec
}

export async function getSessionWithSets(sessionId) {
  const sid = Number(sessionId)
  const session = await db.sessions.get(sid)
  if (!session) return null
  // Support both string and number sessionId stored in exerciseSets (legacy vs current)
  const byNum = await db.exerciseSets.where('sessionId').equals(sid).sortBy('loggedAt')
  const byStr = await db.exerciseSets.where('sessionId').equals(String(sid)).sortBy('loggedAt')
  const seen = new Set()
  const sets = [...byNum, ...byStr].filter(s => {
    if (seen.has(s.id)) return false
    seen.add(s.id)
    return true
  }).sort((a, b) => a.loggedAt.localeCompare(b.loggedAt))
  session.sets = sets
  return session
}

export async function getRecentSessions(limit = 20) {
  return db.sessions.orderBy('startedAt').reverse().limit(limit).toArray()
}

/**
 * Returns all completed sessions with precomputed volume (kg).
 * Sorted newest → oldest.
 */
export async function getAllSessionsWithVolume() {
  const sessions = await db.sessions
    .orderBy('startedAt').reverse()
    .filter(s => !!s.completedAt)
    .toArray()

  if (!sessions.length) return []

  const allSets = await db.exerciseSets.toArray()

  // Build volume map: sessionId (as string or number) → total volume kg
  const volMap = {}
  const setsMap = {}  // sessionId → sets[]
  for (const s of allSets) {
    const key = Number(s.sessionId)
    if (!setsMap[key]) setsMap[key] = []
    setsMap[key].push(s)
    if (s.completed && s.weight && s.reps) {
      volMap[key] = (volMap[key] || 0) + s.weight * s.reps
    }
  }

  return sessions.map(s => ({
    ...s,
    totalVolKg: Math.round(volMap[s.id] || 0),
    sets: setsMap[s.id] || [],
  }))
}

/**
 * Returns sets from the most recent *completed* session that contained
 * this exercise, sorted by setNumber ascending.
 * Returns [] if no prior history.
 */
export async function getLastSetsForExercise(tutorialId) {
  const allSets = await db.exerciseSets.where('tutorialId').equals(tutorialId).toArray()
  if (!allSets.length) return []

  // group by sessionId
  const bySession = {}
  for (const s of allSets) {
    if (!bySession[s.sessionId]) bySession[s.sessionId] = []
    bySession[s.sessionId].push(s)
  }

  const sessionIds = Object.keys(bySession).map(Number)
  const sessions = await db.sessions.where('id').anyOf(sessionIds).toArray()
  const completed = sessions.filter(s => s.completedAt)
  if (!completed.length) return []

  completed.sort((a, b) => b.startedAt.localeCompare(a.startedAt))
  const latestId = completed[0].id
  // bySession keys are strings (from Object.keys); coerce latestId to string for lookup
  return (bySession[String(latestId)] || []).sort((a, b) => a.setNumber - b.setNumber)
}

// ── Progress helpers ──────────────────────────────────────────────────────────

export async function logBodyWeight(weight, unit = 'kg') {
  return db.bodyWeights.add({ weight, unit, loggedAt: new Date().toISOString() })
}

export async function getBodyWeightHistory(days = 90) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
  return db.bodyWeights.where('loggedAt').above(since).sortBy('loggedAt')
}

export async function getExercisePR(tutorialId) {
  const sets = await db.exerciseSets.where('tutorialId').equals(tutorialId).toArray()
  if (!sets.length) return null
  return sets.reduce((best, s) => {
    const vol = (s.weight ?? 0) * (s.reps ?? 1)
    return vol > (best.weight ?? 0) * (best.reps ?? 1) ? s : best
  }, sets[0])
}

export async function getWorkoutFrequency(days = 30) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
  const sessions = await db.sessions
    .where('startedAt').above(since)
    .filter(s => s.completedAt != null)
    .toArray()
  const counts = {}
  sessions.forEach(s => {
    const day = s.startedAt.slice(0, 10)
    counts[day] = (counts[day] ?? 0) + 1
  })
  return counts
}

// ── Exercise history (for per-exercise progress charts) ───────────────────────

/**
 * Returns per-session history for one exercise, sorted oldest→newest.
 * Each entry: { date, label, maxWeight, totalVol, totalReps, setCount }
 */
export async function getExerciseHistory(tutorialId, limit = 30) {
  const allSets = await db.exerciseSets.where('tutorialId').equals(tutorialId).toArray()
  if (!allSets.length) return []

  // Group sets by sessionId
  const bySession = {}
  allSets.forEach(s => {
    if (!bySession[s.sessionId]) bySession[s.sessionId] = []
    bySession[s.sessionId].push(s)
  })

  const history = []
  for (const [sessionId, sets] of Object.entries(bySession)) {
    const session = await db.sessions.get(Number(sessionId))
    if (!session?.completedAt) continue
    const maxWeight = Math.max(...sets.map(s => s.weight || 0))
    const totalVol = sets.reduce((a, s) => a + (s.weight || 0) * (s.reps || 0), 0)
    const totalReps = sets.reduce((a, s) => a + (s.reps || 0), 0)
    history.push({
      date: session.startedAt,
      label: session.startedAt.slice(5, 10),
      maxWeight,
      totalVol: Math.round(totalVol),
      totalReps,
      setCount: sets.length,
    })
  }

  return history
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(-limit)
}

/** Returns all {plan, day} pairs that include this exercise */
export async function getExercisePlans(tutorialId) {
  const planExs = await db.planExercises.where('tutorialId').equals(tutorialId).toArray()
  const results = []
  for (const pe of planExs) {
    const day = await db.planDays.get(pe.dayId)
    if (!day) continue
    const plan = await db.plans.get(day.planId)
    if (!plan) continue
    results.push({ plan, day, planExercise: pe })
  }
  return results
}

/** Returns per-session exercise history with individual sets */
export async function getExerciseSessionHistory(tutorialId, limit = 50) {
  const allSets = await db.exerciseSets.where('tutorialId').equals(tutorialId).toArray()
  if (!allSets.length) return []

  const bySession = {}
  for (const s of allSets) {
    const key = String(s.sessionId)
    if (!bySession[key]) bySession[key] = []
    bySession[key].push(s)
  }

  const sessions = []
  for (const [sessionId, sets] of Object.entries(bySession)) {
    const session = await db.sessions.get(Number(sessionId))
    if (!session?.completedAt) continue
    const completedSets = sets.filter(s => s.completed).sort((a, b) => a.setNumber - b.setNumber)
    if (!completedSets.length) continue
    sessions.push({ session, sets: completedSets })
  }

  return sessions
    .sort((a, b) => b.session.startedAt.localeCompare(a.session.startedAt))
    .slice(0, limit)
}

export async function deleteSession(sessionId) {
  await db.exerciseSets.where('sessionId').equals(sessionId).delete()
  await db.sessions.delete(sessionId)
}

// ── Session comparison (for post-workout summary) ─────────────────────────────

/**
 * Compares current session's sets against the most recent previous session
 * that used the same exercises.
 * Returns array of per-exercise comparison objects.
 */
export async function compareWithLastSession(currentSessionId) {
  const sid = Number(currentSessionId)
  const byNum = await db.exerciseSets.where('sessionId').equals(sid).toArray()
  const byStr = await db.exerciseSets.where('sessionId').equals(String(sid)).toArray()
  const seen = new Set()
  const currentSets = [...byNum, ...byStr].filter(s => {
    if (seen.has(s.id)) return false
    seen.add(s.id)
    return true
  })
  if (!currentSets.length) return []

  const tutorialIds = [...new Set(currentSets.map(s => s.tutorialId))]

  // Find previous completed sessions (up to 30 look-back)
  const prevSessions = await db.sessions
    .orderBy('startedAt').reverse()
    .filter(s => s.completedAt != null && s.id !== Number(currentSessionId))
    .limit(30)
    .toArray()

  const results = []
  for (const tutId of tutorialIds) {
    const curSets = currentSets.filter(s => s.tutorialId === tutId)
    const curMaxWeight = Math.max(...curSets.map(s => s.weight || 0))
    const curVol = curSets.reduce((a, s) => a + (s.weight || 0) * (s.reps || 0), 0)
    const curTotalReps = curSets.reduce((a, s) => a + (s.reps || 0), 0)

    for (const prev of prevSessions) {
      const prevSets = await db.exerciseSets
        .where('sessionId').equals(prev.id)
        .filter(s => s.tutorialId === tutId)
        .toArray()
      if (!prevSets.length) continue

      const prevMaxWeight = Math.max(...prevSets.map(s => s.weight || 0))
      const prevVol = prevSets.reduce((a, s) => a + (s.weight || 0) * (s.reps || 0), 0)
      const prevTotalReps = prevSets.reduce((a, s) => a + (s.reps || 0), 0)

      results.push({
        tutorialId: tutId,
        curMaxWeight, prevMaxWeight, weightDiff: curMaxWeight - prevMaxWeight,
        curVol: Math.round(curVol), prevVol: Math.round(prevVol), volDiff: Math.round(curVol - prevVol),
        curTotalReps, prevTotalReps, repsDiff: curTotalReps - prevTotalReps,
        isWeightPR: curMaxWeight > prevMaxWeight,
        isVolPR: curVol > prevVol,
      })
      break // only compare against most recent prior session
    }
  }
  return results
}
