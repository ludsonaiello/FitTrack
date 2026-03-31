/**
 * Fastify preHandler that requires a valid JWT AND isAdmin=true.
 * Must be used after app.authenticate (or combined as shown below).
 */
export async function adminAuth(req, reply) {
  // Verify JWT first
  try {
    await req.jwtVerify()
  } catch {
    return reply.status(401).send({ success: false, error: 'Unauthorized' })
  }

  if (!req.user.isAdmin) {
    return reply.status(403).send({ success: false, error: 'Forbidden' })
  }
}
