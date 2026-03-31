import bcrypt from 'bcryptjs'
import { randomBytes } from 'crypto'
import { createWriteStream } from 'fs'
import { mkdir } from 'fs/promises'
import { join, dirname, extname } from 'path'
import { fileURLToPath } from 'url'
import { pipeline } from 'stream/promises'
import { adminAuth } from '../middleware/admin-auth.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
// In dev: write into client/public so Vite serves them at the same origin.
// In prod (Docker): PUBLIC_DIR is set to a shared volume; Nginx serves it at /images/ and /videos/.
const PUBLIC_DIR = process.env.PUBLIC_DIR ?? join(__dirname, '..', '..', '..', 'client', 'public')

const IMAGE_EXTS  = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif'])
const VIDEO_EXTS  = new Set(['.mp4', '.webm', '.mov', '.avi'])

const auth = { preHandler: [adminAuth] }

/** @param {import('fastify').FastifyInstance} app */
export default async function adminRoutes(app) {
  const prisma = app.prisma

  // ── GET /api/admin/exercise-meta ───────────────────────────────────────────
  // Returns all distinct equipment and focusArea values across all exercises.
  app.get('/exercise-meta', auth, async () => {
    const [equipmentRows, focusRows] = await Promise.all([
      prisma.$queryRaw`SELECT DISTINCT unnest("equipment") AS value FROM "Exercise" ORDER BY value`,
      prisma.$queryRaw`SELECT DISTINCT unnest("focusArea")  AS value FROM "Exercise" ORDER BY value`,
    ])
    return {
      success: true,
      data: {
        equipment: equipmentRows.map(r => r.value),
        focusArea: focusRows.map(r => r.value),
      },
    }
  })

  // ── POST /api/admin/upload/:type  (type = image | video) ───────────────────
  app.post('/upload/:type', { preHandler: [adminAuth] }, async (req, reply) => {
    const { type } = req.params
    if (type !== 'image' && type !== 'video') {
      return reply.status(400).send({ success: false, error: 'type must be image or video' })
    }

    const data = await req.file()
    if (!data) return reply.status(400).send({ success: false, error: 'No file received' })

    const ext = extname(data.filename).toLowerCase()
    const allowed = type === 'image' ? IMAGE_EXTS : VIDEO_EXTS
    if (!allowed.has(ext)) {
      data.file.resume() // drain the stream so the connection closes cleanly
      return reply.status(400).send({ success: false, error: `Invalid file type: ${ext}` })
    }

    const subdir  = type === 'image' ? 'images' : 'videos'
    const folder  = join(PUBLIC_DIR, subdir)
    await mkdir(folder, { recursive: true })

    const filename = randomBytes(16).toString('hex') + ext
    const dest     = join(folder, filename)

    await pipeline(data.file, createWriteStream(dest))

    // URL is root-relative so it works from the frontend origin in both dev and prod
    const url = `/${subdir}/${filename}`
    return reply.status(201).send({ success: true, data: { url } })
  })

  // ── GET /api/admin/users ────────────────────────────────────────────────────
  app.get('/users', auth, async () => {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        isAdmin: true,
        createdAt: true,
        _count: { select: { sessions: true, bodyWeights: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    return { success: true, data: users }
  })

  // ── POST /api/admin/users/:id/reset-password ────────────────────────────────
  app.post('/users/:id/reset-password', auth, async (req, reply) => {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } })
    if (!user) return reply.status(404).send({ success: false, error: 'User not found' })

    // Generate a readable temporary password: word-digits pattern
    const tempPassword = randomBytes(5).toString('hex') + '-' + randomBytes(3).toString('hex')
    const passwordHash = await bcrypt.hash(tempPassword, 12)

    await prisma.$transaction([
      prisma.user.update({ where: { id: req.params.id }, data: { passwordHash } }),
      // Invalidate all sessions so the user must log in with the new password
      prisma.refreshToken.deleteMany({ where: { userId: req.params.id } }),
    ])

    return { success: true, data: { tempPassword } }
  })

  // ── GET /api/admin/exercises ────────────────────────────────────────────────
  app.get('/exercises', {
    ...auth,
    schema: {
      querystring: {
        type: 'object',
        properties: {
          q:     { type: 'string', maxLength: 200 },
          page:  { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
        },
        additionalProperties: false,
      },
    },
  }, async (req) => {
    const { q, page = 1, limit = 50 } = req.query
    const where = q ? { name: { contains: q, mode: 'insensitive' } } : {}
    const skip  = (page - 1) * limit

    const [total, data] = await Promise.all([
      prisma.exercise.count({ where }),
      prisma.exercise.findMany({
        where, skip, take: limit,
        select: {
          id: true, name: true, type: true,
          experienceLevel: true, equipment: true, focusArea: true,
          imageUrl: true, mediaUrl: true, tips: true,
        },
        orderBy: { name: 'asc' },
      }),
    ])

    return { success: true, data, meta: { total, page, limit } }
  })

  // ── POST /api/admin/exercises ───────────────────────────────────────────────
  app.post('/exercises', {
    ...auth,
    schema: {
      body: {
        type: 'object',
        required: ['name', 'experienceLevel'],
        properties: {
          id:              { type: 'string', maxLength: 100 },
          name:            { type: 'string', minLength: 1, maxLength: 200 },
          type:            { type: 'string', maxLength: 50 },
          experienceLevel: { type: 'string', enum: ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'] },
          equipment:       { type: 'array', items: { type: 'string' }, default: [] },
          focusArea:       { type: 'array', items: { type: 'string' }, default: [] },
          imageUrl:        { type: 'string', maxLength: 500, default: '' },
          mediaUrl:        { type: 'string', maxLength: 500, default: '' },
          tips:            { type: 'array', items: { type: 'string' }, default: [] },
        },
        additionalProperties: false,
      },
    },
  }, async (req, reply) => {
    const { id, name, type = 'TUTORIAL', experienceLevel, equipment, focusArea, imageUrl, mediaUrl, tips } = req.body

    // Use provided id or generate a slug from the name
    const exerciseId = id?.trim() || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

    const existing = await prisma.exercise.findUnique({ where: { id: exerciseId } })
    if (existing) return reply.status(409).send({ success: false, error: `Exercise ID "${exerciseId}" already exists` })

    const exercise = await prisma.exercise.create({
      data: { id: exerciseId, name: name.trim(), type, experienceLevel, equipment, focusArea, imageUrl, mediaUrl, tips },
    })
    return reply.status(201).send({ success: true, data: exercise })
  })

  // ── PATCH /api/admin/exercises/:id ─────────────────────────────────────────
  app.patch('/exercises/:id', {
    ...auth,
    schema: {
      body: {
        type: 'object',
        properties: {
          name:            { type: 'string', minLength: 1, maxLength: 200 },
          type:            { type: 'string', maxLength: 50 },
          experienceLevel: { type: 'string', enum: ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'] },
          equipment:       { type: 'array', items: { type: 'string' } },
          focusArea:       { type: 'array', items: { type: 'string' } },
          imageUrl:        { type: 'string', maxLength: 500 },
          mediaUrl:        { type: 'string', maxLength: 500 },
          tips:            { type: 'array', items: { type: 'string' } },
        },
        additionalProperties: false,
      },
    },
  }, async (req, reply) => {
    const existing = await prisma.exercise.findUnique({ where: { id: req.params.id } })
    if (!existing) return reply.status(404).send({ success: false, error: 'Exercise not found' })

    const updated = await prisma.exercise.update({
      where: { id: req.params.id },
      data: req.body,
    })
    return { success: true, data: updated }
  })

  // ── DELETE /api/admin/exercises/:id ────────────────────────────────────────
  app.delete('/exercises/:id', auth, async (req, reply) => {
    const deleted = await prisma.exercise.deleteMany({ where: { id: req.params.id } })
    if (deleted.count === 0) return reply.status(404).send({ success: false, error: 'Exercise not found' })
    return { success: true }
  })
}
