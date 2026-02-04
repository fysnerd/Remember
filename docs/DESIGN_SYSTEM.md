# Remember iOS - Design System

> **🎨 Ce fichier est la source de vérité pour le design de l'app.**  
> L'IA doit suivre ces guidelines lors du vibe coding.

---

## 🎨 Couleurs

### Palette Principale

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `primary` | `#6366F1` | `#818CF8` | Boutons principaux, liens, accents |
| `secondary` | `#8B5CF6` | `#A78BFA` | Éléments secondaires |
| `accent` | `#F59E0B` | `#FBBF24` | Notifications, badges, highlights |

### Backgrounds

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `background` | `#FFFFFF` | `#0F0F1A` | Fond principal |
| `surface` | `#F9FAFB` | `#1A1A2E` | Cards, modals |
| `elevated` | `#FFFFFF` | `#252540` | Éléments surélevés |

### Textes

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `text.primary` | `#1A1A2E` | `#F9FAFB` | Titres, texte principal |
| `text.secondary` | `#6B7280` | `#9CA3AF` | Sous-titres, labels |
| `text.muted` | `#9CA3AF` | `#6B7280` | Placeholders, hints |

### États

| Token | Valeur | Usage |
|-------|--------|-------|
| `success` | `#10B981` | Validation, succès |
| `warning` | `#F59E0B` | Alertes |
| `error` | `#EF4444` | Erreurs |
| `info` | `#3B82F6` | Informations |

---

## 📝 Typographie

### Font Family
```
Font principale: Inter (ou System)
Font mono: SF Mono / Menlo
```

### Échelle Typographique

| Style | Size | Weight | Line Height | Usage |
|-------|------|--------|-------------|-------|
| `h1` | 32px | Bold (700) | 40px | Titres de page |
| `h2` | 24px | SemiBold (600) | 32px | Titres de section |
| `h3` | 20px | SemiBold (600) | 28px | Sous-sections |
| `body` | 16px | Regular (400) | 24px | Texte courant |
| `bodyBold` | 16px | SemiBold (600) | 24px | Texte important |
| `caption` | 14px | Regular (400) | 20px | Labels, métadonnées |
| `small` | 12px | Regular (400) | 16px | Footnotes, badges |

---

## 📐 Spacing

| Token | Valeur | Usage |
|-------|--------|-------|
| `xs` | 4px | Micro-espacements |
| `sm` | 8px | Entre éléments liés |
| `md` | 16px | Padding standard |
| `lg` | 24px | Entre sections |
| `xl` | 32px | Marges de page |
| `xxl` | 48px | Grands espacements |

### Safe Areas
- **Top padding:** Status bar height + `md`
- **Bottom padding:** Home indicator + `lg`
- **Horizontal padding:** `xl` (32px)

---

## 🔲 Border Radius

| Token | Valeur | Usage |
|-------|--------|-------|
| `sm` | 8px | Petits éléments, badges |
| `md` | 12px | Boutons, inputs |
| `lg` | 16px | Cards |
| `xl` | 24px | Modals, grandes cards |
| `full` | 9999px | Pills, avatars |

---

## 🌑 Shadows (Dark Mode Focus)

| Token | Valeur | Usage |
|-------|--------|-------|
| `none` | - | Flat elements |
| `sm` | `0 1px 2px rgba(0,0,0,0.3)` | Légère élévation |
| `md` | `0 4px 12px rgba(0,0,0,0.4)` | Cards |
| `lg` | `0 8px 24px rgba(0,0,0,0.5)` | Modals, popovers |

---

## 🔘 Composants

### Button

| Variante | Background | Text | Border |
|----------|------------|------|--------|
| `primary` | `primary` | white | none |
| `secondary` | transparent | `primary` | `primary` 1px |
| `ghost` | transparent | `text.secondary` | none |
| `danger` | `error` | white | none |

**Specs:**
- Height: 48px (touch-friendly)
- Padding: 16px 24px
- Border radius: `md` (12px)
- Font: `bodyBold`

### Input

**Specs:**
- Height: 48px
- Padding: 12px 16px
- Border: 1px `border` color
- Border radius: `md` (12px)
- Background: `surface`
- Focus: 2px `primary` border

### Card

**Specs:**
- Padding: 16px
- Border radius: `lg` (16px)
- Background: `surface`
- Border: 1px `border` (optionnel)

### Tab Bar

**Specs:**
- Height: 80px (avec safe area)
- Background: `elevated` avec blur
- Icon size: 24px
- Label size: `small` (12px)
- Active: `primary` color
- Inactive: `text.muted`

---

## 📱 Layout Patterns

### Safe Area Template
```
┌─────────────────────────┐
│ ░░░░ Status Bar ░░░░░░░ │
├─────────────────────────┤
│                         │
│   ┌─────────────────┐   │
│   │     Header      │   │
│   └─────────────────┘   │
│                         │
│   ┌─────────────────┐   │
│   │                 │   │
│   │     Content     │   │
│   │    (scroll)     │   │
│   │                 │   │
│   └─────────────────┘   │
│                         │
├─────────────────────────┤
│ ░░░░░ Tab Bar ░░░░░░░░░ │
└─────────────────────────┘
```

### Horizontal Padding
- **Standard screens:** 24px (lg)
- **Full-bleed content:** 0px (images, carousels)

---

## 🎭 Animations

| Type | Duration | Easing |
|------|----------|--------|
| Fade | 200ms | ease-out |
| Slide | 300ms | ease-in-out |
| Spring | - | damping: 15, stiffness: 150 |
| Micro-interactions | 100ms | ease-out |

---

## ✅ Checklist pour l'IA

Quand tu codes un écran, vérifie :

- [ ] Couleurs depuis `theme.ts` (pas de valeurs hardcodées)
- [ ] Typographie cohérente avec l'échelle
- [ ] Spacing avec les tokens
- [ ] Border radius uniformes
- [ ] Support dark mode
- [ ] Safe areas respectées
- [ ] Touch targets ≥ 44x44px
- [ ] Accessibilité (labels, contraste)

---

## 📁 Fichiers Liés

- **Tokens TypeScript:** `ios/lib/theme.ts`
- **Composants themés:** `ios/components/Themed.tsx`
- **Couleurs constantes:** `ios/constants/Colors.ts`

---

*Dernière mise à jour: 2026-02-02*
