---
phase: 7-skills-install
plan: 01
subsystem: skills
tags: [claude-code, skills, figma, design-to-code, react, html, css, flexbox, layout]

# Dependency graph
requires:
  - phase: 03-design-to-code
    provides: Layout, visual, typography, asset, and semantic HTML mapping rules (5 modules)
  - phase: 04-css-tokens
    provides: Three-layer CSS strategy, design tokens extraction, variable resolution (3 modules)
  - phase: 01-foundation
    provides: commands/figma/ directory structure, skill conventions
provides:
  - interpret-layout skill (Auto Layout → CSS Flexbox interpretation)
  - generate-react skill (Figma node → React/TSX + CSS Modules)
  - generate-html skill (Figma node → semantic HTML + layered CSS)
affects: [07-03-installer, claude-skills-installation]

# Tech tracking
tech-stack:
  added: []
  patterns: [skill-md-format, knowledge-reference-pattern, three-layer-css-in-skills]

key-files:
  created:
    - commands/figma/interpret-layout.md
    - commands/figma/generate-react.md
    - commands/figma/generate-html.md

key-decisions:
  - "Skills @reference knowledge modules, never duplicate content"
  - "interpret-layout references 1 module, generate-react references 6, generate-html references 7 (adds design-tokens)"
  - "All skills accept $ARGUMENTS as Figma node JSON or description"

patterns-established:
  - "Skill structure: YAML frontmatter (name, description) → @references → objective → input → process → output"
  - "Knowledge @reference pattern: @knowledge/{domain}-{topic}.md at top of skill file"

issues-created: []

# Metrics
duration: 4min
completed: 2026-02-09
---

# Phase 7 Plan 1: Core Design-to-Code Skills Summary

**Three Claude Code skills created: interpret-layout (1 module), generate-react (6 modules), generate-html (7 modules) — encoding full Figma→code pipeline as executable prompts**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-09T22:20:29Z
- **Completed:** 2026-02-09T22:25:26Z
- **Tasks:** 3
- **Files created:** 3

## Accomplishments

- Created `interpret-layout` skill with 8-step process for Auto Layout → CSS Flexbox (sizing modes, alignment, wrap, constraints, responsive)
- Created `generate-react` skill with 10-step pipeline for full React/TSX component generation with CSS Modules and three-layer CSS
- Created `generate-html` skill with 11-step pipeline for vanilla HTML + CSS with inline token extraction and layer separation
- All skills reference knowledge modules by path (no content duplication)
- Key design rules encoded in all skills: INSIDE strokes→inset box-shadow, gradient angle conversion, unitless line-height, 2x retina images, flat BEM

## Task Commits

Each task was committed atomically:

1. **Task 1: Create interpret-layout skill** - `7151b25` (feat)
2. **Task 2: Create generate-react skill** - `993f0a4` (feat)
3. **Task 3: Create generate-html skill** - `01b5251` (feat)

## Files Created/Modified

- `commands/figma/interpret-layout.md` — Auto Layout → Flexbox interpretation skill (150 lines)
- `commands/figma/generate-react.md` — React/TSX component generation skill (222 lines)
- `commands/figma/generate-html.md` — Semantic HTML + layered CSS generation skill (290 lines)

## Decisions Made

- Skills @reference knowledge modules, never duplicate content — keeps skills focused and knowledge maintainable
- generate-html gets an extra module (design-tokens.md) vs generate-react — HTML output includes inline `:root` token block
- All three skills share the same input flexibility: JSON, description, URL, or screenshot

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## Next Phase Readiness

- 3 of 6 skills created, ready for 07-02 (specialized skills: extract-tokens, map-payload-block, audit-plugin)
- Skill format pattern established and reusable for remaining 3 skills

---
*Phase: 7-skills-install*
*Completed: 2026-02-09*
