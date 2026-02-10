# Project State — Figma Agent

## Current Status

| Field | Value |
|-------|-------|
| **Milestone** | v1 — Knowledge Base & Skills |
| **Current Phase** | 7 — Claude Skills & Installation |
| **Phase Status** | Complete (3/3 plans) |
| **Next Action** | /gsd:complete-milestone |
| **Blockers** | None |

## Current Position

Phase: 7 of 7 (Claude Skills & Installation)
Plan: 3 of 3 in current phase
Status: Phase complete — MILESTONE COMPLETE
Last activity: 2026-02-09 — Completed 07-03-PLAN.md

Progress: ████████████ 100%

## Phase Progress

| Phase | Name | Status | Started | Completed |
|-------|------|--------|---------|-----------|
| 1 | Foundation & Archive | complete | 2026-02-09 | 2026-02-09 |
| 2 | Figma API Knowledge Module | complete (3/3) | 2026-02-09 | 2026-02-09 |
| 3 | Design-to-Code Knowledge Module | complete (4/4) | 2026-02-09 | 2026-02-09 |
| 4 | CSS Strategy & Design Tokens Module | complete (2/2) | 2026-02-09 | 2026-02-09 |
| 5 | PayloadCMS Integration Module | complete (2/2) | 2026-02-09 | 2026-02-09 |
| 6 | Plugin Development Module | complete (2/2) | 2026-02-09 | 2026-02-09 |
| 7 | Claude Skills & Installation | complete (3/3) | 2026-02-09 | 2026-02-09 |

## Decisions

| Phase | Decision | Rationale |
|-------|----------|-----------|
| 1 | Knowledge module naming: `{domain}-{topic}.md` | Consistent, readable, grep-friendly |
| 1 | Skill invocation: `/figma:skill-name` | Matches Claude Code command conventions |
| 1 | Module structure: title → purpose → when-to-use → content → cross-refs | Self-contained for independent @referencing |
| 2 | Image export: `/v1/images/:key` (renders nodes) vs `/v1/files/:key/images` (image fills) | Different endpoints for different use cases |
| 2 | `/components` and `/styles` are published-only | Must traverse file tree for local components |
| 2 | Variables API: Enterprise org full member access required | Documented as first constraint |
| 2 | Token extraction priority: Variables API > styles > file traversal > Plugin API | Variables API is most structured source |
| 2 | Standard plugins: `editorType: ["figma"]`, codegen: `editorType: ["dev"]` | Fundamentally different plugin types |
| 2 | Dev Resources POST uses plural `dev_resources` array | Audit correction applied |
| 2 | Webhooks v2: context/context_id scoping, NOT deprecated team_id | Audit correction applied |
| 2 | 7 webhook event types including PING and DEV_MODE_STATUS_UPDATE | Complete event coverage |
| 3 | INSIDE strokes → box-shadow: inset (not border) | Avoids affecting element dimensions |
| 3 | Gradient angle: atan2 transform → 90 - figmaAngle | Correct CSS degree conversion from Figma matrix |
| 3 | 4-step variable resolution: paint→node→token lookup→raw hex | Complete fallback chain for visual properties |
| 3 | Line height always → unitless ratio (lineHeightPx / fontSize) | Scales correctly with font-size changes |
| 3 | Vector container = all children vector-compatible types | Clean CSS vs SVG export decision |
| 3 | Image exports at 2x minimum for retina | Modern screen density requirement |
| 3 | BEM flat hierarchy: never block__element__sub | Prevents over-nesting, cleaner class names |
| 3 | Three-layer CSS: Tailwind + Custom Props + Modules | Layout bones, tokens, visual skin separation |
| 5 | Container max nesting: 2 levels (Container > NestedContainer) | Prevents Payload schema recursion |
| 5 | Block settings stored as Tailwind utility class strings | Embeds Layer 1 CSS directly in block data |
| 5 | Lexical editor restricted per block type | Prevents inappropriate content in constrained blocks |
| 5 | Mapping uses multi-signal confidence scores | Combines frame name, structure, dimensions, content |
| 5 | Visual builder: direct API save, NOT form state | Avoids re-render cascades during visual editing |
| 5 | Container adapter abstracts all nesting logic | Single source of truth for container operations |
| 5 | Edit block registry: `registerEditBlock(slug, Component)` | Extensible per-block visual editing |

| 6 | Architecture vs API separation: Phase 6 = development patterns, Phase 2 = API reference | No duplication between knowledge layers |
| 6 | 3-stage data flow pipeline: extraction → generation → export | JSON-serializable intermediate format crosses IPC boundary |
| 6 | Codegen 3-second timeout strategy with progressive complexity | Prevents codegen plugins from being killed |
| 6 | 7-section best practices: error handling, performance, memory, caching, async, testing, distribution | Covers all production-critical plugin concerns |
| 6 | Production patterns from the reference plugin, not generic advice | Ensures actionable, battle-tested knowledge |
| 7 | Skills @reference knowledge modules, never duplicate content | Keeps skills focused, knowledge maintainable |
| 7 | interpret-layout: 1 module, generate-react: 6, generate-html: 7 (adds design-tokens) | Graduated complexity per skill scope |
| 7 | All skills accept $ARGUMENTS as JSON, description, URL, or screenshot | Flexible input for diverse workflows |
| 7 | extract-tokens: Variables API fallback path for non-Enterprise plans | File traversal + threshold promotion as alternative |
| 7 | map-payload-block: confidence thresholds 0.9+ auto, 0.7-0.89 flag, <0.7 confirm | Graduated automation based on match certainty |
| 7 | audit-plugin: 9 sections (7 best practices + codegen + architecture) | Codegen and architecture separated for clarity |
| 7 | install.sh uses parallel indexed arrays for bash 3.2 compat | macOS default bash compatibility |
| 7 | Skills installed via symlink to ~/.claude/skills/figma-{name}/SKILL.md | Updates propagate automatically from repo |

## Deferred Issues

None.

## Session Notes

- **2026-02-09:** Project initialized. Roadmap created with 7 phases.
- **2026-02-09:** Phase 1 complete — archived specs, created directory structure, CLAUDE.md, conventions.
- **2026-02-09:** Phase 2 planned — 3 plans (REST+Variables, Plugin+DevMode, Webhooks+Verification), 6 tasks total.
- **2026-02-09:** 02-01 complete — REST API (742 lines) + Variables API (847 lines) knowledge modules created.
- **2026-02-09:** 02-02 complete — Plugin API (920 lines) + Dev Mode/Codegen (893 lines) knowledge modules created.
- **2026-02-09:** 02-03 complete — Webhooks v2 (876 lines) + cross-module verification. Phase 2 complete (5 modules, ~4,278 lines total).
- **2026-02-09:** Phase 3 planned — 4 plans (Layout, Visual, Typography+Assets, Semantic+Verification), 8 tasks. Sources: production plugin code + archive specs.
- **2026-02-09:** 03-01 complete — Auto Layout → CSS Flexbox knowledge module (928 lines). Sizing modes, responsive patterns, constraint handling.
- **2026-02-09:** 03-02 complete — Visual properties knowledge module (1144 lines). Fills, gradients, strokes, effects, color tokens.
- **2026-02-09:** 03-03 complete — Typography (1001 lines) + Asset management (855 lines) knowledge modules.
- **2026-02-09:** 03-04 complete — Semantic HTML (1084 lines) + cross-module verification. Phase 3 complete (5 modules, ~4,952 lines total).
- **2026-02-09:** Phase 4 planned — 2 plans (CSS Strategy+Tokens, Variables Deep Dive), 4 tasks.
- **2026-02-09:** 04-01 complete — CSS Strategy (972 lines) + Design Tokens (959 lines) knowledge modules created.
- **2026-02-09:** 04-02 complete — Design Tokens Variables (1261 lines) + cross-verification + CLAUDE.md update. Phase 4 complete (3 modules, ~3,192 lines total).
- **2026-02-09:** 05-01 complete — PayloadCMS Blocks (1184 lines) + Figma Mapping (1210 lines) knowledge modules created. 18 block types cataloged, mapping decision tree with confidence scores.
- **2026-02-09:** 05-02 complete — Visual Builder (1004 lines) + Phase 5 cross-verification + CLAUDE.md update. Phase 5 complete (3 modules, ~3,398 lines total).
- **2026-02-09:** Phase 6 planned — 2 plans (Architecture+Codegen, Best Practices+Verification), 4 tasks.
- **2026-02-09:** 06-01 complete — Plugin Architecture (1175 lines) + Codegen Patterns (1312 lines) knowledge modules created. Type-safe IPC, 3-stage pipeline, codegen lifecycle documented.
- **2026-02-09:** 06-02 complete — Best Practices (1206 lines) + Phase 6 cross-verification + CLAUDE.md update. Phase 6 complete (3 modules, ~3,693 lines total).
- **2026-02-09:** Phase 7 planned — 3 plans (Core Skills, Specialized Skills, Installer+Finalization), 8 tasks.
- **2026-02-09:** 07-01 complete — 3 core design-to-code skills created: interpret-layout (150 lines), generate-react (222 lines), generate-html (290 lines).
- **2026-02-09:** 07-02 complete — 3 specialized skills created: extract-tokens (347 lines), map-payload-block (415 lines), audit-plugin (244 lines).
- **2026-02-09:** 07-03 complete — install.sh (226 lines) + CLAUDE.md/README updates + cross-verification (0 broken refs). Phase 7 complete. MILESTONE v1 COMPLETE.

---
*Last updated: 2026-02-09*
