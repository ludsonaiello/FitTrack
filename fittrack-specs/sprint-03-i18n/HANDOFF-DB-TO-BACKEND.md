# Handoff: DB Agent → Backend Agent

**Gate:** GATE 1  
**Status:** OPEN — DB agent completed Task #2 on 2026-03-31  
**Filled by:** scribe-agent  
**Read by:** backend-agent before starting Task #3

---

> Gate signal confirmed. `DB_GATE_OPEN` exists. Backend agent may proceed.

---

## Summary

The DB agent completed Task #2 on 2026-03-31. The `User` model in Prisma schema now has a
`language` field (`String @default("en")`). The migration SQL file was created at the
path specified in the spec and the field is confirmed present in `schema.prisma`.
No deviations from spec were observed.

---

## Files Changed

| File | Change |
|------|--------|
| `server/prisma/schema.prisma` | Added `language String @default("en")` to `User` model after `heightUnit` |
| `server/prisma/migrations/20260331000000_add_user_language/migration.sql` | New migration file created |

---

## Prisma Schema Excerpt

```prisma
model User {
  // ...
  sex            String?         // "male" | "female" | "unspecified"
  heightCm       Float?
  heightUnit     String          @default("cm")
  language       String          @default("en")   // ← added by DB agent
  createdAt      DateTime        @default(now())
  updatedAt      DateTime        @updatedAt
  // ...
}
```

---

## What Backend Must Know

### The `language` field

- Field name: `language`
- Type: `String`
- Default: `"en"`
- Valid values: `"en"` | `"pt-BR"` — enforced at the application layer only, not the DB layer
- The database column is `TEXT NOT NULL DEFAULT 'en'`; the DB will accept any string value,
  so the backend route handler must validate the allowed values explicitly

### Prisma Client

- The `language` field is now present on all `User` objects returned by Prisma
- If the Prisma client was not regenerated after migration, run:
  ```bash
  cd /server && npx prisma generate
  ```
- No additional Prisma model changes are needed — `language` is available automatically

### Migration Status

- Migration SQL file created: `20260331000000_add_user_language/migration.sql`
- Content: `ALTER TABLE "User" ADD COLUMN "language" TEXT NOT NULL DEFAULT 'en';`
- Apply to dev database if not already done:
  ```bash
  cd /server && npx prisma migrate dev
  ```

---

## Migration Path

If the backend agent needs to apply the migration manually:

```bash
cd /server
npx prisma migrate dev --name add_user_language
```

If the migration file already exists and was applied, skip the above. To mark an existing
migration as already applied without re-running:

```bash
cd /server
npx prisma migrate resolve --applied 20260331000000_add_user_language
```

---

## Deviations from Spec

None. The DB agent followed `SPEC-DB.md` exactly. Field placement, default value, migration
filename, and SQL content all match the specification.

---

_Last updated: 2026-03-31 by scribe-agent (filled when Gate 1 opened)_
