import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const exercises = require('../exercises.json')

const BATCH_SIZE = 50

/**
 * Upserts all Planet Fitness exercises into PostgreSQL.
 * Idempotent: skips the entire run when the table is already populated.
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 */
export async function seedExercises(prisma) {
  const existing = await prisma.exercise.count()

  if (existing > 0) {
    console.log(`[seed-exercises] Skipping — ${existing} exercises already present.`)
    return
  }

  console.log(`[seed-exercises] Seeding ${exercises.length} exercises in batches of ${BATCH_SIZE}…`)

  let inserted = 0

  for (let i = 0; i < exercises.length; i += BATCH_SIZE) {
    const batch = exercises.slice(i, i + BATCH_SIZE).map((ex) => ({
      id: ex.id,
      name: ex.name,
      type: ex.type ?? 'TUTORIAL',
      experienceLevel: ex.experienceLevel,
      equipment: ex.equipment ?? [],
      focusArea: ex.focusArea ?? [],
      imageUrl: ex.imageUrl ?? '',
      mediaUrl: ex.mediaUrl ?? '',
      tips: ex.tips ?? [],
    }))

    const result = await prisma.exercise.createMany({
      data: batch,
      skipDuplicates: true,
    })

    inserted += result.count
    console.log(`[seed-exercises] ${inserted}/${exercises.length} inserted…`)
  }

  console.log(`[seed-exercises] Done — ${inserted} exercises seeded.`)
}
