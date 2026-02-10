# Text Extraction & CSS Typography

## Purpose

Authoritative reference for extracting Figma text properties and generating accurate CSS typography. Encodes production-proven mapping rules covering the complete pipeline: extracting font families, weights, sizes, line heights, letter spacing, alignment, decoration, and text case from Figma TextNodes, handling mixed-style (rich text) segments with per-character styling and hyperlinks, and generating pixel-accurate CSS. This module covers everything needed to convert a Figma TEXT node into correct HTML and CSS.

## When to Use

Reference this module when you need to:

- Convert a Figma `fontFamily` to a CSS `font-family` with appropriate fallback stack
- Map Figma font style names ("Semi Bold", "Bold Italic") to numeric CSS `font-weight`
- Convert Figma line height (percentage or pixel) to unitless CSS `line-height` ratio
- Handle Figma `letterSpacing` in pixels and percentages
- Map Figma text alignment (horizontal and vertical) to CSS properties
- Convert `textDecoration` and `textCase` to CSS `text-decoration` and `text-transform`
- Map `textAutoResize` behavior to CSS wrapping and overflow properties
- Extract and render multi-style text (styled segments with different colors, weights, sizes)
- Handle hyperlinks within text segments (`<a href="...">`)
- Generate ordered and unordered list HTML from Figma list metadata
- Apply typography token lookup for CSS custom property substitution
- Generate Google Fonts URLs from collected font data
- Avoid common typography conversion pitfalls (line height %, "Regular" weight, mixed-style nodes)

---

## Content

### 1. Font Family Mapping

Figma stores the font family as a `fontFamily` string property on TextNode (e.g., `"Inter"`, `"Roboto Mono"`, `"SF Pro Display"`). This must be converted to a CSS `font-family` declaration with an appropriate fallback stack.

#### Extraction

```typescript
// From Figma TextNode
const fontFamily: string = textNode.fontName.family
// e.g., "Inter", "Roboto", "Fira Code", "Georgia"
```

When `fontName` is `figma.mixed` (the node has multiple fonts), extract the first character's font as the dominant family:

```typescript
let fontName: FontName
if (typeof textNode.fontName === 'symbol') {
  // Mixed fonts - use first character as dominant
  fontName = textNode.getRangeFontName(0, 1) as FontName
} else {
  fontName = textNode.fontName
}
```

#### CSS Generation

**Default (no token lookup):** Wrap in quotes and add a generic fallback:

```css
font-family: 'Inter', sans-serif;
font-family: 'Roboto Mono', monospace;
font-family: 'Georgia', serif;
```

**With token lookup:** If a font family token exists, use the CSS custom property:

```css
font-family: var(--font-primary);
font-family: var(--font-mono);
```

#### Fallback Stack Selection

| Font Category | Detection | Fallback |
|---------------|-----------|----------|
| Sans-serif | Default assumption | `sans-serif` |
| Monospace | Name contains "mono", "code", "consolas", "courier", "menlo", etc. | `monospace` |
| Serif | Name contains "serif", "georgia", "times", "garamond", "baskerville" | `serif` |

#### Monospace Font Detection

The following font name patterns indicate a monospace font:

```
mono, code, consolas, courier, fira code, jetbrains, menlo,
monaco, source code, ubuntu mono, sf mono, roboto mono, ibm plex mono
```

Detection is case-insensitive substring matching against the font family name.

#### System Fonts

System fonts are already available on the user's OS and should NOT be loaded from Google Fonts. Common system fonts:

```
Arial, Helvetica, Helvetica Neue, Times, Times New Roman, Georgia,
Verdana, Tahoma, Courier, Courier New, Lucida Console, Monaco,
Segoe UI, SF Pro, SF Pro Display, SF Pro Text, system-ui, -apple-system,
Optima, Futura, Avenir, Avenir Next, Gill Sans, Baskerville, Didot,
Consolas, Menlo, Palatino, Garamond, Century Gothic, Arial Black
```

#### Google Fonts URL Generation

For non-system fonts, generate a Google Fonts `<link>` URL:

```
https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Roboto+Mono:wght@400&display=swap
```

**Rules:**
- Group variants by family
- Include all used weights per family
- Append `italic` suffix for italic variants (e.g., `700italic`)
- Replace spaces with `+` in family names
- Always add `display=swap` for performance
- Exclude system fonts from the URL

---

### 2. Font Weight from Style String

Figma does not store font weight as a number. Instead, it uses a style name string (e.g., `"Regular"`, `"Bold"`, `"Semi Bold"`, `"Bold Italic"`). This must be parsed into a numeric CSS `font-weight`.

#### Weight Mapping Table

| Figma Style Name | CSS `font-weight` | Notes |
|------------------|-------------------|-------|
| `Thin` | `100` | Hairline weight |
| `ExtraLight` | `200` | Also "Ultra Light" |
| `Light` | `300` | |
| `Regular` | `400` | Default. **NOT** output as `font-weight: regular` |
| `Medium` | `500` | |
| `SemiBold` | `600` | Also "Semi Bold", "Demi Bold" |
| `Bold` | `700` | |
| `ExtraBold` | `800` | Also "Ultra Bold" |
| `Black` | `900` | Also "Heavy" |

#### Extraction Logic

The style-to-weight mapping uses substring matching to handle compound styles:

```typescript
function styleToWeight(style: string): number {
  const weightMap: Record<string, number> = {
    'Thin': 100,
    'ExtraLight': 200,
    'Light': 300,
    'Regular': 400,
    'Medium': 500,
    'SemiBold': 600,
    'Bold': 700,
    'ExtraBold': 800,
    'Black': 900,
  }

  // Handle compound styles like "Bold Italic"
  for (const [name, weight] of Object.entries(weightMap)) {
    if (style.includes(name)) return weight
  }
  return 400 // Default to regular
}
```

**Key behavior:** The loop checks in insertion order. "ExtraBold" is checked before "Bold", and "ExtraLight" before "Light", preventing false matches on compound names.

#### Italic Detection

Italic is detected separately from weight by checking if the style string contains "Italic":

```typescript
if (text.font.style.toLowerCase().includes('italic')) {
  styles.fontStyle = 'italic'
}
```

#### Combined Style Examples

| Figma Style | CSS Output |
|-------------|------------|
| `"Regular"` | `font-weight: 400;` |
| `"Bold"` | `font-weight: 700;` |
| `"Bold Italic"` | `font-weight: 700; font-style: italic;` |
| `"SemiBold Italic"` | `font-weight: 600; font-style: italic;` |
| `"Light"` | `font-weight: 300;` |
| `"Thin Italic"` | `font-weight: 100; font-style: italic;` |

#### Token Integration

With token lookup, weight maps to a CSS variable:

```css
/* Without tokens */
font-weight: 700;

/* With tokens */
font-weight: var(--font-bold);
```

Token names follow the pattern `--font-{weightName}`:

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

---

### 3. Font Size

Figma stores `fontSize` as a number in pixels (e.g., `16`, `24`, `48`).

#### Extraction

```typescript
let fontSize: number
if (typeof textNode.fontSize === 'symbol') {
  // Mixed sizes - use first character's size
  fontSize = textNode.getRangeFontSize(0, 1) as number
} else {
  fontSize = textNode.fontSize
}
```

#### CSS Generation

**Default:** Direct pixel output:

```css
font-size: 16px;
font-size: 24px;
```

**With token lookup:** Map to a CSS variable using a type scale:

```css
font-size: var(--text-base);   /* 16px */
font-size: var(--text-lg);     /* 18px */
font-size: var(--text-2xl);    /* 24px */
```

#### Type Scale Naming

Font size tokens use a T-shirt size scale centered on a "base" size (the collected size closest to 16px):

| Scale Name | Position Relative to Base |
|------------|--------------------------|
| `--text-xs` | base - 2 |
| `--text-sm` | base - 1 |
| `--text-base` | base (closest to 16px) |
| `--text-lg` | base + 1 |
| `--text-xl` | base + 2 |
| `--text-2xl` | base + 3 |
| `--text-3xl` | base + 4 |
| `--text-4xl` | base + 5 |
| `--text-5xl` | base + 6 |
| `--text-6xl` | base + 7 |

If a size falls outside the scale range, it uses `--text-{px}` (e.g., `--text-72`).

---

### 4. Line Height Conversion (Critical)

Line height is one of the most error-prone Figma-to-CSS conversions. Figma stores line height in multiple units, and all must be converted to **unitless CSS ratios** for correct scaling.

#### Figma Line Height Units

| Figma `lineHeight.unit` | Figma Value | Meaning |
|--------------------------|-------------|---------|
| `AUTO` | N/A | Browser default line height |
| `PERCENT` | e.g., `150` | 150% of font size |
| `PIXELS` | e.g., `24` | Fixed 24px line height |

#### Conversion Rules

```typescript
function getLineHeight(lineHeight: LineHeight | symbol, fontSize: number): number | 'auto' {
  if (typeof lineHeight === 'symbol') return 'auto'  // figma.mixed
  if (lineHeight.unit === 'AUTO') return 'auto'
  if (lineHeight.unit === 'PERCENT') {
    // Percentage → unitless ratio: 150% → 1.5
    return lineHeight.value / 100
  }
  // PIXELS → unitless ratio: 24px on 16px font → 1.5
  return lineHeight.value / fontSize
}
```

#### Critical: Percentage Means % of Font Size

In Figma, a line height of "150%" means **150% of the font size**, not 150% of some other dimension. A 16px font with 150% line height has a computed line height of 24px.

**Conversion formula:** `lineHeightPercentage / 100 = unitless ratio`

- 120% -> `line-height: 1.2`
- 150% -> `line-height: 1.5`
- 200% -> `line-height: 2`

#### Critical: Always Use Unitless Ratios in CSS

**Why unitless?** Unitless `line-height` scales correctly when `font-size` changes (e.g., responsive scaling, user zoom). Pixel or percentage `line-height` in CSS does NOT scale.

```css
/* CORRECT — unitless ratio, scales with font-size */
line-height: 1.50;

/* AVOID — fixed pixel value, does not scale */
line-height: 24px;

/* AVOID — percentage in CSS behaves differently than in Figma */
line-height: 150%;
```

#### CSS Generation

```typescript
if (text.lineHeight === 'auto') {
  styles.lineHeight = 'normal'
} else {
  styles.lineHeight = text.lineHeight.toFixed(2)
}
```

| Figma Line Height | Font Size | CSS Output |
|-------------------|-----------|------------|
| AUTO | any | `line-height: normal;` |
| 150% | 16px | `line-height: 1.50;` |
| 120% | 16px | `line-height: 1.20;` |
| 24px | 16px | `line-height: 1.50;` |
| 144px | 128px | `line-height: 1.13;` |

---

### 5. Letter Spacing

Figma stores `letterSpacing` with a unit (PIXELS or PERCENT) and a numeric value.

#### Extraction

```typescript
function getLetterSpacing(letterSpacing: LetterSpacing | symbol): number {
  if (typeof letterSpacing === 'symbol') return 0  // figma.mixed
  if (letterSpacing.unit === 'PERCENT') {
    // Percentage of font size - returned as raw value for CSS gen
    return letterSpacing.value
  }
  return letterSpacing.value  // PIXELS
}
```

#### CSS Generation

**Pixel values:** Output directly:

```css
letter-spacing: 0.5px;
letter-spacing: -0.2px;
```

**Percentage values:** Figma percentage letter spacing is relative to font size. In CSS, this maps to `em` units:

```css
/* Figma: 5% letter spacing on any font size */
letter-spacing: 0.05em;

/* Figma: -2% letter spacing */
letter-spacing: -0.02em;
```

**Zero or near-zero:** Omit the property entirely:

```typescript
if (text.letterSpacing !== 0) {
  styles.letterSpacing = `${text.letterSpacing}px`
}
```

---

### 6. Text Alignment

Figma text nodes have both horizontal and vertical alignment.

#### Horizontal Alignment

| Figma `textAlignHorizontal` | CSS `text-align` |
|-----------------------------|------------------|
| `LEFT` | `left` |
| `CENTER` | `center` |
| `RIGHT` | `right` |
| `JUSTIFIED` | `justify` |

Extraction maps directly to CSS-ready values:

```typescript
function mapHorizontalAlign(align: string): 'left' | 'center' | 'right' | 'justify' {
  const map: Record<string, string> = {
    'LEFT': 'left',
    'CENTER': 'center',
    'RIGHT': 'right',
    'JUSTIFIED': 'justify',
  }
  return map[align] || 'left'
}
```

#### Vertical Alignment

Figma text nodes support vertical alignment within their bounding box. This requires flexbox in CSS because `vertical-align` only works on inline/table elements.

| Figma `textAlignVertical` | CSS Output |
|---------------------------|------------|
| `TOP` | _(omit - default)_ |
| `CENTER` | `display: flex; align-items: center;` |
| `BOTTOM` | `display: flex; align-items: flex-end;` |

```typescript
if (text.align.vertical !== 'top') {
  styles.display = 'flex'
  styles.alignItems = text.align.vertical === 'center' ? 'center' : 'flex-end'
}
```

**Warning:** Adding `display: flex` to a text element for vertical alignment can conflict with the text's natural inline layout. This is an acceptable trade-off for fixed-dimension text boxes with vertical centering, but be aware of potential interaction with `text-align` (which still works on flex items via `justify-content` or `text-align` on the flex item's text content).

---

### 7. Text Decoration & Transform

#### Text Decoration

Figma uses `textDecoration` with values `NONE`, `UNDERLINE`, and `STRIKETHROUGH`.

| Figma `textDecoration` | CSS `text-decoration` |
|------------------------|-----------------------|
| `NONE` | _(omit)_ |
| `UNDERLINE` | `underline` |
| `STRIKETHROUGH` | `line-through` |

```typescript
if (text.decoration !== 'none') {
  styles.textDecoration = text.decoration === 'strikethrough'
    ? 'line-through'
    : text.decoration
}
```

**Note:** Figma's `STRIKETHROUGH` maps to CSS `line-through`, not `strikethrough`. This is a common mapping error.

When `textDecoration` is `figma.mixed` (the symbol type), default to `'none'`:

```typescript
function mapDecoration(decoration: string | symbol): 'none' | 'underline' | 'strikethrough' {
  if (typeof decoration === 'symbol') return 'none'  // figma.mixed
  const map = { 'NONE': 'none', 'UNDERLINE': 'underline', 'STRIKETHROUGH': 'strikethrough' }
  return map[decoration] || 'none'
}
```

#### Text Transform (Case)

Figma uses `textCase` with values `ORIGINAL`, `UPPER`, `LOWER`, and `TITLE`.

| Figma `textCase` | CSS `text-transform` |
|-------------------|---------------------|
| `ORIGINAL` | _(omit)_ |
| `UPPER` | `uppercase` |
| `LOWER` | `lowercase` |
| `TITLE` | `capitalize` |

```typescript
if (text.textCase !== 'none') {
  styles.textTransform = text.textCase
}
```

The extraction maps `ORIGINAL` to `'none'`, which is then omitted from CSS output.

---

### 8. Text Auto-Resize Behavior

Figma's `textAutoResize` property controls how a text node's bounding box responds to its content. This maps to CSS wrapping, overflow, and sizing behavior.

#### Mapping Table

| Figma `textAutoResize` | Behavior | CSS Output |
|-------------------------|----------|------------|
| `WIDTH_AND_HEIGHT` | Text box resizes both dimensions to fit content. Single line, no wrapping. | `white-space: nowrap;` |
| `HEIGHT` | Width is fixed, height grows to fit. Text wraps at fixed width. | _(default CSS behavior - no extra properties)_ |
| `NONE` | Both dimensions are fixed. Text may overflow or clip. | `overflow: hidden;` (may add `width` and `height`) |
| `TRUNCATE` | Fixed dimensions with ellipsis on overflow. | `overflow: hidden; text-overflow: ellipsis; white-space: nowrap;` |

#### CSS Generation

```typescript
// WIDTH_AND_HEIGHT: single-line text, no wrap
if (text.textAutoResize === 'WIDTH_AND_HEIGHT') {
  styles.whiteSpace = 'nowrap'
}

// TRUNCATE: ellipsis overflow
if (text.textAutoResize === 'TRUNCATE') {
  styles.overflow = 'hidden'
  styles.textOverflow = 'ellipsis'
  styles.whiteSpace = 'nowrap'
}

// NONE: fixed dimensions, clip overflow
if (text.textAutoResize === 'NONE') {
  styles.overflow = 'hidden'
}

// HEIGHT: default wrapping behavior, no extra CSS needed
```

#### Interaction with Layout Sizing

`textAutoResize` interacts with the parent Auto Layout's sizing modes:

- **WIDTH_AND_HEIGHT** in a FILL container: The `white-space: nowrap` prevents wrapping, but `flex-grow: 1` still allows the text to claim available space. The text will not wrap even if the container is narrower.
- **HEIGHT** in a FILL container: The text width fills the container and wraps normally. This is the most common scenario for body text.
- **TRUNCATE** in a fixed-width container: Ellipsis appears when text overflows the fixed width.

---

### 9. Styled Text Segments (Rich Text)

Figma supports per-character styling within a single TEXT node. A heading might have one word in bold and another in a different color. This is handled through **styled segments** -- ranges of characters with their own styling properties.

#### When Styled Segments Are Needed

Segment extraction is triggered when any of these conditions are true:

```typescript
const hasMixedFills = typeof textNode.fills === 'symbol'     // Different colors
const hasMixedFont = typeof textNode.fontName === 'symbol'   // Different fonts
const hasMixedSize = typeof textNode.fontSize === 'symbol'   // Different sizes
const hasMixedWeight = typeof textNode.fontWeight === 'symbol' // Different weights
const hasLinks = hasHyperlinks(textNode)                      // Hyperlinks present
```

If none of these conditions are true, the text node has uniform styling and styled segments are not extracted (the node-level properties are sufficient).

#### Extraction via getStyledTextSegments

Figma's `getStyledTextSegments` API returns segments with consistent styling:

```typescript
const segments = textNode.getStyledTextSegments([
  'fills',
  'fontName',
  'fontSize',
  'fontWeight',
  'letterSpacing',
  'lineHeight',
  'textDecoration',
  'textCase',
  'hyperlink',
])
```

Each segment contains:
- `start` / `end` -- character indices
- `characters` -- the text content
- `fills` -- array of paint fills for this segment
- `fontName` -- `{ family, style }` for this segment
- `fontSize` -- size for this segment
- `hyperlink` -- `{ type: 'URL' | 'NODE', value: string }` if linked

#### Intermediate Type

```typescript
interface StyledSegment {
  start: number
  end: number
  text: string
  fills?: Array<{ color: string; opacity?: number; variable?: VariableReference }>
  font?: {
    family: string
    style: string
    size: number
    weight: number
  }
  letterSpacing?: number
  lineHeight?: number | 'auto'
  decoration?: 'none' | 'underline' | 'strikethrough'
  textCase?: 'none' | 'uppercase' | 'lowercase' | 'capitalize'
  hyperlink?: HyperlinkData
}

interface HyperlinkData {
  type: 'URL' | 'NODE'
  value: string
}
```

#### HTML Generation for Styled Segments

Each segment becomes a `<span>` (or `<a>` for hyperlinks) with only the properties that differ from the base text style:

```html
<!-- Base style on parent element -->
<p class="hero__heading" style="font-family: 'Inter', sans-serif; font-size: 48px; font-weight: 700;">
  <!-- Segment with different color -->
  <span class="hero__heading__segment-1" style="color: #1A1A1A;">Build </span>
  <!-- Segment with different color and weight -->
  <span class="hero__heading__segment-2" style="color: #6366F1; font-weight: 800;">beautiful </span>
  <!-- Segment matching base - still wrapped for consistency -->
  <span class="hero__heading__segment-3" style="color: #1A1A1A;">interfaces</span>
</p>
```

#### Hyperlink Segments

When a segment has a hyperlink, it renders as an `<a>` tag instead of `<span>`:

```html
<p class="footer__text">
  <span class="footer__text__segment-1">Read our </span>
  <a class="footer__text__segment-2" href="https://example.com/privacy"
     target="_blank" rel="noopener noreferrer">privacy policy</a>
  <span class="footer__text__segment-3"> for details.</span>
</p>
```

**Nested anchor prevention:** If the text node itself is already rendered as an `<a>` tag (e.g., from semantic name detection like "link-with-icon"), hyperlink segments render as `<span>` instead of `<a>` to avoid invalid nested anchor elements.

#### Hyperlink Detection

```typescript
function hasHyperlinks(textNode: TextNode): boolean {
  // Uniform hyperlink (all text is linked)
  if (textNode.hyperlink && typeof textNode.hyperlink !== 'symbol') {
    return true
  }
  // Mixed hyperlinks (some ranges are linked)
  if (typeof textNode.hyperlink === 'symbol') {
    return true
  }
  return false
}
```

Hyperlinks can be of two types:
- `URL` -- external web link (`{ type: 'URL', value: 'https://...' }`)
- `NODE` -- internal Figma node link (`{ type: 'NODE', value: 'nodeId' }`) -- typically not converted to HTML href

#### Variable Binding on Segment Colors

Styled segments can have Figma Variables bound to their fill colors. The extraction resolves these asynchronously:

```typescript
const variable = await extractPaintVariableAsync(fill)
// Returns: { id: string, name: string, isLocal: boolean } | undefined
```

When a variable is present, the CSS uses `var()` instead of a raw hex value:

```css
/* Local variable */
color: var(--color-link-default);

/* External library variable (with fallback) */
color: var(--color-brand-primary, #6366F1);
```

---

### 10. List Styles

Figma text nodes can contain list formatting. The `listOptions` property on the text node indicates the list type.

#### Detection

```typescript
const listOptions = (textNode as any).listOptions
if (listOptions && typeof listOptions !== 'symbol') {
  if (listOptions.type === 'ORDERED') {
    textData.listStyle = 'ordered'
  } else if (listOptions.type === 'UNORDERED') {
    textData.listStyle = 'unordered'
  }
}
```

**Note:** `listOptions` may not be available in all Figma API contexts. The extraction wraps access in a try/catch.

#### HTML Generation

List text is split by newlines, and each line becomes a `<li>`:

```typescript
if (node.text.listStyle) {
  const lines = node.text.content.split(/\r?\n/).filter(line => line.trim())
  const listTag = node.text.listStyle === 'ordered' ? 'ol' : 'ul'

  const listItems = lines.map((line, index) => ({
    tag: 'li',
    className: `${className}__item-${index + 1}`,
    children: [line.trim()],
  }))

  // Wrap in list container
  children.push({
    tag: listTag,
    className: `${className}__list`,
    children: listItems,
  })
}
```

#### Generated HTML Examples

**Unordered list:**

```html
<div class="features__text">
  <ul class="features__text__list">
    <li class="features__text__item-1">Fast performance</li>
    <li class="features__text__item-2">Easy to use</li>
    <li class="features__text__item-3">Beautiful design</li>
  </ul>
</div>
```

**Ordered list:**

```html
<div class="steps__text">
  <ol class="steps__text__list">
    <li class="steps__text__item-1">Create your account</li>
    <li class="steps__text__item-2">Choose a template</li>
    <li class="steps__text__item-3">Publish your site</li>
  </ol>
</div>
```

---

### 11. Typography Token Integration

The typography token system collects font families, sizes, and weights from the entire extracted node tree and generates semantic CSS custom property names.

#### Token Collection

The `collectTypography` function traverses the ExtractedNode tree and collects:

- **Font families** -- unique family names with usage counts
- **Font sizes** -- unique pixel sizes with usage counts
- **Font weights** -- unique numeric weights with usage counts

```typescript
interface TypographyTokens {
  families: FontFamilyToken[]  // e.g., [{ name: '--font-primary', value: 'Inter', usageCount: 42 }]
  sizes: FontSizeToken[]      // e.g., [{ name: '--text-base', value: 16, usageCount: 28 }]
  weights: FontWeightToken[]  // e.g., [{ name: '--font-bold', value: 700, usageCount: 15 }]
}
```

#### Font Family Token Naming

Families are named based on their role:

| Role | Detection | Token Name |
|------|-----------|------------|
| Primary | Most-used font family | `--font-primary` |
| Monospace | Name matches monospace patterns | `--font-mono` |
| Secondary | Second font (first non-primary) | `--font-secondary` |
| Others | Remaining fonts by index | `--font-family-{n}` |

#### Font Size Token Naming

Sizes use the type scale (Section 3) with the "base" position anchored to the collected size closest to 16px.

**Example collected sizes:** `[12, 14, 16, 18, 24, 32, 48]`

| Size | Scale Position | Token Name |
|------|---------------|------------|
| 12px | base - 2 | `--text-xs` |
| 14px | base - 1 | `--text-sm` |
| 16px | base (closest to 16) | `--text-base` |
| 18px | base + 1 | `--text-lg` |
| 24px | base + 2 | `--text-xl` |
| 32px | base + 3 | `--text-2xl` |
| 48px | base + 4 | `--text-3xl` |

#### Font Weight Token Naming

Weights use standard CSS weight names:

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

#### Token Lookup During Generation

During CSS generation, raw values are checked against the token lookup map:

```typescript
// Font family lookup
styles.fontFamily = lookupFontFamily(lookup, text.font.family)
// Returns: var(--font-primary) if found, else 'Inter', sans-serif

// Font size lookup
styles.fontSize = lookupFontSize(lookup, text.font.size)
// Returns: var(--text-lg) if found, else '18px'

// Font weight lookup
styles.fontWeight = lookupFontWeight(lookup, text.font.weight)
// Returns: var(--font-bold) if found, else '700'
```

#### Generated CSS with Tokens

```css
/* Without tokens */
.heading {
  font-family: 'Inter', sans-serif;
  font-size: 32px;
  font-weight: 700;
  line-height: 1.25;
}

/* With tokens */
.heading {
  font-family: var(--font-primary);
  font-size: var(--text-2xl);
  font-weight: var(--font-bold);
  line-height: 1.25;
}
```

---

### 12. Common Pitfalls

#### Pitfall: Line Height Percentage Misinterpretation

**Problem:** Figma's 150% line height is treated as CSS `line-height: 150%` instead of `line-height: 1.5`.

**Rule:** Always convert Figma line height percentages to unitless ratios by dividing by 100. Figma's percentage means "% of font size", which is exactly what a unitless CSS `line-height` ratio represents. Never output `line-height: 150%` from Figma data.

```css
/* CORRECT */
line-height: 1.50;

/* WRONG */
line-height: 150%;
line-height: 24px;
```

#### Pitfall: "Regular" Is Not a CSS Font Weight

**Problem:** Outputting `font-weight: regular` instead of `font-weight: 400`.

**Rule:** The Figma style name "Regular" must be mapped to the numeric value `400`. CSS `font-weight` only accepts numbers (100-900) or keywords (`normal`, `bold`, `lighter`, `bolder`). The word "regular" is not valid CSS.

#### Pitfall: Mixed-Style Nodes Need Segment Extraction

**Problem:** Reading `textNode.fontName` on a node with mixed fonts returns `figma.mixed` (a Symbol), not a FontName object. Treating it as a string or object causes runtime errors.

**Rule:** Always check `typeof textNode.fontName === 'symbol'` before accessing `.family` or `.style`. When mixed, either:
1. Use `getRangeFontName(0, 1)` for the dominant style
2. Extract styled segments for per-character accuracy

The same applies to `fontSize`, `fills`, `fontWeight`, `letterSpacing`, `lineHeight`, `textDecoration`, and `textCase` -- all can be `figma.mixed`.

#### Pitfall: Vertical Alignment Requires Flex

**Problem:** Setting `vertical-align: middle` on a block-level text element (it only works on inline or table cells).

**Rule:** Figma's vertical text alignment (CENTER, BOTTOM) requires `display: flex` with `align-items` on the text element. This is the only reliable cross-browser approach for vertically aligning text within a fixed-height container.

```css
/* CORRECT - vertical center */
display: flex;
align-items: center;
text-align: left;

/* WRONG */
vertical-align: middle;
```

#### Pitfall: Flex on Text Conflicts with Inline Content

**Problem:** Adding `display: flex` for vertical alignment changes the text element from block/inline to flex container, which can affect how inline children (spans, links) are laid out.

**Rule:** When a text node has both vertical alignment (CENTER/BOTTOM) and styled segments, the flex container will lay out the `<span>` children as flex items. This is generally acceptable because text spans naturally flow inline-like within a flex container with `flex-wrap: wrap`, but test with long mixed-style text.

#### Pitfall: Strikethrough Mapping

**Problem:** Using CSS `text-decoration: strikethrough` (not valid CSS).

**Rule:** Figma's `STRIKETHROUGH` maps to CSS `text-decoration: line-through`. The extraction stores the intermediate value as `'strikethrough'` and the generation step converts it:

```typescript
styles.textDecoration = text.decoration === 'strikethrough' ? 'line-through' : text.decoration
```

#### Pitfall: Text Color Comes from Fills, Not a Color Property

**Problem:** Looking for a `color` property on Figma text nodes.

**Rule:** Figma text nodes use the `fills` array for their text color, the same way non-text nodes use fills for background color. For text nodes, the first SOLID fill becomes `color` (not `background-color`):

```typescript
if (node.text && node.fills && node.fills.length > 0) {
  const fill = node.fills[0]
  if (fill.type === 'SOLID') {
    styles.color = fill.color  // Text color, NOT background
  } else if (fill.type === 'GRADIENT') {
    // Gradient text uses background-clip technique
    styles.backgroundImage = gradientCSS
    styles.backgroundClip = 'text'
    styles.WebkitBackgroundClip = 'text'
    styles.color = 'transparent'
  }
}
```

#### Pitfall: Gradient Text Requires Special CSS

**Problem:** Applying a gradient fill to text as `background-color`.

**Rule:** Gradient text in CSS requires the `background-clip: text` technique:

```css
.gradient-text {
  background-image: linear-gradient(90deg, #6366F1 0%, #EC4899 100%);
  background-clip: text;
  -webkit-background-clip: text;
  color: transparent;
}
```

#### Edge Case: Paragraph Spacing

Figma's `paragraphSpacing` (space between paragraphs separated by newlines) does not have a direct CSS equivalent. When present and non-zero, it can be approximated with `margin-bottom` on paragraph elements or `padding-bottom` on line groups, but this requires splitting text at paragraph boundaries.

#### Edge Case: Single Segment Optimization

If `getStyledTextSegments` returns only one segment and there are no hyperlinks, the styled segments are discarded and the node-level properties are used instead. This avoids unnecessary `<span>` wrapping for uniformly-styled text.

---

### Intermediate Type Reference

The complete intermediate type used between extraction and generation:

```typescript
interface TextData {
  content: string
  font: {
    family: string   // e.g., "Inter"
    style: string    // e.g., "Bold Italic"
    size: number     // e.g., 16
    weight: number   // e.g., 700
  }
  align: {
    horizontal: 'left' | 'center' | 'right' | 'justify'
    vertical: 'top' | 'center' | 'bottom'
  }
  letterSpacing: number        // In pixels (0 = omit)
  lineHeight: number | 'auto'  // Unitless ratio or 'auto'
  paragraphSpacing: number     // Pixels between paragraphs
  decoration: 'none' | 'underline' | 'strikethrough'
  textCase: 'none' | 'uppercase' | 'lowercase' | 'capitalize'
  textAutoResize?: 'NONE' | 'WIDTH_AND_HEIGHT' | 'HEIGHT' | 'TRUNCATE'
  listStyle?: 'ordered' | 'unordered'
  styledSegments?: StyledSegment[]
}
```

---

## Cross-References

- **`figma-api-rest.md`** -- Node text properties in REST API response (`characters`, `style` object with font family/weight/size), text node type identification
- **`figma-api-plugin.md`** -- TextNode API, `fontName`, `fontSize`, `textAlignHorizontal/Vertical`, `textAutoResize`, `getStyledTextSegments()`, `getRangeFontName()`, `getRangeHyperlink()`, `hyperlink`, `listOptions`, `figma.mixed` handling
- **`figma-api-variables.md`** -- Variable resolution for text fill colors, `figma.variables.getVariableByIdAsync()`, `boundVariables` on SolidPaint fills, local vs external variable handling
- **`design-to-code-layout.md`** -- Parent Auto Layout context that determines text sizing behavior (FILL width, HUG height), flex container interaction with vertical text alignment
- **`design-to-code-visual.md`** -- Fill extraction patterns shared with text color extraction (SOLID, GRADIENT), RGB-to-hex conversion, opacity handling, variable binding resolution
- **`design-to-code-assets.md`** -- Asset detection on text nodes with image fills (image fill on text = background image, not image replacement)
- **`design-to-code-semantic.md`** -- Semantic HTML tag selection for text elements (h1-h6, p, span, a), heading hierarchy with single h1 rule, BEM class naming for text segments, interactive context preventing headings inside buttons/links
- **`css-strategy.md`** -- Typography tokens as CSS custom properties in the tokens layer (Layer 2), font-family in Tailwind config, property placement for typography properties (Layer 3).
- **`design-tokens.md`** -- Typography token extraction (font families, sizes, weights), type scale naming, token lookup during CSS generation, threshold-based promotion.
