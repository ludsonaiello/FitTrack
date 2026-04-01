import { t, resolveLanguage } from '../i18n/index.js'

/**
 * @param {import('fastify').FastifyInstance} app
 */
export default async function workoutRoutes(app) {
  const prisma = app.prisma
  // All workout routes require authentication
  app.addHook('preHandler', app.authenticate)

  // ─── Workout Plans ────────────────────────────────────────────────────────

  // GET /api/workouts/plans
  app.get('/plans', async (req, reply) => {
    const lang = resolveLanguage(req)
    try {
      const plans = await prisma.workoutPlan.findMany({
        where: { userId: req.user.sub },
        include: { days: { include: { exercises: true }, orderBy: { order: 'asc' } } },
        orderBy: { createdAt: 'desc' },
      })
      return reply.send({ success: true, data: plans })
    } catch (e) {
      app.log.error(e)
      return reply.status(500).send({ success: false, error: t(lang, 'workouts.fetch_plans_failed') })
    }
  })

  // POST /api/workouts/plans
  app.post('/plans', {
    schema: {
      body: {
        type: 'object',
        required: ['name'],
        properties: {
          name:        { type: 'string', minLength: 1, maxLength: 200 },
          description: { type: 'string', maxLength: 1000 },
        },
        additionalProperties: false,
      },
    },
  }, async (req, reply) => {
    const lang = resolveLanguage(req)
    try {
      const plan = await prisma.workoutPlan.create({
        data: { ...req.body, userId: req.user.sub },
      })
      return reply.status(201).send({ success: true, data: plan })
    } catch (e) {
      app.log.error(e)
      return reply.status(500).send({ success: false, error: t(lang, 'workouts.create_plan_failed') })
    }
  })

  // PATCH /api/workouts/plans/:id
  app.patch('/plans/:id', {
    schema: {
      body: {
        type: 'object',
        properties: {
          name:     { type: 'string', minLength: 1, maxLength: 200 },
          isActive: { type: 'boolean' },
        },
        additionalProperties: false,
      },
    },
  }, async (req, reply) => {
    const { id } = req.params
    const userId = req.user.sub
    const lang = resolveLanguage(req)
    try {
      const existing = await prisma.workoutPlan.findFirst({ where: { id, userId } })
      if (!existing) return reply.status(404).send({ success: false, error: t(lang, 'workouts.plan_not_found') })

      if (req.body.isActive === true) {
        await prisma.workoutPlan.updateMany({
          where: { userId, NOT: { id } },
          data: { isActive: false },
        })
      }

      const updated = await prisma.workoutPlan.update({
        where: { id },
        data: {
          ...(req.body.name !== undefined     && { name: req.body.name }),
          ...(req.body.isActive !== undefined && { isActive: req.body.isActive }),
        },
        include: {
          days: { orderBy: { order: 'asc' }, include: { exercises: { orderBy: { order: 'asc' } } } },
        },
      })
      return reply.send({ success: true, data: updated })
    } catch (e) {
      app.log.error(e)
      return reply.status(500).send({ success: false, error: t(lang, 'workouts.update_plan_failed') })
    }
  })

  // DELETE /api/workouts/plans/:id
  app.delete('/plans/:id', async (req, reply) => {
    const lang = resolveLanguage(req)
    try {
      const deleted = await prisma.workoutPlan.deleteMany({
        where: { id: req.params.id, userId: req.user.sub },
      })
      if (deleted.count === 0) return reply.status(404).send({ success: false, error: t(lang, 'workouts.plan_not_found') })
      return reply.send({ success: true })
    } catch (e) {
      app.log.error(e)
      return reply.status(500).send({ success: false, error: t(lang, 'workouts.delete_plan_failed') })
    }
  })

  // ─── Workout Sessions ─────────────────────────────────────────────────────

  // GET /api/workouts/sessions
  app.get('/sessions', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          page:  { type: 'integer', minimum: 1, default: 1 },
        },
        additionalProperties: false,
      },
    },
  }, async (req, reply) => {
    const { page, limit } = req.query
    const lang = resolveLanguage(req)
    try {
      const [total, sessions] = await Promise.all([
        prisma.workoutSession.count({ where: { userId: req.user.sub } }),
        prisma.workoutSession.findMany({
          where: { userId: req.user.sub },
          include: { sets: true },
          orderBy: { startedAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
      ])
      return reply.send({ success: true, data: sessions, meta: { total, page, limit } })
    } catch (e) {
      app.log.error(e)
      return reply.status(500).send({ success: false, error: t(lang, 'workouts.fetch_sessions_failed') })
    }
  })

  // POST /api/workouts/sessions
  app.post('/sessions', {
    schema: {
      body: {
        type: 'object',
        properties: {
          planId: { type: 'string' },
          notes:  { type: 'string', maxLength: 2000 },
          sets: {
            type: 'array',
            items: {
              type: 'object',
              required: ['tutorialId', 'setNumber'],
              properties: {
                tutorialId:  { type: 'string' },
                setNumber:   { type: 'integer', minimum: 1 },
                reps:        { type: 'integer', minimum: 0 },
                weight:      { type: 'number', minimum: 0 },
                durationSec: { type: 'integer', minimum: 0 },
                restSec:     { type: 'integer', minimum: 0 },
                completed:   { type: 'boolean' },
              },
              additionalProperties: false,
            },
          },
          startedAt:   { type: 'string', format: 'date-time' },
          completedAt: { type: 'string', format: 'date-time' },
          durationSec: { type: 'integer', minimum: 0 },
        },
        additionalProperties: false,
      },
    },
  }, async (req, reply) => {
    const { sets = [], planId, notes, startedAt, completedAt, durationSec } = req.body
    const lang = resolveLanguage(req)
    try {
      if (planId) {
        const plan = await prisma.workoutPlan.findFirst({ where: { id: planId, userId: req.user.sub } })
        if (!plan) return reply.status(400).send({ success: false, error: t(lang, 'workouts.invalid_plan_id') })
      }

      const session = await prisma.workoutSession.create({
        data: {
          userId: req.user.sub,
          planId: planId ?? null,
          notes: notes ?? null,
          startedAt: startedAt ? new Date(startedAt) : undefined,
          completedAt: completedAt ? new Date(completedAt) : null,
          durationSec: durationSec ?? null,
          sets: { create: sets },
        },
        include: { sets: true },
      })
      return reply.status(201).send({ success: true, data: session })
    } catch (e) {
      app.log.error(e)
      return reply.status(500).send({ success: false, error: t(lang, 'workouts.save_session_failed') })
    }
  })
}
