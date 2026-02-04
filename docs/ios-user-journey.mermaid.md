# Remember iOS App - User Journey Map

> Document généré automatiquement à partir de l'analyse de la codebase et documentation.
> **Version:** 1.0 | **Date:** 2026-02-01

---

## 1. Vue d'ensemble - Architecture de Navigation

```mermaid
flowchart TB
    subgraph ROOT["📱 Root Layout"]
        direction TB
        AUTH_CHECK{{"🔐 Token JWT valide?"}}
    end

    subgraph AUTH["🔑 Auth Stack"]
        direction LR
        LOGIN["Login\n📧 Email + 🔒 Password"]
        SIGNUP["Signup\n📧 Email + 🔒 Password + 👤 Name"]
        LOGIN <--> SIGNUP
    end

    subgraph TABS["📑 Tab Navigation"]
        direction LR
        TAB_LEARN["📚 Apprendre\n(Home)"]
        TAB_STATS["📊 Stats"]
        TAB_SETTINGS["⚙️ Settings"]
    end

    subgraph MODALS["🪟 Modal Routes"]
        REVIEW["🎯 Review Session"]
        WEBVIEW["🌐 WebView OAuth"]
    end

    ROOT --> AUTH_CHECK
    AUTH_CHECK -->|Non| AUTH
    AUTH_CHECK -->|Oui| TABS
    AUTH -->|"Login Success"| TABS

    TABS --> MODALS
    TAB_LEARN -.->|"Start Review"| REVIEW
    TAB_SETTINGS -.->|"TikTok/Instagram"| WEBVIEW
```

---

## 2. Flux d'Authentification Complet

```mermaid
flowchart TD
    START((🚀 App Launch))

    subgraph BOOT["⚡ Bootstrap"]
        CHECK_TOKEN["checkAuth()\nVérifier SecureStore"]
        VALIDATE["Valider JWT\nGET /api/auth/me"]
    end

    subgraph LOGIN_FLOW["🔐 Login Flow"]
        LOGIN_FORM["Formulaire Login"]
        LOGIN_VALIDATE["Validation\n• Email format\n• Password min 8"]
        LOGIN_API["POST /api/auth/login"]
        LOGIN_ERROR["❌ Erreur\nAfficher message"]
        LOGIN_SUCCESS["✅ Success\nStorer tokens"]
    end

    subgraph SIGNUP_FLOW["📝 Signup Flow"]
        SIGNUP_FORM["Formulaire Signup"]
        SIGNUP_VALIDATE["Validation\n• Email unique\n• Password confirm"]
        SIGNUP_API["POST /api/auth/signup"]
        SIGNUP_ERROR["❌ Erreur\nEmail existe déjà"]
        SIGNUP_SUCCESS["✅ Success\nTrial 14j activé"]
    end

    subgraph TOKEN_MGMT["🎫 Token Management"]
        STORE_TOKENS["SecureStore\n• accessToken\n• refreshToken"]
        REFRESH_CHECK{{"Token expiré?"}}
        REFRESH_API["POST /api/auth/refresh"]
        LOGOUT["Logout\nClear tokens"]
    end

    MAIN((📱 Main App))

    START --> CHECK_TOKEN
    CHECK_TOKEN --> VALIDATE
    VALIDATE -->|Token invalide| LOGIN_FORM
    VALIDATE -->|Token valide| MAIN

    LOGIN_FORM --> LOGIN_VALIDATE
    LOGIN_VALIDATE -->|Invalide| LOGIN_FORM
    LOGIN_VALIDATE -->|Valide| LOGIN_API
    LOGIN_API -->|401/403| LOGIN_ERROR
    LOGIN_ERROR --> LOGIN_FORM
    LOGIN_API -->|200| LOGIN_SUCCESS
    LOGIN_SUCCESS --> STORE_TOKENS

    SIGNUP_FORM --> SIGNUP_VALIDATE
    SIGNUP_VALIDATE -->|Invalide| SIGNUP_FORM
    SIGNUP_VALIDATE -->|Valide| SIGNUP_API
    SIGNUP_API -->|400| SIGNUP_ERROR
    SIGNUP_ERROR --> SIGNUP_FORM
    SIGNUP_API -->|201| SIGNUP_SUCCESS
    SIGNUP_SUCCESS --> STORE_TOKENS

    STORE_TOKENS --> MAIN

    MAIN --> REFRESH_CHECK
    REFRESH_CHECK -->|Oui| REFRESH_API
    REFRESH_API -->|Success| STORE_TOKENS
    REFRESH_API -->|Fail| LOGOUT
    LOGOUT --> LOGIN_FORM
```

---

## 3. Connexion des Plateformes (OAuth)

```mermaid
flowchart TD
    SETTINGS["⚙️ Settings Page"]

    subgraph OAUTH_STANDARD["🔗 OAuth Standard"]
        direction TB
        YT_BTN["🔴 Connect YouTube"]
        SP_BTN["🟢 Connect Spotify"]

        YT_AUTH["expo-web-browser\nGoogle OAuth"]
        SP_AUTH["expo-web-browser\nSpotify OAuth"]

        CALLBACK["Deep Link Callback\nremember://oauth/callback"]
        TOKEN_EXCHANGE["Backend\nÉchange code → tokens"]
    end

    subgraph OAUTH_WEBVIEW["🍪 WebView + Cookies"]
        direction TB
        TT_BTN["⬛ Connect TikTok"]
        IG_BTN["🟣 Connect Instagram"]

        WEBVIEW_OPEN["Ouvrir WebView\nLogin natif"]
        COOKIE_INJECT["Injection JS\nExtraction cookies"]
        COOKIE_DETECT{{"Session détectée?"}}
        COOKIE_SEND["POST /api/oauth/{platform}/connect\nEnvoi cookies"]
    end

    subgraph SYNC["🔄 Synchronisation"]
        AUTO_SYNC["Cron Backend\n• YT: 15min\n• SP: 30min\n• TT/IG: manuel"]
        MANUAL_SYNC["Bouton Sync\nForce refresh"]
        CONTENT_IMPORT["Import Contenu\n→ Status: INBOX"]
    end

    CONNECTED["✅ Connecté\nAfficher status"]

    SETTINGS --> YT_BTN & SP_BTN & TT_BTN & IG_BTN

    YT_BTN --> YT_AUTH
    SP_BTN --> SP_AUTH
    YT_AUTH & SP_AUTH --> CALLBACK
    CALLBACK --> TOKEN_EXCHANGE
    TOKEN_EXCHANGE --> CONNECTED

    TT_BTN & IG_BTN --> WEBVIEW_OPEN
    WEBVIEW_OPEN --> COOKIE_INJECT
    COOKIE_INJECT --> COOKIE_DETECT
    COOKIE_DETECT -->|Non| WEBVIEW_OPEN
    COOKIE_DETECT -->|Oui| COOKIE_SEND
    COOKIE_SEND --> CONNECTED

    CONNECTED --> AUTO_SYNC
    CONNECTED --> MANUAL_SYNC
    AUTO_SYNC & MANUAL_SYNC --> CONTENT_IMPORT
```

---

## 4. Cycle de Vie du Contenu

```mermaid
flowchart LR
    subgraph IMPORT["📥 Import"]
        LIKE["👍 Like/Save\nsur plateforme"]
        SYNC["🔄 Worker Sync\nCron automatique"]
        INBOX["📬 INBOX\n🆕 'Nouveau'"]
    end

    subgraph TRIAGE["🗂️ Triage Utilisateur"]
        direction TB
        VIEW["Voir dans\nLearn Page"]
        DECIDE{{"Décision?"}}
        SELECT["✅ Sélectionner\n'Je veux apprendre'"]
        SKIP["❌ Passer\n'Pas intéressé'"]
    end

    subgraph PROCESSING["⚙️ Processing Backend"]
        direction TB
        TRANSCRIBE["📝 Transcription\n• yt-dlp (YT)\n• Whisper (Podcast)"]
        GENERATE["🤖 Quiz Generation\nMistral AI"]
        READY["✅ READY\n'X quiz'"]
        FAILED["❌ FAILED\nErreur"]
    end

    subgraph ARCHIVE["📦 Archives"]
        PASSED["🗃️ PASSÉ\nMasqué par défaut"]
        REACTIVATE["🔄 Réactiver\n→ Retour INBOX"]
    end

    LIKE --> SYNC --> INBOX
    INBOX --> VIEW --> DECIDE
    DECIDE -->|Apprendre| SELECT
    DECIDE -->|Ignorer| SKIP

    SELECT --> TRANSCRIBE
    TRANSCRIBE --> GENERATE
    GENERATE -->|Success| READY
    GENERATE -->|Error| FAILED

    SKIP --> PASSED
    PASSED -.->|"Filtrer Archives"| REACTIVATE
    REACTIVATE --> INBOX

    FAILED -.->|"Retry"| TRANSCRIBE
```

---

## 5. Parcours d'Apprentissage Principal

```mermaid
flowchart TD
    subgraph LEARN_PAGE["📚 Page Apprendre (Home)"]
        direction TB

        HEADER["🔥 Header Stats\n• Streak actuel\n• Cards dues\n• Inbox count"]

        FILTERS["🔍 Filtres\n• Plateformes\n• Tags/Thèmes\n• Actif vs Archives"]

        GRID["📦 Grille Contenu\n• Thumbnails\n• Badges status\n• Checkboxes"]

        SELECTION["☑️ Barre de Sélection\n• X sélectionnés\n• Y quiz prêts\n• Bouton Réviser"]
    end

    subgraph SESSION_BUILD["🎮 Session Builder"]
        direction TB
        CONFIG["Configuration\n• Limite questions\n• Filtres actifs"]
        PREVIEW["Aperçu\n'X cartes disponibles'"]
        LAUNCH["🚀 Lancer Session"]
    end

    subgraph REVIEW_SESSION["🎯 Review Session"]
        direction TB

        PROGRESS["📊 Progress Bar\n8/12 cartes"]

        QUESTION["❓ Question\n4 options (A-D)"]

        ANSWER_STATE{{"Réponse révélée?"}}

        SELECT_OPT["Sélectionner option\n(1-4 clavier)"]

        REVEAL["👁️ Voir Réponse\n(Space)"]

        FEEDBACK["✅/❌ Feedback\n+ Explication"]

        RATING["⭐ Rating SM-2\n• Again (1)\n• Hard (2)\n• Good (3)\n• Easy (4)"]

        NEXT_CARD["➡️ Carte suivante\nAuto-advance"]

        SESSION_END{{"Dernière carte?"}}
    end

    subgraph COMPLETE["🏆 Session Complete"]
        direction TB
        SUMMARY["📈 Résumé\n• Total cartes\n• % correct\n• Durée\n• Streak"]

        BREAKDOWN["📊 Breakdown\n• Again: X\n• Hard: X\n• Good: X\n• Easy: X"]

        ACTIONS["🎯 Actions\n• Générer Mémo IA\n• Voir Erreurs\n• Retour Learn"]
    end

    LEARN_PAGE --> SESSION_BUILD
    HEADER --> FILTERS --> GRID --> SELECTION

    SELECTION -->|"Réviser →"| CONFIG
    CONFIG --> PREVIEW --> LAUNCH

    LAUNCH --> PROGRESS
    PROGRESS --> QUESTION
    QUESTION --> SELECT_OPT
    SELECT_OPT --> ANSWER_STATE
    ANSWER_STATE -->|Non| REVEAL
    REVEAL --> FEEDBACK
    ANSWER_STATE -->|Oui| FEEDBACK
    FEEDBACK --> RATING
    RATING --> NEXT_CARD
    NEXT_CARD --> SESSION_END
    SESSION_END -->|Non| QUESTION
    SESSION_END -->|Oui| SUMMARY

    SUMMARY --> BREAKDOWN --> ACTIONS
    ACTIONS -->|"Retour"| LEARN_PAGE
```

---

## 6. Algorithme SM-2 (Spaced Repetition)

```mermaid
flowchart TD
    subgraph CARD_STATE["📇 État de la Carte"]
        INITIAL["Carte Nouvelle\ninterval: 1\neaseFactor: 2.5\nrepetitions: 0"]
    end

    subgraph REVIEW["🎯 Review"]
        SHOW_Q["Afficher Question"]
        USER_ANSWER["Utilisateur répond"]
        RATE{{"Rating?"}}
    end

    subgraph AGAIN["1️⃣ AGAIN"]
        A_CALC["Reset complet\ninterval = 1\nrepetitions = 0"]
        A_NEXT["Revoir demain"]
    end

    subgraph HARD["2️⃣ HARD"]
        H_CALC["interval *= 1.2\neaseFactor -= 0.15\n(min 1.3)"]
        H_NEXT["Revoir dans\n~2j si était 1j"]
    end

    subgraph GOOD["3️⃣ GOOD"]
        G_CALC["interval *= easeFactor\nrepetitions++"]
        G_NEXT["Revoir dans\n~3j si était 1j"]
    end

    subgraph EASY["4️⃣ EASY"]
        E_CALC["interval *= easeFactor * 1.3\neaseFactor += 0.15"]
        E_NEXT["Revoir dans\n~4j+ si était 1j"]
    end

    subgraph SCHEDULE["📅 Scheduling"]
        SAVE_DB["Sauvegarder\nnextReviewAt = now + interval"]
        QUEUE["File d'attente\nGET /api/reviews/due"]
    end

    INITIAL --> SHOW_Q
    SHOW_Q --> USER_ANSWER --> RATE

    RATE -->|"1"| A_CALC --> A_NEXT
    RATE -->|"2"| H_CALC --> H_NEXT
    RATE -->|"3"| G_CALC --> G_NEXT
    RATE -->|"4"| E_CALC --> E_NEXT

    A_NEXT & H_NEXT & G_NEXT & E_NEXT --> SAVE_DB --> QUEUE
    QUEUE -.->|"Jour J"| SHOW_Q
```

---

## 7. Dashboard Statistiques

```mermaid
flowchart TB
    subgraph STATS_PAGE["📊 Stats Page"]
        direction TB

        subgraph MAIN_STATS["🏆 Stats Principales"]
            STREAK["🔥 Streak\nJours consécutifs"]
            CARDS["📖 Cards\nTotal appris"]
            RETENTION["🎯 Retention\n% de réussite"]
            BEST["📈 Best\nRecord personnel"]
        end

        subgraph TODAY["📅 Aujourd'hui"]
            DUE["À réviser\nX cartes"]
            NEW["Nouvelles\nY cartes"]
            DONE["Révisées\nZ cartes"]
        end

        subgraph WEEKLY["📆 Cette Semaine"]
            CHART["📊 Bar Chart\nL M M J V S D"]
            TOTAL["Total: X reviews"]
        end

        subgraph PLATFORMS["🌐 Répartition"]
            YT_BAR["🔴 YouTube ████ 65%"]
            SP_BAR["🟢 Spotify ██ 25%"]
            TT_BAR["⬛ TikTok █ 10%"]
        end
    end

    API_STATS["GET /api/reviews/stats"]
    API_CONTENT["GET /api/content/stats"]

    API_STATS --> MAIN_STATS & TODAY & WEEKLY
    API_CONTENT --> PLATFORMS
```

---

## 8. Gestion des Notes (Memos IA)

```mermaid
flowchart LR
    subgraph TRIGGER["🎯 Déclencheur"]
        SESSION_END["Session Complete"]
        MEMO_BTN["📝 Générer Mémo IA"]
    end

    subgraph GENERATION["🤖 Génération"]
        API_CALL["POST /api/reviews/session/{id}/memo"]
        MISTRAL["Mistral AI\nRésumer le contenu\ndes cartes révisées"]
        SAVE["Sauvegarder en DB"]
    end

    subgraph NOTES_PAGE["📄 Notes Page"]
        LIST["Liste des Mémos"]
        MEMO_CARD["MemoCard\n• Source contents\n• Date création\n• Contenu formaté"]
        COPY["📋 Copier"]
        EXPAND["🔽 Voir plus"]
    end

    SESSION_END --> MEMO_BTN
    MEMO_BTN --> API_CALL
    API_CALL --> MISTRAL --> SAVE
    SAVE --> LIST
    LIST --> MEMO_CARD
    MEMO_CARD --> COPY & EXPAND
```

---

## 9. Parcours Complet - User Journey Map

```mermaid
journey
    title Remember iOS - Parcours Utilisateur Quotidien

    section Onboarding (1x)
        Télécharger l'app: 5: User
        Créer un compte: 4: User
        Connecter YouTube: 4: User
        Connecter Spotify: 3: User
        Voir premier contenu: 5: User

    section Routine Quotidienne
        Ouvrir l'app: 5: User
        Voir cards dues: 4: User
        Lancer session: 5: User
        Répondre aux quiz: 4: User
        Noter difficulté: 3: User
        Voir résumé: 5: User
        Streak +1 🔥: 5: User

    section Découverte (Hebdo)
        Like vidéo YouTube: 5: User
        Sync automatique: 5: System
        Nouveau contenu inbox: 4: User
        Sélectionner pour apprendre: 4: User
        Quiz générés: 5: System

    section Gestion
        Filtrer par plateforme: 3: User
        Archiver contenu: 3: User
        Voir statistiques: 4: User
        Générer mémo IA: 4: User
        Ajuster settings: 3: User
```

---

## 10. États des Écrans

```mermaid
stateDiagram-v2
    [*] --> Splash: App Launch

    Splash --> AuthCheck: Load tokens

    AuthCheck --> Login: No valid token
    AuthCheck --> Learn: Valid token

    state AuthStack {
        Login --> Signup: "Create account"
        Signup --> Login: "Already have account"
        Login --> Learn: Success
        Signup --> Learn: Success
    }

    state MainTabs {
        Learn --> Stats: Tab switch
        Learn --> Settings: Tab switch
        Stats --> Learn: Tab switch
        Stats --> Settings: Tab switch
        Settings --> Learn: Tab switch
        Settings --> Stats: Tab switch
    }

    Learn --> SessionBuilder: "Réviser →"
    SessionBuilder --> Review: "Lancer"
    Review --> SessionComplete: All cards done
    SessionComplete --> Learn: "Retour"
    SessionComplete --> Notes: "Générer Mémo"

    Settings --> WebView: TikTok/Instagram
    WebView --> Settings: Auth complete

    Settings --> Login: Logout
```

---

## 11. Flux de Données (Data Flow)

```mermaid
flowchart TB
    subgraph PLATFORMS["🌐 Plateformes Externes"]
        YT_API["YouTube API"]
        SP_API["Spotify API"]
        TT_COOKIES["TikTok Cookies"]
        IG_COOKIES["Instagram Cookies"]
    end

    subgraph BACKEND["🖥️ Backend (Express + Prisma)"]
        WORKERS["🔄 Workers\n• youtubeSync\n• spotifySync\n• scheduler"]

        SERVICES["⚙️ Services\n• transcription\n• quizGeneration\n• tokenRefresh"]

        API_ROUTES["🛣️ API Routes\n• /auth\n• /oauth\n• /content\n• /reviews"]

        DB[(PostgreSQL\nSupabase)]
    end

    subgraph IOS_APP["📱 iOS App"]
        STORE["Zustand Store\nauthStore"]
        QUERY["React Query\ncache + fetch"]
        SCREENS["Screens\n• Learn\n• Review\n• Stats\n• Settings"]
        SECURE["SecureStore\nJWT Tokens"]
    end

    YT_API & SP_API --> WORKERS
    TT_COOKIES & IG_COOKIES --> API_ROUTES
    WORKERS --> DB
    SERVICES <--> DB
    API_ROUTES <--> DB

    API_ROUTES <-->|HTTPS| QUERY
    QUERY <--> STORE
    STORE <--> SCREENS
    SCREENS <--> SECURE
    SECURE -->|JWT| QUERY
```

---

## 12. Résumé des Endpoints API

```mermaid
mindmap
    root((API Endpoints))
        Auth
            POST /login
            POST /signup
            POST /refresh
            GET /me
            POST /logout
        OAuth
            GET /status
            GET /{platform}/connect
            DELETE /{platform}/disconnect
            POST /{platform}/connect
            POST /{platform}/sync
            PUT /{platform}/source
        Content
            GET /
            GET /:id
            GET /inbox
            GET /tags
            POST /refresh
            PATCH /:id/triage
            POST /triage/bulk
            GET /stats
        Reviews
            GET /due
            GET /stats
            POST /
            POST /session
            GET /session/:id/cards
            GET /session/preview
            POST /session/:id/complete
            POST /session/:id/memo
            GET /memos
```

---

## Légende

| Symbole | Signification |
|---------|---------------|
| 🆕 | Nouveau contenu (INBOX) |
| ✅ | Prêt / Succès |
| ❌ | Échec / Erreur |
| 🔄 | En cours / Sync |
| 📬 | Inbox |
| 🎯 | Review / Quiz |
| 🔥 | Streak |
| 📊 | Stats |
| ⚙️ | Settings |
| 🤖 | IA (Mistral) |
| 🍪 | Cookies (WebView auth) |

---

## Notes d'implémentation

### Priorités
1. **P0 - Core Loop**: Auth → Learn → Review → Stats
2. **P1 - Platforms**: YouTube + Spotify OAuth
3. **P2 - Extra Platforms**: TikTok + Instagram WebView
4. **P3 - Polish**: Notes, Notifications, Deep Links

### Issues Linear associées
- REM-51 à REM-63: ✅ Implémentés
- REM-64: Push Notifications (TODO)
- REM-65: Deep Links (TODO)

---

*Document généré le 2026-02-01 par Claude Code*
