# Visual Properties → CSS Mapping

## Purpose

Authoritative reference for converting Figma visual properties into CSS. Encodes production-proven mapping rules covering the complete pipeline: extracting fills, strokes, effects, corner radii, gradients, opacity, and blend modes from Figma nodes, transforming them into intermediate types, and generating pixel-accurate CSS. This module covers everything that gives a node its visual appearance beyond layout (which is handled by the layout module).

## When to Use

Reference this module when you need to:

- Convert Figma fills (solid, gradient, image) to CSS `background-color` or `background-image`
- Map Figma gradient transforms to CSS gradient angles and stop positions
- Convert Figma strokes (with alignment INSIDE/CENTER/OUTSIDE) to CSS borders or box-shadows
- Map Figma effects (shadows, blurs) to CSS `box-shadow`, `filter`, and `backdrop-filter`
- Handle uniform and per-corner border radius with shorthand optimization
- Apply node-level and fill-level opacity correctly without double-application
- Resolve Figma variable bindings on visual properties to CSS custom properties
- Understand the RGB 0-1 to 0-255 conversion and hex normalization
- Handle multiple fills with correct layer ordering (Figma vs CSS reversal)
- Generate design tokens from collected visual properties (colors, shadows, radii)
- Avoid common visual property conversion pitfalls

---

## Content

### 1. Fills → CSS Background

Figma fills are paint layers applied to a node. Each fill has a type (SOLID, gradient variants, IMAGE), visibility, and opacity. Only visible fills should be converted to CSS.

#### Extracted Fill Types

```typescript
type FillData =
  | { type: 'SOLID'; color: string; opacity: number; variable?: VariableReference }
  | { type: 'GRADIENT'; gradient: GradientData }
  | { type: 'IMAGE'; imageHash: string; scaleMode: string }

interface VariableReference {
  id: string        // Figma variable ID
  name: string      // Variable name path (e.g., "color/link/default")
  isLocal: boolean  // Local to this file vs external library
}
```

#### SOLID Fill → CSS

Figma stores RGB channels as floats in the 0-1 range. They must be converted to 0-255 integers for CSS.

**RGB Conversion Formula:**

```
CSS channel = Math.round(figmaChannel * 255)
```

**Hex color generation:**

```typescript
function rgbToHex(color: RGB, opacity: number = 1): string {
  const { r, g, b } = color
  if (opacity < 1) {
    return `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${opacity.toFixed(2)})`
  }
  return `#${Math.round(r * 255).toString(16).padStart(2, '0')}${Math.round(g * 255).toString(16).padStart(2, '0')}${Math.round(b * 255).toString(16).padStart(2, '0')}`
}
```

| Figma Fill | CSS Output |
|------------|------------|
| `{ r: 1, g: 0, b: 0 }`, opacity 1.0 | `background-color: #ff0000` |
| `{ r: 0.2, g: 0.4, b: 0.6 }`, opacity 0.8 | `background-color: rgba(51, 102, 153, 0.80)` |
| `{ r: 1, g: 1, b: 1 }`, opacity 1.0 | `background-color: #ffffff` |
| `{ r: 0, g: 0, b: 0 }`, opacity 0.5 | `background-color: rgba(0, 0, 0, 0.50)` |

**Opacity handling for hex colors:**

When a solid fill has `opacity < 1`, the alpha is embedded in the color value as `rgba()`. This is fill-level opacity, distinct from node-level opacity (see Section 6).

```typescript
function applyOpacity(hexColor: string, opacity: number): string {
  if (hexColor.startsWith('rgba')) {
    return hexColor.replace(/[\d.]+\)$/, `${opacity})`)
  }
  const hex = hexColor.replace('#', '')
  const r = parseInt(hex.substring(0, 2), 16)
  const g = parseInt(hex.substring(2, 4), 16)
  const b = parseInt(hex.substring(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${opacity})`
}
```

#### IMAGE Fill → CSS

Image fills reference an `imageHash` that maps to an exported asset file.

| Figma `scaleMode` | CSS `background-size` |
|--------------------|----------------------|
| `FILL` (default)   | `cover`              |
| `FIT`              | `contain`            |
| `CROP`             | `cover` (with position) |
| `TILE`             | `auto` (with `background-repeat: repeat`) |

```css
/* IMAGE fill with FILL scale mode */
background-image: url(../assets/image-abc123.png);
background-size: cover;
background-position: center;
background-repeat: no-repeat;

/* IMAGE fill with FIT scale mode */
background-image: url(../assets/image-abc123.png);
background-size: contain;
background-position: center;
background-repeat: no-repeat;
```

**Fallback:** When an image hash cannot be resolved to a filename, use a placeholder background color:

```css
background-color: #f0f0f0;
```

#### Multiple Fills — Layer Order Reversal (CRITICAL)

Figma renders fills **bottom-to-top**: the first fill in the array is the bottom layer (painted first, visually behind). CSS `background` layers render **top-to-bottom**: the first value is the top layer (visually in front).

**Rule: Reverse the fills array when generating CSS.**

```
Figma fills array:  [fill_0 (bottom), fill_1 (middle), fill_2 (top)]
CSS backgrounds:    [fill_2 (top),    fill_1 (middle), fill_0 (bottom)]
```

When layering multiple fills in CSS, solid colors must be converted to `linear-gradient(color, color)` because CSS cannot mix `background-color` with multiple `background-image` layers.

```typescript
// Multiple fills generation (reversed order)
const reversedFills = [...fills].reverse()
const backgroundImages: string[] = []

for (const fill of reversedFills) {
  if (fill.type === 'SOLID') {
    // Solid colors become degenerate gradients for layering
    backgroundImages.push(`linear-gradient(${color}, ${color})`)
  } else if (fill.type === 'GRADIENT') {
    backgroundImages.push(generateGradientCSS(fill.gradient))
  } else if (fill.type === 'IMAGE') {
    backgroundImages.push(`url(../assets/${filename})`)
  }
}
```

**CSS output for multiple fills:**

```css
/* Gradient over solid color */
background-image: linear-gradient(90deg, #ff0000 0%, #0000ff 100%), linear-gradient(#f5f5f5, #f5f5f5);
background-size: cover, cover;
background-position: center, center;
background-repeat: no-repeat, no-repeat;
```

#### Visibility Filtering

Skip fills where `visible === false`. Figma allows toggling individual fill layer visibility, so always check before processing.

```typescript
for (const paint of fills) {
  if (!paint.visible) continue  // Skip invisible fills
  // ... process fill
}
```

#### Mixed Fills on Text Nodes

Text nodes can have `fills === figma.mixed` when different character ranges have different colors. For extraction, use the first character's fill as the dominant color:

```typescript
if (fills === figma.mixed && node.type === 'TEXT') {
  const rangeFills = (node as TextNode).getRangeFills(0, 1)
  if (Array.isArray(rangeFills) && rangeFills.length > 0) {
    fills = rangeFills
  }
}
```

Full styled-segment support (per-character colors) is handled by the typography module.

---

### 2. Gradient Mapping

Figma supports four gradient types. Each has color stops and a transform matrix that defines the gradient's orientation and shape.

#### Extracted Gradient Types

```typescript
interface GradientData {
  type: 'LINEAR' | 'RADIAL' | 'ANGULAR' | 'DIAMOND'
  stops: Array<{ color: string; position: number }>
  angle?: number  // Only for LINEAR (calculated from transform matrix)
}
```

#### Gradient Type → CSS Function

| Figma Gradient Type | CSS Function | Notes |
|---------------------|-------------|-------|
| `GRADIENT_LINEAR`   | `linear-gradient(Ndeg, ...stops)` | Angle from transform matrix |
| `GRADIENT_RADIAL`   | `radial-gradient(circle, ...stops)` | Figma default is ellipse; `circle` is a safe approximation |
| `GRADIENT_ANGULAR`  | `conic-gradient(...stops)` | Maps directly to CSS conic |
| `GRADIENT_DIAMOND`  | `radial-gradient(circle, ...stops)` | No direct CSS equivalent; approximate with radial |

#### Linear Gradient Angle Conversion (The Math)

Figma represents gradient direction using a 2x3 affine transform matrix. The angle must be extracted and converted to CSS conventions.

**Figma transform matrix structure:**

```
Transform = [[a, c, e], [b, d, f]]
```

Where `(a, b)` is the unit vector for the gradient direction.

**Coordinate system differences:**

| Property | Figma | CSS |
|----------|-------|-----|
| 0 degrees | Left-to-right (positive X) | Bottom-to-top (upward) |
| Direction | Counter-clockwise | Clockwise |
| Default horizontal | 0 degrees | 90 degrees |

**Conversion formula:**

```typescript
function calculateGradientAngle(transform: Transform): number {
  // Extract gradient direction vector
  const [[a], [b]] = transform

  // Calculate Figma angle (counter-clockwise from positive X axis)
  const figmaAngle = Math.atan2(-b, a) * (180 / Math.PI)

  // Convert to CSS angle:
  // CSS 0deg = up, 90deg = right, 180deg = down, 270deg = left (clockwise)
  // Figma default horizontal gradient (0deg) should map to CSS 90deg
  const cssAngle = 90 - figmaAngle

  // Normalize to 0-360 range
  return Math.round(((cssAngle % 360) + 360) % 360)
}
```

**Step-by-step explanation:**

1. Extract the direction vector `(a, b)` from the first column of the transform matrix
2. Compute the Figma angle using `atan2(-b, a)` — the negation of `b` accounts for Figma's Y-axis direction
3. Convert from Figma's convention (0 degrees = right, counter-clockwise) to CSS convention (0 degrees = up, clockwise) by computing `90 - figmaAngle`
4. Normalize the result to the 0-360 degree range using modular arithmetic

**Common angle examples:**

| Figma Transform (a, b) | Figma Angle | CSS Angle | Visual Direction |
|-------------------------|-------------|-----------|-----------------|
| `(1, 0)` | 0 degrees | 90deg | Left to right |
| `(0, -1)` | 90 degrees | 0deg | Bottom to top |
| `(-1, 0)` | 180 degrees | 270deg | Right to left |
| `(0, 1)` | -90 degrees | 180deg | Top to bottom |

#### Color Stop Formatting

Figma stop positions are 0-1 floats. CSS expects percentages.

```typescript
const stops = gradient.stops
  .map(stop => `${stop.color} ${Math.round(stop.position * 100)}%`)
  .join(', ')
```

| Figma Stop | CSS Stop |
|------------|----------|
| `{ color: '#ff0000', position: 0 }` | `#ff0000 0%` |
| `{ color: '#0000ff', position: 0.5 }` | `#0000ff 50%` |
| `{ color: '#00ff00', position: 1 }` | `#00ff00 100%` |

#### Complete Gradient CSS Generation

```typescript
function generateGradientCSS(gradient: GradientData): string {
  const stops = gradient.stops
    .map(stop => `${stop.color} ${Math.round(stop.position * 100)}%`)
    .join(', ')

  switch (gradient.type) {
    case 'LINEAR': {
      const angle = gradient.angle ?? 180
      return `linear-gradient(${angle}deg, ${stops})`
    }
    case 'RADIAL':
      return `radial-gradient(circle, ${stops})`
    case 'ANGULAR':
      return `conic-gradient(${stops})`
    case 'DIAMOND':
      // No direct CSS equivalent — approximate with radial
      return `radial-gradient(circle, ${stops})`
    default:
      return `linear-gradient(180deg, ${stops})`
  }
}
```

**CSS output examples:**

```css
/* Linear gradient, 45 degrees */
background-image: linear-gradient(45deg, #ff0000 0%, #0000ff 100%);

/* Radial gradient */
background-image: radial-gradient(circle, #ffffff 0%, #000000 100%);

/* Conic/angular gradient */
background-image: conic-gradient(#ff0000 0%, #00ff00 33%, #0000ff 66%, #ff0000 100%);
```

#### Gradient Text

When a text node has a gradient fill, use the gradient-text technique:

```css
background-image: linear-gradient(90deg, #ff0000 0%, #0000ff 100%);
background-clip: text;
-webkit-background-clip: text;
color: transparent;
```

---

### 3. Strokes → CSS Border / Box-Shadow

Figma strokes have color, weight, alignment, and optional per-side weights. The stroke alignment determines which CSS property to use.

#### Extracted Stroke Type

```typescript
interface StrokeData {
  color: string                  // Hex or rgba string
  opacity: number                // 0-1
  weight: number                 // Uniform weight (0 if per-side)
  align: 'INSIDE' | 'OUTSIDE' | 'CENTER'
  weights?: {                    // Per-side weights (if different)
    top: number
    right: number
    bottom: number
    left: number
  }
}
```

#### Stroke Alignment → CSS Property

Figma's stroke alignment determines where the stroke sits relative to the node boundary. Each alignment needs a different CSS approach.

| Figma `strokeAlign` | CSS Approach | Rationale |
|---------------------|-------------|-----------|
| `CENTER` | `border: Wpx solid color` | CSS `border` is painted centered on the edge (default CSS behavior) |
| `INSIDE` | `box-shadow: inset 0 0 0 Wpx color` | Inset shadow doesn't change element dimensions, unlike `border` which adds to width/height |
| `OUTSIDE` | `box-shadow: 0 0 0 Wpx color` or `outline: Wpx solid color` | Outset shadow or outline paints outside without affecting layout |

> **Important:** CSS `border` adds to the element's rendered dimensions (unless `box-sizing: border-box` is set). Figma's INSIDE stroke does NOT change the frame's dimensions. Using `box-shadow: inset` for INSIDE strokes preserves dimensional accuracy.

**CENTER stroke (default approach):**

```css
/* Figma: strokeAlign CENTER, weight 2px, color #333333 */
border: 2px solid #333333;
```

**INSIDE stroke (use inset box-shadow):**

```css
/* Figma: strokeAlign INSIDE, weight 2px, color #333333 */
box-shadow: inset 0 0 0 2px #333333;
```

**OUTSIDE stroke (use outset box-shadow or outline):**

```css
/* Figma: strokeAlign OUTSIDE, weight 2px, color #333333 */
box-shadow: 0 0 0 2px #333333;
/* Alternative: */
outline: 2px solid #333333;
```

> **Implementation note:** A simpler approach maps all strokes to `border`. The box-shadow approach for INSIDE/OUTSIDE is the recommended production pattern for pixel-accurate results.

#### Per-Side Stroke Weights

Figma supports different stroke weights per side via `strokeTopWeight`, `strokeRightWeight`, `strokeBottomWeight`, `strokeLeftWeight`. These are available on frames and components.

```typescript
// Detection: per-side weights exist when strokeWeight is mixed
// or when individual side weights differ from each other
if (stroke.weights) {
  const { top, right, bottom, left } = stroke.weights
  if (top > 0) styles.borderTop = `${top}px solid ${color}`
  if (right > 0) styles.borderRight = `${right}px solid ${color}`
  if (bottom > 0) styles.borderBottom = `${bottom}px solid ${color}`
  if (left > 0) styles.borderLeft = `${left}px solid ${color}`
} else if (stroke.weight > 0) {
  styles.border = `${stroke.weight}px solid ${color}`
}
```

**CSS output for per-side strokes:**

```css
/* Only bottom border (common for underlines, dividers) */
border-bottom: 2px solid #e0e0e0;

/* Different top and bottom (card with header accent) */
border-top: 4px solid #1a73e8;
border-bottom: 1px solid #e0e0e0;
```

#### Dash Patterns

Figma's `strokeDashPattern` defines a dash-gap array (e.g., `[10, 5]` means 10px dash, 5px gap). CSS approximation:

| Figma `strokeDashPattern` | CSS `border-style` |
|---------------------------|-------------------|
| `[]` (empty/none) | `solid` |
| `[dash, gap]` | `dashed` |
| `[1, gap]` (dot pattern) | `dotted` |

CSS `dashed` and `dotted` do not support custom dash lengths. For exact dash patterns, SVG `stroke-dasharray` is required.

#### Stroke Visibility and Type Filtering

Only solid, visible strokes are processed during extraction:

```typescript
for (const paint of strokes) {
  if (!paint.visible || paint.type !== 'SOLID') continue
  // ... extract stroke data
}
```

Gradient strokes and image strokes are not supported in CSS border — they require SVG or more complex CSS workarounds (e.g., border-image).

---

### 4. Effects → CSS Shadows & Filters

Figma effects include shadows and blurs. Each effect has a type, visibility, and type-specific properties.

#### Extracted Effect Types

```typescript
type EffectData =
  | { type: 'DROP_SHADOW'; offset: { x: number; y: number }; radius: number; spread: number; color: string }
  | { type: 'INNER_SHADOW'; offset: { x: number; y: number }; radius: number; spread: number; color: string }
  | { type: 'BLUR'; radius: number }
  | { type: 'BACKGROUND_BLUR'; radius: number }
```

#### Effect Type → CSS Property

| Figma Effect Type | CSS Property | CSS Syntax |
|-------------------|-------------|------------|
| `DROP_SHADOW` | `box-shadow` | `Xpx Ypx Rpx Spx color` |
| `INNER_SHADOW` | `box-shadow` (inset) | `inset Xpx Ypx Rpx Spx color` |
| `LAYER_BLUR` | `filter` | `blur(Rpx)` |
| `BACKGROUND_BLUR` | `backdrop-filter` | `blur(Rpx)` |

#### DROP_SHADOW → box-shadow

```css
/* Figma: DROP_SHADOW { offset: {x: 0, y: 4}, radius: 8, spread: 0, color: rgba(0,0,0,0.25) } */
box-shadow: 0px 4px 8px 0px rgba(0, 0, 0, 0.25);
```

Parameter mapping:

| Figma Property | CSS `box-shadow` Position | Description |
|----------------|--------------------------|-------------|
| `offset.x` | 1st value | Horizontal offset |
| `offset.y` | 2nd value | Vertical offset |
| `radius` | 3rd value (blur-radius) | Gaussian blur radius |
| `spread` | 4th value (spread-radius) | Expand/contract shadow; defaults to 0 in Figma |
| `color` | 5th value | Shadow color with alpha |

#### INNER_SHADOW → box-shadow inset

Same parameters as DROP_SHADOW but with the `inset` keyword prepended:

```css
/* Figma: INNER_SHADOW { offset: {x: 0, y: 2}, radius: 4, spread: 0, color: rgba(0,0,0,0.10) } */
box-shadow: inset 0px 2px 4px 0px rgba(0, 0, 0, 0.10);
```

#### LAYER_BLUR → filter: blur()

Layer blur applies a Gaussian blur to the entire element and its contents.

```css
/* Figma: LAYER_BLUR { radius: 8 } */
filter: blur(8px);
```

#### BACKGROUND_BLUR → backdrop-filter: blur()

Background blur blurs the content behind the element (used for frosted glass effects). Requires the element to have a semi-transparent background.

```css
/* Figma: BACKGROUND_BLUR { radius: 20 } */
backdrop-filter: blur(20px);
-webkit-backdrop-filter: blur(20px);  /* Safari support */
```

> **Browser support note:** `backdrop-filter` is widely supported but older browsers may need the `-webkit-` prefix. Always include both for cross-browser compatibility.

#### Multiple Effects

A single node can have multiple effects of different types. They combine in CSS according to their property:

- **Multiple shadows** (drop + inner): comma-separated in a single `box-shadow` declaration
- **Multiple filters**: space-separated in a single `filter` declaration
- **backdrop-filter**: only one `backdrop-filter` value per element

```typescript
function generateEffectStyles(effects: EffectData[]): CSSStyles {
  const shadows: string[] = []
  const filters: string[] = []

  for (const effect of effects) {
    if (effect.type === 'DROP_SHADOW') {
      shadows.push(`${effect.offset.x}px ${effect.offset.y}px ${effect.radius}px ${effect.spread}px ${effect.color}`)
    } else if (effect.type === 'INNER_SHADOW') {
      shadows.push(`inset ${effect.offset.x}px ${effect.offset.y}px ${effect.radius}px ${effect.spread}px ${effect.color}`)
    } else if (effect.type === 'BLUR') {
      filters.push(`blur(${effect.radius}px)`)
    } else if (effect.type === 'BACKGROUND_BLUR') {
      styles.backdropFilter = `blur(${effect.radius}px)`
    }
  }

  if (shadows.length > 0) {
    styles.boxShadow = shadows.join(', ')
  }
  if (filters.length > 0) {
    styles.filter = filters.join(' ')
  }
}
```

**CSS output with multiple effects:**

```css
/* Drop shadow + inner shadow combined */
box-shadow: 0px 4px 12px 0px rgba(0, 0, 0, 0.15), inset 0px 1px 2px 0px rgba(0, 0, 0, 0.06);

/* Blur filter */
filter: blur(4px);

/* Frosted glass: backdrop blur + semi-transparent background */
backdrop-filter: blur(20px);
-webkit-backdrop-filter: blur(20px);
background-color: rgba(255, 255, 255, 0.70);
```

#### Effect Visibility Filtering

Like fills, effects have a `visible` property. Always check before processing:

```typescript
for (const effect of effects) {
  if (!effect.visible) continue  // Skip toggled-off effects
  // ... process effect
}
```

---

### 5. Corner Radius

Corner radius controls the rounding of a node's corners. Figma supports both uniform and per-corner values.

#### Extracted Corner Radius Type

```typescript
type CornerRadius = number | {
  topLeft: number
  topRight: number
  bottomRight: number
  bottomLeft: number
}
```

- `number` — Uniform radius applied to all four corners
- `object` — Per-corner radii (Figma returns this when `cornerRadius === figma.mixed`)

#### Uniform Radius → CSS

When all corners share the same value:

```css
/* Figma: cornerRadius = 8 */
border-radius: 8px;
```

#### Per-Corner Radius → CSS

When corners have different values, Figma returns individual properties (`topLeftRadius`, `topRightRadius`, `bottomRightRadius`, `bottomLeftRadius`):

```css
/* Figma: TL=8, TR=8, BR=0, BL=0 (rounded top only) */
border-radius: 8px 8px 0px 0px;

/* Figma: TL=16, TR=0, BR=16, BL=0 (diagonal corners) */
border-radius: 16px 0px 16px 0px;
```

**CSS shorthand order:** `top-left top-right bottom-right bottom-left` (clockwise from top-left).

#### Shorthand Optimization

When extracting per-corner radii, check if all four values are equal. If so, use the shorter uniform syntax:

```typescript
function generateCornerRadiusStyles(cornerRadius: CornerRadius): CSSStyles {
  if (typeof cornerRadius === 'number') {
    if (cornerRadius > 0) {
      return { borderRadius: `${cornerRadius}px` }
    }
    return {}
  }

  const { topLeft, topRight, bottomRight, bottomLeft } = cornerRadius
  // Optimize: if all corners equal, use shorthand
  if (topLeft === topRight && topRight === bottomRight && bottomRight === bottomLeft) {
    if (topLeft > 0) return { borderRadius: `${topLeft}px` }
    return {}
  }
  // Otherwise use full four-value syntax
  return { borderRadius: `${topLeft}px ${topRight}px ${bottomRight}px ${bottomLeft}px` }
}
```

#### Circle Detection

When `border-radius` equals or exceeds half the element's smallest dimension, the element becomes circular (or pill-shaped for rectangles):

```css
/* Circle: radius >= min(width, height) / 2 */
border-radius: 50%;

/* Pill shape: large radius on a rectangle */
border-radius: 9999px;
```

> **Detection heuristic:** If `cornerRadius >= min(width, height) / 2`, consider using `border-radius: 50%` for circles or `border-radius: 9999px` for pill shapes. The 9999px approach is commonly used because it works regardless of element dimensions.

#### Zero and Undefined Radius

| Value | Meaning | CSS Output |
|-------|---------|------------|
| `cornerRadius` not present on node | No rounding capability | No `border-radius` property |
| `cornerRadius === 0` | Explicitly no rounding | No `border-radius` property (omit) |
| `cornerRadius === undefined` (extracted) | No radius data | No `border-radius` property (omit) |

Both `0` and `undefined` result in no CSS output. Do not emit `border-radius: 0px` — it is redundant.

#### Variable Bindings for Radius

Corner radius values can be bound to Figma variables (see Section 7 for the general pattern). When a variable is bound:

```css
/* Variable-bound radius */
border-radius: var(--radius-md);

/* With token lookup fallback */
border-radius: var(--radius-md, 8px);
```

---

### 6. Opacity & Blend Modes

#### Node-Level Opacity

Every Figma node has an `opacity` property (0-1 float). Only emit CSS when opacity is less than 1:

```typescript
function generateOpacityStyles(opacity: number): CSSStyles {
  if (opacity < 1) {
    return { opacity: String(opacity) }
  }
  return {}
}
```

```css
/* Figma: opacity = 0.5 */
opacity: 0.5;
```

#### Fill-Level Opacity

Individual fills have their own opacity. This is embedded in the color's alpha channel, NOT as a separate CSS property:

```
Node opacity = 0.8     →  CSS: opacity: 0.8
Fill opacity = 0.5     →  CSS: background-color: rgba(R, G, B, 0.5)
```

These are independent — they do NOT combine into a single CSS property.

#### Opacity Compounding (Visual Result)

The visual opacity of a fill is the product of node-level and fill-level opacity:

```
Visual opacity = node.opacity * fill.opacity
```

However, in CSS they are expressed separately:

```css
/* Node opacity 0.8, fill opacity 0.5 */
/* Visual result: 0.8 * 0.5 = 0.4 effective opacity */
opacity: 0.8;
background-color: rgba(255, 0, 0, 0.5);
```

> **Warning:** Do NOT multiply them together into a single property. CSS `opacity` affects the entire element and all its children, while fill alpha only affects that specific background layer.

#### Blend Modes

Figma's `blendMode` property maps to CSS `mix-blend-mode`. Most Figma blend modes have direct CSS equivalents:

| Figma `blendMode` | CSS `mix-blend-mode` |
|--------------------|---------------------|
| `NORMAL` | `normal` (default, omit) |
| `MULTIPLY` | `multiply` |
| `SCREEN` | `screen` |
| `OVERLAY` | `overlay` |
| `DARKEN` | `darken` |
| `LIGHTEN` | `lighten` |
| `COLOR_DODGE` | `color-dodge` |
| `COLOR_BURN` | `color-burn` |
| `HARD_LIGHT` | `hard-light` |
| `SOFT_LIGHT` | `soft-light` |
| `DIFFERENCE` | `difference` |
| `EXCLUSION` | `exclusion` |
| `HUE` | `hue` |
| `SATURATION` | `saturation` |
| `COLOR` | `color` |
| `LUMINOSITY` | `luminosity` |

**Figma-only blend modes** (no direct CSS equivalent):

| Figma `blendMode` | CSS Approximation |
|--------------------|-------------------|
| `PASS_THROUGH` | `normal` (default for groups; children blend independently) |
| `LINEAR_DODGE` | No equivalent (approximate with `screen`) |
| `LINEAR_BURN` | No equivalent (approximate with `multiply`) |

```css
/* Figma: blendMode MULTIPLY */
mix-blend-mode: multiply;

/* For backgrounds specifically */
background-blend-mode: overlay;
```

> **When to use which:** `mix-blend-mode` blends the element with content below it. `background-blend-mode` blends multiple background layers within the same element.

---

### 7. Variable Binding for Visual Properties

Figma Variables allow designers to bind property values to named tokens. When a visual property is variable-bound, the CSS output should use `var()` instead of raw values.

#### Variable Resolution Pipeline

```
Figma Variable ID → Variable Lookup → Variable Name → CSS Variable Name → var() Reference
```

**Name conversion:** Figma uses `/` as path separator (e.g., `color/link/default`). CSS uses `-` (e.g., `--color-link-default`).

```typescript
function figmaVariableToCssName(variableName: string): string {
  return '--' + variableName
    .toLowerCase()
    .replace(/\//g, '-')      // Slashes to dashes
    .replace(/\s+/g, '-')     // Spaces to dashes
    .replace(/[^a-z0-9-_]/g, '') // Remove invalid chars
}
```

| Figma Variable Name | CSS Variable |
|---------------------|-------------|
| `color/link/default` | `--color-link-default` |
| `color/background/primary` | `--color-background-primary` |
| `spacing/lg` | `--spacing-lg` |
| `radius/md` | `--radius-md` |

#### Paint-Level Variable Binding (Primary)

Figma binds variables at the paint (fill) level. Each paint object can have `boundVariables.color.id`:

```typescript
// Check paint-level binding first (preferred)
const paintBoundVars = (paint as any).boundVariables
if (paintBoundVars && paintBoundVars.color && paintBoundVars.color.id) {
  const variable = await lookupVariable(paintBoundVars.color.id)
  // variable.name → "color/link/default"
}
```

#### Node-Level Variable Binding (Fallback)

Some Figma API versions expose bindings at the node level instead of (or in addition to) the paint level:

```typescript
// Fallback: check node-level binding
const boundVars = (node as any).boundVariables
if (boundVars && boundVars.fills) {
  // Multiple possible structures:
  // 1. Array: boundVars.fills[index] = { id: 'VariableID:xxx' }
  // 2. Nested: boundVars.fills[index] = { color: { id: 'VariableID:xxx' } }
  // 3. Object: boundVars.fills = { '0': { ... } }
}
```

**Resolution order:**
1. Paint-level `paint.boundVariables.color.id` (preferred)
2. Node-level `node.boundVariables.fills[index].id` (fallback)
3. Node-level `node.boundVariables.fills[index].color.id` (alternate structure)
4. Node-level `node.boundVariables.fill.id` (singular form, some API versions)

#### Local vs External Library Variables

Variables can be local (defined in the same file) or from an external library. This affects fallback strategy:

```typescript
function lookupFillColor(fill: FillData): ColorLookupResult {
  if (fill.variable && fill.variable.name) {
    const cssVarName = figmaVariableToCssName(fill.variable.name)

    if (fill.variable.isLocal) {
      // Local variable: no fallback needed (defined in our tokens.css)
      return { value: `var(${cssVarName})` }
    }

    // External library variable: include raw value as fallback
    return {
      value: `var(${cssVarName}, ${fill.color})`,
      comment: `/* fallback: "${fill.variable.name}" is from external library */`
    }
  }
  // No variable: use raw color
  return { value: fill.color }
}
```

**CSS output:**

```css
/* Local variable — no fallback needed */
background-color: var(--color-primary);

/* External library variable — include fallback */
background-color: var(--color-link-default, #1a73e8); /* fallback: "color/link/default" is from external library */
```

#### Variables on Other Visual Properties

The same variable binding pattern applies to:

| Property | Variable Path | CSS Variable Example |
|----------|-------------|---------------------|
| Fill color | `paint.boundVariables.color` | `var(--color-primary)` |
| Stroke color | `paint.boundVariables.color` | `var(--color-border-default)` |
| Corner radius | `node.boundVariables.cornerRadius` | `var(--radius-md)` |
| Effect color | `effect.boundVariables.color` | `var(--color-shadow)` |

#### Token Lookup (Value-Based Resolution)

When no variable binding exists, colors can still be mapped to tokens via reverse lookup. The token system collects all colors, assigns semantic names, and creates a lookup map:

```typescript
// Build lookup: raw color value → CSS variable reference
const lookup: TokenLookup = {
  colors: new Map([
    ['#1a73e8', 'var(--color-primary)'],
    ['#333333', 'var(--color-neutral-800)'],
  ]),
  radii: new Map([
    [8, 'var(--radius-md)'],
    [16, 'var(--radius-lg)'],
  ]),
}

// Usage: resolve raw value to token
function lookupColor(lookup: TokenLookup, value: string): string {
  const normalized = value.toLowerCase()
  return lookup.colors.get(normalized) || value
}
```

**Hex normalization is critical:** Always lowercase hex values before lookup to ensure `#1A73E8` matches `#1a73e8`.

---

### 8. Common Pitfalls

#### RGB 0-1 Float Range (NOT 0-255)

Figma's RGB channels are **0-1 floats**, not 0-255 integers. This is the single most common conversion bug.

```typescript
// WRONG: Using Figma values directly
`rgb(${color.r}, ${color.g}, ${color.b})`  // rgb(0.2, 0.4, 0.6) — INVALID

// CORRECT: Multiply by 255 and round
`rgb(${Math.round(color.r * 255)}, ${Math.round(color.g * 255)}, ${Math.round(color.b * 255)})`
```

#### Fill Order Reversal

Figma paints fills **bottom-to-top** (index 0 = bottom layer). CSS paints backgrounds **top-to-bottom** (first value = top layer). Forgetting to reverse causes layers to appear in the wrong visual order.

```typescript
// WRONG: Using Figma order directly
const backgrounds = fills.map(f => toCSS(f))

// CORRECT: Reverse for CSS order
const backgrounds = [...fills].reverse().map(f => toCSS(f))
```

#### INSIDE Stroke Dimension Impact

CSS `border` adds to the element's rendered dimensions. Figma's INSIDE stroke does not change the frame's bounding box. Using `border` for INSIDE strokes causes elements to be larger than designed.

```css
/* WRONG for INSIDE stroke: */
border: 2px solid #333;  /* Element is now 4px wider and taller */

/* CORRECT for INSIDE stroke: */
box-shadow: inset 0 0 0 2px #333;  /* No dimension change */
```

#### cornerRadius: undefined vs 0

Both `undefined` (property not present) and `0` (explicitly zero) mean no rounding. Do not emit `border-radius: 0px` — it is redundant and adds unnecessary CSS.

```typescript
// WRONG: Emitting zero radius
if (cornerRadius !== undefined) {
  styles.borderRadius = `${cornerRadius}px`  // Emits "border-radius: 0px"
}

// CORRECT: Skip zero and undefined
if (cornerRadius !== undefined && cornerRadius !== 0) {
  // Only emit when there is actual rounding
}
```

#### Gradient Angle Mismatch

Figma's 0 degrees is **not** CSS's 0 degrees. Directly using the Figma angle in CSS produces a rotated gradient.

```css
/* Figma says 0° (horizontal, left-to-right) */

/* WRONG: */
linear-gradient(0deg, ...)  /* CSS 0° = bottom-to-top */

/* CORRECT: Apply conversion formula */
linear-gradient(90deg, ...)  /* CSS 90° = left-to-right */
```

Always use the `calculateGradientAngle()` conversion with the transform matrix, not any raw "angle" value from Figma.

#### Opacity Compounding

Node opacity and fill opacity are independent in CSS. Do not multiply them into a single value.

```css
/* Figma: node opacity 0.8, fill with rgba(255,0,0,0.5) */

/* WRONG: Combined opacity */
opacity: 0.4;
background-color: #ff0000;

/* CORRECT: Separate opacity sources */
opacity: 0.8;
background-color: rgba(255, 0, 0, 0.5);
```

#### Invisible Fills and Effects

Figma allows toggling individual fill layers and effects on/off via the `visible` property. Always check visibility before processing:

```typescript
// WRONG: Processing all fills
for (const fill of fills) { /* ... */ }

// CORRECT: Filter invisible fills
for (const fill of fills) {
  if (!fill.visible) continue
  // ... process fill
}
```

#### Mixed Stroke Weight Handling

When `strokeWeight === figma.mixed`, individual side weights exist. Do not treat `figma.mixed` as a number — it will cause NaN in CSS output.

```typescript
// WRONG: Using strokeWeight directly
styles.border = `${node.strokeWeight}px solid ${color}`  // May produce "Symbol(mixed)px"

// CORRECT: Check for mixed first
if (node.strokeWeight === figma.mixed) {
  // Use per-side weights: strokeTopWeight, strokeRightWeight, etc.
} else {
  styles.border = `${node.strokeWeight}px solid ${color}`
}
```

#### Hex Normalization for Token Lookup

Colors must be normalized before looking up in the token map. Figma may return `#1A73E8` but the token was stored as `#1a73e8`.

```typescript
// WRONG: Direct lookup
lookup.colors.get(fill.color)  // Misses due to case mismatch

// CORRECT: Normalize first
lookup.colors.get(fill.color.toLowerCase())
```

---

### 9. Color Token Integration

Colors extracted from visual properties can be promoted to design tokens for reuse across the generated codebase. This section covers how the pipeline collects, names, and emits color tokens.

#### Color Collection

All colors are collected from a node tree by traversing fills, strokes, and effects. Each unique color (after normalization) is tracked with its usage count.

```typescript
// Sources of colors:
// 1. Solid fills → fill.color
// 2. Strokes → stroke.color
// 3. Shadow effects → effect.color
// (Gradient stops are skipped in v1)
```

#### Semantic Color Naming

Colors are assigned semantic names based on HSL analysis:

| HSL Range | Semantic | CSS Variable Pattern |
|-----------|----------|---------------------|
| Saturation < 10% | `neutral` | `--color-neutral-{100-900}` (by lightness) |
| Hue 0-20 or 340-360 | `error` | `--color-error` |
| Hue 30-60 | `warning` | `--color-warning` |
| Hue 90-150 | `success` | `--color-success` |
| Most-used saturated color | `primary` | `--color-primary` |
| Second most-used saturated | `secondary` | `--color-secondary` |
| Remaining saturated | `accent` | `--color-accent`, `--color-accent-2`, ... |

**Neutral scale:** Maps lightness to a 100-900 scale (inverted: 100 = lightest, 900 = darkest):

```typescript
const step = Math.round((1 - lightness / 100) * 8 + 1) * 100
// Lightness 95% → step 100 (near white)
// Lightness 50% → step 500 (medium gray)
// Lightness 5%  → step 900 (near black)
```

#### Effect Token Naming

Shadows and radii are also promoted to tokens using a size scale:

```
Shadows: --shadow-sm, --shadow-md, --shadow-lg, --shadow-xl, --shadow-2xl
Radii:   --radius-sm, --radius-md, --radius-lg, --radius-xl, --radius-full
```

Shadow tokens are ordered by blur radius (smallest = `sm`). Radius tokens are ordered by pixel value.

---

### 10. Complete Visual Style Generation

All visual properties are generated together and merged into a single CSS object:

```typescript
function generateVisualStyles(
  fills: FillData[] | undefined,
  strokes: StrokeData[] | undefined,
  effects: EffectData[] | undefined,
  cornerRadius: CornerRadius | undefined,
  opacity: number,
  lookup?: TokenLookup
): CSSStyles {
  return {
    ...generateBackgroundStyles(fills, lookup),
    ...generateBorderStyles(strokes, lookup),
    ...generateCornerRadiusStyles(cornerRadius, lookup),
    ...generateEffectStyles(effects),
    ...generateOpacityStyles(opacity),
  }
}
```

**Complete CSS output example:**

```css
/* A card component with all visual properties */
background-color: var(--color-neutral-100);
border: 1px solid var(--color-neutral-300);
border-radius: var(--radius-lg);
box-shadow: 0px 2px 8px 0px rgba(0, 0, 0, 0.08);
opacity: 0.95;
```

---

## Cross-References

- **`figma-api-rest.md`** — Node visual properties in the REST API response (`fills`, `strokes`, `effects`, `cornerRadius`, `opacity`, `blendMode`)
- **`figma-api-variables.md`** — Variables API for resolving variable bindings (`boundVariables`, variable collections, modes)
- **`design-to-code-layout.md`** — Companion module for layout (Auto Layout → Flexbox); visual and layout styles are generated independently and merged
- **`design-to-code-typography.md`** — Text-specific fill handling (styled segments, per-character colors)
- **`design-to-code-assets.md`** — Image asset resolution for IMAGE fills (export settings, deduplication, file naming), visual styles skipped for exported asset nodes
- **`design-to-code-semantic.md`** — Semantic tag selection that determines whether visual styles are applied (skipped for `<img>` tags from vector containers), gradient text rendering integration
- **`css-strategy.md`** — How visual CSS integrates with the layered CSS strategy (Tailwind + Custom Properties + CSS Modules). Property placement decision tree for visual properties (Layer 3).
- **`design-tokens.md`** — Token extraction and promotion rules for colors, shadows, and radii collected from visual properties. HSL-based semantic color naming. Token lookup integration during CSS generation.
