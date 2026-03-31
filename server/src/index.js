import Fastify from 'fastify'
import fastifyJwt from '@fastify/jwt'
import fastifyCors from '@fastify/cors'
import fastifyCookie from '@fastify/cookie'
import fastifyHelmet from '@fastify/helmet'
import fastifyRateLimit from '@fastify/rate-limit'
import fastifyMultipart from '@fastify/multipart'
import { PrismaClient } from '@prisma/client'

import authRoutes from './routes/auth.js'
import workoutRoutes from './routes/workouts.js'
import progressRoutes from './routes/progress.js'
import exerciseRoutes from './routes/exercises.js'
import apiKeyRoutes from './routes/api-keys.js'
import gptRoutes from './routes/gpt.js'
import adminRoutes from './routes/admin.js'
import oauthRoutes from './routes/oauth.js'

const isProd = process.env.NODE_ENV === 'production'

// ── Validate required environment variables ──────────────────────────────────
if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is not set')
  process.exit(1)
}
if (!process.env.DATABASE_URL) {
  console.error('FATAL: DATABASE_URL environment variable is not set')
  process.exit(1)
}
if (!process.env.OAUTH_CLIENT_ID || !process.env.OAUTH_CLIENT_SECRET) {
  console.error('FATAL: OAUTH_CLIENT_ID and OAUTH_CLIENT_SECRET environment variables are not set')
  process.exit(1)
}

// ── Server ────────────────────────────────────────────────────────────────────
const app = Fastify({
  logger: {
    level: isProd ? 'warn' : 'info',
    ...(isProd ? {} : { transport: { target: 'pino-pretty', options: { colorize: true } } }),
  },
})

const prisma = new PrismaClient()
app.decorate('prisma', prisma)

// ── Security ──────────────────────────────────────────────────────────────────
await app.register(fastifyHelmet, {
  contentSecurityPolicy: false, // CSP is handled by the PWA / Vite
})

await app.register(fastifyRateLimit, {
  global: true,         // apply to all routes by default
  max: 200,             // 200 req/min per IP — generous for a personal fitness app
  timeWindow: '1 minute',
  keyGenerator: (req) => req.headers['x-forwarded-for']?.split(',')[0] ?? req.ip,
})

// Browser clients that send cookies — must be an exact match
const browserOrigins = [
  process.env.CLIENT_URL || 'http://localhost:5173',
]

// GPT Actions and server-to-server callers identify via API key Bearer token,
// not cookies, so they do not need credentials: true
const gptOrigins = [
  'https://chat.openai.com',
  'https://chatgpt.com',
]

await app.register(fastifyCors, {
  origin: (origin, cb) => {
    // No origin: server-to-server (curl, Postman, GPT Actions).
    // /oauth/token is a server-to-server call from ChatGPT — allow it without origin.
    // All other no-origin requests (e.g. cookie-based) are rejected.
    if (!origin) {
      const url = req.raw?.url ?? ''
      if (url === '/oauth/token' || url.startsWith('/oauth/token?')) return cb(null, true)
      return cb(null, false)
    }
    if (browserOrigins.includes(origin) || gptOrigins.includes(origin)) {
      return cb(null, true)
    }
    cb(new Error('Not allowed by CORS'), false)
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
})

await app.register(fastifyCookie)

await app.register(fastifyJwt, {
  secret: process.env.JWT_SECRET,
  cookie: { cookieName: 'token', signed: false },
})

// ── File uploads ─────────────────────────────────────────────────────────────
await app.register(fastifyMultipart, {
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB max
})

// ── Auth helper ───────────────────────────────────────────────────────────────
app.decorate('authenticate', async (req, reply) => {
  try {
    await req.jwtVerify()
  } catch {
    reply.status(401).send({ success: false, error: 'Unauthorized' })
  }
})

// ── Routes ────────────────────────────────────────────────────────────────────
await app.register(authRoutes,     { prefix: '/api/auth' })
await app.register(workoutRoutes,  { prefix: '/api/workouts' })
await app.register(progressRoutes, { prefix: '/api/progress' })
await app.register(exerciseRoutes, { prefix: '/api' })
await app.register(apiKeyRoutes,   { prefix: '/api/api-keys' })
await app.register(gptRoutes,      { prefix: '/api/gpt' })
await app.register(adminRoutes,    { prefix: '/api/admin' })
await app.register(oauthRoutes,    { prefix: '/oauth' })

app.get('/health', () => ({ ok: true, ts: new Date().toISOString() }))

// ── Startup cleanup ───────────────────────────────────────────────────────────
// Prune expired refresh tokens to keep the table bounded
prisma.refreshToken.deleteMany({ where: { expiresAt: { lt: new Date() } } })
  .then(r => { if (r.count > 0) app.log.info(`Pruned ${r.count} expired refresh tokens`) })
  .catch(e => app.log.error({ err: e }, 'Failed to prune expired refresh tokens'))

// ── Listen ────────────────────────────────────────────────────────────────────
await app.listen({ port: Number(process.env.PORT) || 3001, host: '0.0.0.0' })
