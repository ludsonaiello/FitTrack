import { createHash } from 'crypto'

/**
 * Fastify preHandler that authenticates via Bearer API key.
 * Sets req.user = { id, email, name } on success.
 */
export async function apiKeyAuth(req, reply) {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return reply.status(401).send({ success: false, error: 'Missing API key' })
  }

  const rawKey = authHeader.slice(7).trim()
  if (!rawKey.startsWith('ft_')) {
    return reply.status(401).send({ success: false, error: 'Invalid API key format' })
  }

  const keyHash = createHash('sha256').update(rawKey).digest('hex')

  const apiKey = await req.server.prisma.apiKey.findUnique({
    where: { keyHash },
    include: { user: { select: { id: true, email: true, name: true } } },
  })

  if (!apiKey) {
    return reply.status(401).send({ success: false, error: 'Invalid API key' })
  }

  // Update lastUsed asynchronously — don't block the request
  req.server.prisma.apiKey.update({
    where: { id: apiKey.id },
    data: { lastUsed: new Date() },
  }).catch(() => {})

  req.user = apiKey.user
}
