# FitTrack Design System
### UI/UX Pattern Guide — AI Frontend Refactor Reference

> Inspired by: Caliber app's clarity and hierarchy  
> Quality Target: Google Material You × Amazon's utility-first UX  
> Brand Palette: **Black + Green** (retained), typography and motion elevated

---

## 1. Design Philosophy

### Core Principles
1. **Clarity over decoration** — Every element earns its place
2. **Progressive disclosure** — Show what's needed, reveal on demand
3. **Kinetic confidence** — Transitions communicate structure, not just style
4. **Data as hero** — Numbers, progress and stats are the primary visual language
5. **Touch-first density** — Comfortable tap targets, information-dense without clutter

### Personality Keywords
`Precise` · `Athletic` · `Dark + Energized` · `Trustworthy` · `Fast`

---

## 2. Color Tokens

```css
/* === Core Brand === */
--color-bg-base:        #0A0A0A;   /* Near-black base */
--color-bg-surface:     #111111;   /* Card/panel background */
--color-bg-elevated:    #1A1A1A;   /* Modal, dropdown, floating */
--color-bg-input:       #1F1F1F;   /* Input fields */

/* === Green Accent System === */
--color-accent-primary:   #00E676;   /* Primary CTA, active states, success */
--color-accent-mid:       #00C853;   /* Secondary actions, progress fills */
--color-accent-deep:      #00873A;   /* Hover state, filled buttons */
--color-accent-glow:      rgba(0, 230, 118, 0.15); /* Glow/aura behind key elements */
--color-accent-subtle:    rgba(0, 230, 118, 0.08); /* Selected row backgrounds */

/* === Text === */
--color-text-primary:    #F5F5F5;   /* Headings, labels */
--color-text-secondary:  #A0A0A0;   /* Sub-labels, hints */
--color-text-tertiary:   #5A5A5A;   /* Disabled, placeholder */
--color-text-inverse:    #0A0A0A;   /* Text on green buttons */

/* === Semantic === */
--color-error:     #FF4D4D;
--color-warning:   #FFB300;
--color-info:      #40C4FF;
--color-success:   #00E676;   /* Same as accent-primary */

/* === Borders === */
--color-border-subtle:  rgba(255,255,255,0.06);
--color-border-default: rgba(255,255,255,0.10);
--color-border-strong:  rgba(255,255,255,0.18);
--color-border-accent:  rgba(0, 230, 118, 0.30);
```

---

## 3. Typography System

### Font Stack
```css
/* Display / Headers — Strong, athletic character */
@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800&display=swap');

/* Body / UI — Clean, readable, modern */
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&display=swap');

/* Monospace — Metrics, numbers, data */
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600&display=swap');

:root {
  --font-display: 'Barlow Condensed', sans-serif;
  --font-body:    'DM Sans', sans-serif;
  --font-mono:    'JetBrains Mono', monospace;
}
```

### Type Scale
| Token | Font | Size | Weight | Line-height | Use |
|---|---|---|---|---|---|
| `--text-hero` | Display | 48px | 800 | 1.0 | Page titles, score cards |
| `--text-h1` | Display | 32px | 700 | 1.1 | Screen headers |
| `--text-h2` | Display | 24px | 600 | 1.2 | Section titles |
| `--text-h3` | Body | 18px | 600 | 1.3 | Card headers, exercise names |
| `--text-body-lg` | Body | 16px | 400 | 1.5 | Primary body text |
| `--text-body` | Body | 14px | 400 | 1.5 | Default UI text |
| `--text-small` | Body | 12px | 400 | 1.4 | Captions, meta labels |
| `--text-label` | Body | 11px | 600 | 1.2 | ALL CAPS badges, tags |
| `--text-metric` | Mono | 28px | 600 | 1.0 | Weights, reps, scores |
| `--text-metric-lg` | Mono | 48px | 600 | 1.0 | Strength score, PRs |

### Typography Rules
- All-caps labels use `letter-spacing: 0.08em`
- Metric numbers always use `--font-mono` for alignment stability
- Display headings can go condensed/italic for emphasis
- Never use more than 2 font families per screen

---

## 4. Spacing & Layout Grid

```css
/* === 4pt Base Grid === */
--space-1:   4px;
--space-2:   8px;
--space-3:  12px;
--space-4:  16px;
--space-5:  20px;
--space-6:  24px;
--space-8:  32px;
--space-10: 40px;
--space-12: 48px;
--space-16: 64px;

/* === Container === */
--layout-max-width:    1280px;
--layout-gutter:       16px;   /* Mobile */
--layout-gutter-md:    24px;   /* Tablet */
--layout-gutter-lg:    40px;   /* Desktop */

/* === Component Padding === */
--card-padding:        16px 20px;
--card-padding-lg:     20px 24px;
--list-item-padding:   14px 20px;
--input-padding:       12px 16px;
--button-padding:      14px 24px;
--button-padding-sm:   10px 18px;
```

---

## 5. Border Radius

```css
--radius-xs:   4px;   /* Tags, small chips */
--radius-sm:   8px;   /* Inputs, small cards */
--radius-md:  12px;   /* Standard cards */
--radius-lg:  16px;   /* Large cards, modals */
--radius-xl:  24px;   /* Bottom sheets, hero panels */
--radius-full: 9999px; /* Pills, avatars, toggle */
```

---

## 6. Elevation & Shadows

```css
/* Cards and surfaces use borders rather than box-shadow for depth on dark backgrounds */
--shadow-none:    none;
--shadow-sm:      0 1px 3px rgba(0,0,0,0.4);
--shadow-md:      0 4px 12px rgba(0,0,0,0.5);
--shadow-lg:      0 8px 24px rgba(0,0,0,0.6);
--shadow-xl:      0 16px 48px rgba(0,0,0,0.7);

/* Green glow — for primary CTA and active metric cards */
--shadow-glow-sm: 0 0 12px rgba(0, 230, 118, 0.25);
--shadow-glow-md: 0 0 24px rgba(0, 230, 118, 0.30);
--shadow-glow-lg: 0 0 48px rgba(0, 230, 118, 0.20);
```

---

## 7. Component Patterns

### 7.1 Cards
```
Surface:     --color-bg-surface
Border:      1px solid --color-border-subtle
Radius:      --radius-md (12px)
Padding:     --card-padding

Hover state:
  Border:    1px solid --color-border-accent
  Transform: translateY(-1px)
  Transition: 180ms ease

Active/selected:
  Background: --color-accent-subtle
  Border:     1px solid --color-border-accent
```

**Card types:**
- **MetricCard** — Large number (--text-metric-lg), label below, optional delta indicator
- **ExerciseCard** — Muscle diagram icon + name + set/rep target, right arrow
- **SessionCard** — Date header + stacked set rows
- **SummaryCard** — Horizontal stat strip (volume / sets / duration)

---

### 7.2 Buttons

```
Primary CTA:
  Background:  --color-accent-primary
  Color:       --color-text-inverse
  Font:        --font-body, 15px, weight 600
  Padding:     --button-padding
  Radius:      --radius-full
  Box-shadow:  --shadow-glow-sm
  Hover:       background → --color-accent-deep, shadow → --shadow-glow-md
  Active:      scale(0.97)
  Transition:  150ms ease

Secondary:
  Background:  transparent
  Border:      1.5px solid --color-border-default
  Color:       --color-text-primary
  Hover:       border-color → --color-border-accent, color → --color-accent-primary

Ghost/Text:
  Background:  transparent
  Color:       --color-accent-primary
  No border

Destructive:
  Background:  rgba(255, 77, 77, 0.12)
  Border:      1px solid rgba(255,77,77,0.30)
  Color:       --color-error

Disabled state (all):
  Opacity: 0.38, pointer-events: none
```

---

### 7.3 Input Fields

```
Background:     --color-bg-input
Border:         1px solid --color-border-default
Border-radius:  --radius-sm
Padding:        --input-padding
Color:          --color-text-primary
Font:           --font-body, 15px

Focus:
  Border:       1.5px solid --color-accent-primary
  Box-shadow:   0 0 0 3px rgba(0, 230, 118, 0.12)
  Outline:      none

Placeholder:    --color-text-tertiary

Number / metric inputs:
  Font:         --font-mono, --text-metric
  Text-align:   center

Label position: Above input, --text-small, --color-text-secondary
Helper/error:   Below input, --text-small
```

---

### 7.4 Tab Navigation (Top)

```
Container:
  Background:  transparent
  Border-bottom: 1px solid --color-border-subtle

Tab item:
  Font:        --font-body, 14px, weight 500
  Color:       --color-text-secondary
  Padding:     12px 16px
  Position:    relative

Active tab:
  Color:       --color-accent-primary
  Font-weight: 600

Active indicator:
  Position:    absolute, bottom: -1px
  Height:      2px
  Background:  --color-accent-primary
  Transition:  left, width 250ms cubic-bezier(0.4, 0, 0.2, 1)  ← sliding underline
  Border-radius: 2px 2px 0 0
```

---

### 7.5 Bottom Navigation Bar

```
Background:    --color-bg-surface
Border-top:    1px solid --color-border-subtle
Height:        64px (+ safe-area-inset-bottom)
Padding:       0 --space-4

Icon size:     24px
Label:         --text-small, weight 500
Inactive:      --color-text-tertiary
Active:        --color-accent-primary

Active icon:   optional 32px green pill background (--color-accent-subtle, radius: --radius-full)
Transition:    color, transform 150ms ease
Active scale:  icon scale(1.1) on selection

No borders between items, equal spacing flex layout
```

---

### 7.6 Set Row (Exercise Tracking)

```
Container:
  Background:   --color-bg-surface
  Border:       1px solid --color-border-subtle
  Border-radius: --radius-sm
  Padding:      --list-item-padding

Layout:         [Set label] [Weight input] [Reps input] [✓ complete]

Set label:
  Font:         --font-body, weight 600, 15px
  Color:        --color-text-primary
  Min-width:    56px

Input boxes:
  Background:   --color-bg-input
  Border-radius: --radius-sm
  Font:         --font-mono, 20px, weight 600
  Color:        --color-text-primary
  Text-align:   center

"Last: X" hint:
  Font:         --text-small
  Color:        --color-text-tertiary
  Display:      block below input

Completed row:
  Background:   --color-accent-subtle
  Border-color: --color-border-accent
  Set label:    --color-accent-primary

Completion checkmark:
  Icon:         circle → checkmark
  Color:        --color-accent-primary
  Animation:    scale 0→1, 200ms spring
```

---

### 7.7 Personal Best / Metric Cards

```
Layout:         Label left, value + date right
Font value:     --font-mono, 18px, weight 600
Font date:      --text-small, --color-text-tertiary
Separator:      1px solid --color-border-subtle between rows
PR badge:       green pill "PR" tag on new records — --color-accent-primary bg, --color-text-inverse
```

---

### 7.8 Progress / Strength Score

```
Gauge arc:
  Stroke:       --color-accent-primary
  Track:        --color-bg-elevated
  Thickness:    8px
  Animation:    stroke-dashoffset draw from 0, 800ms ease-out on mount

Score number:
  Font:         --font-display, --text-hero, weight 800
  Color:        --color-text-primary

Level badge:
  Background:   --color-accent-deep
  Color:        --color-text-inverse
  Font:         --text-label, ALL CAPS, letter-spacing: 0.1em
  Radius:       --radius-full
  Padding:      4px 12px

Delta indicator:
  ▲ / ▼ + number
  Color:        green for positive / --color-error for negative
  Font:         --text-small, weight 600
```

---

### 7.9 Bottom Sheet / Modal

```
Overlay:        rgba(0,0,0,0.75), backdrop-filter: blur(4px)
Sheet:
  Background:   --color-bg-elevated
  Border-radius: --radius-xl --radius-xl 0 0
  Padding-top:  8px (drag handle)

Drag handle:
  Width:  40px, Height: 4px
  Background: --color-border-strong
  Radius: --radius-full
  Margin: 0 auto --space-4

Enter animation:  translateY(100%) → translateY(0), 320ms cubic-bezier(0.32, 0.72, 0, 1)
Exit animation:   translateY(0) → translateY(100%), 240ms ease-in
```

---

### 7.10 List Items (Menu / Settings)

```
Height:         56px
Padding:        0 20px
Background:     transparent
Hover:          --color-bg-elevated

Icon:           24px, color --color-accent-mid, background --color-bg-elevated, radius --radius-sm, padding 6px
Label:          --text-body-lg, --color-text-primary
Sublabel:       --text-small, --color-text-secondary
Right element:  chevron (--color-text-tertiary) or toggle or badge

Separator:      1px solid --color-border-subtle, inset left 20px (icon offset)
```

---

### 7.11 Date Section Headers

```
Font:           --font-display, 13px, weight 700, ALL CAPS
Color:          --color-accent-primary
Letter-spacing: 0.10em
Padding:        --space-5 --space-4 --space-2
Background:     transparent (no background fill)
```

---

## 8. Motion & Transitions

### Transition Tokens
```css
--ease-default:   cubic-bezier(0.4, 0, 0.2, 1);   /* Standard */
--ease-decelerate: cubic-bezier(0, 0, 0.2, 1);     /* Enter */
--ease-accelerate: cubic-bezier(0.4, 0, 1, 1);     /* Exit */
--ease-spring:    cubic-bezier(0.32, 0.72, 0, 1);  /* Bottom sheet, bounce */

--duration-instant:   80ms;
--duration-fast:     150ms;
--duration-default:  250ms;
--duration-slow:     350ms;
--duration-enter:    320ms;
--duration-exit:     240ms;
```

### Page Transitions
```
Page push (navigate forward):
  Outgoing:  translateX(0) opacity(1) → translateX(-30%) opacity(0), 240ms accelerate
  Incoming:  translateX(30%) opacity(0) → translateX(0) opacity(1), 320ms decelerate

Page pop (back):
  Outgoing:  translateX(0) opacity(1) → translateX(30%) opacity(0), 200ms accelerate
  Incoming:  translateX(-30%) opacity(0) → translateX(0) opacity(1), 280ms decelerate

Tab switch:
  Sliding underline: 250ms --ease-default
  Content: opacity 0→1, translateY(6px→0), 200ms ease
```

### Micro-interactions
```
Button press:       scale(0.97), 100ms
Set completion:     checkmark scale 0→1.2→1, 220ms spring + green row flash
Card hover:         translateY(-1px) + border glow, 180ms
Number increment:   count-up animation, 400ms ease-out
Progress fill:      width or stroke-dash, 600ms ease-out
Screen mount:       staggered cards fade+slide up (delay: index × 40ms)
```

---

## 9. Icon System

- **Library**: Phosphor Icons (outline weight by default, fill for active/selected states)
- **Sizes**: 16px (inline), 20px (list), 24px (nav), 32px (feature icons)
- **Color**: Inherit from context (active = accent, inactive = tertiary)
- **Never**: mix icon families on the same screen
- **Muscle diagram icons**: SVG anatomy maps, primary muscle in `--color-accent-primary`, secondary in `--color-accent-subtle`

---

## 10. Screen Layout Templates

### 10.1 Exercise Detail Screen
```
┌─────────────────────────────────┐
│ ← Back        Title       [···] │  Header (56px, bg-surface, border-bottom)
├─────────────────────────────────┤
│  [Track] [Overview] [History] [Notes] │  Tab bar
├─────────────────────────────────┤
│                                 │
│  Hero image / exercise photo    │  Image (aspect 16:9, radius bottom 0)
│                                 │
├─────────────────────────────────┤
│  Exercise Name                  │  h2
│  Reps: 8-12  ·  Rest: 1 min    │  body secondary
│  [⏱] [⏰] [📹]                 │  action pills
├─────────────────────────────────┤
│  Set 1   [  100  lbs]  [ 12 reps] │  Set rows
│  Set 2   [      lbs]  [    reps]  │
│  ...                            │
│  + Add Set                      │
│  [Complete Exercise ──────────] │  CTA button (full width, green)
└─────────────────────────────────┘
```

### 10.2 Dashboard / Home Screen
```
┌─────────────────────────────────┐
│  [C] BRAND              [+]     │  Dark header
│                                 │
│  ┌─────────────────────────┐    │  Strength Score card
│  │    ▲ 1 pt    182        │    │  (bg-elevated, glow border)
│  │    ━━━●━━━━━━━━━        │    │
│  │    BEGINNER             │    │
│  └─────────────────────────┘    │
│                                 │
│  This Week          [calendar]  │  Section
│  S  M  T  W  T  F  S           │  Calendar strip
│     ○  ●  ○  ○  ○  ○           │
│                                 │
│  ┌─────────────────────────┐    │  Today's workout card
│  │ A Day 1              >  │    │
│  └─────────────────────────┘    │
└─────────────────────────────────┘
```

### 10.3 Plans Screen
```
Header: "Plans" centered
Tabs: Workouts | Nutrition
Default plan card: prominent, full-width, white bg (surface elevated)
"All Plans" section: 2-column grid for Create/Browse
```

---

## 11. Responsive Breakpoints

```css
--bp-sm:  480px;   /* Large phones */
--bp-md:  768px;   /* Tablets */
--bp-lg:  1024px;  /* Small desktop */
--bp-xl:  1280px;  /* Desktop */
```

Mobile-first. All core UX designed for 375–430px viewport width.

---

## 12. Accessibility Requirements

- **Touch targets**: minimum 44×44px
- **Contrast**: text on bg-surface ≥ 4.5:1 (WCAG AA)
- **Accent on dark**: `#00E676` on `#111111` = 8.2:1 ✅
- **Focus indicators**: 2px solid --color-accent-primary, offset 2px
- **Motion**: Respect `prefers-reduced-motion` — disable slide/scale transforms, keep opacity fades only
- **Font sizes**: No UI text below 11px
- **Screen reader**: All icon buttons have `aria-label`, inputs have `htmlFor`/`id`

---

## 13. AI Designer Prompt Addendum

When using this system to refactor UI screens, the AI designer should:

1. **Always use `--font-display` (Barlow Condensed) for all headings** — this is the primary brand differentiator
2. **Metric numbers (weights, reps, scores) always use `--font-mono` (JetBrains Mono)** — tabular, precise, athletic
3. **Primary green `#00E676` is reserved for**: active states, CTAs, progress, PRs, and completed items. Not decorative
4. **Transitions are mandatory** on: tab switches, page navigation, set completion, score updates
5. **Dark backgrounds are the default** — `#0A0A0A` base, `#111111` surface. White/light surfaces only for floating elements
6. **Stagger entrance animations** for list items: `animation-delay: calc(index × 40ms)`
7. **Bottom sheets** for all contextual actions — avoid full-screen modals for quick interactions
8. **Avoid borders on buttons** when possible — use background fill or glow for primary, ghost style for secondary
9. **Section date headers** must use ALL CAPS + green, never gray
10. **Navigation bar** active state uses green icon + pill background, not just color change

---

*Last updated: April 2026 · FitTrack Design System v1.0*