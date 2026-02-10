# Figma Agent

## What This Is

A comprehensive knowledge base and Claude Code skill system that serves as the definitive expert on Figma APIs, design-to-code interpretation, React/HTML/CSS code generation, and PayloadCMS integration. The agent is consumed by Claude Code via @file references and invokable skills, powering development of Figma plugins, web applications with Figma integrations, and any project that needs Figma expertise.

## Core Value

The agent must be THE authoritative source of Figma design-to-code knowledge — encoding hard-won production patterns, correct API usage, production-grade code generation rules, and integration patterns — so Claude can act as an elite Figma expert and pair-programmer in any project.

## Requirements

### Validated

- ✓ Figma REST API documentation (endpoints, node structures, properties) — existing specs
- ✓ Figma Plugin API patterns (sandbox model, IPC, manifest) — existing specs + the production plugin
- ✓ Auto Layout → Flexbox mapping (layout modes, sizing, alignment) — production plugin code
- ✓ Visual property extraction (fills, strokes, effects, corners, gradients) — production plugin code
- ✓ Design token extraction and promotion (CSS variables, threshold-based) — production plugin code
- ✓ Figma Variables API integration (bound variables, modes, fallbacks) — production plugin code
- ✓ HTML/CSS code generation pipeline (extraction → interpretation → generation) — production plugin code
- ✓ Asset management (vector containers, image dedup, SVG export) — production plugin code
- ✓ PayloadCMS block system understanding (blocks, fields, rendering, plugins) — reference PayloadCMS project
- ✓ Visual builder plugin architecture (inline editing, drag-drop, container nesting) — reference PayloadCMS project

### Active

- [ ] Knowledge module: Figma API reference (REST + Plugin API + Variables + Webhooks v2)
- [ ] Knowledge module: Design-to-code mapping rules (from the production plugin's patterns)
- [ ] Knowledge module: Design tokens and variables (extraction, CSS vars, Tailwind integration)
- [ ] Knowledge module: PayloadCMS integration (Figma component → block + React component mapping)
- [ ] Knowledge module: CSS strategy (layered approach: Tailwind bones + CSS vars tokens + CSS Modules skin)
- [ ] Knowledge module: Plugin development patterns (architecture, IPC, manifest, codegen plugins)
- [ ] Skill: Interpret Figma layout (Auto Layout → CSS Flexbox with correct sizing modes)
- [ ] Skill: Generate React component (from Figma node data → production-grade TSX + styles)
- [ ] Skill: Generate HTML/CSS (from Figma node data → semantic HTML + layered CSS)
- [ ] Skill: Extract design tokens (from Figma Variables/styles → CSS custom properties + Tailwind config)
- [ ] Skill: Map PayloadCMS block (Figma component → block config + renderer component + types)
- [ ] Skill: Audit Figma plugin (review plugin code against production best practices)
- [ ] Archive existing specs (move initial-agent.md, audit, rewritten to archive/)
- [ ] Installer/setup for skills (install commands to ~/.claude/commands/figma/)

### Out of Scope

- Modifying the production plugin code directly — the agent informs plugin development, doesn't execute changes itself
- Modifying reference project code directly — same principle, agent provides knowledge not edits
- MCP server / executable tooling — v1 is knowledge docs + skills; MCP can come later
- Two-way Figma sync (Code → Figma) — v1 focuses on Figma → Code direction
- Building the actual PayloadCMS Figma importer plugin — the agent documents the mapping patterns, projects build the plugin
- Editing Figma files or executing Figma API calls — the agent is knowledge, not a runtime tool

## Context

### Source Codebases (Knowledge Sources)

**The Production Plugin**
- A production Figma plugin: extract → interpret → export HTML/CSS
- Hard-won knowledge: Auto Layout → Flexbox, vector containers, sizing modes (HUG/FILL/FIXED), design token promotion, responsive frame matching, semantic HTML generation, BEM class naming, gradient angle conversion, GROUP vs FRAME coordinate systems
- Architecture: @create-figma-plugin, Preact UI, sandboxed IPC, TypeScript
- Key modules: `src/extraction/`, `src/generation/`, `src/tokens/`, `src/export/`

**Reference PayloadCMS Project**
- PayloadCMS 3.x + Next.js with visual builder plugin
- Block system: Hero, Container, Card, Button, RichText, Video, Accordion, Tabs, Stats, Testimonial, CallToAction, etc.
- Visual builder: extracted plugin architecture
- Container-first architecture mirrors Figma Auto Layout
- Planned Figma importer features
- CSS: tokens.css (custom properties) + CSS Modules per block

**Existing Figma Agent Specs** (this repo)
- `initial-agent.md` — original spec with code examples (has inaccuracies)
- `initial-agent-audit.md` — audit identifying 6 major issues
- `agent-rewritten-01.md` — corrected v2 spec (still missing the production plugin's real-world patterns)
- To be archived and superseded by the new knowledge base

### CSS Strategy Decision

**Layered CSS approach** (decided during initialization):
1. **Tailwind CSS** — structural layout bones (flexbox, spacing, sizing) at zero specificity
2. **CSS Custom Properties** — design tokens bridge (colors, typography, spacing, radii, shadows)
3. **CSS Modules** — visual design skin (Figma-specific styles, overridable by frontend devs)

This allows: production-style token extraction, CSS Modules isolation, and Tailwind's layout utility benefits — all in one system.

### Technology Research Completed

- PayloadCMS 3.x: blocks, fields, plugins, Lexical editor, live preview, type generation
- Figma APIs: REST API endpoints, Plugin API node types, Variables API, Webhooks v2, Dev Mode codegen
- React/Next.js: Function components, CVA variants, Server/Client components, App Router patterns
- Design-to-code: Auto Layout → Flexbox, sizing modes, constraints, gradient mapping, stroke alignment

## Constraints

- **Consumer**: Primary consumer is Claude Code (via @file references and /skill invocation). Structure must be optimized for Claude context consumption.
- **Delivery**: Skills installed to `~/.claude/commands/figma/`. Knowledge files @referenced by skills.
- **Accuracy**: All Figma API information must be verified against 2025/2026 docs. Production plugin patterns take precedence over spec assumptions.
- **Modularity**: Each knowledge file must be self-contained enough to be @referenced independently. Skills must declare their @references explicitly.
- **No secrets**: No API keys, tokens, or credentials in any knowledge or skill file.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Hybrid single-agent with modular skills | Cross-pollination between domains is the key value; modules CAN become independent agents later | — Pending |
| Archive existing specs, rebuild from scratch | Old specs have inaccuracies; the production plugin's real-world patterns are the authoritative source | — Pending |
| Layered CSS: Tailwind + CSS vars + CSS Modules | Serves both the production plugin (token system) and reference project (CSS Modules isolation) use cases | — Pending |
| Skills as delivery mechanism | Reusable across projects, invokable, composable via @references | — Pending |
| Knowledge optimized for Claude Code consumption | Primary user is Claude; structure for context window efficiency | — Pending |
| Both plugin dev AND interpretation logic | Agent must help build Figma plugins AND generate code from designs | — Pending |

---
*Last updated: 2026-02-09 after initialization*
