import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * @param {import('fastify').FastifyInstance} app
 */
export default async function workoutRoutes(app) {
  // All workout routes require authentication
  app.addHook('preHandler', app.authenticate)

  // ─── Workout Plans ────────────────────────────────────────────────────────

  // GET /api/workouts/plans
  app.get('/plans', async (req, reply) => {
    try {
      const plans = await prisma.workoutPlan.findMany({
        where: { userId: req.user.sub },
        include: { days: { include: { exercises: true }, orderBy: { order: 'asc' } } },
        orderBy: { createdAt: 'desc' },
      })
      return reply.send({ success: true, data: plans })
    } catch (e) {
      app.log.error(e)
      return reply.status(500).send({ success: false, error: 'Failed to fetch plans' })
    }
  })

  // POST /api/workouts/plans
  app.post('/plans', {
    schema: {
      body: {
        type: 'object',
        required: ['name'],
        properties: {
          name:        { type: 'string', minLength: 1 },
          description: { type: 'string' },
        },
        additionalProperties: false,
      },
    },
  }, async (req, reply) => {
    try {
      const plan = await prisma.workoutPlan.create({
        data: { ...req.body, userId: req.user.sub },
      })
      return reply.status(201).send({ success: true, data: plan })
    } catch (e) {
      app.log.error(e)
      return reply.status(500).send({ success: false, error: 'Failed to create plan' })
    }
  })

  // DELETE /api/workouts/plans/:id
  app.delete('/plans/:id', async (req, reply) => {
    try {
      const plan = await prisma.workoutPlan.findFirst({
        where: { id: req.params.id, userId: req.user.sub },
      })
      if (!plan) return reply.status(404).send({ success: false, error: 'Plan not found' })
      await prisma.workoutPlan.delete({ where: { id: req.params.id } })
      return reply.send({ success: true })
    } catch (e) {
      app.log.error(e)
      return reply.status(500).send({ success: false, error: 'Failed to delete plan' })
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
      return reply.status(500).send({ success: false, error: 'Failed to fetch sessions' })
    }
  })

  // POST /api/workouts/sessions
  app.post('/sessions', {
    schema: {
      body: {
        type: 'object',
        properties: {
          planId: { type: 'string' },
          notes:  { type: 'string' },
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
    try {
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
      return reply.status(500).send({ success: false, error: 'Failed to save session' })
    }
  })
}
