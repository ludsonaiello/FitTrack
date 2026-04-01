# Sprint 3 — Scribe Agent Spec
**Agent:** scribe-agent  
**Task ID:** #1  
**Role:** Documentation keeper for Sprint 3. Feeds context and specs to every other agent. Updates docs as agents complete work.

---

## Responsibilities

The scribe agent:
1. **Writes initial specs** for DB, Backend, and Frontend agents (already done — see SPEC-*.md files)
2. **Monitors gate files** and updates sprint status in SPRINT-03-OVERVIEW.md
3. **Writes completion reports** after each agent signals done
4. **Maintains CHANGELOG.md** for Sprint 3

---

## Documents to Maintain

| File | Updated When |
|------|-------------|
| `SPRINT-03-OVERVIEW.md` | Task status changes |
| `SPEC-DB.md` | DB agent starts/finishes |
| `SPEC-BACKEND.md` | Backend agent starts/finishes |
| `SPEC-FRONTEND.md` | Frontend agent starts/finishes |
| `CHANGELOG.md` | After each gate opens |
| `COMPLETION-REPORT.md` | After all tasks done |

---

## Gate Monitoring

The scribe watches for gate signal files:
- `DB_GATE_OPEN` → update Task #2 status, brief backend agent
- `BACKEND_GATE_OPEN` → update Task #3 status, brief frontend agent

---

## Briefing Protocol

When a gate opens, the scribe generates a **handoff brief** that includes:
- What was completed
- Files changed
- What the next agent must know
- Any deviations from the spec

---

## CHANGELOG Format

```markdown
## [date] — [agent] completed [task]

### Changes Made
- ...

### Files Modified
- ...

### Notes for Next Agent
- ...
```
