# Figma Agent

A Claude Code plugin that provides expert-level Figma design-to-code knowledge through 19 knowledge modules and 6 invokable skills.

## What It Does

Figma Agent turns Claude into a Figma expert. It encodes production-proven patterns for:

- **Figma API usage** — REST API, Plugin API, Variables API, Webhooks, Dev Mode
- **Design-to-code generation** — Auto Layout to Flexbox, visual properties, typography, assets, semantic HTML
- **Design tokens** — Extraction, naming, CSS Custom Properties, Tailwind config, mode-aware rendering
- **PayloadCMS integration** — Block mapping, field factories, container nesting, visual builder
- **Plugin development** — Architecture, error handling, performance, caching, async patterns, testing

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

### Manual (requires clone)

```bash
# Symlink all skills to ~/.claude/skills/
./install.sh
```

## Skills

After installation, invoke skills directly in Claude Code:

| Skill | What It Does |
|-------|-------------|
| `/figma-agent:interpret-layout` | Convert Figma Auto Layout to CSS Flexbox |
| `/figma-agent:generate-react` | Generate a React/TSX component from Figma node data |
| `/figma-agent:generate-html` | Generate semantic HTML + CSS from Figma node data |
| `/figma-agent:extract-tokens` | Extract design tokens into CSS variables + Tailwind config |
| `/figma-agent:map-payload-block` | Map a Figma component to a PayloadCMS block |
| `/figma-agent:audit-plugin` | Audit a Figma plugin against production best practices |

### Example

```
/figma-agent:generate-react <paste Figma node JSON or describe the component>
```

Each skill loads the relevant knowledge modules automatically and follows a structured multi-step process to produce accurate output.

## Knowledge Modules

19 modules organized by domain, usable as standalone `@file` references in any project:

| Domain | Modules | Topics |
|--------|---------|--------|
| Figma API | 5 | REST API, Plugin API, Variables, Webhooks, Dev Mode |
| Design-to-Code | 5 | Layout, Visual, Typography, Assets, Semantic HTML |
| CSS & Tokens | 3 | Three-layer CSS, Token extraction, Variables-to-CSS bridge |
| PayloadCMS | 3 | Block system, Figma-to-block mapping, Visual builder |
| Plugin Dev | 3 | Architecture, Codegen plugins, Best practices |

Reference any module directly in your project:

```
@/path/to/figma-agent/knowledge/design-to-code-layout.md
```

## Project Structure

```
figma-agent/
  bin/
    install.js           # npx installer (copies files to ~/.claude/)
  .claude-plugin/
    plugin.json          # Claude Code plugin manifest
  skills/
    interpret-layout/    # Auto Layout -> Flexbox
    generate-react/      # Figma -> React/TSX component
    generate-html/       # Figma -> HTML + CSS
    extract-tokens/      # Figma -> CSS variables + Tailwind
    map-payload-block/   # Figma -> PayloadCMS block
    audit-plugin/        # Plugin quality audit
  knowledge/             # 19 standalone knowledge modules
  package.json           # npm package for npx installation
```

## CSS Strategy

Generated CSS follows a three-layer architecture:

1. **Tailwind** — Layout structure (flexbox, spacing, sizing)
2. **CSS Custom Properties** — Design tokens (colors, typography, radii, shadows)
3. **CSS Modules** — Visual skin (component-specific styles)

## License

MIT
