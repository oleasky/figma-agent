# Knowledge Modules

Modular knowledge files optimized for Claude Code `@file` reference consumption. Each module is a self-contained reference document that can be @referenced independently.

## Naming Convention

Files follow `{domain}-{topic}.md` format:
- `figma-api-rest.md` -- Figma REST API reference
- `design-to-code-layout.md` -- Auto Layout to Flexbox mapping
- `css-strategy.md` -- Layered CSS approach documentation

## Module Structure

Each knowledge file follows this structure:

1. **Title** -- Clear module name
2. **Purpose** -- What knowledge this module contains
3. **When to Use** -- Scenarios where this module should be @referenced
4. **Content** -- The knowledge itself (rules, mappings, patterns, examples)
5. **Cross-References** -- Related modules to consult for full context

## Available Modules (19)

### Figma API (5 modules)
- `figma-api-rest.md` -- REST API endpoints, authentication, pagination, rate limits, node structure
- `figma-api-plugin.md` -- Plugin API sandbox model, SceneNode types, IPC patterns, manifest format
- `figma-api-variables.md` -- Variables API (collections, modes, bound variables, fallbacks)
- `figma-api-webhooks.md` -- Webhooks v2 format, event types, verification
- `figma-api-devmode.md` -- Dev Mode, codegen plugins, Dev Resources API

### Design-to-Code (5 modules)
- `design-to-code-layout.md` -- Auto Layout → Flexbox mapping (sizing modes, alignment, spacing)
- `design-to-code-visual.md` -- Visual property extraction (fills, strokes, effects, gradients)
- `design-to-code-typography.md` -- Text extraction (font mapping, line height, text styles)
- `design-to-code-assets.md` -- Asset management (vector containers, image dedup, SVG export)
- `design-to-code-semantic.md` -- Semantic HTML generation (element selection, ARIA, BEM naming)

### CSS Strategy & Design Tokens (3 modules)
- `css-strategy.md` -- Layered CSS approach (Tailwind + CSS Custom Properties + CSS Modules)
- `design-tokens.md` -- Token extraction (threshold-based promotion, CSS variable naming)
- `design-tokens-variables.md` -- Figma Variables deep dive (modes, fallback chains, scopes)

### PayloadCMS Integration (3 modules)
- `payload-blocks.md` -- Block system (config, fields, renderers, type generation, plugins)
- `payload-figma-mapping.md` -- Figma component → block mapping patterns
- `payload-visual-builder.md` -- Visual builder plugin architecture

### Plugin Development (3 modules)
- `plugin-architecture.md` -- Plugin sandbox model, IPC, @create-figma-plugin patterns
- `plugin-codegen.md` -- Codegen plugin patterns (Dev Mode integration)
- `plugin-best-practices.md` -- Production patterns for Figma plugins

## Usage

Reference any module in your project's `CLAUDE.md` or inline:

```
@/path/to/figma-code-agent/knowledge/figma-api-rest.md
@/path/to/figma-code-agent/knowledge/design-to-code-layout.md
```

Skills in `skills/` automatically @reference the knowledge modules they depend on.
