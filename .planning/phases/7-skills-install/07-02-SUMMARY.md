---
phase: 7-skills-install
plan: 02
subsystem: skills
tags: [claude-code, skills, figma, tokens, payload-cms, plugin-audit, variables-api, design-tokens]

# Dependency graph
requires:
  - phase: 04-css-tokens
    provides: Design tokens extraction pipeline, CSS strategy, variable resolution (3 modules)
  - phase: 05-payload-cms
    provides: PayloadCMS blocks, Figma mapping, visual builder (3 modules)
  - phase: 06-plugin-dev
    provides: Plugin architecture, codegen patterns, best practices (3 modules)
  - phase: 07-01
    provides: Skill format pattern established (interpret-layout, generate-react, generate-html)
provides:
  - extract-tokens skill (Figma Variables/styles → CSS custom properties + Tailwind config)
  - map-payload-block skill (Figma component → PayloadCMS block config + renderer + types)
  - audit-plugin skill (Plugin code → audit report with 7+ section ratings)
affects: [07-03-installer, claude-skills-installation]

# Tech tracking
tech-stack:
  added: []
  patterns: [token-extraction-pipeline, confidence-scoring, audit-report-format]

key-files:
  created:
    - commands/figma/extract-tokens.md
    - commands/figma/map-payload-block.md
    - commands/figma/audit-plugin.md

key-decisions:
  - "extract-tokens documents Variables API fallback path for non-Enterprise plans"
  - "map-payload-block uses multi-signal confidence scoring with 0.6-0.95 range against 18-type catalog"
  - "audit-plugin covers 9 sections total: 7 best practices + codegen-specific + architecture"
  - "All three skills reference 4 knowledge modules each"

patterns-established:
  - "Token extraction priority chain: Variables API > styles > file traversal > Plugin API"
  - "Block mapping confidence thresholds: 0.9+ auto-map, 0.8-0.89 flag-optional, 0.7-0.79 human-review, <0.7 require-confirmation"
  - "Audit report format: summary table + detailed findings per section + priority fixes"

issues-created: []

# Metrics
duration: 7min
completed: 2026-02-09
---

# Phase 7 Plan 2: Specialized Skills Summary

**Three specialized Claude Code skills created: extract-tokens (4 modules), map-payload-block (4 modules), audit-plugin (4 modules) -- encoding token extraction, CMS mapping, and plugin auditing as executable prompts**

## Performance

- **Duration:** 7 min
- **Started:** 2026-02-09T22:39:56Z
- **Completed:** 2026-02-09T22:47:38Z
- **Tasks:** 3
- **Files created:** 3

## Accomplishments

- Created `extract-tokens` skill with 8-step pipeline: source identification, variable resolution, mode detection, threshold promotion, HSL naming, spacing scale, CSS/Tailwind rendering, SCSS optional output
- Created `map-payload-block` skill with 10-step pipeline: component analysis, confidence scoring against 18-type catalog, property-to-field mapping, CVA variants, container nesting (max 2 levels), Lexical restriction, block config + renderer + CSS Module + types generation
- Created `audit-plugin` skill with 9-section audit framework: 7 best practice sections (error handling, performance, memory, caching, async, testing, distribution) + codegen-specific + architecture checks, each rated pass/warn/fail with specific code references
- All skills reference 4 knowledge modules each (no content duplication)
- Key domain rules encoded: Variables API Enterprise requirement with fallback path, HSL color format, 4px spacing base, container nesting limits, Lexical restriction per block type, 3-second codegen timeout

## Task Commits

Each task was committed atomically:

1. **Task 1: Create extract-tokens skill** - `6acfada` (feat)
2. **Task 2: Create map-payload-block skill** - `2de4cae` (feat)
3. **Task 3: Create audit-plugin skill** - `222c8d9` (feat)

## Files Created/Modified

- `commands/figma/extract-tokens.md` -- Token extraction skill (347 lines)
- `commands/figma/map-payload-block.md` -- PayloadCMS block mapping skill (415 lines)
- `commands/figma/audit-plugin.md` -- Plugin audit skill (244 lines)

## Decisions Made

- extract-tokens handles both Variables API (Enterprise) and file traversal (all plans) paths, with explicit fallback documentation
- map-payload-block generates 4 output files (config, renderer, CSS Module, types) to match the reference project's block directory pattern
- audit-plugin expanded from 7 to 9 sections by adding codegen-specific and architecture checks as separate sections
- All audit findings require specific file:line references and fix code examples (no generic advice)

## Deviations from Plan

- audit-plugin added Section 8 (Codegen-Specific) and Section 9 (Architecture) as separate audit sections beyond the 7 best practice sections. The plan mentioned these as additional checks; they were given dedicated sections for clarity in the audit report format.

## Issues Encountered

None.

## Next Phase Readiness

- All 6 skills created (3 from 07-01 + 3 from 07-02), ready for 07-03 (installer script)
- Full skill suite: interpret-layout, generate-react, generate-html, extract-tokens, map-payload-block, audit-plugin

---
*Phase: 7-skills-install*
*Completed: 2026-02-09*
