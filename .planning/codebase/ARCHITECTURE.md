# Architecture

**Analysis Date:** 2026-02-09

## Pattern Overview

**Overall:** Specification Repository (pre-implementation)

**Key Characteristics:**
- Documentation-first planning approach
- TypeScript code examples embedded in Markdown specifications
- Iterative spec refinement (original → audit → corrected v2)
- No implemented code yet

## Planned Architecture (from specifications)

The specifications in `agent-rewritten-01.md` describe an agent with these capabilities:

**Core Capabilities:**
- Figma file/node retrieval via REST API
- Layout interpretation and CSS generation
- Component code generation (React/TSX output)
- Design token extraction (CSS custom properties, Tailwind config)
- SVG icon export
- Webhook-based file change monitoring
- Plugin development (standard + Dev Mode codegen)

**Planned Layers:**

**API Client Layer:**
- Purpose: Communicate with Figma REST API
- Planned endpoints: `/v1/files/:key`, `/v1/files/:key/nodes`, `/v1/files/:key/variables/local`, `/v2/webhooks`
- Auth: Bearer token via `FIGMA_TOKEN` environment variable

**Code Generation Layer:**
- Purpose: Transform Figma nodes into React/TSX components
- Includes: Layout-to-CSS mapping, style extraction, JSX generation
- Key functions described: `generateReactComponent()`, `extractStyles()`, `generateJSX()`

**Token Extraction Layer:**
- Purpose: Extract design tokens from Figma Variables API
- Outputs: CSS custom properties, Tailwind config, JSON tokens
- Key functions described: `extractColors()`, `extractTypography()`, `generateDesignTokens()`

**Webhook/Plugin Layer:**
- Purpose: React to Figma file changes and provide in-editor codegen
- Includes: Webhook v2 listener, standard plugin, Dev Mode codegen plugin

## Data Flow

**Planned Design-to-Code Flow:**

1. Agent receives Figma file URL or node ID
2. API client fetches file/node data from Figma REST API
3. Node tree is traversed to extract layout, styles, components
4. Code generator maps Figma properties to CSS/React patterns
5. Output: React component files, CSS, design tokens

**State Management:**
- Stateless per-request (planned) - fetch from Figma API on each invocation

## Entry Points

**None implemented.** Planned entry points from specifications:
- CLI or programmatic API for file/component code generation
- HTTP endpoint for webhook reception
- Figma plugin manifest for in-editor codegen

## Error Handling

**Not yet implemented.** The audit (`initial-agent-audit.md`) notes that code examples lack:
- `response.ok` validation on fetch calls
- try/catch blocks around async operations
- Null checks on nested property access

## Cross-Cutting Concerns

**Authentication:**
- Planned: `X-Figma-Token` header with env var `FIGMA_TOKEN`

**Logging:**
- Not specified

**Validation:**
- Not specified (audit flags missing input validation as a concern)

---

*Architecture analysis: 2026-02-09*
*Update when implementation begins*
