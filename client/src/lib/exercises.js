import exercises from './exercises.json'

export const EQUIPMENT_LABELS = {
  BATTLE_ROPE: 'Battle Rope',
  BODYWEIGHT: 'Bodyweight',
  BOSU_BALL: 'Bosu Ball',
  CABLE: 'Cable',
  DIP_BAR: 'Dip Bar',
  DUMBBELL: 'Dumbbell',
  KETTLEBELL: 'Kettlebell',
  MACHINE: 'Machine',
  MEDICINE_BALL: 'Medicine Ball',
  PULLUP_BAR: 'Pull-up Bar',
  RESISTANCE_BAND: 'Resistance Band',
  ROPE_PULL: 'Rope Pull',
  STABILITY_BALL: 'Stability Ball',
  STEP: 'Step',
  STEP_MILL: 'Step Mill',
  STEP_PLATFORM: 'Step Platform',
  STRENGTH_BAND: 'Strength Band',
  TRX: 'TRX',
}

export const FOCUS_LABELS = {
  ARMS: 'Arms',
  BACK: 'Back',
  CHEST: 'Chest',
  CORE: 'Core',
  FULL_BODY: 'Full Body',
  LEGS: 'Legs',
  SHOULDERS: 'Shoulders',
}

export const LEVEL_LABELS = {
  BEGINNER: 'Beginner',
  INTERMEDIATE: 'Intermediate',
  ADVANCED: 'Advanced',
}

export const LEVEL_COLORS = {
  BEGINNER: 'text-emerald-400 bg-emerald-400/10',
  INTERMEDIATE: 'text-amber-400 bg-amber-400/10',
  ADVANCED: 'text-rose-400 bg-rose-400/10',
}

export function filterExercises({ query = '', equipment = [], focus = [], level = [] }) {
  return exercises.filter(ex => {
    if (query) {
      const q = query.toLowerCase()
      if (!ex.name.toLowerCase().includes(q)) return false
    }
    if (equipment.length) {
      if (!ex.equipment.some(e => equipment.includes(e))) return false
    }
    if (focus.length) {
      if (!ex.focusArea.some(f => focus.includes(f))) return false
    }
    if (level.length) {
      if (!level.includes(ex.experienceLevel)) return false
    }
    return true
  })
}

export function getExerciseById(id) {
  return exercises.find(ex => ex.id === id) ?? null
}

/** Convert exercise id → local image path served from /public/images/ */
export function exImageUrl(id) {
  return `/images/${id.replace(/:/g, '_')}.jpg`
}

/** Convert exercise id → local video path served from /public/videos/ */
export function exVideoUrl(id) {
  return `/videos/${id.replace(/:/g, '_')}.mp4`
}

export function getExercisesByIds(ids) {
  const set = new Set(ids)
  return exercises.filter(ex => set.has(ex.id))
}

export { exercises as allExercises }
