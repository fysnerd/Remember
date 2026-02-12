---
status: diagnosed
phase: 14-screen-rebuild
source: [14-01-SUMMARY.md, 14-02-SUMMARY.md, 14-03-SUMMARY.md]
started: 2026-02-12T14:00:00Z
updated: 2026-02-12T14:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Home Greeting Header
expected: Home screen shows a time-of-day greeting ("Bonjour", "Bon apres-midi", or "Bonsoir") with user name. Below the greeting, a stats row displays review counts.
result: pass

### 2. Home Daily Theme Cards
expected: Home screen displays up to 3 daily theme cards in glass style. Each card shows: emoji, theme name, content count, question count, and an orange "due" badge if reviews are pending.
result: issue
reported: "je ne veux pas qu'on affiche les questions, juste le nb de contenu"
severity: cosmetic

### 3. Home Discovery Banner
expected: A discovery banner appears on Home screen styled as a GlassCard (not a white/opaque card). Pull-to-refresh works on the whole screen.
result: issue
reported: "je la vois pas la banniere decouverte. le pull to refresh freeze a un moment"
severity: major

### 4. Explorer Two-Level Tabs
expected: Explorer screen has two top-level tabs ("Suggestions" and "Bibliotheque") with a Soft Gold accent underline on the active tab. Default tab is Bibliotheque.
result: pass

### 5. Explorer Library Search
expected: Library tab shows a glass-styled search bar at the top. Typing a query filters content after a short delay (~300ms). A clear button (X) appears when text is entered.
result: pass

### 6. Explorer Triage Preserved
expected: In the Bibliotheque tab, switching to "A trier" sub-tab shows inbox content. Batch selection (long-press or select mode), Learn, and Archive actions still work.
result: issue
reported: "quand je clique sur du contenu a trier, la barre d'actions est derriere la navbar en bas, on peut pas cliquer sur apprendre ou archiver"
severity: major

### 7. Revisions Platform Filter
expected: Revisions screen shows horizontal scrollable platform filter chips (All, YouTube, Spotify, TikTok, Instagram). Tapping a chip filters the revision list to that platform only.
result: issue
reported: "ca bug - le chip YouTube actif a un fond dore qui s'etire sur toute la hauteur de l'ecran au lieu d'etre un petit pill"
severity: blocker

### 8. Revisions Search
expected: Revisions screen has a search bar. Typing filters revision cards by title or content name in real-time (client-side).
result: pass

### 9. Profile User Info
expected: Profile screen shows user info at the top in a GlassCard: name (or email prefix if no name set), and account details. All sections use glass styling.
result: pass

### 10. Profile Platforms & Settings
expected: Profile shows connected platforms section with connect/disconnect/sync controls. Settings section uses Lucide icons (Wrench for Dev Tools, ChevronRight for navigation rows). No emoji visible.
result: pass

## Summary

total: 10
passed: 6
issues: 4
pending: 0
skipped: 0

## Gaps

- truth: "DailyThemeCard affiche emoji + nom + nb contenus + badge a revoir (sans nb questions)"
  status: failed
  reason: "User reported: je ne veux pas qu'on affiche les questions, juste le nb de contenu"
  severity: cosmetic
  test: 2
  root_cause: "Ligne 28 de DailyThemeCard.tsx affiche contentCount ET totalCards (questions) - retirer la partie questions"
  artifacts:
    - path: "ios/components/home/DailyThemeCard.tsx"
      issue: "Affiche nb questions en plus du nb contenus"
  missing:
    - "Retirer le separateur middle-dot et le texte questions, garder uniquement le nb contenus"
  debug_session: ""

- truth: "Banniere Decouverte visible en GlassCard sur Home + pull-to-refresh fonctionne sans freeze"
  status: failed
  reason: "User reported: je la vois pas la banniere decouverte. le pull to refresh freeze a un moment"
  severity: major
  test: 3
  root_cause: "Banner conditionnel sur pendingCount > 0 (pendingThemes vide) + onRefresh callback race condition avec invalidateQueries"
  artifacts:
    - path: "ios/app/(tabs)/index.tsx"
      issue: "Banner conditionnel pendingCount > 0, onRefresh Promise.all sans error handling"
  missing:
    - "Debug pourquoi pendingThemes est vide"
    - "Ajouter error handling et timeout au onRefresh callback"
  debug_session: ""

- truth: "Barre d'actions triage (Apprendre/Archiver) accessible au-dessus de la tab bar"
  status: failed
  reason: "User reported: la barre d'actions est derriere la navbar en bas, on peut pas cliquer sur apprendre ou archiver"
  severity: major
  test: 6
  root_cause: "SelectionBar position absolute bottom:0 sans offset pour la tab bar absolue - manque useBottomTabBarHeight"
  artifacts:
    - path: "ios/components/content/SelectionBar.tsx"
      issue: "bottom:0 ne tient pas compte de la hauteur du tab bar"
  missing:
    - "Ajouter useBottomTabBarHeight() et l'ajouter au style bottom du container"
  debug_session: ""

- truth: "CategoryChips affiche des pills compacts avec fond accent sur le chip actif"
  status: failed
  reason: "User reported: le chip YouTube actif a un fond dore qui s'etire sur toute la hauteur de l'ecran"
  severity: blocker
  test: 7
  root_cause: "Chip Pressable sans contrainte de hauteur - le fond accent s'etire car ScrollView parent n'a pas de height et chips manquent alignSelf"
  artifacts:
    - path: "ios/components/reviews/CategoryChips.tsx"
      issue: "Style chip sans alignSelf ni height, scroll sans contrainte verticale"
  missing:
    - "Ajouter alignSelf: 'flex-start' au style chip OU height explicite au scroll container"
  debug_session: ""
