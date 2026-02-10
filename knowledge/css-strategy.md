# Layered CSS Architecture

## Purpose

Authoritative reference for the layered CSS strategy used in Figma design-to-code generation. Documents how generated CSS properties are distributed across three layers -- Tailwind CSS utilities for structural layout, CSS Custom Properties for design tokens, and CSS Modules for component-specific visual styling -- to produce maintainable, overridable, production-grade CSS output. Encodes production patterns for token extraction, CSS generation, token consumption, and CSS Modules isolation.

## When to Use

Reference this module when you need to:

- Decide which CSS layer a generated property should belong to (Tailwind, Custom Property, or CSS Module)
- Understand how the three CSS layers compose without specificity conflicts
- Configure Tailwind to reference design tokens from CSS Custom Properties
- Structure CSS Module files for component-scoped visual styles
- Implement token consumption patterns with `var()` and fallback values
- Handle responsive CSS using mobile-first media queries with Tailwind prefixes
- Support light/dark themes through CSS Custom Properties and mode selectors
- Choose between separate CSS files (reset.css, tokens.css, styles.css) or merged output
- Understand how the five design-to-code modules feed into the CSS generation pipeline
- Implement Visual Builder token aliasing for plugin isolation

---

## Content

### 1. Three-Layer Architecture Overview

Generated CSS is distributed across three layers, each with a distinct responsibility and specificity level. This separation ensures that layout structure, design tokens, and visual skin can be modified independently.

#### Layer Summary

| Layer | Technology | Responsibility | Specificity |
|-------|-----------|----------------|-------------|
| 1. Layout Bones | Tailwind CSS classes | Flexbox, gap, padding, margin, sizing, positioning, responsive breakpoints | Zero (utility classes at `@layer utilities`) |
| 2. Design Tokens | CSS Custom Properties | Colors, font sizes, font families, spacing values, radii, shadows, transitions | Defined on `:root` (zero selector specificity for the variables themselves) |
| 3. Visual Skin | CSS Modules | Component-specific backgrounds, borders, effects, color assignments, overrides | Scoped to component (hashed class names prevent leaking) |

#### Why Three Layers

The three-layer approach solves three problems that single-strategy CSS cannot:

1. **Tailwind alone** cannot handle design-specific visual styles (exact color assignments, shadow compositions, gradient definitions) without excessive arbitrary values that defeat the utility-class purpose.

2. **CSS Custom Properties alone** cannot provide structural layout utilities efficiently. Repeating `display: flex; flex-direction: column; gap: var(--spacing-md)` on every container is verbose when `flex flex-col gap-4` achieves the same result.

3. **CSS Modules alone** cannot share design tokens across components without importing a shared file or duplicating values. Token changes would require editing every module file.

The three layers compose naturally: Tailwind handles the predictable structural patterns, Custom Properties provide the shared design language, and CSS Modules apply the unique visual identity per component.

#### How the Layers Compose

```html
<!-- Layer 1: Tailwind classes handle layout -->
<div class="flex flex-col gap-4 p-6 w-full">
  <!-- Layer 3: CSS Module class handles visual skin -->
  <div class="card">
    <h2 class="card__title">Welcome</h2>
    <p class="card__body">Content here</p>
  </div>
</div>
```

```css
/* Layer 2: tokens.css — design tokens at :root */
:root {
  --color-neutral-100: #f5f5f5;
  --color-neutral-800: #333333;
  --color-primary: #1a73e8;
  --radius-lg: 12px;
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

/* Layer 3: Card.module.css — visual skin consuming tokens */
.card {
  background-color: var(--color-neutral-100);
  border: 1px solid var(--color-neutral-300);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
}

.card__title {
  color: var(--color-neutral-800);
  font-size: var(--text-2xl);
  font-weight: var(--font-bold);
}
```

---

### 2. Layer 1: Tailwind CSS (Layout Bones)

Tailwind CSS handles all structural layout properties. These are the mechanical, pattern-based properties that determine how elements are arranged, sized, and spaced -- not how they look visually.

#### Properties That Belong in Tailwind

| CSS Property | Tailwind Class | Source in Figma |
|-------------|---------------|-----------------|
| `display: flex` | `flex` | Auto Layout container |
| `flex-direction: column` | `flex-col` | `layoutMode: VERTICAL` |
| `flex-direction: row` | `flex-row` | `layoutMode: HORIZONTAL` |
| `justify-content: center` | `justify-center` | `primaryAxisAlignItems: CENTER` |
| `justify-content: space-between` | `justify-between` | `primaryAxisAlignItems: SPACE_BETWEEN` |
| `align-items: center` | `items-center` | `counterAxisAlignItems: CENTER` |
| `align-items: flex-start` | `items-start` | `counterAxisAlignItems: MIN` |
| `gap: 16px` | `gap-4` | `itemSpacing: 16` |
| `padding: 24px` | `p-6` | `padding: { top: 24, right: 24, bottom: 24, left: 24 }` |
| `padding: 16px 24px` | `py-4 px-6` | Mixed padding values |
| `flex-grow: 1; flex-basis: 0` | `flex-1` | `layoutSizingHorizontal: FILL` (primary axis) |
| `flex-shrink: 0` | `shrink-0` | `layoutSizingHorizontal: FIXED` (primary axis) |
| `align-self: stretch` | `self-stretch` | `layoutSizingVertical: FILL` (counter axis) |
| `width: 100%` | `w-full` | FILL on counter axis |
| `flex-wrap: wrap` | `flex-wrap` | `layoutWrap: WRAP` |
| `position: relative` | `relative` | Parent of absolute children |
| `position: absolute` | `absolute` | `layoutPositioning: ABSOLUTE` |
| `overflow: hidden` | `overflow-hidden` | Clip content |
| `min-width: 200px` | `min-w-[200px]` | `minWidth: 200` |
| `max-width: 800px` | `max-w-[800px]` | `maxWidth: 800` |

#### When NOT to Use Tailwind

Tailwind should NOT be used for visual design properties:

- **Colors** -- `bg-blue-500` creates a tight coupling to Tailwind's color palette. Use CSS Custom Properties so colors can be changed via tokens without touching HTML.
- **Shadows** -- `shadow-lg` uses Tailwind's built-in shadow, not the design's specific shadow. Use token-referenced `box-shadow` in CSS Modules.
- **Border radius** -- Design-specific radii should reference tokens (`var(--radius-lg)`), not Tailwind's radius scale.
- **Font sizes** -- Use token-referenced `font-size` (`var(--text-lg)`) to maintain consistency with the design's type scale.
- **Specific spacing values** -- When a spacing value maps to a design token (from Figma Variables or threshold-promoted), use `var(--spacing-md)` instead of `gap-4`.

**Exception:** When Tailwind is configured to reference CSS Custom Properties in its theme (see Section 2.1), Tailwind classes like `gap-md` or `text-lg` can safely reference tokens.

#### 2.1 Tailwind Theme Integration with Design Tokens

Tailwind's theme can be configured to reference CSS Custom Properties, bridging Layer 1 and Layer 2:

```js
// tailwind.config.js
export default {
  theme: {
    extend: {
      colors: {
        primary: 'var(--color-primary)',
        secondary: 'var(--color-secondary)',
        neutral: {
          100: 'var(--color-neutral-100)',
          300: 'var(--color-neutral-300)',
          800: 'var(--color-neutral-800)',
        },
      },
      spacing: {
        xs: 'var(--spacing-xs)',
        sm: 'var(--spacing-sm)',
        md: 'var(--spacing-md)',
        lg: 'var(--spacing-lg)',
        xl: 'var(--spacing-xl)',
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        full: 'var(--radius-full)',
      },
      fontSize: {
        xs: 'var(--text-xs)',
        sm: 'var(--text-sm)',
        base: 'var(--text-base)',
        lg: 'var(--text-lg)',
        xl: 'var(--text-xl)',
        '2xl': 'var(--text-2xl)',
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
      },
    },
  },
}
```

With this configuration, `gap-md` resolves to `gap: var(--spacing-md)`, which in turn resolves to the actual pixel value defined in the `:root` tokens. This allows Tailwind classes to be token-aware without hardcoding values.

#### Tailwind v4 Configuration

The reference project uses Tailwind v4 via `@tailwindcss/postcss`:

```js
// postcss.config.mjs
const config = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
}
export default config
```

Tailwind v4 automatically detects CSS custom properties and can use them as utility values without explicit theme configuration, reducing the need for manual theme extension.

---

### 3. Layer 2: CSS Custom Properties (Design Tokens)

CSS Custom Properties serve as the design tokens bridge -- the shared vocabulary of colors, spacing, typography, radii, shadows, and transitions that all components reference. Tokens are defined once in `:root` and consumed everywhere via `var()`.

#### Token Placement at `:root`

All design tokens are defined on the `:root` selector, making them globally available:

```css
:root {
  /* Colors */
  --color-primary: #1a73e8;
  --color-secondary: #5f6368;
  --color-neutral-100: #f5f5f5;
  --color-neutral-800: #333333;
  --color-success: #34a853;
  --color-warning: #fbbc04;
  --color-error: #ea4335;

  /* Spacing */
  --spacing-1: 4px;
  --spacing-2: 8px;
  --spacing-3: 12px;
  --spacing-4: 16px;
  --spacing-6: 24px;
  --spacing-8: 32px;

  /* Typography */
  --font-primary: 'Inter', sans-serif;
  --font-mono: 'Roboto Mono', monospace;
  --text-sm: 14px;
  --text-base: 16px;
  --text-lg: 18px;
  --text-xl: 24px;
  --text-2xl: 32px;
  --font-regular: 400;
  --font-medium: 500;
  --font-bold: 700;

  /* Border Radii */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-full: 9999px;

  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1);

  /* Transitions */
  --transition-fast: 150ms ease;
  --transition-normal: 200ms ease;
  --transition-slow: 300ms ease;
}
```

#### Category Naming Conventions

The recommended category prefixes for auto-detected tokens:

| Category | Prefix | Examples |
|----------|--------|---------|
| Colors | `--color-*` | `--color-primary`, `--color-neutral-800`, `--color-error` |
| Spacing | `--spacing-*` | `--spacing-1`, `--spacing-4`, `--spacing-8` |
| Font sizes | `--text-*` | `--text-sm`, `--text-base`, `--text-2xl` |
| Font families | `--font-*` | `--font-primary`, `--font-mono` |
| Font weights | `--font-*` | `--font-bold`, `--font-medium`, `--font-regular` |
| Border radii | `--radius-*` | `--radius-sm`, `--radius-md`, `--radius-full` |
| Shadows | `--shadow-*` | `--shadow-sm`, `--shadow-md`, `--shadow-lg` |
| Transitions | `--transition-*` | `--transition-fast`, `--transition-normal` |

#### The `--token-*` Double-Prefix Pattern

Some projects add a `--token-` prefix to all design tokens. This serves two purposes: (1) clearly distinguishes design tokens from other CSS custom properties, and (2) enables the Visual Builder's token aliasing pattern.

```css
/* tokens.css */
:root {
  --token-color-primary: #3b82f6;
  --token-spacing-md: 16px;
  --token-radius-lg: 12px;
  --token-font-size-base: 18px;
  --token-shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}
```

The `--token-` prefix is a project convention, not a requirement. Some projects use bare category prefixes (`--color-*`), others use `--token-color-*`. Both are valid approaches.

#### Token Fallback Pattern

When consuming tokens in CSS Module rules, always include a raw fallback value. This ensures the styles work even if the token definition is missing (e.g., during development, or when tokens are loaded asynchronously):

```css
/* With fallback — safe for all environments */
background-color: var(--token-color-primary, #3b82f6);
border-radius: var(--token-radius-lg, 12px);
padding: var(--token-spacing-lg, 24px);

/* Without fallback — only safe when token is guaranteed to be defined */
background-color: var(--color-primary);
```

**When to omit fallbacks:** For tokens defined in the same project's `tokens.css` that is guaranteed to be loaded before component styles. Fallbacks can be omitted for local Figma Variables (tokens defined in the same file). External library variables always include fallbacks.

> For details on token extraction, naming algorithms, and promotion thresholds, see `design-tokens.md`.

---

### 4. Layer 3: CSS Modules (Visual Skin)

CSS Modules provide component-scoped visual styles. These are the Figma-specific visual properties that give each component its unique appearance -- backgrounds, borders, shadows, color assignments, typography styling.

#### Component-Scoped Styles

Each component gets its own CSS Module file. Class names are locally scoped (hashed at build time), preventing style leaking between components:

```css
/* Card.module.css */
.card {
  background-color: var(--color-neutral-100);
  border: 1px solid var(--color-neutral-300);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
}

.card__title {
  color: var(--color-neutral-800);
  font-size: var(--text-2xl);
  font-weight: var(--font-bold);
}

.card__body {
  color: var(--color-neutral-800);
  font-size: var(--text-base);
  line-height: 1.6;
}

.card__cta {
  background-color: var(--color-primary);
  color: var(--color-neutral-100);
  border-radius: var(--radius-sm);
  font-weight: var(--font-medium);
}
```

#### BEM Naming Within Modules

CSS Module class names follow BEM conventions with flat hierarchy (no deeper than `block__element`):

```css
/* Block */
.hero { }

/* Elements */
.hero__inner { }
.hero__content { }
.hero__title { }
.hero__buttons { }
.hero__button { }

/* Modifiers (via composes or separate classes) */
.heroContainerHigh { min-height: 400px; }
.heroContainerMedium { min-height: 300px; }
```

> For BEM naming conventions and flat hierarchy rules, see `design-to-code-semantic.md`.

#### Token Consumption Pattern

CSS Module rules consume tokens via `var()` references. The module never defines its own token values -- it only references tokens from Layer 2:

```css
/* CORRECT: Module consumes tokens */
.card {
  background-color: var(--token-color-bg, #ffffff);
  border-radius: var(--token-radius-lg, 12px);
  box-shadow: var(--token-shadow-sm, 0 1px 3px rgba(0, 0, 0, 0.1));
}

/* WRONG: Module defines its own values (bypasses token system) */
.card {
  background-color: #ffffff;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}
```

#### File Organization (Per-Block Modules)

The recommended approach organizes CSS Modules by block type, with each block in its own file under `src/styles/blocks/`:

```
src/styles/
  tokens.css              # Layer 2: shared design tokens
  blocks/
    accordion.module.css  # Layer 3: per-block visual skin
    button.module.css
    callToAction.module.css
    card.module.css
    container.module.css
    hero.module.css
    media.module.css
    richText.module.css
    stats.module.css
    testimonial.module.css
    video.module.css
```

Each module imports `tokens.css` to ensure token definitions are available:

```css
@import '../tokens.css';

.card {
  background-color: var(--token-color-bg, #ffffff);
  /* ... */
}
```

#### Visual Builder Token Aliasing

The Visual Builder plugin creates a CSS isolation boundary using `contain: content` and `isolation: isolate`. Within this boundary, tokens are aliased from `--token-*` to `--vb-*` to prevent interference with the Payload CMS admin panel's styles:

```css
/* visualCanvas.module.css */
.visualCanvas {
  all: revert;
  contain: content;
  isolation: isolate;

  /* Token aliasing: VB tokens reference project tokens with fallbacks */
  --vb-color-primary: var(--token-color-primary, #3b82f6);
  --vb-spacing-md: var(--token-spacing-md, 16px);
  --vb-radius-md: var(--token-radius-md, 8px);
  /* ... full aliasing for all token categories */
}
```

This pattern enables:

1. **Plugin portability** -- The Visual Builder works in any project regardless of whether `--token-*` variables are defined (fallbacks kick in)
2. **Admin isolation** -- `contain: content` prevents Payload admin styles from bleeding into the visual canvas
3. **Single source of truth** -- Projects define tokens once in `tokens.css`; the Visual Builder automatically picks them up via the alias chain

---

### 5. Property Placement Decision Tree

For any CSS property generated from a Figma node, this decision tree determines which layer it belongs to. This is the core routing logic for the CSS generation pipeline.

```
For each CSS property on a GeneratedElement:

  1. IS IT A STRUCTURAL LAYOUT PROPERTY?
     (display, flex-direction, justify-content, align-items, gap,
      flex-grow, flex-basis, flex-shrink, flex-wrap, align-self,
      align-content, position, width/height from sizing modes,
      min-width, max-width, min-height, max-height, overflow)

       YES → Layer 1: Tailwind utility class
       Rationale: Layout is mechanical and pattern-based.
       Tailwind's utility classes express these concisely.

  2. IS THE RAW VALUE A PROMOTED DESIGN TOKEN?
     (color resolves to var(--color-*),
      spacing resolves to var(--spacing-*),
      font-size resolves to var(--text-*),
      font-family resolves to var(--font-*),
      font-weight resolves to var(--font-*),
      border-radius resolves to var(--radius-*),
      box-shadow resolves to var(--shadow-*))

       YES → Layer 2: CSS Custom Property reference in the value
       The token is DEFINED in :root, CONSUMED in the CSS Module rule.
       Rationale: Tokens are the shared design language. Centralizing
       them enables theme changes without touching component styles.

  3. IS IT A COMPONENT-SPECIFIC VISUAL STYLE?
     (background-color, background-image, border, border-color,
      border-radius, box-shadow, color, opacity, filter,
      backdrop-filter, mix-blend-mode, text-decoration,
      transition, transform)

       YES → Layer 3: CSS Module rule
       The property is placed in the component's .module.css file.
       If the value is a token, the rule uses var(--token-*).
       If the value is not a token, the raw value is used inline.

  4. IS IT PADDING OR GAP WITH A TOKEN VALUE?

       YES → Layer 1 if using Tailwind theme integration:
         class="gap-md p-lg" (where md/lg map to token vars)
       YES → Layer 3 if not using Tailwind theme integration:
         gap: var(--spacing-md); padding: var(--spacing-lg);
       Rationale: Padding and gap are layout properties but can also
       carry token values. The choice depends on Tailwind configuration.
```

#### Property-to-Layer Reference Table

| Property Category | Example Properties | Layer | Method |
|------------------|--------------------|-------|--------|
| Flex container | `display`, `flex-direction`, `justify-content`, `align-items`, `flex-wrap`, `align-content` | 1 (Tailwind) | Utility classes |
| Flex child | `flex-grow`, `flex-basis`, `flex-shrink`, `align-self` | 1 (Tailwind) | Utility classes |
| Spacing | `gap`, `padding`, `margin` | 1 or 3 | Tailwind if standard; Module if token-bound |
| Sizing | `width`, `height`, `min-width`, `max-width` | 1 (Tailwind) | Utility classes |
| Positioning | `position`, `top`, `right`, `bottom`, `left`, `z-index` | 1 (Tailwind) | Utility classes |
| Overflow | `overflow`, `text-overflow` | 1 (Tailwind) | Utility classes |
| Background | `background-color`, `background-image`, `background-size` | 3 (Module) | CSS rule with `var()` |
| Border | `border`, `border-color`, `border-width` | 3 (Module) | CSS rule with `var()` |
| Border radius | `border-radius` | 3 (Module) | CSS rule with `var()` |
| Shadow | `box-shadow` | 3 (Module) | CSS rule with `var()` |
| Color | `color` | 3 (Module) | CSS rule with `var()` |
| Typography | `font-family`, `font-size`, `font-weight`, `line-height` | 3 (Module) | CSS rule with `var()` |
| Text | `text-align`, `text-transform`, `white-space`, `letter-spacing` | 3 (Module) | CSS rule |
| Opacity | `opacity` | 3 (Module) | CSS rule |
| Blend modes | `mix-blend-mode`, `background-blend-mode` | 3 (Module) | CSS rule |
| Filters | `filter`, `backdrop-filter` | 3 (Module) | CSS rule |
| Transitions | `transition` | 3 (Module) | CSS rule with `var()` |

---

### 6. Specificity Management

The three layers compose without specificity conflicts because each layer operates at a different specificity level.

#### Specificity by Layer

| Layer | Selector Type | Specificity | Example |
|-------|-------------|-------------|---------|
| 1. Tailwind | Utility class | `0-1-0` (single class) | `.flex` |
| 2. Tokens | `:root` pseudo-class | `0-1-0` (for definition) | `:root { --color-primary: #1a73e8 }` |
| 3. CSS Module | Hashed class | `0-1-0` (single class) | `.card_abc123` |

#### Why Conflicts Do Not Occur

1. **Tailwind vs Modules** -- Tailwind handles layout properties. Modules handle visual properties. They target different CSS properties on the same element, so they do not compete.

2. **Tokens vs Modules** -- Tokens define variables on `:root`. Modules consume those variables via `var()`. They do not target the same selectors or properties.

3. **Tailwind vs Tokens** -- When Tailwind is configured with token references in its theme, Tailwind utilities resolve to `var()` values. This is composition, not conflict.

#### Potential Conflict: Padding and Gap

The one area where Layers 1 and 3 could conflict is spacing properties (padding, gap). If a Tailwind class sets `gap: 16px` and a CSS Module rule also sets `gap: var(--spacing-md)`, the Module rule wins due to source order (Modules are loaded after Tailwind utilities).

**Resolution:** Choose one layer for spacing. Either:
- Use Tailwind for all spacing (with token-aware theme configuration)
- Use CSS Module rules for all spacing (when token substitution is needed)

Do not mix both layers for the same spacing property on the same element.

#### Tailwind `@layer` Ordering

Tailwind v4 uses CSS `@layer` to establish baseline ordering:

```
@layer base;       /* Resets, element defaults */
@layer components; /* Component styles (CSS Modules go here) */
@layer utilities;  /* Tailwind utilities (highest CSS layer priority) */
```

By default, Tailwind utilities override component styles. This means a Tailwind class on an element will override the same property set by a CSS Module. This is generally desirable for layout overrides but requires awareness when both layers target the same property.

---

### 7. Responsive Strategy

#### Mobile-First Breakpoint Ordering

All responsive CSS uses a mobile-first approach: base styles target the smallest viewport, and larger viewports are handled through `min-width` media queries.

| Breakpoint | min-width | CSS |
|------------|-----------|-----|
| `mobile` | _(base)_ | No media query (base styles) |
| `tablet` | 768px | `@media (min-width: 768px)` |
| `desktop` | 1024px | `@media (min-width: 1024px)` |

This matches both responsive frame merging (see `design-to-code-layout.md` Section 8) and Figma Variables breakpoint mode detection.

#### Figma Variables Mode to Media Query Mapping

When Figma variable collections use breakpoint modes (detected by mode names like "mobile", "tablet", "desktop"), the pipeline renders mode-aware `:root` overrides inside media queries:

```css
/* Base: mobile values (default mode) */
:root {
  --spacing-lg: 16px;
  --text-xl: 20px;
}

/* Tablet overrides */
@media (min-width: 768px) {
  :root {
    --spacing-lg: 24px;
    --text-xl: 24px;
  }
}

/* Desktop overrides */
@media (min-width: 1024px) {
  :root {
    --spacing-lg: 32px;
    --text-xl: 28px;
  }
}
```

This approach means component styles automatically respond to viewport changes without any media queries of their own -- the token values change, and all `var()` references resolve to the new values.

#### Tailwind Responsive Prefixes

For layout properties in Layer 1, use Tailwind's responsive prefixes:

```html
<div class="flex flex-col md:flex-row gap-3 md:gap-6 lg:gap-8 p-4 md:p-6 lg:p-8">
```

| Prefix | Breakpoint | CSS |
|--------|-----------|-----|
| _(none)_ | All | Base styles |
| `sm:` | 640px | `@media (min-width: 640px)` |
| `md:` | 768px | `@media (min-width: 768px)` |
| `lg:` | 1024px | `@media (min-width: 1024px)` |
| `xl:` | 1280px | `@media (min-width: 1280px)` |

#### CSS Module Responsive Patterns

For visual properties in Layer 3 that need responsive behavior beyond what token media queries provide:

```css
/* Card.module.css */
.card {
  border-radius: var(--radius-md);
}

@media (min-width: 768px) {
  .card {
    border-radius: var(--radius-lg);
  }
}
```

This is less common because most responsive visual changes are handled through token mode overrides at the `:root` level. Module-level media queries are only needed for structural visual changes (e.g., adding/removing a border on desktop, changing an element's background pattern).

> For responsive frame matching and style diffing algorithms, see `design-to-code-layout.md` Section 8.

---

### 8. Theme Support

#### Light/Dark Theme via CSS Custom Properties

Themes are implemented by redefining token values under different selectors. The component styles remain unchanged -- they reference tokens via `var()`, and the resolved values change based on the active theme.

**Media query approach (automatic, based on OS preference):**

```css
:root {
  --color-bg: #ffffff;
  --color-text: #1a1a1a;
  --color-border: #e0e0e0;
}

@media (prefers-color-scheme: dark) {
  :root {
    --color-bg: #1a1a1a;
    --color-text: #ffffff;
    --color-border: #404040;
  }
}
```

**Data attribute approach (manual toggle, JavaScript-controlled):**

```css
:root,
[data-theme="light"] {
  --color-bg: #ffffff;
  --color-text: #1a1a1a;
}

[data-theme="dark"] {
  --color-bg: #1a1a1a;
  --color-text: #ffffff;
}
```

The pipeline generates both approaches when theme mode collections are detected: the `prefers-color-scheme` media query for automatic theme detection, and the `[data-theme]` selector for manual control.

#### Figma Variables Theme Mode Mapping

When a Figma variable collection has a "theme" mode type (detected by mode names containing "light" or "dark"), the pipeline maps the default mode (light) to `:root` and non-default modes to both `prefers-color-scheme` and `[data-theme]` selectors:

```
Collection: "Theme"
  Mode "Light" (default) → :root { }
  Mode "Dark"            → @media (prefers-color-scheme: dark) { :root { } }
                           [data-theme="dark"] { }
```

> For the full Figma Variables multi-mode theming patterns, see `figma-api-variables.md`.

#### Brand Theming

For multi-brand themes, use class-based selectors:

```css
.brand-a {
  --color-primary: #0066ff;
  --font-primary: 'Inter', sans-serif;
}

.brand-b {
  --color-primary: #ff3366;
  --font-primary: 'Poppins', sans-serif;
}
```

Components reference `var(--color-primary)` and automatically adopt the active brand's values.

---

### 9. Export Formats

The generation pipeline supports multiple CSS export structures depending on the project's needs.

#### Separate Files (Recommended for Projects)

When `separateTokens: true`, the export produces three independent CSS files:

| File | Content | Layer |
|------|---------|-------|
| `reset.css` | Universal CSS reset (box-sizing, margin, padding, image defaults) | Pre-layer |
| `tokens.css` | `:root` block with CSS Custom Properties, media queries for modes | Layer 2 |
| `styles.css` | Component class rules (BEM-named) | Layer 3 |

Import order matters:

```html
<link rel="stylesheet" href="reset.css">
<link rel="stylesheet" href="tokens.css">
<link rel="stylesheet" href="styles.css">
```

#### Merged Output (Default for Preview)

When `separateTokens: false`, tokens are merged into `styles.css`:

| File | Content |
|------|---------|
| `reset.css` | Universal CSS reset |
| `styles.css` | Tokens (`:root` block) + component class rules |

#### SCSS Export

For SCSS consumers, the pipeline generates a parallel file structure using SCSS conventions:

| File | Content | Notes |
|------|---------|-------|
| `_reset.scss` | Reset rules | Underscore prefix = SCSS partial |
| `_variables.scss` | `$variable` declarations | `--color-primary` becomes `$color-primary` |
| `_mixins.scss` | Empty placeholder | For project-specific mixins |
| `styles.scss` | `@import` statements + component rules | Entry point with var() converted to $variable |

**SCSS variable conversion:**

```scss
// _variables.scss (generated from tokens)
$color-primary: #1a73e8;
$spacing-4: 16px;
$text-lg: 18px;
$font-bold: 700;
$shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1);

// styles.scss (generated from component styles)
@import 'variables';
@import 'reset';
@import 'mixins';

.card {
  background-color: $color-neutral-100;
  border-radius: $radius-lg;
  box-shadow: $shadow-md;
}
```

The conversion replaces `var(--name)` with `$name` and `--name: value` with `$name: value`.

#### HTML Document Export

For standalone preview, the pipeline generates a complete HTML document with embedded CSS:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=...');
    /* CSS reset */
    /* tokens :root block */
    /* component styles */
  </style>
</head>
<body>
  <!-- generated HTML -->
</body>
</html>
```

The ordering within the `<style>` block is: font imports, reset, tokens, component styles.

> For details on the SCSS rendering pipeline, see `design-tokens.md`.

---

### 10. Integration with Design-to-Code Pipeline

The five design-to-code modules feed into the CSS strategy at specific integration points.

#### Pipeline Flow

```
Figma Node Tree
    ↓
[Extraction Phase]
    ↓
ExtractedNode tree
    ↓
┌─────────────────────────────┐
│ Token Collection & Promotion │  ← design-tokens.md
│ (colors, spacing, typography,│
│  effects, Figma Variables)   │
└──────────────┬──────────────┘
               ↓
         TokenLookup map
               ↓
┌─────────────────────────────┐
│ Generation Phase             │
│  ├─ layout.md    → Layer 1  │  Flex container/child → Tailwind classes
│  ├─ visual.md    → Layer 3  │  Fills, strokes, effects → CSS Module rules
│  ├─ typography.md → Layer 3 │  Font props → CSS Module rules with var()
│  ├─ assets.md    → HTML     │  Vector/image → <img> tags
│  └─ semantic.md  → HTML     │  Tags, BEM classes, ARIA attributes
└──────────────┬──────────────┘
               ↓
         GeneratedOutput
    ┌──────┼──────┐
    ↓      ↓      ↓
  HTML   CSS    Tokens
               ↓      ↓
         Layer 3   Layer 2
       (styles.css) (tokens.css)
```

#### How Each Module Contributes

**`design-to-code-layout.md`** produces layout CSS that maps to Layer 1 (Tailwind classes):
- `display: flex` → `flex`
- `flex-direction: column` → `flex-col`
- `gap: 16px` → `gap-4` (or `gap: var(--spacing-4)` if token-bound)
- Responsive frame merging → `md:flex-row lg:gap-8`

**`design-to-code-visual.md`** produces visual CSS that maps to Layer 3 (CSS Module rules):
- `background-color: var(--color-primary)` (via token lookup)
- `box-shadow: var(--shadow-md)` (via token lookup)
- `border-radius: var(--radius-lg)` (via token lookup)
- Raw values when no token match: `border: 1px solid #e0e0e0`

**`design-to-code-typography.md`** produces typography CSS that maps to Layer 3:
- `font-family: var(--font-primary)` (via token lookup)
- `font-size: var(--text-lg)` (via token lookup)
- `font-weight: var(--font-bold)` (via token lookup)
- `line-height: 1.50` (always raw, not tokenized)

**`design-to-code-assets.md`** produces HTML elements (not CSS):
- Vector containers → `<img src="icon.svg">`
- Image fills → `<img>` or `background-image` CSS in Module

**`design-to-code-semantic.md`** produces HTML structure:
- Semantic tags → `<section>`, `<nav>`, `<h2>`, `<button>`
- BEM class names → `.card`, `.card__title`, `.card__body`
- ARIA attributes → `aria-label`, `role`

#### Token Lookup During Generation

The `TokenLookup` is built from promoted tokens before generation begins. During CSS generation, each raw value is checked against the lookup map. If a match is found, the `var()` reference is used instead of the raw value:

```
Raw value: #1a73e8
  → lookupColor(lookup, "#1a73e8")
  → Returns: "var(--color-primary)" (if token exists)
  → Returns: "#1a73e8" (if no token match)
```

This substitution happens transparently during the generation of visual and typography styles. Layout properties are not token-substituted (they go to Tailwind).

> For the complete token lookup system, including Figma Variable priority over auto-detected tokens, see `design-tokens.md`.

#### Complete Example: All Three Layers

A card component with all three layers working together:

```html
<!-- Layer 1: Tailwind for layout -->
<section class="flex flex-col gap-6 p-6 max-w-md">
  <!-- Layer 3: CSS Module for visual skin -->
  <div class="card">
    <img class="card__image" src="./assets/photo.png" alt="Team photo">
    <div class="flex flex-col gap-3 p-4">
      <h3 class="card__title">Meet the Team</h3>
      <p class="card__body">Our talented people make the difference.</p>
      <a class="card__cta" href="#">Learn More</a>
    </div>
  </div>
</section>
```

```css
/* Layer 2: tokens.css */
:root {
  --color-primary: #1a73e8;
  --color-neutral-100: #f5f5f5;
  --color-neutral-800: #333333;
  --text-lg: 18px;
  --text-2xl: 32px;
  --font-bold: 700;
  --radius-lg: 12px;
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

/* Layer 3: Card.module.css */
.card {
  background-color: var(--color-neutral-100);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  overflow: hidden;
}

.card__title {
  font-size: var(--text-2xl);
  font-weight: var(--font-bold);
  color: var(--color-neutral-800);
}

.card__body {
  font-size: var(--text-lg);
  color: var(--color-neutral-800);
  line-height: 1.60;
}

.card__cta {
  background-color: var(--color-primary);
  color: var(--color-neutral-100);
  border-radius: var(--radius-sm);
  padding: 8px 16px;
  font-weight: var(--font-bold);
}
```

---

## Cross-References

- **`design-tokens.md`** -- Token extraction pipeline, threshold-based promotion, naming conventions, CSS/SCSS/Tailwind rendering. Defines the tokens consumed by Layer 2.
- **`design-tokens-variables.md`** -- Figma Variables deep dive: mode detection and classification, variable resolution chains, mode-aware CSS rendering, fallback strategies, scope-to-CSS-property mapping. The Variables-to-Token-to-CSS bridge.
- **`figma-api-variables.md`** -- Variables API endpoints, variable data model, multi-mode theming patterns. The source data for Figma Variable tokens.
- **`design-to-code-layout.md`** -- Auto Layout to Flexbox mapping that produces Layer 1 (Tailwind) output. Responsive multi-frame pattern with mobile-first media queries.
- **`design-to-code-visual.md`** -- Visual property extraction that produces Layer 3 (CSS Module) output. Color token integration with HSL naming, variable binding resolution.
- **`design-to-code-typography.md`** -- Typography extraction that produces Layer 3 output. Font family/size/weight token lookup during generation.
- **`design-to-code-assets.md`** -- Asset management for image and vector export. Asset references appear in HTML (`<img src>`) and CSS Module rules (`background-image`).
- **`design-to-code-semantic.md`** -- Semantic HTML generation that provides the element structure. BEM class naming used by Layer 3 CSS Modules. Three-layer architecture overview (Section 9).
- **`payload-blocks.md`** -- PayloadCMS block system that consumes all three CSS layers. Container blocks store Tailwind utility classes (Layer 1), block CSS Modules reference `--token-*` custom properties (Layer 2), and each block has a dedicated CSS Module for scoped visual styles (Layer 3). The three-layer architecture serves this block system directly.
