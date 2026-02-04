# Ankora (Remember v2)

> Refonte complète de l'app iOS Remember avec une architecture simplifiée.

**Date:** 2026-02-04
**Version:** 2.0

---

## Objectif

Reprendre l'app iOS **from scratch** en gardant :
- Le backend existant (API, workers, auth)
- Les intégrations OAuth (YouTube, Spotify, TikTok, Instagram)

Et en changeant :
- L'architecture des écrans (4 tabs clairs)
- Le code plus propre et maintenable
- UX simplifiée et intuitive

---

## Vision Produit

### Concept

L'utilisateur connecte ses plateformes (YouTube, Spotify, TikTok, Instagram). Ses vidéos likées et podcasts écoutés arrivent automatiquement dans l'app. Il **trie** ce qu'il veut apprendre, l'app génère des **quiz** et des **mémos**, et il peut réviser à son rythme.

### Flow utilisateur

```
Connexion plateformes (Profile)
        ↓
Contenu importé automatiquement (INBOX)
        ↓
Triage par l'utilisateur (Bibliothèque > À trier)
   ├→ "Apprendre" → Quiz générés → READY
   └→ "Ignorer" → ARCHIVED
        ↓
Révision des quiz (Tab Révision)
        ↓
Consultation des mémos (Détail contenu)
```

---

## Architecture : 4 Tabs

```
┌─────────────────────────────────────────────────────────────┐
│                         ANKORA                               │
├─────────────┬─────────────┬─────────────┬───────────────────┤
│    Feed     │ Bibliothèque│  Révisions  │     Profile       │
├─────────────┼─────────────┼─────────────┼───────────────────┤
│  Topics     │ Ma collection│ Historique │ Connexions OAuth  │
│  (grille)   │ + À trier   │ des quiz   │ Paramètres        │
│  +          │ (avec badge)│ faits      │ Infos compte      │
│  Suggestions│             │            │                    │
└─────────────┴─────────────┴─────────────┴───────────────────┘
```

---

## Détail des Écrans

### Tab 1: Feed (Accueil)

**Objectif :** Point d'entrée pour découvrir et parcourir les sujets.

```
┌─────────────────────────────┐
│         FEED                │
├─────────────────────────────┤
│  Topics (grille 2 colonnes) │
│  ┌─────┐ ┌─────┐           │
│  │ Tech│ │Santé│           │
│  └─────┘ └─────┘           │
│  ┌─────┐ ┌─────┐           │
│  │Philo│ │Sport│           │
│  └─────┘ └─────┘           │
├─────────────────────────────┤
│  Suggestions                │
│  (Vidéos READY non révisées)│
│  ┌───────────────────────┐ │
│  │ 🎬 How to learn faster │ │
│  │ 🎧 Deep Work Ep. 42    │ │
│  └───────────────────────┘ │
└─────────────────────────────┘
```

**Contenu :**
- **Topics** : Grille 2 colonnes des tags générés par l'IA
- **Suggestions** : Vidéos/podcasts READY, non encore révisés, les plus récents

**Actions :**
- Tap sur Topic → filtre la bibliothèque par ce topic
- Tap sur suggestion → ouvre le détail du contenu

---

### Tab 2: Bibliothèque

**Objectif :** Collection personnelle + triage du nouveau contenu.

```
┌─────────────────────────────────────────┐
│           BIBLIOTHÈQUE                  │
├─────────────────────────────────────────┤
│  [Ma collection]    [À trier 🔴 12]     │  ← Toggle avec badge
├─────────────────────────────────────────┤
│  Filtres: [Source ▼] [Topic ▼] [État ▼] │
├─────────────────────────────────────────┤
│  ┌─────┐ ┌─────┐ ┌─────┐               │
│  │ 🎬  │ │ 🎧  │ │ 🎬  │               │
│  │Vid 1│ │Pod 1│ │Vid 2│               │
│  └─────┘ └─────┘ └─────┘               │
│  ┌─────┐ ┌─────┐ ┌─────┐               │
│  │ ... │ │ ... │ │ ... │               │
│  └─────┘ └─────┘ └─────┘               │
└─────────────────────────────────────────┘
```

**Onglet "Ma collection" :**
- Grille de vignettes (tout le contenu READY)
- Filtres :
  - **Source** : YouTube, Spotify, TikTok, Instagram
  - **Topic** : Tags générés par l'IA
  - **État** : Déjà révisé / Jamais révisé
- Tap sur contenu → ouvre le détail

**Onglet "À trier" :**
- Contenu INBOX (importé mais pas encore trié)
- Badge avec le nombre d'items à trier
- Pour chaque item : boutons **[Apprendre]** / **[Ignorer]**
- Actions bulk possibles

**Gestion des Topics :**
- Renommer un topic
- Retirer un contenu d'un topic
- (Accessible depuis le détail d'un contenu ou via long-press)

---

### Tab 3: Révisions

**Objectif :** Historique des quiz faits et accès pour les refaire.

```
┌─────────────────────────────────────────┐
│           RÉVISIONS                     │
├─────────────────────────────────────────┤
│  Historique des quiz                    │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ 🎬 How to learn faster          │   │
│  │ Quiz fait le 03/02 • Score 4/5  │   │
│  │ [Voir mémo] [Refaire]           │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ 🎧 Deep Work Episode 42         │   │
│  │ Quiz fait le 02/02 • Score 3/5  │   │
│  └─────────────────────────────────┘   │
│                                         │
│  (Liste scrollable, récent → ancien)    │
└─────────────────────────────────────────┘
```

**Contenu :**
- Cartes horizontales des quiz déjà faits
- Triés du plus récent au plus ancien
- Affiche : titre, date, score

**Actions :**
- Tap → ouvre options : Voir mémo, Refaire quiz, Mini récap vidéo

---

### Tab 4: Profile

**Objectif :** Gestion du compte et des connexions plateformes.

```
┌─────────────────────────────────────────┐
│           PROFILE                       │
├─────────────────────────────────────────┤
│  ┌─────┐                               │
│  │ 👤  │  user@email.com               │
│  └─────┘  Plan: FREE                   │
├─────────────────────────────────────────┤
│  Plateformes connectées                 │
│                                         │
│  YouTube      [✓ Connecté]             │
│  Spotify      [✓ Connecté]             │
│  TikTok       [Connecter]              │
│  Instagram    [Connecter]              │
├─────────────────────────────────────────┤
│  Paramètres                             │
│  • Notifications                        │
│  • À propos                             │
│  • Déconnexion                          │
└─────────────────────────────────────────┘
```

**Contenu :**
- Infos compte (avatar, email, plan)
- Statut connexion de chaque plateforme
- Boutons pour connecter/déconnecter

**Note :** Pas de stats, streak ou badges pour la V1.

---

### Écran: Détail Contenu

**Accès :** Tap sur un contenu depuis Feed, Bibliothèque ou Révisions.

```
┌─────────────────────────────────────────┐
│  ← Retour                               │
├─────────────────────────────────────────┤
│  ┌─────────────────────────────────┐   │
│  │                                 │   │
│  │     Miniature grande            │   │
│  │                                 │   │
│  └─────────────────────────────────┘   │
│                                         │
│  How to Learn Anything                  │
│  🎬 YouTube • 12:34                     │
│                                         │
│  Topics: [Tech] [Productivité] [...]   │
│                                         │
│  Description de la vidéo lorem ipsum    │
│  dolor sit amet...                      │
│                                         │
├─────────────────────────────────────────┤
│  [    Faire le quiz    ]               │
│  [    Voir le mémo     ]               │
└─────────────────────────────────────────┘
```

**Contenu :**
- Miniature agrandie
- Titre, source, durée
- Topics/tags (modifiables)
- Description
- **PAS de transcript visible**

**Actions :**
- Faire le quiz → lance la session quiz
- Voir le mémo → affiche la fiche mémo

---

### Écran: Session Quiz

**Accès :** Bouton "Faire le quiz" depuis le détail contenu.

```
┌─────────────────────────────────────────┐
│  Question 3/5                    ✕ Quit │
├─────────────────────────────────────────┤
│                                         │
│  Quelle est la technique principale     │
│  pour améliorer la rétention ?          │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ A) Relire plusieurs fois        │   │
│  └─────────────────────────────────┘   │
│  ┌─────────────────────────────────┐   │
│  │ B) Répétition espacée ✓         │   │  ← Sélectionné
│  └─────────────────────────────────┘   │
│  ┌─────────────────────────────────┐   │
│  │ C) Surligner le texte           │   │
│  └─────────────────────────────────┘   │
│  ┌─────────────────────────────────┐   │
│  │ D) Écouter en accéléré          │   │
│  └─────────────────────────────────┘   │
│                                         │
│           [Valider]                     │
└─────────────────────────────────────────┘
```

**Flow :**
1. Question affichée avec options (A, B, C, D)
2. User sélectionne une réponse
3. User valide
4. Feedback immédiat : ✓ Correct / ✗ Incorrect + explication
5. Bouton "Question suivante"
6. À la fin : résumé de session (score X/Y)
7. Lien vers le mémo

**Note :** Le nombre de questions est géré par le backend. Pas de rating manuel (SM-2 invisible).

---

### Écran: Fiche Mémo

**Accès :** Depuis le détail contenu ou fin de quiz.

```
┌─────────────────────────────────────────┐
│  ← Retour                    📤 Partager│
├─────────────────────────────────────────┤
│  MÉMO                                   │
│  How to Learn Anything                  │
├─────────────────────────────────────────┤
│                                         │
│  📌 Points clés à retenir               │
│                                         │
│  • La répétition espacée améliore la    │
│    rétention de 200%                    │
│                                         │
│  • Tester ses connaissances est plus    │
│    efficace que relire                  │
│                                         │
│  • Le sommeil consolide la mémoire      │
│                                         │
│  • Espacer les sessions > tout faire    │
│    en une fois                          │
│                                         │
└─────────────────────────────────────────┘
```

**Contenu :**
- Points clés générés automatiquement par l'IA (backend)
- Format bullet points, facile à scanner

---

## Stack Technique

| Composant | Technologie |
|-----------|-------------|
| Framework | Expo SDK 54 |
| Navigation | expo-router (file-based) |
| State | Zustand |
| Data Fetching | TanStack Query |
| Storage | expo-secure-store (tokens) |
| HTTP | Axios |
| WebView Auth | react-native-webview + CookieManager |

---

## Principes de Code

1. **Un fichier = un écran** (max 150-200 lignes)
2. **Pas de libs UI externes** (pas NativeBase, Tamagui, etc.)
3. **Design minimaliste** : noir, blanc, gris + 1 couleur accent
4. **Code lisible > code clever**
5. **Tester sur Expo Go** avant de passer à l'écran suivant

---

## Ce qui est HORS SCOPE V1

- Stats détaillées
- Streak / flammes
- Badges / achievements
- Recherche
- Notifications push
- Dark mode
- Recommandations intelligentes par topic

---

## Backend (NE PAS TOUCHER)

Le backend est **stable et fonctionnel**. On consomme juste l'API.

```
Base URL: http://localhost:3001/api (dev)
         https://[tunnel].trycloudflare.com/api (OAuth callbacks)

Test User: test@remember.app / testpassword123
```

---

## Docs de Référence

| Fichier | Contenu |
|---------|---------|
| `PRODUCT-VISION.md` | Vision produit détaillée (ce document résumé) |
| `BACKEND-API.md` | Endpoints API, modèles Prisma, workers |
| `IOS-INTEGRATION.md` | OAuth flows, WebView auth, deep links |
| `CLAUDE.md` | Contexte pour Claude Code |

---

*Mis à jour: 2026-02-04*
