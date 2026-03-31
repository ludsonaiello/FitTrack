/**
 * Creates or promotes the default admin user.
 *
 * Usage:
 *   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=changeme123 node src/seed-admin.js
 *
 * If the user already exists their password and isAdmin flag are updated.
 * If they don't exist a new account is created with isAdmin=true.
 */
import bcrypt from 'bcryptjs'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const email    = process.env.ADMIN_EMAIL    || 'admin@fittrack.local'
const password = process.env.ADMIN_PASSWORD

if (!password) {
  console.error('FATAL: ADMIN_PASSWORD environment variable is required')
  process.exit(1)
}
if (password.length < 8) {
  console.error('FATAL: ADMIN_PASSWORD must be at least 8 characters')
  process.exit(1)
}

const passwordHash = await bcrypt.hash(password, 12)

const existing = await prisma.user.findUnique({ where: { email } })

if (existing) {
  await prisma.user.update({
    where: { email },
    data: { passwordHash, isAdmin: true },
  })
  console.log(`✓ Admin promoted/updated: ${email}`)
} else {
  await prisma.user.create({
    data: {
      email,
      passwordHash,
      name: 'Admin',
      isAdmin: true,
    },
  })
  console.log(`✓ Admin user created: ${email}`)
}

await prisma.$disconnect()
