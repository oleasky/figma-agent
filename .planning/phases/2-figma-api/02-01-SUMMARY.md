---
phase: 2-figma-api
plan: 01
subsystem: figma-api-knowledge
tags: [rest-api, variables-api, authentication, rate-limits, design-tokens]

# Dependency graph
requires:
  - 01-01 (foundation — directory structure, module conventions)
provides:
  - knowledge/figma-api-rest.md — Authoritative Figma REST API reference
  - knowledge/figma-api-variables.md — Authoritative Figma Variables API reference
affects: [02-02, 02-03, 3-design-to-code, 4-css-tokens, 7-skills-install]

# Tech tracking
tech-stack:
  added: []
  patterns: [figma-rest-api-patterns, variables-api-patterns, token-extraction-patterns]

key-files:
  created: [knowledge/figma-api-rest.md, knowledge/figma-api-variables.md]
  modified: []

key-decisions:
  - "Image export endpoint: use /v1/images/:file_key (renders nodes) and /v1/files/:key/images (image fills)"
  - "/components and /styles endpoints return published library content ONLY — documented as critical pitfall"
  - "Variables API requires Enterprise org full member access — documented as first constraint"
  - "Token extraction priority: Variables API > published styles > file traversal > Plugin API"
  - "Rate limits documented with full tier table by plan/seat type"

patterns-established:
  - "FigmaClient class pattern for typed API access with retry logic"
  - "Variable alias resolution pattern (recursive chain following)"
  - "Multi-mode CSS generation (class-based, media query, layered)"
  - "boundVariables traversal for detecting token-driven properties"
  - "Figma URL parsing with node ID format conversion (hyphen to colon)"

issues-created: []

# Metrics
duration: 12min
completed: 2026-02-09
---

# Phase 2 Plan 01: Figma REST API & Variables API Knowledge Modules

**Created two foundational API reference modules: REST API (742 lines) covering auth, endpoints, node structure, rate limits, and pitfalls; Variables API (847 lines) covering access, data model, resolution, theming, and token extraction patterns.**

## Performance

- **Duration:** ~12 min
- **Completed:** 2026-02-09
- **Tasks:** 2
- **Files created:** 2

## Accomplishments

- Created `knowledge/figma-api-rest.md` (742 lines) — complete REST API reference with:
  - Authentication (PATs, OAuth2 flow, all 21 token scopes)
  - Core endpoints (files, nodes, images, components, styles) with correct paths and parameters
  - Node tree structure with TypeScript interfaces for layout properties
  - Rate limit tiers table (by plan and seat type) with backoff strategy
  - URL parsing utilities and 10 documented common pitfalls
  - TypeScript FigmaClient helper class

- Created `knowledge/figma-api-variables.md` (847 lines) — complete Variables API reference with:
  - Access requirements (Enterprise org full members, specific scopes)
  - All 3 endpoints (GET local, GET published, POST) with constraints
  - Full data model (Variable, VariableCollection, VariableAlias, VariableScope, VariableCodeSyntax)
  - Variable resolution mechanics (alias chains, mode fallbacks, boundVariables)
  - Multi-mode theming patterns (light/dark, brand, layered) with CSS output
  - Practical extraction patterns (color tokens, dictionary builder, usage detection, CSS generation)

## Audit Corrections Applied

All corrections from `archive/initial-agent-audit.md` have been applied:

1. `/files/:file_key/components` and `/styles` — documented as returning **published library assets only** with workaround for finding all components
2. Image export — documented both `/v1/images/:file_key` (node rendering) and `/v1/files/:key/images` (image fills) with correct semantics
3. Variables API — explicitly states **Enterprise org full member** access requirement with specific scopes
4. Rate limits — full tier table with plan/seat breakdown, leaky bucket algorithm, 429 handling
5. Node IDs — documented hyphen-to-colon format conversion between URLs and API

## Task Commits

Each task was committed atomically:

1. **Task 1: Create figma-api-rest.md** — `3bab55b`
2. **Task 2: Create figma-api-variables.md** — `dca370c`

## Files Created

- `knowledge/figma-api-rest.md` — 742 lines. REST API reference covering auth, all major endpoints, node structure, rate limits, pitfalls, and helper utilities.
- `knowledge/figma-api-variables.md` — 847 lines. Variables API reference covering access, data model, resolution, theming patterns, and practical extraction code.

## Deviations from Plan

None. Both modules follow the prescribed structure (title, purpose, when-to-use, content, cross-references) and cover all required topics.

## Issues Encountered

None.

## Verification Checklist

- [x] Both files exist in knowledge/ directory
- [x] Both follow the module structure convention (title, purpose, when-to-use, content, cross-references)
- [x] REST module covers: auth, file/node/image/component/style endpoints, node structure, rate limits, pitfalls
- [x] Variables module covers: access requirements, endpoints, data model, resolution, modes, practical patterns
- [x] All audit corrections from initial-agent-audit.md applied
- [x] No real secrets or API keys in any file (all use YOUR_FIGMA_TOKEN or process.env.FIGMA_TOKEN)
- [x] Cross-references between modules are accurate

## Next Steps

- Phase 2 Plan 02 (`02-02-PLAN.md`) — Plugin API, Webhooks, and Dev Mode knowledge modules
- Phase 3 — Design-to-code modules will consume the node structure and layout properties from `figma-api-rest.md`
- Phase 4 — Token modules will build on the Variables API patterns from `figma-api-variables.md`

---
*Phase: 2-figma-api*
*Completed: 2026-02-09*
