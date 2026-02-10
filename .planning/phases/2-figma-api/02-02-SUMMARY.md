---
phase: 2-figma-api
plan: 02
subsystem: figma-api-knowledge
tags: [plugin-api, devmode, codegen, scenenode, ipc, dev-resources]

# Dependency graph
requires:
  - 01-01 (foundation — directory structure, module conventions)
  - 02-01 (REST API reference — terminology, cross-references)
provides:
  - knowledge/figma-api-plugin.md — Plugin API sandbox, SceneNode types, IPC patterns
  - knowledge/figma-api-devmode.md — Dev Mode codegen system, Dev Resources API
affects: [02-03, 6-plugin-dev, 7-skills-install]

# Tech tracking
tech-stack:
  added: []
  patterns: [plugin-sandbox-model, ipc-message-pattern, codegen-plugin-pattern, dev-resources-api-pattern]

key-files:
  created: [knowledge/figma-api-plugin.md, knowledge/figma-api-devmode.md]
  modified: []

key-decisions:
  - "Standard plugins: editorType ['figma'] — codegen plugins: editorType ['dev'] (separated into distinct modules)"
  - "Dev Resources POST uses plural 'dev_resources' array"
  - "IPC patterns documented with correlation ID and network proxy patterns"
  - "Codegen preferences system documented (unit, select, action types)"

patterns-established:
  - "Plugin sandbox: main thread (document access) + UI iframe (browser context)"
  - "IPC messaging with correlation IDs for request-response patterns"
  - "Codegen plugin lifecycle: generate callback → CodegenResult[]"
  - "Dev Resources CRUD for linking components to code repos"
  - "Standard vs codegen comparison table for quick reference"

issues-created: []

# Metrics
duration: 9min
completed: 2026-02-09
---

# Phase 2 Plan 02: Plugin API & Dev Mode/Codegen Knowledge Modules

**Created Plugin API reference (920 lines) covering sandbox model, SceneNode hierarchy, and IPC patterns; Dev Mode/Codegen reference (893 lines) covering codegen plugins, Dev Resources API, and code generation patterns.**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-02-09T16:54:54Z
- **Completed:** 2026-02-09T17:03:25Z
- **Tasks:** 2
- **Files created:** 2

## Accomplishments

- Created `knowledge/figma-api-plugin.md` (920 lines) — complete Plugin API reference with:
  - Sandbox model (main thread + UI iframe with communication diagram)
  - SceneNode type hierarchy with full type tree and mixin table
  - FrameNode vs GroupNode, ComponentNode vs InstanceNode distinctions
  - Key Plugin API methods (document access, node retrieval, creation, export, plugin data, variables)
  - IPC messaging patterns (basic, correlation ID, network proxy)
  - Standard plugin manifest with correct `editorType: ["figma"]`
  - Plugin constraints (sandbox, data limits, performance)
  - `@create-figma-plugin` tooling patterns

- Created `knowledge/figma-api-devmode.md` (893 lines) — complete Dev Mode/Codegen reference with:
  - Dev Mode overview and relationship to Design Mode
  - Codegen plugin manifest with correct `editorType: ["dev"]` + `capabilities: ["codegen"]`
  - `figma.codegen` API (generate callback, CodegenEvent, CodegenResult, async patterns)
  - Codegen preferences system (unit, select, action types)
  - Code generation patterns (React, multi-language, layout CSS, component instances)
  - Dev Resources REST API (all 4 CRUD endpoints)
  - Dev Mode annotations and "Ready for dev" status
  - Standard vs codegen comparison table

## Audit Corrections Applied

All corrections from `archive/initial-agent-audit.md`:

1. Standard plugin manifest: `editorType: ["figma"]` — NOT `["dev"]` (4 instances confirmed)
2. Codegen plugin manifest: `editorType: ["dev"]` with `capabilities: ["codegen"]` — NOT `["figma", "figjam"]` (8 instances confirmed)
3. Dev Resources POST: `dev_resources` plural array — NOT singular `dev_resource`
4. Standard plugins and codegen plugins clearly separated into distinct modules with comparison table

## Task Commits

Each task was committed atomically:

1. **Task 1: Create figma-api-plugin.md** — `47bdb13`
2. **Task 2: Create figma-api-devmode.md** — `2a6f260`

## Files Created

- `knowledge/figma-api-plugin.md` — 920 lines. Plugin API reference covering sandbox model, SceneNode hierarchy, API methods, IPC patterns, manifest, constraints.
- `knowledge/figma-api-devmode.md` — 893 lines. Dev Mode and Codegen reference covering codegen manifests, codegen API, Dev Resources REST, code generation patterns.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## Next Steps

- Phase 2 Plan 03 (`02-03-PLAN.md`) — Webhooks v2 module + cross-module verification
- Phase 6 — Plugin Development module will build on both plugin.md and devmode.md
- Phase 7 — Skills will consume all Plugin API and Dev Mode knowledge

---
*Phase: 2-figma-api*
*Completed: 2026-02-09*
