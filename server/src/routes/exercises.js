import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const querySchema = {
  type: 'object',
  properties: {
    q:         { type: 'string' },
    equipment: { type: 'string' },
    focus:     { type: 'string' },
    level: {
      type: 'string',
      enum: ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'],
    },
    page:  { type: 'integer', minimum: 1, default: 1 },
    limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
  },
  additionalProperties: false,
}

/**
 * @param {import('fastify').FastifyInstance} app
 */
export default async function exerciseRoutes(app) {
  app.get(
    '/exercises',
    {
      schema: {
        querystring: querySchema,
      },
    },
    async (request, reply) => {
      try {
        const { q, equipment, focus, level, page, limit } = request.query

        const where = {}

        if (q) {
          where.name = { contains: q, mode: 'insensitive' }
        }

        if (equipment) {
          where.equipment = { has: equipment }
        }

        if (focus) {
          where.focusArea = { has: focus }
        }

        if (level) {
          where.experienceLevel = level
        }

        const skip = (page - 1) * limit

        const [total, data] = await Promise.all([
          prisma.exercise.count({ where }),
          prisma.exercise.findMany({
            where,
            skip,
            take: limit,
            select: {
              id:              true,
              name:            true,
              type:            true,
              experienceLevel: true,
              equipment:       true,
              focusArea:       true,
              imageUrl:        true,
              mediaUrl:        true,
              tips:            true,
            },
            orderBy: { name: 'asc' },
          }),
        ])

        return reply.send({
          success: true,
          data,
          meta: { total, page, limit },
        })
      } catch (e) {
        app.log.error(e)
        return reply.status(500).send({ success: false, error: e.message })
      }
    }
  )
}
