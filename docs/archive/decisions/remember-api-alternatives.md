# Remember - Alternatives aux Extensions Chrome

**Date:** 2026-01-27  
**Question:** Peut-on éviter l'extension Chrome et utiliser les APIs natives ?

---

## 📊 Tableau Récapitulatif

| Plateforme | API Officielle | Accès Likes/Saved | Coût | Difficulté | Recommandation |
|------------|----------------|-------------------|------|------------|----------------|
| **YouTube** | ✅ Oui | ✅ Oui (OAuth) | Gratuit | Facile | **USE API** |
| **Spotify** | ✅ Oui | ✅ Oui (Recently Played) | Gratuit | Facile | **USE API** |
| **Twitter/X** | ✅ Oui | ⚠️ Limité | $100+/mo | Moyen | Extension OU API payante |
| **TikTok** | ⚠️ Research Only | ✅ Oui | Academic | Difficile | Extension (MVP), API (v2) |
| **Instagram** | ❌ Non | ❌ Non | N/A | Impossible | Extension OBLIGATOIRE |

---

## 🎯 Plateforme par Plateforme

### 1. YouTube ✅ **API RECOMMANDÉE**

**API Disponible :** YouTube Data API v3

**Accès aux Likes :**
```bash
# OAuth 2.0 flow (user autorise l'app)
# Puis récupérer la playlist "Liked Videos"

GET https://www.googleapis.com/youtube/v3/channels
  ?part=contentDetails&mine=true

# Réponse contient: likePlaylistId
# Ensuite récupérer les vidéos de cette playlist

GET https://www.googleapis.com/youtube/v3/playlistItems
  ?playlistId={likePlaylistId}&maxResults=50
```

**Avantages :**
- ✅ Gratuit (quota : 10K units/jour)
- ✅ Officiel, stable, bien documenté
- ✅ OAuth = user autorise une fois, fonctionne partout (web, mobile, desktop)
- ✅ Données riches (titre, durée, description, thumbnail)

**Inconvénients :**
- ⚠️ Limite quota (mais 10K/jour = ~200 utilisateurs actifs)
- ⚠️ User doit cliquer "Authorize" une fois

**Workflow avec API :**
1. User clique "Connect YouTube"
2. OAuth popup → "Allow Remember to access your liked videos"
3. Backend poll les nouvelles vidéos liked toutes les 15min
4. Dès qu'une nouvelle vidéo → transcription + quiz

**Impact sur UX :**
- ✅ Pas besoin d'extension Chrome !
- ✅ Fonctionne sur mobile (app native possible)
- ✅ Plus fiable (pas de risque que l'extension casse)

**Recommandation :** **UTILISER L'API** au lieu de l'extension pour YouTube

---

### 2. Spotify ✅ **API RECOMMANDÉE**

**API Disponible :** Spotify Web API

**Accès Recently Played :**
```bash
GET https://api.spotify.com/v1/me/player/recently-played
  ?type=episode&limit=50

# Réponse : liste des derniers épisodes de podcast écoutés
```

**Avantages :**
- ✅ Gratuit
- ✅ OAuth simple
- ✅ Données riches (episode, show, durée, description)
- ✅ Fonctionne sur mobile

**Inconvénients :**
- ⚠️ Pas de "liked podcasts", seulement "recently played"
- ⚠️ Limite : derniers 50 items

**Workflow avec API :**
1. User clique "Connect Spotify"
2. OAuth popup → "Allow Remember to see your listening history"
3. Backend poll les nouveaux épisodes toutes les heures
4. Transcription audio → quiz

**Use Case :**
- Podcasts éducatifs (Tim Ferriss, Huberman Lab, etc.)
- Audiobooks

**Recommandation :** **UTILISER L'API** pour Spotify

---

### 3. Twitter/X ⚠️ **API CHÈRE**

**API Disponible :** X API v2

**Accès aux Likes :**
```bash
GET https://api.x.com/2/users/:id/liked_tweets
```

**Pricing (2026) :**
- Free tier : 1,500 tweets/month (inutilisable)
- **Basic : $100/month** (50K tweets/month)
- Pro : $5,000/month
- Enterprise : $42,000/month

**Avantages :**
- ✅ Accès officiel aux likes
- ✅ Bookmarks aussi disponibles (si Basic+)
- ✅ Données structurées

**Inconvénients :**
- ❌ **Très cher** : $100/mo minimum
- ❌ À 10K users × $100/mo = pas rentable
- ⚠️ Free tier trop limité (1,500 tweets = 3 users actifs max)

**Alternative : Extension Chrome**
- Gratuit
- Capture en temps réel
- Fonctionne immédiatement

**Recommandation :** 
- **MVP : Extension Chrome** (gratuit, rapide)
- **Post-PMF : Négocier avec X** ou passer sur l'API si volume justifie

---

### 4. TikTok ⚠️ **API LIMITÉE**

**API Disponible :** TikTok Research API

**Accès aux Likes :**
```bash
POST https://open.tiktokapis.com/v2/research/user/liked_videos/
{
  "username": "user123",
  "max_count": 100
}
```

**MAIS :**
- ❌ **Research API seulement** (académique, non-commercial)
- ❌ Accès difficile à obtenir (application avec justification)
- ❌ Pas pour usage commercial sans accord spécial

**API Display (commerciale) :**
- ❌ Ne donne PAS accès aux likes d'un user
- ✅ Seulement : profil public, vidéos publiées par le user

**Recommandation :**
- **MVP : Extension Chrome** (seule option viable)
- **V2 : Négocier partenariat TikTok** (si gros volume)

---

### 5. Instagram ❌ **PAS D'API**

**API Disponible :** Instagram Graph API

**Accès aux Likes/Saved :**
- ❌ **N'existe pas**
- API Instagram = posts que TU as publiés uniquement
- Pas d'accès aux posts que tu as likés ou sauvegardés

**Alternatives :**
- Unofficial API (instapi, instagram-private-api)
  - ⚠️ Risque de ban du compte
  - ⚠️ Casse régulièrement (Instagram change)
  - ⚠️ Légalement gris

**Recommandation :** **Extension Chrome OBLIGATOIRE** pour Instagram

---

## 🎯 Stratégie Recommandée pour Remember

### Phase 1 : MVP (3 mois)

**Utiliser APIs :**
- ✅ **YouTube** → YouTube Data API (gratuit, stable)
- ✅ **Spotify** → Spotify Web API (gratuit, podcasts)

**Utiliser Extension :**
- 🟡 **Twitter** → Extension Chrome (API trop chère)

**Skip :**
- ❌ Instagram (trop complexe pour MVP)
- ❌ TikTok (API inaccessible)

**Avantages :**
- 2/3 plateformes sans extension !
- Fonctionne sur mobile (web app + OAuth)
- Plus stable (APIs officielles)

---

### Phase 2 : Post-MVP (6-12 mois)

**Ajouter Extension pour :**
- Twitter (si API toujours trop chère)
- Instagram (obligatoire)
- TikTok (obligatoire)

**Ou Négocier :**
- Partenariat Twitter/X (volume discount ou sponsored)
- Partenariat TikTok (accès Research API commercial)

---

## 💡 Architecture Hybride (RECOMMANDÉE)

### Approche 1 : OAuth + Polling (YouTube, Spotify)

```
User → Clique "Connect YouTube"
     ↓
OAuth Popup → User autorise
     ↓
Backend stocke access_token + refresh_token
     ↓
Cron job (toutes les 15min) :
  - Récupère nouvelles vidéos liked
  - Compare avec last_sync_timestamp
  - Si nouvelles → enqueue transcription
```

**Avantages :**
- Pas d'extension nécessaire
- Fonctionne sur mobile
- Stable

**Inconvénient :**
- Latence : 15min au lieu de temps réel

**Solution :** Webhook si disponible (YouTube n'en a pas)

---

### Approche 2 : Extension Chrome (Twitter, Instagram, TikTok)

```
User → Like un tweet
     ↓
Extension détecte → Capture immédiate
     ↓
Envoie à backend → Enqueue traitement
```

**Avantage :**
- Temps réel
- Gratuit

**Inconvénient :**
- Desktop only (pas mobile)
- Risque de casse si plateforme change

---

### Approche 3 : Hybride (BEST)

**Pour utilisateurs Desktop :**
- Extension installée → capture temps réel (toutes plateformes)

**Pour utilisateurs Mobile :**
- OAuth YouTube + Spotify → polling backend
- Pas d'accès Twitter/Instagram/TikTok (ou app mobile native plus tard)

**UX :**
```
Onboarding:

"Connecte tes comptes pour apprendre automatiquement"

[Connect YouTube]     ← OAuth (fonctionne partout)
[Connect Spotify]     ← OAuth (fonctionne partout)
[Install Extension]   ← Chrome only (optionnel si desktop)
  ↳ Enables: Twitter, Instagram, TikTok
```

---

## 💰 Impact sur les Coûts

### Avec Extension Chrome (baseline)

**Infrastructure :** $335/mo  
**APIs externes :** $10,580/mo (Whisper + GPT-4)  
**Total :** $10,915/mo

---

### Avec YouTube + Spotify APIs

**Ajout :**
- YouTube API : Gratuit (10K quota/jour)
- Spotify API : Gratuit
- Polling infra : +$20/mo (cron workers)

**Total :** $10,935/mo (+$20/mo)

**Avantages :**
- Fonctionne sur mobile
- Plus stable
- Meilleure UX

**ROI :** Worth it ! $20/mo pour unlock mobile = énorme

---

### Si on payait Twitter API

**Ajout :**
- Twitter Basic : $100/mo
- Support 50K tweets/month = ~50 users actifs max

**À 10K users :**
- 10K users × 70% actifs = 7K actifs
- 7K / 50 = 140 comptes Basic nécessaires
- 140 × $100 = **$14,000/mo juste pour Twitter**

**Conclusion :** Extension Chrome pour Twitter = meilleur choix économique

---

## ✅ Recommandation Finale

### MVP Architecture (Semaines 1-12)

**Capture Sources :**
1. ✅ **YouTube** → YouTube Data API (OAuth + polling)
2. ✅ **Spotify** → Spotify Web API (OAuth + polling)
3. 🟡 **Twitter** → Chrome Extension (temps réel)

**Platforms à skip :**
- ❌ Instagram (trop complexe, extension obligatoire)
- ❌ TikTok (API inaccessible)

**Setup Utilisateur :**
```
Step 1: Sign up
Step 2: Connect YouTube (OAuth popup)
Step 3: Connect Spotify (OAuth popup)
Step 4: [Optional] Install extension for Twitter
```

**Avantages :**
- Fonctionne sans extension pour 2/3 sources
- Mobile-ready (web app fonctionne)
- Coûts : +$20/mo seulement
- Stable (APIs officielles)

---

### Post-MVP (Mois 4-12)

**Si traction :**
- Ajouter extension pour Instagram
- Négocier partenariat TikTok ou attendre API commerciale
- Évaluer Twitter API si revenus le justifient

**Si mobile demandé :**
- App iOS/Android native
- OAuth YouTube + Spotify fonctionne déjà
- Extension Chrome = version desktop

---

## 🚀 Impact sur le PRD

### Changes nécessaires :

**FR-001 : Content Auto-Capture**
- OLD: Chrome Extension monitors likes
- NEW: 
  - YouTube/Spotify : OAuth + backend polling
  - Twitter : Chrome Extension (optional)

**FR-009 : Chrome Extension**
- OLD: Must Have (MVP)
- NEW: Should Have (MVP+)
  - Core features work without it (YouTube/Spotify)
  - Extension = bonus for Twitter

**New FR-XXX : OAuth Integration**
- YouTube OAuth flow
- Spotify OAuth flow
- Backend polling job (15min interval)
- Sync status UI ("Last synced: 2 min ago")

---

**Conclusion :** On peut éviter l'extension pour YouTube + Spotify, ce qui est ÉNORME car ça représente probablement 60-70% du contenu éducatif consommé.

**Next Action :** Update PRD + Architecture avec cette approche hybride ?
