---
name: map-payload-block
description: Map a Figma component to a PayloadCMS block definition with config, renderer, types, and CSS Module. Use this skill when the user has a Figma component (JSON data, component description, or REST API node) and needs a complete PayloadCMS block implementation following the container-first architecture.
---

@knowledge/payload-blocks.md
@knowledge/payload-figma-mapping.md
@knowledge/payload-visual-builder.md
@knowledge/css-strategy.md

## Objective

Map a Figma component to a complete PayloadCMS block implementation: a block config (`.ts`), a React renderer (`.tsx`), TypeScript types, and a CSS Module (`.module.css`). The skill uses multi-signal confidence scoring to identify the correct block type from the 18-type catalog, maps component properties to PayloadCMS fields, generates container nesting rules, and produces CSS that follows the three-layer architecture (Tailwind layout + CSS Custom Properties tokens + CSS Modules visual skin).

## Input

The user provides Figma component data as `$ARGUMENTS`. This may be:

- **Figma REST API JSON** -- A component or component set node with properties, variants, children, fills, text content
- **Plugin API extracted data** -- Component properties, variant details, child nodes
- **Component description** -- Plain language description of the Figma component (structure, properties, variants, content)
- **Screenshot or design spec** -- Visual reference of the component with noted properties

If the input is insufficient, ask for:
- Component name and variant properties
- Child element structure (text nodes, images, buttons, nested components)
- Layout mode (Auto Layout direction, spacing, padding)
- Visual properties (colors, border radius, shadows)

## Process

Follow these steps in order. Consult the referenced knowledge modules for all mapping rules, field types, and architectural patterns.

### Step 1: Analyze Figma Component Structure

Identify the component's structure and classify its elements:

- **Root node**: component boundary, layout mode (Auto Layout direction), dimensions
- **Variant properties**: boolean toggles, enum options (size, style, impact level)
- **Text layers**: heading text, body text, labels, captions
- **Image fills/frames**: background images, thumbnails, avatars, icons
- **Interactive children**: button instances, link text, form inputs
- **Nested component instances**: child components that may map to separate blocks
- **Layout structure**: spacing, padding, alignment, wrap mode
- **Visual properties**: fills, strokes, effects, corner radius

### Step 2: Determine Block Type via Confidence Scoring

Consult `knowledge/payload-figma-mapping.md` Section 2 for the complete decision tree.

Apply multi-signal confidence scoring using two complementary strategies:

**Name-based detection (higher priority):**
- Check if component/frame name contains recognized keywords: hero, card, button, nav, accordion, tabs, stat, testimonial, carousel, cta, media, video, form, etc.

**Structure-based detection (fallback for generic names):**
- Analyze children, dimensions, properties, and layout patterns against block type heuristics

**18-type block catalog:**

| Block Type | Slug | Key Signals |
|-----------|------|-------------|
| Hero | `hero` | Full-width, bg image/color, large heading, CTA buttons |
| Card | `card` | Bounded width, image + heading + body, optional CTA, radius/shadow |
| Button | `button` | Small dimensions, bg fill, single text label, radius |
| Navigation | `subnavigation` | Horizontal layout, multiple link children, compact |
| Accordion | `accordion` | Vertical layout, repeating header + content, toggle icon |
| Tabs | `tabs` | Tab bar + content panel, active/inactive states |
| Stats | `stats` | Large numeric text, label below, compact |
| Testimonial | `testimonial` | Quote text, author info, optional avatar |
| Carousel | `carousel` | Horizontal overflow, nav dots/arrows, card children |
| CallToAction | `callToAction` | Full-width, strong background, title + description |
| Media | `media` | Single image, no text children |
| Video | `video` | Play button overlay, 16:9 ratio, thumbnail |
| Form | `form` | Input fields, submit button, labels |
| RichText | `richText` | Primarily text content, styled segments |
| Container | `container` | Auto Layout wrapper containing block-type children |
| Grid | `grid` | Grid-like child layout, uniform child sizes |
| Code | `code` | Code/monospace content |
| StickyCTA | `stickyCTA` | Fixed/sticky positioning, compact CTA |

**Confidence thresholds:**
- 0.9+ -- Auto-map, high confidence
- 0.8-0.89 -- Auto-map, flag for optional review
- 0.7-0.79 -- Moderate confidence, flag for human review
- Below 0.7 -- Require human confirmation

Report the matched block type and confidence score to the user.

### Step 3: Map Component Properties to Block Fields

Consult `knowledge/payload-figma-mapping.md` Section 3 and `knowledge/payload-blocks.md` Section 2.

Apply these property-to-field mapping rules:

| Figma Property Type | PayloadCMS Field Type | Mapping Rule |
|--------------------|----------------------|--------------|
| Text layer (heading) | `richText` (Lexical) | Extract text content into Lexical document structure |
| Text layer (single line) | `text` | Direct string mapping |
| Boolean variant | `checkbox` | `true`/`false` toggle |
| Enum variant (2-4 options) | `radio` | Radio buttons with variant option values |
| Enum variant (5+ options) | `select` | Dropdown with variant option values |
| Instance swap slot | `relationship` or `blocks` | Reference to another block type or media |
| Image fill / image frame | `upload` with `relationTo: 'media'` | Image upload field via `imageFields` factory |
| Color property | Token reference | Map to CSS Custom Property, not a hardcoded color field |
| Number property | `number` | Numeric input for dimensions, counts |
| URL/link text | `group` with link fields | Link group factory (type, url, label, newTab) |
| Button instance(s) | `array` of link groups | Button/CTA array using `linkGroup` factory |

**Field organization follows tab-based pattern:**
1. **Content tab** (named `content`): richText, text fields, arrays of content items
2. **Media/Image tab**: image upload fields via `imageFields` factory
3. **CTA tab**: button/link groups when the block has call-to-action elements
4. **Settings tab** (unnamed): className, layoutMeta, type/variant selection, HTML tag

### Step 4: Map Variants to CVA Configuration

If the component has enum variants that affect visual presentation (e.g., size: sm/md/lg, style: primary/secondary, impact: high/medium/low):

- Map variant property name to block settings field (radio or select)
- Generate CVA (class-variance-authority) configuration for the renderer:

```typescript
import { cva } from 'class-variance-authority';

const heroVariants = cva(styles.hero, {
  variants: {
    type: {
      highImpact: styles['hero--high-impact'],
      mediumImpact: styles['hero--medium-impact'],
      lowImpact: styles['hero--low-impact'],
    },
  },
  defaultVariants: {
    type: 'highImpact',
  },
});
```

### Step 5: Handle Container Nesting

Consult `knowledge/payload-blocks.md` and `knowledge/payload-figma-mapping.md` Section 4.

**Maximum nesting: 2 levels** (Container > NestedContainer).

- If the Figma component contains structural wrappers around other block-type children, map outer wrapper to `Container` and inner wrappers to a restricted nested container.
- Container block uses the `blocks` field type to hold child blocks.
- Map Figma Auto Layout properties to Container settings:
  - `layoutMode: HORIZONTAL` --> `settings.layout = 'row'`
  - `layoutMode: VERTICAL` --> `settings.layout = 'col'`
  - `primaryAxisAlignItems` --> `settings.justifyContent` (Tailwind utility string)
  - `counterAxisAlignItems` --> `settings.alignItems` (Tailwind utility string)
  - `itemSpacing` --> `settings.gap` (snap to nearest option)
- Settings are stored as Tailwind utility class strings (Layer 1 of CSS architecture).

**Nesting rules:**
- Container (level 1) can contain any block type including NestedContainer
- NestedContainer (level 2) can contain content blocks but NOT another container
- Never nest deeper than 2 levels -- flatten if the Figma structure goes deeper

### Step 6: Configure Lexical Rich Text

Consult `knowledge/payload-blocks.md` for Lexical configuration patterns.

Restrict Lexical editor features based on block type:

| Block Type | Lexical Features Allowed |
|-----------|------------------------|
| Hero | Heading (h1-h2), paragraph, bold, italic, link, text color |
| Card | Heading (h3-h4), paragraph, bold, italic, link |
| RichText | Full feature set (all headings, lists, blockquote, code, media) |
| Button | None (use `text` field, not richText) |
| Stats | Heading (h2-h3), paragraph, bold |
| Testimonial | Paragraph, bold, italic |
| CallToAction | Heading (h2-h3), paragraph, bold, italic, link |
| Default | Paragraph, bold, italic, link |

### Step 7: Generate Block Config

Produce the PayloadCMS block config `.ts` file:

```typescript
import { Block } from 'payload';
import { imageFields } from '@/admin/fields/imageFields';
import { linkGroup } from '@/admin/fields/linkGroup';
import { settingTabs } from './settingTabs';

export const Hero: Block = {
  slug: 'hero',
  labels: {
    singular: 'Hero',
    plural: 'Heroes',
  },
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Content',
          name: 'content',
          fields: [
            {
              name: 'richText',
              type: 'richText',
              label: false,
              // Lexical config with restricted features
            },
            ...linkGroup({ appearances: ['default', 'outline'] }),
          ],
        },
        {
          label: 'Media',
          fields: [...imageFields()],
        },
        settingTabs,
      ],
    },
  ],
};
```

**Config conventions:**
- Export as named constant matching block name (PascalCase)
- Use `slug` in camelCase
- Organize fields in tabs (Content, Media, CTA, Settings)
- Use field factories (`imageFields`, `linkGroup`, `layoutMeta`) for reusable patterns
- Settings tab fields are stored at block root (no `name` on the tab)

### Step 8: Generate React Renderer

Produce the renderer `.tsx` file:

```tsx
import React from 'react';
import styles from './Hero.module.css';
import { RichText } from '@/components/RichText';
import { Media } from '@/components/Media';
import { CMSLink } from '@/components/Link';
import type { HeroBlock } from './types';

export function HeroRenderer({ block }: { block: HeroBlock }) {
  const { content, image, settings } = block;

  return (
    <section
      className={`flex flex-col items-center justify-center gap-6 p-8 ${styles.hero} ${styles[`hero--${settings?.type}`] || ''}`}
    >
      {image?.image && (
        <div className={`absolute inset-0 ${styles.hero__media}`}>
          <Media resource={image.image} fill />
        </div>
      )}
      <div className={`relative z-10 flex flex-col items-center gap-4 ${styles.hero__content}`}>
        {content?.richText && <RichText data={content.richText} />}
        {content?.buttonGroup?.length > 0 && (
          <div className="flex gap-4">
            {content.buttonGroup.map((btn, i) => (
              <CMSLink key={i} {...btn.link} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
```

**Renderer conventions:**
- Named export (not default) with `{BlockName}Renderer` naming
- Tailwind classes for layout (Layer 1)
- CSS Module classes for visual styling (Layer 3)
- CSS Custom Properties consumed via CSS Module (Layer 2)
- Null-safe access for all optional fields
- Semantic HTML elements based on block type

### Step 9: Generate CSS Module

Produce the `.module.css` file following the three-layer architecture:

```css
/* Hero Block — Visual Skin (Layer 3) */
/* Layout handled by Tailwind in JSX */
/* Tokens consumed from tokens.css (Layer 2) */

.hero {
  background-color: var(--color-surface);
  min-height: 60vh;
  position: relative;
  overflow: hidden;
}

.hero--highImpact {
  min-height: 80vh;
}

.hero--mediumImpact {
  min-height: 60vh;
}

.hero--lowImpact {
  min-height: 40vh;
}

.hero__media {
  opacity: 0.3;
}

.hero__content {
  max-width: 48rem;
  text-align: center;
}

.hero__content h1,
.hero__content h2 {
  color: var(--color-text-primary);
  font-family: var(--font-heading);
}

.hero__content p {
  color: var(--color-text-secondary);
  font-size: var(--text-lg);
}
```

**CSS Module rules:**
- Only visual properties (colors, backgrounds, borders, effects, typography skin)
- All color values via `var()` references to CSS Custom Properties (never hardcoded)
- BEM-style naming within the module (flat: `.block__element`, never `.block__element__sub`)
- Variant modifiers as `.block--variant` classes
- Layout (flexbox, gap, padding, sizing) stays in Tailwind classes in JSX

### Step 10: Generate TypeScript Types

```typescript
import type { Media as MediaType } from '@/payload-types';

export interface HeroBlock {
  blockType: 'hero';
  content?: {
    richText?: any; // Lexical root node
    buttonGroup?: Array<{
      link: {
        type: 'reference' | 'custom';
        url?: string;
        reference?: { relationTo: 'pages'; value: string };
        label: string;
        newTab?: boolean;
        appearance?: 'default' | 'outline';
      };
    }>;
  };
  image?: {
    image?: string | MediaType;
  };
  settings?: {
    type?: 'highImpact' | 'mediumImpact' | 'lowImpact';
    className?: string;
    layoutMeta?: {
      marginTop?: string;
      marginBottom?: string;
      paddingTop?: string;
      paddingBottom?: string;
    };
  };
}
```

## Output

Generate four files for the mapped block:

### 1. `config.ts` -- PayloadCMS Block Definition

- Block slug, labels, tab-based field organization
- Field factories for reusable patterns (imageFields, linkGroup, layoutMeta)
- Lexical editor restricted per block type
- Settings fields with variant options stored as Tailwind utility strings

### 2. `Renderer.tsx` -- React Renderer Component

- Named export with `{BlockName}Renderer` naming
- Tailwind layout classes in JSX (Layer 1)
- CSS Module visual classes from companion `.module.css` (Layer 3)
- Null-safe field access
- Semantic HTML elements

### 3. `{BlockName}.module.css` -- CSS Module

- Visual skin only (colors, backgrounds, effects, typography overrides)
- All values via `var()` CSS Custom Property references (Layer 2)
- BEM naming (flat hierarchy, no deep nesting)
- Variant modifier classes

### 4. `types.ts` -- TypeScript Interfaces

- Block interface with `blockType` discriminant
- Optional fields for all non-required content
- Proper Media and reference types

### Output Checklist

Before returning the block implementation, verify:

- [ ] Block type matches with stated confidence score
- [ ] Container nesting does not exceed 2 levels
- [ ] Settings fields use Tailwind utility class strings (not raw CSS values)
- [ ] Lexical editor features are restricted appropriately for the block type
- [ ] Field factories are used for reusable patterns (not duplicated field definitions)
- [ ] CSS Module contains only visual properties (no layout)
- [ ] All color values use `var()` references (no hardcoded colors)
- [ ] BEM class names are flat (never `block__element__sub`)
- [ ] Renderer handles null/undefined for all optional fields
- [ ] Tab organization follows convention: Content, Media, CTA, Settings
- [ ] Block slug is camelCase and unique
- [ ] Variant mapping uses CVA pattern when applicable
