import { randomBytes, createHash } from 'crypto'

export default async function apiKeyRoutes(app) {
  // List all API keys for the current user
  app.get('/', { preHandler: [app.authenticate] }, async (req) => {
    const keys = await app.prisma.apiKey.findMany({
      where: { userId: req.user.sub },
      select: { id: true, label: true, prefix: true, rawKey: true, createdAt: true, lastUsed: true },
      orderBy: { createdAt: 'desc' },
    })
    return { success: true, data: keys }
  })

  // Generate a new API key
  app.post('/', {
    config: { rateLimit: { max: 10, timeWindow: '1 hour' } },
    schema: {
      body: {
        type: 'object',
        required: ['label'],
        properties: {
          label: { type: 'string', minLength: 1, maxLength: 100 },
        },
        additionalProperties: false,
      },
    },
    preHandler: [app.authenticate],
  }, async (req, reply) => {
    const { label } = req.body
    if (!label.trim()) {
      return reply.status(400).send({ success: false, error: 'label cannot be blank' })
    }

    const count = await app.prisma.apiKey.count({ where: { userId: req.user.sub } })
    if (count >= 5) {
      return reply.status(400).send({ success: false, error: 'Maximum 5 API keys allowed' })
    }

    const rawKey = 'ft_' + randomBytes(24).toString('hex') // ft_ + 48 hex chars
    const keyHash = createHash('sha256').update(rawKey).digest('hex')
    const prefix = rawKey.slice(0, 10) // "ft_" + 7 chars

    const apiKey = await app.prisma.apiKey.create({
      data: {
        userId: req.user.sub,
        label: label.trim(),
        keyHash,
        rawKey,
        prefix,
      },
      select: { id: true, label: true, prefix: true, rawKey: true, createdAt: true },
    })

    return reply.status(201).send({ success: true, data: apiKey })
  })

  // Revoke an API key
  app.delete('/:id', { preHandler: [app.authenticate] }, async (req, reply) => {
    const deleted = await app.prisma.apiKey.deleteMany({
      where: { id: req.params.id, userId: req.user.sub },
    })
    if (deleted.count === 0) {
      return reply.status(404).send({ success: false, error: 'API key not found' })
    }
    return { success: true }
  })
}
