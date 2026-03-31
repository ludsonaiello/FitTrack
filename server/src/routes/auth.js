import bcrypt from 'bcryptjs'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const isProd = process.env.NODE_ENV === 'production'

/** @param {import('fastify').FastifyInstance} app */
export default async function authRoutes(app) {

  // ── Register ───────────────────────────────────────────────────────────────
  app.post('/register', {
    config: { rateLimit: { max: 10, timeWindow: '15 minutes' } },
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password', 'name'],
        properties: {
          name:     { type: 'string', minLength: 1, maxLength: 100 },
          email:    { type: 'string', format: 'email', maxLength: 254 },
          password: { type: 'string', minLength: 8, maxLength: 128 },
        },
        additionalProperties: false,
      },
    },
  }, async (req, reply) => {
    const { email, password, name } = req.body
    try {
      const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } })
      if (existing) {
        return reply.status(409).send({ success: false, error: 'An account with that email already exists' })
      }
      const passwordHash = await bcrypt.hash(password, 12)
      const user = await prisma.user.create({
        data: { email: email.toLowerCase(), passwordHash, name },
        select: { id: true, email: true, name: true, createdAt: true },
      })
      const token = app.jwt.sign({ sub: user.id, email: user.email }, { expiresIn: '30d' })
      return reply
        .setCookie('token', token, {
          httpOnly: true,
          sameSite: 'lax',
          secure: isProd,
          path: '/',
          maxAge: 60 * 60 * 24 * 30, // 30 days
        })
        .send({ success: true, data: user })
    } catch (e) {
      app.log.error(e)
      return reply.status(500).send({ success: false, error: 'Registration failed. Please try again.' })
    }
  })

  // ── Login ──────────────────────────────────────────────────────────────────
  app.post('/login', {
    config: { rateLimit: { max: 20, timeWindow: '15 minutes' } },
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email:    { type: 'string', maxLength: 254 },
          password: { type: 'string', maxLength: 128 },
        },
        additionalProperties: false,
      },
    },
  }, async (req, reply) => {
    const { email, password } = req.body
    try {
      const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } })
      // Constant-time comparison even on miss to prevent user enumeration
      const hash = user?.passwordHash ?? '$2a$12$invalidhashtopreventtimingattack'
      const valid = await bcrypt.compare(password, hash)
      if (!user || !valid) {
        return reply.status(401).send({ success: false, error: 'Invalid email or password' })
      }
      const token = app.jwt.sign({ sub: user.id, email: user.email }, { expiresIn: '30d' })
      return reply
        .setCookie('token', token, {
          httpOnly: true,
          sameSite: 'lax',
          secure: isProd,
          path: '/',
          maxAge: 60 * 60 * 24 * 30,
        })
        .send({ success: true, data: { id: user.id, email: user.email, name: user.name } })
    } catch (e) {
      app.log.error(e)
      return reply.status(500).send({ success: false, error: 'Login failed. Please try again.' })
    }
  })

  // ── Logout ─────────────────────────────────────────────────────────────────
  app.post('/logout', async (_req, reply) => {
    return reply
      .clearCookie('token', { path: '/', httpOnly: true, sameSite: 'lax', secure: isProd })
      .send({ success: true })
  })

  // ── Me ─────────────────────────────────────────────────────────────────────
  app.get('/me', {
    preHandler: [app.authenticate],
  }, async (req, reply) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user.sub },
        select: { id: true, email: true, name: true, createdAt: true },
      })
      if (!user) {
        return reply
          .clearCookie('token', { path: '/' })
          .status(401)
          .send({ success: false, error: 'Session expired' })
      }
      return reply.send({ success: true, data: user })
    } catch (e) {
      app.log.error(e)
      return reply.status(500).send({ success: false, error: 'Failed to fetch user' })
    }
  })
}
