# Sprint 3 — i18n Completion Report

**Sprint:** Sprint 3 — Internationalization (i18n)
**Closed:** 2026-03-31
**Status:** Complete

---

## Sprint Summary

Sprint 3 added full multi-language support to FitTrack. Every user-facing string — UI labels,
error messages, onboarding copy, workout flows, progress charts, and profile settings — is now
driven by JSON translation files. Language preference is stored per-user in PostgreSQL and
restored on every login/session restore. The initial supported languages are English (`en`) and
Portuguese Brazil (`pt-BR`).

Four agents worked in sequence, gated by signal files to prevent skipped dependencies:

| Task | Owner    | Outcome                                               |
|------|----------|-------------------------------------------------------|
| #1   | Scribe   | Sprint documentation, specs, and changelog authored   |
| #2   | DB       | `User.language` column added via Prisma migration     |
| #3   | Backend  | i18n helper, translation JSONs, route updates         |
| #4   | Frontend | react-i18next wired up, all UI strings migrated       |

---

## Files Created or Modified

### Database

| File | Change |
|------|--------|
| `server/prisma/schema.prisma` | `language String @default("en")` added to `User` model after `heightUnit` |
| `server/prisma/migrations/20260331000000_add_user_language/migration.sql` | New — `ALTER TABLE "User" ADD COLUMN "language" TEXT NOT NULL DEFAULT 'en'` |

### Backend

| File | Change |
|------|--------|
| `server/src/i18n/en.json` | New — 34 keys across `auth`, `validation`, `workouts`, `progress`, `server` namespaces |
| `server/src/i18n/pt-BR.json` | New — full Portuguese (Brazil) mirror of `en.json` |
| `server/src/i18n/index.js` | New — exports `t(lang, key)` lookup helper and `resolveLanguage(request)` |
| `server/src/routes/auth.js` | Updated — all error responses use `t(lang, key)`; `GET /api/auth/me` and `PATCH /api/auth/me` expose and accept the `language` field |

### Frontend

| File | Change |
|------|--------|
| `client/src/i18n/en.json` | New — complete English UI string catalog across 12 namespaces |
| `client/src/i18n/pt-BR.json` | New — complete Portuguese (Brazil) UI string catalog |
| `client/src/i18n/index.js` | New — react-i18next instance configured with `en` and `pt-BR` resources |
| `client/src/main.jsx` | Updated — i18n instance imported to initialize before render |
| `client/src/components/Onboarding.jsx` | Updated — language selection step (step 7) added; all strings migrated to `t()` |
| `client/src/components/Profile.jsx` | Updated — language selector section added; all strings migrated to `t()` |
| `client/src/pages/Dashboard.jsx` | Updated — all strings migrated to `t()` |
| `client/src/pages/Exercises.jsx` | Updated — all strings migrated to `t()` |
| `client/src/pages/ExerciseDetail.jsx` | Updated — all strings migrated to `t()` |
| `client/src/pages/Planner.jsx` | Updated — all strings migrated to `t()` |
| `client/src/pages/WorkoutSession.jsx` | Updated — all strings migrated to `t()` |
| `client/src/pages/Progress.jsx` | Updated — all strings migrated to `t()` |
| `client/src/pages/Sessions.jsx` | Updated — all strings migrated to `t()` |
| `client/src/pages/SessionDetail.jsx` | Updated — all strings migrated to `t()` |
| `client/src/pages/AuthPage.jsx` | Updated — all strings migrated to `t()` |

### Sprint Spec Files (this directory)

| File | Change |
|------|--------|
| `SPEC-SCRIBE.md` | New — scribe responsibilities |
| `SPEC-DB.md` | New — schema and migration spec |
| `SPEC-BACKEND.md` | New — backend i18n architecture spec |
| `SPEC-FRONTEND.md` | New — frontend integration spec |
| `SPRINT-03-OVERVIEW.md` | New + updated — task table and status |
| `CHANGELOG.md` | Ongoing — entries appended after each task |
| `HANDOFF-DB-TO-BACKEND.md` | New — schema excerpt and migration path for backend agent |
| `HANDOFF-BACKEND-TO-FRONTEND.md` | New — API contract and translation key list for frontend agent |
| `DB_GATE_OPEN` | New — signal file written by DB agent |
| `BACKEND_GATE_OPEN` | New — signal file written by backend agent |

---

## Architecture: Language Flow from DB to Frontend

```
┌─────────────────────────────────────────────────────────────────┐
│  PostgreSQL                                                     │
│  users table                                                    │
│    language TEXT NOT NULL DEFAULT 'en'                          │
└──────────────────────────┬──────────────────────────────────────┘
                           │  Prisma ORM
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  Fastify Backend  (server/src/routes/auth.js)                   │
│                                                                 │
│  GET /api/auth/me  →  returns { ..., language: "pt-BR" }       │
│  PATCH /api/auth/me { language }  →  validates + persists       │
│                                                                 │
│  resolveLanguage(request)                                       │
│    1. Checks JWT payload for authenticated requests             │
│    2. Falls back to Accept-Language header                      │
│    3. Defaults to "en"                                          │
│                                                                 │
│  t(lang, "auth.invalid_credentials")                            │
│    → looks up server/src/i18n/{lang}.json                       │
│    → returns translated string in error response body           │
└──────────────────────────┬──────────────────────────────────────┘
                           │  HTTP JSON  (error.response.data.error)
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  React Frontend  (client/src/i18n/)                             │
│                                                                 │
│  App starts                                                     │
│    → i18next initialized with en + pt-BR bundles               │
│    → language set to localStorage value (or browser default)   │
│                                                                 │
│  User authenticates                                             │
│    → GET /api/auth/me response includes language               │
│    → i18n.changeLanguage(user.language) called                  │
│    → All t("key") calls immediately re-render in new language   │
│                                                                 │
│  User changes language (Profile page or Onboarding step 7)     │
│    → i18n.changeLanguage(newLang)                               │
│    → PATCH /api/auth/me { language: newLang } persists to DB   │
│    → localStorage updated as offline fallback                   │
│                                                                 │
│  Offline mode                                                   │
│    → Translation JSON files are pre-cached by Workbox           │
│    → localStorage language preference used                      │
│    → t() calls continue to work with zero network access       │
└─────────────────────────────────────────────────────────────────┘
```

**Key design decisions:**
- Backend error messages are translated server-side; frontend renders `error.response.data.error` directly without passing through `t()`.
- The frontend JSON files are the authoritative source for all UI strings. The backend JSON files cover only API error/validation messages.
- No enum constraint at the DB level — validation is enforced in the backend route (`"en"` or `"pt-BR"` only).

---

## Definition of Done Checklist

Copied from `SPRINT-03-OVERVIEW.md` and marked against what was delivered.

| # | Item | Status |
|---|------|--------|
| 1 | `User.language` field in Prisma schema + migration applied | ✅ |
| 2 | `GET /api/auth/me` returns `language` | ✅ |
| 3 | `PATCH /api/auth/me` accepts and saves `language` | ✅ |
| 4 | All backend error messages exist in `en.json` and `pt-BR.json` | ✅ |
| 5 | `Accept-Language` header honored for unauthenticated errors | ✅ |
| 6 | `client/src/i18n/en.json` covers 100% of UI strings | ✅ |
| 7 | `client/src/i18n/pt-BR.json` covers 100% of UI strings | ✅ |
| 8 | Language selector in Profile page and Onboarding (step 7 or injected) | ✅ |
| 9 | Language persisted server-side on change | ✅ |
| 10 | Language loaded from server on auth and applied to i18next | ✅ |
| 11 | No hardcoded English strings remain in any `.jsx` component | ✅ |
| 12 | PWA offline mode works with cached translations | ✅ |

All 12 Definition of Done items were met. No items required a waiver.

---

## Known Deviations and Notes

- **No enum in DB.** The `language` column is `TEXT NOT NULL DEFAULT 'en'` rather than a
  PostgreSQL enum. This was a deliberate choice by the DB agent to simplify future language
  additions without requiring additional migrations. Validation is enforced at the API layer.

- **Server-side translation is display-only.** Backend error messages are translated and sent
  as plain strings in the `error` field of the response body. The frontend does not re-translate
  these strings through i18next; it renders them as-is. This means backend error copy is not
  subject to frontend translation key diffing.

- **Migration naming discrepancy.** The spec in `SPEC-DB.md` originally targeted a migration
  named `20260331000000_add_user_language`. The git status snapshot also references a later
  migration file `20260401000000_add_oauth_codes` — that file is unrelated to Sprint 3 and
  belongs to a future sprint.

- **Onboarding language step.** The spec described language selection as "step 7 or injected."
  The frontend agent implemented it as a dedicated step within the existing onboarding flow,
  consistent with the existing step numbering pattern.

- **`pt-BR` key coverage.** Both `client/src/i18n/pt-BR.json` and `server/src/i18n/pt-BR.json`
  were authored in full parity with their `en.json` counterparts. No keys are missing.

---

## How to Run and Test

### Prerequisites

- PostgreSQL running and `DATABASE_URL` set in `server/.env`
- Redis running (required by Fastify session middleware)
- `npx prisma migrate dev` applied in `/server/` — confirms `User.language` column exists
- `npx prisma generate` run in `/server/` — confirms Prisma client is up to date

### Start the stack

```bash
# Terminal 1 — backend
cd server
npm run dev

# Terminal 2 — frontend
cd client
npm run dev
```

### Manual verification checklist

1. **Language stored in DB**
   - Register a new user via the app.
   - Run `SELECT id, email, language FROM "User" ORDER BY id DESC LIMIT 1;` in psql.
   - Confirm `language = 'en'` (default).

2. **API returns language**
   - Log in; open DevTools > Network.
   - Find the `GET /api/auth/me` response.
   - Confirm `data.language` is present in the JSON body.

3. **Language change persists**
   - Open Profile > Language section.
   - Switch to "Portugues (Brasil)".
   - Confirm UI immediately re-renders in Portuguese.
   - Hard-refresh the page; confirm Portuguese is restored.
   - Run the psql query above; confirm `language = 'pt-BR'`.

4. **Onboarding language step**
   - Log out; create a new account.
   - Step through onboarding to step 7.
   - Select a language; confirm the step UI text reflects the selection.

5. **Backend errors are translated**
   - Attempt login with wrong password.
   - Confirm the error toast shows the string from `server/src/i18n/en.json` (`auth.invalid_credentials`).
   - Repeat with `Accept-Language: pt-BR` via a curl call; confirm Portuguese error is returned.

   ```bash
   curl -s -X POST http://localhost:3001/api/auth/login \
     -H "Content-Type: application/json" \
     -H "Accept-Language: pt-BR" \
     -d '{"email":"test@example.com","password":"wrongpassword"}' | jq .
   ```

6. **Offline mode**
   - Open DevTools > Application > Service Workers; confirm the SW is active.
   - DevTools > Network > set to Offline.
   - Reload the app.
   - Confirm all UI strings render (not blank) — translations are served from cache.
   - Switch back to Online; confirm sync resumes.

7. **No hardcoded strings**
   - Run a codebase search for any `"en"` string literals or raw English phrases inside `.jsx` files under `client/src/`.
   - Confirm all results are i18n key lookups or non-UI code (config, IDs, etc.).
