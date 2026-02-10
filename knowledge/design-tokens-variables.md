# Figma Variables → Design Token → CSS Bridge

## Purpose

Authoritative reference for the bridge between Figma Variables and CSS Custom Properties in a design token system. Documents how to extract variable collections, detect and classify their modes (breakpoint vs theme), resolve variable values through alias chains, generate mode-aware CSS output with media queries and theme selectors, and handle fallback values for external library variables. Encodes production patterns for variable collection processing, mode classification, CSS rendering, and token lookup.

This module fills the gap between `figma-api-variables.md` (API-level reference for Variables endpoints and data model) and `design-tokens.md` (general token extraction pipeline). It focuses specifically on the Variables-to-Token-to-CSS transformation that neither of those modules covers in depth.

## When to Use

Reference this module when you need to:

- Understand how Figma Variable collections map to token categories for CSS output
- Detect whether a collection's modes represent breakpoints (responsive) or themes (light/dark)
- Determine which mode is the "default" (base) mode for mobile-first or light-default rendering
- Resolve variable alias chains to terminal values for each mode
- Extract bound variable references from node properties (fills, strokes, layout, text)
- Convert Figma variable paths to CSS custom property names
- Generate mode-aware CSS: `:root` for base, `@media (min-width)` for breakpoints, `prefers-color-scheme` and `[data-theme]` for themes
- Decide when to include fallback values in `var()` references (local vs external variables)
- Map variable scopes to applicable CSS properties
- Design multi-mode token systems (responsive + theme cross-products)
- Understand how variable tokens integrate with and take priority over auto-detected tokens

---

## Content

### 1. Purpose & When to Use

Figma Variables are the highest-priority source for design tokens. They provide structured, designer-curated token definitions with explicit names, types, scopes, and per-mode values -- far superior to heuristic-based token extraction from file traversal.

#### When This Module Applies

- **The Figma file uses Variables** for colors, spacing, typography, or other design values
- **The file has multi-mode collections** (responsive breakpoints, light/dark themes, brand variants)
- **You need CSS Custom Properties** that adapt to viewport size or theme preference
- **You need to resolve variable bindings** from node properties to CSS `var()` references
- **You are building a token pipeline** that bridges Figma Variables to a CSS/SCSS/Tailwind output

#### When to Use Other Modules Instead

| Scenario | Module |
|----------|--------|
| Variables API endpoints, authentication, data model | `figma-api-variables.md` |
| General token extraction (collect, promote, name, render) | `design-tokens.md` |
| Where tokens go in the CSS output (Layer 1/2/3) | `css-strategy.md` |
| Visual property extraction (fills, strokes, effects) | `design-to-code-visual.md` |
| Layout property extraction (gap, padding) | `design-to-code-layout.md` |
| Typography property extraction (fonts, sizes, weights) | `design-to-code-typography.md` |

---

### 2. Variables as Token Source

Variables are the preferred token source because they provide structured, explicit token definitions -- names, types, modes, scopes, and alias relationships -- rather than requiring heuristic detection from raw property values.

#### Token Source Priority

The token extraction pipeline uses this priority order (documented in `figma-api-variables.md`):

```
1. Figma Variables API     → Best: structured, multi-mode, scoped
2. Published styles        → Good: limited to published content
3. File tree traversal     → Fallback: heuristic-based, all plans
4. Plugin API (in-context) → Fallback: for non-Enterprise REST access
```

Variables provide everything the token system needs without heuristics:

| Feature | Variables API | File Traversal |
|---------|:---:|:---:|
| Explicit token names | Yes (`color/primary/500`) | No (inferred from HSL) |
| Multi-mode values | Yes (per breakpoint/theme) | No (single value per node) |
| Type safety | Yes (`COLOR`, `FLOAT`, `STRING`) | Inferred from context |
| Scope constraints | Yes (`ALL_FILLS`, `GAP`, etc.) | No |
| Alias chains | Yes (variable referencing variable) | No |
| Designer intent | Explicit | Inferred |

#### When Variables API Is Not Available

The Variables REST API requires Enterprise plan + full member access. When this is not available:

1. **Plugin API** -- Access local variables via `figma.variables.getLocalVariableCollectionsAsync()` and `figma.variables.getVariableByIdAsync()`. This is the recommended approach for Figma plugins (running inside the Figma sandbox, not as a REST client).

2. **Bound variable extraction** -- Even without the Variables API, nodes in the file tree expose `boundVariables` that reference variable IDs. The file tree response includes these bindings.

3. **File traversal + promotion** -- Fall back to the threshold-based promotion system documented in `design-tokens.md`. Traverse the node tree, collect raw values, and promote repeated values to tokens.

#### How Variables and Auto-Detected Tokens Coexist

Variables and auto-detected tokens are collected in parallel and merged. Variables always win conflicts:

```
collectAllTokens(node) →
  ├── collectColors(node)          → ColorToken[]        (auto-detected)
  ├── collectSpacing(node)         → SpacingToken[]      (auto-detected)
  ├── collectTypography(node)      → TypographyTokens    (auto-detected)
  ├── collectEffects(node)         → EffectTokens        (auto-detected)
  └── collectFigmaVariables(node)  → FigmaVariableToken[] (explicit bindings)
```

During the lookup phase, the priority chain is:

1. **Bound variable** on the property -- use `var(--css-name)` directly
2. **Auto-detected token** from the lookup map -- use `var(--token-name)`
3. **Raw value** -- use the literal CSS value

> See `design-tokens.md` Section 9 for the complete token lookup system.

---

### 3. Collection Structure for Tokens

Figma variable collections group related variables that share the same set of modes. Collections map naturally to token categories.

#### Collection → Token Category Mapping

Designers typically organize collections by token category:

| Collection Name | Token Category | Variable `resolvedType` | CSS Output |
|----------------|---------------|:-----------------------:|------------|
| `Colors` / `Theme` | Color tokens | `COLOR` | `--color-primary: #1a73e8` |
| `Spacing` | Spacing tokens | `FLOAT` | `--spacing-md: 16px` |
| `Typography` | Font tokens | `FLOAT` / `STRING` | `--text-lg: 18px`, `--font-primary: 'Inter'` |
| `Radii` | Border radius tokens | `FLOAT` | `--radius-md: 8px` |
| `Effects` | Shadow/elevation tokens | `FLOAT` | `--shadow-blur: 8px` |

#### Collection Naming Conventions

The pipeline does not enforce collection naming conventions -- it processes all local collections regardless of name. The collection name is used for:

1. **CSS comment headers** in the rendered output (e.g., `/* Colors */`)
2. **Mode type detection** -- mode names within the collection determine breakpoint vs theme rendering
3. **Grouping** -- variables from the same collection are rendered together in the CSS output

#### Multi-Collection Files

A single Figma file can have multiple collections, each with its own modes:

```
File: "Design System"
  Collection: "Theme"
    Modes: [Light, Dark]
    Variables: color/primary, color/bg, color/text, ...

  Collection: "Spacing"
    Modes: [Mobile, Tablet, Desktop]
    Variables: spacing/sm, spacing/md, spacing/lg, ...

  Collection: "Typography"
    Modes: [Mobile, Desktop]
    Variables: text/body, text/heading, ...
```

Each collection is rendered independently with its own mode-aware CSS blocks. Collections with a single mode render only in the base `:root` block.

#### Collection Processing

The recommended collection processing approach:

```typescript
const collections = await figma.variables.getLocalVariableCollectionsAsync()
return collections.map(collection => {
  const modes = collection.modes.map(m => ({ id: m.modeId, name: m.name }))
  const modeType = detectModeType(modes.map(m => m.name))
  return {
    id: collection.id,
    name: collection.name,
    modeType,              // 'breakpoint' | 'theme' | 'unknown'
    modes,
    defaultModeId: getDefaultModeId(modes, modeType),
  }
})
```

Key points:
- Only **local** collections are processed (external library collections are skipped)
- Each collection gets a `modeType` classification (see Section 4)
- Each collection gets a `defaultModeId` identifying which mode provides base values

---

### 4. Mode Detection & Classification

Variable collections can have multiple modes. The token system must classify each collection's modes to determine how they map to CSS constructs (media queries vs theme selectors).

#### Mode Type Classification

The pipeline classifies collections into three types:

| Mode Type | Detection | CSS Rendering |
|-----------|-----------|---------------|
| `breakpoint` | Mode names contain "mobile", "tablet", "desktop", or pixel values | `@media (min-width)` queries |
| `theme` | Mode names contain "light", "dark", or "theme" | `prefers-color-scheme` + `[data-theme]` selectors |
| `unknown` | Neither pattern detected | Single mode in `:root` only |

#### Detection Algorithm

```typescript
function detectModeType(modeNames: string[]): 'breakpoint' | 'theme' | 'unknown' {
  const normalized = modeNames.map(n => n.toLowerCase().trim())

  // Check theme patterns FIRST
  const hasThemePatterns = normalized.some(name =>
    name.includes('light') ||
    name.includes('dark') ||
    name.includes('theme')
  )
  if (hasThemePatterns) return 'theme'

  // Check breakpoint patterns
  const hasBreakpointPatterns = normalized.some(name =>
    name.includes('desktop') ||
    name.includes('mobile') ||
    name.includes('tablet') ||
    /^\d+px?$/.test(name)    // "800px" or "800"
  )
  if (hasBreakpointPatterns) return 'breakpoint'

  return 'unknown'
}
```

**Important ordering:** Theme detection runs before breakpoint detection. If a collection has modes named "Light Desktop" and "Dark Desktop", the "light"/"dark" patterns match first, classifying it as a theme collection.

#### Breakpoint Mode Detection Patterns

| Mode Name | Detected As | Breakpoint Value |
|-----------|:-----------:|:----------------:|
| `Mobile` | breakpoint | 0 (base) |
| `Tablet` | breakpoint | 768px |
| `Desktop` | breakpoint | 1024px |
| `800` | breakpoint | 800px |
| `800px` | breakpoint | 800px |
| `1440px` | breakpoint | 1440px |

Pixel-value mode names (e.g., `"800px"` or `"800"`) are parsed directly:

```typescript
function parseBreakpointValue(modeName: string): number | null {
  const normalized = modeName.toLowerCase().trim()

  // Standard names
  const BREAKPOINT_MAP = { 'mobile': 0, 'tablet': 768, 'desktop': 1024 }
  if (BREAKPOINT_MAP[normalized] !== undefined) {
    return BREAKPOINT_MAP[normalized]
  }

  // Pixel values: "800px" or "800"
  const pxMatch = normalized.match(/^(\d+)px?$/)
  if (pxMatch) return parseInt(pxMatch[1], 10)

  return null
}
```

#### Theme Mode Detection Patterns

| Mode Name | Detected As | Default? |
|-----------|:-----------:|:--------:|
| `Light` | theme | Yes (default) |
| `Dark` | theme | No |
| `Light Theme` | theme | Yes |
| `Dark Mode` | theme | No |

#### Default Mode Identification

The "default" mode is the one that renders in the base `:root` block (no media query, no theme selector). Non-default modes render in conditional blocks.

```typescript
function getDefaultModeId(modes, modeType): string {
  if (modeType === 'breakpoint') {
    // Mobile-first: smallest breakpoint value is default
    let minValue = Infinity
    for (const mode of modes) {
      const value = parseBreakpointValue(mode.name)
      if (value !== null && value < minValue) {
        minValue = value
        defaultId = mode.id
      }
    }
    return defaultId
  }

  if (modeType === 'theme') {
    // "Light" is default
    const lightMode = modes.find(m => m.name.toLowerCase().includes('light'))
    if (lightMode) return lightMode.id
  }

  // Unknown: first mode is default
  return modes[0].id
}
```

| Mode Type | Default Rule | Rationale |
|-----------|-------------|-----------|
| Breakpoint | Smallest value (mobile = 0) | Mobile-first CSS: base styles have no media query |
| Theme | Mode containing "light" | Light theme is the conventional default |
| Unknown | First mode in array | Figma's default mode is typically first |

#### Breakpoint Sort Order (Mobile-First)

Breakpoint modes are sorted ascending by pixel value for CSS output. The default mode (mobile, value 0) comes first with no media query. Larger breakpoints follow with `min-width` queries:

```typescript
function sortBreakpointModes(modes, defaultModeId) {
  return modes
    .map(mode => ({
      ...mode,
      breakpoint: mode.id === defaultModeId ? null : parseBreakpointValue(mode.name)
    }))
    .sort((a, b) => {
      if (a.breakpoint === null) return -1  // Default first
      if (b.breakpoint === null) return 1
      return (a.breakpoint || 0) - (b.breakpoint || 0)  // Ascending
    })
}
```

Result: `[mobile (null), tablet (768), desktop (1024)]`

---

### 5. Variable Resolution Chain

The complete resolution from a Figma variable binding to a CSS custom property value follows this chain:

```
Node property has bound variable
    ↓
Look up Variable by ID
    ↓
Check valuesByMode for requested mode
    ↓
Is value a VARIABLE_ALIAS?
  ├─ YES → Resolve referenced variable (recursively)
  └─ NO  → Terminal value (COLOR, FLOAT, STRING, BOOLEAN)
    ↓
Format terminal value as CSS string
    ↓
Generate CSS custom property: --name: value
```

#### Alias Resolution

Variables can reference other variables (aliases). An alias is detected by the `VARIABLE_ALIAS` type:

```typescript
if (typeof modeValue === 'object' && modeValue !== null &&
    'type' in modeValue && modeValue.type === 'VARIABLE_ALIAS') {
  // Resolve the aliased variable
  const aliasedVar = await figma.variables.getVariableByIdAsync(modeValue.id)
  if (aliasedVar) {
    resolvedValue = aliasedVar.valuesByMode[modeId]
      ?? aliasedVar.valuesByMode[collection.defaultModeId]
  }
}
```

Key behaviors:
- Aliases can chain: Variable A references Variable B which references Variable C
- Cross-collection aliases are valid: a color variable in "Theme" can reference a variable in "Primitives"
- When a referenced variable has no value for the requested mode, the collection's default mode value is used
- Figma prevents alias cycles (no self-referencing)

> For the full alias resolution algorithm and API details, see `figma-api-variables.md` Section "Variable Resolution".

#### Terminal Value Types

After resolving all aliases, the terminal value is one of four types:

| `resolvedType` | TypeScript Type | CSS Formatting |
|----------------|----------------|----------------|
| `COLOR` | `{ r, g, b, a }` (0-1 floats) | `#RRGGBB` or `rgba(R, G, B, A)` |
| `FLOAT` | `number` | `{value}px` |
| `STRING` | `string` | `'{value}'` (quoted for fonts) |
| `BOOLEAN` | `boolean` | `1` or `0` |

#### Value Formatting

From `variables.ts`:

```typescript
function formatVariableValue(value, type): string {
  if (type === 'COLOR' && typeof value === 'object' && 'r' in value) {
    const r = Math.round(value.r * 255)
    const g = Math.round(value.g * 255)
    const b = Math.round(value.b * 255)
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`.toUpperCase()
  }
  if (type === 'FLOAT' && typeof value === 'number') {
    return `${value}px`
  }
  return String(value)
}
```

> **Note:** Color values use the 0-1 float range from Figma. Always multiply by 255 and round before hex conversion. See `design-to-code-visual.md` Section 1 for the RGB conversion formula.

#### Mode Value Extraction

For multi-mode collections, each variable's value is extracted per mode:

```typescript
async function extractModeValues(variableId, collections) {
  const variable = await figma.variables.getVariableByIdAsync(variableId)
  const collection = collections.find(c => c.id === variable.variableCollectionId)

  // Single-mode collections: no per-mode extraction needed
  if (!collection || collection.modes.length <= 1) {
    return { collectionId: collection?.id }
  }

  // Multi-mode: extract value for each mode
  const modeValues = []
  for (const mode of collection.modes) {
    const modeValue = variable.valuesByMode[mode.id]
    // Resolve aliases...
    const stringValue = formatVariableValue(resolvedValue, variable.resolvedType)
    modeValues.push({
      modeId: mode.id,
      modeName: mode.name,
      value: stringValue,
    })
  }

  return { collectionId: collection.id, modeValues }
}
```

The result is an array of `{ modeId, modeName, value }` objects -- one per mode -- that the renderer uses to generate mode-aware CSS.

---

### 6. Bound Variable Extraction

Bound variables are the connection between a Figma node's properties and the variable system. When a designer binds a variable to a property (e.g., binding `color/primary` to a frame's fill), the node's `boundVariables` field records this binding.

#### Extraction Sources

The extraction pipeline captures variable bindings from three property categories:

| Category | Properties | Intermediate Type Field |
|----------|-----------|------------------------|
| **Fill colors** | `paint.boundVariables.color` | `fill.variable` |
| **Layout spacing** | `node.boundVariables.itemSpacing`, `paddingTop`, etc. | `layout.gapVariable`, `layout.paddingVariables` |
| **Text fills** | `segment.fills[].variable` | `styledSegment.fills[].variable` |

#### Fill Variable Extraction

Fill variables are extracted at the paint level (each fill can have its own variable binding):

```typescript
function collectVariableReferences(fill: FillData): void {
  if (fill.type !== 'SOLID' || !fill.variable) return
  const { id, name, isLocal } = fill.variable
  // Deduplicate by variable ID
  variableIdsToProcess.push({ id, name, value: fill.color, isLocal })
}
```

The `fill.variable` field is populated during the extraction phase when `paint.boundVariables.color` is present on a solid fill.

#### Layout Variable Extraction

Layout variables (gap, padding) are extracted from the layout intermediate type:

```typescript
// Gap variable
if (node.layout.gapVariable) {
  addLayoutVariable(node.layout.gapVariable, node.layout.gap)
}

// Counter axis gap variable
if (node.layout.counterAxisGapVariable && node.layout.counterAxisGap !== undefined) {
  addLayoutVariable(node.layout.counterAxisGapVariable, node.layout.counterAxisGap)
}

// Padding variables (per-side)
if (node.layout.paddingVariables) {
  const pv = node.layout.paddingVariables
  if (pv.top) addLayoutVariable(pv.top, node.layout.padding.top)
  if (pv.right) addLayoutVariable(pv.right, node.layout.padding.right)
  if (pv.bottom) addLayoutVariable(pv.bottom, node.layout.padding.bottom)
  if (pv.left) addLayoutVariable(pv.left, node.layout.padding.left)
}
```

> For how layout variable bindings are extracted from Figma nodes, see `design-to-code-layout.md` Section 3.

#### Text Fill Variable Extraction

Styled text segments can have variable bindings on their fill colors:

```typescript
if (node.text?.styledSegments) {
  for (const segment of node.text.styledSegments) {
    if (segment.fills) {
      for (const fill of segment.fills) {
        if (fill.variable) {
          variableIdsToProcess.push({
            id: fill.variable.id,
            name: fill.variable.name,
            value: fill.color,
            isLocal: fill.variable.isLocal ?? false,
          })
        }
      }
    }
  }
}
```

> For text fill variable binding patterns, see `design-to-code-typography.md` Section 9.

#### Variable Binding Priority

When generating CSS for a property, the system checks for variable bindings before falling back to auto-detected tokens:

```
For a fill color:
  1. fill.variable exists?
     ├─ YES, isLocal  → var(--color-name)            (no fallback)
     ├─ YES, external → var(--color-name, #rawColor)  (with fallback)
     └─ NO → check auto-detected token lookup
  2. tokenLookup.colors has this value?
     ├─ YES → var(--color-primary)                    (from token system)
     └─ NO  → #rawColor                              (inline value)
```

This priority chain ensures explicit designer intent (variable bindings) always takes precedence over heuristic token detection.

> For the complete lookup chain implementation, see `design-tokens.md` Section 9.

#### Deduplication

Variables are deduplicated by ID before processing:

```typescript
const variableMap = new Map<string, FigmaVariableToken>()
// ... collect all references ...
for (const varRef of variableIdsToProcess) {
  const cssName = figmaVariableToCssName(varRef.name)
  const { collectionId, modeValues } = await extractModeValues(varRef.id, collections)

  variableMap.set(varRef.id, {
    name: cssName,
    figmaName: varRef.name,
    value: varRef.value,
    isLocal: varRef.isLocal,
    usageCount: 1,
    collectionId,
    modeValues,
  })
}
```

If the same variable is bound to multiple nodes (e.g., `color/primary` used on 10 different fills), it is collected once and produces one CSS custom property definition.

---

### 7. CSS Custom Property Generation from Variables

Variable names from Figma use `/` as a path separator (e.g., `color/link/default`). These must be converted to valid CSS custom property names using `-` separators.

#### Name Conversion Algorithm

From `lookup.ts`:

```typescript
function figmaVariableToCssName(variableName: string): string {
  return '--' + variableName
    .toLowerCase()                // Lowercase everything
    .replace(/\//g, '-')          // Slashes to dashes
    .replace(/\s+/g, '-')         // Spaces to dashes
    .replace(/[^a-z0-9-_]/g, '') // Remove invalid characters
}
```

#### Conversion Examples

| Figma Variable Name | CSS Custom Property |
|---------------------|---------------------|
| `color/primary` | `--color-primary` |
| `color/link/default` | `--color-link-default` |
| `spacing/md` | `--spacing-md` |
| `Color/Background/Primary` | `--color-background-primary` |
| `radius/md` | `--radius-md` |
| `Typography/Heading/Size` | `--typography-heading-size` |
| `brand color/accent` | `--brand-color-accent` |

#### Collection Prefix Handling

The pipeline does **not** prepend the collection name to the variable's CSS name. The variable's own path is used directly:

```
Collection: "Spacing"
Variable: "spacing/md"
CSS name: --spacing-md    (NOT --spacing-spacing-md)
```

This works because Figma designers typically include the category in the variable name path. If a collection named "Colors" contains a variable named "primary", the CSS name would be `--primary` (not `--colors-primary`). Designers should use paths like `color/primary` to get `--color-primary`.

#### `var()` Reference Generation

The CSS `var()` reference wraps the custom property name:

```typescript
function figmaVariableToCss(variableName: string): string {
  return `var(${figmaVariableToCssName(variableName)})`
}
// "color/link/default" → "var(--color-link-default)"
```

#### Consistency with Auto-Detected Token Names

The variable path conversion uses the same algorithm as the design-tokens module's naming conventions. This means:

- `color/primary` (variable) → `--color-primary` (same as auto-detected `--color-primary`)
- `spacing/4` (variable) → `--spacing-4` (same as auto-detected `--spacing-4`)

When both a variable token and an auto-detected token produce the same name, the variable token takes priority. The auto-detected token is effectively shadowed.

> For the complete token naming conventions, see `design-tokens.md` Section 8.

---

### 8. Mode-Aware CSS Rendering

The CSS renderer generates different output structures based on the collection's mode type. All rendering follows a mobile-first, light-default approach.

#### Rendering Flow

From `render.ts`:

```
1. Open :root { ... } block
2. Render variables without collections (simple variables)
3. For each collection:
   a. Render default mode values inside :root
4. Close :root }
5. For each breakpoint collection:
   a. Render non-default modes as @media (min-width) blocks
6. For each theme collection:
   a. Render non-default modes as prefers-color-scheme + [data-theme] blocks
```

#### Base `:root` Block

All variables render their default mode values in the base `:root` block:

```css
:root {
  /* Theme */
  --color-bg: #ffffff;
  --color-text: #1a1a1a;
  --color-primary: #1a73e8;

  /* Spacing */
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
}
```

Variables without mode values (single-mode collections) also render here.

#### Breakpoint Mode Rendering

For collections classified as `breakpoint`, non-default modes generate `@media (min-width)` blocks. The default mode (mobile = 0) is already in `:root`.

```css
/* Base: mobile values (from :root above) */

@media (min-width: 768px) {
  :root {
    /* Spacing — tablet overrides */
    --spacing-sm: 12px;
    --spacing-md: 24px;
    --spacing-lg: 32px;
  }
}

@media (min-width: 1024px) {
  :root {
    /* Spacing — desktop overrides */
    --spacing-sm: 16px;
    --spacing-md: 32px;
    --spacing-lg: 48px;
  }
}
```

**Key behaviors:**
- The default mode (smallest breakpoint, typically "mobile") is already in `:root`
- Modes with breakpoint value 0 (mobile) are skipped in the media query loop
- Breakpoint modes are sorted ascending for correct mobile-first cascade
- Each media query re-opens `:root` to override the base values

#### Theme Mode Rendering

For collections classified as `theme`, non-default modes generate **two** selectors: a `prefers-color-scheme` media query and a `[data-theme]` attribute selector.

```css
/* Base: light values (from :root above) */

@media (prefers-color-scheme: dark) {
  :root {
    --color-bg: #1a1a1a;
    --color-text: #ffffff;
    --color-primary: #5c9aff;
  }
}

[data-theme="dark"] {
  --color-bg: #1a1a1a;
  --color-text: #ffffff;
  --color-primary: #5c9aff;
}
```

**Why dual selectors:**

1. **`prefers-color-scheme`** -- Automatic theme based on OS/browser preference. No JavaScript required.
2. **`[data-theme]`** -- Manual theme toggle via JavaScript (`document.documentElement.setAttribute('data-theme', 'dark')`). Overrides OS preference when set.

The `[data-theme]` selector has higher specificity than the media query, so manual selection takes precedence.

#### Dark Mode Detection

Only modes whose name contains "dark" get the `prefers-color-scheme: dark` media query. Other non-default theme modes (e.g., "Brand B") get only the `[data-theme]` attribute selector:

```typescript
if (themeName.includes('dark')) {
  // Generate @media (prefers-color-scheme: dark) { :root { ... } }
}
// Always generate [data-theme="..."] { ... }
```

#### Complete Rendered Output Example

A file with both a theme collection and a spacing collection:

```css
:root {
  /* Theme */
  --color-bg: #ffffff;
  --color-text: #1a1a1a;
  --color-primary: #1a73e8;

  /* Spacing */
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;

  /* Colors (auto-detected) */
  --color-neutral-100: #f5f5f5;
  --color-neutral-800: #333333;

  /* Font Families */
  --font-primary: 'Inter', sans-serif;
}

@media (min-width: 768px) {
  :root {
    --spacing-sm: 12px;
    --spacing-md: 24px;
    --spacing-lg: 32px;
  }
}

@media (min-width: 1024px) {
  :root {
    --spacing-sm: 16px;
    --spacing-md: 32px;
    --spacing-lg: 48px;
  }
}

@media (prefers-color-scheme: dark) {
  :root {
    --color-bg: #1a1a1a;
    --color-text: #ffffff;
    --color-primary: #5c9aff;
  }
}

[data-theme="dark"] {
  --color-bg: #1a1a1a;
  --color-text: #ffffff;
  --color-primary: #5c9aff;
}
```

Note how auto-detected tokens (colors, font families) and variable tokens coexist in the same `:root` block. Variable tokens are grouped by collection, auto-detected tokens are grouped by category.

> For the `:root` block structure and category ordering, see `design-tokens.md` Section 10.

---

### 9. Fallback Values

Fallback values in `var()` references protect against missing variable definitions. The fallback strategy depends on whether the variable is local or from an external library.

#### Local Variables: No Fallback

Local variables (defined in the same Figma file) are always included in the generated `tokens.css` output. Since the token definition and the `var()` reference ship together, fallbacks are unnecessary:

```css
/* Local variable — guaranteed to be defined in tokens.css */
background-color: var(--color-primary);
gap: var(--spacing-md);
border-radius: var(--radius-md);
```

#### External Library Variables: Always Include Fallback

External library variables (from a separate Figma file) may not have corresponding definitions in the current project's `tokens.css`. The library token definitions live in the library's file, not the consuming file. Include the resolved raw value as a fallback:

```css
/* External library variable — fallback protects against missing definition */
background-color: var(--color-link-default, #1a73e8);
color: var(--color-brand-primary, #6366F1);
gap: var(--spacing-external-md, 16px);
```

#### Fallback Extraction

The fallback value comes from the variable's resolved value at extraction time (the raw CSS value that the variable currently resolves to):

```typescript
function lookupFillColor(fill, lookup): ColorLookupResult {
  if (fill.variable && fill.variable.name) {
    const cssVarName = figmaVariableToCssName(fill.variable.name)

    if (fill.variable.isLocal) {
      return { value: `var(${cssVarName})` }
    }

    // External: include raw value as fallback
    return {
      value: `var(${cssVarName}, ${fill.color})`,
      comment: `/* fallback: "${fill.variable.name}" is from external library */`,
    }
  }
  return { value: lookupColor(lookup, fill.color) }
}
```

#### Token File Inclusion

During promotion, only **local** Figma Variables are included in the token output file. External variables are excluded because their definitions belong to the library:

```typescript
// From promote.ts
const figmaVariables = tokens.figmaVariables?.filter((v) => v.isLocal)
```

This means:
- Local variables appear in `tokens.css` as `:root { --name: value; }` definitions
- Local variables are referenced without fallbacks: `var(--name)`
- External variables do NOT appear in `tokens.css`
- External variables are referenced WITH fallbacks: `var(--name, rawValue)`

#### When to Use Fallbacks on Local Variables

While the default approach omits fallbacks for local variables, some projects may want fallbacks for resilience:

| Scenario | Recommendation |
|----------|---------------|
| Single project, tokens and components shipped together | No fallback needed |
| Component library consumed by multiple projects | Include fallback |
| Visual Builder / iframe isolation | Include fallback (token aliasing may break) |
| Development/preview mode | Include fallback (tokens may not be loaded) |

> For the Visual Builder token aliasing pattern that bridges this gap, see `css-strategy.md` Section 4.

---

### 10. Variable Scopes & Token Applicability

Figma variable scopes constrain which UI pickers display a variable in the Figma editor. While scopes do NOT prevent programmatic binding via API or plugin code, they signal the designer's intended usage for each variable.

#### Scope → CSS Property Mapping

| Variable Scope | Applies To | CSS Properties |
|---------------|-----------|----------------|
| `ALL_SCOPES` | Everything | Any property |
| `ALL_FILLS` | All fill types | `background-color`, `color`, `fill` |
| `FRAME_FILL` | Frame fills only | `background-color` |
| `SHAPE_FILL` | Shape fills only | `background-color`, `fill` |
| `TEXT_FILL` | Text fills only | `color` |
| `STROKE_COLOR` | Stroke colors | `border-color`, `outline-color` |
| `EFFECT_COLOR` | Effect colors | Color component of `box-shadow` |
| `CORNER_RADIUS` | Border radius | `border-radius` |
| `WIDTH_HEIGHT` | Dimensions | `width`, `height` |
| `GAP` | Spacing/gap | `gap`, `row-gap`, `column-gap`, `padding`, `margin` |
| `OPACITY` | Opacity | `opacity` |
| `STROKE_FLOAT` | Stroke width | `border-width`, `outline-width` |
| `EFFECT_FLOAT` | Effect values | `blur()` radius, shadow spread |
| `FONT_FAMILY` | Font family | `font-family` |
| `FONT_STYLE` | Font style | `font-style` |
| `FONT_WEIGHT` | Font weight | `font-weight` |
| `FONT_SIZE` | Font size | `font-size` |
| `LINE_HEIGHT` | Line height | `line-height` |
| `LETTER_SPACING` | Letter spacing | `letter-spacing` |

#### Scope-Based Token Filtering

Variable scopes can be used to filter which tokens apply to which CSS properties. A variable scoped to `TEXT_FILL` should not be used as a `background-color` token, even if the color value matches.

However, the current recommended approach does not filter by scope -- it uses all variables as general-purpose tokens. Scope-based filtering is a future enhancement that would improve token specificity.

#### Scope Validity by Type

Only certain scopes are valid for each `resolvedType`:

| resolvedType | Valid Scopes |
|-------------|-------------|
| `COLOR` | `ALL_SCOPES`, `ALL_FILLS`, `FRAME_FILL`, `SHAPE_FILL`, `TEXT_FILL`, `STROKE_COLOR`, `EFFECT_COLOR` |
| `FLOAT` | `ALL_SCOPES`, `CORNER_RADIUS`, `WIDTH_HEIGHT`, `GAP`, `OPACITY`, `STROKE_FLOAT`, `EFFECT_FLOAT`, `FONT_WEIGHT`, `FONT_SIZE`, `LINE_HEIGHT`, `LETTER_SPACING` |
| `STRING` | `ALL_SCOPES`, `TEXT_CONTENT`, `FONT_FAMILY`, `FONT_STYLE` |
| `BOOLEAN` | `ALL_SCOPES` |

> For the complete scope reference and API details, see `figma-api-variables.md` Section "VariableScope".

---

### 11. Multi-Mode Design Patterns

Multi-mode variables enable designs that adapt to different contexts without changing component structure. The token system supports several patterns.

#### Pattern 1: Responsive Spacing

The same spacing variable has different values per breakpoint. Components automatically adapt when the viewport changes because they reference `var(--spacing-md)`:

```
Collection: "Spacing"
Modes: [Mobile, Tablet, Desktop]

Variable: spacing/md
  Mobile:  16px
  Tablet:  24px
  Desktop: 32px

Variable: spacing/lg
  Mobile:  24px
  Tablet:  32px
  Desktop: 48px
```

**CSS Output:**

```css
:root {
  --spacing-md: 16px;
  --spacing-lg: 24px;
}

@media (min-width: 768px) {
  :root {
    --spacing-md: 24px;
    --spacing-lg: 32px;
  }
}

@media (min-width: 1024px) {
  :root {
    --spacing-md: 32px;
    --spacing-lg: 48px;
  }
}
```

**Component CSS (unchanged across breakpoints):**

```css
.card {
  padding: var(--spacing-md);
  gap: var(--spacing-lg);
}
```

#### Pattern 2: Light/Dark Theme Colors

Color variables switch between light and dark palettes. The component CSS stays identical:

```
Collection: "Theme"
Modes: [Light, Dark]

Variable: color/bg
  Light: #ffffff
  Dark:  #1a1a1a

Variable: color/text
  Light: #1a1a1a
  Dark:  #ffffff

Variable: color/primary
  Light: #1a73e8
  Dark:  #5c9aff
```

**CSS Output:**

```css
:root {
  --color-bg: #ffffff;
  --color-text: #1a1a1a;
  --color-primary: #1a73e8;
}

@media (prefers-color-scheme: dark) {
  :root {
    --color-bg: #1a1a1a;
    --color-text: #ffffff;
    --color-primary: #5c9aff;
  }
}

[data-theme="dark"] {
  --color-bg: #1a1a1a;
  --color-text: #ffffff;
  --color-primary: #5c9aff;
}
```

#### Pattern 3: Responsive Typography

Font sizes and line heights that scale with viewport:

```
Collection: "Typography"
Modes: [Mobile, Desktop]

Variable: text/body
  Mobile:  16px
  Desktop: 18px

Variable: text/heading
  Mobile:  28px
  Desktop: 40px
```

**CSS Output:**

```css
:root {
  --text-body: 16px;
  --text-heading: 28px;
}

@media (min-width: 1024px) {
  :root {
    --text-body: 18px;
    --text-heading: 40px;
  }
}
```

#### Pattern 4: Brand Theming

Multiple brand variants sharing a common token structure:

```
Collection: "Brand"
Modes: [Brand A, Brand B, Brand C]

Variable: color/primary
  Brand A: #0066ff
  Brand B: #ff3366
  Brand C: #00cc88
```

Brand modes do not match theme or breakpoint patterns, so they are classified as `unknown`. The pipeline renders only the default mode (Brand A) in `:root`. For multi-brand support, custom rendering logic is needed to generate class-based selectors:

```css
/* Default (Brand A) */
:root {
  --color-primary: #0066ff;
}

/* Custom rendering (not auto-generated) */
.brand-b { --color-primary: #ff3366; }
.brand-c { --color-primary: #00cc88; }
```

> For the class-based brand theming pattern, see `figma-api-variables.md` Section "Pattern: Brand Theming".

#### Pattern 5: Combined Responsive + Theme (Cross-Product)

When a file has both breakpoint and theme collections, they produce independent CSS blocks that compose naturally:

```
Collection: "Theme" (theme mode type)
  Modes: [Light, Dark]
  Variables: color tokens...

Collection: "Spacing" (breakpoint mode type)
  Modes: [Mobile, Tablet, Desktop]
  Variables: spacing tokens...
```

**CSS Output:**

```css
:root {
  /* Theme — Light (default) */
  --color-bg: #ffffff;
  --color-text: #1a1a1a;

  /* Spacing — Mobile (default) */
  --spacing-md: 16px;
  --spacing-lg: 24px;
}

/* Spacing overrides (responsive) */
@media (min-width: 768px) {
  :root {
    --spacing-md: 24px;
    --spacing-lg: 32px;
  }
}

@media (min-width: 1024px) {
  :root {
    --spacing-md: 32px;
    --spacing-lg: 48px;
  }
}

/* Theme overrides (dark) */
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

These compose correctly because:
- Spacing media queries override spacing tokens (independent of theme)
- Theme selectors override color tokens (independent of viewport)
- A dark-theme user on a tablet gets both dark colors AND tablet spacing

#### Limitations of Cross-Product

Figma does not support cross-product modes within a single collection (e.g., you cannot have "Light Mobile" and "Dark Desktop" as modes in one collection). The cross-product emerges naturally from having separate collections with independent mode axes.

If a design needs values that vary by **both** theme and breakpoint simultaneously (e.g., different spacing in dark mode), this requires either:
- Two separate collections that compose
- Custom post-processing to merge the outputs

---

### 12. Integration with Token Pipeline

Variables integrate with the existing token pipeline at two points: collection (Stage 1) and promotion (Stage 2).

#### Collection Integration

Variables are collected alongside auto-detected tokens in `collectAllTokens`:

```typescript
async function collectAllTokens(node: ExtractedNode): Promise<DesignTokens> {
  const variableCollections = await getVariableCollections()

  return {
    colors: collectColors(node),                                  // Auto-detected
    spacing: collectSpacing(node),                                // Auto-detected
    typography: collectTypography(node),                          // Auto-detected
    effects: collectEffects(node),                                // Auto-detected
    figmaVariables: await collectFigmaVariables(node, variableCollections), // Explicit
    variableCollections,                                          // Mode metadata
  }
}
```

Variable collections are fetched first because the `collectFigmaVariables` function needs mode information to extract per-mode values.

#### Promotion Integration

During promotion, variables and auto-detected tokens are filtered differently:

```typescript
function promoteTokens(tokens: DesignTokens, threshold: number = 2): DesignTokens {
  // Auto-detected tokens: filter by usage count
  const colors = tokens.colors.filter(c => c.usageCount >= threshold)
  const spacing = tokens.spacing.filter(s => s.usageCount >= threshold)
  // ... etc.

  // Figma variables: ALWAYS included (explicit bindings), but only LOCAL
  const figmaVariables = tokens.figmaVariables?.filter(v => v.isLocal)

  return { colors, spacing, typography, effects, figmaVariables, variableCollections }
}
```

Key differences:

| Aspect | Auto-Detected Tokens | Figma Variable Tokens |
|--------|:---:|:---:|
| Promotion filter | Usage count >= threshold | Always promoted |
| Local/external | N/A (always from current file) | Only local included |
| Naming | Heuristic (HSL, scale, role) | From variable path |
| Mode values | None (single value) | Per-mode values |
| Conflict priority | Lower | Higher (wins conflicts) |

#### Rendering Integration

The `renderTokensCSS` function renders both token types in a single output:

1. **`:root` block** contains:
   - Figma Variables (default mode values), grouped by collection
   - Auto-detected tokens (colors, spacing, typography, effects), grouped by category

2. **Media query blocks** contain:
   - Breakpoint mode overrides (Figma Variables only)

3. **Theme selector blocks** contain:
   - Theme mode overrides (Figma Variables only)

Auto-detected tokens do not have mode-aware rendering -- they always appear in the base `:root` block with a single value.

#### Lookup Integration

The token lookup system checks variable bindings first, then falls back to auto-detected tokens:

```
lookupFillColor(fill, lookup):
  1. fill.variable exists? → var(--css-name) [± fallback]
  2. lookup.colors has this value? → var(--color-token)
  3. Neither → raw color value
```

This means a color that is both:
- Bound to a variable named `color/link/default`
- Auto-detected as `--color-primary` (most-used saturated color)

...will render as `var(--color-link-default)`, not `var(--color-primary)`. The explicit variable binding wins.

> For the complete token pipeline stages, see `design-tokens.md` Section 1.

---

## Cross-References

- **`figma-api-variables.md`** -- Variables API endpoints, data model (Variable, VariableCollection, modes, scopes), alias resolution mechanics, multi-mode theming patterns, access requirements (Enterprise plan). The API-level reference for all Variables operations.
- **`design-tokens.md`** -- General token extraction pipeline (collect, promote, name, render), threshold-based promotion, HSL-based color naming, spacing scale detection, token lookup system, CSS/SCSS/Tailwind rendering. The pipeline that Variables plug into.
- **`css-strategy.md`** -- Three-layer CSS architecture (Tailwind + Custom Properties + CSS Modules), property placement decision tree, specificity management, responsive strategy, theme support, Visual Builder token aliasing. Where generated tokens are consumed.
- **`design-to-code-visual.md`** -- Visual property extraction (fills, strokes, effects, corners) with variable binding resolution. Fill variable priority chain. HSL-based color token naming.
- **`design-to-code-layout.md`** -- Layout property extraction (gap, padding) with variable bindings. Variable-aware spacing in CSS generation. Mobile-first responsive pattern.
- **`design-to-code-typography.md`** -- Typography extraction with variable bindings on text fill colors in styled segments. Font family/size/weight token lookup during generation.
