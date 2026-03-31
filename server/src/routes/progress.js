import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * @param {import('fastify').FastifyInstance} app
 */
export default async function progressRoutes(app) {
  // All progress routes require authentication
  app.addHook('preHandler', app.authenticate)

  // ─── Body Weight ──────────────────────────────────────────────────────────

  // GET /api/progress/weight
  app.get('/weight', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'integer', minimum: 1, maximum: 365, default: 90 },
        },
        additionalProperties: false,
      },
    },
  }, async (req, reply) => {
    try {
      const entries = await prisma.bodyWeight.findMany({
        where: { userId: req.user.sub },
        orderBy: { loggedAt: 'desc' },
        take: req.query.limit,
      })
      return reply.send({ success: true, data: entries })
    } catch (e) {
      app.log.error(e)
      return reply.status(500).send({ success: false, error: 'Failed to fetch weight entries' })
    }
  })

  // POST /api/progress/weight
  app.post('/weight', {
    schema: {
      body: {
        type: 'object',
        required: ['weight'],
        properties: {
          weight:   { type: 'number', minimum: 0 },
          unit:     { type: 'string', enum: ['kg', 'lbs'], default: 'kg' },
          loggedAt: { type: 'string', format: 'date-time' },
        },
        additionalProperties: false,
      },
    },
  }, async (req, reply) => {
    const { weight, unit = 'kg', loggedAt } = req.body
    try {
      const entry = await prisma.bodyWeight.create({
        data: {
          userId: req.user.sub,
          weight,
          unit,
          loggedAt: loggedAt ? new Date(loggedAt) : undefined,
        },
      })
      return reply.status(201).send({ success: true, data: entry })
    } catch (e) {
      app.log.error(e)
      return reply.status(500).send({ success: false, error: 'Failed to log weight' })
    }
  })

  // DELETE /api/progress/weight/:id
  app.delete('/weight/:id', async (req, reply) => {
    try {
      const entry = await prisma.bodyWeight.findFirst({
        where: { id: req.params.id, userId: req.user.sub },
      })
      if (!entry) return reply.status(404).send({ success: false, error: 'Entry not found' })
      await prisma.bodyWeight.delete({ where: { id: req.params.id } })
      return reply.send({ success: true })
    } catch (e) {
      app.log.error(e)
      return reply.status(500).send({ success: false, error: 'Failed to delete entry' })
    }
  })

  // ─── Goals ────────────────────────────────────────────────────────────────

  // GET /api/progress/goals
  app.get('/goals', async (req, reply) => {
    try {
      const goals = await prisma.goal.findMany({
        where: { userId: req.user.sub },
        orderBy: { createdAt: 'desc' },
      })
      return reply.send({ success: true, data: goals })
    } catch (e) {
      app.log.error(e)
      return reply.status(500).send({ success: false, error: 'Failed to fetch goals' })
    }
  })

  // POST /api/progress/goals
  app.post('/goals', {
    schema: {
      body: {
        type: 'object',
        required: ['type', 'targetValue'],
        properties: {
          type:        { type: 'string', enum: ['weight', 'frequency', 'exercise_pr'] },
          tutorialId:  { type: 'string' },
          targetValue: { type: 'number' },
          targetDate:  { type: 'string', format: 'date-time' },
        },
        additionalProperties: false,
      },
    },
  }, async (req, reply) => {
    const { type, tutorialId, targetValue, targetDate } = req.body
    try {
      const goal = await prisma.goal.create({
        data: {
          userId: req.user.sub,
          type,
          tutorialId: tutorialId ?? null,
          targetValue,
          targetDate: targetDate ? new Date(targetDate) : null,
        },
      })
      return reply.status(201).send({ success: true, data: goal })
    } catch (e) {
      app.log.error(e)
      return reply.status(500).send({ success: false, error: 'Failed to create goal' })
    }
  })

  // PATCH /api/progress/goals/:id
  app.patch('/goals/:id', {
    schema: {
      body: {
        type: 'object',
        properties: {
          achieved:    { type: 'boolean' },
          targetValue: { type: 'number' },
          targetDate:  { type: 'string', format: 'date-time' },
        },
        additionalProperties: false,
      },
    },
  }, async (req, reply) => {
    try {
      const goal = await prisma.goal.findFirst({
        where: { id: req.params.id, userId: req.user.sub },
      })
      if (!goal) return reply.status(404).send({ success: false, error: 'Goal not found' })
      const { achieved, targetValue, targetDate } = req.body
      const updated = await prisma.goal.update({
        where: { id: req.params.id },
        data: {
          ...(achieved !== undefined && { achieved }),
          ...(targetValue !== undefined && { targetValue }),
          ...(targetDate !== undefined && { targetDate: new Date(targetDate) }),
        },
      })
      return reply.send({ success: true, data: updated })
    } catch (e) {
      app.log.error(e)
      return reply.status(500).send({ success: false, error: 'Failed to update goal' })
    }
  })
}
