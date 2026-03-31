import { randomBytes, createHash } from 'crypto'
import bcrypt from 'bcryptjs'

const ALLOWED_REDIRECT_ORIGINS = [
  'https://chat.openai.com',
  'https://chatgpt.com',
]

function isAllowedRedirectUri(uri) {
  try {
    const { origin } = new URL(uri)
    return ALLOWED_REDIRECT_ORIGINS.some(o => origin === o || origin.endsWith('.' + o.replace('https://', '')))
  } catch {
    return false
  }
}

function generateApiKey() {
  const rawKey = 'ft_' + randomBytes(24).toString('hex')
  const keyHash = createHash('sha256').update(rawKey).digest('hex')
  const prefix = rawKey.slice(0, 10)
  return { rawKey, keyHash, prefix }
}

export default async function oauthRoutes(app) {
  const rateLimitConfig = { config: { rateLimit: { max: 10, timeWindow: '15 minutes' } } }

  // GET /oauth/authorize — redirect to React login page preserving all query params
  app.get('/authorize', rateLimitConfig, async (req, reply) => {
    const { client_id, redirect_uri, state, response_type } = req.query

    if (client_id !== process.env.OAUTH_CLIENT_ID) {
      return reply.status(400).send({ error: 'invalid_client', error_description: 'Unknown client_id' })
    }
    if (response_type !== 'code') {
      return reply.status(400).send({ error: 'unsupported_response_type' })
    }
    if (!redirect_uri || !isAllowedRedirectUri(redirect_uri)) {
      return reply.status(400).send({ error: 'invalid_request', error_description: 'redirect_uri not allowed' })
    }

    const params = new URLSearchParams({ client_id, redirect_uri, state: state ?? '', response_type })
    return reply.redirect(302, `/oauth-login?${params.toString()}`)
  })

  // POST /oauth/authorize — called by the React login page after user submits credentials
  app.post('/authorize', rateLimitConfig, async (req, reply) => {
    const { email, password, client_id, redirect_uri, state } = req.body ?? {}

    if (!email || !password || !client_id || !redirect_uri) {
      return reply.status(400).send({ error: 'invalid_request', error_description: 'Missing required fields' })
    }
    if (client_id !== process.env.OAUTH_CLIENT_ID) {
      return reply.status(400).send({ error: 'invalid_client' })
    }
    if (!isAllowedRedirectUri(redirect_uri)) {
      return reply.status(400).send({ error: 'invalid_request', error_description: 'redirect_uri not allowed' })
    }

    const user = await app.prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } })
    if (!user) {
      return reply.status(401).send({ error: 'invalid_credentials', error_description: 'Invalid email or password' })
    }

    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) {
      return reply.status(401).send({ error: 'invalid_credentials', error_description: 'Invalid email or password' })
    }

    const code = randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes

    await app.prisma.oAuthCode.create({
      data: { code, userId: user.id, redirectUri: redirect_uri, expiresAt },
    })

    // Prune old expired codes for this user (fire and forget)
    app.prisma.oAuthCode.deleteMany({
      where: { userId: user.id, expiresAt: { lt: new Date() } },
    }).catch(() => {})

    const redirectUrl = `${redirect_uri}?code=${code}${state ? `&state=${encodeURIComponent(state)}` : ''}`
    return reply.send({ success: true, redirectUrl })
  })

  // POST /oauth/token — ChatGPT server exchanges code for an access token
  app.post('/token', rateLimitConfig, async (req, reply) => {
    // Accept both JSON and form-encoded bodies
    const body = req.body ?? {}
    const { grant_type, code, client_id, client_secret, redirect_uri } = body

    if (grant_type !== 'authorization_code') {
      return reply.status(400).send({ error: 'unsupported_grant_type' })
    }
    if (client_id !== process.env.OAUTH_CLIENT_ID || client_secret !== process.env.OAUTH_CLIENT_SECRET) {
      return reply.status(401).send({ error: 'invalid_client' })
    }
    if (!code) {
      return reply.status(400).send({ error: 'invalid_request', error_description: 'Missing code' })
    }

    const oauthCode = await app.prisma.oAuthCode.findUnique({ where: { code } })

    if (!oauthCode || oauthCode.used || oauthCode.expiresAt < new Date()) {
      return reply.status(400).send({ error: 'invalid_grant' })
    }
    if (redirect_uri && oauthCode.redirectUri !== redirect_uri) {
      return reply.status(400).send({ error: 'invalid_grant', error_description: 'redirect_uri mismatch' })
    }

    // Mark code as used (atomic)
    await app.prisma.oAuthCode.update({ where: { code }, data: { used: true } })

    // Reuse existing "ChatGPT" API key for this user if one exists
    const existing = await app.prisma.apiKey.findFirst({
      where: { userId: oauthCode.userId, label: 'ChatGPT' },
      select: { rawKey: true },
    })

    if (existing?.rawKey) {
      return reply.send({ access_token: existing.rawKey, token_type: 'bearer' })
    }

    // Generate a new API key labeled "ChatGPT"
    const { rawKey, keyHash, prefix } = generateApiKey()
    await app.prisma.apiKey.create({
      data: {
        userId: oauthCode.userId,
        label: 'ChatGPT',
        keyHash,
        rawKey,
        prefix,
      },
    })

    return reply.send({ access_token: rawKey, token_type: 'bearer' })
  })
}
