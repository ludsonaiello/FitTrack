import bcrypt from 'bcryptjs'
import { randomBytes, createHash } from 'crypto'

const isProd = process.env.NODE_ENV === 'production'

/** Access token: 15 minutes */
const ACCESS_TTL_SEC  = 60 * 15
/** Refresh token: 7 days */
const REFRESH_TTL_SEC = 60 * 60 * 24 * 7

/** Generate a raw refresh token, its SHA-256 hash, and its expiry Date */
function makeRefreshToken() {
  const raw      = randomBytes(40).toString('hex')               // 80-char hex
  const hash     = createHash('sha256').update(raw).digest('hex')
  const expiresAt = new Date(Date.now() + REFRESH_TTL_SEC * 1000)
  return { raw, hash, expiresAt }
}

/**
 * Set both cookies on a reply.
 * Access token goes to path='/' (readable by all API routes).
 * Refresh token is scoped to /api/auth/refresh only.
 */
function setAuthCookies(reply, accessToken, refreshRaw) {
  reply
    .setCookie('token', accessToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProd,
      path: '/',
      maxAge: ACCESS_TTL_SEC,
    })
    .setCookie('refreshToken', refreshRaw, {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProd,
      path: '/api/auth',      // scoped — browser only sends on /api/auth/* requests
      maxAge: REFRESH_TTL_SEC,
    })
}

function clearAuthCookies(reply) {
  reply
    .clearCookie('token',        { path: '/',          httpOnly: true, sameSite: 'lax', secure: isProd })
    .clearCookie('refreshToken', { path: '/api/auth',  httpOnly: true, sameSite: 'lax', secure: isProd })
}

/** @param {import('fastify').FastifyInstance} app */
export default async function authRoutes(app) {
  const prisma = app.prisma

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
        select: { id: true, email: true, name: true, isAdmin: true, createdAt: true },
      })

      const accessToken    = app.jwt.sign({ sub: user.id, email: user.email, isAdmin: user.isAdmin }, { expiresIn: `${ACCESS_TTL_SEC}s` })
      const { raw, hash, expiresAt } = makeRefreshToken()
      await prisma.refreshToken.create({ data: { userId: user.id, tokenHash: hash, expiresAt } })

      setAuthCookies(reply, accessToken, raw)
      return reply.status(201).send({ success: true, data: user })
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

      // Invalidate all existing sessions for this user before issuing a new one
      await prisma.refreshToken.deleteMany({ where: { userId: user.id } })

      const accessToken = app.jwt.sign({ sub: user.id, email: user.email, isAdmin: user.isAdmin }, { expiresIn: `${ACCESS_TTL_SEC}s` })
      const { raw, hash: rtHash, expiresAt } = makeRefreshToken()
      await prisma.refreshToken.create({ data: { userId: user.id, tokenHash: rtHash, expiresAt } })

      setAuthCookies(reply, accessToken, raw)
      return reply.send({ success: true, data: { id: user.id, email: user.email, name: user.name, isAdmin: user.isAdmin } })
    } catch (e) {
      app.log.error(e)
      return reply.status(500).send({ success: false, error: 'Login failed. Please try again.' })
    }
  })

  // ── Refresh ────────────────────────────────────────────────────────────────
  // Called automatically by the client when an access token expires (401).
  // Issues a new access token + rotates the refresh token.
  app.post('/refresh', {
    config: { rateLimit: { max: 30, timeWindow: '15 minutes' } },
  }, async (req, reply) => {
    const rawToken = req.cookies?.refreshToken
    if (!rawToken) {
      return reply.status(401).send({ success: false, error: 'No refresh token' })
    }

    const tokenHash = createHash('sha256').update(rawToken).digest('hex')

    try {
      const stored = await prisma.refreshToken.findUnique({
        where: { tokenHash },
        include: { user: { select: { id: true, email: true, name: true, isAdmin: true } } },
      })

      if (!stored || stored.expiresAt < new Date()) {
        // Expired or unknown token — clear cookies and force re-login
        clearAuthCookies(reply)
        return reply.status(401).send({ success: false, error: 'Session expired. Please log in again.' })
      }

      // Rotate: delete old token and create new one atomically
      const { raw: newRaw, hash: newHash, expiresAt: newExpiry } = makeRefreshToken()
      const { user } = stored
      await prisma.$transaction([
        prisma.refreshToken.delete({ where: { tokenHash } }),
        prisma.refreshToken.create({ data: { userId: user.id, tokenHash: newHash, expiresAt: newExpiry } }),
      ])

      const newAccessToken = app.jwt.sign({ sub: user.id, email: user.email, isAdmin: user.isAdmin }, { expiresIn: `${ACCESS_TTL_SEC}s` })

      setAuthCookies(reply, newAccessToken, newRaw)
      return reply.send({ success: true, data: { id: user.id, email: user.email, name: user.name, isAdmin: user.isAdmin } })
    } catch (e) {
      app.log.error(e)
      return reply.status(500).send({ success: false, error: 'Token refresh failed.' })
    }
  })

  // ── Logout ─────────────────────────────────────────────────────────────────
  app.post('/logout', async (req, reply) => {
    const rawToken = req.cookies?.refreshToken
    if (rawToken) {
      const tokenHash = createHash('sha256').update(rawToken).digest('hex')
      await prisma.refreshToken.deleteMany({ where: { tokenHash } }).catch(() => {})
    }
    clearAuthCookies(reply)
    return reply.send({ success: true })
  })

  // ── Me ─────────────────────────────────────────────────────────────────────
  app.get('/me', {
    preHandler: [app.authenticate],
  }, async (req, reply) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user.sub },
        select: { id: true, email: true, name: true, isAdmin: true, createdAt: true, onboarded: true, sex: true, heightCm: true, heightUnit: true },
      })
      if (!user) {
        clearAuthCookies(reply)
        return reply.status(401).send({ success: false, error: 'Session expired' })
      }
      return reply.send({ success: true, data: user })
    } catch (e) {
      app.log.error(e)
      return reply.status(500).send({ success: false, error: 'Failed to fetch user' })
    }
  })

  // ── Update profile ─────────────────────────────────────────────────────────
  app.patch('/me', {
    preHandler: [app.authenticate],
    schema: {
      body: {
        type: 'object',
        properties: {
          name:       { type: 'string', minLength: 1, maxLength: 100 },
          sex:        { type: 'string', enum: ['male', 'female', 'unspecified'] },
          heightCm:   { type: 'number', minimum: 50, maximum: 275 },
          heightUnit: { type: 'string', enum: ['cm', 'ft'] },
          onboarded:  { type: 'boolean' },
        },
        additionalProperties: false,
      },
    },
  }, async (req, reply) => {
    try {
      const { name, sex, heightCm, heightUnit, onboarded } = req.body
      const data = {}
      if (name      !== undefined) data.name      = name
      if (sex       !== undefined) data.sex        = sex
      if (heightCm  !== undefined) data.heightCm  = heightCm
      if (heightUnit !== undefined) data.heightUnit = heightUnit
      if (onboarded !== undefined) data.onboarded = onboarded
      const updated = await prisma.user.update({
        where: { id: req.user.sub },
        data,
        select: { id: true, email: true, name: true, isAdmin: true, createdAt: true, onboarded: true, sex: true, heightCm: true, heightUnit: true },
      })
      return reply.send({ success: true, data: updated })
    } catch (e) {
      app.log.error(e)
      return reply.status(500).send({ success: false, error: 'Failed to update profile' })
    }
  })
}
