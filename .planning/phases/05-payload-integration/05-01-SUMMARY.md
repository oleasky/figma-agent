---
phase: 05-payload-integration
plan: 01
subsystem: payload
tags: [payloadcms, blocks, lexical, cms, figma-mapping, cva, css-modules, design-tokens]

# Dependency graph
requires:
  - phase: 03-design-to-code
    provides: Layout, visual, typography, asset, and semantic HTML mapping rules
  - phase: 04-css-tokens
    provides: Three-layer CSS strategy, token extraction pipeline, variable resolution
provides:
  - PayloadCMS block system reference (18 block types, field factories, rendering patterns)
  - Figma component → PayloadCMS block mapping decision tree with confidence scores
  - Container nesting rules and flattening strategy
  - Design token bridge (Figma variables → tokens.css → CSS Modules)
  - CVA variant mapping pattern
  - Rich text extraction pipeline (Figma text → Lexical editor nodes)
  - Complete page mapping example (Figma JSON → PayloadCMS block tree)
affects: [payload-visual-builder, plugin-development, claude-skills]

# Tech tracking
tech-stack:
  added: [payloadcms-3.x, lexical-editor, cva]
  patterns: [block-tab-pattern, field-factory-pattern, container-nesting, token-consumption-via-css-modules]

key-files:
  created:
    - knowledge/payload-blocks.md
    - knowledge/payload-figma-mapping.md
  modified: []

key-decisions:
  - "Container max nesting depth: 2 levels (Container > NestedContainer) to prevent schema recursion"
  - "Block settings stored as Tailwind utility classes (gap-4, items-center) for Layer 1 CSS"
  - "Lexical feature restriction per block type (Card reduced, StickyCTA minimal, Testimonial headings-only)"
  - "Component-to-block mapping uses confidence scores and multi-signal heuristics"
  - "Nesting flattening: single-child wrappers and pure-text containers are collapsed"

patterns-established:
  - "Block tab organization: Content/Settings/Media/CTA tabs"
  - "Field factory reuse: imageTabs, linkGroup(), link, className, layoutMeta"
  - "Token fallback: var(--token-category-name, hardcoded-default) in every CSS Module"
  - "CVA variant pattern: Figma component variants → select/radio field → CSS Module modifier classes"

issues-created: []

# Metrics
duration: 13min
completed: 2026-02-09
---

# Phase 5 Plan 1: PayloadCMS Block System & Figma Mapping Summary

**PayloadCMS block catalog (18 types) from reference PayloadCMS project with Figma component → block mapping decision tree, property mapping tables, and complete page mapping example**

## Performance

- **Duration:** 13 min
- **Started:** 2026-02-09T19:00:34Z
- **Completed:** 2026-02-09T19:14:16Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Complete PayloadCMS block system reference with 18 block types, 5 field factories, rendering registry, and token integration patterns
- Figma component → PayloadCMS block mapping decision tree with 15 heuristic rules and confidence scores
- Property-to-field mapping tables for Hero, Container, Card, RichText, Button, Media, Accordion, Tabs, Stats, Carousel
- Container nesting rules with flattening strategy (single-child collapse, pure-text collapse, depth limit)
- Rich text extraction pipeline: Figma styled segments → Lexical heading/paragraph/list/link nodes
- Complete page mapping example walking through Hero + Features(Cards) + CTA → full PayloadCMS JSON

## Task Commits

Each task was committed atomically:

1. **Task 1: Create PayloadCMS block system knowledge module** - `998f8fe` (feat)
2. **Task 2: Create Figma-to-PayloadCMS mapping knowledge module** - `645e992` (feat)

**Plan metadata:** (this commit) (docs: complete plan)

## Files Created/Modified
- `knowledge/payload-blocks.md` — PayloadCMS block system reference (1184 lines): architecture, fields, catalog, container deep-dive, rendering, Lexical config, token integration
- `knowledge/payload-figma-mapping.md` — Figma→PayloadCMS mapping rules (1210 lines): decision tree, property mapping, nesting, tokens, CVA variants, rich text, media, complete example

## Decisions Made
- Container max nesting depth is 2 levels (Container > NestedContainer) — prevents Payload schema recursion while allowing meaningful layout hierarchy
- Block settings stored as Tailwind utility class strings — directly embeds Layer 1 CSS in block data
- Lexical editor restricted per block type — prevents inappropriate content in constrained contexts
- Mapping uses multi-signal confidence scoring — combines frame name, structure, dimensions, and content to determine block type

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered
None

## Next Phase Readiness
- Block system and mapping foundations complete, ready for 05-02 (Visual Builder + cross-verification)
- payload-blocks.md and payload-figma-mapping.md both reference payload-visual-builder.md (coming in 05-02)
- All cross-references to existing modules are in place

---
*Phase: 05-payload-integration*
*Completed: 2026-02-09*
