# Codegen Plugin Development Patterns

## Purpose

Production-tested patterns for building Figma codegen plugins — covering the full development lifecycle from manifest setup through code generation, output quality, and Dev Mode integration. This module documents **how to build** codegen plugins that generate clean, production-ready code. For the codegen API reference (types, methods, events), see `figma-api-devmode.md`. For general plugin architecture patterns (IPC, project structure, data flow), see `plugin-architecture.md`.

## When to Use

Reference this module when you need to:

- Build a codegen plugin that generates code from Figma designs in Dev Mode
- Implement the `figma.codegen.on('generate', ...)` callback with production patterns
- Set up codegen preferences (unit conversion, CSS strategy selection)
- Generate multi-language output (React/TSX, Vue, HTML + CSS, Tailwind)
- Ensure generated code quality (validation, sanitization, formatting)
- Decide between building a standard plugin vs codegen plugin vs both
- Implement responsive code generation from multiple design variants
- Link generated code back to Figma nodes through Dev Resources

---

## Content

### Codegen Plugin Setup

#### Manifest Configuration

Codegen plugins use `editorType: ["dev"]` with `capabilities: ["codegen"]`. This makes the plugin available exclusively in Dev Mode's Inspect panel.

```json
{
  "name": "My Codegen Plugin",
  "id": "YOUR_PLUGIN_ID",
  "api": "1.0.0",
  "main": "code.js",
  "editorType": ["dev"],
  "documentAccess": "dynamic-page",
  "capabilities": ["codegen"],
  "codegenLanguages": [
    { "label": "React (TSX)", "value": "react" },
    { "label": "HTML + CSS", "value": "html-css" },
    { "label": "Tailwind", "value": "tailwind" }
  ]
}
```

> **Critical:** Codegen plugins **must** use `editorType: ["dev"]`. Using `["figma"]` creates a standard plugin that runs in design mode, not a codegen plugin. This is the most common setup error.

#### @create-figma-plugin Setup for Codegen

When using `@create-figma-plugin`, configure the `figma-plugin` section in `package.json`:

```json
{
  "figma-plugin": {
    "name": "My Codegen Plugin",
    "id": "YOUR_PLUGIN_ID",
    "editorType": ["dev"],
    "main": "src/main.ts",
    "documentAccess": "dynamic-page",
    "capabilities": ["codegen"],
    "codegenLanguages": [
      { "label": "React (TSX)", "value": "react" },
      { "label": "HTML + CSS", "value": "html-css" }
    ]
  }
}
```

> **No UI entry:** Codegen plugins typically do not have a `ui` entry because their output renders directly in the Inspect panel. However, if you need a hidden iframe for browser API access (fetch, complex processing) or action preferences, you can add `"ui": "src/ui.tsx"` and use `figma.showUI()` at runtime.

#### Build Toolchain

The build setup is identical to standard plugins:

```json
{
  "scripts": {
    "build": "build-figma-plugin --typecheck --minify",
    "watch": "build-figma-plugin --typecheck --watch"
  },
  "dependencies": {
    "@create-figma-plugin/utilities": "^4.0.3"
  },
  "devDependencies": {
    "@create-figma-plugin/build": "^4.0.3",
    "@create-figma-plugin/tsconfig": "^4.0.3",
    "@figma/plugin-typings": "1.109.0",
    "typescript": ">=5"
  }
}
```

Note that `@create-figma-plugin/ui` and `preact` are only needed if your codegen plugin uses a UI for action preferences. For pure code generation, utilities alone suffice.

---

### Codegen Plugin Lifecycle

#### The Generate Callback

The generate callback is the heart of every codegen plugin. It fires whenever a user selects a node in Dev Mode with your plugin's language active:

```ts
figma.codegen.on('generate', async (event: CodegenEvent): Promise<CodegenResult[]> => {
  const { node, language } = event;

  // Route to language-specific generator
  switch (language) {
    case 'react':
      return generateReact(node);
    case 'html-css':
      return generateHTMLCSS(node);
    case 'tailwind':
      return generateTailwind(node);
    default:
      return [{
        title: 'Unsupported',
        code: `// Language "${language}" not yet supported`,
        language: 'PLAINTEXT',
      }];
  }
});
```

#### CodegenEvent and CodegenResult

```ts
interface CodegenEvent {
  node: SceneNode;     // The selected node in Dev Mode
  language: string;    // Value from codegenLanguages in manifest
}

interface CodegenResult {
  title: string;       // Section title in Inspect panel
  code: string;        // Generated code
  language: 'TYPESCRIPT' | 'CSS' | 'HTML' | 'JSON' | 'PLAINTEXT' | /* ... */;
}
```

Return an array of `CodegenResult` to produce multiple code sections. Each result becomes a separate collapsible section in the Inspect panel with syntax highlighting:

```ts
return [
  { title: 'Component.tsx', code: tsxCode, language: 'TYPESCRIPT' },
  { title: 'Component.module.css', code: cssCode, language: 'CSS' },
  { title: 'tokens.css', code: tokensCode, language: 'CSS' },
];
```

#### The 3-Second Timeout

The generate callback has a **hard 3-second timeout**. If the callback does not return within 3 seconds, Figma cancels it. This constraint shapes the entire architecture:

- **Pre-cache data** during `preferenceschange` events, not during generation
- **Keep generation synchronous** where possible
- **Limit tree traversal depth** to prevent deep recursion on complex nodes
- **Avoid network calls** in the generate path (pre-fetch data via action preferences)

```ts
// BAD: Slow generation that may timeout
figma.codegen.on('generate', async ({ node }) => {
  const allNodes = figma.currentPage.findAll(() => true); // Slow!
  const mappings = await fetchMappings('https://api.example.com/map'); // Network!
  return generateCode(node, allNodes, mappings);
});

// GOOD: Fast generation with pre-cached data
let cachedMappings: Record<string, string> = {};

figma.codegen.on('preferenceschange', async (event) => {
  if (event.propertyName === 'Component Mapping') {
    figma.showUI(__html__, { width: 500, height: 400 });
  }
});

figma.ui.on('message', async (msg) => {
  if (msg.type === 'MAPPINGS_UPDATED') {
    cachedMappings = msg.mappings;
    await figma.clientStorage.setAsync('mappings', cachedMappings);
    figma.ui.hide();
    figma.codegen.refresh();
  }
});

figma.codegen.on('generate', ({ node }) => {
  return generateCode(node, cachedMappings); // Fast, no I/O
});
```

---

### Preferences System

Codegen preferences let users customize code output without modifying the plugin. They appear in the Dev Mode Inspect panel alongside the language selector.

#### Unit Preferences

Allow users to choose CSS units and set a scale factor for conversion:

```json
{
  "itemType": "unit",
  "propertyName": "Size Unit",
  "scaledUnit": "rem",
  "defaultScaleFactor": 16,
  "includedLanguages": ["react", "html-css"]
}
```

Access in the generate callback:

```ts
figma.codegen.on('generate', ({ node }) => {
  const unit = figma.codegen.preferences.unit;       // "rem" or "px"
  const scale = figma.codegen.preferences.scaleFactor; // 16

  function convertSize(px: number): string {
    if (unit === 'rem') return `${(px / scale).toFixed(3).replace(/\.?0+$/, '')}rem`;
    if (unit === 'em') return `${(px / scale).toFixed(3).replace(/\.?0+$/, '')}em`;
    return `${px}px`;
  }

  const width = convertSize(node.width);
  // ...
});
```

#### Select Preferences

Dropdown options for code generation strategy:

```json
{
  "itemType": "select",
  "propertyName": "CSS Strategy",
  "options": [
    { "label": "CSS Modules", "value": "modules", "isDefault": true },
    { "label": "Tailwind CSS", "value": "tailwind" },
    { "label": "Styled Components", "value": "styled" },
    { "label": "Inline Styles", "value": "inline" }
  ],
  "includedLanguages": ["react"]
}
```

Access via `figma.codegen.preferences['CSS Strategy']`.

Common select preference patterns:

| Preference | Options | Use Case |
|-----------|---------|----------|
| CSS Strategy | Modules, Tailwind, Styled, Inline | React styling approach |
| Naming Convention | BEM, camelCase, kebab-case | Class name format |
| Token Mode | CSS Variables, SCSS Variables, None | Design token output |
| Export Mode | Component, Page Section, Full Page | Scope of generation |
| Include Comments | Yes, No | Code documentation |

#### Action Preferences

For complex configuration that requires a custom UI (component mapping tables, token overrides):

```json
{
  "itemType": "action",
  "propertyName": "Component Mapping",
  "label": "Configure Mappings"
}
```

When the user clicks the action button, handle it with the `preferenceschange` event:

```ts
figma.codegen.on('preferenceschange', async (event) => {
  if (event.propertyName === 'Component Mapping') {
    // Show a configuration UI
    figma.showUI(__html__, { width: 500, height: 400 });
  }
});

figma.ui.on('message', async (msg) => {
  if (msg.type === 'CONFIG_SAVED') {
    await figma.clientStorage.setAsync('componentConfig', msg.config);
    figma.ui.hide();
    figma.codegen.refresh(); // Force regeneration with new config
  }
});
```

> **Tip:** Always persist action preference data to `figma.clientStorage` so it survives plugin restarts. Load it once at startup and cache it in memory for the generate callback.

---

### Code Generation Patterns

#### Architecture: Extraction → Generation Pipeline

The same three-stage pipeline from `plugin-architecture.md` applies to codegen plugins, but compressed into the 3-second timeout window:

1. **Extract** — Read node properties into a JSON-serializable schema
2. **Generate** — Transform extracted data into code strings
3. **Return** — Package as `CodegenResult[]`

For codegen plugins, extraction and generation typically happen inline within the generate callback. For complex plugins that need the full pipeline, extract on selection change and cache the result.

#### React/TSX Generation

Generate React components with typed props and CSS Modules:

```ts
function generateReact(node: SceneNode): CodegenResult[] {
  const componentName = toPascalCase(node.name);
  const { jsx, styles, imports } = buildComponent(node);

  const tsx = [
    ...imports,
    `import styles from './${componentName}.module.css';`,
    '',
    `interface ${componentName}Props {`,
    `  className?: string;`,
    `}`,
    '',
    `export function ${componentName}({ className }: ${componentName}Props) {`,
    `  return (`,
    `    ${jsx}`,
    `  );`,
    `}`,
  ].join('\n');

  const css = renderStylesheet(styles);

  return [
    { title: `${componentName}.tsx`, code: tsx, language: 'TYPESCRIPT' },
    { title: `${componentName}.module.css`, code: css, language: 'CSS' },
  ];
}
```

#### HTML + CSS Generation

Generate semantic HTML with a separate stylesheet:

```ts
function generateHTMLCSS(node: SceneNode): CodegenResult[] {
  const extracted = extractNode(node);
  const element = generateElement(extracted);
  const html = renderHTML(element);
  const css = renderCSS(collectCSSRules(element));

  return [
    { title: 'HTML', code: html, language: 'HTML' },
    { title: 'CSS', code: css, language: 'CSS' },
  ];
}
```

#### CSS Generation: Layered Approach

Generate CSS in three distinct layers for maintainability:

```ts
function generateCSS(node: SceneNode): string {
  const rules: string[] = [];
  const selector = `.${generateClassName(node.name)}`;

  // Layer 1: Layout (structural bones)
  const layoutCSS = generateLayoutCSS(node);
  if (layoutCSS) rules.push(layoutCSS);

  // Layer 2: Visual (design skin)
  const visualCSS = generateVisualCSS(node);
  if (visualCSS) rules.push(visualCSS);

  // Layer 3: Typography (text styles)
  if (node.type === 'TEXT') {
    const typographyCSS = generateTypographyCSS(node);
    if (typographyCSS) rules.push(typographyCSS);
  }

  return `${selector} {\n${rules.join('\n')}\n}`;
}
```

> **Cross-reference:** See `css-strategy.md` for the full three-layer CSS architecture. See `design-to-code-layout.md`, `design-to-code-visual.md`, and `design-to-code-typography.md` for the specific property mapping rules.

#### Layout CSS from Auto Layout

Map Figma Auto Layout properties to CSS Flexbox. This is the most critical mapping in design-to-code generation:

```ts
function generateLayoutCSS(node: SceneNode): string {
  if (!('layoutMode' in node) || node.layoutMode === 'NONE') return '';

  const rules: string[] = [];
  rules.push('  display: flex;');
  rules.push(`  flex-direction: ${node.layoutMode === 'HORIZONTAL' ? 'row' : 'column'};`);

  // Gap
  if (node.itemSpacing > 0) {
    rules.push(`  gap: ${node.itemSpacing}px;`);
  }

  // Wrap
  if (node.layoutWrap === 'WRAP') {
    rules.push('  flex-wrap: wrap;');
  }

  // Primary axis alignment → justify-content
  const justifyMap: Record<string, string> = {
    MIN: 'flex-start', CENTER: 'center',
    MAX: 'flex-end', SPACE_BETWEEN: 'space-between',
  };
  rules.push(`  justify-content: ${justifyMap[node.primaryAxisAlignItems]};`);

  // Cross axis alignment → align-items
  const alignMap: Record<string, string> = {
    MIN: 'flex-start', CENTER: 'center',
    MAX: 'flex-end', BASELINE: 'baseline',
  };
  rules.push(`  align-items: ${alignMap[node.counterAxisAlignItems]};`);

  // Padding
  const { paddingTop: pt, paddingRight: pr, paddingBottom: pb, paddingLeft: pl } = node;
  if (pt || pr || pb || pl) {
    if (pt === pr && pr === pb && pb === pl) {
      rules.push(`  padding: ${pt}px;`);
    } else {
      rules.push(`  padding: ${pt}px ${pr}px ${pb}px ${pl}px;`);
    }
  }

  return rules.join('\n');
}
```

> **Cross-reference:** `design-to-code-layout.md` provides the complete mapping table, including child sizing modes (FIXED → explicit width, HUG → auto, FILL → flex: 1), min/max constraints, and wrap alignment.

#### Component Instance Handling

When the selected node is a component instance, generate usage code rather than the full component definition:

```ts
figma.codegen.on('generate', async ({ node, language }) => {
  if (node.type === 'INSTANCE') {
    const mainComponent = await node.getMainComponentAsync();
    if (mainComponent) {
      const name = toPascalCase(mainComponent.name);
      const props = extractComponentProps(node, mainComponent);
      const propsStr = formatProps(props);

      return [{
        title: 'Usage',
        language: 'TYPESCRIPT',
        code: propsStr
          ? `<${name}\n${propsStr}\n/>`
          : `<${name} />`,
      }];
    }
  }

  if (node.type === 'COMPONENT') {
    return generateComponentDefinition(node, language);
  }

  return generateInlineElement(node, language);
});

function extractComponentProps(
  instance: InstanceNode,
  component: ComponentNode
): Record<string, string> {
  const props: Record<string, string> = {};

  // Extract variant properties
  if ('variantProperties' in instance && instance.variantProperties) {
    for (const [key, value] of Object.entries(instance.variantProperties)) {
      props[toCamelCase(key)] = value;
    }
  }

  // Extract text overrides by comparing instance children to main component
  // (implementation depends on component structure)

  return props;
}
```

#### Semantic HTML Tag Selection

Choose HTML tags based on node name, type, and content — not just `<div>` for everything:

```ts
function getSemanticTag(node: ExtractedNode, context: SemanticContext): string {
  const name = node.name.toLowerCase();

  // Text nodes
  if (node.type === 'TEXT') {
    // Heading detection by font size and weight
    if (node.text && node.text.font.size >= 32 && context.canUseH1()) {
      context.useH1();
      return 'h1';
    }
    if (node.text && node.text.font.size >= 24) return 'h2';
    if (node.text && node.text.font.size >= 20) return 'h3';
    return 'p';
  }

  // Name-based detection
  if (name.includes('header') || name.includes('navbar')) return 'header';
  if (name.includes('footer')) return 'footer';
  if (name.includes('nav') || name.includes('menu')) return 'nav';
  if (name.includes('sidebar') || name.includes('aside')) return 'aside';
  if (name.includes('article') || name.includes('post')) return 'article';
  if (name.includes('section')) return 'section';
  if (name.includes('main') || name.includes('content')) return 'main';
  if (name.includes('button') || name.includes('btn') || name.includes('cta')) return 'button';
  if (name.includes('link')) return 'a';
  if (name.includes('list')) return 'ul';
  if (name.includes('item') && context.isInsideList()) return 'li';
  if (name.includes('image') || name.includes('photo') || name.includes('avatar')) return 'img';

  return 'div';
}
```

Key principles for semantic tag selection:
- Only one `<h1>` per page — track with `SemanticContext`
- Headings must follow hierarchy (`h1` > `h2` > `h3`, never skip levels)
- No headings inside buttons or links
- Interactive elements (`button`, `a`) based on name patterns

> **Cross-reference:** See `design-to-code-semantic.md` for the complete semantic HTML mapping rules and ARIA attribute patterns.

#### BEM Class Name Generation

Generate flat BEM class names from Figma layer names:

```ts
function generateBEMClassName(
  nodeName: string,
  parentClassName: string | null,
  depth: number,
  prefix?: string
): string {
  const element = sanitizeClassName(nodeName);

  // Root level → block name
  if (!parentClassName || depth === 0) {
    return prefix ? `${prefix}${element}` : element;
  }

  // BEM element: block__element (always flat, never block__el__sub)
  const block = parentClassName.split('__')[0];
  return `${block}__${element}`;
}

function sanitizeClassName(name: string): string {
  return name
    .replace(/^(frame|group|component|instance|vector|text)\s*/i, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-')
    .replace(/^[0-9]/, 'el-$&')
    .substring(0, 32)
    || 'element';
}
```

Deduplicate class names when multiple nodes have the same sanitized name:

```ts
class ClassNameTracker {
  private used = new Map<string, number>();

  getUnique(baseName: string): string {
    const count = this.used.get(baseName) || 0;
    this.used.set(baseName, count + 1);
    return count === 0 ? baseName : `${baseName}-${count + 1}`;
  }
}
```

Example output:
```
card                    ← root frame
card__header            ← first child "Header"
card__title             ← text inside header
card__body              ← second child "Body"
card__description       ← text inside body
card__footer            ← third child "Footer"
card__button            ← button inside footer
card__button-2          ← second button (deduped)
```

#### Optional Class Prefix

Support an optional prefix for all generated class names to avoid collisions when integrating generated code into existing projects:

```ts
// With prefix "fr-":
// fr-card, fr-card__header, fr-card__title

const output = await generateOutput(extracted, {
  classPrefix: 'fr-',
});
```

---

### Responsive Code Generation

#### Multi-Frame Responsive Mode

When users select multiple frames representing different breakpoints (mobile, tablet, desktop), generate unified CSS with media queries:

```
┌─────────────┐   ┌──────────────┐   ┌───────────────┐
│ Mobile Frame │   │ Tablet Frame  │   │ Desktop Frame  │
│ (375×812)    │   │ (768×1024)    │   │ (1440×900)     │
└──────┬───────┘   └───────┬───────┘   └───────┬────────┘
       │                   │                    │
       └─────────┬─────────┘────────────────────┘
                 ▼
    ┌──────────────────────┐
    │ Unified Responsive   │
    │ CSS with @media      │
    │ queries              │
    └──────────────────────┘
```

The process:

1. **Detect breakpoints** from frame names or dimensions
2. **Extract all frames** independently
3. **Match elements** across frames by normalized layer name
4. **Generate base styles** from the smallest breakpoint (mobile-first)
5. **Generate `@media` overrides** for larger breakpoints with only differing properties

```ts
// Standard breakpoints (mobile-first)
const BREAKPOINTS = [
  { name: 'mobile', minWidth: null, maxWidth: 767 },     // base (no media query)
  { name: 'tablet', minWidth: 768, maxWidth: 1023 },
  { name: 'desktop', minWidth: 1024, maxWidth: null },
];

// Detect breakpoint from frame name or width
function detectBreakpoint(frame: { name: string; width: number }): BreakpointConfig {
  const name = frame.name.toLowerCase();
  for (const bp of BREAKPOINTS) {
    if (name.includes(bp.name)) return bp;
  }
  // Fallback to dimension detection
  if (frame.width < 768) return BREAKPOINTS[0];
  if (frame.width < 1024) return BREAKPOINTS[1];
  return BREAKPOINTS[2];
}
```

#### Element Matching Across Frames

Match elements between breakpoint frames by normalizing layer names (stripping breakpoint suffixes):

```ts
function normalizeLayerName(name: string): string {
  return name
    .replace(/\s*\[(?:mobile|tablet|desktop)\]\s*/gi, '')
    .replace(/\s*[-–]\s*(?:mobile|tablet|desktop)\s*/gi, '')
    .trim()
    .toLowerCase();
}

// "Header [mobile]" and "Header [desktop]" both normalize to "header"
// This enables matching the same element across breakpoint frames
```

#### Generating Responsive CSS

```ts
function generateResponsiveCSS(
  matched: MatchedElementGroup[],
  breakpoints: BreakpointConfig[]
): string {
  const output: string[] = [];

  // Base styles (mobile-first, no media query)
  for (const group of matched) {
    output.push(`${group.selector} {`);
    output.push(renderProperties(group.baseStyles));
    output.push('}');
    output.push('');
  }

  // Media query overrides for larger breakpoints
  for (const bp of breakpoints) {
    if (bp.minWidth === null) continue; // Skip base

    const overrides = matched
      .filter(g => g.responsiveStyles.has(bp.name))
      .map(g => ({
        selector: g.selector,
        styles: g.responsiveStyles.get(bp.name)!,
      }))
      .filter(o => Object.keys(o.styles).length > 0);

    if (overrides.length === 0) continue;

    output.push(`@media (min-width: ${bp.minWidth}px) {`);
    for (const override of overrides) {
      output.push(`  ${override.selector} {`);
      output.push(renderProperties(override.styles, '    '));
      output.push('  }');
    }
    output.push('}');
    output.push('');
  }

  return output.join('\n');
}
```

#### Component Variant-Based Responsive

An alternative to multi-frame responsive: detect responsive component sets (COMPONENT_SET with a Device/Breakpoint variant property) and generate media queries from the variant children:

```ts
async function resolveVariantSets(extracted: ExtractedNode): Promise<Map<string, VariantSet>> {
  const variantSets = new Map<string, VariantSet>();

  // Find INSTANCE nodes with a responsive property (e.g., "Device")
  function findResponsiveInstances(node: ExtractedNode) {
    if (node.componentRef?.responsiveProperty) {
      // Resolve the parent COMPONENT_SET and extract all variant COMPONENT trees
      // Each variant maps to a breakpoint
    }
    node.children?.forEach(findResponsiveInstances);
  }

  findResponsiveInstances(extracted);
  return variantSets;
}
```

This enables responsive code generation from a single frame selection when the frame contains responsive component instances.

---

### Code Quality in Generated Output

Generated code must be clean enough for developers to use directly. Quality problems in generated output erode trust in the tool.

#### HTML Validation

Validate tag structure and bracket matching in generated HTML:

```ts
interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  sanitizedCode: string;
}

interface ValidationError {
  line: number;
  column: number;
  message: string;
  type: 'error' | 'warning';
}

function validateHTML(html: string): ValidationResult {
  const errors: ValidationError[] = [];
  let sanitized = html;

  // 1. Remove JavaScript for security (script tags, inline handlers)
  sanitized = removeJavaScript(sanitized, errors);

  // 2. Validate tag structure (unclosed tags, mismatched nesting)
  validateTagStructure(sanitized, errors);

  // 3. Validate bracket matching (< > mismatches)
  validateBrackets(sanitized, errors);

  return {
    valid: errors.filter(e => e.type === 'error').length === 0,
    errors,
    sanitizedCode: sanitized,
  };
}
```

#### CSS Validation

Validate property syntax and bracket matching in generated CSS:

```ts
function validateCSS(css: string): ValidationResult {
  const errors: ValidationError[] = [];
  let sanitized = css;

  // 1. Remove JavaScript expressions (url("javascript:..."), expression())
  sanitized = removeJSFromCSS(sanitized, errors);

  // 2. Validate bracket matching ({ } balance)
  validateCSSBrackets(sanitized, errors);

  // 3. Validate property syntax (missing semicolons, missing colons)
  validateCSSProperties(sanitized, errors);

  return {
    valid: errors.filter(e => e.type === 'error').length === 0,
    errors,
    sanitizedCode: sanitized,
  };
}
```

#### JavaScript Removal for Security

Generated code should never contain executable JavaScript. Strip it at the validation layer:

```ts
function removeJavaScript(html: string, errors: ValidationError[]): string {
  let result = html;

  // Remove <script> tags and content
  const scripts = html.match(/<script\b[^>]*>[\s\S]*?<\/script>/gi);
  if (scripts) {
    errors.push({
      line: 0, column: 0,
      message: `Removed ${scripts.length} script tag(s) for security`,
      type: 'warning',
    });
    result = result.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
  }

  // Remove inline event handlers (onclick, onerror, onload, etc.)
  const handlers = html.match(/\s(on\w+)=["'][^"']*["']/gi);
  if (handlers) {
    errors.push({
      line: 0, column: 0,
      message: `Removed ${handlers.length} inline event handler(s)`,
      type: 'warning',
    });
    result = result.replace(/\s(on\w+)=["'][^"']*["']/gi, '');
  }

  return result;
}

function removeJSFromCSS(css: string, errors: ValidationError[]): string {
  // Remove expression(), url("javascript:..."), etc.
  return css
    .replace(/expression\s*\([^)]*\)/gi, '/* removed */')
    .replace(/url\s*\(\s*["']?javascript:[^)]*\)/gi, '/* removed */');
}
```

#### Code Formatting and Indentation

Consistent formatting makes generated code feel professional:

```ts
function renderHTML(element: GeneratedElement, indent: number = 0): string {
  const spaces = '  '.repeat(indent);
  const tag = element.tag;
  let attrs = `class="${element.className}"`;

  // Add data-figma-id for traceability
  if (element.figmaId) {
    attrs += ` data-figma-id="${element.figmaId}"`;
  }

  // Self-closing tags
  if (tag === 'img') {
    return `${spaces}<${tag} ${attrs} src="${element.attributes?.src || ''}" alt="${element.attributes?.alt || ''}" />`;
  }

  // Opening tag
  let html = `${spaces}<${tag} ${attrs}>`;

  // Children
  const hasElementChildren = element.children.some(c => typeof c !== 'string');
  if (hasElementChildren) {
    html += '\n';
    for (const child of element.children) {
      html += typeof child === 'string'
        ? `${spaces}  ${child}\n`
        : renderHTML(child, indent + 1) + '\n';
    }
    html += `${spaces}</${tag}>`;
  } else {
    // Text-only content inline
    html += element.children.join('') + `</${tag}>`;
  }

  return html;
}

function renderCSS(rules: CSSRule[]): string {
  return rules.map(rule => {
    const props = Object.entries(rule.properties)
      .filter(([_, v]) => v !== undefined)
      .map(([key, value]) => {
        const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
        return `  ${cssKey}: ${value};`;
      })
      .join('\n');
    return `${rule.selector} {\n${props}\n}`;
  }).join('\n\n');
}
```

#### Node-to-Code Traceability

Include `data-figma-id` attributes on generated HTML elements to enable bidirectional references between code and design:

```html
<section class="hero" data-figma-id="1:234">
  <h1 class="hero__title" data-figma-id="1:235">Welcome</h1>
  <p class="hero__description" data-figma-id="1:236">Lorem ipsum</p>
</section>
```

This enables:
- Click an element in the code preview → highlight the source Figma node
- Edit text in code → sync back to the Figma text node
- Show which Figma layer produced each line of code

---

### Integration with Dev Resources

#### Creating Dev Resources from Codegen Plugins

After generating code, link it back to the Figma node as a Dev Resource visible to all team members:

```ts
// From the UI thread (using hidden iframe for fetch access)
async function createDevResource(
  fileKey: string,
  nodeId: string,
  componentName: string,
  repoUrl: string
) {
  const response = await fetch('https://api.figma.com/v1/dev_resources', {
    method: 'POST',
    headers: {
      'X-Figma-Token': 'YOUR_FIGMA_TOKEN',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      dev_resources: [{
        name: `${componentName} (Source)`,
        url: repoUrl,
        file_key: fileKey,
        node_id: nodeId,
      }],
    }),
  });

  return response.json();
}
```

> **Cross-reference:** See `figma-api-devmode.md` for the complete Dev Resources REST API reference (GET, POST, PUT, DELETE).

#### Linking Components to Repositories

Build a mapping table from Figma component keys to repository paths:

```ts
interface ComponentMapping {
  componentKey: string;
  repoUrl: string;
  importPath: string;
  componentName: string;
}

// Store mappings in clientStorage via action preferences
const mappings = await figma.clientStorage.getAsync('componentMappings') || [];

// Use during generation to emit import statements
figma.codegen.on('generate', async ({ node }) => {
  if (node.type === 'INSTANCE') {
    const main = await node.getMainComponentAsync();
    if (main) {
      const mapping = mappings.find(m => m.componentKey === main.key);
      if (mapping) {
        return [{
          title: 'Import',
          language: 'TYPESCRIPT',
          code: `import { ${mapping.componentName} } from '${mapping.importPath}';`,
        }];
      }
    }
  }
  // ... fall through to full generation
});
```

---

### Design Token Integration in Codegen

#### Token-Aware CSS Generation

When generating CSS, substitute repeated values with CSS custom properties (design tokens):

```ts
// Instead of hardcoding:
// color: #0066ff;

// Generate with token reference:
// color: var(--color-primary);

function generateColorValue(fill: FillData, lookup?: TokenLookup): string {
  if (fill.type !== 'SOLID') return '';

  // Check for Figma variable binding first
  if (fill.variable) {
    const varName = figmaVariableToCssName(fill.variable.name);
    return fill.variable.isLocal
      ? `var(${varName})`
      : `var(${varName}, ${fill.color})`;
  }

  // Check token lookup for promoted values
  if (lookup) {
    const token = lookup.colors.get(fill.color);
    if (token) return `var(${token.cssVariable})`;
  }

  return fill.color;
}
```

#### Generating tokens.css

When the codegen plugin promotes design tokens, output them as a separate CSS custom properties file:

```ts
function generateTokensFile(tokens: DesignTokens): CodegenResult {
  const lines: string[] = [':root {'];

  // Colors
  for (const color of tokens.colors) {
    lines.push(`  ${color.cssVariable}: ${color.value};`);
  }

  // Spacing
  for (const spacing of tokens.spacing) {
    lines.push(`  ${spacing.cssVariable}: ${spacing.value};`);
  }

  // Typography
  for (const family of tokens.typography.families) {
    lines.push(`  ${family.cssVariable}: ${family.value};`);
  }
  for (const size of tokens.typography.sizes) {
    lines.push(`  ${size.cssVariable}: ${size.value};`);
  }

  lines.push('}');

  return {
    title: 'tokens.css',
    code: lines.join('\n'),
    language: 'CSS',
  };
}
```

> **Cross-reference:** See `design-tokens.md` for the full token promotion pipeline and naming conventions. See `design-tokens-variables.md` for Figma Variables → CSS custom property mapping.

---

### Standard vs Codegen Plugin Comparison

#### Decision Guide

| Consideration | Standard Plugin | Codegen Plugin |
|--------------|:--------------:|:--------------:|
| **Primary audience** | Designers | Developers |
| **Running context** | Design Mode | Dev Mode |
| **Document access** | Full read/write | Read-only |
| **Output method** | Side effects (create nodes, export files) | Return `CodegenResult[]` |
| **UI** | Custom iframe UI | Inspect panel + optional hidden UI |
| **Timeout** | None (runs until closed) | 3 seconds per generate call |
| **Trigger** | Plugins menu / command | Node selection in Dev Mode |
| **Use case** | Export, import, automate, analyze | Generate code for developers |

**Choose a standard plugin when:**
- You need to modify the Figma document (create nodes, update styles)
- You need a rich interactive UI (settings panels, previews, editors)
- You need to export files or create ZIP bundles
- You need long-running operations (batch processing)
- Your audience is primarily designers

**Choose a codegen plugin when:**
- Your output is code that developers copy into their codebase
- You want code to appear directly in the Inspect panel
- You need per-node code generation triggered by selection
- Your audience is developers using Dev Mode
- You want language-specific output with preference controls

#### Combining Both in One Project

A single project can provide both a standard plugin and a codegen plugin by publishing two separate plugins that share code:

```
src/
├── shared/
│   ├── extraction/    # Shared extraction logic
│   ├── generation/    # Shared code generation
│   └── types/         # Shared type definitions
├── standard-plugin/
│   ├── main.ts        # Standard plugin entry
│   └── ui.tsx         # Standard plugin UI
└── codegen-plugin/
    └── main.ts        # Codegen plugin entry (no UI)
```

The standard plugin handles rich workflows (multi-frame export, live preview, bidirectional sync), while the codegen plugin provides quick per-node code snippets in Dev Mode. Both share the same extraction and generation logic.

```json
// Standard plugin package.json
{
  "figma-plugin": {
    "editorType": ["figma"],
    "main": "src/standard-plugin/main.ts",
    "ui": "src/standard-plugin/ui.tsx"
  }
}

// Codegen plugin package.json (separate build)
{
  "figma-plugin": {
    "editorType": ["dev"],
    "capabilities": ["codegen"],
    "main": "src/codegen-plugin/main.ts"
  }
}
```

> **Note:** These must be separate Figma plugins with separate IDs. A single plugin cannot be both `editorType: ["figma"]` and `editorType: ["dev"]`. However, they can live in the same repository and share source code.

---

### Using Hidden iframe for Complex Processing

Codegen plugins can use a hidden iframe for operations that require browser APIs (fetch, WebAssembly, canvas):

```ts
let nextMessageIdx = 1;
const resolvers: Record<number, (result: CodegenResult[]) => void> = {};

// Show hidden UI at startup
figma.showUI('<script>/* processing code */</script>', { visible: false });

figma.ui.on('message', (msg) => {
  if (msg.type === 'CODEGEN_RESULT' && resolvers[msg.messageIdx]) {
    resolvers[msg.messageIdx](msg.results);
    delete resolvers[msg.messageIdx];
  }
});

figma.codegen.on('generate', async ({ node, language }) => {
  const idx = nextMessageIdx++;

  return new Promise<CodegenResult[]>((resolve) => {
    resolvers[idx] = resolve;
    figma.ui.postMessage({
      type: 'GENERATE',
      messageIdx: idx,
      nodeData: serializeNode(node),
      language,
    });
  });
});
```

Common use cases for hidden iframe in codegen:
- **Network requests** — Fetch component mappings from a design system server
- **Heavy computation** — Run Prettier/formatting that exceeds main thread budget
- **WebAssembly** — Use WASM-based tools for code generation
- **Template engines** — Run Handlebars, EJS, or other template engines

> **Warning:** The generate callback still has a 3-second timeout even when delegating to a hidden iframe. Ensure the iframe responds quickly.

---

### Performance Optimization for Codegen

#### Caching Strategies

```ts
// Cache node data between generate calls (nodes don't change in Dev Mode)
const nodeCache = new Map<string, ExtractedNode>();

figma.codegen.on('generate', ({ node }) => {
  let extracted = nodeCache.get(node.id);
  if (!extracted) {
    extracted = extractNode(node);
    nodeCache.set(node.id, extracted);
  }
  return generateCode(extracted);
});

// Clear cache on page change
figma.on('currentpagechange', () => {
  nodeCache.clear();
});
```

#### Limiting Traversal Depth

For complex nested designs, limit how deep the generator traverses:

```ts
function extractNode(node: SceneNode, depth: number = 0, maxDepth: number = 15): ExtractedNode {
  const extracted = { /* ... extract properties ... */ };

  if ('children' in node && depth < maxDepth) {
    extracted.children = node.children
      .filter(child => child.visible)
      .map(child => extractNode(child, depth + 1, maxDepth));
  }

  return extracted;
}
```

#### Avoiding Expensive Operations

Operations to avoid in the generate callback:

| Operation | Cost | Alternative |
|-----------|:----:|-------------|
| `page.findAll()` | High | Only traverse the selected node's subtree |
| `node.exportAsync()` | High | Skip asset export in codegen (return asset references instead) |
| `figma.loadFontAsync()` | Medium | Only load if needed, cache loaded fonts |
| `figma.getNodeByIdAsync()` | Medium | Use the node directly from the event |
| Network requests | Variable | Pre-fetch via action preferences |

---

### Error Handling in Codegen Plugins

#### Graceful Degradation

Never let the generate callback throw an unhandled error. Always return a meaningful result:

```ts
figma.codegen.on('generate', async ({ node, language }) => {
  try {
    return generateCode(node, language);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return [{
      title: 'Generation Error',
      language: 'PLAINTEXT',
      code: [
        `// Code generation failed for node "${node.name}" (${node.type})`,
        `// Error: ${message}`,
        `//`,
        `// Possible causes:`,
        `// - Node type not yet supported`,
        `// - Complex nested structure exceeded depth limit`,
        `// - Missing font data`,
      ].join('\n'),
    }];
  }
});
```

#### Unsupported Node Types

Handle node types your generator does not support with informative messages:

```ts
function generateCode(node: SceneNode, language: string): CodegenResult[] {
  const supportedTypes = ['FRAME', 'COMPONENT', 'INSTANCE', 'TEXT', 'RECTANGLE', 'ELLIPSE', 'GROUP'];

  if (!supportedTypes.includes(node.type)) {
    return [{
      title: 'Info',
      language: 'PLAINTEXT',
      code: `// Node type "${node.type}" is not supported for code generation.\n// Select a frame, component, or text node.`,
    }];
  }

  // ... proceed with generation
}
```

---

## Cross-References

- **`figma-api-devmode.md`** — Dev Mode codegen API reference (CodegenEvent, CodegenResult, preferences types, Dev Resources REST API). This module builds on that reference with development patterns.
- **`figma-api-plugin.md`** — Standard plugin API reference (sandbox model, SceneNode types, IPC messaging). Codegen plugins share the same sandbox model.
- **`plugin-architecture.md`** — Production plugin architecture patterns (project setup, IPC design, data flow pipeline). The extraction/generation pipeline applies to both standard and codegen plugins.
- **`design-to-code-layout.md`** — Auto Layout to Flexbox mapping rules used in CSS generation.
- **`design-to-code-visual.md`** — Visual property mapping rules (fills, strokes, effects) used in CSS generation.
- **`design-to-code-typography.md`** — Typography mapping rules used in CSS generation.
- **`design-to-code-semantic.md`** — Semantic HTML tag selection and ARIA attribute patterns.
- **`design-to-code-assets.md`** — Asset detection, vector container identification, SVG export patterns.
- **`css-strategy.md`** — Three-layer CSS architecture (Tailwind + Custom Properties + CSS Modules) for organizing generated CSS output.
- **`design-tokens.md`** — Token promotion pipeline and CSS variable naming conventions.
- **`design-tokens-variables.md`** — Figma Variables to CSS custom property mapping for token-aware code generation.
- **`plugin-best-practices.md`** — Production best practices for error handling, performance, caching, async patterns, and testing. The caching strategies and error handling patterns apply directly to codegen plugins operating under the 3-second timeout constraint.
