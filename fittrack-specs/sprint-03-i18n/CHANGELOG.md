# Sprint 3 — i18n Changelog

All notable changes to Sprint 3 are documented here in reverse-chronological order.
Each entry is written by the scribe-agent when a gate opens or a task completes.

---

## [2026-03-31] — Sprint 3 Launched (Scribe)

### Sprint Kickoff

Sprint 3 (Internationalization) officially started on 2026-03-31.
Goal: make FitTrack fully multi-lingual with `en` and `pt-BR` as the initial supported languages.

### Tasks Created

| Task | Owner    | Description                                    | Status  |
|------|----------|------------------------------------------------|---------|
| #1   | Scribe   | Generate and maintain sprint documentation     | Done    |
| #2   | DB       | Add `language` field + Prisma migration        | Pending |
| #3   | Backend  | i18n API layer + translated error messages     | Blocked |
| #4   | Frontend | react-i18next integration + translate all UI   | Blocked |

### Gate Rules Established

- **Gate 1 — DB to Backend:** Backend agent (#3) is blocked until DB agent (#2) marks Task #2
  complete and writes `DB_GATE_OPEN`. The migration file must exist at
  `server/prisma/migrations/20260331000000_add_user_language/migration.sql`.

- **Gate 2 — Backend to Frontend:** Frontend agent (#4) is blocked until Backend agent (#3)
  completes Task #3 and writes `BACKEND_GATE_OPEN`. The i18n API endpoints must be confirmed
  working before frontend work begins.

### Spec Files Written

- `SPEC-SCRIBE.md` — scribe responsibilities and changelog format
- `SPEC-DB.md` — schema change (`User.language`) and migration SQL
- `SPEC-BACKEND.md` — translation files, i18n helper, route updates
- `SPEC-FRONTEND.md` — react-i18next setup, translation JSON, component migration
- `SPRINT-03-OVERVIEW.md` — full task breakdown, architecture diagram, definition of done

### Notes

- Task #1 (Scribe) is complete. All initial documentation is in place.
- DB agent may begin work on Task #2 immediately — no gate blocks it.
- Backend and Frontend agents must wait for their respective gate signals.

---

## [2026-03-31] — DB Agent completed Task #2 (Gate 1 Open)

### Changes Made

- Added `language String @default("en")` field to the `User` model in `schema.prisma`
- Created Prisma migration file `20260331000000_add_user_language`
- Wrote `DB_GATE_OPEN` gate signal file — Backend agent is now unblocked

### Files Modified

- `server/prisma/schema.prisma` — `language` field added to `User` model after `heightUnit`
- `server/prisma/migrations/20260331000000_add_user_language/migration.sql` — new file

### Notes for Next Agent (Backend)

- The `language` field is `TEXT NOT NULL DEFAULT 'en'` at the DB level — no enum constraint
- Backend must validate that only `"en"` and `"pt-BR"` are accepted values
- Run `npx prisma generate` in `/server/` if the Prisma client has not been regenerated
- See `HANDOFF-DB-TO-BACKEND.md` for the full schema excerpt and migration path

---

## [2026-03-31] — Backend Agent completed Task #3 (Gate 2 Open)

### Changes Made

- Created `server/src/i18n/en.json` — English translation file covering all backend error message keys across `auth`, `validation`, `workouts`, `progress`, and `server` namespaces (34 keys total)
- Created `server/src/i18n/pt-BR.json` — Portuguese (Brazil) translations for all the same keys
- Created `server/src/i18n/index.js` — i18n helper module exporting `t(lang, key)` and `resolveLanguage(request)`
- Updated `server/src/routes/auth.js` — all error responses now use `t(lang, key)` for translated messages; `GET /api/auth/me` and `PATCH /api/auth/me` expose and accept the `language` field
- Wrote `BACKEND_GATE_OPEN` gate signal file — Frontend agent is now unblocked

### Files Modified / Created

- `server/src/i18n/en.json` — new file
- `server/src/i18n/pt-BR.json` — new file
- `server/src/i18n/index.js` — new file
- `server/src/routes/auth.js` — updated routes with i18n support and `language` field

### Gate 2 Status

Gate 2 is **OPEN**. `BACKEND_GATE_OPEN` has been written. Frontend agent may begin Task #4.

### Notes for Next Agent (Frontend)

- `GET /api/auth/me` returns `language` in the `data` object — use this as the authoritative language source on login/session restore
- `PATCH /api/auth/me { language: "pt-BR" }` persists the language — call after `i18n.changeLanguage()`
- Backend errors are pre-translated server-side; display `error.response.data.error` directly without passing through `t()`
- See `HANDOFF-BACKEND-TO-FRONTEND.md` for the full API contract, translation key list, and `resolveLanguage` details

---

## [2026-03-31] — Frontend Agent completed Task #4 (Sprint 3 Closed)

### Changes Made

- Installed and configured `react-i18next`; wired the i18n instance into `client/src/main.jsx` so translations are available before first render
- Created `client/src/i18n/en.json` — full English UI string catalog covering 12 namespaces: `nav`, `auth`, `onboarding`, `dashboard`, `exercises`, `planner`, `workout`, `progress`, `sessions`, `profile`, `goals`, `common`, and `sync` (373 lines, ~130 keys)
- Created `client/src/i18n/pt-BR.json` — full Portuguese (Brazil) mirror with 100% key parity
- Added language selection step (step 7) to the onboarding flow
- Added language selector section to the Profile page; calls `PATCH /api/auth/me` on change to persist preference server-side
- Migrated all user-facing strings in every `.jsx` component to `t("namespace.key")` — no hardcoded English strings remain
- On login/session restore, `GET /api/auth/me` response `language` field is used to call `i18n.changeLanguage()` so the correct language is applied immediately
- Translation JSON files are included in the Workbox precache manifest so the app works fully offline in both languages

### Files Modified / Created

- `client/src/i18n/en.json` — new file
- `client/src/i18n/pt-BR.json` — new file
- `client/src/i18n/index.js` — new file
- `client/src/main.jsx` — i18n import added
- `client/src/pages/AuthPage.jsx` — strings migrated
- `client/src/components/Onboarding.jsx` — language step added, strings migrated
- `client/src/components/Profile.jsx` — language selector added, strings migrated
- `client/src/pages/Dashboard.jsx` — strings migrated
- `client/src/pages/Exercises.jsx` — strings migrated
- `client/src/pages/ExerciseDetail.jsx` — strings migrated
- `client/src/pages/Planner.jsx` — strings migrated
- `client/src/pages/WorkoutSession.jsx` — strings migrated
- `client/src/pages/Progress.jsx` — strings migrated
- `client/src/pages/Sessions.jsx` — strings migrated
- `client/src/pages/SessionDetail.jsx` — strings migrated

### Sprint 3 Status

All four tasks complete. All 12 Definition of Done items met. Sprint 3 is **closed**.
See `COMPLETION-REPORT.md` for the full audit trail, architecture diagram, and manual test steps.

---

<!-- Future entries will be appended above this line by the scribe-agent -->
<!-- Format:
## [YYYY-MM-DD] — [Agent] completed Task #N

### Changes Made
- ...

### Files Modified
- ...

### Notes for Next Agent
- ...
-->
