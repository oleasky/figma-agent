# Figma Agent Skills

Claude Code invokable skills for Figma design-to-code workflows.

## Plugin Format

This agent uses the Claude Code plugin format (`.claude-plugin/plugin.json`). Skills live in `skills/{name}/SKILL.md`.

## Available Skills

| Skill | Command | Description | Knowledge Modules |
|-------|---------|-------------|-------------------|
| Interpret Layout | `/figma-agent:interpret-layout` | Interpret Figma Auto Layout → CSS Flexbox with correct sizing modes | layout |
| Generate React | `/figma-agent:generate-react` | Generate production-grade React/TSX component from Figma node data | layout, visual, typography, assets, semantic, css-strategy |
| Generate HTML | `/figma-agent:generate-html` | Generate semantic HTML + layered CSS from Figma node data | layout, visual, typography, assets, semantic, css-strategy, design-tokens |
| Extract Tokens | `/figma-agent:extract-tokens` | Extract design tokens → CSS custom properties + Tailwind config | design-tokens, design-tokens-variables, figma-api-variables, css-strategy |
| Map PayloadCMS Block | `/figma-agent:map-payload-block` | Map Figma component → PayloadCMS block config + renderer + types | payload-blocks, payload-figma-mapping, payload-visual-builder, css-strategy |
| Audit Plugin | `/figma-agent:audit-plugin` | Audit Figma plugin code against production best practices | plugin-architecture, plugin-codegen, plugin-best-practices, figma-api-plugin |

## Installation

```bash
# Recommended: install as Claude Code plugin
claude plugin add /path/to/figma-agent

# Fallback: manual symlinks
./install.sh
```

## Skill Structure

Each skill file follows this structure:

1. **YAML frontmatter** -- `name` and `description` for Claude Code registration
2. **@references** -- Knowledge modules the skill depends on
3. **Objective** -- What the skill accomplishes
4. **Input** -- What the user provides (Figma node data, file URL, etc.)
5. **Process** -- Step-by-step instructions for Claude
6. **Output** -- What gets generated (React component, CSS, token config, etc.)

## Invocation Examples

```
# Interpret a Figma Auto Layout frame
/figma-agent:interpret-layout <paste Figma Auto Layout JSON node data>

# Generate a React component from Figma design
/figma-agent:generate-react <paste Figma node data or describe the component>

# Generate vanilla HTML + CSS from Figma design
/figma-agent:generate-html <paste Figma node data>

# Extract design tokens from Figma Variables
/figma-agent:extract-tokens <paste Figma Variables API response or style data>

# Map a Figma component to a PayloadCMS block
/figma-agent:map-payload-block <paste Figma component data>

# Audit a Figma plugin codebase
/figma-agent:audit-plugin <path to Figma plugin project>
```
