# Ankora - Context pour Claude Code

**Projet:** Ankora (Remember v2)
**Type:** Refonte frontend iOS avec Expo
**Date:** 2026-02-04
**Version:** 2.0

---

## Résumé du Projet

**Ankora** est une refonte complète du frontend iOS de l'app Remember. Le backend existe et fonctionne - on ne le touche PAS. On crée uniquement le frontend mobile avec Expo.

### Concept
L'utilisateur connecte ses plateformes (YouTube, Spotify, TikTok, Instagram). Ses vidéos likées et podcasts écoutés arrivent automatiquement. Il **trie** ce qu'il veut apprendre, l'app génère des **quiz** et des **mémos**, et il révise à son rythme.

---

## Architecture : 4 Tabs

| Tab | Nom | Contenu |
|-----|-----|---------|
| 1 | **Feed** | Grille de Topics + Suggestions (vidéos READY non révisées) |
| 2 | **Bibliothèque** | "Ma collection" + "À trier" (avec badge). Filtres : source, topic, état |
| 3 | **Révisions** | Historique des quiz faits (récent → ancien) |
| 4 | **Profile** | Infos compte, connexions OAuth, paramètres |

### Écrans secondaires
- **Détail contenu** : Miniature, topics, description, boutons quiz/mémo
- **Session quiz** : Questions → feedback → résumé → lien mémo
- **Fiche mémo** : Points clés à retenir (généré par IA)
- **Login** : Simple page de connexion (email/password)

---

## Décisions Produit V1

### Ce qu'on fait
- Quiz simple : bonne/mauvaise réponse, feedback immédiat
- SM-2 invisible (tourne en backend, pas de rating manuel)
- Triage explicite : "Apprendre" / "Ignorer"
- Topics modifiables par l'utilisateur

### Ce qu'on ne fait PAS (V1)
- Stats détaillées
- Streak / flammes / badges
- Recherche
- Notifications push
- Dark mode
- Recommandations intelligentes

---

## Stack Technique

| Composant | Technologie |
|-----------|-------------|
| Framework | Expo SDK 54 |
| Navigation | expo-router (file-based) |
| State | Zustand |
| Data Fetching | TanStack Query |
| Storage | expo-secure-store (tokens JWT) |
| HTTP | Axios |
| WebView Auth | react-native-webview + CookieManager |

---

## Contraintes Absolues

### NE PAS TOUCHER
- `backend/` - stable et fonctionnel
- Workers (sync YouTube, Spotify, TikTok, Instagram)
- Services de transcription (yt-dlp, Whisper)
- Génération de quiz (Mistral)
- OAuth flows backend

### FOCUS UNIQUEMENT
- Code frontend iOS dans `Ankora/`
- Consommation de l'API backend existante

---

## Principes de Code

1. **Un fichier = un écran** (max 150-200 lignes)
2. **Pas de libs UI externes** (pas NativeBase, Tamagui, etc.)
3. **Design minimaliste** : noir, blanc, gris + 1 couleur accent
4. **Code lisible > code clever**
5. **Tester sur Expo Go** avant de passer à l'écran suivant

---

## API Backend (Endpoints clés)

### Auth
```
POST /api/auth/login     → { accessToken, refreshToken, user }
POST /api/auth/refresh   → { accessToken, refreshToken }
GET  /api/auth/me        → { user }
```

### OAuth
```
GET  /api/oauth/status   → { youtube, spotify, tiktok, instagram }
```
Chaque plateforme retourne un **objet** (si connectée) ou `null`.

### Content
```
GET  /api/content              → { items[], total, hasMore }
GET  /api/content/inbox        → Items avec status INBOX
GET  /api/content/inbox/count  → { count } (pour badge)
POST /api/content/triage/bulk  → { contentIds[], action: "learn"|"archive" }
GET  /api/content/tags         → Liste des topics
```

### Reviews (Quiz)
```
GET  /api/reviews/due    → { cards[] }
POST /api/reviews        → { cardId, rating, responseTime }
```

### Test Account
```
Email: test@remember.app
Password: testpassword123
```

---

## Documents de Référence

| Fichier | Contenu |
|---------|---------|
| `README.md` | **Vision produit complète** - Détail de tous les écrans avec wireframes ASCII |
| `BACKEND-API.md` | Endpoints API détaillés, modèles Prisma |
| `IOS-INTEGRATION.md` | OAuth flows, WebView auth, deep links |

---

## MCP Servers Disponibles

| MCP | Usage |
|-----|-------|
| `expo-docs` | Docs Expo SDK 54 offline (~3ms) |
| `linear-server` | Tracking issues |
| `context7` | Docs générales (React Query, Zustand, etc.) |

---

## Workflow BMAD

### Prochaine étape
Lancer `/bmad-bmm-create-architecture` pour créer l'architecture technique :
- Structure des dossiers Expo
- Stores Zustand
- Hooks React Query
- Design tokens
- Patterns à suivre

### Après l'architecture
1. `/bmad-bmm-create-epics-and-stories` → User stories
2. `/bmad-bmm-dev-story` → Implémentation

---

## Git

**Branch:** Créer `feature/ankora-v2` avant de coder
**Repo:** https://github.com/fysnerd/Remember (privé)

```bash
git checkout -b feature/ankora-v2
```

---

*Mis à jour: 2026-02-04 - Vision produit clarifiée*
