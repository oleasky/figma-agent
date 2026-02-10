# Semantic HTML Generation & BEM Class Naming

## Purpose

Authoritative reference for generating semantic, accessible HTML from Figma design nodes. Encodes production-proven heuristics covering the complete pipeline: selecting the correct HTML element for each Figma node based on name, type, and context; generating BEM class names with flat hierarchy; adding ARIA attributes for accessibility; structuring the generated element tree; and integrating with the layered CSS strategy (Tailwind + CSS Custom Properties + CSS Modules). This module ties together layout, visual, typography, and asset extraction into production-quality HTML output.

## When to Use

Reference this module when you need to:

- Select the correct HTML tag for a Figma node (div, section, header, nav, button, h1-h6, p, img, etc.)
- Implement heading hierarchy rules (single h1, sequential levels, no headings inside interactive elements)
- Detect interactive elements (buttons, links, inputs, forms) from Figma layer names
- Map structural landmarks (header, nav, footer, main, aside, section, article) from layer names
- Generate BEM class names with flat hierarchy (never `block__element__sub`)
- Deduplicate class names within a component tree
- Add ARIA attributes for accessibility (aria-label, role, alt, aria-hidden)
- Build the GeneratedElement tree structure for HTML rendering
- Match elements across responsive breakpoint frames using BEM suffix matching
- Decide where CSS properties belong in the layered strategy (Tailwind vs Custom Properties vs Modules)
- Avoid common semantic HTML pitfalls (nested buttons, headings for size, deep BEM nesting)

---

## Content

### 1. Semantic Tag Selection Heuristics

The semantic tag selection system determines which HTML element each Figma node should render as. It uses a multi-factor approach combining node type, layer name pattern matching, font size, and tree context to produce semantically correct HTML.

#### SemanticContext Class

The `SemanticContext` class tracks state across the tree traversal to enforce structural rules:

```typescript
class SemanticContext {
  private h1Used: boolean = false
  private insideButton: boolean = false
  private insideLink: boolean = false
  private headingLevelStack: number[] = [0]

  canUseH1(): boolean { return !this.h1Used }
  useH1(): void { this.h1Used = true }

  enterInteractive(type: 'button' | 'link'): void
  exitInteractive(type: 'button' | 'link'): void
  isInsideInteractive(): boolean { return this.insideButton || this.insideLink }

  getNextHeadingLevel(): number {
    const current = this.headingLevelStack[this.headingLevelStack.length - 1]
    return Math.min(current + 1, 6)
  }

  reset(): void  // Reset for new tree generation
}
```

**Key responsibilities:**
- **Single h1 enforcement** -- tracks whether `<h1>` has been used in the current tree
- **Interactive context** -- tracks when traversal is inside a `<button>` or `<a>`, preventing headings inside interactive elements
- **Heading hierarchy** -- provides the next appropriate heading level based on context

#### Tag Selection Decision Tree

The overall tag selection follows this priority order:

```
getSemanticTag(node, context, isRoot, parentTag):

  1. VECTOR CONTAINER → 'img' (exported as SVG/PNG, render as image)
  2. ELLIPSE → 'div' (CSS-renderable circle/ellipse, not an image)
  3. VECTOR / BOOLEAN_OPERATION / STAR / POLYGON / LINE:
     ├─ Has asset export or imageHash → 'img'
     └─ Otherwise → 'div' (decorative shape)
  4. TEXT → getTextSemanticTag() (see Section 1.1)
  5. IMAGE FILL without children → 'img'
  6. BUTTON pattern (see Section 2) → 'button'
  7. LINK pattern → 'a'
  8. LANDMARK patterns (see Section 3) → 'header' | 'footer' | 'nav' | 'main' | 'aside'
  9. ARTICLE pattern → 'article'
  10. LIST pattern → 'ul'
  11. ROOT FRAME with section name → 'section'
  12. SECTION pattern → 'section'
  13. DEFAULT → 'div'
```

#### Supported Semantic Tags

```typescript
type SemanticTag =
  | 'div' | 'section' | 'article' | 'header' | 'footer' | 'nav'
  | 'main' | 'aside'
  | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p' | 'span'
  | 'button' | 'a' | 'img'
  | 'ul' | 'ol' | 'li'
```

#### Default Tag: `<div>`

The default tag for layout containers (FRAME, GROUP, COMPONENT, INSTANCE) is `<div>`. This keeps the generated HTML clean -- semantic tags are only used when there is positive evidence from the layer name, content, or context.

#### Name Pattern Matching

All name-based detection uses word-boundary matching, not substring matching. This prevents false positives like "Navigation" matching "nav" within a larger word:

```typescript
function matchesPattern(name: string, patterns: string[]): boolean {
  return patterns.some(pattern => {
    if (name === pattern) return true
    // Word boundary: start/end of string, spaces, hyphens, underscores, punctuation
    const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(
      `(?:^|[\\s\\-_()\\[\\]{}.,;:!?])${escaped}(?:[\\s\\-_()\\[\\]{}.,;:!?]|$)`,
      'i'
    )
    return regex.test(name)
  })
}
```

**Examples:**
- `"Primary Button"` matches `['button']` (word boundary at space)
- `"button-group"` matches `['button']` (word boundary at hyphen)
- `"Unbutton"` does NOT match `['button']` (no word boundary)
- `"nav-item"` matches `['nav']` AND `['item']` (both have word boundaries)

---

### 1.1 Heading Detection for Text Nodes

Text nodes use a multi-rule heading detection system that considers name, font size, and context:

```
getTextSemanticTag(node, context, parentTag):

  RULE 1: Inside interactive element (button/link)? → 'span' (NEVER heading)

  RULE 2: Explicit heading names from designer:
    "h1", "hero-title", "main-title", "page-title" → 'h1' (if available, else 'h2')
    "h2", "section-title", "section-heading"        → 'h2'
    "h3", "subsection-title", "card-title"           → 'h3'
    "h4", "item-title"                               → 'h4'
    "h5"                                             → 'h5'
    "h6"                                             → 'h6'

  RULE 3: Explicit paragraph/text names:
    "paragraph", "body", "description", "content",
    "text", "copy", "supporting"                     → 'p'

  RULE 4: Headline pattern with size-based level:
    "headline", "title" →
      fontSize >= 48 AND h1 available → 'h1'
      fontSize >= 32                  → 'h2'
      fontSize >= 24                  → 'h3'
      otherwise                       → 'h4'

  RULE 5: Subtitle pattern (never h1):
    "subtitle", "subheading", "tagline" →
      fontSize >= 24 → 'h2'
      otherwise      → 'h3'

  RULE 6: Size-based fallback with strict h1 control:
    fontSize >= 48 AND h1 available AND name matches heading pattern → 'h1'
    fontSize >= 32 AND name matches heading pattern                  → 'h2'
    fontSize >= 32 (no heading name)                                 → 'p'
    fontSize >= 16                                                   → 'p'

  DEFAULT: Small text (< 16px) → 'span'
```

#### Single h1 Rule

Only one `<h1>` is allowed per page or component tree. When h1 has already been used, nodes that would qualify for h1 fall back to `<h2>`:

```typescript
if (matchesPattern(name, ['h1', 'hero-title', 'main-title', 'page-title'])) {
  if (context.canUseH1()) {
    context.useH1()
    return 'h1'
  }
  return 'h2' // Fallback if h1 already used
}
```

#### Sequential Heading Hierarchy

Headings should be sequential: h1, then h2, then h3. Skipping levels (h1 then h3) creates accessibility issues for screen reader users who navigate by heading level. The `getNextHeadingLevel()` method on SemanticContext provides the appropriate next level based on the current context.

#### No Headings Inside Interactive Elements

Text inside `<button>` or `<a>` elements always renders as `<span>`, regardless of name or font size. Browser rendering of headings inside interactive elements is inconsistent and creates accessibility problems:

```typescript
if (context.isInsideInteractive() || parentTag === 'button' || parentTag === 'a') {
  return 'span'
}
```

---

### 2. Interactive Element Detection

Interactive elements are detected from layer names with exclusion rules to prevent false positives on layout containers.

#### Button Detection

| Pattern | Match Examples | Tag |
|---------|---------------|-----|
| `button`, `btn`, `cta` | "Primary Button", "btn-submit", "CTA" | `<button>` |

**Exclusion rules** -- a node matching button patterns is NOT a button if:

1. **It is a layout container**: name also matches `row`, `rows`, `container`, `wrapper`, `group`, `stack`, `grid`, `list`, `column`, `col`
2. **It has multiple children**: more than 1 direct child suggests a layout container holding multiple items
3. **It contains a button descendant**: a parent named "Button" that has a child also named "Button" -- the parent is the wrapper, the child is the actual button

```typescript
const isLayoutContainer = matchesPattern(name, [
  'row', 'rows', 'container', 'wrapper', 'group',
  'stack', 'grid', 'list', 'column', 'col'
])
const hasMultipleChildren = node.children && node.children.length > 1
const hasButtonDescendant = containsButtonDescendant(node)

if (matchesPattern(name, ['button', 'btn', 'cta'])
    && !isLayoutContainer
    && !hasMultipleChildren
    && !hasButtonDescendant) {
  context.enterInteractive('button')
  return 'button'
}
```

**Common pattern:** "Button Group" or "Button Row" is a layout container holding multiple buttons. The word "button" matches, but the layout container exclusion prevents it from becoming `<button>`.

#### Link Detection

| Pattern | Match Examples | Tag |
|---------|---------------|-----|
| `link`, `anchor` | "Footer Link", "anchor-text" | `<a>` |

Links always include `href`. When no URL is found in child text hyperlinks, use `#` as a placeholder:

```typescript
if (tag === 'a') {
  const hyperlink = findHyperlinkInTree(node)
  if (hyperlink && hyperlink.type === 'URL') {
    attributes.href = hyperlink.value
    attributes.target = '_blank'
    attributes.rel = 'noopener noreferrer'
  }
}
```

#### Input Detection (Future)

| Pattern | Match Examples | Tag |
|---------|---------------|-----|
| `input`, `field`, `text-field` | "Email Input", "Search Field" | `<input>` |
| `textarea` | "Message Textarea" | `<textarea>` |
| `form` | "Contact Form" | `<form>` |

> **Note:** Input and form detection are planned extensions. The current implementation focuses on button and link detection. Inputs in Figma designs are visual representations and require manual configuration of type, name, and validation attributes.

---

### 3. Structural Landmark Elements

Landmark elements provide page structure for screen readers and assistive technology. Detection is name-based with context awareness.

#### Landmark Detection Rules

| Patterns | Tag | Context Rule |
|----------|-----|-------------|
| `header`, `head`, `top-bar`, `topbar`, `navbar` | `<header>` | Only at root level (`isRoot === true`) |
| `footer`, `foot`, `bottom-bar`, `bottombar` | `<footer>` | Only at root level |
| `nav`, `navigation`, `menu` (NOT `item`) | `<nav>` | Any level; excludes "nav-item" |
| `main`, `content`, `body` | `<main>` | Only at root level |
| `aside`, `sidebar`, `side-panel` | `<aside>` | Any level |
| `section`, `hero`, `about`, `features`, `contact`, `pricing` | `<section>` | Root FRAME only |
| `article`, `post`, `blog-post`, `news-item` | `<article>` | Any level |

**Root-level restriction:** `<header>`, `<footer>`, and `<main>` are only applied at the root level of the exported tree. A nested frame named "header" inside a card component would not become `<header>` -- it would remain `<div>`.

**Nav exclusion:** Nodes with "item" in the name (like "nav-item") do not match `<nav>`. This prevents individual navigation links from becoming `<nav>` elements.

#### Section Usage

`<section>` is reserved for major page sections, not generic UI components:

```typescript
// Root frame with section-like name → section
if (isRoot && type === 'FRAME') {
  if (matchesPattern(name, ['section', 'hero', 'about', 'features', 'contact', 'pricing'])) {
    return 'section'
  }
  return 'div'
}

// Non-root section: only when explicitly named "section" and not a UI component
if (matchesPattern(name, ['section']) && !matchesPattern(name, ['button', 'btn', 'card', 'item'])) {
  return 'section'
}
```

---

### 4. Image & Media Elements

Image and media element selection coordinates with the asset detection module to render nodes as `<img>` or CSS `background-image`.

#### Vector Containers to `<img>`

Nodes identified as vector containers by the asset module render as `<img>` elements. Their children are baked into the exported SVG/PNG file:

```typescript
if (node.asset?.isVectorContainer) {
  return 'img'
}
```

The children array is set to empty for vector containers during traversal, so the `<img>` tag has no child elements.

#### Image Fills: Foreground vs Background

The rendering strategy depends on whether the node has children:

| Condition | Rendering | HTML |
|-----------|-----------|------|
| IMAGE fill, no children | `<img>` element | `<img src="..." alt="...">` |
| IMAGE fill, has children | CSS `background-image` on container | `<div style="background-image: url(...)">...children...</div>` |

```typescript
// Image fills without children are foreground images
if (node.asset?.imageHash && (!node.children || node.children.length === 0)) {
  return 'img'
}
```

#### Asset Attributes on `<img>` Tags

When a node renders as `<img>`, the asset map provides the `src` path, and the node name provides the `alt` text:

```typescript
if (tag === 'img' && node.asset && node.asset.exportAs && options.assetMap) {
  const filename = options.assetMap.get(node.id)
  if (filename) {
    attributes.src = `./assets/${filename}`
    attributes.alt = node.name || ''
  }
}
```

#### Decorative Shapes

ELLIPSE nodes and simple shapes (VECTOR, LINE without export settings) are decorative -- they render as `<div>` with CSS styling, not `<img>`:

```typescript
if (type === 'ELLIPSE') {
  return 'div'  // CSS border-radius: 50%, not an image
}
```

---

### 5. BEM Class Naming Convention

Generated class names follow a BEM (Block Element Modifier) convention with a strict flat hierarchy rule. The naming system sanitizes Figma layer names into valid CSS identifiers and deduplicates within a component tree.

#### BEM Structure

```
.block                  → Root component
.block__element         → Child within component
.block__element--mod    → Variation of element (future)
```

**Flat hierarchy rule:** Never nest deeper than `block__element`. This is enforced by always extracting the block from the first segment before `__`:

```typescript
function generateBEMClassName(
  nodeName: string,
  parentClassName: string | null,
  depth: number,
  prefix?: string
): string {
  const elementName = generateClassName(nodeName)

  // Root element - no parent
  if (!parentClassName || depth === 0) {
    if (prefix) return `${prefix}${elementName}`
    return elementName
  }

  // BEM element: block__element
  // Extract block from parent (FIRST part before __)
  const block = parentClassName.split('__')[0]
  return `${block}__${elementName}`
}
```

**Example hierarchy:**

```
Figma Layer Tree          BEM Class Output
─────────────────         ────────────────
Card                      .card
├── Header                .card__header
│   └── Title             .card__title       (NOT .card__header__title)
│       └── Subtitle      .card__subtitle    (NOT .card__header__title__subtitle)
├── Body                  .card__body
└── Footer                .card__footer
    └── Button            .card__button
```

#### Name Sanitization

```typescript
function generateClassName(name: string): string {
  let cleaned = name
    // Remove common Figma prefixes/suffixes
    .replace(/^(frame|group|component|instance|vector|text)\s*/i, '')
    .replace(/\s*(copy|duplicate|\d+)$/i, '')

  let sanitized = cleaned
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')   // Non-alphanumeric to hyphen
    .replace(/^-+|-+$/g, '')        // Trim hyphens
    .replace(/-+/g, '-')            // Collapse multiple hyphens

  // Truncate at 32 characters (word boundary if possible)
  if (sanitized.length > MAX_CLASS_NAME_LENGTH) {
    let truncated = sanitized.substring(0, MAX_CLASS_NAME_LENGTH)
    const lastHyphen = truncated.lastIndexOf('-')
    if (lastHyphen > MAX_CLASS_NAME_LENGTH / 2) {
      truncated = truncated.substring(0, lastHyphen)
    }
    sanitized = truncated.replace(/-+$/, '')
  }

  // Ensure doesn't start with number
  if (/^[0-9]/.test(sanitized)) {
    sanitized = 'el-' + sanitized
  }

  // Empty name fallback
  if (!sanitized) sanitized = 'element'

  return sanitized
}
```

**Sanitization examples:**

| Figma Layer Name | Generated Class |
|-----------------|----------------|
| `"Frame 123"` | `element` (prefix "Frame" removed, "123" suffix removed) |
| `"Primary Button"` | `primary-button` |
| `"hero__title"` | `hero-title` (double underscore collapsed) |
| `"Card / Header"` | `card-header` |
| `"A very long name that exceeds the limit"` | `a-very-long-name-that-exceeds` (truncated at word boundary) |
| `"123-items"` | `el-123-items` (prefixed to avoid leading digit) |

#### 32-Character Maximum

Class names are truncated to 32 characters. Truncation prefers word boundaries (hyphens) when the midpoint offers one:

```typescript
const MAX_CLASS_NAME_LENGTH = 32

if (sanitized.length > MAX_CLASS_NAME_LENGTH) {
  let truncated = sanitized.substring(0, MAX_CLASS_NAME_LENGTH)
  const lastHyphen = truncated.lastIndexOf('-')
  if (lastHyphen > MAX_CLASS_NAME_LENGTH / 2) {
    truncated = truncated.substring(0, lastHyphen)
  }
  sanitized = truncated.replace(/-+$/, '')
}
```

#### ClassNameTracker (Deduplication)

When multiple siblings share the same name (common with "Frame 1", "Frame 2" patterns), the tracker appends a numeric suffix:

```typescript
class ClassNameTracker {
  private used: Map<string, number> = new Map()

  getUnique(baseName: string): string {
    const count = this.used.get(baseName) || 0
    this.used.set(baseName, count + 1)
    if (count === 0) return baseName
    return `${baseName}-${count + 1}`
  }

  reset(): void { this.used.clear() }
}
```

| First occurrence | Second occurrence | Third occurrence |
|-----------------|-------------------|------------------|
| `.card__item` | `.card__item-2` | `.card__item-3` |

#### Optional Class Prefix

A prefix can be applied to root-level block names for namespace isolation:

```typescript
// With prefix 'fr-'
generateBEMClassName('card', null, 0, 'fr-')  // → 'fr-card'
generateBEMClassName('title', 'fr-card', 1)   // → 'fr-card__title'
```

---

### 6. ARIA Attributes

ARIA attributes ensure generated HTML is accessible to screen readers and assistive technologies. The following rules apply during element generation.

#### Buttons

| Scenario | Attributes |
|----------|-----------|
| Native `<button>` element | No extra `role` needed (implicit) |
| Non-button element acting as button | `role="button"`, `tabindex="0"` |
| Icon-only button | `aria-label="descriptive action"` (derived from layer name) |
| Button with visible text | No `aria-label` (text content is the label) |

**Icon-only button detection:** When a `<button>` has no text children -- only image or vector children -- it needs an `aria-label` derived from the layer name:

```html
<!-- Button with text: no aria-label needed -->
<button class="card__submit">Submit</button>

<!-- Icon-only button: needs aria-label -->
<button class="nav__menu-btn" aria-label="Open menu">
  <img class="nav__menu-icon" src="./assets/menu.svg" alt="">
</button>
```

#### Links

| Scenario | Attributes |
|----------|-----------|
| Link with URL from hyperlink data | `href="url"`, `target="_blank"`, `rel="noopener noreferrer"` |
| Link detected by name, no URL found | `href="#"` (placeholder) |

Links always need an `href` attribute. The generation searches the subtree for hyperlink data in text segments:

```typescript
if (tag === 'a') {
  const hyperlink = findHyperlinkInTree(node)
  if (hyperlink && hyperlink.type === 'URL') {
    attributes.href = hyperlink.value
    attributes.target = '_blank'
    attributes.rel = 'noopener noreferrer'
  }
}
```

#### Images

| Scenario | `alt` Attribute |
|----------|----------------|
| Content image (photo, illustration) | Descriptive text from layer name |
| Decorative image | `alt=""` (empty string, not omitted) |
| Icon inside interactive element | `alt=""` (the parent button/link provides the label) |

```typescript
if (tag === 'img' && node.asset && node.asset.exportAs) {
  attributes.alt = node.name || ''
}
```

#### Hidden Decorative Elements

Purely visual elements that provide no semantic meaning should be hidden from assistive technology:

```html
<!-- Decorative divider line -->
<div class="section__divider" aria-hidden="true"></div>

<!-- Background decoration -->
<div class="hero__bg-shape" aria-hidden="true"></div>
```

#### Landmark Roles

Native landmark elements do not need explicit ARIA roles:

| Element | Implicit ARIA Role | Explicit `role=` Needed? |
|---------|-------------------|------------------------|
| `<header>` | `banner` | No |
| `<nav>` | `navigation` | No |
| `<main>` | `main` | No |
| `<footer>` | `contentinfo` | No |
| `<aside>` | `complementary` | No |
| `<section>` | `region` (with `aria-label`) | No |

When a `<div>` is used for a landmark due to nesting constraints, add the explicit role:

```html
<!-- When <nav> can't be used (e.g., inside another nav) -->
<div role="navigation" aria-label="Footer links">...</div>
```

#### Live Regions

If content updates dynamically (notifications, status messages), add live region attributes:

```html
<div class="toast" role="alert" aria-live="polite">
  Message sent successfully
</div>
```

---

### 7. Generated Element Tree Structure

The output of semantic HTML generation is a tree of `GeneratedElement` objects ready for rendering as HTML strings or React JSX.

#### GeneratedElement Type

```typescript
interface GeneratedElement {
  tag: string                              // 'div', 'section', 'h1', 'button', etc.
  className: string                        // BEM class name
  styles: CSSStyles                        // CSS properties for this element
  children: (GeneratedElement | string)[]  // Child elements or text content
  attributes?: Record<string, string>      // href, src, alt, role, aria-*, data-*
  figmaId?: string                         // Original Figma node ID
}
```

#### Children Types

Children can be:
- **`GeneratedElement`** -- nested HTML elements
- **`string`** -- text content (leaf nodes)

```typescript
// Text node with styled segments
{
  tag: 'h1',
  className: 'hero__title',
  styles: { fontSize: '48px', fontWeight: '700' },
  children: [
    { tag: 'span', className: 'hero__title__segment-1', styles: { color: '#1A1A1A' }, children: ['Build '] },
    { tag: 'span', className: 'hero__title__segment-2', styles: { color: '#6366F1' }, children: ['beautiful '] },
    { tag: 'span', className: 'hero__title__segment-3', styles: { color: '#1A1A1A' }, children: ['interfaces'] },
  ]
}

// Simple text node
{
  tag: 'p',
  className: 'hero__description',
  styles: { fontSize: '18px' },
  children: ['Create stunning designs with ease.']
}
```

#### Attributes

The `attributes` record holds HTML attributes beyond `class` and `style`:

```typescript
// Image element
{ tag: 'img', attributes: { src: './assets/hero.png', alt: 'Hero image' } }

// Link element
{ tag: 'a', attributes: { href: 'https://example.com', target: '_blank', rel: 'noopener noreferrer' } }

// Button with ARIA
{ tag: 'button', attributes: { 'aria-label': 'Close dialog' } }
```

#### CSSStyles Interface

```typescript
interface CSSStyles {
  // Layout
  display?: string
  flexDirection?: string
  flexWrap?: string
  justifyContent?: string
  alignItems?: string
  alignContent?: string
  gap?: string
  rowGap?: string
  columnGap?: string
  padding?: string

  // Sizing
  width?: string
  height?: string
  minWidth?: string
  maxWidth?: string
  flexGrow?: string
  flexShrink?: string
  flexBasis?: string
  alignSelf?: string

  // Position
  position?: string
  top?: string
  left?: string
  zIndex?: string

  // Visual
  backgroundColor?: string
  backgroundImage?: string
  border?: string
  borderRadius?: string
  boxShadow?: string
  opacity?: string

  // Typography
  fontFamily?: string
  fontSize?: string
  fontWeight?: string
  lineHeight?: string
  color?: string

  [key: string]: string | undefined
}
```

#### Style Merging Order

Styles are merged from multiple generators in this order:

```typescript
const styles: CSSStyles = {}
Object.assign(styles, generateContainerStyles(node.layout))    // 1. Container position
Object.assign(styles, generateLayoutStyles(node.layout))        // 2. Flexbox layout
Object.assign(styles, generateLayoutChildStyles(node.layoutChild)) // 3. Child flex props
Object.assign(styles, generatePositionStyles(node.bounds))      // 4. Absolute positioning
Object.assign(styles, generateTypographyStyles(node.text))      // 5. Typography
Object.assign(styles, generateVisualStyles(node.fills, ...))    // 6. Visual properties
```

Later assignments override earlier ones if they share the same property key.

#### Full Generated Output

```typescript
interface GeneratedOutput {
  html: GeneratedElement     // Root element tree
  css: CSSRule[]             // Flattened CSS rules
  fonts: string[]            // Google Fonts URLs
  tokens?: DesignTokens      // Design token definitions
}
```

---

### 8. Responsive Class Considerations

When generating responsive CSS from multiple Figma frames representing breakpoints, class naming plays a critical role in matching elements across frames.

#### BEM Suffix Matching

Elements are matched across breakpoint frames using the BEM element suffix (everything after the block name):

```
Mobile frame:   .card---mobile           → suffix: ""        (root)
                .card---mobile__title    → suffix: "__title"
                .card---mobile__body     → suffix: "__body"

Desktop frame:  .card---desktop          → suffix: ""        (root)
                .card---desktop__title   → suffix: "__title"
                .card---desktop__body    → suffix: "__body"
```

After matching, selectors are remapped to a unified component class:
- `.card---mobile__title` and `.card---desktop__title` both become `.card__title`

#### Variant Component Class Mapping

When responsive variants exist as COMPONENT_SET children, the `componentClassMap` option overrides the BEM block for that subtree:

```typescript
interface GenerateElementOptions {
  componentClassMap?: Map<string, string>
  // e.g., Map { 'card' → 'card', 'hero' → 'hero' }
}
```

When a child node's base name (stripped of `#breakpoint` suffix) matches a key in the map, the child's subtree uses the component class as the BEM block instead of inheriting from the parent layout frame:

```typescript
if (depth > 0 && options.componentClassMap) {
  const parsed = parseBreakpointSuffix(node.name)
  const componentClass = options.componentClassMap.get(parsed.baseName.toLowerCase())
  if (componentClass) {
    className = componentClass
    effectiveParentClassName = componentClass
    // Fresh tracker for component subtree
    componentClassTracker = new ClassNameTracker()
  }
}
```

This ensures that identical components at different breakpoints produce the same class names (`.card__title`), enabling the responsive CSS diffing system to generate correct media query overrides.

#### Same Element, Different Breakpoints

The unified class name receives base styles from the smallest breakpoint and override styles in media query blocks:

```css
/* Base (mobile) */
.card__title {
  font-size: 18px;
  font-weight: 700;
}

/* Tablet override */
@media (min-width: 768px) {
  .card__title {
    font-size: 22px;
  }
}

/* Desktop override */
@media (min-width: 1024px) {
  .card__title {
    font-size: 28px;
  }
}
```

---

### 9. CSS Generation Integration (Layered Strategy)

The semantic module produces elements with styles. Those styles are distributed across three layers in the generated CSS.

#### Three-Layer Architecture

| Layer | Technology | What Goes Here | Specificity |
|-------|-----------|---------------|-------------|
| 1. Layout bones | Tailwind CSS classes | Flexbox, gap, padding, margin, sizing, positioning | Zero (utility classes) |
| 2. Design tokens | CSS Custom Properties | Colors, font sizes, spacing values, radii, shadows | Defined in `:root` |
| 3. Visual skin | CSS Modules | Component-specific backgrounds, borders, effects, overrides | Scoped to component |

#### Property Placement Decision Tree

```
For each CSS property on a GeneratedElement:

  IS IT A LAYOUT PROPERTY?
  (display, flex-direction, justify-content, align-items, gap,
   padding, margin, width, height, flex-grow, flex-basis, position)
    → Layer 1: Tailwind class

  IS THE VALUE A DESIGN TOKEN?
  (color resolves to var(--color-*), font-size to var(--text-*),
   spacing to var(--spacing-*), radius to var(--radius-*))
    → Layer 2: CSS Custom Property in the value

  IS IT A COMPONENT-SPECIFIC VISUAL STYLE?
  (background-color, background-image, border, border-radius,
   box-shadow, opacity, filter, specific color assignments)
    → Layer 3: CSS Module rule
```

#### Tailwind for Layout (Layer 1)

Layout properties map to Tailwind utilities:

| CSS Property | Tailwind Class | Example |
|-------------|---------------|---------|
| `display: flex` | `flex` | |
| `flex-direction: column` | `flex-col` | |
| `justify-content: center` | `justify-center` | |
| `align-items: center` | `items-center` | |
| `gap: 16px` | `gap-4` | |
| `padding: 24px` | `p-6` | |
| `flex-grow: 1; flex-basis: 0` | `flex-1` | |
| `width: 100%` | `w-full` | |
| `position: relative` | `relative` | |

#### CSS Custom Properties for Tokens (Layer 2)

Token values use CSS custom properties defined in a `tokens.css` file:

```css
/* tokens.css (generated from Figma Variables or value-based extraction) */
:root {
  --color-primary: #1a73e8;
  --color-neutral-800: #333333;
  --text-base: 16px;
  --text-lg: 18px;
  --spacing-md: 16px;
  --radius-md: 8px;
  --shadow-md: 0px 4px 12px rgba(0, 0, 0, 0.15);
}
```

Used in component styles:

```css
.card__title {
  color: var(--color-neutral-800);
  font-size: var(--text-lg);
}
```

#### CSS Modules for Visual Skin (Layer 3)

Component-specific visual styles live in CSS Module files, scoped to prevent leaking:

```css
/* Card.module.css */
.card {
  background-color: var(--color-neutral-100);
  border: 1px solid var(--color-neutral-300);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
}
```

#### When to Use Inline Styles

Inline styles on the `GeneratedElement.styles` object are used during the initial generation phase. They are later extracted into CSS rules (either Tailwind classes, token references, or CSS Module rules) during the CSS optimization phase. The `styles` object serves as the intermediate representation before final layer assignment.

---

### 10. Common Pitfalls

#### Pitfall: Using Heading Tags for Visual Size

**Problem:** A large font size (e.g., 48px) causes a node to be rendered as `<h1>`, even when the content is decorative text like a large number or price.

**Rule:** Headings represent document hierarchy, not visual size. The tag selection system requires BOTH large font size AND a heading-like name pattern to assign heading tags. Font size alone produces `<p>`:

```typescript
// 48px text named "Hero Price" → <p> (no heading pattern)
// 48px text named "Hero Title" → <h1> (heading pattern + large size)
```

#### Pitfall: "Button Group" Is a Layout Container

**Problem:** A frame named "Button Group" is detected as a `<button>` because the name contains "button".

**Rule:** The exclusion rules check for layout container patterns. "Button Group" matches both `['button']` and `['group']`. The layout container exclusion takes precedence, and the node renders as `<div>`.

#### Pitfall: Links Without href

**Problem:** An `<a>` element is generated without an `href` attribute, making it inaccessible to keyboard users and screen readers.

**Rule:** Every `<a>` element must have an `href`. The generation searches the subtree for hyperlink data. If no URL is found, use `href="#"` as a placeholder.

#### Pitfall: Redundant ARIA Roles

**Problem:** Adding `role="button"` to a native `<button>` element, or `role="navigation"` to `<nav>`.

**Rule:** Native HTML elements have implicit ARIA roles. Adding the same role explicitly is redundant and clutters the markup:

```html
<!-- WRONG: redundant role -->
<button role="button">Submit</button>
<nav role="navigation">...</nav>

<!-- CORRECT: implicit role is sufficient -->
<button>Submit</button>
<nav>...</nav>
```

#### Pitfall: Icon-Only Interactive Elements Without Labels

**Problem:** A button or link containing only an icon (SVG/image) with no visible text has no accessible name.

**Rule:** Icon-only interactive elements MUST have `aria-label`:

```html
<!-- WRONG: no accessible name -->
<button class="close-btn">
  <img src="./assets/x-icon.svg" alt="">
</button>

<!-- CORRECT: aria-label provides accessible name -->
<button class="close-btn" aria-label="Close">
  <img src="./assets/x-icon.svg" alt="">
</button>
```

#### Pitfall: Deep BEM Nesting

**Problem:** Class names like `.card__header__title__icon` that nest multiple BEM levels.

**Rule:** BEM elements are always flat. The block is extracted from the first part of the parent class, preventing accumulation:

```
.card__header           → block = "card"
.card__title            → block = "card" (extracted from "card__header", NOT "card__header__title")
.card__icon             → block = "card"
```

#### Pitfall: Nested Buttons (Invalid HTML)

**Problem:** A frame named "Button" contains a child also named "Button", producing `<button><button>...</button></button>` which is invalid HTML.

**Rule:** The `containsButtonDescendant()` check prevents a parent from becoming a button when its subtree already contains one:

```typescript
function containsButtonDescendant(node: ExtractedNode): boolean {
  if (!node.children || node.children.length === 0) return false
  for (const child of node.children) {
    const childName = child.name.toLowerCase()
    const isButton = matchesPattern(childName, ['button', 'btn', 'cta'])
    const isContainer = matchesPattern(childName, ['row', 'rows', 'container', ...])
    if (isButton && !isContainer) return true
    if (containsButtonDescendant(child)) return true
  }
  return false
}
```

#### Pitfall: Nested Anchors (Invalid HTML)

**Problem:** A text node inside an `<a>` tag has a hyperlink segment, producing nested `<a>` tags.

**Rule:** When generating styled text segments inside an anchor, hyperlink segments render as `<span>` instead of `<a>`:

```typescript
const isInsideAnchor = tag === 'a' || parentTag === 'a'
if (segment.hyperlink && segment.hyperlink.type === 'URL' && !isInsideAnchor) {
  return { tag: 'a', ... }  // Only when not nested
}
return { tag: 'span', ... }  // Fallback inside anchors
```

#### Pitfall: Section Overuse

**Problem:** Every frame in the design tree becomes `<section>`, drowning out the semantic meaning.

**Rule:** `<section>` is reserved for explicitly named page sections. Generic frames default to `<div>`. Only root frames matching section-like patterns (`hero`, `about`, `features`, `contact`, `pricing`) or explicitly named "section" qualify.

---

### Intermediate Type Reference

The complete types used between extraction and semantic HTML generation:

```typescript
interface ExtractedNode {
  id: string
  name: string
  type: string                    // 'FRAME' | 'TEXT' | 'VECTOR' | etc.
  bounds: { x: number; y: number; width: number; height: number }
  opacity: number
  visible: boolean
  layout?: LayoutProperties       // Auto Layout data (from layout module)
  layoutChild?: LayoutChildProperties
  fills?: FillData[]              // Visual fills (from visual module)
  strokes?: StrokeData[]
  effects?: EffectData[]
  cornerRadius?: CornerRadius
  text?: TextData                 // Text properties (from typography module)
  asset?: AssetData               // Asset metadata (from assets module)
  children?: ExtractedNode[]
}

// Output: GeneratedElement tree (Section 7)
// Input to CSS flattening, HTML rendering, or React JSX generation
```

---

## Cross-References

- **`figma-api-plugin.md`** -- SceneNode types used in tag selection (FrameNode, TextNode, GroupNode, VectorNode, BooleanOperationNode, EllipseNode), `visible` property for filtering, `children` access for traversal, `fontName` and `fontSize` for heading detection
- **`figma-api-rest.md`** -- Node tree structure for understanding parent-child relationships in the design hierarchy, `absoluteBoundingBox` for bounds used in icon size detection
- **`figma-api-variables.md`** -- Variable resolution for text fill colors in styled segments, variable bindings that flow through to CSS custom property references in the layered strategy
- **`design-to-code-layout.md`** -- Auto Layout properties that determine container behavior, sizing modes (FIXED, HUG, FILL) that interact with element dimensions, responsive multi-frame pattern and BEM suffix matching for breakpoint CSS
- **`design-to-code-visual.md`** -- Fill extraction for text colors, gradient text CSS technique (`background-clip: text`), visual styles that are skipped for exported asset nodes, opacity handling (node-level vs fill-level)
- **`design-to-code-typography.md`** -- TextData properties (font size, family, weight, styled segments, hyperlinks, list styles) used in heading detection, segment rendering, and list HTML generation
- **`design-to-code-assets.md`** -- Vector container detection that triggers `<img>` tag selection, image fill handling (foreground vs background), asset map for `src` attribute resolution, icon detection heuristic
- **`css-strategy.md`** -- Three-layer CSS architecture (Tailwind + Custom Properties + CSS Modules) that consumes the generated styles, property placement decision tree, BEM class names as selectors in Layer 3 CSS Modules.
- **`design-tokens.md`** -- Token lookup system for CSS variable substitution in generated styles, semantic color naming, type scale naming, threshold-based promotion.
- **`payload-figma-mapping.md`** -- Figma component to PayloadCMS block mapping. The semantic HTML elements chosen by this module (section, article, nav, aside) map to the Container block's `htmlTag` field. Block type identification rules use the same semantic heuristics (heading hierarchy, landmark roles) documented here.
