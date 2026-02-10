# Figma to PayloadCMS Mapping

## Purpose

Authoritative reference for mapping Figma design components to PayloadCMS block structures. Documents the complete pipeline from Figma component identification through property-to-field mapping, container nesting rules, design token bridging, variant mapping, rich text extraction, and media asset handling. This module bridges the design-to-code knowledge (layout, visual, typography, assets, semantic) with the CMS block system (payload-blocks.md) to produce actionable, deterministic mapping rules.

## When to Use

Reference this module when you need to:

- Convert a Figma page design into a PayloadCMS page block tree
- Determine which Figma component maps to which PayloadCMS block type
- Map Figma component properties (variants, text, booleans, instance swaps) to block field values
- Translate Figma Auto Layout nesting into Container block nesting
- Extract Figma design tokens and bridge them to the `--token-*` CSS custom properties consumed by blocks
- Map Figma component variants to block type variants (e.g., Hero impact levels)
- Convert Figma text content into Lexical rich text editor format
- Build a Figma-to-PayloadCMS importer plugin or automation
- Understand the mapping rules that power the `/figma:map-payload-block` skill

---

## Content

### 1. Mapping Architecture Overview

The Figma-to-PayloadCMS mapping pipeline transforms a Figma page design into a structured block tree that PayloadCMS can store and render.

#### Pipeline Stages

```
Figma Page
    |
    v
[1. Extract] ─────────── Figma REST API / Plugin API
    |                     Read node tree, properties, styles
    v
[2. Identify] ────────── Component-to-Block Type Mapping (Section 2)
    |                     Determine which block type each component becomes
    v
[3. Map Properties] ──── Property-to-Field Mapping (Sections 3-7)
    |                     Convert Figma properties to PayloadCMS field values
    v
[4. Structure] ────────── Container Nesting Rules (Section 4)
    |                     Build the block hierarchy from Auto Layout nesting
    v
[5. Extract Content] ─── Rich Text + Media (Sections 8-9)
    |                     Convert text to Lexical, images to Media collection
    v
[6. Bridge Tokens] ────── Design Token Bridge (Section 5)
    |                     Map Figma variables/styles to --token-* properties
    v
[7. Output] ──────────── PayloadCMS Block Tree
                          JSON structure ready for Pages.layout.blocks
```

#### Data Flow Example

A Figma frame named "Hero Section" with:
- Background image fill
- Overlay rectangle
- Heading text node ("Welcome to Our Platform")
- Body text node ("We help teams build faster")
- Two button instances ("Get Started", "Learn More")

Maps to this PayloadCMS block:

```json
{
  "blockType": "hero",
  "content": {
    "richText": { "root": { "children": [...] } },
    "buttonGroup": [
      { "link": { "type": "custom", "url": "#", "label": "Get Started" } },
      { "link": { "type": "custom", "url": "#", "label": "Learn More" } }
    ]
  },
  "image": { "image": "<media-id>" },
  "settings": {
    "type": "highImpact",
    "className": "",
    "layoutMeta": { "marginTop": "mt-0", "marginBottom": "mb-0" }
  }
}
```

---

### 2. Component-to-Block Type Mapping

Given a Figma node, the following decision tree determines which PayloadCMS block type it maps to. Rules are evaluated in priority order -- the first matching rule wins.

#### Decision Tree

```
Input: Figma SceneNode
    |
    ├─ Is it a COMPONENT_SET or COMPONENT with variant properties?
    |   ├─ YES: Check component name and structure against block patterns
    |   └─ NO: Analyze frame structure heuristically
    |
    v
[Rule 1] Hero Detection (confidence: 0.9)
    Match IF:
    - Frame/component name contains "hero" (case-insensitive) OR
    - Frame is full-width (width >= parent width) AND has:
      - Background image fill OR background color fill
      - At least one large text node (fontSize >= 28px)
      - At least one button-like child
    Block: hero
    |
    v
[Rule 2] Card Detection (confidence: 0.85)
    Match IF:
    - Frame/component name contains "card" (case-insensitive) OR
    - Frame has ALL of:
      - Bounded width (not full-width, typically 200-500px)
      - Image child (image fill or image frame)
      - Text content (heading + body text)
      - Optional CTA/button child
      - Border radius > 0 OR box-shadow
    Block: card
    |
    v
[Rule 3] Button Detection (confidence: 0.95)
    Match IF:
    - Frame/component name contains "button" or "btn" (case-insensitive) OR
    - Frame has ALL of:
      - Small dimensions (height < 60px, width < 300px)
      - Background fill (solid color)
      - Single text child (short label text, < 30 characters)
      - Border radius > 0
      - No image children
    Block: button
    |
    v
[Rule 4] Navigation Detection (confidence: 0.85)
    Match IF:
    - Frame/component name contains "nav", "navigation", "menu" (case-insensitive) OR
    - Frame has:
      - Horizontal Auto Layout
      - Multiple small text/link children (3-8 items)
      - No image children
      - Compact height (< 80px)
    Block: subnavigation
    |
    v
[Rule 5] Accordion Detection (confidence: 0.8)
    Match IF:
    - Frame/component name contains "accordion", "collapse", "expand" OR
    - Frame has:
      - Vertical Auto Layout
      - Repeating child pattern: header row + content area
      - Toggle icon (chevron, plus/minus) in header
    Block: accordion
    |
    v
[Rule 6] Tabs Detection (confidence: 0.8)
    Match IF:
    - Frame/component name contains "tab" (case-insensitive) OR
    - Frame has:
      - Tab bar (horizontal row of text labels with active/inactive states)
      - Content panel below tab bar
      - Component variants for active tab state
    Block: tabs
    |
    v
[Rule 7] Stats/Metric Detection (confidence: 0.85)
    Match IF:
    - Frame/component name contains "stat", "metric", "number" OR
    - Frame has:
      - Large prominent text (fontSize >= 32px, often numeric)
      - Smaller label text below
      - Optional description and source text
      - Compact, card-like dimensions
    Block: stats
    |
    v
[Rule 8] Testimonial Detection (confidence: 0.85)
    Match IF:
    - Frame/component name contains "testimonial", "quote", "review" OR
    - Frame has:
      - Quote icon or quotation marks
      - Body text (italic or quoted)
      - Author name and title text
      - Optional avatar image (small, circular)
    Block: testimonial
    |
    v
[Rule 9] Carousel/Slider Detection (confidence: 0.8)
    Match IF:
    - Frame/component name contains "carousel", "slider", "swiper" OR
    - Frame has:
      - Horizontal overflow (clipContent: true, children extend beyond bounds)
      - Navigation dots or arrows
      - Multiple card-like children at same size
    Block: carousel
    |
    v
[Rule 10] CallToAction Detection (confidence: 0.8)
    Match IF:
    - Frame/component name contains "cta", "callToAction", "banner" OR
    - Frame has:
      - Full-width or near-full-width
      - Strong background color (not white/neutral)
      - Title text + description
      - Optional image on one side
      - No nested complex blocks
    Block: callToAction
    |
    v
[Rule 11] Media/Image Detection (confidence: 0.9)
    Match IF:
    - Node is an image fill frame with no text children OR
    - Frame/component name contains "image", "photo", "illustration" OR
    - Frame has:
      - Single image fill or single image child
      - No text content
      - No interactive children
    Block: media
    |
    v
[Rule 12] Video Detection (confidence: 0.85)
    Match IF:
    - Frame/component name contains "video", "player", "embed" OR
    - Frame has:
      - Play button icon overlay
      - 16:9 or similar video aspect ratio
      - Thumbnail image with play indicator
    Block: video
    |
    v
[Rule 13] Form Detection (confidence: 0.85)
    Match IF:
    - Frame/component name contains "form", "input", "signup" OR
    - Frame has:
      - Multiple input field components
      - Submit button
      - Label + input pairs
    Block: form
    |
    v
[Rule 14] RichText Fallback (confidence: 0.7)
    Match IF:
    - Frame contains primarily text content OR
    - Node is a TEXT type with multiple styled segments OR
    - Frame has only text children (no images, no interactive elements)
    Block: richText
    |
    v
[Rule 15] Container Fallback (confidence: 0.6)
    Match IF:
    - Frame has Auto Layout AND contains multiple children that
      individually match other block types
    - This is the "structural wrapper" -- it groups children
    Block: container
```

#### Confidence Scores

Each rule has a confidence score (0.0-1.0) that indicates how reliably the heuristic identifies the correct block type. When implementing automated mapping:

- **0.9+** -- High confidence, auto-map without confirmation
- **0.8-0.89** -- Good confidence, auto-map with optional review flag
- **0.7-0.79** -- Moderate confidence, flag for human review
- **Below 0.7** -- Low confidence, require human selection

#### Name-Based vs Structure-Based Detection

The decision tree uses two complementary strategies:

1. **Name-based** (higher priority) -- If the Figma component or frame name contains a recognizable keyword (hero, card, button, etc.), that provides strong signal. Designers who name their components well make mapping trivial.

2. **Structure-based** (fallback) -- When names are generic (e.g., "Frame 427"), analyze the node's children, properties, and layout structure to infer the block type. This is less reliable but handles unnamed designs.

Always check name-based rules first, then fall back to structural analysis.

---

### 3. Property-to-Field Mapping Tables

For each block type, these tables define how Figma properties map to PayloadCMS field values.

#### Container Mapping

The Container block is the most direct mapping from Figma Auto Layout.

| Figma Property | PayloadCMS Field | Mapping Rule |
|---------------|-----------------|--------------|
| `layoutMode: HORIZONTAL` | `settings.layout` = `'row'` | Direct |
| `layoutMode: VERTICAL` | `settings.layout` = `'col'` | Direct |
| `layoutMode: NONE` + grid-like children | `settings.layout` = `'grid'` | Inferred |
| `primaryAxisAlignItems: MIN` | `settings.justifyContent` = `'justify-start'` | Direct |
| `primaryAxisAlignItems: CENTER` | `settings.justifyContent` = `'justify-center'` | Direct |
| `primaryAxisAlignItems: MAX` | `settings.justifyContent` = `'justify-end'` | Direct |
| `primaryAxisAlignItems: SPACE_BETWEEN` | `settings.justifyContent` = `'justify-between'` | Direct |
| `counterAxisAlignItems: MIN` | `settings.alignItems` = `'items-start'` | Direct |
| `counterAxisAlignItems: CENTER` | `settings.alignItems` = `'items-center'` | Direct |
| `counterAxisAlignItems: MAX` | `settings.alignItems` = `'items-end'` | Direct |
| `counterAxisAlignItems: BASELINE` | `settings.alignItems` = `'items-baseline'` | Direct |
| `itemSpacing` | `settings.gap` | Snap to nearest option (see below) |
| Frame name containing "section" | `settings.htmlTag` = `'section'` | Name heuristic |
| Frame name containing "nav" | `settings.htmlTag` = `'nav'` or `'header'` | Name heuristic |
| Frame name containing "footer" | `settings.htmlTag` = `'footer'` | Name heuristic |
| Frame name containing "aside" | `settings.htmlTag` = `'aside'` | Name heuristic |
| Frame width = parent width | `settings.width` = `'full'` | Size analysis |
| Frame maxWidth ~1400px | `settings.width` = `'wide'` | Size analysis |
| Frame maxWidth ~800px | `settings.width` = `'narrow'` | Size analysis |
| `paddingTop` | `settings.layoutMeta.paddingTop` | Snap to nearest |
| `paddingBottom` | `settings.layoutMeta.paddingBottom` | Snap to nearest |

**Gap snapping rule:** Map Figma `itemSpacing` to the nearest gap option:

| Figma itemSpacing (px) | PayloadCMS gap |
|------------------------|---------------|
| 0 | `gap-0` |
| 1-3 | `gap-1` |
| 4-6 | `gap-2` |
| 7-12 | `gap-4` |
| 13-20 | `gap-6` |
| 21-28 | `gap-8` |
| 29-40 | `gap-12` |
| 41+ | `gap-16` |

**Spacing snapping rule:** Map Figma padding/margin values to LayoutMeta options:

| Figma value (px) | PayloadCMS value |
|------------------|-----------------|
| 0 | `{prefix}-0` |
| 1-6 | `{prefix}-2` (XS) |
| 7-12 | `{prefix}-4` (SM) |
| 13-20 | `{prefix}-6` (MD) |
| 21-28 | `{prefix}-8` (LG) |
| 29-40 | `{prefix}-12` (XL) |
| 41+ | `{prefix}-16` (2XL) |

Where `{prefix}` is `mt`, `mb`, `pt`, or `pb`.

#### Hero Mapping

| Figma Property | PayloadCMS Field | Mapping Rule |
|---------------|-----------------|--------------|
| Large heading text node | `content.richText` | Extract as Lexical heading |
| Body text node | `content.richText` | Extract as Lexical paragraph |
| Button instances | `content.buttonGroup[]` | Map each to linkGroup item |
| Background image fill | `image.image` | Export and upload to Media |
| Component variant "impact" = "high" | `settings.type` = `'highImpact'` | Variant mapping |
| Component variant "impact" = "medium" | `settings.type` = `'mediumImpact'` | Variant mapping |
| Component variant "impact" = "low" | `settings.type` = `'lowImpact'` | Variant mapping |
| Frame height >= 400px | `settings.type` = `'highImpact'` | Size heuristic |
| Frame height 250-399px | `settings.type` = `'mediumImpact'` | Size heuristic |
| Frame height < 250px | `settings.type` = `'lowImpact'` | Size heuristic |

#### Card Mapping

| Figma Property | PayloadCMS Field | Mapping Rule |
|---------------|-----------------|--------------|
| Text content (heading + body) | `content.richText` | Extract as Lexical |
| Image child/fill | `image.image` | Export and upload |
| Button/CTA child text | `cta.label` | Extract text |
| Button links to page | `cta.ctaAction` = `'internal'`, `cta.internalLink` | If detectable |
| Button links to URL | `cta.ctaAction` = `'external'`, `cta.externalLink` | If detectable |
| CTA wraps entire card | `cta.layout` = `'wrap-all'` | If entire card is clickable |
| CTA wraps text area only | `cta.layout` = `'wrap-text-description'` | Default |

#### Button Mapping

| Figma Property | PayloadCMS Field | Mapping Rule |
|---------------|-----------------|--------------|
| Button text | `cta.label` | Extract text content |
| Links to internal page | `cta.type` = `'link'`, `cta.link.linkType` = `'internal'` | If detectable |
| Links to external URL | `cta.type` = `'link'`, `cta.link.linkType` = `'external'` | If URL present |
| Opens modal (no link) | `cta.type` = `'button'`, `cta.action.actionType` = `'modal'` | If no navigation |
| Scrolls to section | `cta.type` = `'button'`, `cta.action.actionType` = `'scroll'` | If anchor link |

#### Stats Mapping

| Figma Property | PayloadCMS Field | Mapping Rule |
|---------------|-----------------|--------------|
| Large number/metric text | `content.emphasis` | Extract text (largest font size) |
| Title text | `content.title` | Extract text (second largest) |
| Description text | `content.richText` | Extract as Lexical paragraph |
| Source/citation text | `content.source` | Extract text (smallest font size, often italic) |

#### Testimonial Mapping

| Figma Property | PayloadCMS Field | Mapping Rule |
|---------------|-----------------|--------------|
| Quote text (italic/body) | `content.richText` | Extract as Lexical |
| Author name text | `content.author` | Extract text (bold, below quote) |
| Author title/role text | `content.authorDescription` | Extract text (below author name) |
| Avatar image (small, circular) | `image.image` | Export and upload |

---

### 4. Container Nesting Rules

Figma designs naturally have deeply nested Auto Layout frames. PayloadCMS has a maximum nesting depth of 2 for Container blocks. These rules determine when to nest and when to flatten.

#### Nesting Decision Tree

```
For each Auto Layout frame in the Figma hierarchy:

  1. IS IT THE TOP-LEVEL PAGE FRAME?
       YES → Its children become root layout.blocks entries
       (Do not create a Container for the page frame itself)

  2. DOES IT CONTAIN ONLY ONE CHILD THAT MAPS TO A BLOCK?
       YES → Flatten: emit the child block directly, skip the wrapper
       Rationale: A Container with one child adds no structural value

  3. DOES IT CONTAIN MULTIPLE CHILDREN OF MIXED TYPES?
       YES → Create a Container block
       - Set layout/alignment/gap from the frame's Auto Layout props
       - Recursively map children as the Container's blocks
       Rationale: This is the primary use case for Container

  4. DOES IT CONTAIN CHILDREN THAT ARE ALL THE SAME TYPE?
       YES → Consider alternatives:
       - All Cards → Container(row) with Card children
       - All Stats → Container(row) with Stats children
       - All items with images → Carousel (if horizontal scroll pattern)
       Rationale: Homogeneous children often indicate a gallery or grid

  5. IS THE NESTING DEPTH > 2?
       YES → Flatten intermediate wrappers
       - Keep the outermost Container and the innermost content blocks
       - Collapse intermediate Auto Layout frames by merging their
         layout properties into the nearest preserved Container
       Rationale: PayloadCMS supports Container > NestedContainer (depth 2)
         but not deeper nesting
```

#### Flattening Strategy

When Figma has 3+ levels of nesting:

```
Figma:
  Frame A (vertical, padding 32px)
    Frame B (horizontal, gap 24px)
      Frame C (vertical, gap 16px)
        Text "Hello"
        Text "World"
      Frame D (vertical, gap 16px)
        Image
        Text "Caption"

PayloadCMS (flattened):
  Container (layout: row, gap: gap-6, paddingTop: pt-8, paddingBottom: pb-8)
    Container (layout: col, gap: gap-4)
      RichText ("Hello\nWorld")
    Container (layout: col, gap: gap-4)
      Media (image)
      RichText ("Caption")
```

Frame A and Frame B are merged: A's padding becomes LayoutMeta on the outer Container, B's row layout and gap become the outer Container's settings. Frame C and Frame D each become NestedContainers.

#### When to Flatten vs Preserve

| Scenario | Action | Reason |
|----------|--------|--------|
| Single child in Auto Layout wrapper | Flatten | No structural purpose |
| Two levels of nesting | Preserve both | Within PayloadCMS limit |
| Three+ levels of nesting | Merge intermediate levels | Exceeds Container depth limit |
| Auto Layout frame with only padding (no layout purpose) | Apply padding as LayoutMeta to child | Wrapper adds only spacing |
| Frame groups items for alignment only | Preserve if it changes layout direction | Container settings carry alignment |

#### Group Detection

When multiple sibling elements share a common structural container in Figma but would be top-level blocks in PayloadCMS, detect the grouping pattern:

```
Figma: Section frame (vertical)
  ├── Heading text
  ├── Description text
  └── Cards row (horizontal)
       ├── Card 1
       ├── Card 2
       └── Card 3

PayloadCMS:
  Container (layout: col)
    ├── RichText (heading + description)
    └── Container (layout: row)
         ├── Card 1
         ├── Card 2
         └── Card 3
```

The "Cards row" frame becomes a nested Container because it changes the layout direction from the parent's column to row.

---

### 5. Design Token Bridge

Figma design tokens flow into PayloadCMS blocks through the `tokens.css` file. This section defines the extraction and mapping rules.

#### Token Flow Pipeline

```
Figma Variables / Styles
    |
    v
[Extract] ──── Figma REST API (GET /v1/files/:key/variables)
    |            or Plugin API (figma.variables.getLocalVariables())
    v
[Name] ─────── Apply --token-{category}-{name} naming
    |            See design-tokens.md for naming algorithm
    v
[Render] ────── Generate tokens.css with :root declarations
    |
    v
[Consume] ──── Block CSS Modules reference via var(--token-*)
```

#### Category Mapping

| Figma Source | Token Category | CSS Custom Property | Example |
|-------------|---------------|--------------------|---------|
| Color styles / color variables | `--token-color-*` | `--token-color-primary` | `#3b82f6` |
| Spacing variables | `--token-spacing-*` | `--token-spacing-md` | `16px` |
| Font size variables | `--token-font-size-*` | `--token-font-size-lg` | `20px` |
| Font family styles | `--token-font-*` | `--token-font-family` | `system-ui, ...` |
| Line height variables | `--token-line-height-*` | `--token-line-height-base` | `32px` |
| Border radius variables | `--token-radius-*` | `--token-radius-lg` | `12px` |
| Effect styles (shadows) | `--token-shadow-*` | `--token-shadow-md` | `0 4px 6px ...` |
| Transition tokens | `--token-transition-*` | `--token-transition-fast` | `150ms ease` |

#### Figma Value to Token Resolution

When mapping a Figma design to PayloadCMS blocks, extracted values must be resolved to their token equivalents:

1. **Check for variable binding** -- If a Figma node property is bound to a variable (e.g., `fills[0].color` bound to `primitives/blue-500`), resolve the variable to its token name.

2. **Check for style reference** -- If the node references a Figma style (color style, text style, effect style), map the style name to the token name.

3. **Check for value match** -- If the raw value matches a known token value (e.g., `#3b82f6` matches `--token-color-primary`), use the token reference.

4. **No match** -- If the value does not match any token, use the raw value with a fallback. Flag for potential token promotion.

#### Gap Token Mapping

The Container block stores gap as Tailwind classes, not token references. The mapping from Figma to Tailwind gap classes is:

| Figma itemSpacing | Tailwind Gap Class | Equivalent rem |
|-------------------|-------------------|----------------|
| 0px | `gap-0` | 0 |
| 4px | `gap-1` | 0.25rem |
| 8px | `gap-2` | 0.5rem |
| 16px | `gap-4` | 1rem |
| 24px | `gap-6` | 1.5rem |
| 32px | `gap-8` | 2rem |
| 48px | `gap-12` | 3rem |
| 64px | `gap-16` | 4rem |

Non-exact values snap to the nearest option (see Section 3 snapping rules).

#### LayoutMeta Token Mapping

LayoutMeta spacing values are also Tailwind classes. The mapping from Figma padding/margin:

| Figma padding (px) | LayoutMeta value | Tailwind rem |
|--------------------|--------------------|-------------|
| 0 | `pt-0` / `pb-0` / `mt-0` / `mb-0` | 0 |
| 8px | `pt-2` / `pb-2` / etc. | 0.5rem |
| 16px | `pt-4` / `pb-4` / etc. | 1rem |
| 24px | `pt-6` / `pb-6` / etc. | 1.5rem |
| 32px | `pt-8` / `pb-8` / etc. | 2rem |
| 48px | `pt-12` / `pb-12` / etc. | 3rem |
| 64px | `pt-16` / `pb-16` / etc. | 4rem |

---

### 6. Variant Mapping (CVA Pattern)

Figma component variants map to PayloadCMS block field variants, which are then rendered via CSS Module modifier classes (following the CVA -- Class Variance Authority -- pattern).

#### Figma Variants to Block Fields

| Figma Variant Property | PayloadCMS Block | Field | Field Type | Options |
|-----------------------|-----------------|-------|-----------|---------|
| `impact` (high/medium/low) | Hero | `settings.type` | radio | highImpact, mediumImpact, lowImpact |
| `size` (fixed/responsive) | Video | `settings.videoSize` | radio | fixed, responsive |
| `state` (open/closed) | Accordion | `settings.defaultState` | radio | open, closed |
| `ctaType` (button/link) | Button | `cta.type` | radio | button, link |
| `appearance` (default/outline) | Link (field factory) | `link.appearance` | select | default, outline |

#### Variant Detection Rules

1. **Named variant properties** -- If a Figma component set has variant properties (e.g., `impact=high`, `size=large`), map each property to the corresponding block select/radio field.

2. **Boolean variant properties** -- Figma boolean properties (e.g., `hasImage=true`) map to block checkbox fields or conditional field visibility.

3. **Instance swap properties** -- Figma instance swap slots (e.g., `icon=<IconComponent>`) map to upload or relationship fields.

#### CVA Rendering Pattern

Block renderers use variant values to select CSS Module classes:

```typescript
// Hero renderer applies variant-based classes
const impactClass = {
  highImpact: styles.heroContainerHigh,    // min-height: 400px
  mediumImpact: styles.heroContainerMedium, // min-height: 300px
  lowImpact: styles.heroContainerLow,      // min-height: 200px
}[block.settings.type]

return <div className={cn(styles.heroContainer, impactClass)}>
```

The CSS Module defines the modifier classes:

```css
.heroContainerHigh { min-height: 400px; }
.heroContainerMedium { min-height: 300px; }
.heroContainerLow { min-height: 200px; }
```

This is the CVA pattern: the block field value selects the CSS class variant.

#### Mapping Figma Variants When Names Do Not Match

When Figma variant property names differ from block field names, use this resolution order:

1. **Exact match** -- Figma variant property name matches block field name (e.g., both called "type")
2. **Semantic match** -- Figma "variant" or "style" maps to block "type"
3. **Value match** -- Check if Figma variant values match block option values (e.g., Figma "High" matches block "highImpact")
4. **Size heuristic** -- If no variant property exists, infer from dimensions (Hero height, Container width)

---

### 7. Instance and Slot Mapping

Figma component instances and instance swap properties map to block references and nested block content.

#### Component Instance to Nested Block

When a Figma component instance appears as a child of another component, it maps to a nested block within the parent's blocks field:

```
Figma:
  Hero Component
    └── Button Instance (text: "Get Started")
    └── Button Instance (text: "Learn More")

PayloadCMS:
  Hero block
    content.buttonGroup[0].link.label = "Get Started"
    content.buttonGroup[1].link.label = "Learn More"
```

For Container blocks, each child instance becomes a block entry in `layout.content.blocks`.

#### Instance Overrides to Field Values

Figma instance overrides (text overrides, fill overrides, visibility overrides) map to field values:

| Figma Override Type | PayloadCMS Mapping |
|--------------------|--------------------|
| Text override | Corresponding text or richText field value |
| Fill override | Token reference if color matches, otherwise CSS Module customization |
| Visibility override (hidden) | `settings.layoutMeta.hidden = true` |
| Component swap | Different block type in the blocks array |
| Nested instance override | Recursive field value mapping |

#### Slot Pattern

Figma instance swap properties (where a component exposes a slot for swapping child instances) map to block relationship or blocks fields:

```
Figma Component: Card
  Instance Swap Property: "icon" → accepts Icon components
  Instance Swap Property: "ctaButton" → accepts Button components

PayloadCMS:
  Card block:
    image.image → Upload field (for icon slot)
    cta → CTA group fields (for ctaButton slot)
```

The key insight is that Figma's instance swap property is a visual composition mechanism, while PayloadCMS uses typed fields. The mapping must translate the swap slot into the appropriate field type.

---

### 8. Rich Text Extraction

Figma text nodes are converted to Lexical editor content for PayloadCMS richText fields.

#### Text Node to Lexical Mapping

```
Figma TEXT Node
    |
    ├── Extract styledTextSegments
    |   Each segment: { characters, fontSize, fontWeight, italic, textDecoration, hyperlink }
    |
    v
[Determine Block Type]
    fontSize >= 28px AND fontWeight >= 700 → Lexical HeadingNode (h1/h2)
    fontSize >= 24px AND fontWeight >= 600 → Lexical HeadingNode (h2/h3)
    fontSize >= 20px AND fontWeight >= 600 → Lexical HeadingNode (h3/h4)
    Otherwise → Lexical ParagraphNode
    |
    v
[Map Text Formatting]
    fontWeight >= 700 → Bold format
    italic: true → Italic format
    textDecoration: UNDERLINE → Underline format
    textDecoration: STRIKETHROUGH → Strikethrough format
    hyperlink defined → LinkNode wrapping text
    |
    v
[Assemble Lexical JSON]
```

#### Heading Hierarchy Detection

When multiple text nodes exist in a component, determine heading levels from font size relationships:

```
Text Nodes in Hero:
  "Welcome to Our Platform" (fontSize: 48px, fontWeight: 700) → h1
  "We help teams build faster" (fontSize: 20px, fontWeight: 400) → paragraph

Text Nodes in Card:
  "Feature Title" (fontSize: 24px, fontWeight: 600) → h3
  "Description text here" (fontSize: 16px, fontWeight: 400) → paragraph
```

The rule: within a single block context, the largest font size becomes the highest heading level, and progressively smaller sizes become lower headings or paragraphs.

#### Lexical JSON Structure

PayloadCMS Lexical content follows this JSON structure:

```json
{
  "root": {
    "type": "root",
    "children": [
      {
        "type": "heading",
        "tag": "h2",
        "children": [
          {
            "type": "text",
            "text": "Welcome to Our Platform",
            "format": 1
          }
        ]
      },
      {
        "type": "paragraph",
        "children": [
          {
            "type": "text",
            "text": "We help teams build ",
            "format": 0
          },
          {
            "type": "text",
            "text": "faster",
            "format": 3
          }
        ]
      }
    ]
  }
}
```

Format values are bitmasks:
- `0` = no formatting
- `1` = bold
- `2` = italic
- `3` = bold + italic
- `4` = strikethrough
- `8` = underline
- `16` = code

#### Multi-Node Aggregation

When a Figma component has multiple separate text nodes that should combine into a single richText field, aggregate them in visual order (top to bottom, left to right):

```
Figma Card:
  Text "Feature Title" (y: 120, fontSize: 24px)
  Text "Description paragraph..." (y: 160, fontSize: 16px)

Lexical richText:
  HeadingNode(h3, "Feature Title")
  ParagraphNode("Description paragraph...")
```

Sort text nodes by their Y position (top to bottom), then by X position for same-line text.

#### List Detection

Figma does not have native list support. Detect lists heuristically:

- **Bullet points** -- Text starting with "- ", "* ", or bullet character (U+2022)
- **Numbered lists** -- Text starting with "1.", "2.", etc.
- **Repeated icon + text pattern** -- Row of icon instance + text node, repeated vertically

Convert detected lists to Lexical ListNode with ListItemNode children.

---

### 9. Media Asset Pipeline

Figma images are extracted, exported, and uploaded to the PayloadCMS Media collection.

#### Extraction Steps

```
Figma Image Fill or Image Node
    |
    v
[1. Identify] ─── Is it an image fill on a frame? Or a standalone image?
    |               Reference: design-to-code-assets.md for detection rules
    v
[2. Export] ────── Use Figma REST API: GET /v1/images/:file_key
    |               Parameters: ids=[nodeId], format=png, scale=2
    |               Export at 2x for retina displays
    v
[3. Upload] ───── POST to PayloadCMS Media collection
    |               Include alt text from:
    |               - Figma node name (fallback)
    |               - Nearest text sibling (better)
    |               - Explicit alt text property if set
    v
[4. Reference] ── Store the Media document ID in the block's
                   image.image field (relationship to media collection)
```

#### Image Export Settings

| Setting | Value | Reason |
|---------|-------|--------|
| Format | PNG | Lossless, PayloadCMS converts to WebP |
| Scale | 2 | Retina display support |
| Fallback format | SVG | For vector-only content |

PayloadCMS automatically generates the `og` image size (1200x630 WebP) from uploaded images.

#### SVG Handling Decision

| Condition | Action |
|-----------|--------|
| Vector content (icons, logos, illustrations) | Export as SVG, upload to Media |
| Photographic content | Export as PNG at 2x |
| Mixed vector + photo | Export as PNG (vectors rasterize cleanly) |
| Small icon (< 24px) | Consider inline SVG in CSS Module instead of Media upload |

For inline SVG vs upload decisions, reference `design-to-code-assets.md` Section 4 (CSS vs SVG decision tree).

#### Alt Text Generation

The Media collection requires an `alt` field. Generate alt text using this priority:

1. **Figma node name** if descriptive (e.g., "Team photo", "Logo icon")
2. **Parent component context** (e.g., image in Card titled "AI Feature" → "AI Feature illustration")
3. **Generic fallback** based on position (e.g., "Hero background image", "Card thumbnail")
4. **Empty string** for purely decorative images (with `role="presentation"` in HTML)

---

### 10. Responsive Considerations

Figma responsive variants map to PayloadCMS Container width settings and CSS Module media queries.

#### Figma Responsive Patterns to PayloadCMS

| Figma Pattern | PayloadCMS Mapping |
|--------------|-------------------|
| Full-width frame (fills viewport) | Container width = `full` |
| Max-width ~1200-1400px with auto margins | Container width = `wide` |
| Max-width ~600-800px with auto margins | Container width = `narrow` |
| Horizontal layout at desktop, vertical at mobile | Container layout = `row` (CSS Module handles responsive override) |
| Different gap at mobile vs desktop | Container gap = desktop value (CSS Module responsive rules adjust mobile) |

#### Responsive Frame Detection

When Figma contains multiple responsive variants of the same frame (e.g., "Hero/Desktop", "Hero/Mobile"):

1. Use the desktop variant as the primary mapping source
2. Note layout direction changes between variants
3. The CSS Module media queries handle responsive behavior -- PayloadCMS blocks store the desktop configuration

#### Container Width to CSS

| PayloadCMS Width | CSS Module Class | CSS |
|-----------------|-----------------|-----|
| `full` | `.container` | No max-width constraint |
| `wide` | `.containerWide` | `max-width: 1400px; margin: 0 auto;` |
| `narrow` | `.containerNarrow` | `max-width: 800px; margin: 0 auto;` |

#### Mobile-First CSS Module Pattern

Block CSS Modules follow a mobile-first responsive approach:

```css
/* Base (mobile) */
.heroContainer {
  padding: var(--token-spacing-lg, 24px);
  min-height: 200px;
}

/* Tablet */
@media (min-width: 768px) {
  .heroContainer {
    padding: var(--token-spacing-2xl, 48px);
    min-height: 300px;
  }
}

/* Desktop */
@media (min-width: 1024px) {
  .heroContainer {
    padding: var(--token-spacing-3xl, 64px);
    min-height: 400px;
  }
}
```

When Figma Variables use breakpoint modes, the tokens themselves change at breakpoints (see `design-tokens-variables.md`), and blocks automatically adapt without per-block media queries.

---

### 11. Complete Mapping Example

This section walks through mapping a complete Figma page to a PayloadCMS block tree.

#### Figma Design

A landing page with three sections:

```
Page Frame (1440 x 2400, vertical Auto Layout)
  ├── Hero Frame (1440 x 600)
  │    ├── Background Image (1440 x 600, image fill)
  │    ├── Overlay (1440 x 600, black 40% opacity)
  │    ├── Content Frame (800 x auto, vertical, gap 24px)
  │    │    ├── Text "Build Better Products" (48px, bold, white)
  │    │    ├── Text "Our platform helps teams..." (20px, regular, white)
  │    │    └── Buttons Frame (horizontal, gap 12px)
  │    │         ├── Button Instance "Get Started" (primary fill)
  │    │         └── Button Instance "Watch Demo" (outline)
  │    └── (padding: 64px 32px)
  │
  ├── Features Section (1440 x auto, vertical, gap 48px, padding 64px 32px)
  │    ├── Section Header Frame (vertical, gap 16px, center-aligned)
  │    │    ├── Text "Features" (32px, bold)
  │    │    └── Text "Everything you need" (18px, regular)
  │    └── Cards Row (horizontal, gap 24px, max-width 1200px)
  │         ├── Card Instance (360 x auto)
  │         │    ├── Image (360 x 200)
  │         │    ├── Text "Fast Builds" (24px, semibold)
  │         │    ├── Text "Deploy in seconds..." (16px, regular)
  │         │    └── Button "Learn More"
  │         ├── Card Instance (360 x auto)
  │         │    ├── Image (360 x 200)
  │         │    ├── Text "Team Collab" (24px, semibold)
  │         │    ├── Text "Work together..." (16px, regular)
  │         │    └── Button "Learn More"
  │         └── Card Instance (360 x auto)
  │              ├── Image (360 x 200)
  │              ├── Text "Analytics" (24px, semibold)
  │              ├── Text "Track metrics..." (16px, regular)
  │              └── Button "Learn More"
  │
  └── CTA Section (1440 x auto, horizontal, gap 32px, padding 48px)
       ├── Content Frame (vertical, gap 12px)
       │    ├── Text "Ready to get started?" (28px, bold, white)
       │    └── Text "Join thousands of teams..." (16px, regular, white)
       └── Image (400 x 300)
       └── (background: #3b82f6)
```

#### Mapping Result

```json
{
  "layout": {
    "blocks": [
      {
        "blockType": "hero",
        "content": {
          "richText": {
            "root": {
              "type": "root",
              "children": [
                {
                  "type": "heading",
                  "tag": "h1",
                  "children": [{ "type": "text", "text": "Build Better Products", "format": 1 }]
                },
                {
                  "type": "paragraph",
                  "children": [{ "type": "text", "text": "Our platform helps teams ship faster with confidence.", "format": 0 }]
                }
              ]
            }
          },
          "buttonGroup": [
            {
              "link": {
                "type": "custom",
                "url": "#get-started",
                "label": "Get Started",
                "newTab": false
              }
            },
            {
              "link": {
                "type": "custom",
                "url": "#demo",
                "label": "Watch Demo",
                "newTab": false
              }
            }
          ]
        },
        "image": {
          "image": "media-id-hero-bg"
        },
        "settings": {
          "type": "highImpact",
          "className": "",
          "layoutMeta": {
            "marginTop": "mt-0",
            "marginBottom": "mb-0",
            "paddingTop": "pt-0",
            "paddingBottom": "pb-0",
            "hidden": false
          }
        }
      },
      {
        "blockType": "container",
        "layout": {
          "content": {
            "blocks": [
              {
                "blockType": "richText",
                "content": {
                  "richText": {
                    "root": {
                      "type": "root",
                      "children": [
                        {
                          "type": "heading",
                          "tag": "h2",
                          "children": [{ "type": "text", "text": "Features", "format": 1 }]
                        },
                        {
                          "type": "paragraph",
                          "children": [{ "type": "text", "text": "Everything you need to build better products", "format": 0 }]
                        }
                      ]
                    }
                  }
                },
                "settings": { "className": "", "layoutMeta": { "marginTop": "mt-0", "marginBottom": "mb-0", "paddingTop": "pt-0", "paddingBottom": "pb-0", "hidden": false } }
              },
              {
                "blockType": "container",
                "layout": {
                  "content": {
                    "blocks": [
                      {
                        "blockType": "card",
                        "content": {
                          "richText": {
                            "root": {
                              "type": "root",
                              "children": [
                                { "type": "heading", "tag": "h3", "children": [{ "type": "text", "text": "Fast Builds", "format": 1 }] },
                                { "type": "paragraph", "children": [{ "type": "text", "text": "Deploy in seconds with our streamlined pipeline.", "format": 0 }] }
                              ]
                            }
                          }
                        },
                        "cta": { "label": "Learn More", "ctaAction": "external", "externalLink": "#", "layout": "wrap-link-button" },
                        "image": { "image": "media-id-card-1" },
                        "settings": { "className": "", "layoutMeta": { "marginTop": "mt-0", "marginBottom": "mb-0", "paddingTop": "pt-0", "paddingBottom": "pb-0", "hidden": false } }
                      },
                      {
                        "blockType": "card",
                        "content": {
                          "richText": {
                            "root": {
                              "type": "root",
                              "children": [
                                { "type": "heading", "tag": "h3", "children": [{ "type": "text", "text": "Team Collab", "format": 1 }] },
                                { "type": "paragraph", "children": [{ "type": "text", "text": "Work together in real-time with live editing.", "format": 0 }] }
                              ]
                            }
                          }
                        },
                        "cta": { "label": "Learn More", "ctaAction": "external", "externalLink": "#", "layout": "wrap-link-button" },
                        "image": { "image": "media-id-card-2" },
                        "settings": { "className": "", "layoutMeta": { "marginTop": "mt-0", "marginBottom": "mb-0", "paddingTop": "pt-0", "paddingBottom": "pb-0", "hidden": false } }
                      },
                      {
                        "blockType": "card",
                        "content": {
                          "richText": {
                            "root": {
                              "type": "root",
                              "children": [
                                { "type": "heading", "tag": "h3", "children": [{ "type": "text", "text": "Analytics", "format": 1 }] },
                                { "type": "paragraph", "children": [{ "type": "text", "text": "Track every metric with real-time dashboards.", "format": 0 }] }
                              ]
                            }
                          }
                        },
                        "cta": { "label": "Learn More", "ctaAction": "external", "externalLink": "#", "layout": "wrap-link-button" },
                        "image": { "image": "media-id-card-3" },
                        "settings": { "className": "", "layoutMeta": { "marginTop": "mt-0", "marginBottom": "mb-0", "paddingTop": "pt-0", "paddingBottom": "pb-0", "hidden": false } }
                      }
                    ]
                  }
                },
                "settings": {
                  "htmlTag": "div",
                  "layout": "row",
                  "width": "wide",
                  "alignItems": "items-stretch",
                  "justifyContent": "justify-center",
                  "gap": "gap-6",
                  "layoutMeta": { "marginTop": "mt-0", "marginBottom": "mb-0", "paddingTop": "pt-0", "paddingBottom": "pb-0", "hidden": false }
                }
              }
            ]
          }
        },
        "settings": {
          "htmlTag": "section",
          "layout": "col",
          "width": "full",
          "alignItems": "items-center",
          "justifyContent": "justify-start",
          "gap": "gap-12",
          "layoutMeta": { "marginTop": "mt-0", "marginBottom": "mb-0", "paddingTop": "pt-16", "paddingBottom": "pb-16", "hidden": false }
        }
      },
      {
        "blockType": "callToAction",
        "content": {
          "title": "Ready to get started?",
          "richText": {
            "root": {
              "type": "root",
              "children": [
                { "type": "paragraph", "children": [{ "type": "text", "text": "Join thousands of teams building better products.", "format": 0 }] }
              ]
            }
          }
        },
        "image": { "image": "media-id-cta" },
        "settings": {
          "className": "",
          "newTab": false,
          "layoutMeta": { "marginTop": "mt-0", "marginBottom": "mb-0", "paddingTop": "pt-0", "paddingBottom": "pb-0", "hidden": false }
        }
      }
    ]
  }
}
```

#### Mapping Decisions Explained

1. **Hero Section** -- Matched by Rule 1 (full-width, background image, large heading, buttons). Impact set to `highImpact` because the frame height is 600px (>= 400px threshold).

2. **Features Section** -- The outer section frame becomes a Container (Rule 15, structural wrapper with mixed children). `htmlTag` set to `section` based on frame name. The inner "Section Header" is flattened into a RichText block (heading + description, no structural purpose). The "Cards Row" becomes a nested Container (layout: row) because it changes direction from the parent's column layout.

3. **Card Instances** -- Each matched by Rule 2 (bounded width, image, text, CTA). The three Card blocks are children of the row Container.

4. **CTA Section** -- Matched by Rule 10 (full-width, strong background color, title + description + image). Maps to CallToAction block rather than a Container with RichText, because the structure matches the CTA block's fields exactly.

5. **Nesting depth** -- The result has 2 levels: outer Container (section) > inner Container (cards row) > Card blocks. This is within the PayloadCMS depth limit.

---

## Cross-References

- **`payload-blocks.md`** -- Complete block catalog, field definitions, Container settings, and Lexical configuration. The mapping tables in this module reference the exact field names and types defined there.

- **`payload-visual-builder.md`** -- Visual Builder plugin architecture for editing mapped blocks. Defines the editing UX for blocks produced by this mapping pipeline.

- **`design-to-code-layout.md`** -- Auto Layout to Flexbox mapping rules. The Container mapping in Section 3 directly applies the layout interpretation rules from this module (sizing modes, axis alignment, gap, wrap, constraints).

- **`design-to-code-visual.md`** -- Visual property extraction (fills, strokes, effects, gradients, opacity). Used during token bridge (Section 5) to determine which visual values map to `--token-*` properties.

- **`design-to-code-typography.md`** -- Font mapping and text style extraction. Rich text extraction (Section 8) uses the styled segment and heading hierarchy rules from this module.

- **`design-to-code-assets.md`** -- Image and vector export rules. The media asset pipeline (Section 9) references the SVG vs CSS decision tree and image deduplication patterns.

- **`design-to-code-semantic.md`** -- Semantic HTML element selection. The Container block's `htmlTag` mapping and the BEM naming patterns used in CSS Modules follow the conventions defined here.

- **`css-strategy.md`** -- Three-layer CSS architecture. Blocks use Layer 1 (Tailwind) for Container settings, Layer 2 (tokens) for design values, and Layer 3 (CSS Modules) for visual skin -- as defined in this strategy module.

- **`design-tokens.md`** -- Token extraction pipeline and naming algorithm. The design token bridge (Section 5) follows the extraction, naming, and rendering pipeline from this module.

- **`design-tokens-variables.md`** -- Figma Variables to CSS custom property resolution. Variable-bound properties are resolved through the chain documented here before mapping to `--token-*` values.
