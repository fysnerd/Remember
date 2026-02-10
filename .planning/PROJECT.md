# Ankora

## What This Is

Ankora est une plateforme d'apprentissage actif qui transforme le contenu consommé sur les réseaux sociaux (YouTube, Spotify, TikTok, Instagram) en connaissances durables via des quiz générés par IA et la répétition espacée. L'app iOS permet de synchroniser, trier, et réviser son contenu.

## Core Value

L'utilisateur apprend durablement à partir de ce qu'il consomme déjà — sans effort supplémentaire de curation.

## Current Milestone: v2.0 Themes-first UX

**Goal:** Transformer la navigation de l'app d'une vue centrée contenu vers une vue centrée thèmes, avec quiz cross-contenu par thème.

**Target features:**
- Thèmes auto-générés par l'IA (couche au-dessus des tags existants)
- Home screen avec sections par thème + contenus récents
- Contenu multi-thème (un contenu peut appartenir à plusieurs thèmes)
- Gestion manuelle des thèmes (créer, modifier, supprimer, déplacer contenu)
- Quiz par thème : mix de questions existantes + nouvelles questions de synthèse cross-contenu

## Requirements

### Validated

<!-- Existing app capabilities — shipped and working -->

- ✓ Auth JWT (signup, login, refresh tokens) — pre-v1
- ✓ OAuth YouTube, Spotify + cookie-based TikTok, Instagram — pre-v1
- ✓ Content sync from 4 platforms (cron workers) — pre-v1
- ✓ Transcription pipeline (yt-dlp + Groq Whisper) — pre-v1
- ✓ Quiz generation per content (Mistral AI) — pre-v1
- ✓ Spaced repetition review (SM-2 algorithm) — pre-v1
- ✓ Auto-tagging with Mistral AI — pre-v1
- ✓ Content inbox + triage flow — pre-v1
- ✓ Structured logging (Pino) — v1.0
- ✓ Job execution tracking + AdminJS panel — v1.0
- ✓ Real-time observability dashboard — v1.0

### Active

<!-- v2.0 Themes-first UX — to be detailed in REQUIREMENTS.md -->

- [ ] Theme data model and auto-classification
- [ ] Theme management (CRUD + content assignment)
- [ ] Theme-based home screen navigation
- [ ] Theme-based quiz generation (mix + synthesis)

### Out of Scope

- Grafana/Prometheus/Datadog — custom dashboard sufficient
- Multi-admin with roles — solo dev
- Android app — iOS only for now
- Social features (sharing, leaderboards) — not the focus
- Theme collaboration (shared themes between users) — solo learning app

## Context

Backend: Node.js v22, Express.js, TypeScript, Prisma, PostgreSQL (Supabase), Pino, AdminJS v7. Runs on Hetzner CPX32 VPS with PM2 cluster mode and Caddy reverse proxy.

iOS app: Expo SDK 54, expo-router, Zustand, TanStack React Query, Axios.

Auto-tagging worker already generates tags via Mistral AI — themes will be a broader categorization layer derived from these tags.

Quiz generation currently works per-content — needs extension to support theme-level quiz mixing and cross-content synthesis questions.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Themes above tags (not replacing) | Tags provide detail, themes provide navigation. Reuse existing auto-tagging investment | — Pending |
| Multi-theme content | A video about "Python for finance" belongs in both Dev and Finance themes | — Pending |
| 100% auto-creation by AI | Lower friction than manual setup. User adjusts after | — Pending |
| Mix + synthesis quiz mode | Mix reuses existing questions, synthesis creates new cross-content understanding | — Pending |

## Constraints

- **Single VPS**: Backend + workers on one Hetzner CPX32
- **Supabase DB**: PostgreSQL via Prisma — schema changes via `prisma db push`
- **Expo SDK 54**: iOS app with OTA updates for JS changes
- **Mistral AI**: Used for both tagging and quiz gen — themes classification should use same provider
- **Existing tags**: Must coexist, themes derive from tags

---
*Last updated: 2026-02-10 after v2.0 milestone started*
