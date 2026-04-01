import { db } from '../db/index.js'

/**
 * Badge rarity palette — colours only. Labels are handled via i18n: badges.rarity_<rarity>
 */
export const RARITY = {
  bronze:   { color: '#C87941', bg: 'rgba(200,121,65,0.18)'   },
  silver:   { color: '#9B9B9B', bg: 'rgba(155,155,155,0.18)'  },
  gold:     { color: '#F5C842', bg: 'rgba(245,200,66,0.18)'   },
  platinum: { color: '#85C1E9', bg: 'rgba(133,193,233,0.18)'  },
}

/**
 * Master badge catalogue.
 * name / desc are translated via t(`badges.${id}.name`) / t(`badges.${id}.desc`).
 */
export const BADGE_DEFS = [
  // ── Bronze ───────────────────────────────────────────────────────────────────
  { id: 'first_workout', icon: '🏋️', rarity: 'bronze'   },
  { id: 'streak_3',      icon: '🔥', rarity: 'bronze'   },
  { id: 'sessions_5',    icon: '✨', rarity: 'bronze'   },
  { id: 'early_bird',    icon: '🌅', rarity: 'bronze'   },
  { id: 'night_owl',     icon: '🌙', rarity: 'bronze'   },

  // ── Silver ───────────────────────────────────────────────────────────────────
  { id: 'sessions_10',   icon: '💫', rarity: 'silver'   },
  { id: 'sessions_25',   icon: '🎯', rarity: 'silver'   },
  { id: 'streak_7',      icon: '⚡', rarity: 'silver'   },
  { id: 'consistency',   icon: '📅', rarity: 'silver'   },
  { id: 'variety',       icon: '🔬', rarity: 'silver'   },
  { id: 'volume_5k',     icon: '⚖️', rarity: 'silver'   },

  // ── Gold ─────────────────────────────────────────────────────────────────────
  { id: 'sessions_50',   icon: '🚀', rarity: 'gold'     },
  { id: 'streak_14',     icon: '💪', rarity: 'gold'     },
  { id: 'long_session',  icon: '⏱️', rarity: 'gold'     },

  // ── Platinum ─────────────────────────────────────────────────────────────────
  { id: 'sessions_100',  icon: '👑', rarity: 'platinum' },
  { id: 'streak_30',     icon: '🏆', rarity: 'platinum' },
]

const RARITY_RANK = { platinum: 4, gold: 3, silver: 2, bronze: 1 }

/**
 * Queries IndexedDB and returns BADGE_DEFS with `earned: boolean` for each.
 */
export async function computeBadges() {
  const allSessions   = await db.sessions.toArray()
  const completed     = allSessions.filter(s => s.completedAt)
  const totalSessions = completed.length

  const allSets       = await db.exerciseSets.toArray()
  const completedSets = allSets.filter(s => s.completed)

  const totalVolume = completedSets.reduce(
    (sum, s) => sum + (s.weight || 0) * (s.reps || 0), 0,
  )

  const uniqueExercises = new Set(allSets.map(s => s.tutorialId)).size

  // Max consecutive streak (look back 365 days)
  const sessionDates = new Set(completed.map(s => s.completedAt.slice(0, 10)))
  let maxStreak = 0, run = 0
  const now = new Date()
  for (let i = 0; i < 365; i++) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
    if (sessionDates.has(key)) { run++; if (run > maxStreak) maxStreak = run }
    else run = 0
  }

  // Max workouts in any Sun–Sat week
  const weekCounts = {}
  for (const s of completed) {
    const d   = new Date(s.completedAt)
    const sun = new Date(d)
    sun.setDate(d.getDate() - d.getDay())
    const wk = sun.toISOString().slice(0, 10)
    weekCounts[wk] = (weekCounts[wk] || 0) + 1
  }
  const maxWeek = Object.values(weekCounts).reduce((a, b) => Math.max(a, b), 0)

  const hasEarlyBird   = completed.some(s => new Date(s.startedAt).getHours() < 7)
  const hasNightOwl    = completed.some(s => new Date(s.startedAt).getHours() >= 21)
  const hasLongSession = completed.some(s => (s.durationSec || 0) >= 3600)

  const earned = new Set()
  if (totalSessions >= 1)    earned.add('first_workout')
  if (totalSessions >= 5)    earned.add('sessions_5')
  if (totalSessions >= 10)   earned.add('sessions_10')
  if (totalSessions >= 25)   earned.add('sessions_25')
  if (totalSessions >= 50)   earned.add('sessions_50')
  if (totalSessions >= 100)  earned.add('sessions_100')
  if (maxStreak >= 3)        earned.add('streak_3')
  if (maxStreak >= 7)        earned.add('streak_7')
  if (maxStreak >= 14)       earned.add('streak_14')
  if (maxStreak >= 30)       earned.add('streak_30')
  if (maxWeek >= 4)          earned.add('consistency')
  if (totalVolume >= 5000)   earned.add('volume_5k')
  if (uniqueExercises >= 10) earned.add('variety')
  if (hasEarlyBird)          earned.add('early_bird')
  if (hasNightOwl)           earned.add('night_owl')
  if (hasLongSession)        earned.add('long_session')

  return BADGE_DEFS.map(b => ({ ...b, earned: earned.has(b.id) }))
}

/**
 * Compares freshly computed badges against localStorage-persisted seen set.
 * Returns the highest-rarity badge the user hasn't been notified about yet,
 * and immediately marks all newly earned badges as seen.
 * Returns null if there are no new badges to announce.
 */
export function detectNewBadge(badges) {
  const seenRaw = localStorage.getItem('ft_seen_badges') || ''
  const seen    = new Set(seenRaw ? seenRaw.split(',') : [])

  const justEarned = badges.filter(b => b.earned && !seen.has(b.id))
  if (justEarned.length === 0) return null

  // Persist seen state immediately so re-renders don't re-trigger
  justEarned.forEach(b => seen.add(b.id))
  localStorage.setItem('ft_seen_badges', [...seen].join(','))

  // Surface the highest-rarity badge
  return [...justEarned].sort((a, b) => RARITY_RANK[b.rarity] - RARITY_RANK[a.rarity])[0]
}
