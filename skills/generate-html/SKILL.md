---
name: generate-html
description: Generate semantic HTML5 and layered CSS from Figma node data. Use this skill when the user has Figma design data and needs vanilla HTML + CSS output (no React, no JSX, no TypeScript). Ideal for static sites, email templates, prototypes, or framework-agnostic code.
---

@knowledge/design-to-code-layout.md
@knowledge/design-to-code-visual.md
@knowledge/design-to-code-typography.md
@knowledge/design-to-code-assets.md
@knowledge/design-to-code-semantic.md
@knowledge/css-strategy.md
@knowledge/design-tokens.md

## Objective

Generate semantic HTML5 markup and layered CSS from Figma node data. The output is framework-agnostic: a standalone `.html` file and a companion `.css` file using the three-layer CSS architecture (Tailwind utilities for layout, CSS Custom Properties for design tokens, and component-scoped classes for visual skin). No React, JSX, or TypeScript is involved.

## Input

The user provides Figma design data as `$ARGUMENTS`. This may be:

- Raw Figma REST API JSON (node tree with children, fills, strokes, effects, text properties)
- Extracted/summarized node properties
- A description of the Figma component or page (layer names, layout, colors, typography)
- A Figma file/node URL (use the REST API knowledge to fetch data if needed)

If the input is insufficient for full generation, ask the user for what is missing. At minimum you need: component structure (parent/child hierarchy), layout mode, and visual properties for each node.

## Process

Follow these steps in order. Each step references the relevant knowledge module for detailed mapping rules.

### Step 1: Analyze Node Tree Structure

Identify the component boundary and internal hierarchy:

- The root node is the top-level container.
- Map each child node to its role: structural container, text element, image, icon/vector, interactive element.
- Identify repeated patterns that could use consistent class naming.
- Note variants or states that may need CSS modifier classes.

### Step 2: Determine Semantic HTML5 Elements

Consult `knowledge/design-to-code-semantic.md`:

- Match layer names against semantic tag heuristics:
  - **Structural landmarks**: `<header>`, `<nav>`, `<main>`, `<aside>`, `<section>`, `<article>`, `<footer>`
  - **Headings**: `<h1>` through `<h6>` based on name and font size heuristics
  - **Text**: `<p>`, `<span>`, `<blockquote>`, `<figcaption>`
  - **Interactive**: `<button>`, `<a>`, `<input>`, `<form>`, `<select>`, `<label>`
  - **Media**: `<img>`, `<picture>`, `<figure>`, `<svg>`
  - **Lists**: `<ul>`, `<ol>`, `<li>` when repeated children are detected
- Enforce heading hierarchy: single `<h1>`, sequential levels, no headings inside buttons or links.
- Default to `<div>` only when no semantic match is found.

### Step 3: Extract Layout Properties

Consult `knowledge/design-to-code-layout.md`:

- For Auto Layout containers: map `layoutMode`, alignment, gap, padding, wrap, constraints.
- For each child: determine sizing mode on primary and counter axes.
- **CRITICAL**: FILL on primary axis requires BOTH `flex-grow: 1` AND `flex-basis: 0`.
- FILL on counter axis with max constraint uses `width: 100%`/`height: 100%`, not `align-self: stretch`.
- Handle absolute children with `position: relative` on parent and constraint-based offsets on child.
- For GROUP/legacy frames: absolute positioning with coordinate adjustments.

### Step 4: Extract Visual Properties

Consult `knowledge/design-to-code-visual.md`:

- **Fills**: solid colors -> `background-color`, gradients -> `background-image`, images -> handled in Step 6.
- **Strokes**: INSIDE alignment -> `box-shadow: inset 0 0 0 {width}px {color}` (NOT `border`). CENTER/OUTSIDE -> standard `border` or `outline`.
- **Effects**: drop shadows -> `box-shadow`, inner shadows -> `box-shadow: inset`, layer blur -> `filter: blur()`, background blur -> `backdrop-filter: blur()`.
- **Corner radius**: uniform -> `border-radius`, per-corner -> `border-radius: TL TR BR BL` with shorthand optimization.
- **Opacity**: node-level -> CSS `opacity`, fill-level -> embedded in color alpha. Never double-apply.
- **Gradients**: convert angle with `90 - figmaAngle` for CSS. Map gradient stops with position percentages.
- **Variable bindings**: resolve to `var(--token-name)` with pixel fallbacks for external library variables.

### Step 5: Extract Typography

Consult `knowledge/design-to-code-typography.md`:

- Map font family, weight, size, and style.
- **Line height**: ALWAYS use unitless ratio (`lineHeightPx / fontSize`). Never use px or % for line-height.
- Letter spacing: convert from Figma percentage to CSS `em` value.
- Text decoration, text transform, text alignment.
- Handle styled segments (mixed fonts/weights/colors within one text node) as nested `<span>` elements.
- Text auto-resize modes interact with layout sizing -- resolve the interaction.

### Step 6: Handle Assets

Consult `knowledge/design-to-code-assets.md`:

- **Vector containers** (nodes with only vector/boolean children and no Auto Layout): export as inline SVG or reference SVG file.
- **Images**: use `<img>` with descriptive `alt` text derived from layer name. Specify `srcset` at **2x minimum** for retina displays.
- **Decision tree**: If the vector is simple and needs color control -> inline SVG. If complex or decorative -> `<img src="asset.svg">`.
- Deduplicate identical images (same `imageHash`).

### Step 7: Extract Design Tokens

Consult `knowledge/design-tokens.md`:

- Collect repeated values (colors, spacing, font sizes, radii, shadows) across the node tree.
- Values used 2+ times are promoted to CSS Custom Properties.
- Apply semantic naming: HSL hue classification for colors, grid-based scale names for spacing.
- Figma Variable bindings take priority over auto-detected tokens.
- Token extraction priority: Variables API > styles > file traversal > Plugin API.

### Step 8: Generate Layered CSS

Consult `knowledge/css-strategy.md`:

Structure the CSS output with clear layer separation:

**Layer 1 -- Tailwind Utilities (layout bones):**
Applied as utility classes directly in the HTML `class` attribute:
- Flexbox: `flex`, `flex-row`, `flex-col`, `items-center`, `justify-between`
- Spacing: `gap-4`, `p-6`, `px-4`, `py-2`
- Sizing: `w-full`, `h-auto`, `max-w-lg`, `flex-1`
- Positioning: `relative`, `absolute`, `top-0`, `right-0`
- Responsive: `md:flex-row`, `lg:gap-8`

**Layer 2 -- CSS Custom Properties (design tokens):**
Defined in a `:root` block at the top of the CSS file:
```css
:root {
  /* Colors */
  --color-primary: #2563eb;
  --color-surface: #ffffff;
  --color-text-primary: #111827;
  --color-border: #e5e7eb;

  /* Typography */
  --font-heading: 'Instrument Sans', sans-serif;
  --font-body: 'Inter', sans-serif;
  --font-size-xl: 1.5rem;
  --font-size-base: 1rem;

  /* Spacing */
  --spacing-sm: 0.5rem;
  --spacing-md: 1rem;
  --spacing-lg: 1.5rem;

  /* Effects */
  --radius-md: 0.5rem;
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
}
```

**Layer 3 -- Component Classes (visual skin):**
BEM-named classes for component-specific visual styles:
```css
.card {
  background-color: var(--color-surface);
  box-shadow: inset 0 0 0 1px var(--color-border);  /* INSIDE stroke */
  border-radius: var(--radius-md);
}

.card__title {
  color: var(--color-text-primary);
  font-family: var(--font-heading);
  font-size: var(--font-size-xl);
  line-height: 1.3;  /* unitless: lineHeightPx / fontSize */
}
```

### Step 9: Generate BEM Class Names

Consult `knowledge/design-to-code-semantic.md`:

- Block name from the root component (kebab-case from Figma layer name).
- Element names with double underscore: `block__element`.
- **NEVER nest deeper than one level**: `block__element` is valid, `block__element__sub` is NOT. Flatten to `block__sub` or use a modifier.
- Modifier with double dash: `block__element--modifier`.
- Deduplicate class names within the component tree.

### Step 10: Add ARIA and Accessibility

- `alt` attribute on every `<img>` (descriptive for content images, empty `alt=""` for decorative).
- `aria-label` on interactive elements without visible text labels.
- `role` attribute where semantic HTML alone is insufficient.
- `aria-hidden="true"` on decorative SVGs and icons.
- Keyboard-accessible interactive elements (buttons, links use native elements; custom controls get `tabindex` and key handlers).

### Step 11: Handle Responsive Breakpoints

If the Figma data includes multiple frames for breakpoints (detected via `#mobile`/`#tablet`/`#desktop` suffix or variant properties):

- Smallest frame provides base styles (no media query).
- Larger frames contribute override styles in `@media (min-width: ...)` blocks.
- Standard breakpoints: mobile (base), tablet (`768px`), desktop (`1024px`).
- Only emit properties that differ from the base.
- Reset layout properties (`align-self: auto`, `flex-grow: 0`, `flex-shrink: 1`, `flex-basis: auto`) that exist in base but not in larger breakpoints.
- Transform fixed pixel widths in responsive overrides to `width: 100%; max-width: Npx`.

## Output

Generate two files:

### 1. `component-name.html`

Semantic HTML5 with Tailwind utility classes for layout and BEM classes for visual skin:

```html
<section class="flex flex-col gap-4 p-6 card">
  <h2 class="card__title">Card Heading</h2>
  <p class="card__description">
    Description text with <span class="card__highlight">highlighted</span> segments.
  </p>
  <figure class="card__media">
    <img
      src="hero.jpg"
      srcset="hero.jpg 1x, hero@2x.jpg 2x"
      alt="Product showcase"
      class="w-full h-auto card__image"
    >
  </figure>
  <button class="flex items-center justify-center card__action" type="button">
    Get Started
  </button>
</section>
```

### 2. `component-name.css`

Layered CSS with clear section comments:

```css
/* ========================================
   Design Tokens (Layer 2)
   ======================================== */
:root {
  --color-primary: #2563eb;
  --color-surface: #ffffff;
  /* ... */
}

/* ========================================
   Component Styles (Layer 3)
   ======================================== */
.card {
  background-color: var(--color-surface);
  border-radius: var(--radius-md);
}

.card__title {
  color: var(--color-text-primary);
  font-family: var(--font-heading);
  font-size: var(--font-size-xl);
  line-height: 1.3;
}

/* ========================================
   Responsive Overrides
   ======================================== */
@media (min-width: 768px) {
  /* Only changed properties */
}

@media (min-width: 1024px) {
  /* Only changed properties */
}
```

### Key Differences from generate-react

This skill generates **vanilla HTML + CSS**:
- No JSX syntax (uses standard HTML attributes: `class` not `className`, `for` not `htmlFor`)
- No TypeScript interfaces or prop types
- No React imports, hooks, or component functions
- No CSS Modules import (classes are global BEM names, not hashed)
- Design tokens are defined inline in the CSS file's `:root` block
- Suitable for static sites, email templates, CMS integration, or any non-React context

### Critical Rules Checklist

Before returning the output, verify:

- [ ] INSIDE strokes use `box-shadow: inset`, not `border`
- [ ] Gradient angles use `90 - figmaAngle` conversion
- [ ] Line heights are unitless ratios (`lineHeightPx / fontSize`)
- [ ] Images reference 2x assets for retina (`srcset` or `@2x` naming)
- [ ] BEM nesting is flat: never `block__element__sub`
- [ ] FILL on primary axis has BOTH `flex-grow: 1` AND `flex-basis: 0`
- [ ] CSS has clear layer separation (tokens in `:root`, visual skin in BEM classes)
- [ ] No hardcoded color values in component classes -- use `var()` for tokens
- [ ] Semantic HTML5 tags used where layer names match heuristics
- [ ] ARIA attributes present on interactive and image elements
- [ ] Uses HTML attributes (`class`, `for`) not JSX attributes (`className`, `htmlFor`)
- [ ] Responsive overrides include layout property resets where needed
