import { createRequire } from 'module'

const require = createRequire(import.meta.url)

const en   = require('./en.json')
const ptBR = require('./pt-BR.json')

const translations = { en, 'pt-BR': ptBR }

/**
 * Get a translated string by language and dot-separated key.
 * Falls back to English, then to the raw key if not found.
 * @param {string} lang - Language code, e.g. "en" or "pt-BR"
 * @param {string} key  - Dot-separated key, e.g. "auth.invalid_credentials"
 * @returns {string}
 */
export function t(lang, key) {
  const locale = translations[lang] ?? translations['en']
  return key.split('.').reduce((obj, k) => obj?.[k], locale) ?? key
}

/**
 * Resolve the preferred language for a request.
 * Priority: authenticated user's saved language > Accept-Language header > "en"
 * @param {import('fastify').FastifyRequest} request
 * @returns {string}
 */
export function resolveLanguage(request) {
  if (request.user?.language) return request.user.language
  const header = request.headers['accept-language'] ?? ''
  if (header.startsWith('pt')) return 'pt-BR'
  return 'en'
}
