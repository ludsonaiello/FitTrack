# Sprint 3 — Backend Agent Spec
**Agent:** backend-agent  
**Task ID:** #3  
**Gate:** BLOCKED until `fittrack-specs/sprint-03-i18n/DB_GATE_OPEN` exists (Task #2 complete).

---

## Pre-Start Check

Before doing ANY work, verify:
```bash
cat fittrack-specs/sprint-03-i18n/DB_GATE_OPEN
```
If the file does not exist, STOP. The DB agent has not finished. Do not proceed.

---

## Objective

Expose the `language` field through the API and add a full server-side i18n layer so all error messages can be returned in the user's selected language.

---

## Deliverables

### 1. Translation Files

Create `/server/src/i18n/en.json`:
```json
{
  "auth": {
    "invalid_credentials": "Invalid email or password.",
    "email_taken": "An account with this email already exists.",
    "not_found": "User not found.",
    "unauthorized": "You must be logged in.",
    "forbidden": "You do not have permission to perform this action.",
    "token_expired": "Your session has expired. Please log in again.",
    "token_invalid": "Invalid token.",
    "refresh_required": "Please log in again."
  },
  "validation": {
    "email_required": "Email is required.",
    "password_required": "Password is required.",
    "name_required": "Name is required.",
    "password_too_short": "Password must be at least 8 characters.",
    "invalid_language": "Language must be 'en' or 'pt-BR'."
  },
  "workouts": {
    "plan_not_found": "Workout plan not found.",
    "session_not_found": "Session not found.",
    "exercise_not_found": "Exercise not found."
  },
  "progress": {
    "goal_not_found": "Goal not found.",
    "weight_not_found": "Weight entry not found."
  },
  "server": {
    "internal_error": "An internal server error occurred.",
    "not_found": "The requested resource was not found."
  }
}
```

Create `/server/src/i18n/pt-BR.json` with the same keys translated to Brazilian Portuguese.

### 2. i18n Helper Module

Create `/server/src/i18n/index.js`:
```js
import en from './en.json' assert { type: 'json' };
import ptBR from './pt-BR.json' assert { type: 'json' };

const translations = { en, 'pt-BR': ptBR };

// Get a nested key like "auth.invalid_credentials"
export function t(lang, key) {
  const locale = translations[lang] ?? translations['en'];
  return key.split('.').reduce((obj, k) => obj?.[k], locale) ?? key;
}

// Resolve language from request: user.language > Accept-Language header > 'en'
export function resolveLanguage(request) {
  if (request.user?.language) return request.user.language;
  const header = request.headers['accept-language'] ?? '';
  if (header.startsWith('pt')) return 'pt-BR';
  return 'en';
}
```

### 3. Update Auth Routes

**File:** `/server/src/routes/auth.js`

- `GET /api/auth/me` — include `language` in the returned user object
- `PATCH /api/auth/me` — accept and validate `language` field (must be `"en"` or `"pt-BR"`), save to DB
- Replace hardcoded error strings with `t(lang, "auth.invalid_credentials")` etc.

### 4. Update All Route Error Messages

Replace ALL hardcoded error strings in:
- `routes/auth.js`
- `routes/workouts.js`
- `routes/progress.js`
- `routes/exercises.js`

Pattern:
```js
import { t, resolveLanguage } from '../i18n/index.js';
// ...
const lang = resolveLanguage(request);
reply.status(401).send({ error: t(lang, 'auth.unauthorized') });
```

### 5. Prisma Client Usage

The `language` field is now available on the `User` model. Prisma types will include it automatically after migration. No additional Prisma changes needed.

---

## Validation Checklist

- [ ] `server/src/i18n/en.json` exists with all keys
- [ ] `server/src/i18n/pt-BR.json` exists with all keys translated
- [ ] `server/src/i18n/index.js` with `t()` and `resolveLanguage()` exported
- [ ] `GET /api/auth/me` returns `{ ..., language: "en" }`
- [ ] `PATCH /api/auth/me` with `{ language: "pt-BR" }` saves to DB
- [ ] `PATCH /api/auth/me` with invalid language returns 400 + translated error
- [ ] Auth route errors use `t()` helper
- [ ] Workout route errors use `t()` helper
- [ ] Progress route errors use `t()` helper

---

## Gate Signal

After completing this task:
1. Mark Task #3 as **completed**
2. Write `fittrack-specs/sprint-03-i18n/BACKEND_GATE_OPEN` with content: `Backend i18n complete. Frontend may proceed.`
3. The frontend agent reads this file before starting.
