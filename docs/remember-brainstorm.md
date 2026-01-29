# Brainstorming Session: Remember App

**Date:** 2026-01-27  
**Objective:** Explorer et structurer l'idée d'une app de mémorisation de contenus RS  
**Techniques:** 5 Whys, SCAMPER, SWOT Analysis

---

## 📌 Context Loaded

From Notion "Remember":
- Récupérer activité RS (likes, saved, vus)
- Sélectionner contenus pertinents à retenir
- Problème : Perte de contenu intéressant

---

## 🔍 Technique 1: 5 Whys Analysis

**Problem:** Les gens perdent les contenus intéressants qu'ils voient sur les RS

**Why #1:** Pourquoi perdent-ils ces contenus ?
→ Parce qu'ils les scrollent sans les sauvegarder

**Why #2:** Pourquoi ne les sauvegardent-ils pas ?
→ Parce que "Saved" devient vite un bordel ingérable (100s de posts non triés)

**Why #3:** Pourquoi "Saved" devient-il ingérable ?
→ Pas de catégorisation, pas de contexte, pas de recherche

**Why #4:** Pourquoi les plateformes ne résolvent-elles pas ça ?
→ Leur objectif est le temps passé sur l'app, pas l'organisation de connaissance

**Why #5:** Pourquoi les outils externes (Notion, Obsidian) ne suffisent-ils pas ?
→ **Friction** : copier/coller manuellement chaque post = trop lourd

### 🎯 Root Cause Identified

**Le vrai problème n'est pas la perte de contenu, mais la friction entre consommation (scroll) et capitalisation (knowledge base).**

Les gens ont besoin d'un pont automatique entre leurs RS et leur système de connaissance.

---

## 💡 Technique 2: SCAMPER Creative Variations

### S - Substitute (Remplacer)
- Remplacer "Save" manuel → **Auto-capture basée sur temps de lecture**
- Remplacer folders → **Tags AI automatiques**
- Remplacer chronologique → **Relevance-based retrieval**

### C - Combine (Combiner)
- Twitter + Instagram + TikTok → **Feed unifié de saved**
- Saved posts + Notes perso → **Contexte enrichi**
- Archive + Spaced repetition → **Active recall system**

### A - Adapt (Adapter)
- Adapter Pocket (lecture plus tard) → **Pour contenu social court**
- Adapter Readwise → **Pour tweets/posts au lieu de livres**
- Adapter Mem.ai → **Memory agent pour RS**

### M - Modify (Modifier)
- **Magnifier :** Ne pas juste sauver le post, mais tout le thread/contexte
- **Minimiser :** Version ultra-light = juste bookmarks + search
- **Transformer :** Convertir posts en format digestible (daily digest)

### P - Put to Other Uses (Autres usages)
- Utiliser pour **veille concurrentielle** (track competitors' saved posts)
- Utiliser pour **content inspiration** (what resonates → what to create)
- Utiliser pour **lead gen** (track qui like/save quoi)

### E - Eliminate (Éliminer)
- Éliminer la notion de "dossiers" → Just search + AI
- Éliminer le save manuel → **Auto-save basé sur engagement**
- Éliminer l'app dédiée → **Email digest hebdo**

### R - Reverse/Rearrange (Inverser)
- Au lieu de "je save pour plus tard", **l'app me resuggest ce que j'ai saved**
- Au lieu de chercher dans mes saves, **l'app me ping quand c'est pertinent**
- Au lieu de capturer, **l'app me fait des synthèses**

---

## 📊 Technique 3: SWOT Analysis

### Strengths (Forces)
✅ **Problème réel** : Tout le monde perd du contenu qu'ils veulent retrouver  
✅ **Sticky** : Une fois que tu commences à l'utiliser, hard de s'en passer  
✅ **Multi-platform** : Fonctionne sur toutes les RS  
✅ **AI differentiation** : L'IA peut vraiment aider (tagging, search, résumés)  

### Weaknesses (Faiblesses)
⚠️ **API access** : Twitter, Instagram ne donnent pas facilement leurs APIs  
⚠️ **Chrome extension required** : Friction d'installation  
⚠️ **Competing avec "native"** : Twitter a déjà "Bookmarks"  
⚠️ **Monetization** : Pourquoi payer pour ça ?  

### Opportunities (Opportunités)
🚀 **Knowledge workers** : Chercheurs, créateurs, marketers ont ce besoin  
🚀 **Content creators** : Besoin de tracker ce qui marche  
🚀 **Team use case** : Équipe marketing qui track competitors  
🚀 **Integration Notion/Obsidian** : Pipeline vers PKM  

### Threats (Menaces)
⛔ **Twitter/Meta peuvent build ça** nativement demain  
⛔ **Chrome extension = fragile** (update qui casse)  
⛔ **Readwise existe déjà** (mais pour longform content)  
⛔ **AI fatigue** : "Encore un tool avec AI dedans"  

---

## 🎯 TOP 3 INSIGHTS

### 1. **Le Vrai Besoin : Bridge entre Scroll et Knowledge**
Ce n'est pas juste un "better bookmarks". C'est un **pipeline automatique** entre ce que tu consommes (scroll passif) et ce que tu retiens (knowledge actif).

**Implication produit :** Ne pas juste copier Pocket. Focus sur :
- Auto-capture basée sur comportement (temps de lecture, re-lecture, screenshots)
- Synchro automatique vers Notion/Obsidian
- Résumés/synthèses AI hebdomadaires

### 2. **Différenciation : Active Recall vs Passive Archive**
Les gens ne **cherchent pas** dans leurs saves. Ils les oublient.

**Implication produit :** Ne pas être un "search engine de tes saves". Être un **agent qui te rappelle** :
- "Il y a 3 mois tu avais saved un thread sur X, pertinent pour ce que tu fais maintenant"
- "5 posts cette semaine sur le même sujet → synthèse ?"
- Spaced repetition pour contenus importants

### 3. **Positionnement : Not for Everyone**
Ce n'est pas pour le scrolleur lambda. C'est pour les **knowledge workers** :
- Créateurs de contenu (veille + inspiration)
- Marketers (competitive intelligence)
- Chercheurs (curation de sources)
- Product builders (user research snippets)

**Implication produit :** Premium dès le départ. $10-20/mois. Pas de freemium.

---

## 🚀 RECOMMENDED NEXT STEPS

1. **Product Brief (Business Analyst)** : Formaliser le problème, target audience, success metrics
2. **Competitive Research** : Analyser Readwise, Pocket, Matter, Instapaper
3. **MVP Scope** : Définir la version minimale (1 platform? Auto-save ou manual?)
4. **Tech Feasibility** : Vérifier les APIs disponibles (Twitter, Instagram, etc.)

---

**Session Complete ✅**  
Ready for next BMAD phase: `/product-brief` with Business Analyst
