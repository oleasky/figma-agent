# Design Token Extraction & Generation

## Purpose

Authoritative reference for extracting design tokens from Figma designs and rendering them as CSS Custom Properties, SCSS variables, or Tailwind theme configuration. Documents the complete token pipeline: traversing an ExtractedNode tree to collect color, spacing, typography, and effect values; promoting repeated values to tokens via a threshold system; assigning semantic names using HSL analysis and scale detection; building reverse lookup maps for CSS variable substitution; and rendering the final token output in multiple formats.

## When to Use

Reference this module when you need to:

- Extract design tokens from a Figma node tree (colors, spacing, typography, effects)
- Understand the threshold-based promotion system that decides which values become CSS variables
- Apply semantic color naming based on HSL hue/saturation classification
- Generate spacing scale names from detected base units (4px, 8px grids)
- Build a token lookup map for substituting raw values with `var()` references during CSS generation
- Render tokens as CSS Custom Properties in a `:root` block with mode-aware media queries
- Render tokens as SCSS `$variable` declarations
- Map token categories to a Tailwind theme configuration
- Understand the priority system: Figma Variables override auto-detected tokens
- Handle token naming conflicts and deduplication

---

## Content

### 1. Token Extraction Pipeline

The token pipeline follows a four-stage process: Collect, Promote, Name, and Render.

```
Stage 1: COLLECT
  Traverse ExtractedNode tree
  Collect raw values from fills, strokes, effects, layout, text
  Track usage count per unique value
  Collect Figma Variable bindings separately
      ↓
Stage 2: PROMOTE
  Apply threshold filter (default: usageCount >= 2)
  Single-use values stay inline in component CSS
  Multi-use values become CSS variables
  Figma Variables always promoted (explicit bindings)
      ↓
Stage 3: NAME
  Assign semantic names to promoted tokens
  Colors: HSL-based classification → primary, neutral-800, success
  Spacing: Base unit detection → spacing-1, spacing-4
  Typography: Type scale + role → text-lg, font-primary, font-bold
  Effects: Size scale → shadow-md, radius-lg
      ↓
Stage 4: RENDER
  Generate CSS Custom Properties (:root block)
  Generate SCSS $variables (_variables.scss)
  Generate Tailwind theme config (theme.extend)
  Generate TokenLookup for CSS variable substitution
```

#### Entry Point: `collectAllTokens`

The pipeline starts with `collectAllTokens(node)`, which calls four specialized collectors and one variable collector:

```
collectAllTokens(node) →
  ├── collectColors(node)          → ColorToken[]
  ├── collectSpacing(node)         → SpacingToken[]
  ├── collectTypography(node)      → TypographyTokens
  ├── collectEffects(node)         → EffectTokens
  └── collectFigmaVariables(node)  → FigmaVariableToken[]
```

Each collector traverses the entire node tree recursively, extracting values relevant to its domain and tracking usage counts.

---

### 2. Token Types

All tokens share a common shape: a name (CSS variable name), a value (raw CSS value), and a usage count (number of occurrences in the design).

#### Type Definitions

| Token Type | Name Pattern | Value Type | Additional Fields |
|-----------|-------------|-----------|-------------------|
| `ColorToken` | `--color-primary`, `--color-neutral-800` | hex string or rgba() | `semantic` classification |
| `SpacingToken` | `--spacing-1`, `--spacing-4` | number (pixels) | `context` (gap, padding, margin) |
| `FontFamilyToken` | `--font-primary`, `--font-mono` | string (family name) | -- |
| `FontSizeToken` | `--text-base`, `--text-lg` | number (pixels) | -- |
| `FontWeightToken` | `--font-bold`, `--font-medium` | number (100-900) | -- |
| `ShadowToken` | `--shadow-sm`, `--shadow-md` | string (CSS box-shadow) | -- |
| `RadiusToken` | `--radius-sm`, `--radius-lg` | number (pixels) or string | -- |
| `FigmaVariableToken` | `--color-link-default` | string (CSS value) | `figmaName`, `isLocal`, `collectionId`, `modeValues` |

#### Container Types

Tokens are grouped into domain-specific containers:

```
DesignTokens
  ├── colors: ColorToken[]
  ├── spacing: SpacingToken[]
  ├── typography: TypographyTokens
  │     ├── families: FontFamilyToken[]
  │     ├── sizes: FontSizeToken[]
  │     └── weights: FontWeightToken[]
  ├── effects: EffectTokens
  │     ├── shadows: ShadowToken[]
  │     └── radii: RadiusToken[]
  ├── figmaVariables?: FigmaVariableToken[]
  └── variableCollections?: VariableCollection[]
```

---

### 3. Color Token Extraction

Colors are extracted from three sources within each node: solid fills, strokes, and shadow effects. Gradient stop colors are skipped in the current implementation.

#### Collection Sources

| Source | Extraction | CSS Property Origin |
|--------|-----------|-------------------|
| Solid fills | `fill.color` (when `fill.type === 'SOLID'`) | `background-color`, `color` |
| Strokes | `stroke.color` | `border-color` |
| Shadow effects | `effect.color` (DROP_SHADOW, INNER_SHADOW) | `box-shadow` |

#### Normalization

Before comparison, all color values are normalized:

- **Hex colors:** Lowercased (`#1A73E8` becomes `#1a73e8`)
- **RGBA colors:** Whitespace normalized (`rgba( 255,  128,  64, 0.5 )` becomes `rgba(255, 128, 64, 0.5)`)

Normalization is critical for accurate deduplication. Without it, `#1A73E8` and `#1a73e8` would be treated as two different colors.

#### HSL-Based Semantic Naming

After collection and sorting by usage count (most-used first), each color is assigned a semantic name based on its HSL (Hue, Saturation, Lightness) values.

**Step 1: Convert to HSL**

```
Hex → RGB (0-255) → RGB (0-1) → HSL (h: 0-360, s: 0-100, l: 0-100)
```

**Step 2: Classify by saturation and hue**

| HSL Condition | Semantic | Name Pattern |
|--------------|----------|-------------|
| Saturation < 10% | `neutral` | `--color-neutral-{100-900}` (by lightness) |
| Hue 0-20 or 340-360 | `error` | `--color-error` |
| Hue 30-60 | `warning` | `--color-warning` |
| Hue 90-150 | `success` | `--color-success` |
| Most-used saturated color | `primary` | `--color-primary` |
| Second most-used saturated | `secondary` | `--color-secondary` |
| Remaining saturated colors | `accent` | `--color-accent`, `--color-accent-2`, ... |

**Step 3: Neutral lightness scale**

Neutral colors (saturation < 10%) use a 100-900 scale based on lightness, inverted so that 100 is lightest and 900 is darkest:

```
step = Math.round((1 - lightness / 100) * 8 + 1) * 100
Clamped to range [100, 900]

lightness 95% → step 100 (near white)
lightness 85% → step 200
lightness 50% → step 500 (medium gray)
lightness 15% → step 800
lightness  5% → step 900 (near black)
```

#### Semantic Classification Logic

The classification uses this priority order:

1. **Neutral first** -- Low saturation (< 10%) colors are always `neutral`, regardless of hue
2. **Functional colors** -- Error (red hue), warning (yellow/orange hue), success (green hue)
3. **Ranked by usage** -- Among remaining saturated colors, the most-used is `primary`, second is `secondary`, rest are `accent`

The functional color check happens before the usage-ranked check. This means a red color will be classified as `error` even if it is the most-used saturated color.

#### Duplicate Name Resolution

When multiple colors would receive the same name (e.g., two colors both classified as `--color-neutral-500`), a numeric suffix is appended:

```
First:  --color-neutral-500
Second: --color-neutral-500-2
Third:  --color-neutral-500-3
```

#### Example Color Collection

Given a design with these colors:

| Color | Usage | HSL | Classification | Token Name |
|-------|-------|-----|----------------|------------|
| `#1a73e8` | 12 | H:217 S:84 L:51 | primary (most-used saturated) | `--color-primary` |
| `#333333` | 28 | H:0 S:0 L:20 | neutral (s<10, l=20) | `--color-neutral-800` |
| `#f5f5f5` | 15 | H:0 S:0 L:96 | neutral (s<10, l=96) | `--color-neutral-100` |
| `#34a853` | 3 | H:137 S:52 L:43 | success (h=137, in 90-150) | `--color-success` |
| `#ea4335` | 2 | H:5 S:81 L:56 | error (h=5, in 0-20) | `--color-error` |
| `#5f6368` | 8 | H:213 S:5 L:39 | neutral (s<10, l=39) | `--color-neutral-600` |

> For how extracted colors resolve Figma Variable bindings, see `design-to-code-visual.md` Section 7.

---

### 4. Spacing Token Extraction

Spacing values are collected from layout properties: `gap`, `counterAxisGap`, and `padding` (all four sides). Zero values are skipped.

#### Collection Sources

| Source | Property | Context Tag |
|--------|----------|------------|
| Primary gap | `layout.gap` | `gap` |
| Counter axis gap | `layout.counterAxisGap` | `gap` |
| Padding top | `layout.padding.top` | `padding` |
| Padding right | `layout.padding.right` | `padding` |
| Padding bottom | `layout.padding.bottom` | `padding` |
| Padding left | `layout.padding.left` | `padding` |

Each spacing value is tracked with its usage count and the contexts where it appears (gap, padding, or both).

#### Base Unit Detection

The naming algorithm detects whether the collected spacing values follow a regular scale:

**Step 1:** Try common base units in order: 4, 8, 2, 5, 10

```
For each candidate base unit:
  If ALL spacing values are evenly divisible by this base → use it
```

**Step 2:** If no common base fits, compute the GCD (Greatest Common Divisor) of all values.

**Step 3:** If a base unit is found (> 1), use scale-based naming. Otherwise, use direct-value naming.

#### Scale-Based Naming

When all values fit a base unit, tokens use step numbers:

```
Base unit: 4px
Values: [4, 8, 12, 16, 24, 32, 48]

4px  ÷ 4 = step 1 → --spacing-1
8px  ÷ 4 = step 2 → --spacing-2
12px ÷ 4 = step 3 → --spacing-3
16px ÷ 4 = step 4 → --spacing-4
24px ÷ 4 = step 6 → --spacing-6
32px ÷ 4 = step 8 → --spacing-8
48px ÷ 4 = step 12 → --spacing-12
```

#### Direct-Value Naming

When values do not fit a regular scale, the raw pixel value is used:

```
Values: [5, 11, 17, 23]
→ --spacing-5, --spacing-11, --spacing-17, --spacing-23
```

#### T-Shirt Size Scale

An alternative approach uses semantic T-shirt size names instead of numeric steps, following an 8-point grid:

| Token | Value | Base Unit Step |
|-------|-------|---------------|
| `--token-spacing-xs` | 4px | 0.5 |
| `--token-spacing-sm` | 8px | 1 |
| `--token-spacing-md` | 16px | 2 |
| `--token-spacing-lg` | 24px | 3 |
| `--token-spacing-xl` | 32px | 4 |
| `--token-spacing-2xl` | 48px | 6 |
| `--token-spacing-3xl` | 64px | 8 |

This is a manual token definition, not auto-generated. Auto-generated spacing tokens use numeric step names. Projects can rename tokens to T-shirt sizes after generation.

---

### 5. Typography Token Extraction

Typography tokens are collected from text nodes: font families, font sizes, and font weights. Each is tracked independently with its own usage count.

#### Font Family Token Naming

Families are sorted alphabetically, then named by role:

| Role | Detection | Token Name |
|------|-----------|------------|
| Primary | Most-used font family (by usage count) | `--font-primary` |
| Monospace | Name matches monospace patterns (mono, code, consolas, courier, etc.) | `--font-mono` |
| Secondary | First non-primary, non-mono font | `--font-secondary` |
| Others | Remaining fonts by index | `--font-family-{n}` |

**Monospace detection patterns:** `mono`, `code`, `consolas`, `courier`, `fira code`, `jetbrains`, `menlo`, `monaco`, `source code`, `ubuntu mono`, `sf mono`, `roboto mono`, `ibm plex mono`. Detection is case-insensitive substring matching.

#### Font Size Token Naming (Type Scale)

Font sizes use a T-shirt size scale anchored to a "base" size. The base is the collected size closest to 16px.

**Scale positions:**

| Position | Scale Name | Relative to Base |
|----------|-----------|-----------------|
| base - 2 | `--text-xs` | Two steps smaller |
| base - 1 | `--text-sm` | One step smaller |
| base     | `--text-base` | Anchor (closest to 16px) |
| base + 1 | `--text-lg` | One step larger |
| base + 2 | `--text-xl` | Two steps larger |
| base + 3 | `--text-2xl` | Three steps larger |
| base + 4 | `--text-3xl` | Four steps larger |
| base + 5 | `--text-4xl` | Five steps larger |
| base + 6 | `--text-5xl` | Six steps larger |
| base + 7 | `--text-6xl` | Seven steps larger |

Sizes outside the scale range fall back to `--text-{px}` naming (e.g., `--text-72`).

**Example:** Given collected sizes `[12, 14, 16, 18, 24, 32, 48]`, the size closest to 16px is 16px (base index = 2):

| Size | Index | Relative | Token |
|------|-------|----------|-------|
| 12px | 0 | base - 2 | `--text-xs` |
| 14px | 1 | base - 1 | `--text-sm` |
| 16px | 2 | base | `--text-base` |
| 18px | 3 | base + 1 | `--text-lg` |
| 24px | 4 | base + 2 | `--text-xl` |
| 32px | 5 | base + 3 | `--text-2xl` |
| 48px | 6 | base + 4 | `--text-3xl` |

#### Font Weight Token Naming

Standard CSS weights map to named tokens:

| Weight | Token Name |
|--------|------------|
| 100 | `--font-thin` |
| 200 | `--font-extralight` |
| 300 | `--font-light` |
| 400 | `--font-regular` |
| 500 | `--font-medium` |
| 600 | `--font-semibold` |
| 700 | `--font-bold` |
| 800 | `--font-extrabold` |
| 900 | `--font-black` |

Non-standard weights (e.g., 450) use `--font-weight-{n}`.

> For how typography tokens are consumed during CSS generation (token lookup), see `design-to-code-typography.md` Section 11.

---

### 6. Effect Token Extraction

Effects are split into two categories: shadows (from `DROP_SHADOW` and `INNER_SHADOW` effects) and radii (from `cornerRadius` properties).

#### Shadow Collection

Each unique shadow is identified by its full CSS box-shadow value string. Drop shadows produce `Xpx Ypx Rpx Spx color`, inner shadows produce `inset Xpx Ypx Rpx Spx color`. Blur and background blur effects are not collected as shadow tokens (they do not have box-shadow equivalents).

Shadows are sorted by blur radius (smallest first) for naming.

#### Shadow Naming

Shadows use a size scale based on their position in the sorted list:

| Count | Naming |
|-------|--------|
| 1 shadow | `--shadow-md` (single shadow defaults to medium) |
| 2-6 shadows | `--shadow-sm`, `--shadow-md`, `--shadow-lg`, `--shadow-xl`, `--shadow-2xl`, `--shadow-3xl` |
| 7+ shadows | `--shadow-1`, `--shadow-2`, ... (numeric fallback) |

The naming starts at index 1 of the scale array (`sm`), not index 0 (`none`), because zero shadows would not be collected.

#### Radius Collection

Corner radii are collected from node `cornerRadius` properties. Per-corner radii (when `cornerRadius` is an object with `topLeft`, `topRight`, `bottomRight`, `bottomLeft`) are normalized to the maximum value for classification purposes.

Radii are sorted by value ascending for naming.

#### Radius Naming

| Condition | Token Name |
|-----------|------------|
| Value >= 9999 | `--radius-full` |
| Value === 0 | `--radius-none` |
| Single radius | `--radius-md` (defaults to medium) |
| 2-6 radii | `--radius-sm`, `--radius-md`, `--radius-lg`, `--radius-xl`, `--radius-2xl`, `--radius-3xl` |
| 7+ radii | `--radius-1`, `--radius-2`, ... (numeric fallback) |

> For how fills, strokes, and effects are extracted from Figma nodes, see `design-to-code-visual.md`.

---

### 7. Threshold-Based Promotion

Not every unique value in a design should become a CSS variable. Single-use values add token bloat without reuse benefit. The promotion system filters tokens by usage count.

#### Promotion Logic

```
promoteTokens(tokens, threshold = 2):
  colors   → keep where usageCount >= threshold
  spacing  → keep where usageCount >= threshold
  typography.families → keep where usageCount >= threshold
  typography.sizes    → keep where usageCount >= threshold
  typography.weights  → keep where usageCount >= threshold
  effects.shadows → keep where usageCount >= threshold
  effects.radii   → keep where usageCount >= threshold
  figmaVariables  → always keep local variables (filter out external)
```

#### Default Threshold: 2

The default threshold of 2 means a value must appear at least twice in the design to be promoted to a token. This prevents:

- A one-off custom color from becoming `--color-accent-7`
- A single padding value from becoming `--spacing-17`
- A unique shadow definition from becoming `--shadow-5`

#### Figma Variables Override Threshold

Figma Variables are always promoted regardless of usage count because they represent **explicit design decisions** by the designer. If a designer creates a variable named `spacing/md` and binds it to a gap property, that variable should always appear in the token output even if it is used only once.

Only **local** Figma Variables are included in the promoted output. External library variables are excluded from the token file because their definitions come from the library file, not the current file. External variables appear in component CSS as `var(--name, fallback)` references.

#### Configurable Threshold

The threshold is configurable via the `promotionThreshold` option:

```
threshold = 1  → Every unique value becomes a token (comprehensive but verbose)
threshold = 2  → Default — values used 2+ times become tokens
threshold = 3  → Stricter — values used 3+ times (fewer tokens, more inline values)
threshold = 0  → Everything promoted (same as threshold = 1)
```

#### Promotion Example

Given these collected colors:

| Color | Usage Count | Promoted (threshold=2)? |
|-------|------------|------------------------|
| `#1a73e8` | 12 | Yes |
| `#333333` | 8 | Yes |
| `#f5f5f5` | 15 | Yes |
| `#ea4335` | 2 | Yes |
| `#ff69b4` | 1 | No (stays inline) |
| `#abcdef` | 1 | No (stays inline) |

The unpromoted colors (`#ff69b4`, `#abcdef`) remain as raw hex values in their component CSS instead of becoming CSS variables.

---

### 8. Token Naming Conventions

#### Category Prefix System

All tokens follow a `--{category}-{name}` pattern:

| Category | Prefix | Example |
|----------|--------|---------|
| Color | `--color-` | `--color-primary`, `--color-neutral-800` |
| Spacing | `--spacing-` | `--spacing-4`, `--spacing-12` |
| Font size | `--text-` | `--text-base`, `--text-2xl` |
| Font family | `--font-` | `--font-primary`, `--font-mono` |
| Font weight | `--font-` | `--font-bold`, `--font-regular` |
| Shadow | `--shadow-` | `--shadow-sm`, `--shadow-lg` |
| Radius | `--radius-` | `--radius-md`, `--radius-full` |

Note: Font family and font weight share the `--font-` prefix. This is acceptable because the names are distinct (family: `primary`, `mono`, `secondary`; weight: `bold`, `medium`, `regular`).

#### Figma Variable Path Conversion

Figma Variables use `/` as a path separator (e.g., `color/link/default`). These are converted to CSS custom property names using this algorithm:

```
1. Prepend "--"
2. Lowercase the entire string
3. Replace "/" with "-"
4. Replace spaces with "-"
5. Remove characters that are invalid in CSS custom property names

"color/link/default"      → --color-link-default
"spacing/lg"              → --spacing-lg
"Color/Background/Primary" → --color-background-primary
```

#### The `--token-*` Convention

Some projects use a `--token-` prefix for all design tokens:

```
Prefixed: --token-color-primary, --token-spacing-md, --token-radius-lg
Default: --color-primary,       --spacing-4,        --radius-md
```

The double prefix (`--token-color-*`) provides clear namespacing when tokens coexist with other CSS custom properties (e.g., component-specific variables, CSS framework variables).

#### Conflict Resolution

When auto-detected tokens and Figma Variable tokens overlap (e.g., both produce a `--color-primary` token), the Figma Variable takes priority. This is enforced during the token lookup phase: Figma Variable bindings are checked first, then the auto-detected token lookup is consulted.

> For the lookup priority chain, see Section 9.

---

### 9. Token Lookup System

The token lookup system enables CSS variable substitution during code generation. It creates reverse maps from raw values to CSS variable references, so that `#1a73e8` in a fill can be replaced with `var(--color-primary)`.

#### TokenLookup Interface

```
TokenLookup
  ├── colors: Map<string, string>        // normalized color → var(--color-name)
  ├── spacing: Map<number, string>       // pixel value → var(--spacing-name)
  ├── fontFamilies: Map<string, string>  // normalized family → var(--font-name)
  ├── fontSizes: Map<number, string>     // pixel value → var(--text-name)
  ├── fontWeights: Map<number, string>   // weight number → var(--font-name)
  └── radii: Map<number, string>         // pixel value → var(--radius-name)
```

#### Building the Lookup

`buildTokenLookup(tokens)` creates the reverse map from promoted tokens:

```
For each promoted color:
  lookup.colors.set(normalizeColor(color.value), `var(${color.name})`)
  // e.g., "#1a73e8" → "var(--color-primary)"

For each promoted spacing:
  lookup.spacing.set(spacing.value, `var(${spacing.name})`)
  // e.g., 16 → "var(--spacing-4)"

For each promoted font family:
  lookup.fontFamilies.set(normalize(family.value), `var(${family.name})`)
  // e.g., "inter" → "var(--font-primary)"

For each promoted font size:
  lookup.fontSizes.set(size.value, `var(${size.name})`)
  // e.g., 18 → "var(--text-lg)"

For each promoted font weight:
  lookup.fontWeights.set(weight.value, `var(${weight.name})`)
  // e.g., 700 → "var(--font-bold)"

For each promoted radius:
  lookup.radii.set(radius.value, `var(${radius.name})`)
  // e.g., 8 → "var(--radius-md)"
```

#### Type-Specific Lookup Functions

Each token type has a dedicated lookup function that returns the `var()` reference if found, or the raw value as fallback:

| Function | Input | Output (if found) | Output (if not found) |
|----------|-------|-------------------|----------------------|
| `lookupColor(lookup, "#1a73e8")` | hex/rgba string | `var(--color-primary)` | `#1a73e8` |
| `lookupSpacing(lookup, 16)` | pixel number | `var(--spacing-4)` | `16px` |
| `lookupFontFamily(lookup, "Inter")` | family name | `var(--font-primary)` | `'Inter', sans-serif` |
| `lookupFontSize(lookup, 18)` | pixel number | `var(--text-lg)` | `18px` |
| `lookupFontWeight(lookup, 700)` | weight number | `var(--font-bold)` | `700` |
| `lookupRadius(lookup, 8)` | pixel number | `var(--radius-md)` | `8px` |

#### Figma Variable Priority

When a fill has a Figma Variable binding, the variable name is used directly instead of consulting the auto-detected token lookup. This is the `lookupFillColor` function's priority chain:

```
lookupFillColor(fill, lookup):
  1. If fill.variable exists and has a name:
     a. If variable is LOCAL  → var(--css-name)           (no fallback)
     b. If variable is REMOTE → var(--css-name, rawColor)  (with fallback)
  2. If no variable binding:
     → lookupColor(lookup, fill.color)  (auto-detected token)
  3. If no token match:
     → raw color value (e.g., "#1a73e8")
```

This ensures that explicit designer intent (Figma Variables) always takes precedence over heuristic-based token detection.

#### Integration with Generation Pipeline

The token lookup is built once before generation starts and passed into the generation functions. During CSS property generation, visual and typography modules check each raw value against the lookup:

```
Generation sequence:
  1. collectAllTokens(node)     → DesignTokens
  2. promoteTokens(tokens, 2)   → DesignTokens (filtered)
  3. buildTokenLookup(promoted) → TokenLookup
  4. generateElement(node, ..., { tokenLookup })
     ├── generateVisualStyles(fills, ..., lookup)
     │   → background-color: var(--color-primary)  ← from lookupColor
     ├── generateTypographyStyles(text, lookup)
     │   → font-family: var(--font-primary)  ← from lookupFontFamily
     │   → font-size: var(--text-lg)         ← from lookupFontSize
     └── generateLayoutStyles(layout, lookup)
         → gap: var(--spacing-4)             ← from lookupSpacing
```

---

### 10. CSS Rendering

Token rendering generates a CSS file with a `:root` block containing all promoted tokens as CSS Custom Properties.

#### `:root` Block Structure

Tokens are organized by category with comment headers:

```css
:root {
  /* Figma Variables */
  --color-link-default: #6366F1;
  --spacing-lg: 24px;

  /* Colors */
  --color-neutral-100: #f5f5f5;
  --color-neutral-800: #333333;
  --color-primary: #1a73e8;
  --color-success: #34a853;

  /* Spacing */
  --spacing-2: 8px;
  --spacing-4: 16px;
  --spacing-6: 24px;

  /* Font Families */
  --font-mono: 'Roboto Mono', monospace;
  --font-primary: 'Inter', sans-serif;

  /* Font Sizes */
  --text-sm: 14px;
  --text-base: 16px;
  --text-lg: 18px;

  /* Font Weights */
  --font-regular: 400;
  --font-bold: 700;

  /* Shadows */
  --shadow-md: 0px 4px 8px 0px rgba(0, 0, 0, 0.25);

  /* Border Radii */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
}
```

#### Category Ordering

Within the `:root` block, categories are rendered in this order:

1. Figma Variables (without collection) -- simple variable bindings
2. Figma Variables (with collections) -- grouped by collection name, default mode values
3. Colors -- sorted alphabetically by name
4. Spacing -- sorted by value ascending
5. Font Families -- sorted alphabetically by name, with fallback stacks
6. Font Sizes -- sorted by value ascending
7. Font Weights -- sorted by value ascending
8. Shadows -- sorted alphabetically by name
9. Border Radii -- sorted by value ascending

#### Font Family Fallback Stacks

Font family tokens include appropriate fallback stacks:

```css
--font-primary: 'Inter', sans-serif;
--font-mono: 'Roboto Mono', monospace;
```

Monospace detection uses the same patterns as the font family naming (see Section 5).

#### Value Formatting

| Type | Format | Example |
|------|--------|---------|
| Color (hex) | Lowercase hex | `#1a73e8` |
| Color (rgba) | `rgba(R, G, B, A)` | `rgba(0, 0, 0, 0.25)` |
| Spacing | `{value}px` (rounded to 2 decimals) | `16px`, `8.5px` |
| Font size | `{value}px` | `18px` |
| Font weight | Raw number (no unit) | `700` |
| Shadow | Full CSS box-shadow value | `0px 4px 8px 0px rgba(0, 0, 0, 0.25)` |
| Radius | `{value}px` (rounded to 2 decimals) | `8px`, `12px` |

#### Mode-Aware Rendering: Breakpoint Media Queries

When variable collections have breakpoint mode types, non-default modes are rendered as `@media (min-width)` overrides:

```css
:root {
  /* Spacing (mobile = default) */
  --spacing-lg: 16px;
}

@media (min-width: 768px) {
  :root {
    --spacing-lg: 24px;
  }
}

@media (min-width: 1024px) {
  :root {
    --spacing-lg: 32px;
  }
}
```

Breakpoint modes are sorted from smallest to largest (mobile-first). The default mode (smallest breakpoint, typically "mobile") provides base `:root` values, and larger breakpoints override specific values.

#### Mode-Aware Rendering: Theme Selectors

When variable collections have theme mode types, non-default modes generate both a `prefers-color-scheme` media query and a `[data-theme]` attribute selector:

```css
:root {
  /* Theme - Light (default) */
  --color-bg: #ffffff;
  --color-text: #1a1a1a;
}

@media (prefers-color-scheme: dark) {
  :root {
    --color-bg: #1a1a1a;
    --color-text: #ffffff;
  }
}

[data-theme="dark"] {
  --color-bg: #1a1a1a;
  --color-text: #ffffff;
}
```

The dual output allows both automatic theme detection (via OS preference) and manual theme switching (via JavaScript setting `data-theme` on the root element).

> For Figma Variables mode detection and breakpoint/theme classification, see `figma-api-variables.md`.

---

### 11. SCSS Rendering

For SCSS consumers, tokens are rendered as `$variable` declarations instead of CSS custom properties.

#### Conversion Rule

The conversion is straightforward:

```
CSS:  --color-primary: #1a73e8;
SCSS: $color-primary: #1a73e8;

CSS:  var(--color-primary)
SCSS: $color-primary
```

The `--` prefix becomes `$`, and `var()` wrappers are removed.

#### SCSS File Structure

```scss
// _variables.scss

// Colors
$color-primary: #1a73e8;
$color-neutral-100: #f5f5f5;
$color-neutral-800: #333333;

// Spacing
$spacing-2: 8px;
$spacing-4: 16px;
$spacing-6: 24px;

// Font Families
$font-primary: 'Inter', sans-serif;
$font-mono: 'Roboto Mono', monospace;

// Font Sizes
$text-sm: 14px;
$text-base: 16px;
$text-lg: 18px;

// Font Weights
$font-regular: 400;
$font-bold: 700;

// Shadows
$shadow-md: 0px 4px 8px 0px rgba(0, 0, 0, 0.25);

// Border Radii
$radius-sm: 4px;
$radius-md: 8px;
$radius-lg: 12px;
```

#### SCSS Component Styles

In component SCSS files, `var(--name)` references are converted to `$name` references:

```scss
// styles.scss
@import 'variables';
@import 'reset';
@import 'mixins';

.card {
  background-color: $color-neutral-100;
  border-radius: $radius-lg;
  box-shadow: $shadow-md;
}

.card__title {
  color: $color-neutral-800;
  font-size: $text-2xl;
  font-weight: $font-bold;
}
```

#### Limitations of SCSS Rendering

SCSS variables are compile-time constants, not runtime-dynamic like CSS Custom Properties. This means:

- **No theme switching at runtime** -- SCSS variables are baked in at build time
- **No breakpoint mode overrides** -- SCSS cannot change variable values in media queries
- **No `var()` fallbacks** -- SCSS variable references fail at compile time if undefined

SCSS rendering is provided for projects that already use SCSS tooling. For projects that need runtime theming, responsive tokens, or Figma Variable modes, CSS Custom Properties are the recommended output.

> For the complete SCSS export file structure, see `css-strategy.md` Section 9.

---

### 12. Tailwind Config Generation

Design tokens can be mapped to a Tailwind theme configuration, enabling Tailwind utility classes to reference the same token values used in CSS Modules.

#### Token Category to Tailwind Theme Mapping

| Token Category | Tailwind Theme Key | Tailwind Class Example |
|---------------|-------------------|----------------------|
| Colors | `theme.colors` | `bg-primary`, `text-neutral-800` |
| Spacing | `theme.spacing` | `gap-4`, `p-6` |
| Font sizes | `theme.fontSize` | `text-lg`, `text-2xl` |
| Font families | `theme.fontFamily` | `font-primary`, `font-mono` |
| Border radii | `theme.borderRadius` | `rounded-md`, `rounded-lg` |
| Shadows | `theme.boxShadow` | `shadow-md`, `shadow-lg` |

#### CSS Variable References in Tailwind Config

The Tailwind config references CSS Custom Properties, not raw values. This creates a bridge between Layer 1 (Tailwind classes) and Layer 2 (CSS Custom Properties):

```js
// tailwind.config.js (generated from tokens)
export default {
  theme: {
    extend: {
      colors: {
        primary: 'var(--color-primary)',
        secondary: 'var(--color-secondary)',
        success: 'var(--color-success)',
        warning: 'var(--color-warning)',
        error: 'var(--color-error)',
        neutral: {
          100: 'var(--color-neutral-100)',
          300: 'var(--color-neutral-300)',
          500: 'var(--color-neutral-500)',
          800: 'var(--color-neutral-800)',
          900: 'var(--color-neutral-900)',
        },
      },
      spacing: {
        1: 'var(--spacing-1)',   // 4px
        2: 'var(--spacing-2)',   // 8px
        3: 'var(--spacing-3)',   // 12px
        4: 'var(--spacing-4)',   // 16px
        6: 'var(--spacing-6)',   // 24px
        8: 'var(--spacing-8)',   // 32px
      },
      fontSize: {
        xs: 'var(--text-xs)',
        sm: 'var(--text-sm)',
        base: 'var(--text-base)',
        lg: 'var(--text-lg)',
        xl: 'var(--text-xl)',
        '2xl': 'var(--text-2xl)',
        '3xl': 'var(--text-3xl)',
      },
      fontFamily: {
        primary: 'var(--font-primary)',
        mono: 'var(--font-mono)',
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        full: 'var(--radius-full)',
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

#### Benefits of CSS Variable References

Using `var()` references instead of raw values means:

1. **Theme switching works** -- Changing `:root` token values changes all Tailwind utility outputs
2. **Responsive tokens work** -- Breakpoint mode overrides in `:root` propagate through Tailwind
3. **Single source of truth** -- Tokens are defined once in `tokens.css`, consumed by both Tailwind classes and CSS Module rules

#### Tailwind v4 Automatic Detection

Tailwind v4 can automatically detect CSS custom properties and make them available as utility classes without explicit theme configuration. When a `tokens.css` file defines `--color-primary`, Tailwind v4 can generate a `bg-[--color-primary]` utility automatically.

However, explicit theme configuration is still recommended for cleaner class names (`bg-primary` vs `bg-[--color-primary]`) and for IDE autocompletion support.

#### Color Token Flattening

The neutral color scale uses nested objects in the Tailwind config:

```js
// Nested:
neutral: {
  100: 'var(--color-neutral-100)',
  800: 'var(--color-neutral-800)',
}
// Produces: bg-neutral-100, text-neutral-800

// Flat (alternative):
'neutral-100': 'var(--color-neutral-100)',
'neutral-800': 'var(--color-neutral-800)',
// Produces: bg-neutral-100, text-neutral-800 (same output)
```

Both approaches produce the same Tailwind classes. The nested approach is preferred for readability.

---

## Cross-References

- **`css-strategy.md`** -- How tokens integrate with the three-layer CSS architecture. Token placement at Layer 2, consumption patterns in Layer 3, Tailwind theme bridge to Layer 1.
- **`design-tokens-variables.md`** -- Figma Variables deep dive: mode detection and classification, variable resolution chains, bound variable extraction, mode-aware CSS rendering (breakpoint media queries, theme selectors), fallback strategies, scope-to-CSS-property mapping.
- **`figma-api-variables.md`** -- Variables API endpoints, data model, resolution mechanics. Provides the raw data for Figma Variable token extraction. Token extraction priority order.
- **`design-to-code-layout.md`** -- Layout property extraction that produces spacing values collected by the spacing token extractor. Variable bindings on gap and padding properties.
- **`design-to-code-visual.md`** -- Visual property extraction that produces colors, radii, and shadows collected by the color and effect token extractors. HSL-based semantic color naming. Token lookup integration during CSS generation.
- **`design-to-code-typography.md`** -- Typography extraction that produces font families, sizes, and weights collected by the typography token extractor. Type scale naming. Token lookup during font property generation.
- **`design-to-code-assets.md`** -- Asset management is independent of tokens (assets are files, not CSS values). Asset nodes skip visual style generation and therefore do not contribute to token collection.
- **`design-to-code-semantic.md`** -- Semantic HTML generation that creates the element structure consuming token-substituted CSS. BEM class names used as selectors in token-consuming CSS Module rules.
- **`payload-figma-mapping.md`** -- Figma-to-PayloadCMS mapping pipeline that includes a design token bridge step (Section 5). Extracted Figma tokens are mapped to `--token-*` CSS custom properties consumed by block CSS Modules, completing the Figma-to-CMS token chain.
