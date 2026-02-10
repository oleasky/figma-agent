---
name: generate-react
description: Generate a production-grade React/TSX component from Figma node data. Use this skill when the user has Figma design data (JSON node tree, REST API response, or component description) and needs a typed React component with CSS Modules, proper semantics, and accessibility.
---

@knowledge/design-to-code-layout.md
@knowledge/design-to-code-visual.md
@knowledge/design-to-code-typography.md
@knowledge/design-to-code-assets.md
@knowledge/design-to-code-semantic.md
@knowledge/css-strategy.md

## Objective

Generate a complete, production-grade React/TSX component from Figma node data. The output includes a typed function component (`.tsx`) and a companion CSS Modules file (`.module.css`) using the three-layer CSS architecture: Tailwind for layout bones, CSS Custom Properties for design tokens, and CSS Modules for visual skin.

## Input

The user provides Figma design data as `$ARGUMENTS`. This may be:

- Raw Figma REST API JSON (node tree with children, fills, strokes, effects, text properties)
- Extracted/summarized node properties
- A description of the Figma component (layer names, layout, colors, typography)
- A Figma file/node URL (use the REST API knowledge to fetch data if needed)

If the input is insufficient for full generation, ask the user for what is missing. At minimum you need: component structure (parent/child hierarchy), layout mode, and visual properties for each node.

## Process

Follow these steps in order. Each step references the relevant knowledge module for detailed mapping rules.

### Step 1: Analyze Node Tree Structure

Identify the component boundary and internal hierarchy:

- The root node is the component container.
- Map each child node to its role: structural container, text element, image, icon/vector, interactive element.
- Identify repeated patterns that suggest list/map rendering.
- Note any component instances or variants that imply prop-driven rendering.

### Step 2: Determine Semantic HTML Elements

Consult `knowledge/design-to-code-semantic.md`:

- Match layer names against semantic tag heuristics (header, nav, button, h1-h6, p, img, section, article, footer, etc.).
- Enforce heading hierarchy: single `<h1>`, sequential levels, no headings inside interactive elements.
- Detect interactive elements from names (button, link, input, form, checkbox, toggle, etc.).
- Map structural landmarks (header, nav, footer, main, aside, section).
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
- Handle styled segments (mixed fonts/weights/colors within one text node) as `<span>` elements.
- Text auto-resize modes interact with layout sizing -- resolve the interaction.

### Step 6: Handle Assets

Consult `knowledge/design-to-code-assets.md`:

- **Vector containers** (nodes with only vector/boolean children and no Auto Layout): export as inline SVG or `<img>` referencing an SVG file.
- **Images**: use `<img>` with `alt` text derived from layer name. Export at **2x minimum** for retina displays.
- **Decision tree**: If the vector is simple and needs color control -> inline SVG. If complex or decorative -> `<img src="asset.svg">`.
- Deduplicate identical images (same `imageHash`).

### Step 7: Generate CSS Using Three-Layer Architecture

Consult `knowledge/css-strategy.md`:

**Layer 1 -- Tailwind (layout bones):**
Apply Tailwind utility classes directly in JSX for:
- Flexbox: `flex`, `flex-row`, `flex-col`, `items-center`, `justify-between`
- Spacing: `gap-4`, `p-6`, `px-4`, `py-2`
- Sizing: `w-full`, `h-auto`, `max-w-lg`, `flex-1`
- Positioning: `relative`, `absolute`, `top-0`, `right-0`
- Responsive: `md:flex-row`, `lg:gap-8`

**Layer 2 -- CSS Custom Properties (design tokens):**
Define in the CSS Module file or a shared `tokens.css`:
```css
/* Token references consumed by Layer 3 */
color: var(--color-primary);
font-size: var(--font-size-lg);
border-radius: var(--radius-md);
```

**Layer 3 -- CSS Modules (visual skin):**
Component-specific visual styles in `.module.css`:
```css
.card {
  background-color: var(--color-surface);
  box-shadow: inset 0 0 0 1px var(--color-border);  /* INSIDE stroke */
  border-radius: var(--radius-lg);
}

.card__title {
  color: var(--color-text-primary);
  font-family: var(--font-heading);
  font-size: var(--font-size-xl);
  line-height: 1.3;  /* unitless ratio */
}
```

### Step 8: Generate BEM Class Names

Consult `knowledge/design-to-code-semantic.md`:

- Block name from the root component (kebab-case from layer name).
- Element names with double underscore: `block__element`.
- **NEVER nest deeper than one level**: `block__element` is valid, `block__element__sub` is NOT. Flatten to `block__sub` or use a modifier.
- Modifier with double dash: `block__element--modifier`.
- Deduplicate class names within the component tree.

### Step 9: Generate TypeScript Interfaces

Define prop interfaces for the component:

- Extract variant-driven props from Figma component properties (boolean, text, instance swap).
- Text content nodes become string props.
- Image nodes become `src`/`alt` prop pairs.
- Interactive elements get event handler props (`onClick`, `onSubmit`, etc.).
- Use descriptive names, not Figma layer names directly.

### Step 10: Assemble React Component

Combine all outputs into a complete `.tsx` file:

```tsx
import React from 'react';
import styles from './ComponentName.module.css';

interface ComponentNameProps {
  title: string;
  description?: string;
  onAction?: () => void;
}

export function ComponentName({ title, description, onAction }: ComponentNameProps) {
  return (
    <section className={`flex flex-col gap-4 p-6 ${styles.card}`}>
      <h2 className={`${styles.card__title}`}>
        {title}
      </h2>
      {description && (
        <p className={`${styles.card__description}`}>
          {description}
        </p>
      )}
      <button
        className={`flex items-center justify-center ${styles.card__action}`}
        onClick={onAction}
        type="button"
      >
        Get Started
      </button>
    </section>
  );
}
```

## Output

Generate two files:

### 1. `ComponentName.tsx`

- Named export (not default export) with PascalCase component name.
- TypeScript interface for props.
- Semantic HTML elements with Tailwind layout classes + CSS Module visual classes.
- Proper ARIA attributes where needed (`aria-label`, `role`, `alt`).
- Inline SVGs for simple vectors, `<img>` for complex assets/images.

### 2. `ComponentName.module.css`

- BEM class names with flat hierarchy.
- Visual properties only (colors, backgrounds, borders/shadows, effects, typography skin).
- CSS Custom Property references for design tokens (`var(--token-name)`).
- Responsive overrides via media queries if multi-frame breakpoints detected.
- Comments showing Figma property origin for maintainability.

### Critical Rules Checklist

Before returning the component, verify:

- [ ] INSIDE strokes use `box-shadow: inset`, not `border`
- [ ] Gradient angles use `90 - figmaAngle` conversion
- [ ] Line heights are unitless ratios (`lineHeightPx / fontSize`)
- [ ] Images export at 2x minimum for retina
- [ ] BEM nesting is flat: never `block__element__sub`
- [ ] FILL on primary axis has BOTH `flex-grow: 1` AND `flex-basis: 0`
- [ ] Layout is in Tailwind classes; visual skin is in CSS Modules
- [ ] No hardcoded color values -- use CSS Custom Properties for anything that could be a token
- [ ] Semantic HTML tags used where layer names match heuristics
- [ ] ARIA attributes present on interactive and image elements
