# Coding Conventions

**Analysis Date:** 2026-02-09

## Naming Patterns

**Files:**
- kebab-case for all files (`initial-agent.md`, `agent-rewritten-01.md`)
- Numbered suffixes for versioned specs (`-01`, `-02`, etc.)

**Functions (from code examples in specs):**
- camelCase: `getComponentCode`, `generateReactComponent`, `extractStyles`, `generateJSX`
- No special prefix for async functions
- Descriptive verb-noun pattern: `extractColors`, `generateDesignTokens`

**Variables (from code examples):**
- camelCase: `fileKey`, `nodeId`, `headers`
- SCREAMING_SNAKE_CASE for env vars: `FIGMA_TOKEN`, `FIGMA_WEBHOOK_SECRET`
- No underscore prefix convention

**Types (from code examples):**
- PascalCase for interfaces: `FigmaNode`, `ComponentInfo`, `DesignTokens`, `Variable`, `VariableCollection`
- No `I` prefix on interfaces
- PascalCase for type aliases

## Code Style

**Formatting (inferred from code examples):**
- 2 space indentation
- Single quotes for strings
- Template literals for interpolation
- Semicolons required
- Trailing commas in objects/arrays

**Linting:**
- Not configured (no `.eslintrc`, `.prettierrc`, `biome.json`)

## Import Organization

**Pattern (from code examples):**
- ES6 modules with named exports: `export function ComponentName() { }`
- No path aliases configured

## Error Handling

**Current pattern in specs:**
- Minimal - code examples lack try/catch and response validation
- Audit (`initial-agent-audit.md`) flags this as a critical gap

**Recommended pattern (from audit):**
- Validate `response.ok` before parsing JSON
- Wrap async operations in try/catch
- Check for undefined on nested property access

## Logging

**Framework:**
- Not specified

## Comments

**Style (from code examples):**
- Single-line `//` comments for clarification
- Inline comments for mapping explanations
- No JSDoc/TSDoc patterns observed

## Function Design

**Parameters (from code examples):**
- Positional parameters: `getComponentCode(fileKey: string, nodeId: string)`
- Destructuring for complex objects: `const { width, height } = node.absoluteBoundingBox`

**Return Values:**
- Explicit TypeScript return types: `Promise<string>`, `Promise<ComponentInfo[]>`
- Async/await pattern throughout

## Module Design

**Exports (from code examples):**
- Named exports preferred: `export function`
- No barrel file pattern observed

---

*Convention analysis: 2026-02-09*
*Update when implementation establishes real conventions*
