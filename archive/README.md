# Archive

Superseded specifications from the initial Figma agent design, kept for historical reference.

## Files

- **initial-agent.md** — Original Figma agent specification (~650 lines). Contains TypeScript code examples for REST API, Plugin API, design-to-code generation, webhooks, and codegen plugins.
- **initial-agent-audit.md** — Third-party audit identifying 6 major issues: incorrect API endpoints, outdated webhook format, mixed plugin manifest concepts, oversimplified code generation, and more.
- **agent-rewritten-01.md** — Corrected v2 specification addressing audit findings. Aligned with Figma API reality (2025/2026) but still missing real-world production patterns.

## Why Archived

All three specs have been superseded by the modular knowledge base in `knowledge/`. The new knowledge modules are:
- Verified against current Figma developer documentation
- Informed by production Figma plugin patterns
- Structured for Claude Code @file reference consumption
- Organized by domain for independent referencing
