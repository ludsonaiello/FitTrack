# Sprint 3 — Database Agent Spec
**Agent:** db-agent  
**Task ID:** #2  
**Gate:** GATE 1 — Backend is blocked until this task is complete.

---

## Objective

Add language preference support to the PostgreSQL database. The `User` model must store a `language` field so user language preferences persist across devices and sessions.

---

## Schema Change

**File:** `/server/prisma/schema.prisma`

Add the following field to the `User` model:

```prisma
language  String @default("en")
```

Place it after the `heightUnit` field and before `createdAt`.

**Valid values:** `"en"` | `"pt-BR"`

---

## Migration

Create a new migration file at:
```
/server/prisma/migrations/20260331000000_add_user_language/migration.sql
```

Migration SQL:
```sql
-- AlterTable
ALTER TABLE "User" ADD COLUMN "language" TEXT NOT NULL DEFAULT 'en';
```

---

## Validation Checklist

- [ ] `schema.prisma` — `User` model has `language String @default("en")`
- [ ] Migration SQL file created at correct path
- [ ] No other models need changes
- [ ] Schema is consistent (no duplicate fields, correct types)

---

## Gate Signal

After completing this task:
1. Mark Task #2 as **completed** in the task list
2. Write the file `fittrack-specs/sprint-03-i18n/DB_GATE_OPEN` with content: `DB migration complete. Backend may proceed.`
3. The backend agent reads this file before starting.
