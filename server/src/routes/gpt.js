import { apiKeyAuth } from '../middleware/api-key-auth.js'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default async function gptRoutes(app) {
  // ── OpenAPI spec (public — needed for GPT builder import) ─────────────────
  app.get('/openapi.yaml', async (req, reply) => {
    const spec = readFileSync(join(__dirname, '../openapi/gpt-spec.yaml'), 'utf8')
    reply.header('Content-Type', 'text/yaml')
    return reply.send(spec)
  })

  // All routes below require API key auth
  const auth = { preHandler: [apiKeyAuth] }

  // ── GET /api/gpt/profile ──────────────────────────────────────────────────
  app.get('/profile', auth, async (req) => {
    const userId = req.user.id

    const [user, bodyWeights, goals] = await Promise.all([
      app.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, name: true, createdAt: true },
      }),
      app.prisma.bodyWeight.findMany({
        where: { userId },
        orderBy: { loggedAt: 'desc' },
        take: 10,
        select: { weight: true, unit: true, loggedAt: true },
      }),
      app.prisma.goal.findMany({
        where: { userId },
        select: { type: true, tutorialId: true, targetValue: true, achieved: true, targetDate: true, createdAt: true },
      }),
    ])

    return {
      success: true,
      data: {
        user,
        latestWeight: bodyWeights[0] ?? null,
        recentWeights: bodyWeights,
        goals,
      },
    }
  })

  // ── GET /api/gpt/exercises ────────────────────────────────────────────────
  app.get('/exercises', {
    ...auth,
    schema: {
      querystring: {
        type: 'object',
        properties: {
          q:         { type: 'string', maxLength: 200 },
          equipment: { type: 'string', maxLength: 100 },
          focus:     { type: 'string', maxLength: 100 },
          level:     { type: 'string', enum: ['beginner', 'intermediate', 'advanced'] },
          page:      { type: 'integer', minimum: 1, default: 1 },
          limit:     { type: 'integer', minimum: 1, maximum: 200, default: 100 },
        },
        additionalProperties: false,
      },
    },
  }, async (req) => {
    const { q, equipment, focus, level, page = 1, limit = 100 } = req.query

    const where = {}
    if (q) where.name = { contains: q, mode: 'insensitive' }
    if (equipment) where.equipment = { has: equipment }
    if (focus) where.focusArea = { has: focus }
    if (level) where.experienceLevel = level

    const skip = (page - 1) * limit
    const take = Math.min(Number(limit), 200)

    const [total, data] = await Promise.all([
      app.prisma.exercise.count({ where }),
      app.prisma.exercise.findMany({
        where,
        skip,
        take,
        select: {
          id: true, name: true, type: true,
          experienceLevel: true, equipment: true, focusArea: true,
          imageUrl: true, mediaUrl: true, tips: true,
        },
        orderBy: { name: 'asc' },
      }),
    ])

    return { success: true, data, meta: { total, page: Number(page), limit: take } }
  })

  // ── GET /api/gpt/plans ────────────────────────────────────────────────────
  app.get('/plans', auth, async (req) => {
    const plans = await app.prisma.workoutPlan.findMany({
      where: { userId: req.user.id },
      include: {
        days: {
          orderBy: { order: 'asc' },
          include: { exercises: { orderBy: { order: 'asc' } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    })
    return { success: true, data: plans }
  })

  // ── POST /api/gpt/plans ───────────────────────────────────────────────────
  // Full nested plan creation: plan + days + exercises in one request
  app.post('/plans', auth, async (req, reply) => {
    const { name, description, days } = req.body || {}

    if (!name || typeof name !== 'string' || !name.trim()) {
      return reply.status(400).send({ success: false, error: 'name is required' })
    }

    if (!Array.isArray(days) || days.length === 0) {
      return reply.status(400).send({ success: false, error: 'days array is required and must not be empty' })
    }

    // Validate days
    for (const day of days) {
      if (typeof day.dayOfWeek !== 'number' || day.dayOfWeek < 0 || day.dayOfWeek > 6) {
        return reply.status(400).send({ success: false, error: `Invalid dayOfWeek: ${day.dayOfWeek}. Must be 0 (Sun) to 6 (Sat).` })
      }
      if (!Array.isArray(day.exercises) || day.exercises.length === 0) {
        return reply.status(400).send({ success: false, error: `Day ${day.dayOfWeek} must have at least one exercise` })
      }
    }

    // Collect all tutorialIds and validate they exist in the DB
    const allTutorialIds = [...new Set(days.flatMap(d => d.exercises.map(e => e.tutorialId)))]
    const foundExercises = await app.prisma.exercise.findMany({
      where: { id: { in: allTutorialIds } },
      select: { id: true },
    })
    const foundIds = new Set(foundExercises.map(e => e.id))
    const missing = allTutorialIds.filter(id => !foundIds.has(id))
    if (missing.length > 0) {
      return reply.status(400).send({ success: false, error: `Unknown exercise IDs: ${missing.join(', ')}` })
    }

    // Create plan with nested days and exercises in a transaction
    const plan = await app.prisma.$transaction(async (tx) => {
      // Deactivate any existing active plan
      await tx.workoutPlan.updateMany({
        where: { userId: req.user.id, isActive: true },
        data: { isActive: false },
      })

      return tx.workoutPlan.create({
        data: {
          userId: req.user.id,
          name: name.trim(),
          description: description?.trim() ?? null,
          isActive: true,
          days: {
            create: days.map((day, dayIdx) => ({
              dayOfWeek: day.dayOfWeek,
              name: day.name || `Day ${day.dayOfWeek}`,
              order: dayIdx,
              exercises: {
                create: day.exercises.map((ex, exIdx) => ({
                  tutorialId: ex.tutorialId,
                  targetSets: ex.targetSets ?? 3,
                  targetReps: ex.targetReps ?? 10,
                  targetWeight: ex.targetWeight ?? null,
                  restSeconds: ex.restSeconds ?? 60,
                  notes: ex.notes ?? null,
                  order: exIdx,
                })),
              },
            })),
          },
        },
        include: {
          days: {
            orderBy: { order: 'asc' },
            include: { exercises: { orderBy: { order: 'asc' } } },
          },
        },
      })
    })

    return reply.status(201).send({ success: true, data: plan })
  })
}
