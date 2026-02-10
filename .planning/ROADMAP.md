# Roadmap — Figma Agent v1

## Milestone Overview

Build the definitive Figma knowledge base and Claude Code skill system — encoding production plugin patterns, Figma API expertise, design-to-code rules, and PayloadCMS integration patterns — delivered as modular knowledge files and invokable Claude skills.

## Phases

### Phase 1: Foundation & Archive ✓
**Status:** Complete (2026-02-09) — 1/1 plans executed

**Goal:** Set up project structure, archive old specs, establish conventions for knowledge modules and skills.

**Deliverables:**
- ✓ `archive/` directory with old specs (`initial-agent.md`, `initial-agent-audit.md`, `agent-rewritten-01.md`)
- ✓ `knowledge/` directory structure with README conventions
- ✓ `commands/figma/` directory structure for skills
- ✓ Project-level `CLAUDE.md` with @references and usage guide
- ✓ `.env.example` with placeholder values

---

### Phase 2: Figma API Knowledge Module ✓
**Status:** Complete (2026-02-09) — 3/3 plans executed

**Goal:** Create the authoritative Figma API reference covering REST API, Plugin API, Variables API, Webhooks v2, and Dev Mode/Codegen plugins.

**Deliverables:**
- ✓ `knowledge/figma-api-rest.md` — REST API endpoints, authentication, pagination, rate limits, node structure
- ✓ `knowledge/figma-api-plugin.md` — Plugin API sandbox model, SceneNode types, IPC patterns, manifest format
- ✓ `knowledge/figma-api-variables.md` — Variables API (collections, modes, bound variables, fallbacks, resolving)
- ✓ `knowledge/figma-api-webhooks.md` — Webhooks v2 format, event types, verification, context/context_id
- ✓ `knowledge/figma-api-devmode.md` — Dev Mode, codegen plugins, Dev Resources API

**Research:** Verify all endpoints/types against current Figma developer docs (2025/2026). Cross-reference with the production plugin's actual API usage.

**Estimated effort:** Large

---

### Phase 3: Design-to-Code Knowledge Module ✓
**Status:** Complete (2026-02-09) — 4/4 plans executed

**Goal:** Encode the production plugin's hard-won design-to-code interpretation rules — the core intelligence that maps Figma node properties to production CSS/HTML/React.

**Deliverables:**
- ✓ `knowledge/design-to-code-layout.md` — Auto Layout → Flexbox mapping (sizing modes, alignment, spacing, wrap, constraints, min/max, GROUP vs FRAME coordinates)
- ✓ `knowledge/design-to-code-visual.md` — Visual property extraction (fills, strokes, effects, corners, gradients, blend modes, opacity, gradient angle conversion)
- ✓ `knowledge/design-to-code-typography.md` — Text extraction (font mapping, line height, letter spacing, text decoration, text case, text auto-resize)
- ✓ `knowledge/design-to-code-assets.md` — Asset management (vector container detection, image dedup, SVG export, multi-factor detection heuristics)
- ✓ `knowledge/design-to-code-semantic.md` — Semantic HTML generation (element selection rules, ARIA, BEM class naming, responsive frame matching)

**Research:** Deep analysis of the production plugin's `src/extraction/` and `src/generation/` modules. Extract every mapping rule into documented knowledge.

**Estimated effort:** Extra Large — this is the crown jewel

---

### Phase 4: CSS Strategy & Design Tokens Module ✓
**Status:** Complete (2026-02-09) — 2/2 plans executed

**Goal:** Document the layered CSS strategy and design token extraction/promotion system.

**Deliverables:**
- ✓ `knowledge/css-strategy.md` — Layered approach (Tailwind bones + CSS Custom Properties tokens + CSS Modules skin), specificity management, when to use each layer
- ✓ `knowledge/design-tokens.md` — Token extraction from Figma (Variables API integration, threshold-based promotion, CSS variable naming, Tailwind config generation)
- ✓ `knowledge/design-tokens-variables.md` — Figma Variables deep dive (bound variables, modes, fallback chains, collection structure, variable scopes)

**Research:** The production plugin's `src/tokens/` module patterns. Tailwind CSS custom property integration docs.

**Estimated effort:** Medium

---

### Phase 5: PayloadCMS Integration Module ✓
**Status:** Complete (2026-02-09) — 2/2 plans executed

**Goal:** Document the Figma → PayloadCMS block mapping patterns — how design components become CMS blocks with fields, renderers, and types.

**Deliverables:**
- ✓ `knowledge/payload-blocks.md` — PayloadCMS block system (block config, fields, renderers, type generation, plugins, Lexical editor integration)
- ✓ `knowledge/payload-figma-mapping.md` — Figma component → PayloadCMS block mapping (component properties → block fields, variants → CVA, instances → block references, design tokens → tokens.css)
- ✓ `knowledge/payload-visual-builder.md` — Visual builder plugin architecture (inline editing, drag-drop, container nesting, live preview, Server/Client component split)

**Research:** Reference PayloadCMS project's block system, visual builder plugin architecture, PayloadCMS 3.x plugin API docs.

**Estimated effort:** Large

---

### Phase 6: Plugin Development Module ✓
**Status:** Complete (2026-02-09) — 2/2 plans executed

**Goal:** Document Figma plugin development best practices from production experience.

**Deliverables:**
- ✓ `knowledge/plugin-architecture.md` — Plugin architecture (sandbox model, IPC messaging, @create-figma-plugin, data flow pipeline)
- ✓ `knowledge/plugin-codegen.md` — Codegen plugin patterns (Dev Mode integration, `editorType: ["dev"]`, code generation, preferences)
- ✓ `knowledge/plugin-best-practices.md` — Production patterns (error handling, performance, memory management, caching strategies)

**Estimated effort:** Medium

---

### Phase 7: Claude Skills & Installation ✓
**Status:** Complete (2026-02-09) — 3/3 plans executed

**Goal:** Build all invokable Claude Code skills that consume the knowledge modules, plus installer for easy setup.

**Deliverables:**
- `commands/figma/interpret-layout.md` — Interpret Figma Auto Layout → CSS Flexbox with correct sizing modes
- `commands/figma/generate-react.md` — Generate production-grade React/TSX component from Figma node data
- `commands/figma/generate-html.md` — Generate semantic HTML + layered CSS from Figma node data
- `commands/figma/extract-tokens.md` — Extract design tokens from Figma Variables/styles → CSS custom properties + Tailwind config
- `commands/figma/map-payload-block.md` — Map Figma component → PayloadCMS block config + renderer + types
- `commands/figma/audit-plugin.md` — Audit Figma plugin code against production best practices
- `install.sh` — Installer script (symlinks commands to `~/.claude/commands/figma/`, validates structure)
- Updated `CLAUDE.md` with skill documentation and @reference paths

**Research:** Claude Code skill invocation patterns, @reference resolution behavior.

**Estimated effort:** Large

---

## Phase Dependencies

```
Phase 1 (Foundation) ──┬──> Phase 2 (Figma API)
                       ├──> Phase 3 (Design-to-Code) ──> Phase 4 (CSS/Tokens)
                       ├──> Phase 5 (PayloadCMS)
                       └──> Phase 6 (Plugin Dev)

Phases 2-6 ──> Phase 7 (Skills & Installation)
```

- **Phase 1** must complete first (establishes structure and conventions)
- **Phases 2, 3, 5, 6** can run in parallel after Phase 1
- **Phase 4** depends on Phase 3 (CSS strategy builds on design-to-code mapping knowledge)
- **Phase 7** depends on all knowledge modules (skills consume the knowledge files)

## Success Criteria

- All knowledge modules verified against current Figma developer documentation
- Production plugin patterns faithfully encoded (not spec assumptions)
- Skills are invokable via `/figma:skill-name` in Claude Code
- Knowledge files are @referenceable independently
- Layered CSS strategy documented with clear guidance for both the production plugin and reference project use cases
- No secrets, API keys, or credentials in any file

---
*Created: 2026-02-09*
*Milestone: v1 — Knowledge Base & Skills*
