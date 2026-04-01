# Handoff: Backend Agent → Frontend Agent

**Gate:** GATE 2  
**Status:** TEMPLATE — to be filled by scribe-agent when `BACKEND_GATE_OPEN` is detected  
**Filled by:** scribe-agent  
**Read by:** frontend-agent before starting Task #4

---

> IMPORTANT: Do not begin frontend work until the backend agent has written the `BACKEND_GATE_OPEN`
> gate signal file. Verify with:
> ```bash
> cat fittrack-specs/sprint-03-i18n/BACKEND_GATE_OPEN
> ```

---

## Summary

On 2026-03-31 the backend agent completed Task #3 in full. Three new files were created: `server/src/i18n/en.json`, `server/src/i18n/pt-BR.json`, and `server/src/i18n/index.js`. The auth route file (`server/src/routes/auth.js`) was updated so that every error response is translated via the `t()` helper and both `GET /api/auth/me` and `PATCH /api/auth/me` expose and accept the `language` field. No deviations from `SPEC-BACKEND.md` were observed.

---

## API Contract Changes

### GET /api/auth/me

The user object returned by this endpoint now includes the `language` field.

**Response shape (confirmed):**

The response envelope is `{ success: true, data: { ... } }`. The `data` object contains:

```json
{
  "id": "...",
  "email": "user@example.com",
  "name": "Jane Doe",
  "isAdmin": false,
  "createdAt": "2026-03-31T00:00:00.000Z",
  "onboarded": true,
  "sex": "unspecified",
  "heightCm": 175,
  "heightUnit": "cm",
  "language": "en"
}
```

**Note:** The template above listed `weightUnit` in the shape — this field is NOT selected by the backend (`auth.js` line 202). The actual selected fields are `id`, `email`, `name`, `isAdmin`, `createdAt`, `onboarded`, `sex`, `heightCm`, `heightUnit`, and `language`. There is no `weightUnit` key in this response.

### PATCH /api/auth/me

This endpoint now accepts a `language` field.

**Request body:**

```json
{
  "language": "pt-BR"
}
```

**Validation (confirmed):**

- `language` is an optional field. Omitting it entirely is valid (other fields are updated).
- If `language` is present, it must be exactly `"en"` or `"pt-BR"`. Any other value returns `400 Bad Request`.
- Validation is applied in application code (not JSON Schema) — the schema only constrains `language` to `{ type: 'string' }`. The enum check runs inside the handler.
- All other accepted fields: `name` (string 1–100), `sex` (enum: `male`/`female`/`unspecified`), `heightCm` (number 50–275), `heightUnit` (enum: `cm`/`ft`), `onboarded` (boolean). `additionalProperties: false` — unknown keys are rejected by JSON Schema (Fastify 400).

**Success response (confirmed):** Updated user object wrapped in `{ success: true, data: { ... } }`, identical shape to GET above.

**Error response — invalid language (confirmed):**

```json
{
  "success": false,
  "error": "Language must be 'en' or 'pt-BR'."
}
```

The error message is translated via `t(lang, 'validation.invalid_language')`. The resolved language for the error itself is determined by `resolveLanguage(req)` (see below).

---

## New Endpoints

No new endpoints were added. The language feature is exposed entirely through the existing `GET /api/auth/me` and `PATCH /api/auth/me` endpoints.

---

## Translation Key Reference

### Backend translation keys (`server/src/i18n/en.json`)

Backend error messages are returned under the `error` key in JSON responses.
The frontend does NOT need to translate backend error messages — they are already returned
in the user's language based on `resolveLanguage` (see below).

The complete set of keys in `en.json` is:

**`auth` namespace**

| Key | English value |
|-----|---------------|
| `auth.invalid_credentials` | Invalid email or password. |
| `auth.email_taken` | An account with this email already exists. |
| `auth.not_found` | User not found. |
| `auth.unauthorized` | You must be logged in. |
| `auth.forbidden` | You do not have permission to perform this action. |
| `auth.token_expired` | Your session has expired. Please log in again. |
| `auth.token_invalid` | Invalid token. |
| `auth.refresh_required` | Please log in again. |
| `auth.session_expired` | Session expired. Please log in again. |
| `auth.no_refresh_token` | No refresh token provided. |
| `auth.registration_failed` | Registration failed. Please try again. |
| `auth.login_failed` | Login failed. Please try again. |
| `auth.token_refresh_failed` | Token refresh failed. |
| `auth.fetch_user_failed` | Failed to fetch user. |
| `auth.update_profile_failed` | Failed to update profile. |

**`validation` namespace**

| Key | English value |
|-----|---------------|
| `validation.email_required` | Email is required. |
| `validation.password_required` | Password is required. |
| `validation.name_required` | Name is required. |
| `validation.password_too_short` | Password must be at least 8 characters. |
| `validation.invalid_language` | Language must be 'en' or 'pt-BR'. |

**`workouts` namespace**

| Key | English value |
|-----|---------------|
| `workouts.plan_not_found` | Workout plan not found. |
| `workouts.session_not_found` | Session not found. |
| `workouts.exercise_not_found` | Exercise not found. |
| `workouts.invalid_plan_id` | Invalid plan ID. |
| `workouts.fetch_plans_failed` | Failed to fetch plans. |
| `workouts.create_plan_failed` | Failed to create plan. |
| `workouts.update_plan_failed` | Failed to update plan. |
| `workouts.delete_plan_failed` | Failed to delete plan. |
| `workouts.fetch_sessions_failed` | Failed to fetch sessions. |
| `workouts.save_session_failed` | Failed to save session. |

**`progress` namespace**

| Key | English value |
|-----|---------------|
| `progress.goal_not_found` | Goal not found. |
| `progress.weight_not_found` | Weight entry not found. |
| `progress.entry_not_found` | Entry not found. |
| `progress.fetch_weight_failed` | Failed to fetch weight entries. |
| `progress.log_weight_failed` | Failed to log weight. |
| `progress.delete_entry_failed` | Failed to delete entry. |
| `progress.fetch_goals_failed` | Failed to fetch goals. |
| `progress.create_goal_failed` | Failed to create goal. |
| `progress.update_goal_failed` | Failed to update goal. |

**`server` namespace**

| Key | English value |
|-----|---------------|
| `server.internal_error` | An internal server error occurred. |
| `server.not_found` | The requested resource was not found. |

Total: 34 keys across 5 namespaces.

### How `resolveLanguage` works

`resolveLanguage(request)` is exported from `server/src/i18n/index.js`. It is called at the top of every route handler to determine which language to use for error messages in that request. Priority order:

1. **`request.user.language`** — if the JWT has been verified and `request.user` is populated (authenticated routes), the user's saved language preference is used.
2. **`Accept-Language` header** — for unauthenticated requests (login, register, refresh), the header is inspected. If it starts with `"pt"` (matching `pt`, `pt-BR`, `pt-PT`, etc.), `"pt-BR"` is returned.
3. **`"en"`** — hard fallback if neither of the above resolves a language.

This means unauthenticated errors (e.g. wrong password on login) are language-matched via the browser header, while authenticated errors always use the user's persisted preference.

### Frontend translation keys

The frontend is responsible only for UI strings. The full key map is defined in
`SPEC-FRONTEND.md`. Core namespaces:

| Namespace    | Coverage                                                  |
|--------------|-----------------------------------------------------------|
| `nav`        | Bottom navigation labels                                  |
| `auth`       | Login, registration, logout UI                            |
| `onboarding` | All onboarding step labels and button text                |
| `dashboard`  | Greeting variants, streak, start workout                  |
| `exercises`  | Library title, search, filter labels                      |
| `planner`    | Weekly planner UI                                         |
| `workout`    | Active workout session UI                                 |
| `progress`   | Progress page labels and chart captions                   |
| `profile`    | Profile and settings page                                 |
| `goals`      | Goal type labels (supports interpolation)                 |
| `common`     | Shared strings: cancel, delete, loading, error, units     |

Full key definitions are in `SPEC-FRONTEND.md` Section 3 (Translation Files).

---

## What Frontend Must Know

### Language Resolution Order

The language to display is determined in this priority order:

1. `user.language` from `GET /api/auth/me` (authoritative — server-persisted)
2. `localStorage.getItem('ft_language')` (fallback before auth resolves)
3. `"en"` (hard fallback)

The `useLanguage` hook and `AuthContext` must implement this resolution order exactly.

### Language Persistence

When the user changes their language (via Profile page or Onboarding step):

1. Call `i18n.changeLanguage(lang)` immediately — UI updates in real time
2. Set `localStorage.setItem('ft_language', lang)` — survives page reload
3. Call `PATCH /api/auth/me { language: lang }` — persists across devices

Failure to persist to the server should be handled gracefully (silent retry or toast
notification) — do not block the UI language switch on network availability.

### Backend Error Messages

Backend errors are already translated server-side. The frontend should display
`error.response.data.error` directly without passing it through `t()`.

### PWA / Offline

Translation files are bundled into the Vite build output and cached by the Workbox
service worker automatically. No additional service worker configuration is needed.
Language switching while offline will work for UI strings. The `PATCH /api/auth/me`
call will fail silently — the localStorage value ensures the correct language is
shown on next load.

### i18next Interpolation

Some translation keys use interpolation syntax. Example:

```json
"frequency": "Work out {{count}} times per week"
```

Use the second argument to `t()`:

```jsx
t('goals.frequency', { count: 3 })
// → "Work out 3 times per week"
```

---

## Deviations from Spec

- The `GET /api/auth/me` response does not include `weightUnit`. The `select` clause in `auth.js` omits it. If the frontend needs `weightUnit`, it should be accounted for in a future patch or the field should be added to the select. All other specced fields are present.
- The PATCH JSON Schema marks `language` as `{ type: 'string' }` only (no enum constraint at the schema level). The allowed-values check (`"en"` or `"pt-BR"`) is enforced in application logic inside the handler. This is functionally equivalent to an enum constraint but produces a translated error message instead of a raw Fastify schema validation error.

---

_Last updated: 2026-03-31 by scribe-agent (Gate 2 opened — backend Task #3 complete)_
