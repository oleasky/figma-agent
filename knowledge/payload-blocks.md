# PayloadCMS Block System

## Purpose

Authoritative reference for the PayloadCMS block system. Documents the complete block architecture, field types, reusable field factories, block catalog, container nesting model, block rendering patterns, collection integration, Lexical editor configuration, and design token consumption. Encodes production patterns from a PayloadCMS 3.x + Next.js application with a visual builder plugin and container-first block architecture.

## When to Use

Reference this module when you need to:

- Build new PayloadCMS blocks following established patterns
- Map Figma components to PayloadCMS block types (see `payload-figma-mapping.md`)
- Understand the tab-based field organization pattern used across all blocks
- Add or modify reusable field factories (imageTabs, linkGroup, layoutMeta)
- Configure the Container block's nesting, layout, and alignment options
- Extend the block rendering registry with new block types
- Understand how blocks consume design tokens via CSS Modules
- Configure Lexical rich text editors with restricted or full feature sets
- Integrate blocks into Pages or other collections via the `blocks` field type
- Debug block schema recursion or self-nesting issues

---

## Content

### 1. Block Architecture Overview

PayloadCMS blocks are modular, reusable content units that editors compose into page layouts. Each block is a TypeScript object conforming to the `Block` type from `payload`, with a unique slug, a label, and a field array that defines the block's data schema.

#### Block Type Definition

```typescript
import { Block } from 'payload'

export const Hero: Block = {
  slug: 'hero',
  fields: [
    {
      type: 'tabs',
      tabs: [
        { label: 'Content', name: 'content', fields: [...] },
        { label: 'Media', fields: [...] },
        { label: 'Settings', fields: [...] },
      ],
    },
  ],
}
```

Every block exports a `Block` constant from a `config.ts` file within its directory.

#### Slug Naming Convention

Block slugs use camelCase and are unique across the entire Payload configuration:

| Block | Slug |
|-------|------|
| Hero | `hero` |
| Card | `card` |
| Button | `button` |
| RichText | `richText` |
| Media | `media` |
| Video | `video` |
| Accordion | `accordion` |
| Stats | `stats` |
| Testimonial | `testimonial` |
| CallToAction | `callToAction` |
| StickyCTA | `stickyCTA` |
| SubNavigation | `subnavigation` |
| Container | `container` |
| Carousel | `carousel` |
| Tabs | `tabs` |
| Grid | `grid` |
| Form | `form` |
| Code | `code` |
| SubAccordion | `inneraccordion` |

#### Tab-Based Field Organization

All blocks organize their fields using the `tabs` field type. This provides a consistent editing experience where content, media, CTA actions, and settings are separated into distinct tab panels.

The standard tab pattern is:

1. **Content tab** -- Primary content fields (richText, text, arrays)
2. **Media/Image tab** -- Image upload via `imageFields` factory
3. **CTA tab** -- Call-to-action links and buttons (when applicable)
4. **Settings tab** -- Block configuration (className, layoutMeta, type variants)

Not every block has all four tabs. The minimum is two: a content-focused tab and a Settings tab.

#### Directory Structure

Blocks are organized by category under `src/admin/blocks/`:

```
src/admin/blocks/
  content/
    Accordion/config.ts, layoutTab.ts, settingTab.ts, container.ts
    Button/config.ts, ctaTab.ts, settingTab.ts
    CallToAction/config.ts, settingTab.ts
    Card/config.ts, ctaTab.ts, settingTab.ts
    Hero/config.ts, settingTabs.ts
    Media/config.ts, settingTab.ts
    RichText/config.ts, settingTab.ts
    StatCard/config.ts, settingTabs.ts
    StickyCTA/config.ts, ctaTab.ts, settingTabs.ts
    SubNavigation/config.ts, navItemTabs.ts, settingTabs.ts
    Testimonial/config.ts, settingTabs.ts
    Video/config.ts, customVideoblockField.ts, settingTabs.ts
  layout/
    Carousel/config.ts, carouselCard.ts, settingTabs.ts
    Container/config.ts, settingTabs.ts
    Grid/config.ts, settingTabs.ts
    Tabs/config.ts, tabs.ts, container.ts, settingTabs.ts
  FormEmbed/config.ts, settingTabs.ts
  Code/config.ts, Component.tsx, Component.client.tsx, CopyButton.tsx
  RenderBlocks.tsx
```

Each block's `config.ts` is the entry point. Supporting files (settingTab, ctaTab, layoutTab) export individual `Field` or `Tab` definitions that are composed into the config.

---

### 2. Field Types Reference

PayloadCMS provides a rich set of field types. The following are commonly used across blocks.

#### Core Field Types

| Type | Purpose | Example Usage |
|------|---------|---------------|
| `text` | Single-line string input | Titles, labels, slugs, URLs, className |
| `richText` | Lexical editor for structured content | Block body content, descriptions |
| `upload` | File upload linked to a collection | Images via `relationTo: 'media'` |
| `relationship` | Reference to another document | Internal links to `pages`, modal references |
| `group` | Nested field container (no repetition) | Settings groups, CTA action groups |
| `array` | Repeatable list of field sets | Navigation items, carousel cards, tab items |
| `select` | Dropdown single-choice | HTML tag selection, link type, action type |
| `radio` | Radio button single-choice | Layout direction, impact level, CTA type |
| `checkbox` | Boolean toggle | Open in new tab, hidden, default state |
| `number` | Numeric input | Scroll offset, video dimensions, column count |
| `tabs` | Tabbed field organization | Every block's top-level field structure |
| `row` | Horizontal field layout | Side-by-side fields in admin UI |
| `blocks` | Nested block composition | Container children, accordion content |
| `code` | Code editor with syntax highlighting | Code block content |
| `json` | Raw JSON with custom component | Custom video field, form select |

#### The `tabs` Field Type

The `tabs` type is the primary organizational pattern. It creates a tabbed interface in the admin panel:

```typescript
{
  type: 'tabs',
  tabs: [
    {
      label: 'Content',    // Tab display name
      name: 'content',     // Optional: creates named data path
      fields: [...]        // Fields within this tab
    },
    {
      label: 'Settings',   // No name = fields stored at block root
      fields: [...]
    },
  ],
}
```

When a tab has a `name` property, its fields are nested under that path in the data (e.g., `block.content.richText`). When a tab has no `name`, fields are stored at the block root level.

#### The `blocks` Field Type (Nested Composition)

The `blocks` field enables block nesting -- a block can contain other blocks:

```typescript
{
  type: 'blocks',
  name: 'blocks',
  label: false,
  blocks: [Card, RichText, Button, ...],
}
```

This is used by Container, Accordion, and Tabs to hold child blocks. The `blocks` array defines which block types are allowed as children.

#### Conditional Field Display

Many fields use the `admin.condition` function to show/hide based on sibling field values:

```typescript
{
  name: 'externalLink',
  type: 'text',
  admin: {
    condition: (data, siblingData) => siblingData.ctaAction === 'external',
  },
}
```

This pattern is used extensively for link type toggles (internal vs. external), CTA type toggles (button vs. link), and layout-specific fields (grid column count).

---

### 3. Reusable Field Factories

The recommended approach extracts common field patterns into reusable factories stored in `src/admin/fields/`.

#### `imageFields` (imageTabs.ts)

A group field that provides a standard image upload interface.

```typescript
import { Field } from 'payload'

export const imageFields: Field = {
  name: 'image',
  type: 'group',
  label: false,
  fields: [
    {
      name: 'image',
      label: 'Image',
      type: 'upload',
      relationTo: 'media',
    },
  ],
}
```

**Usage:** Used in Hero (Media tab), Card (Image tab), Media (Image tab), CallToAction (Image tab), Testimonial (Image/Video tab), Grid (Image tab).

**Data path:** `block.image.image` (the group wraps the upload field).

#### `linkGroup()` (linkGroup.ts)

A factory function that generates an array field containing link items. Each link item uses the `link()` factory.

```typescript
type LinkGroupType = (options?: {
  appearances?: LinkAppearances[] | false
  overrides?: Partial<ArrayField>
}) => Field

export const linkGroup: LinkGroupType = ({ appearances, overrides = {} } = {}) => {
  const generatedLinkGroup: Field = {
    name: 'links',
    type: 'array',
    fields: [link({ appearances })],
    admin: { initCollapsed: true },
  }
  return deepMerge(generatedLinkGroup, overrides)
}
```

**Parameters:**
- `appearances` -- Controls link appearance options (`'default' | 'outline'`). Pass `false` to hide appearance selector.
- `overrides` -- Deep-merged into the generated field. Used to customize `name`, `label`, `maxRows`.

**Usage in Hero:**
```typescript
linkGroup({
  overrides: { maxRows: 3, name: 'buttonGroup', label: 'Button' },
  appearances: false,
})
```

#### `link()` (link.ts)

A factory function that generates a single link group field with internal/external toggle, label, new tab checkbox, and optional appearance selector.

```typescript
type LinkType = (options?: {
  appearances?: LinkAppearances[] | false
  disableLabel?: boolean
  overrides?: Record<string, unknown>
}) => Field
```

**Generated fields:**
- `type` (radio) -- `'reference'` (internal) or `'custom'` (external URL)
- `newTab` (checkbox) -- Open in new tab
- `reference` (relationship) -- Internal page link (shown when type is reference)
- `url` (text) -- External URL (shown when type is custom)
- `label` (text) -- Link display text (unless `disableLabel: true`)
- `appearance` (select) -- Visual style: `'default'` or `'outline'` (unless appearances is false)

#### `ClassName` (className/index.ts)

A text field for custom CSS class names.

```typescript
export const ClassName: Field = {
  name: 'className',
  label: 'Custom Classname',
  type: 'text',
  admin: {
    placeholder: 'e.g., custom-style',
    description: 'Enter a class name for custom styling or interactivity.',
  },
}
```

**Usage:** Included in nearly every block's Settings tab. Enables editors to add custom CSS classes for per-instance styling or JavaScript hooks.

#### `LayoutMeta` (layoutMeta.ts)

A group field providing spacing and visibility controls for every block.

```typescript
export const LayoutMeta: Field = {
  name: 'layoutMeta',
  type: 'group',
  label: 'Layout',
  fields: [
    { type: 'row', fields: [marginTop, marginBottom] },
    { type: 'row', fields: [paddingTop, paddingBottom] },
    { name: 'hidden', type: 'checkbox', label: 'Hide this block', defaultValue: false },
  ],
}
```

**Spacing options** use Tailwind utility class values:

| Label | Margin Top | Margin Bottom | Padding Top | Padding Bottom |
|-------|-----------|---------------|-------------|----------------|
| None | `mt-0` | `mb-0` | `pt-0` | `pb-0` |
| XS (0.5rem) | `mt-2` | `mb-2` | `pt-2` | `pb-2` |
| SM (1rem) | `mt-4` | `mb-4` | `pt-4` | `pb-4` |
| MD (1.5rem) | `mt-6` | `mb-6` | `pt-6` | `pb-6` |
| LG (2rem) | `mt-8` | `mb-8` | `pt-8` | `pb-8` |
| XL (3rem) | `mt-12` | `mb-12` | `pt-12` | `pb-12` |
| 2XL (4rem) | `mt-16` | `mb-16` | `pt-16` | `pb-16` |

The values are stored as Tailwind class strings and applied directly to block wrapper elements at render time.

#### `defaultLexical` (defaultLexical.ts)

The global default Lexical editor configuration used by the Payload config's `editor` property. Provides a minimal feature set: Paragraph, Underline, Bold, Italic, and Link (with internal page references enabled).

```typescript
export const defaultLexical: Config['editor'] = lexicalEditor({
  features: () => [
    ParagraphFeature(),
    UnderlineFeature(),
    BoldFeature(),
    ItalicFeature(),
    LinkFeature({ enabledCollections: ['pages'] }),
  ],
})
```

Individual blocks override this with their own `lexicalEditor()` configurations.

---

### 4. Block Catalog

The complete block type catalog, organized by category.

#### Content Blocks

**Hero** (`hero`)

| Property | Value |
|----------|-------|
| Slug | `hero` |
| Tabs | Content, Media, Settings |
| Content fields | `richText` (Lexical, full features), `buttonGroup` (linkGroup, max 3, no appearances) |
| Media fields | `imageFields` (upload to media collection) |
| Settings | `className`, `type` (radio: highImpact/mediumImpact/lowImpact), `layoutMeta` |
| CSS Module | `hero.module.css` |

The Hero block's `type` field controls visual impact level through CSS Module classes: `.heroContainerHigh` (min-height 400px), `.heroContainerMedium` (300px), `.heroContainerLow` (200px).

**Card** (`card`)

| Property | Value |
|----------|-------|
| Slug | `card` |
| Tabs | Content, CTA, Image, Settings |
| Content fields | `richText` (Lexical, restricted: no subscript, superscript, underline, strikethrough, code, link; adds FixedToolbarFeature) |
| CTA fields | `cta` group: `label` (text), `ctaAction` (select: internal/external), `internalLink` (relationship to pages), `externalLink` (text), `layout` (select: wrap-all/wrap-text-description/wrap-link-button) |
| Image fields | `imageFields` |
| Settings | `className`, `layoutMeta` |
| CSS Module | `card.module.css` |

The Card block uses a restricted Lexical editor that removes formatting features inappropriate for card content.

**Button** (`button`)

| Property | Value |
|----------|-------|
| Slug | `button` |
| Tabs | CTA, Settings |
| CTA fields | `cta` group: `label` (text), `type` (radio: button/link), `action` group (conditional: modal/scroll actions), `link` group (conditional: internal/external link) |
| Settings | `className`, `newTab` (checkbox), `layoutMeta` |
| CSS Module | `button.module.css` |

The Button block supports two behaviors: interactive button (modal trigger or scroll-to) and navigation link (internal or external).

**RichText** (`richText`)

| Property | Value |
|----------|-------|
| Slug | `richText` |
| Tabs | Content, Settings |
| Content fields | `richText` (Lexical, full default features) |
| Settings | `className`, `layoutMeta` |
| CSS Module | `richText.module.css` |

The simplest content block. Wraps a full-featured Lexical editor.

**Media** (`media`)

| Property | Value |
|----------|-------|
| Slug | `media` |
| Tabs | Image, Settings |
| Image fields | `imageFields` |
| Settings | `className`, `layoutMeta` |
| CSS Module | `media.module.css` |

A standalone image block for displaying a single media asset.

**Video** (`video`)

| Property | Value |
|----------|-------|
| Slug | `video` |
| Tabs | Content, Settings |
| Content fields | `customThumbnailField` (json with custom component: `customVideoBlockComponent`) |
| Settings | `className`, `videoSize` (radio: fixed/responsive), `height` (number, min 1000, conditional), `width` (number, min 1000, conditional), `layoutMeta` |
| CSS Module | `video.module.css` |

Uses a custom admin component for video upload/embed. Fixed size mode enables explicit height/width controls.

**Accordion** (`accordion`)

| Property | Value |
|----------|-------|
| Slug | `accordion` |
| Tabs | Layout, Settings |
| Layout fields | `title` (text, required), `htmlTag` (select: div/span/h2-h6, default h2), `content.blocks` (blocks: Button, CallToAction, Card, Form, Media, RichText, Stats, Tabs, Testimonial, Video, NestedContainer) |
| Settings | `customIcon` (upload to media), `defaultState` (radio: closed/open, default closed), `className`, `layoutMeta` |
| CSS Module | `accordion.module.css` |

The Accordion block nests other blocks within its expandable content area. It supports a custom toggle icon and can default to open or closed state.

**SubAccordion** (`inneraccordion`)

| Property | Value |
|----------|-------|
| Slug | `inneraccordion` |
| Tabs | Content, Settings |
| Purpose | A variant of Accordion used within nested containers. Provides the same accordion behavior but with a different slug to avoid schema conflicts. |

**Stats** (`stats`)

| Property | Value |
|----------|-------|
| Slug | `stats` |
| Tabs | Content, Settings |
| Content fields | `emphasis` (text -- the large number/metric), `title` (text), `richText` (Lexical, full features), `source` (text -- citation) |
| Settings | `className`, `layoutMeta` |
| CSS Module | `stats.module.css` |

Designed for displaying statistics or metrics with a prominent emphasis value.

**Testimonial** (`testimonial`)

| Property | Value |
|----------|-------|
| Slug | `testimonial` |
| Tabs | Content, Image/Video, Settings |
| Content fields | `richText` (Lexical, restricted: HeadingFeature h2-h5 + ParagraphFeature only), `author` (text), `authorDescription` (text) |
| Image/Video fields | `imageFields` |
| Settings | `className`, `layoutMeta` |
| CSS Module | `testimonial.module.css` |

The Testimonial block uses a heavily restricted Lexical editor with only heading and paragraph features.

**CallToAction** (`callToAction`)

| Property | Value |
|----------|-------|
| Slug | `callToAction` |
| Tabs | Content, Image, Settings |
| Content fields | `title` (text), `richText` (Lexical, full features) |
| Image fields | `imageFields` |
| Settings | `className`, `newTab` (checkbox), `layoutMeta` |
| CSS Module | `callToAction.module.css` |

A prominent banner-style block with title, description, and optional image.

**StickyCTA** (`stickyCTA`)

| Property | Value |
|----------|-------|
| Slug | `stickyCTA` |
| Tabs | Content, CTA, Settings |
| Content fields | `richText` (Lexical, heavily restricted: no heading, subscript, superscript, underline, strikethrough, code, link, upload, image, blockquote, relationship, lists; adds FixedToolbarFeature) |
| CTA fields | Same button/link CTA pattern as Button block |
| Settings | `className`, `layoutMeta` |
| CSS Module | `stickyCta.module.css` |

A fixed-position CTA bar. The Lexical editor is stripped to support only basic paragraph text.

**SubNavigation** (`subnavigation`)

| Property | Value |
|----------|-------|
| Slug | `subnavigation` |
| Tabs | Nav Items, Settings |
| Nav Items fields | `navItems` (array, maxRows 6): each item has `label` (text), `action` (select: internal/external), `internalLink` (relationship to pages, conditional), `externalLink` (text, conditional) |
| Settings | `className`, `layoutMeta` |
| CSS Module | `subNavigation.module.css` |

An in-page navigation bar with up to 6 items linking to internal pages or external URLs.

#### Layout Blocks

**Container** (`container`)

| Property | Value |
|----------|-------|
| Slug | `container` |
| Tabs | Layout, Settings |
| Layout fields | `content.blocks` (blocks: 14 block types, excludes Container itself) |
| Settings | `htmlTag`, `className`, `layout`, `columnsNumber`, `width`, `alignItems`, `justifyContent`, `gap`, `layoutMeta` |
| CSS Module | `container.module.css` |

The Container block is the primary layout mechanism. See Section 5 for a deep dive.

**Carousel** (`carousel`)

| Property | Value |
|----------|-------|
| Slug | `carousel` |
| Tabs | Layout, Settings |
| Layout fields | `richText` (Lexical, heading/intro), `carouselCard` (array of blocks: Card, Stats, Testimonial) |
| Settings | `className`, `layoutMeta` |
| CSS Module | (none specific -- uses container/card styles) |

Carousel items are stored as an array where each item contains a `blocks` field allowing Card, Stats, or Testimonial blocks.

**Tabs** (`tabs`)

| Property | Value |
|----------|-------|
| Slug | `tabs` |
| Tabs | Header, Tabs, Settings |
| Header fields | `richText` (Lexical, description/intro) |
| Tabs fields | `tabs` (array): each tab has `title` group (title text + auto-generated slug), `blocks` (blocks: NestedContainer, RichText, Button, CallToAction, Card, Form, Media, Stats, Testimonial, Video), and per-tab `settings` |
| Settings | `className`, `customIcon` (upload to media), `layoutMeta` |

The Tabs block auto-generates URL-safe slugs from tab titles via a `beforeChange` hook.

**Grid** (`grid`)

| Property | Value |
|----------|-------|
| Slug | `grid` |
| Tabs | Content, Image, Settings |
| Content fields | `title` (text), `richText` (Lexical, description) |
| Image fields | `imageFields` |
| Settings | `className` (no LayoutMeta) |

A simpler layout block for grid-based content with title, description, and image.

#### Utility Blocks

**Form** (`form`)

| Property | Value |
|----------|-------|
| Slug | `form` |
| Tabs | Content, Settings |
| Content fields | `customSelectField` (json with custom component for form selection), `submitAction` (select: displayMessage/redirectToPage), `redirectPage` (relationship to pages, conditional), `thankYouMessage` (richText, conditional) |
| Settings | `className`, `layoutMeta` |
| CSS Module | `formEmbed.module.css` |

Embeds an external form with configurable submit behavior.

**Code** (`code`)

| Property | Value |
|----------|-------|
| Slug | `code` |
| Fields | `language` (select: typescript/javascript/css), `code` (code field) |

The Code block does not use the tabs pattern. It has a flat field structure with a syntax-highlighted code editor. Includes custom React components for rendering and copy-to-clipboard functionality.

---

### 5. Container Block Deep Dive

The Container block is the most important block for Figma-to-PayloadCMS mapping because it mirrors Figma's Auto Layout concept -- a flexible box that arranges children in rows, columns, or grids.

#### Nesting Model

Container children are stored at the path `layout.content.blocks`:

```
Container
  └── tabs[0] (name: 'layout')
       └── content (group)
            └── blocks (blocks field)
                 ├── Block 1
                 ├── Block 2
                 └── Block 3
```

The data path for accessing nested blocks is: `container.layout.content.blocks`.

#### Self-Nesting Prevention

The top-level Container block does NOT include itself in its allowed blocks list. This prevents infinite schema recursion that would break Payload's TypeScript type generation and database schema.

However, a `NestedContainer` variant exists that IS allowed inside:
- Accordion content
- Tabs content
- Other nested contexts (Tabs/container.ts)

The NestedContainer uses the same `container` slug and the same settings, but its `blocks` array excludes itself. This creates a maximum nesting depth of 2 levels: Container > NestedContainer (which cannot nest further Containers).

#### Layout Options

The Container's `layout` field controls the CSS display mode:

| Value | Label | CSS Result |
|-------|-------|------------|
| `col` | Column | `display: flex; flex-direction: column;` |
| `row` | Row | `display: flex; flex-direction: row;` |
| `grid` | Grid | `display: grid;` |

Default is `col` (vertical stacking).

When `grid` is selected, an additional `columnsNumber` field appears (max 12) that controls the CSS `grid-template-columns` value. A value of 1 or less triggers responsive auto-sizing.

#### Alignment Options

**alignItems** (cross-axis alignment):

| Label | Value (Tailwind) |
|-------|-----------------|
| Start | `items-start` |
| Center | `items-center` |
| End | `items-end` |
| Stretch | `items-stretch` |
| Baseline | `items-baseline` |

**justifyContent** (main-axis alignment):

| Label | Value (Tailwind) |
|-------|-----------------|
| Start | `justify-start` |
| Center | `justify-center` |
| End | `justify-end` |
| Space Between | `justify-between` |
| Space Around | `justify-around` |
| Space Evenly | `justify-evenly` |
| Stretch | `justify-stretch` |

These values are stored as Tailwind utility class strings and applied directly to the container element.

#### Gap Options

| Label | Value (Tailwind) | Actual Size |
|-------|-----------------|-------------|
| None | `gap-0` | 0 |
| Extra Small | `gap-1` | 0.25rem (4px) |
| Small | `gap-2` | 0.5rem (8px) |
| Medium | `gap-4` | 1rem (16px) |
| Large | `gap-6` | 1.5rem (24px) |
| Extra Large | `gap-8` | 2rem (32px) |
| XXL | `gap-12` | 3rem (48px) |
| XXXL | `gap-16` | 4rem (64px) |

Default gap is `gap-4` (1rem).

#### Width Constraints

| Label | Value | CSS Effect |
|-------|-------|------------|
| Full | `full` | No max-width constraint |
| Wide | `wide` | `max-width: 1400px; margin: 0 auto;` |
| Narrow | `narrow` | `max-width: 800px; margin: 0 auto;` |

Default width is `full`.

#### HTML Tag Selection

The Container supports semantic HTML element selection:

| Label | Value |
|-------|-------|
| `<div>` | `div` (default) |
| `<section>` | `section` |
| `<article>` | `article` |
| `<aside>` | `aside` |
| `<header>` | `header` |
| `<footer>` | `footer` |

This enables proper semantic HTML output without changing block behavior.

#### Container CSS Module

The container CSS Module (`container.module.css`) provides base styles and modifier classes:

```css
.container {
  gap: var(--token-spacing-md, 16px);
  padding: var(--token-spacing-md, 16px);
}

.containerFlex { display: flex; }
.containerGrid { display: grid; }
.containerRow { flex-direction: row; }
.containerColumn { flex-direction: column; }
.containerNarrow { max-width: 800px; margin: 0 auto; }
.containerWide { max-width: 1400px; margin: 0 auto; }
.containerEmpty { color: var(--token-color-text-light, #9ca3af); font-style: italic; }
```

At render time, the appropriate modifier classes are composed based on the block's settings values.

---

### 6. Block Rendering

The `RenderBlocks` component is the registry that maps block types to React components.

#### RenderBlocks Pattern

```typescript
const blockComponents = {
  Accordion,
  Button,
  Code,
  Card,
  Hero,
  MediaBlock,
  RichText,
  Stats,
  StickyCTA,
  SubNavigationBlock,
  Testimonial,
  Video,
}

export const RenderBlocks: React.FC<{
  blocks: NonNullable<Page['layout']>
}> = (props) => {
  const { blocks } = props
  const hasBlocks = blocks && Array.isArray(blocks) && blocks.length > 0

  if (hasBlocks) {
    return (
      <Fragment>
        {blocks.map((block, index) => {
          const { blockType } = block
          if (blockType && blockType in blockComponents) {
            const Block = blockComponents[blockType]
            if (Block) {
              return (
                <div key={index}>
                  <Block {...block} disableInnerContainer />
                </div>
              )
            }
          }
          return null
        })}
      </Fragment>
    )
  }
  return null
}
```

#### How It Works

1. Each block in the page's `layout.blocks` array has a `blockType` property matching its slug
2. The `blockComponents` object maps block type names to their React component imports
3. The renderer iterates over the blocks array, looks up the component, and renders it with the block's data spread as props
4. The `disableInnerContainer` prop signals that the block should not render its own container wrapper (the parent already provides one)
5. Each block gets a wrapper `<div>` with a key based on array index

#### CSS Module Application

Each block's React component imports its corresponding CSS Module from `src/styles/blocks/`:

```typescript
// In Hero component
import styles from '@/styles/blocks/hero.module.css'

// Usage
<div className={styles.heroContainer}>
  <div className={styles.heroContentArea}>
    ...
  </div>
</div>
```

The CSS Modules are re-exported from `src/styles/blocks/index.ts` for convenient imports:

```typescript
export { default as heroStyles } from './hero.module.css'
export { default as cardStyles } from './card.module.css'
export { default as containerStyles } from './container.module.css'
// ... all block styles
```

#### Adding a New Block to the Registry

To add a new block type:

1. Create the block config in `src/admin/blocks/{category}/{BlockName}/config.ts`
2. Create the renderer component
3. Create the CSS Module in `src/styles/blocks/{blockName}.module.css`
4. Add the component to `blockComponents` in `RenderBlocks.tsx`
5. Add the block to the Pages collection's `layout.blocks` array
6. Add the CSS Module export to `src/styles/blocks/index.ts`

---

### 7. Collections Integration

#### Pages Collection

The Pages collection (`src/collections/Pages/index.ts`) is the primary consumer of blocks. Pages have a tabbed structure:

```
Pages
  ├── title (text, required)
  ├── Layout tab (name: 'layout')
  │    └── blocks (blocks field: 15 block types)
  ├── Settings tab (name: 'settings')
  │    ├── header (relationship to headers)
  │    ├── footer (relationship to footers)
  │    ├── projects (relationship to projects)
  │    └── className
  ├── SEO tab (name: 'meta')
  │    └── MetaTitle, MetaImage, MetaDescription, Preview
  └── slug (auto-generated from title)
```

The blocks field at `layout.blocks` accepts all 15 top-level block types:

```typescript
blocks: [
  Accordion, Button, CallToAction, Carousel, Container,
  Card, Form, Hero, MediaBlock, SubNavigationBlock,
  RichText, Stats, StickyCTA, Tabs, Testimonial, Video,
]
```

Pages support:
- **Live preview** via `admin.livePreview.url`
- **Draft/publish** workflow via `versions.drafts`
- **Autosave** at 100ms intervals for live preview
- **Visual Builder** via a custom view at `/visual-builder`

#### Media Collection

The Media collection (`src/collections/Media.ts`) stores uploaded images:

```typescript
export const Media: CollectionConfig = {
  slug: 'media',
  access: { read: () => true },
  upload: {
    imageSizes: [
      { name: 'og', width: 1200, height: 630, formatOptions: { format: 'webp' } },
    ],
    adminThumbnail: 'og',
    mimeTypes: ['image/*'],
  },
  fields: [
    { name: 'alt', type: 'text', required: true },
  ],
}
```

Key details:
- Images are publicly readable (no auth required)
- Automatic WebP conversion for the `og` size (1200x630)
- Only image MIME types are accepted
- The `alt` field is required for accessibility
- Block image fields link to this collection via `relationTo: 'media'`

#### Relationship Patterns

Blocks reference other collections through three patterns:

1. **Upload** -- Direct file reference: `type: 'upload', relationTo: 'media'`
2. **Relationship (single)** -- Document reference: `type: 'relationship', relationTo: 'pages'`
3. **Relationship (array)** -- Multi-collection: `relationTo: ['pages']` (can reference multiple collection types)

---

### 8. Lexical Editor Configuration

PayloadCMS uses the Lexical rich text editor. The recommended approach configures it at three levels.

#### Global Default

The `defaultLexical` configuration provides the baseline feature set for all richText fields that do not override the editor:

```typescript
lexicalEditor({
  features: () => [
    ParagraphFeature(),
    UnderlineFeature(),
    BoldFeature(),
    ItalicFeature(),
    LinkFeature({ enabledCollections: ['pages'] }),
  ],
})
```

#### Full Feature Set

Most blocks use `lexicalEditor({})` which loads all default features:

```typescript
// Hero, RichText, Stats, CallToAction, Carousel
{ name: 'richText', type: 'richText', editor: lexicalEditor({}) }
```

This includes heading, bold, italic, underline, strikethrough, subscript, superscript, code, link, upload, blockquote, lists, and more.

#### Restricted Feature Sets

Some blocks restrict the Lexical editor to appropriate features:

**Card** -- Removes subscript, superscript, underline, strikethrough, code, link. Adds FixedToolbarFeature:

```typescript
lexicalEditor({
  features: ({ defaultFeatures }) => [
    ...defaultFeatures.filter(
      (feature) => !['subscript', 'superscript', 'underline',
                      'strikethrough', 'code', 'link'].includes(feature.key),
    ),
    FixedToolbarFeature(),
  ],
})
```

**StickyCTA** -- Heavily restricted. Removes heading, subscript, superscript, underline, strikethrough, code, link, upload, image, blockquote, relationship, all list types. Only paragraph and basic formatting remain:

```typescript
lexicalEditor({
  features: ({ defaultFeatures }) => [
    ...defaultFeatures.filter(
      (feature) => !['heading', 'subscript', 'superscript', 'underline',
                      'strikethrough', 'code', 'link', 'upload', 'image',
                      'blockquote', 'relationship', 'list', 'unorderedList',
                      'orderedList', 'checklist'].includes(feature.key),
    ),
    FixedToolbarFeature(),
  ],
})
```

**Testimonial** -- Minimal: only headings (h2-h5) and paragraphs:

```typescript
lexicalEditor({
  features: () => [
    HeadingFeature({ enabledHeadingSizes: ['h2', 'h3', 'h4', 'h5'] }),
    ParagraphFeature(),
  ],
})
```

The pattern of restricting features per block ensures editors cannot add inappropriate content (e.g., no headings in a sticky CTA bar, no complex formatting in card text).

---

### 9. Token Integration

Blocks consume design tokens defined in `src/styles/tokens.css` through CSS Module rules that reference `--token-*` custom properties.

#### Token Categories in tokens.css

```css
:root {
  /* Typography */
  --token-font-family: system-ui, -apple-system, ...;
  --token-font-size-base: 18px;
  --token-font-size-sm: 15px;
  --token-font-size-lg: 20px;
  --token-font-size-xl: 24px;
  --token-font-size-2xl: 32px;
  --token-font-size-3xl: 42px;
  --token-font-size-4xl: 64px;

  /* Line Heights */
  --token-line-height-base: 32px;
  --token-line-height-sm: 24px;
  --token-line-height-tight: 1.2;
  --token-line-height-relaxed: 1.6;

  /* Spacing */
  --token-spacing-xs: 4px;
  --token-spacing-sm: 8px;
  --token-spacing-md: 16px;
  --token-spacing-lg: 24px;
  --token-spacing-xl: 32px;
  --token-spacing-2xl: 48px;
  --token-spacing-3xl: 64px;

  /* Colors */
  --token-color-text: #111827;
  --token-color-text-muted: #6b7280;
  --token-color-text-light: #9ca3af;
  --token-color-text-inverse: #ffffff;
  --token-color-bg: #ffffff;
  --token-color-bg-subtle: #f9fafb;
  --token-color-bg-muted: #f3f4f6;
  --token-color-bg-dark: #1e1e1e;
  --token-color-border: #e5e7eb;
  --token-color-border-strong: #d1d5db;
  --token-color-primary: #3b82f6;
  --token-color-primary-hover: #2563eb;
  --token-color-success: #10b981;
  --token-color-warning: #f59e0b;
  --token-color-error: #ef4444;

  /* Border Radius */
  --token-radius-sm: 4px;
  --token-radius-md: 8px;
  --token-radius-lg: 12px;
  --token-radius-full: 9999px;

  /* Shadows */
  --token-shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --token-shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  --token-shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1);

  /* Transitions */
  --token-transition-fast: 150ms ease;
  --token-transition-normal: 200ms ease;
  --token-transition-slow: 300ms ease;
}
```

#### Import Pattern

CSS Modules import tokens.css to ensure custom properties are available:

```css
@import '../tokens.css';

.card {
  background-color: var(--token-color-bg, #ffffff);
  border-radius: var(--token-radius-lg, 12px);
  box-shadow: var(--token-shadow-sm, 0 1px 3px rgba(0, 0, 0, 0.1));
}
```

#### Fallback Pattern

Every `var()` reference includes a fallback value that matches the token's default. This ensures blocks render correctly even if tokens.css is not loaded:

```css
/* Pattern: var(--token-{category}-{name}, {fallback-value}) */
padding: var(--token-spacing-lg, 24px);
color: var(--token-color-text, #111827);
font-size: var(--token-font-size-2xl, 32px);
```

#### Token Consumption by Block

| Block | Token Categories Used |
|-------|----------------------|
| Hero | spacing, color (bg-subtle, bg-dark, text, text-inverse, primary), radius, font-size |
| Card | spacing, color (bg, text, text-light, border, primary, text-inverse), radius, shadow, font-size |
| Button | spacing, color (primary, primary-hover, text-inverse), radius, transition |
| Accordion | spacing, color (bg, bg-subtle, text, text-muted, text-light, border, border-strong), radius |
| Stats | spacing, color (bg, text, text-muted, text-light, primary, border), radius, font-size, line-height |
| Testimonial | spacing, color (bg-subtle, text, text-muted, border), radius, font-size, line-height |
| CallToAction | spacing, color (primary, text-inverse, text), radius, font-size |
| Container | spacing, color (text-light) |
| StickyCTA | spacing, color, radius |
| SubNavigation | spacing, color, radius |

#### Tailwind Integration

The Container block stores alignment, gap, and spacing values as Tailwind utility class strings (e.g., `items-center`, `gap-4`, `mt-8`). These are applied directly to the rendered HTML element alongside CSS Module classes:

```html
<section class="flex flex-col items-center gap-4 mt-8 containerStyles.container">
  <!-- child blocks -->
</section>
```

This demonstrates the three-layer CSS architecture in action:
- **Layer 1 (Tailwind):** `flex flex-col items-center gap-4 mt-8`
- **Layer 2 (Tokens):** Referenced within CSS Module via `var(--token-*)`
- **Layer 3 (CSS Module):** `containerStyles.container` (scoped visual styles)

---

### 10. Select Options Reference

The `selectOptions.ts` file defines all shared option arrays used across blocks. This is the single source of truth for select and radio field options.

#### Layout Options

```typescript
export const layoutOptions = [
  { label: 'Column', value: 'col' },
  { label: 'Row', value: 'row' },
  { label: 'Grid', value: 'grid' },
]
```

#### HTML Tag Options

```typescript
export const htmlTagOptions = [
  { label: '<div>', value: 'div' },
  { label: '<section>', value: 'section' },
  { label: '<article>', value: 'article' },
  { label: '<aside>', value: 'aside' },
  { label: '<header>', value: 'header' },
  { label: '<footer>', value: 'footer' },
]
```

#### HTML Header Tag Options (for Accordion)

```typescript
export const htmlHeaderTagOptions = [
  { label: '<div>', value: 'div' },
  { label: '<span>', value: 'span' },
  { label: '<h2>', value: 'h2' },
  { label: '<h3>', value: 'h3' },
  { label: '<h4>', value: 'h4' },
  { label: '<h5>', value: 'h5' },
  { label: '<h6>', value: 'h6' },
]
```

#### Impact Options (for Hero)

```typescript
export const impactOptions = [
  { label: 'High Impact', value: 'highImpact' },
  { label: 'Medium Impact', value: 'mediumImpact' },
  { label: 'Low Impact', value: 'lowImpact' },
]
```

#### Width Options

```typescript
export const widthOptions = [
  { label: 'Full', value: 'full' },
  { label: 'Wide', value: 'wide' },
  { label: 'Narrow', value: 'narrow' },
]
```

---

## Cross-References

- **`css-strategy.md`** -- Three-layer CSS architecture (Tailwind + Custom Properties + CSS Modules). Defines how blocks combine Tailwind utility classes for layout, CSS custom properties for tokens, and CSS Modules for visual skin. The Container block's Tailwind class storage pattern is a direct implementation of Layer 1.

- **`design-tokens.md`** -- Token extraction pipeline, naming conventions, and promotion thresholds. The `--token-*` custom properties in `tokens.css` follow the naming patterns and extraction rules defined in this module.

- **`design-tokens-variables.md`** -- Figma Variables to CSS custom property bridge. Defines how Figma Variables resolve to the `--token-*` values consumed by block CSS Modules.

- **`design-to-code-semantic.md`** -- Semantic HTML element selection rules and BEM naming conventions. The Container block's `htmlTag` field and the block CSS Module BEM naming patterns (`.hero`, `.hero__title`, `.heroContainerHigh`) follow the conventions in this module.

- **`design-to-code-layout.md`** -- Auto Layout to Flexbox mapping. The Container block's layout, alignItems, justifyContent, and gap fields directly mirror the Figma Auto Layout properties documented in this module.

- **`payload-figma-mapping.md`** -- Figma component to PayloadCMS block mapping rules. Uses the block catalog and field definitions from this module to determine which Figma component becomes which block type and how properties map to fields.

- **`payload-visual-builder.md`** -- Visual Builder plugin architecture. Defines how blocks are edited visually within the Payload admin, including the Container's children path (`layout.content.blocks`) and the token aliasing pattern for CSS isolation.
