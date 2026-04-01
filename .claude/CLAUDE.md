# FitTrack PWA — Project Context

## Stack
- Frontend: React + Vite + Tailwind + Dexie.js (IndexedDB) + React Query
- Backend: Node.js + Fastify + Prisma + PostgreSQL + Redis
- PWA: vite-plugin-pwa (Workbox), offline-first

## Structure
- /client — React PWA frontend
- /server — Fastify API backend
- /server/prisma — database schema

## Key rules
- All workout logging is local-first (IndexedDB), syncs to server when online
- Exercise data lives in /client/src/lib/exercises.json (610 Planet Fitness tutorials)
- Use Barlow Condensed font, electric lime (#e8ff00) as accent color
- Never break the offline capability — test with DevTools > Network > Offline

## Current sprint: Sprint 2 (Exercise library + seeding)

For all UI work, treat `.claude/DESIGN_SYSTEM.md` as the absolute source of truth.