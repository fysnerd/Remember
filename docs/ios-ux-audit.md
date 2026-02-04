# Audit UX - Remember iOS App

**Date:** 2026-02-02
**Méthodologie:** BMAD + iOS Human Interface Guidelines + Interaction Design Patterns
**Auteur:** Claude Code (UX Audit)

---

## Executive Summary

L'app iOS Remember est **fonctionnellement complète** pour le flow principal (sélection → quiz → révision). Cependant, plusieurs opportunités d'amélioration UX ont été identifiées, notamment autour de la **clarté de navigation**, du **feedback utilisateur**, et de la **cohérence avec les guidelines iOS natifs**.

### Score Global: 7/10

| Critère | Score | Priorité Fix |
|---------|-------|--------------|
| Architecture Navigation | 8/10 | - |
| Clarté du Flow Principal | 6/10 | 🔴 Haute |
| Feedback & Microinteractions | 5/10 | 🔴 Haute |
| Cohérence Design System | 7/10 | 🟡 Moyenne |
| Conformité iOS HIG | 6/10 | 🟡 Moyenne |
| Accessibilité | 4/10 | 🔴 Haute |
| États vides & Erreurs | 6/10 | 🟡 Moyenne |

---

## 1. Architecture & Navigation

### ✅ Points Positifs

- **3 onglets clairs** (Learn, Library, Stats, Settings) - aligné avec le doc UX v2.0
- **expo-router** bien utilisé pour la navigation file-based
- **Deep linking** configuré pour OAuth

### ❌ Problèmes Identifiés

#### 1.1 Confusion entre "Learn" (index.tsx) et "Library" (library.tsx)

**Problème:** L'app a 2 écrans similaires avec des fonctions qui se chevauchent :
- `index.tsx` (Learn) = Inbox + filtres plateforme + "Start Review"
- `library.tsx` (Library) = Mosaïque + filtres + Session Builder

**Impact:** L'utilisateur ne sait pas où aller pour réviser.

**Recommandation:**
```
Option A: Fusionner en un seul écran "Apprendre" (comme le doc UX v2.0)
Option B: Clarifier les rôles:
  - Learn = "Aujourd'hui" (due cards, inbox rapide)
  - Library = "Ma bibliothèque" (tout le contenu, session builder)
```

#### 1.2 Nom des onglets en anglais

**Problème:** Les onglets sont en anglais ("Learn", "Stats", "Settings") alors que le contenu est en français.

**Recommandation:** Uniformiser en français ou anglais selon la cible.

---

## 2. Flow Principal : Tests par Thème

### ✅ Points Positifs

- Session Builder **complet** avec sélection par Vidéos OU Thèmes
- Filtres par plateforme et tags fonctionnels
- Limite de questions configurable (5, 10, 20, Tout)
- Practice mode séparé (pas d'impact sur stats)

### ❌ Problèmes Identifiés

#### 2.1 Découvrabilité du Session Builder

**Problème:** Le bouton "Start Custom Session" est noyé dans l'écran Library entre les filtres et la grille.

**Impact:** Les utilisateurs peuvent passer à côté de cette feature clé.

**Recommandation:**
```
- Rendre le bouton plus proéminent (couleur, taille, position)
- Ajouter un onboarding tooltip au premier lancement
- Position sticky en bas de l'écran (comme la barre de sélection)
```

#### 2.2 Pas de preview du nombre de questions

**Problème:** Dans le Session Builder modal, l'utilisateur ne voit pas combien de questions correspondent à ses filtres avant de lancer.

**Code actuel (library.tsx:736-747):**
```tsx
<View style={styles.sessionSummary}>
  <Text style={styles.sessionSummaryText}>
    {sessionQuestionLimit ? `${sessionQuestionLimit} questions` : 'Toutes les questions'}
    {sessionMode === 'videos' && sessionSelectedVideos.size > 0
      ? ` • ${sessionSelectedVideos.size} vidéo(s)`
      : ''}
  </Text>
</View>
```

**Recommandation:** Ajouter un appel API `/reviews/session/preview` pour afficher le vrai compte.

#### 2.3 États de chargement dans le Session Builder

**Problème:** Quand on ouvre le modal, il y a un flash de "Aucune vidéo" avant que les données chargent.

**Recommandation:** Ajouter un skeleton loader ou spinner pendant le fetch.

---

## 3. Review Session (Quiz)

### ✅ Points Positifs

- Interface **full-screen** sans distractions
- Progress bar claire
- Animation de transition entre questions
- Explication affichée après réponse
- Stats de fin de session (score, temps)

### ❌ Problèmes Identifiés

#### 3.1 Pas de feedback haptique

**Problème:** Aucun retour haptique lors de :
- Sélection d'une réponse
- Réponse correcte/incorrecte
- Fin de session

**Impact:** L'expérience manque de "punch" sur iOS natif.

**Recommandation (expo-haptics):**
```tsx
import * as Haptics from 'expo-haptics';

// Sélection réponse
Haptics.selectionAsync();

// Réponse correcte
Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

// Réponse incorrecte
Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

// Fin session
Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
```

#### 3.2 Animations basiques

**Problème:** Les transitions entre questions utilisent juste un fade (opacity). C'est fonctionnel mais pas engageant.

**Recommandation:** Ajouter une animation de slide horizontal (comme les cartes Tinder/Anki).

#### 3.3 Pas de geste swipe

**Problème:** L'utilisateur doit taper sur "Continuer". Sur mobile, un swipe serait plus naturel.

**Recommandation:** Permettre swipe left/right pour passer à la question suivante après reveal.

#### 3.4 "Unknown source" affiché

**Problème (line 252-254):**
```tsx
<Text style={styles.source} numberOfLines={1}>
  {contentInfo?.title || 'Unknown source'}
</Text>
```

Si `contentInfo` est undefined, l'utilisateur voit "Unknown source".

**Recommandation:** Ne pas afficher la source si inconnue, ou afficher un placeholder plus élégant.

---

## 4. Design System & Cohérence

### ❌ Problèmes Identifiés

#### 4.1 Palette de couleurs trop minimaliste

**Code actuel (constants.ts):**
```tsx
export const Colors = {
  primary: '#000000',      // Noir = pas assez distinctif
  secondary: '#666666',
  background: '#FFFFFF',
  surface: '#F5F5F5',
  // ...
}
```

**Problème:** Le noir comme couleur primaire ne crée pas d'identité visuelle forte.

**Recommandation:** Introduire une couleur d'accent (le doc UX suggère `#5B47FB` purple).

#### 4.2 Incohérence linguistique

| Écran | Langue |
|-------|--------|
| Tab names | Anglais (Learn, Stats, Settings) |
| Section titles Settings | Anglais (Account, Connected Platforms) |
| Boutons Library | Français (Réviser, Prêt, En préparation) |
| Quiz | Mix (Vérifier, Continuer, Explanation) |
| Session complete | Français (Session terminée) |

**Recommandation:** Choisir une langue et s'y tenir (français recommandé pour app FR).

#### 4.3 Touch targets parfois trop petits

**Exemple (closeButton dans review):**
```tsx
closeButton: {
  width: 40,
  height: 40,  // Minimum iOS = 44x44
}
```

**Recommandation:** Respecter le minimum iOS de 44x44 points.

---

## 5. Conformité iOS Human Interface Guidelines

### ❌ Violations Identifiées

#### 5.1 Pas de SF Symbols

**Problème:** L'app utilise FontAwesome au lieu de SF Symbols.

**Impact:**
- Icônes non-natives (look "web app")
- Pas de support pour variable symbols
- Pas de support pour symbol effects (iOS 17+)

**Recommandation:** Migrer vers `expo-symbols` ou `@expo/vector-icons/Ionicons` (plus proche de SF Symbols).

#### 5.2 Pas de support Dynamic Type

**Problème:** Toutes les tailles de police sont en valeurs fixes (px).

```tsx
statValue: {
  fontSize: 24,  // Hardcoded
  fontWeight: 'bold',
}
```

**Impact:** Les utilisateurs avec accessibilité ne peuvent pas agrandir le texte.

**Recommandation:** Utiliser les semantic text styles de React Native :
```tsx
import { Text } from 'react-native';
// OU utiliser un scale factor basé sur PixelRatio.getFontScale()
```

#### 5.3 Pas de support Dark Mode

**Problème:** Couleurs hardcodées, pas de `useColorScheme()`.

**Recommandation:** Issue REM-75 déjà créée dans le backlog.

#### 5.4 Pas d'animations natives iOS

**Problème:** Les animations utilisent `Animated.timing` avec des durées web-like (150ms).

**Recommandation iOS:**
- Utiliser `react-native-reanimated` pour des animations plus fluides
- Spring animations avec `damping` et `stiffness` pour un feel natif

---

## 6. Accessibilité

### ❌ Problèmes Critiques

#### 6.1 Aucun `accessibilityLabel`

**Problème:** Les composants interactifs n'ont pas de labels pour VoiceOver.

**Exemple (library.tsx thumbnail):**
```tsx
<Image source={{ uri: content.thumbnailUrl }} style={styles.thumbnail} />
// Pas de accessibilityLabel!
```

**Recommandation:**
```tsx
<Image
  source={{ uri: content.thumbnailUrl }}
  style={styles.thumbnail}
  accessible={true}
  accessibilityLabel={`Thumbnail de ${content.title}`}
/>
```

#### 6.2 Pas de `accessibilityRole`

**Problème:** Les boutons custom n'ont pas de rôle défini.

```tsx
<TouchableOpacity style={styles.option} onPress={...}>
// Devrait avoir accessibilityRole="button"
```

#### 6.3 Pas de `accessibilityState`

**Problème:** Les états selected/disabled ne sont pas communiqués.

**Recommandation:**
```tsx
<TouchableOpacity
  accessibilityRole="radio"
  accessibilityState={{
    selected: isSelected,
    disabled: state === 'revealed'
  }}
>
```

#### 6.4 Contraste insuffisant

**Problème:** `text.muted: '#999999'` sur `background: '#FFFFFF'` = ratio 2.85:1.

**WCAG AA requiert:** 4.5:1 pour texte normal, 3:1 pour grand texte.

**Recommandation:** Utiliser `#767676` minimum pour le texte muted.

---

## 7. États Vides & Erreurs

### ✅ Points Positifs

- Empty states présents dans la plupart des écrans
- Messages en français et contextuels

### ❌ Problèmes Identifiés

#### 7.1 Empty state générique dans Library

```tsx
<Text style={styles.emptySubtitle}>{message}</Text>
// Message change selon le filtre - bien!
```

Mais pas d'action suggérée (ex: "Connecte tes comptes" si pas de contenu).

#### 7.2 Erreurs réseau non gérées gracieusement

**Problème:** Si l'API échoue, l'utilisateur voit juste un spinner infini ou un écran vide.

**Recommandation:** Ajouter des error boundaries et des messages "Réessayer".

---

## 8. Recommandations Prioritaires

### 🔴 Haute Priorité (Impact UX majeur)

| # | Recommandation | Effort | Issue Linear |
|---|----------------|--------|--------------|
| 1 | Ajouter haptic feedback dans quiz | S | À créer |
| 2 | Fusionner/clarifier Learn vs Library | M | À créer |
| 3 | Uniformiser la langue (FR) | S | À créer |
| 4 | Ajouter accessibilityLabels partout | M | À créer |
| 5 | Fix contraste texte muted | XS | À créer |

### 🟡 Moyenne Priorité (Polish)

| # | Recommandation | Effort | Issue Linear |
|---|----------------|--------|--------------|
| 6 | Migrer vers SF Symbols/Ionicons | M | À créer |
| 7 | Améliorer animations quiz (slide) | M | REM-72 existe |
| 8 | Ajouter swipe gesture dans quiz | M | À créer |
| 9 | Preview count dans Session Builder | S | À créer |
| 10 | Error states avec "Réessayer" | S | À créer |

### 🟢 Basse Priorité (Nice to have)

| # | Recommandation | Effort | Issue Linear |
|---|----------------|--------|--------------|
| 11 | Dark Mode | L | REM-75 existe |
| 12 | Dynamic Type support | M | À créer |
| 13 | Spring animations (reanimated) | L | À créer |
| 14 | Onboarding tooltips | M | REM-71 existe |

---

## 9. Comparaison avec le Doc UX v2.0

| Aspect | Doc UX v2.0 | Implémentation iOS | Gap |
|--------|-------------|-------------------|-----|
| 3 pages (Apprendre, Stats, Settings) | ✅ | 4 tabs (Learn, Library, Stats, Settings) | ⚠️ |
| Mosaïque visuelle | ✅ | ✅ | - |
| Filtres plateformes/thèmes | ✅ | ✅ | - |
| Badges (Nouveau, X quiz, Passé) | ✅ | ✅ (Prêt, En préparation, Passés) | ⚠️ Naming |
| Barre de sélection sticky | ✅ | ✅ | - |
| Review full-screen | ✅ | ✅ | - |
| Rating 4 niveaux | ✅ | ❌ (simplifié: auto Good/Again) | ✅ Amélioré! |
| Keyboard shortcuts | ✅ | ❌ N/A mobile | - |
| Couleur primaire #5B47FB | ✅ | ❌ (#000000 noir) | ⚠️ |

---

## 10. Conclusion

L'app Remember iOS est **fonctionnellement solide** avec un flow principal complet. Les principales opportunités d'amélioration sont :

1. **Feedback sensoriel** (haptics, animations)
2. **Clarté de navigation** (fusionner Learn/Library ou mieux différencier)
3. **Accessibilité** (labels, contrastes, VoiceOver)
4. **Identité visuelle** (couleur primaire distinctive)

La simplification du rating (REM-77, passage de 4 niveaux à auto Good/Again) est une **amélioration par rapport au doc UX** - moins de friction pour l'utilisateur.

---

**Prochaines étapes suggérées:**
1. Créer les issues Linear pour les items haute priorité
2. Commencer par les quick wins (haptics, langue, contraste)
3. Planifier la refonte navigation dans un second temps

