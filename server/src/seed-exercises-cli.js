import { PrismaClient } from '@prisma/client'
import { seedExercises } from './seed-exercises.js'

const prisma = new PrismaClient()

try {
  await seedExercises(prisma)
} catch (err) {
  console.error('[seed-exercises] Fatal error:', err)
  process.exit(1)
} finally {
  await prisma.$disconnect()
}
