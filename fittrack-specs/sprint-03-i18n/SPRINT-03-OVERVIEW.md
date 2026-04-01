# Sprint 3 — Internationalization (i18n)
**Status:** **Complete**  
**Date:** 2026-03-31  
**Goal:** Make FitTrack fully multi-lingual with `pt-BR` and `en` as initial languages.

---

## Summary

All user-facing text (UI labels, error messages, notifications) must be driven by a JSON translation file. The selected language is stored per-user (server + localStorage fallback) and applied globally on app load. No hardcoded strings in components after this sprint.

---

## Languages Supported

| Code    | Name               | Flag |
|---------|--------------------|------|
| `en`    | English            | 🇺🇸   |
| `pt-BR` | Portuguese (Brazil)| 🇧🇷   |

---

## Architecture

```
User selects language
       │
       ▼
PATCH /api/auth/me { language: "pt-BR" }   ← Backend saves to DB
       │
       ▼
User.language persisted in PostgreSQL       ← Database field
       │
       ▼
On login: GET /api/auth/me returns language
       │
       ▼
i18next instance switched to user.language  ← Frontend applies
       │
       ▼
All t("key") calls render correct string    ← All UI components
```

---

## Task Breakdown

| Task ID | Owner    | Subject                                    | Status  | Gate     |
|---------|----------|--------------------------------------------|---------|----------|
| #1      | Scribe   | Generate + maintain sprint documentation   | ✅ Done  | —        |
| #2      | DB       | Add language field + Prisma migration      | ✅ Done  | GATE 1   |
| #3      | Backend  | i18n API layer + translated error messages | ✅ Done  | GATE 2 ← unblocked after #2 |
| #4      | Frontend | react-i18next + translate all UI strings   | ✅ Done  | — ← unblocked after #3 |

---

## Gate Rules

- **GATE 1 (DB → Backend):** Backend agent MUST NOT start until DB agent marks Task #2 complete and the migration file exists.
- **GATE 2 (Backend → Frontend):** Frontend agent MUST NOT start until Backend agent marks Task #3 complete, `BACKEND_GATE_OPEN` file exists in `fittrack-specs/sprint-03-i18n/`, and the i18n API endpoints are confirmed working.

---

## Definition of Done

- [ ] `User.language` field in Prisma schema + migration applied
- [ ] `GET /api/auth/me` returns `language`
- [ ] `PATCH /api/auth/me` accepts and saves `language`
- [ ] All backend error messages exist in `en.json` and `pt-BR.json`
- [ ] `Accept-Language` header honored for unauthenticated errors
- [ ] `client/src/i18n/en.json` covers 100% of UI strings
- [ ] `client/src/i18n/pt-BR.json` covers 100% of UI strings
- [ ] Language selector in Profile page and Onboarding (step 7 or injected)
- [ ] Language persisted server-side on change
- [ ] Language loaded from server on auth and applied to i18next
- [ ] No hardcoded English strings remain in any `.jsx` component
- [ ] PWA offline mode works with cached translations
