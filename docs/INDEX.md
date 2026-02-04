# Documentation Remember

> Guide de lecture pour nouveaux agents Claude.

---

## Pour commencer (5 min)

| # | Fichier | Description |
|---|---------|-------------|
| 1 | `../CLAUDE.md` | Setup projet, tunnels, commandes |
| 2 | `remember-product-brief.md` | Vision business, personas, proposition de valeur |

---

## Architecture & Backend

| # | Fichier | Description |
|---|---------|-------------|
| 3 | `remember-architecture.md` | Design système complet (workers, API, data models) |
| 4 | `remember-current-state.md` | **État RÉEL** de l'implémentation (endpoints, plateformes) |

---

## iOS App

| # | Fichier | Description |
|---|---------|-------------|
| 5 | `ios-app-architecture.md` | Intégration backend iOS, deep links |
| 6 | `DESIGN_SYSTEM.md` | Design tokens (couleurs, spacing, typography) |
| 7 | `ios-user-journey.mermaid.md` | User flows iOS (diagrammes) |
| 8 | `ios-ux-audit.md` | Issues UX connues et recommandations |

---

## UX & Product

| # | Fichier | Description |
|---|---------|-------------|
| 9 | `remember-prd.md` | Product Requirements Document |
| 10 | `remember-ux-design.md` | Screens, flows, wireframes, design system + diagrammes Mermaid |

---

## Archive (référence historique)

Ces fichiers sont conservés pour contexte mais ne sont plus maintenus :

```
docs/archive/
├── discovery/
│   ├── remember-brainstorm.md       # Idées initiales
│   └── remember-competitive-research.md  # Analyse concurrence
├── decisions/
│   └── remember-api-alternatives.md  # Choix techniques (YouTube, Spotify APIs)
└── roadmap/
    ├── feature-content-curation.md   # Feature prévue non implémentée
    └── remember-future-scraping-strategy.md  # Plans futurs scraping
```

---

## Quick Reference

### Stack
- **Backend:** Node.js + Express + Prisma + PostgreSQL (Supabase)
- **Frontend:** React 19 + Vite + Tailwind + Zustand
- **iOS:** Expo + React Native + expo-router
- **LLM:** Mistral (quiz) + Groq Whisper (transcription)

### Plateformes supportées
| Plateforme | Auth | Statut |
|------------|------|--------|
| YouTube | OAuth 2.0 | ✅ Stable |
| Spotify | OAuth 2.0 | ✅ Stable |
| TikTok | Cookies (Playwright) | ✅ Working |
| Instagram | Cookies (Playwright) | ✅ Working |

### Linear Tracking
- **Web App:** Issues REM-1 à REM-50
- **iOS App:** Issues REM-51 à REM-122 (Epics 1-6)

---

*Dernière mise à jour: 2026-02-03*
