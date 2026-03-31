import Fastify from 'fastify'
import fastifyJwt from '@fastify/jwt'
import fastifyCors from '@fastify/cors'
import fastifyCookie from '@fastify/cookie'
import fastifyHelmet from '@fastify/helmet'
import fastifyRateLimit from '@fastify/rate-limit'
import { PrismaClient } from '@prisma/client'
import authRoutes from './routes/auth.js'
import workoutRoutes from './routes/workouts.js'
import progressRoutes from './routes/progress.js'
import exerciseRoutes from './routes/exercises.js'
import { seedExercises } from './seed-exercises.js'

const isProd = process.env.NODE_ENV === 'production'

// ── Validate required environment variables ──────────────────────────────────
if (isProd && !process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET must be set in production')
  process.exit(1)
}
if (isProd && !process.env.DATABASE_URL) {
  console.error('FATAL: DATABASE_URL must be set in production')
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

// ── Security ──────────────────────────────────────────────────────────────────
await app.register(fastifyHelmet, {
  contentSecurityPolicy: false, // CSP is handled by the PWA / Vite
})

await app.register(fastifyRateLimit, {
  global: false, // opt-in per route
  max: 100,
  timeWindow: '1 minute',
})

await app.register(fastifyCors, {
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
})

await app.register(fastifyCookie)

await app.register(fastifyJwt, {
  secret: process.env.JWT_SECRET || 'dev-secret-change-in-prod',
  cookie: { cookieName: 'token', signed: false },
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

app.get('/health', () => ({ ok: true, ts: new Date().toISOString() }))

// ── Seed ──────────────────────────────────────────────────────────────────────
try {
  await seedExercises(prisma)
} catch (err) {
  app.log.warn({ err }, '[seed-exercises] Exercise seeding failed — server will still start')
}

// ── Listen ────────────────────────────────────────────────────────────────────
await app.listen({ port: Number(process.env.PORT) || 3001, host: '0.0.0.0' })
