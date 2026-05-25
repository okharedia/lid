# Material Design 3 for the Web — A Definitive Reference (May 2026)

## TL;DR
- **MD3 on the web is a "tokens-first, framework-second" problem**: Google's own component library `@material/web` has been in maintenance mode since June 2024, so the durable strategy is to consume MD3 via design tokens (CSS custom properties exported from Material Theme Builder) and pair them with either Angular Material (M3 stable since Angular v18, May 22, 2024) or a non-Google web library — *not* to bet on Google shipping new web components.
- **MUI is still not MD3**: MUI v9 (April 8, 2026) does not implement Material Design 3; the MUI team has punted MD3 to "the next major" as part of refactoring the styling layer.
- **Material 3 Expressive (May 13, 2025) is an evolution, not M4** — physics-based spring motion, 35-shape library with morphing, emphasized type, taller/bolder components. As of May 2026 Expressive ships on Android/Wear OS but **is not implemented on the web in any first-party library**.

---

## 1. Foundations & Philosophy

### 1.1 What MD3 is
Material Design 3 (codename **Material You**, released with Android 12 in October 2021) is the third revision of Google's open-source design system. Its three-word ethos is **personal, adaptive, expressive**:

- **Personal** — user-driven dynamic color (wallpaper-derived theme propagated across OS and apps) replaces MD2's brand-first palette.
- **Adaptive** — opinionated window-size-class breakpoints and canonical layouts replace fixed-pixel responsive grids.
- **Expressive** — shape, motion, color, and typography are orchestrated as four systems for emotional resonance.

A token-based architecture (reference → system → component) is the structural idea: every visual decision is a named token, and themes are swaps of references.

### 1.2 MD3 vs MD2 — what actually changed
| Area | MD2 | MD3 |
| --- | --- | --- |
| Color | Hand-picked primary/secondary | HCT-based dynamic color from a seed; 5 key colors × 13-tone palettes; 30+ roles including 7 tone-based surface containers |
| Elevation | Shadows + opacity overlays in dark mode | **Tonal elevation** (surface tint from primary) is default; shadows reserved for FAB, dialogs |
| Type scale | Headline 1–6, Subtitle, Body 1–2, Button, Caption, Overline (13) | Display / Headline / Title / Body / Label × L/M/S (15); Expressive adds 15 emphasized styles (30 total) |
| Shape | 3 categories | 7-step corner scale; 35-shape morphing library (Expressive) |
| Motion | Standard/decel/accel/sharp béziers | Tokenized easing+duration; Expressive adds spring physics |
| Components | Bottom navigation, etc. | Navigation bar with pill indicator; filled-tonal & segmented buttons; FAB menu, split button (Expressive) |
| Deprecations | — | `background`, `onBackground`, `surfaceVariant` removed/legacy |
| Personalization | None | Dynamic color from wallpaper (Android 12+) |
| Theming | Hard-coded or Sass maps | Design tokens (W3C-DTCG-compatible) |

### 1.3 Material 3 Expressive (May 13, 2025)
At The Android Show: I/O Edition, Google unveiled M3 Expressive. Per Mindy Brooks, VP of Product Management for Android Platform (blog.google): "Material 3 Expressive — one of our biggest updates in years — is all about making your device feel unique to you. … Material 3 Expressive feels even more fluid and introduces a system of more natural, springy animations." It is **not** "M4"; the Material team's framing: "Material 3 Expressive represents our most deeply researched update to the design system since its inception in 2014. Informed by extensive user research, encompassing 46 studies and over 18,000 participants."

Research themes: bigger touch targets, asymmetric shapes for "visual tension," 2.5D containment (cards inside cards) to fix flat-design ambiguity, spring motion, and emphasized type as editorial accent. Rollout: Pixel 6+ via Android 16 QPR1 (September 2025 Pixel Drop); Gmail, Calendar, Keep, Chrome, Docs/Sheets/Slides, Drive in late 2025.

---

## 2. Color System (the heart of MD3)

### 2.1 HCT vs HSL/RGB
MD3's color math runs in **HCT** (Hue, Chroma, Tone), perceptually-uniform on top of CIE-L\* and CAM16. Per m3.material.io: "Material uses a color space called HCT, which quantifies all colors using three dimensions, Hue, Chroma, and Tone." Key property: **two colors with the same Tone have the same perceived lightness regardless of Hue** — which is what makes tone-paired color roles automatically meet contrast requirements. HSL/RGB don't have this — a "50% lightness" yellow and blue look very different.

- **Hue:** 0–360 circular.
- **Chroma:** 0 (gray) to ~120 max in HCT (varies by gamut).
- **Tone:** 0 (black) to 100 (white). Contrast pairs are built around this.

### 2.2 The 13-tone tonal palette
A tonal palette is a single hue/chroma sampled at 13 fixed tones: `0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 95, 99, 100`. From a single source color, MD3 derives 5 **key colors** (primary, secondary, tertiary, neutral, neutral-variant) and builds a 13-tone palette for each — 65 tones total. Per the Material Color Utilities concept doc: "The tonal palette contains 13 tones from black, tone 0, to white, tone 100. … This full set of five tonal palettes is the basis of a Material color scheme."

### 2.3 Color roles (full list, ~30 roles)
Roles always come in pairs (`X` + `on-X`) so contrast is guaranteed.

| Group | Roles |
| --- | --- |
| Primary | `primary`, `on-primary`, `primary-container`, `on-primary-container` |
| Secondary | `secondary`, `on-secondary`, `secondary-container`, `on-secondary-container` |
| Tertiary | `tertiary`, `on-tertiary`, `tertiary-container`, `on-tertiary-container` |
| Error | `error`, `on-error`, `error-container`, `on-error-container` |
| Surface | `surface`, `surface-dim`, `surface-bright`, `surface-container-lowest`, `surface-container-low`, `surface-container`, `surface-container-high`, `surface-container-highest`, `on-surface`, `on-surface-variant`, `surface-variant` (legacy) |
| Inverse | `inverse-surface`, `inverse-on-surface`, `inverse-primary` |
| Outline | `outline`, `outline-variant` |
| Other | `surface-tint`, `scrim`, `shadow` |

The seven **tone-based surface containers** replace MD2's "elevation overlay" pattern. Per Flutter Issue #137679 quoting the M3 spec: in light mode they sit at N98 (surface), N96 (low), N94 (default), N92 (high), N90 (highest); surface-bright N98, surface-dim N87. Dark mode inverts: N6 surface, N10/N12/N17/N22 containers, N24 bright, N6 dim. This means **the same component renders consistently regardless of nesting depth** — pick a surface container role for containment intent, not for elevation level.

Concomitant deprecations: `background`, `onBackground`, `surfaceVariant` are legacy. Replace `background → surface`, `onBackground → onSurface`, `surfaceVariant → surfaceContainerHighest`.

### 2.4 Light vs dark schemes
Both are derived from the same five tonal palettes, mapping roles to different tones. Light: `primary` is tone 40, `on-primary` is tone 100. Dark: `primary` is tone 80, `on-primary` is tone 20. Same palettes produce both schemes — which is why generated themes always have a coherent dark mode.

### 2.5 Contrast levels (Standard, Medium, High)
MD3 defines three contrast levels: standard = 0.0, medium = 0.5, high = 1.0 (API accepts -1.0 to 1.0). Per Flutter's `color_scheme.dart` (the canonical implementation mirroring the M3 spec): "The `contrastLevel` parameter indicates the contrast level between color pairs… 0.0 is the default (normal); -1.0 is the lowest; 1.0 is the highest. From Material Design guideline, the medium and high contrast correspond to 0.5 and 1.0 respectively." Each contrast level produces a full color scheme; combined with light/dark you get **six baseline themes per source color** that you should generate up front.

### 2.6 Dynamic scheme variants
Material Color Utilities exposes nine variants: `MONOCHROME`, `NEUTRAL`, `TONAL_SPOT` (default), `VIBRANT`, `EXPRESSIVE`, `FIDELITY`, `CONTENT`, `RAINBOW`, `FRUIT_SALAD`. Per Flutter API docs:
- **tonalSpot** — default; pastel low-chroma palettes (stock M3 look).
- **fidelity** — preserves seed color even at high chroma. Best when brand color is non-negotiable.
- **content** — like fidelity, tuned for image-derived sources.
- **vibrant** — primary palette at maximum chroma.
- **expressive** — added with M3 Expressive; bolder, more saturated.
- **monochrome / neutral** — grayscale / near-grayscale.
- **rainbow / fruit_salad** — multi-hue playful variants.

### 2.7 Generating a scheme — Material Color Utilities
MCU (`material-foundation/material-color-utilities`, JS/TS/Java/Swift/Dart/C++) is the canonical algorithm:
```js
import { argbFromHex, themeFromSourceColor, hexFromArgb } from "@material/material-color-utilities";
const theme = themeFromSourceColor(argbFromHex("#1A73E8"), [
  { name: "brand-accent", value: argbFromHex("#FFAA00"), blend: true }
]);
// theme.schemes.light, theme.schemes.dark, theme.palettes.primary, etc.
```
For variants, use `DynamicScheme` subclasses (`SchemeTonalSpot`, `SchemeVibrant`, `SchemeExpressive`) with a `contrastLevel`.

### 2.8 Accessibility & WCAG
Per Compose docs: "All Material components and dynamic theming already use the above color roles from a set of tonal palettes, selected to meet accessibility requirements." Tone-paired roles target WCAG AA 4.5:1 at standard contrast; medium (0.5) pushes toward ~7:1; high (1.0) goes further. **Dynamic color does not guarantee AA on its own** when you pair non-on roles (e.g., `primary` text on `secondary-container`). Always pair `X` with `on-X` or test contrast.

### 2.9 CSS tokens example
```css
:root {
  /* System tokens — mapped per scheme */
  --md-sys-color-primary: #6750A4;
  --md-sys-color-on-primary: #FFFFFF;
  --md-sys-color-primary-container: #EADDFF;
  --md-sys-color-on-primary-container: #21005D;
  --md-sys-color-surface: #FEF7FF;
  --md-sys-color-surface-container-lowest: #FFFFFF;
  --md-sys-color-surface-container-low: #F7F2FA;
  --md-sys-color-surface-container: #F1ECF4;
  --md-sys-color-surface-container-high: #ECE6EE;
  --md-sys-color-surface-container-highest: #E6E0E9;
  --md-sys-color-on-surface: #1D1B20;
  --md-sys-color-on-surface-variant: #49454F;
  --md-sys-color-outline: #79747E;
  --md-sys-color-outline-variant: #CAC4D0;
}
@media (prefers-color-scheme: dark) {
  :root {
    --md-sys-color-primary: #D0BCFF;
    --md-sys-color-on-primary: #381E72;
    /* …full dark scheme… */
  }
}
```

---

## 3. Typography

### 3.1 The 15-token type scale
Five **roles** × three **sizes** = 15 tokens. Default font: Roboto (or Roboto Flex variable).

| Token | Size | Line height | Weight | Tracking | Use |
| --- | --- | --- | --- | --- | --- |
| Display Large | 57 | 64 | 400 | -0.25 | Hero text |
| Display Medium | 45 | 52 | 400 | 0 | |
| Display Small | 36 | 44 | 400 | 0 | |
| Headline Large | 32 | 40 | 400 | 0 | Section heros |
| Headline Medium | 28 | 36 | 400 | 0 | |
| Headline Small | 24 | 32 | 400 | 0 | |
| Title Large | 22 | 28 | 400 | 0 | App bars, dialog titles |
| Title Medium | 16 | 24 | 500 | 0.15 | Card headers |
| Title Small | 14 | 20 | 500 | 0.1 | |
| Body Large | 16 | 24 | 400 | 0.5 | Paragraphs |
| Body Medium | 14 | 20 | 400 | 0.25 | |
| Body Small | 12 | 16 | 400 | 0.4 | |
| Label Large | 14 | 20 | 500 | 0.1 | Button labels |
| Label Medium | 12 | 16 | 500 | 0.5 | |
| Label Small | 11 | 16 | 500 | 0.5 | Captions |

### 3.2 Emphasized type (Expressive)
M3 Expressive adds 15 parallel **emphasized** tokens (`titleLargeEmphasized`, etc.) with heavier weight and tighter tracking, intended for editorial accents — selected list items, hero headlines, key CTAs. Not yet implemented in `@material/web` or Angular Material; apply by hand on web today.

### 3.3 Variable fonts and brand customization
Pair **Roboto Flex** (body) for variable axes `wght` (100–1000), `wdth` (25–151%), `GRAD`, `opsz`, with a brand display font. The MD3 token system splits typography into a **brand** typeface and a **plain** typeface:

```css
:root {
  --md-ref-typeface-brand: 'Your Display Font', sans-serif;
  --md-ref-typeface-plain: 'Roboto Flex', system-ui, sans-serif;
}
@font-face {
  font-family: 'Roboto Flex';
  src: url('/fonts/RobotoFlex.woff2') format('woff2-variations');
  font-weight: 100 1000;
  font-stretch: 25% 151%;
  font-display: swap;
}
```

### 3.4 Applying type tokens
```css
.md-typescale-body-large {
  font-family: var(--md-sys-typescale-body-large-font);
  font-size: var(--md-sys-typescale-body-large-size);
  line-height: var(--md-sys-typescale-body-large-line-height);
  font-weight: var(--md-sys-typescale-body-large-weight);
  letter-spacing: var(--md-sys-typescale-body-large-tracking);
}
```
`@material/web` exports `@material/web/typography/md-typescale-styles.js`; adopt into `adoptedStyleSheets` to get `.md-typescale-<role>-<size>` classes for free.

Override `--md-ref-typeface-brand` and `--md-ref-typeface-plain` globally; or `--md-sys-typescale-<role>-font` per role. Avoid overriding individual sizes — the size/line-height/tracking ratios are tuned together.

---

## 4. Shape System

### 4.1 Corner radius scale (10 steps in Expressive)
| Token | Radius | Typical use |
| --- | --- | --- |
| `corner-none` | 0 | Bottom sheets edge, images |
| `corner-extra-small` | 4 | Chips (small), text fields, search bar |
| `corner-small` | 8 | Snackbars, tooltips |
| `corner-medium` | 12 | Cards, menus, dialogs (default) |
| `corner-large` | 16 | Containers, FAB |
| `corner-large-increased` (Expressive) | 20 | Tonal containers |
| `corner-extra-large` | 28 | Floating sheets, dialogs (alt) |
| `corner-extra-large-increased` (Expressive) | 32 | Bottom sheets, hero containers |
| `corner-extra-extra-large` (Expressive) | 48 | Expressive heroes |
| `corner-full` | 9999px | Pill buttons, FAB extended |

```css
:root {
  --md-sys-shape-corner-none: 0px;
  --md-sys-shape-corner-extra-small: 4px;
  --md-sys-shape-corner-small: 8px;
  --md-sys-shape-corner-medium: 12px;
  --md-sys-shape-corner-large: 16px;
  --md-sys-shape-corner-large-increased: 20px;
  --md-sys-shape-corner-extra-large: 28px;
  --md-sys-shape-corner-extra-large-increased: 32px;
  --md-sys-shape-corner-extra-extra-large: 48px;
  --md-sys-shape-corner-full: 9999px;
}
```

### 4.2 Component defaults and morphing
Buttons → `full`; FAB → `large`; cards → `medium`; dialogs → `extra-large`; text fields → `extra-small`. Override with `--md-<component>-container-shape`.

M3 Expressive ships **35 shapes** and **shape morphing** between two shapes on interaction. Implemented in Jetpack Compose's `material3` library but **not in `@material/web`**. Approximate on web via `clip-path` animations or SVG morphing (Rive, GSAP MorphSVG).

---

## 5. Elevation

### 5.1 Six levels, mostly tonal
| Level | dp | Tint | Typical components |
| --- | --- | --- | --- |
| 0 | 0 | none | Filled buttons (resting), outlined cards |
| 1 | 1 | ~5% | Elevated cards, bottom sheets (resting) |
| 2 | 3 | ~8% | Navigation bar, menus, top app bar (scrolled) |
| 3 | 6 | ~11% | FAB (resting), search bar (active), dialogs |
| 4 | 8 | ~12% | Hover / focus on FAB |
| 5 | 12 | ~14% | Hover for high-emphasis surfaces |

Per Compose docs: "Material 3 represents elevation mainly using tonal color overlays. This is a new way to differentiate containers and surfaces from each other — increasing tonal elevation uses a more prominent tone — in addition to shadows."

### 5.2 When to use shadow vs tonal
Default to **tonal**. Use **shadow** (or shadow+tonal) only when:
- The element needs to feel physically lifted (FAB hover, drag affordance).
- It overlays content of varying colors (a menu over photos).
- It needs to stand out against scrim/modal backdrops.

In dark mode the tonal tint is primary-applied to surface — replacing MD2's white-overlay-on-elevated-dark-surface trick entirely. With the tone-based surface container system, **many components no longer need elevation at all** — pick `surface-container-high` instead of "elevation 2."

```css
.elevation-2 {
  background-color: color-mix(in srgb, var(--md-sys-color-surface) 92%, var(--md-sys-color-primary) 8%);
  box-shadow: 0 1px 2px rgba(0,0,0,0.3), 0 1px 3px 1px rgba(0,0,0,0.15);
}
/* Or simply: */
.surface-container-high { background: var(--md-sys-color-surface-container-high); }
```

---

## 6. Motion

### 6.1 Easing and duration tokens
| Easing token | Bezier |
| --- | --- |
| `motion-easing-emphasized` | `cubic-bezier(0.2, 0, 0, 1)` |
| `motion-easing-emphasized-decelerate` | `cubic-bezier(0.05, 0.7, 0.1, 1)` |
| `motion-easing-emphasized-accelerate` | `cubic-bezier(0.3, 0, 0.8, 0.15)` |
| `motion-easing-standard` | `cubic-bezier(0.2, 0, 0, 1)` |
| `motion-easing-standard-decelerate` | `cubic-bezier(0, 0, 0, 1)` |
| `motion-easing-standard-accelerate` | `cubic-bezier(0.3, 0, 1, 1)` |
| `motion-easing-linear` | `cubic-bezier(0, 0, 1, 1)` |

Duration tokens: `short1`=50ms, `short2`=100, `short3`=150, `short4`=200, `medium1`=250, `medium2`=300, `medium3`=350, `medium4`=400, `long1`=450, `long2`=500, `long3`=550, `long4`=600, `extra-long1–4`=700–1000ms.

Rule of thumb: **emphasized** = the user *should* notice (sheet opens, hero transition); **standard** = utility motion that should feel "free" (button press, hover).

### 6.2 Spring physics (Expressive)
M3 Expressive replaces easing+duration with **spring physics** parameterized by `stiffness` and `dampingRatio`. Two preset schemes:
- **Expressive scheme** (default): lower damping, noticeable overshoot/bounce. For hero moments.
- **Standard scheme**: higher damping, minimal bounce. For utilitarian motion.

Spatial tokens (position/size/scale) use springs; effects tokens (opacity/color) still use duration+easing. On the web, implement via Framer Motion (`spring: { stiffness: 400, damping: 32 }`), React Spring, Motion One, or the Web Animations API with custom easing.

### 6.3 Transitions and shared elements
MD3 defines several canonical transitions: **container transform** (an element morphs into a new surface, e.g., card → detail page), **forward/backward** (forward = accelerate then decelerate), **fade through** (one fades out, then the next fades in), **fade**, and **shared axis** (X/Y/Z motion linking two views). On the web, the **View Transitions API** (Chromium + Safari 18+) supports same-document and (in 2025+) cross-document transitions and maps well to container transform. For SPAs, Framer Motion's `layoutId` + `AnimatePresence` is the de-facto MD3 transition library.

### 6.4 Reduced motion
Always honor `prefers-reduced-motion: reduce` — durations to ~10ms, no translateY/X. Springs fall back to critically-damped (no overshoot) or a hard cut.
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 7. Layout & Spacing

### 7.1 Window size classes (5-tier in current MD3)
| Class | Width breakpoint | Typical device | Navigation |
| --- | --- | --- | --- |
| Compact | < 600dp | Phone portrait | Bottom navigation bar |
| Medium | 600 ≤ w < 840dp | Foldable portrait, small tablet | Navigation rail |
| Expanded | 840 ≤ w < 1200dp | Tablet landscape, small desktop | Navigation rail or standard drawer |
| Large | 1200 ≤ w < 1600dp | Desktop, large tablet | Standard or modal drawer |
| Extra-Large | ≥ 1600dp | External displays | Persistent drawer + extra panes |

For web, 1dp ≈ 1px on standard desktop displays. Practical breakpoints: 600/840/1200/1600px. **840px is the most important** — it's where you switch from single-pane to dual-pane layouts.

### 7.2 Canonical layouts
- **List-detail** — master list + detail pane (email, settings).
- **Supporting pane** — primary + secondary contextual pane (docs + comments).
- **Feed** — responsive card grid (social, news, gallery).
- **Single pane** — fallback for compact and content-heavy flows.

Three adaptation strategies: **show/hide** panes, **reflow** content into different layouts, **reposition** elements (bottom nav → rail).

### 7.3 Spacing — 4dp grid
Spacing tokens follow a 4dp base (`4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96`). Body margins per window size class:
- Compact: 16dp
- Medium: 24dp
- Expanded: 24dp + 200dp side panes
- Large/Extra-Large: 24dp + larger side panes

Body **max width** for readability: ~840dp (~75ch) regardless of class — don't stretch edge-to-edge on a 4K display.

---

## 8. Components — web-specific notes

### 8.1 Component coverage in `@material/web`
| Component | Element |
| --- | --- |
| Filled / outlined / text / elevated / tonal button | `<md-filled-button>`, `<md-outlined-button>`, `<md-text-button>`, `<md-elevated-button>`, `<md-filled-tonal-button>` |
| Icon button | `<md-icon-button>` (filled, outlined, tonal variants) |
| FAB | `<md-fab>`, `<md-branded-fab>` |
| Checkbox / Radio / Switch | `<md-checkbox>`, `<md-radio>`, `<md-switch>` |
| Slider | `<md-slider>` (with `range` for dual-thumb) |
| Chips (assist, filter, input, suggestion) | `<md-chip-set>` + `<md-*-chip>` |
| Text field | `<md-filled-text-field>`, `<md-outlined-text-field>` |
| Select | `<md-filled-select>`, `<md-outlined-select>` |
| Menu / Dialog / Tabs / Lists / Divider / Progress | `<md-menu>`, `<md-dialog>`, `<md-tabs>` + `<md-primary-tab>`/`<md-secondary-tab>`, `<md-list>`, `<md-divider>`, `<md-linear-progress>`, `<md-circular-progress>` |
| Primitives | `<md-ripple>`, `<md-focus-ring>`, `<md-elevation>` |

**Notably MISSING from `@material/web`** (must implement yourself): top app bar, bottom app bar, navigation bar, navigation rail, navigation drawer, snackbar, tooltip, date picker, time picker, search bar, segmented button, bottom sheet, badge. **This is the largest practical reason `@material/web` is unfit for full-app MD3.**

### 8.2 Component web pitfalls
- **Bottom navigation / navigation bar**: web users expect top placement on desktop. Switch to navigation rail above 600px.
- **FAB on web**: a desktop FAB feels out of place. Pin within an app card, or replace with an inline button on Expanded+.
- **Text fields**: MD3 floating labels animate position — ensure `prefers-reduced-motion` disables the animation. Outlined variant is more accessible on busy backgrounds.
- **Chips**: MD3 distinguishes 4 chip types by *function* (assist, filter, input, suggestion). Don't reuse filter chips for navigation — use Tabs.
- **Dialogs**: 28dp corners and `surface-container-high`. Use native `<dialog>` for free focus trap and ESC.
- **Snackbars**: max one at a time; dismiss 4–10s; never block the FAB — float above.
- **Tooltips**: plain (always-visible) vs rich (hover only). Don't put critical info in tooltips — touch users can't reliably trigger them.
- **Date/time pickers**: not in `@material/web`. Use a third-party library and theme with MD3 tokens.
- **Tabs (primary vs secondary)**: primary tabs sit directly under a top app bar with larger labels + indicator; secondary tabs nest inside a primary tab section.
- **Buttons (5 variants)**: filled (highest emphasis, one per screen), tonal (medium-high), elevated (medium, used on busy backgrounds), outlined (medium-low), text (low). FAB reserved for **screen's primary action**.
- **Segmented buttons**: not in `@material/web` — render a row of toggle buttons sharing a container with `border-radius: full` on outer corners.

---

## 9. Design Tokens

### 9.1 The three-tier model
1. **Reference tokens** (`--md-ref-*`) — raw palette tones, typefaces, primitive values. `--md-ref-palette-primary40: #6750A4;`
2. **System tokens** (`--md-sys-*`) — semantic roles referencing primitives. `--md-sys-color-primary: var(--md-ref-palette-primary40);`
3. **Component tokens** (`--md-<component>-*`) — per-component overrides. `--md-filled-button-container-color: var(--md-sys-color-primary);`

Theme switching (light↔dark, brand A↔B, standard↔high contrast) is a system-tier remap of references — component tokens never change. **That's the architectural payoff.**

### 9.2 Naming conventions
Pattern: `--md-<tier>-<category>-<role>-<modifier>`. Examples: `--md-sys-color-primary-container`, `--md-sys-typescale-body-large-line-height`, `--md-sys-shape-corner-extra-large`, `--md-sys-motion-easing-emphasized`.

### 9.3 W3C DTCG / Design System Package (DSP)
Material Theme Builder now exports a **Design System Package (DSP)** based on the W3C Design Tokens Community Group format (`$value`, `$type`). The `material-foundation/material-tokens` repo provides DSP schema and Style Dictionary configs to transform tokens into CSS, Sass, Compose, Swift, XML. Recommended pipeline:

```
Figma (Material Theme Builder plugin)
  → DSP JSON (W3C-compatible)
  → Style Dictionary
  → CSS custom properties / Sass / TS objects
  → consumed by components
```

```css
md-filled-button {
  --md-filled-button-container-color: var(--md-sys-color-primary);
  --md-filled-button-label-text-color: var(--md-sys-color-on-primary);
  --md-filled-button-container-shape: var(--md-sys-shape-corner-full);
  --md-filled-button-label-text-font: var(--md-sys-typescale-label-large-font);
}
```

---

## 10. Icons — Material Symbols

### 10.1 The new variable icon font
Per Google Fonts' official guide: "Material Symbols are our newest icons, consolidating over 2,500 glyphs in a single font file with a wide range of design variants." Three styles — **Outlined**, **Rounded**, **Sharp** — each with four variable axes:

| Axis | Range | Default | Purpose |
| --- | --- | --- | --- |
| `FILL` | 0–1 | 0 | Filled vs unfilled (animate for selected states with CSS transitions) |
| `wght` | 100–700 | 400 | Stroke weight |
| `GRAD` | -50 to 200 | 0 | Fine grade (negative reduces glare on dark; positive emphasizes) |
| `opsz` | 20–48 | 24 | Optical size — auto-adjusts stroke as icon scales |

The full library now covers 3,800+ icons; the "2,500 glyphs" is the launch baseline that Google's guide still cites for the single-file size envelope.

### 10.2 Web setup
```html
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=block" rel="stylesheet">
<span class="material-symbols-outlined">home</span>
<style>
.material-symbols-outlined {
  font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
  transition: font-variation-settings 200ms cubic-bezier(0.2, 0, 0, 1);
}
.material-symbols-outlined.selected {
  font-variation-settings: 'FILL' 1, 'wght' 500;
}
</style>
```

### 10.3 Performance — subset, always
Per Google Fonts' Material Symbols guide, **loading the full variable font with all axes is 7.9 MB**, while loading **a 3-icon subset (home, palette, settings) with only 2 fixed axes (FILL, ROND) is 2.6 KB**. Always subset for production with `&icon_names=`.

- `display=block` prevents the flash of unstyled ligatures while the font loads.
- Self-host via `@fontsource-variable/material-symbols-outlined` to avoid the Google Fonts CDN round trip.
- For React/Lit: prefer the variable font + ligature pattern when you use >20 icons; switch to SVG sprites when you use <20 icons (smaller bundle).

---

## 11. Implementation on the Web — all approaches

### 11.1 Honest state of MD3 on the web (May 2026)

| Approach | MD3 fidelity | Maintenance status | Recommended for |
| --- | --- | --- | --- |
| Vanilla CSS tokens + hand-rolled components | ★★★★★ | Yours forever | Greenfield projects, design-system teams |
| `@material/web` (Lit web components) | ★★★★ (no nav, no top app bar) | **Maintenance mode** since June 2024 | Prototypes, internal tools |
| Angular Material 18+ | ★★★★ (M3 theme; some MD2 carryover) | Actively developed | Angular apps |
| MUI (React) | ★★ (still MD2 visuals) | Actively developed; MD3 deferred post-v9 | React apps where MD2 look is acceptable |
| Vuetify (Vue) | ★★ (MD3-leaning semantic naming) | Actively developed | Vue apps with MD-flavored UI |
| Actify, m3-ui, Material Tailwind (React) | ★★★ | Community | React projects wanting MD3 look |
| Material 3 Expressive | None on web | n/a | Custom implementation only |

### 11.2 A. Framework-agnostic — vanilla CSS + tokens (the durable choice)
Workflow:
1. Open the **Material Theme Builder** (web or Figma plugin).
2. Pick a seed color or upload an image; choose a scheme variant.
3. Export **Web → CSS** (or DSP for a full token set).
4. Drop the CSS into `:root` (and a `.dark` class or `prefers-color-scheme` block).
5. Build components by composing native HTML with CSS that references tokens.

Pros: zero dependencies, future-proof, full control. Cons: you build every component; you implement focus rings, ripple, state layers yourself.

Skeletal MD3 filled button:
```css
.md-button-filled {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 24px;
  min-height: 40px;
  border: none;
  border-radius: var(--md-sys-shape-corner-full);
  background-color: var(--md-sys-color-primary);
  color: var(--md-sys-color-on-primary);
  font: var(--md-sys-typescale-label-large);
  cursor: pointer;
  position: relative;
  overflow: hidden;
  transition: background-color 200ms var(--md-sys-motion-easing-standard);
}
.md-button-filled:hover {
  background-color: color-mix(in srgb, var(--md-sys-color-primary) 92%, var(--md-sys-color-on-primary) 8%);
}
.md-button-filled:focus-visible {
  outline: 3px solid var(--md-sys-color-secondary);
  outline-offset: 2px;
}
.md-button-filled:disabled {
  background-color: color-mix(in srgb, var(--md-sys-color-on-surface) 12%, transparent);
  color: color-mix(in srgb, var(--md-sys-color-on-surface) 38%, transparent);
}
```

### 11.3 B. `@material/web` (Google's web components, in maintenance mode)
Per the Material team announcement on GitHub Discussion #5642 (June 2024): "Material Design is focusing on support for Google's large-scale internal Wiz framework, and has reassigned the engineers working on Material Web Components." The repo README states: "Note: MWC is in maintenance mode pending new maintainers. Tip: Using Angular? We recommend using Angular Material components instead."

Install/use:
```bash
npm i @material/web
```
```js
import '@material/web/button/filled-button.js';
import '@material/web/checkbox/checkbox.js';
import {styles as typescaleStyles} from '@material/web/typography/md-typescale-styles.js';
document.adoptedStyleSheets.push(typescaleStyles.styleSheet);
```
```html
<md-filled-button>Save</md-filled-button>
<md-checkbox checked></md-checkbox>
```

CDN (no build):
```html
<script type="importmap">
{ "imports": { "@material/web/": "https://esm.run/@material/web/" } }
</script>
<script type="module">import '@material/web/all.js';</script>
```

Theming is via CSS custom properties on the host element. **Pros**: real shadow DOM, framework-agnostic, accessible. **Cons**: incomplete component set, no top app bar / nav bar / snackbar / date picker, no Expressive components, no maintenance commitment.

### 11.4 C. React — MUI
MUI v7 (Q1 2025) and **MUI v9 (April 8, 2026)** do **not** ship Material Design 3. Per the MUI v9 launch blog (mui.com/blog/introducing-mui-v9/): "We're listening to you, and for the next major, we're going to explore refactoring the styling layer and theme layering model to better support modern design-system workflows: Target independence from Emotion and better integration paths for teams using Tailwind CSS. The ability for you to use Material Design, or have a separate theme with your own brand, without having to override every class."

The same post explains the version jump: "Material UI moves from v7 straight to v9 (there is no Material UI v8, like there is no v2), in step with MUI X v9, restoring a single shared major for the suite for the first time since that split."

The earlier MUI 2024 EOY post confirmed the deferral (mui.com/blog/material-ui-2024-updates/): "A year ago, we shared that we expected to have a Material Design 3 implementation ready by the end of 2024. Due to the more pressing efforts mentioned above, we have not been able to deliver on this yet."

**Practical implication**: MUI today = MD2 visuals. You can lean MUI tokens toward MD3 colors and shapes but you cannot get MD3 navigation bar, segmented buttons, tonal buttons, surface containers, or Expressive components from MUI itself. Three workable strategies:
- **Stay on MUI MD2** if your brand isn't tied to MD3.
- **Wrap `@material/web` inside React** for MD3 components case-by-case.
- **Use MD3-native React libraries**:
  - **Actify** (`actifyjs/actify`) — React + TypeScript + Tailwind + React Aria, aiming to be a full MD3 React implementation (not a wrapper around `@material/web`).
  - **m3-ui** (`@mavvy/m3-ui`) — React + Tailwind preset with MD3 token defaults.
  - **Material Tailwind v3** — MD-inspired (not strict MD3) Tailwind-based React components.

### 11.5 D. Angular Material
Angular Material's M3 support became **stable in Angular v18, released May 22, 2024**. Per the Angular Blog by Minko Gechev: "Material 3, deferrable views, built-in control flow are now stable and incorporate a series of improvements." And: "After addressing developers' feedback and polishing our Material 3 components, we're excited to graduate them to stable!"

Theming uses `mat.theme()` with a SCSS map; the mixin emits ~141 system-tier CSS custom properties using `light-dark()`:

```scss
@use '@angular/material' as mat;
html {
  color-scheme: light dark;
  @include mat.theme((
    color: (primary: mat.$violet-palette, tertiary: mat.$orange-palette),
    typography: Roboto,
    density: 0,
  ));
}
```

**Pros**: stable, actively developed, the de-facto MD3 component library on the web today. **Cons**: Angular-only; theming is Sass-based (though it exposes CSS variables); incomplete coverage of M3 Expressive components.

### 11.6 D. Vue — Vuetify
Vuetify's position (GitHub Issue #14332, opened October 2021 and still tagged Epic): MD3 is **partially implemented but not complete**. Vuetify 3's theme system uses MD3-style semantic color naming (`primary`, `on-primary`, `surface`, `on-surface`) but does **not** ship dynamic color, the full MD3 token set, surface containers, or the MD3 component variants out of the box. Treat as "MD-flavored, MD3-themable" rather than MD3-native.

### 11.7 E. Other approaches
- **Lit-based custom components** — author MD3 components in Lit (the same approach `@material/web` uses). Reuse `<md-ripple>`, `<md-focus-ring>`, `<md-elevation>` primitives.
- **Stencil** — framework-agnostic web components consumable in React/Vue/Angular.
- **Adobe Spectrum / IBM Carbon / Salesforce Lightning** — competing systems if MD3 isn't a brand-mandated requirement.

---

## 12. Tools

| Tool | Purpose | URL |
| --- | --- | --- |
| **Material Theme Builder (web)** | Scheme generation, export to CSS/Compose/Swift/Flutter; surfaces + contrast levels | `material-foundation.github.io/material-theme-builder/` |
| **Material Theme Builder (Figma plugin)** | Integrated Figma styles; "Create theme" generates token styles | `goo.gle/material-theme-builder-figma` |
| **Material Color Utilities** | Reference algorithm libs (TS/Java/Swift/Dart/C++) | `github.com/material-foundation/material-color-utilities` |
| **Material Symbols library** | Variable icon font picker + axis tuning | `fonts.google.com/icons` |
| **Material Tokens (DSP)** | W3C-DTCG-compatible token export | `github.com/material-foundation/material-tokens` |
| **m3.material.io** | Official guidance, blog, component reference | `m3.material.io` |
| **Angular Material Theme Builder** (community, Pro) | Visual MD3 theming for Angular Material specifically | `materialthemebuilder.com` |

**Workflow integration recommendation**:
1. Design in Figma with the Material Theme Builder plugin; commit theme as DSP JSON to the design-system repo.
2. CI runs Style Dictionary to transform DSP → CSS, SCSS, TS/JS, Compose tokens.
3. Components reference tokens — never raw values.
4. Visual regression (Chromatic, Percy) per scheme (light/dark × 3 contrast = 6 baseline scenes).

---

## 13. Accessibility

MD3 builds accessibility into the system, but verify per app.

- **Touch targets** — minimum 48×48dp (Google's recommendation, more conservative than Apple's 44pt and WCAG 2.5.8's 24×24 CSS px). Per Material accessibility guidance: "Touch targets should be at least 48 x 48 dp." Use padding to expand the target around small visuals (24×24 icon inside 48×48 button).
- **Focus rings** — `<md-focus-ring>` provides a keyboard-only ring; on web, use `:focus-visible` and a 3px outline in `--md-sys-color-secondary` with 2px offset.
- **Contrast modes** — generate all three contrast levels (standard, medium, high) and expose a user preference. Honor `prefers-contrast: more` to switch automatically.
- **Reduced motion** — honor `prefers-reduced-motion`; for spring physics, fall back to critically damped (no overshoot) or a hard cut.
- **Keyboard navigation** — Tab order = visual reading order; skip links to main content; dialogs trap focus and return it on close.
- **ARIA patterns** — Material Web components have correct semantics (`role="checkbox"`, `aria-checked`, etc.); when hand-rolling, follow the ARIA Authoring Practices Guide patterns for menu, tab, dialog, listbox.
- **Tonal palettes meet WCAG AA by default** when role pairs are used (`primary` + `on-primary`); stop cross-role pairings (e.g., `primary` text on `surface`) without testing.

---

## 14. Best Practices & Common Pitfalls on the Web

### 14.1 Adapting "mobile-first Material" to desktop
- Bottom navigation → navigation rail at ≥600px → standard drawer at ≥1200px.
- Move FAB inline or to top-right action; or omit on Expanded+ if the primary action lives in the app bar.
- Cap body width at ~75ch (~840dp); use surrounding panes for the rest.
- Reduce default motion durations on desktop. Material M1 guidance: "Desktop animations should be faster and simpler than their mobile counterparts. These animations should last 150ms to 200ms." Treat MD3's medium2 (300ms) as a ceiling.

### 14.2 When NOT to use Material Design
- Content-first sites (blogs, docs, news) where Material's container-heavy look adds noise.
- Brand-led marketing pages — MD3's tonal-spot palette and pill buttons can dilute a strong brand voice.
- Highly dense enterprise apps (tables, dashboards) where Material's generous padding wastes space — consider IBM Carbon or Salesforce Lightning instead.

### 14.3 Avoiding the "generic Google look"
- Don't use TonalSpot with a default seed — pick `vibrant`, `expressive`, or `fidelity`; or seed with a true brand hex.
- Customize **shape** — buttons don't have to be pills; corners can communicate brand voice (sharp = serious, full = friendly).
- Customize **brand typography** — Roboto is the giveaway. Pair Roboto Flex (body) with a distinctive brand display font.
- Use **tertiary** colors meaningfully — they're a free accent layer that breaks Material monotony.

### 14.4 Brand customization without breaking the system
Stay at the **system tier** when overriding. Change `--md-sys-color-primary`; let components inherit. Don't touch `--md-filled-button-container-color` unless you genuinely want one-off behavior. Maintain the **on-X invariant**: if you change `primary`, recompute `on-primary` to keep contrast.

### 14.5 Performance
- **Variable icon font**: always subset with `&icon_names=`. Full file ~7.9 MB; subset can be ~KB.
- **Roboto Flex**: one variable file instead of 6 static weights.
- **CSS size**: when using `@material/web`, import per-component (`@material/web/button/filled-button.js`, not `@material/web/all.js`).
- **`color-mix(in srgb, …)`** is broadly supported (Chrome 111+, Safari 16.2+, Firefox 113+) — use it for state layers instead of pre-computing.
- **View Transitions API** often beats a heavier React-state transition.

### 14.6 Common mistakes
1. Using `background`/`onBackground` — deprecated; use `surface`/`onSurface`.
2. Stacking shadows for elevation in dark mode — use tonal elevation / surface containers.
3. Picking a seed that produces a low-chroma TonalSpot — use Fidelity or Vibrant if your brand demands saturation.
4. Dialogs without focus traps — use native `<dialog>`.
5. Setting `font-family` directly on components — override `--md-ref-typeface-plain` instead.
6. Treating M3 Expressive as if it were available on the web — it isn't yet from Google.
7. Hard-coding light-mode tokens at component level — keep tokens at `:root`/`html` so theme switching cascades.

---

## 15. Material 3 Expressive — what to adopt now

The Expressive update extends, doesn't replace, MD3. Five practical changes adoptable today on the web *without* native library support:

1. **Containment** — wrap related controls in `surface-container` cards. This is the single biggest visual change in Expressive-updated Google apps (Gmail, Settings).
2. **Emphasized type** — bold key headlines via `font-weight: 600` and `letter-spacing: -0.01em`. Editorial accents, not body styles.
3. **Bolder buttons** — taller pill buttons (48–56px height), larger labels, more prominent fill colors.
4. **Spring motion** — replace cubic-bezier with Framer Motion / Motion One springs. Utility motion: stiffness ~400, damping ~32. Hero moments: ~300/~24.
5. **Shape variation** — mix sharp, rounded, and squircle corners within a screen for "visual tension." Use `corner-extra-large-increased` (32dp) for hero containers.

**Partial adoption strategy**: keep baseline MD3 tokens stable; introduce Expressive overrides at the system tier (e.g., `--md-sys-shape-corner-large: 20px;` instead of 16px). Validate against the baseline using visual regression before broad rollout.

---

## 16. Real-world examples & case studies

- **Gmail (web)** — adopted M3 Expressive-flavored chrome in late 2025: pill-shaped search app bar with the hamburger and avatar moved outside; contained list items; larger compose FAB.
- **Google Calendar (web)** — MD3 tokens, surface containers, tonal-elevation pattern; floating Create button.
- **Google Drive (web)** — MD3 navigation rail, surface-container list rows, MD3 type scale.
- **Google Docs / Sheets / Slides (web)** — partially Expressive as of November 2025: pill toolbar buttons, M3 progress indicators, search app bar.
- **Third-party**: Home Assistant Material 3 themes demonstrate full MD3 outside Google's stack.

9to5Google's December 2025 retrospective: the first wave of Expressive on Google's own apps feels like "Material 3.5" rather than a full overhaul — component swaps rather than ground-up redesigns. Expect the same on your side: incremental adoption produces the best results.

---

## 17. Resources

### Official
- `m3.material.io` — primary guidance, blog, foundations
- `design.google/library/expressive-material-design-google-research` — Expressive research
- `github.com/material-components/material-web` — Material Web (maintenance)
- `github.com/material-foundation/material-color-utilities` — color algorithms
- `github.com/material-foundation/material-tokens` — DSP tokens
- `github.com/material-foundation/material-theme-builder` — theme builder source
- `fonts.google.com/icons` — Material Symbols
- `material.angular.dev` — Angular Material docs (canonical MD3-on-web demo)
- `material-web.dev` — `@material/web` docs

### Tutorials and articles (high signal)
- Material 3 Compose docs (developer.android.com/develop/ui/compose/designsystems/material3) — the most thorough MD3 spec-to-code mapping, applicable conceptually on the web.
- Angular Material 17/18 M3 guides (material.angular.dev/guide/material-3) — the only stable, first-party MD3-on-web implementation guide.
- M3 Expressive coverage on 9to5Google — running real-world rollout commentary.
- Patrick Huijs, "Building expressive design systems with Material Design 3 in Webflow" — useful for non-component MD3 site work.
- Konstantin Denerz, "Angular Material 3 Theming: Design Tokens and System Variables" — deep dive on the token layer.

### Community
- The Material 3 Themes for Home Assistant project — HCT tonal palette generator + analysis.
- Actify, m3-ui, Material Tailwind GitHub repos for React-flavored MD3 components.

---

## Recommendations (decision-ready)

**If you're starting a new web app today and want MD3:**

1. **Angular shop?** Use Angular Material 18+ with M3 themes — it's the only stable, fully-supported first-party MD3-on-web option.
2. **React shop and brand-aligned MD3 fidelity matters?** Hand-roll components on top of CSS tokens exported from Material Theme Builder. Augment selectively with `@material/web` for primitives (Slider, Date Picker eventually). Keep tokens in a separate package so you can switch UI library later.
3. **React shop and MD2-flavored Material is acceptable?** Use MUI v9 today; revisit when MUI's next major delivers MD3.
4. **Vue shop?** Vuetify 3 with MD3-leaning theme; hand-fill MD3-specific components.
5. **Need M3 Expressive components on web?** You have to build them yourself in 2026. Begin with containment + spring motion + emphasized type; defer shape morphing until library support arrives.

**Promote to stable when**:
- Tokens are centralized in a single `tokens.css` file generated from DSP/Style Dictionary.
- Light, dark, and high-contrast schemes pass automated contrast checks (axe, Lighthouse) at every role pair.
- All components honor `prefers-reduced-motion`.
- Touch targets are ≥48×48 logical px throughout.

**Re-evaluate the framework choice when**:
- MUI announces a real MD3 implementation (post-v9 major).
- Google publishes a successor to `@material/web` with maintained Expressive components.
- Your app crosses ~100 screens — at that scale, hand-rolled components become harder to maintain than a stable third-party library.

---

## Caveats

- **The `@material/web` library is functionally frozen.** Per the Material team's June 2024 statement, no new components or features are planned; PRs will not be accepted by default. Build with the assumption that the library is a snapshot, not a roadmap.
- **Material 3 Expressive is not on the web from Google.** All Expressive shipping today is Android/Wear OS. Implementing Expressive on the web requires hand-rolling spring motion, shape morphing, and emphasized type.
- **MD3 visual designs at m3.material.io are illustrative.** The spec pages render client-side via JavaScript, so much of what circulates as "MD3 spec quotes" comes from secondary documentation (Compose, Flutter, Angular Material). Cross-reference against the official Figma kit when precision matters.
- **Dynamic color on the web is not the same as on Android.** Android extracts color from wallpaper at the OS level. On the web you must surface a user color picker or auto-detect a brand color from a hero image (via Material Color Utilities' `QuantizerCelebi`).
- **WCAG ratio targets per contrast level are implicit, not published.** MD3 documents three contrast levels (0.0 / 0.5 / 1.0) but does not publish explicit WCAG ratio targets per level in indexable text — the canonical mapping comes from the Flutter `color_scheme.dart` source comment ("medium and high contrast correspond to 0.5 and 1.0 respectively") and from the design intent (standard ≈ AA, high ≈ AAA-tier).
- **Mobile/web parity is incomplete.** Many MD3 components canonical on Android (date picker, time picker, top app bar, navigation bar, navigation rail, segmented button, search bar, snackbar, bottom sheet, tooltip) are missing from `@material/web`. Plan for these as custom implementations from day one.