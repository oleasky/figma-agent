# Figma Agent — Knowledge Base & Skills

The definitive expert on Figma APIs, design-to-code interpretation, React/HTML/CSS code generation, and PayloadCMS integration — delivered as modular knowledge files and invokable Claude Code skills.

## What This Agent Does

This repository is THE authoritative source of Figma design-to-code knowledge for Claude Code. It encodes:

- **Production patterns** from a real-world Figma plugin (extract → interpret → export)
- **CMS integration patterns** from a PayloadCMS + Next.js project with visual builder
- **Verified API knowledge** from Figma developer documentation (2025/2026)

Use this agent as an expert reference for Figma plugin development, design-to-code generation, and CMS integration in any project.

## Knowledge Modules

| Module | Domain | When to @reference |
|--------|--------|--------------------|
| `knowledge/figma-api-rest.md` | Figma API | REST API calls, file/node fetching, image export |
| `knowledge/figma-api-plugin.md` | Figma API | Plugin development, sandbox model, SceneNode types |
| `knowledge/figma-api-variables.md` | Figma API | Variables API, design token resolution, modes |
| `knowledge/figma-api-webhooks.md` | Figma API | Webhook setup, event handling, verification |
| `knowledge/figma-api-devmode.md` | Figma API | Dev Mode, codegen plugins, Dev Resources |
| `knowledge/design-to-code-layout.md` | Design-to-Code | Auto Layout → Flexbox mapping, sizing modes, alignment, spacing, wrap, constraints, responsive |
| `knowledge/design-to-code-visual.md` | Design-to-Code | Fills, strokes, effects, gradients, corners, opacity, blend modes, variable bindings |
| `knowledge/design-to-code-typography.md` | Design-to-Code | Font mapping, text styles, line height, letter spacing, auto-resize, styled segments |
| `knowledge/design-to-code-assets.md` | Design-to-Code | Vector containers, image dedup, SVG export, CSS vs SVG decision tree |
| `knowledge/design-to-code-semantic.md` | Design-to-Code | Semantic HTML, ARIA, BEM naming, layered CSS integration, responsive |
| `knowledge/css-strategy.md` | CSS & Tokens | Three-layer CSS architecture (Tailwind + Custom Properties + CSS Modules), property placement, specificity, responsive, themes |
| `knowledge/design-tokens.md` | CSS & Tokens | Token extraction pipeline, threshold promotion, HSL color naming, spacing scales, CSS/SCSS/Tailwind rendering |
| `knowledge/design-tokens-variables.md` | CSS & Tokens | Figma Variables → token → CSS bridge, mode detection, variable resolution, mode-aware rendering, fallbacks |
| `knowledge/payload-blocks.md` | PayloadCMS | Block system, field types, reusable factories, container nesting, Lexical config, token consumption |
| `knowledge/payload-figma-mapping.md` | PayloadCMS | Figma component → PayloadCMS block mapping, property-to-field rules, token bridge, container nesting |
| `knowledge/payload-visual-builder.md` | PayloadCMS | Visual builder plugin, inline editing, dnd, history, save strategy, CSS architecture |
| `knowledge/plugin-architecture.md` | Plugin Dev | Project setup, IPC event system, data flow pipeline, UI architecture with @create-figma-plugin |
| `knowledge/plugin-codegen.md` | Plugin Dev | Codegen plugins, Dev Mode integration, preferences, responsive code generation |
| `knowledge/plugin-best-practices.md` | Plugin Dev | Error handling, performance, memory, caching, async patterns, testing, distribution |

## Skills

| Command | Description | Knowledge Modules |
|---------|-------------|-------------------|
| `/figma-agent:interpret-layout` | Interpret Auto Layout → CSS Flexbox | layout |
| `/figma-agent:generate-react` | Generate React/TSX from Figma node | layout, visual, typography, assets, semantic, css-strategy |
| `/figma-agent:generate-html` | Generate HTML + layered CSS | layout, visual, typography, assets, semantic, css-strategy, design-tokens |
| `/figma-agent:extract-tokens` | Extract design tokens → CSS vars + Tailwind | design-tokens, design-tokens-variables, figma-api-variables, css-strategy |
| `/figma-agent:map-payload-block` | Map Figma component → PayloadCMS block | payload-blocks, payload-figma-mapping, payload-visual-builder, css-strategy |
| `/figma-agent:audit-plugin` | Audit plugin against best practices | plugin-architecture, plugin-codegen, plugin-best-practices, figma-api-plugin |

## Installation

### npx (recommended)

```bash
# Install globally — available in all projects
npx figma-agent

# Install to current project only
npx figma-agent --local

# Remove installed files
npx figma-agent --uninstall
```

### Plugin mode (for development)

```bash
# Load directly when starting Claude Code
claude --plugin-dir /path/to/figma-agent
```

### Manual installation (requires clone)

```bash
# Symlink all skills
./install.sh

# Preview what would be installed
./install.sh --dry-run

# Overwrite existing symlinks
./install.sh --force

# Remove all installed skills
./install.sh --uninstall
```

## Usage

### Invoke skills

After installation, invoke skills in Claude Code:

```
/figma-agent:interpret-layout <paste Figma Auto Layout JSON>
/figma-agent:generate-react <paste Figma node data or describe component>
/figma-agent:generate-html <paste Figma node data>
/figma-agent:extract-tokens <paste Figma Variables API response>
/figma-agent:map-payload-block <paste Figma component data>
/figma-agent:audit-plugin <path to plugin codebase>
```

### Reference knowledge in other projects

Add to your project's `CLAUDE.md` or use inline @references:

```
@/path/to/figma-agent/knowledge/figma-api-rest.md
@/path/to/figma-agent/knowledge/design-to-code-layout.md
```

### Reference in project CLAUDE.md

```markdown
## Figma Expertise
This project uses the Figma Agent for design-to-code knowledge.
See: /path/to/figma-agent/CLAUDE.md
```

## CSS Strategy

**Layered approach** for generated CSS:

1. **Tailwind CSS** — Structural layout bones (flexbox, spacing, sizing) at zero specificity
2. **CSS Custom Properties** — Design tokens bridge (colors, typography, spacing, radii, shadows)
3. **CSS Modules** — Visual design skin (Figma-specific styles, overridable by frontend devs)

This serves both token extraction and CSS Modules isolation use cases. See `knowledge/css-strategy.md` for full details.

## Source Codebases

Knowledge in this agent is extracted from:

- **Production Figma Plugin** — Extract → interpret → export HTML/CSS. Hard-won patterns for Auto Layout mapping, vector container detection, design token promotion, and semantic HTML generation.
- **PayloadCMS + Next.js Project** — PayloadCMS 3.x with visual builder plugin. Container-first block architecture, CSS Modules + tokens.css design system, Figma importer patterns.
- **Figma Developer Documentation** — REST API, Plugin API, Variables API, Webhooks v2, Dev Mode/Codegen (2025/2026 verified).
