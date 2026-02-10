---
name: extract-tokens
description: Extract design tokens from Figma Variables, styles, or node data and generate CSS Custom Properties + Tailwind config. Use this skill when the user has Figma file data (Variables API response, style definitions, or node tree) and needs a structured token output with semantic naming, mode-aware rendering, and CSS/Tailwind integration.
---

@knowledge/design-tokens.md
@knowledge/design-tokens-variables.md
@knowledge/figma-api-variables.md
@knowledge/css-strategy.md

## Objective

Extract design tokens from Figma data and generate production-grade CSS Custom Properties (`:root` block with mode-aware overrides), optional SCSS variables, and a Tailwind `theme.extend` configuration snippet. The skill handles the full token pipeline: source identification, variable resolution, threshold-based promotion, semantic naming (HSL color classification, spacing scale detection), and multi-format rendering.

## Input

The user provides Figma token source data as `$ARGUMENTS`. This may be:

- **Variables API response** -- JSON from `GET /v1/files/:key/variables/local` containing variables and collections with `valuesByMode`
- **Plugin API variable data** -- Extracted variable collections from `figma.variables.getLocalVariableCollectionsAsync()`
- **Node tree with bound variables** -- Figma REST API node data containing `boundVariables` on fills, strokes, layout properties, and text
- **Style definitions** -- Published styles from the file (colors, text styles, effects)
- **Raw node tree** -- Full node subtree for heuristic-based token extraction (file traversal fallback)
- **Plain language description** -- Description of the design system's colors, spacing, typography, etc.

If the input is insufficient, ask the user for clarification. At minimum you need either: (a) variable collections with values, or (b) a node tree with enough nodes to detect repeated values for promotion.

## Process

Follow these steps in order. Consult the referenced knowledge modules for all mapping rules, naming conventions, and edge cases.

### Step 1: Identify Token Source and Access Path

Determine which token extraction path to use based on the input data. Consult `knowledge/figma-api-variables.md` for access requirements and `knowledge/design-tokens-variables.md` for the source priority chain.

**Priority order:**

1. **Variables API** (best) -- Structured, multi-mode, scoped. Requires Enterprise org full member access with `file_variables:read` scope. If the user provides Variables API JSON, use this path.
2. **Published styles** -- Good for non-Enterprise plans. Limited to published content.
3. **File tree traversal** -- Fallback for any plan. Heuristic-based extraction from node properties. Uses threshold promotion.
4. **Plugin API** -- When running inside a Figma plugin context. Access via `figma.variables.getLocalVariableCollectionsAsync()`.

**If the user does not have Enterprise access**, inform them that the Variables API path is unavailable and proceed with file traversal + threshold promotion. Do NOT block on missing Variables access -- always provide a working fallback path.

### Step 2: Extract Raw Token Values

Based on the identified source path:

**Variables API path:**
- Parse variable collections and their modes
- For each variable: read `resolvedType` (COLOR, FLOAT, STRING), `valuesByMode`, `scopes`
- Classify each collection's modes using mode name detection (see Step 3)
- Distinguish local vs remote variables using the `remote` boolean field
- Follow alias chains: if a variable's value is a `VariableAlias`, resolve to the terminal value for each mode

**File traversal path:**
- Traverse the node tree recursively
- Collect values from five domains, tracking usage count per unique value:
  - **Colors**: solid fills (`fill.color`), strokes (`stroke.color`), shadow effect colors
  - **Spacing**: `itemSpacing` (gap), `paddingTop/Right/Bottom/Left`, margins
  - **Typography**: font families, font sizes, font weights, line heights
  - **Effects**: box shadows (drop shadow, inner shadow), border radii
  - **Breakpoints**: frame dimensions that suggest responsive breakpoints
- Normalize values before comparison (lowercase hex, whitespace-normalize rgba)
- Collect any `boundVariables` references found on nodes (these get priority in Step 6)

### Step 3: Detect Modes (Variables Path Only)

Consult `knowledge/design-tokens-variables.md` Section 4 for mode detection rules.

Classify each collection's modes as one of:
- **Theme modes** -- Mode names like "Light", "Dark", "Brand A", "Brand B"
- **Breakpoint modes** -- Mode names like "Mobile", "Tablet", "Desktop", "sm", "md", "lg"
- **Unknown** -- Cannot classify; treat as theme modes by default

**Default mode selection:**
- Theme modes: "Light" is default (base `:root`)
- Breakpoint modes: smallest breakpoint (typically "Mobile") is default (mobile-first)
- Unknown: first mode in the collection is default

### Step 4: Promote Values to Tokens

Consult `knowledge/design-tokens.md` Section 1 (Stage 2: PROMOTE).

**Threshold-based promotion (file traversal path):**
- Values used 2 or more times are promoted to CSS Custom Properties
- Single-use values remain inline in component CSS (not tokenized)
- The threshold of 2 is the default; adjust if the user specifies differently

**Variables path:**
- All Figma Variables are automatically promoted (they are explicit designer-curated tokens)
- No threshold needed -- variables are tokens by definition

**Priority when both exist:**
- Bound variable references on a property always take priority
- Auto-detected tokens fill gaps where no variable binding exists
- If a variable and an auto-detected token produce the same CSS value, the variable wins

### Step 5: Assign Semantic Names

Consult `knowledge/design-tokens.md` Sections 3-6 for naming rules per category.

**Token naming convention:** `--{category}-{name}-{variant}`

**Colors (HSL-based classification):**
1. Convert to HSL (Hue 0-360, Saturation 0-100, Lightness 0-100)
2. Classify:
   - Saturation < 10% --> `neutral` with lightness scale (100-900)
   - Hue 0-20 or 340-360 --> `error`
   - Hue 30-60 --> `warning`
   - Hue 90-150 --> `success`
   - Most-used saturated color --> `primary`
   - Second most-used saturated --> `secondary`
   - Remaining --> `accent`, `accent-2`, etc.
3. Neutral lightness scale: `step = Math.round((1 - lightness / 100) * 8 + 1) * 100` clamped to [100, 900]
4. Output format: HSL values for easy manipulation: `--color-primary: hsl(220, 90%, 56%)`

**If Variables API is the source**, use the variable's own path as the name base (e.g., `color/primary/500` --> `--color-primary-500`). HSL classification is only needed for file traversal path where names must be inferred.

**Spacing (4px base unit detection):**
1. Detect the base unit from collected spacing values (typically 4px or 8px)
2. Express each spacing value as a multiple of the base: `value / baseUnit`
3. Name pattern: `--spacing-{multiplier}` (e.g., `--spacing-1` = 4px, `--spacing-4` = 16px)
4. If a clear base unit cannot be detected, use pixel-based naming: `--spacing-4` = 4px, `--spacing-16` = 16px

**Typography:**
- Font families: `--font-primary`, `--font-secondary`, `--font-mono`
- Font sizes: `--text-xs`, `--text-sm`, `--text-base`, `--text-lg`, `--text-xl`, `--text-2xl`, etc. (match to nearest standard scale)
- Font weights: `--font-regular` (400), `--font-medium` (500), `--font-semibold` (600), `--font-bold` (700)

**Effects:**
- Shadows: `--shadow-sm`, `--shadow-md`, `--shadow-lg` (by blur radius / spread scale)
- Border radii: `--radius-sm`, `--radius-md`, `--radius-lg`, `--radius-full`

**Name deduplication:**
- If two tokens would get the same name, append a numeric suffix: `--color-accent`, `--color-accent-2`
- For Variables API tokens, the variable path provides unique names naturally

### Step 6: Render CSS Custom Properties

Consult `knowledge/design-tokens-variables.md` Sections 5-7 for mode-aware rendering and `knowledge/css-strategy.md` for where tokens fit in the three-layer architecture.

**Base `:root` block (default mode values):**

```css
/* ========================================
   Design Tokens (Layer 2)
   ======================================== */

:root {
  /* Colors */
  --color-primary: hsl(220, 90%, 56%);
  --color-secondary: hsl(258, 88%, 66%);
  --color-neutral-100: hsl(0, 0%, 96%);
  --color-neutral-900: hsl(0, 0%, 9%);
  --color-error: hsl(0, 84%, 60%);
  --color-success: hsl(142, 71%, 45%);

  /* Spacing (4px base) */
  --spacing-1: 0.25rem;   /* 4px */
  --spacing-2: 0.5rem;    /* 8px */
  --spacing-4: 1rem;      /* 16px */
  --spacing-6: 1.5rem;    /* 24px */
  --spacing-8: 2rem;      /* 32px */

  /* Typography */
  --font-primary: 'Inter', sans-serif;
  --font-heading: 'Instrument Sans', sans-serif;
  --text-sm: 0.875rem;    /* 14px */
  --text-base: 1rem;      /* 16px */
  --text-lg: 1.125rem;    /* 18px */
  --text-xl: 1.5rem;      /* 24px */

  /* Effects */
  --radius-sm: 0.25rem;   /* 4px */
  --radius-md: 0.5rem;    /* 8px */
  --radius-lg: 1rem;      /* 16px */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.1);
}
```

**Theme mode overrides:**

```css
/* Dark theme */
@media (prefers-color-scheme: dark) {
  :root {
    --color-primary: hsl(220, 90%, 65%);
    --color-neutral-100: hsl(0, 0%, 15%);
    --color-neutral-900: hsl(0, 0%, 95%);
    /* Only tokens that change in dark mode */
  }
}

/* Class-based theme (alternative/additional) */
[data-theme="dark"] {
  --color-primary: hsl(220, 90%, 65%);
  --color-neutral-100: hsl(0, 0%, 15%);
  --color-neutral-900: hsl(0, 0%, 95%);
}
```

**Breakpoint mode overrides (mobile-first):**

```css
@media (min-width: 768px) {
  :root {
    --spacing-4: 1.25rem;  /* 20px at tablet */
    --text-xl: 1.75rem;    /* 28px at tablet */
  }
}

@media (min-width: 1024px) {
  :root {
    --spacing-4: 1.5rem;   /* 24px at desktop */
    --text-xl: 2rem;       /* 32px at desktop */
  }
}
```

**Rendering rules:**
- Only emit overrides for tokens whose values differ from the base mode
- Theme collections render as `@media (prefers-color-scheme)` AND `[data-theme]` selector (both, for progressive enhancement)
- Breakpoint collections render as `@media (min-width)` with mobile-first ordering
- Use rem units for spacing and font sizes (divide pixel value by 16)
- Use HSL for colors (enables easy lightness/saturation manipulation)
- Add comments showing the original pixel values for developer reference

### Step 7: Render Tailwind Config Extension

Generate a `tailwind.config.ts` extension snippet that maps tokens to Tailwind utilities:

```typescript
import type { Config } from 'tailwindcss'

export default {
  theme: {
    extend: {
      colors: {
        primary: 'var(--color-primary)',
        secondary: 'var(--color-secondary)',
        neutral: {
          100: 'var(--color-neutral-100)',
          900: 'var(--color-neutral-900)',
        },
        error: 'var(--color-error)',
        success: 'var(--color-success)',
      },
      fontFamily: {
        primary: 'var(--font-primary)',
        heading: 'var(--font-heading)',
      },
      fontSize: {
        sm: 'var(--text-sm)',
        base: 'var(--text-base)',
        lg: 'var(--text-lg)',
        xl: 'var(--text-xl)',
      },
      spacing: {
        1: 'var(--spacing-1)',
        2: 'var(--spacing-2)',
        4: 'var(--spacing-4)',
        6: 'var(--spacing-6)',
        8: 'var(--spacing-8)',
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
      },
    },
  },
} satisfies Config
```

**Tailwind mapping rules:**
- All Tailwind values reference CSS Custom Properties via `var()` -- never hardcode values
- This ensures Tailwind utilities automatically adapt to theme/breakpoint mode changes
- Color tokens map to `theme.extend.colors` (enables `bg-primary`, `text-secondary`, etc.)
- Spacing tokens map to `theme.extend.spacing` (enables `gap-4`, `p-6`, etc.)
- Typography tokens split across `fontFamily`, `fontSize`
- Effect tokens map to `borderRadius`, `boxShadow`

### Step 8: Render SCSS Variables (If Requested)

Only generate SCSS output if the user explicitly requests it:

```scss
// _variables.scss — Generated from Figma design tokens

// Colors
$color-primary: var(--color-primary);
$color-secondary: var(--color-secondary);

// Spacing
$spacing-1: var(--spacing-1);
$spacing-4: var(--spacing-4);

// Typography
$font-primary: var(--font-primary);
$text-base: var(--text-base);
```

SCSS variables reference CSS Custom Properties (not raw values) to maintain single source of truth.

## Output

Generate two files (three if SCSS requested):

### 1. `tokens.css`

- `:root` block with all promoted tokens organized by category (colors, spacing, typography, effects)
- Mode-aware overrides via `@media (prefers-color-scheme)`, `[data-theme]` selectors, or `@media (min-width)` for breakpoints
- Comments showing original Figma variable paths or pixel values
- HSL format for colors, rem units for spacing/typography

### 2. `tailwind.config.ts` (extension snippet)

- `theme.extend` configuration referencing CSS Custom Properties
- All values use `var()` references to tokens defined in `tokens.css`
- Ready to merge into existing Tailwind configuration

### 3. `_variables.scss` (only if requested)

- SCSS variable declarations referencing CSS Custom Properties

### Output Checklist

Before returning token output, verify:

- [ ] Colors use HSL format (`hsl(h, s%, l%)`)
- [ ] Spacing values use rem units with pixel comments
- [ ] Spacing is based on consistent base unit (default 4px)
- [ ] Token names follow `--{category}-{name}-{variant}` convention
- [ ] Variables API tokens preserve original variable path in names
- [ ] File traversal tokens use HSL classification for color naming
- [ ] Mode overrides only contain tokens that differ from the base
- [ ] Theme modes render both `@media (prefers-color-scheme)` and `[data-theme]`
- [ ] Breakpoint modes render mobile-first `@media (min-width)` in ascending order
- [ ] Tailwind config references `var()` for all values (no hardcoded values)
- [ ] Fallback path is documented when Variables API is not available
- [ ] Single-use values (below threshold) are NOT promoted to tokens
