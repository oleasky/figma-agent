# Figma Dev Mode & Codegen Plugin Reference

## Purpose

Authoritative reference for Figma Dev Mode, the codegen plugin system, and the Dev Resources REST API. Covers the Dev Mode inspect experience, codegen plugin manifests (with correct `editorType: ["dev"]`), the `figma.codegen` API, code generation patterns, and the Dev Resources CRUD endpoints for linking design components to code.

## When to Use

Reference this module when you need to:

- Build a codegen plugin that generates code in Dev Mode's Inspect panel
- Configure a `manifest.json` for a Dev Mode codegen plugin
- Implement the `figma.codegen.on('generate', ...)` callback
- Use the codegen preferences system (unit, select, action)
- Create, read, update, or delete Dev Resources via the REST API
- Link Figma components to code repositories or documentation
- Understand how Dev Mode relates to the standard Figma editing experience

---

## Content

### Dev Mode Overview

Dev Mode is Figma's dedicated developer experience that transforms the Inspect panel into a developer-focused workspace. It surfaces design specs, code snippets, annotations, and developer resources alongside the visual design.

#### Key Concepts

| Concept | Description |
|---------|-------------|
| **Inspect panel** | The right-side panel in Dev Mode showing properties, code, and resources for the selected node |
| **Code snippets** | Built-in code generation (CSS, iOS, Android) plus custom snippets from codegen plugins |
| **Dev Resources** | Links attached to nodes pointing to code repos, documentation, or other developer references |
| **Ready for dev** | A status designers can apply to frames/sections indicating they are ready for implementation |
| **Annotations** | Design notes and specifications attached to nodes, visible in Dev Mode |
| **Measurements** | Spacing and dimension overlays visible when hovering between elements |

#### Relationship to Standard Editing Mode

Dev Mode and Design Mode are separate views of the same Figma file:

- **Design Mode** — The editing environment where designers create and modify designs. Standard plugins (`editorType: ["figma"]`) run here.
- **Dev Mode** — The read-only inspection environment for developers. Codegen plugins (`editorType: ["dev"]`) run here. Developers can view properties, copy code, and access dev resources, but cannot modify the design.

Plugins can detect which mode they are running in:

```ts
if (figma.editorType === 'dev') {
  // Running in Dev Mode
  if (figma.mode === 'codegen') {
    // Specifically running as a codegen plugin
  } else if (figma.mode === 'inspect') {
    // Running as an inspect plugin
  }
}
```

---

### Codegen Plugin System

Codegen plugins extend Figma's built-in code generation with custom languages and frameworks. They appear in the Dev Mode Inspect panel's language dropdown and generate code snippets when a user selects a node.

#### How Codegen Plugins Work

1. The user opens a Figma file in Dev Mode
2. The user selects a codegen plugin's language from the Inspect panel dropdown
3. When the user selects a node, Figma fires the `generate` event
4. The plugin's callback receives the selected node and returns code snippets
5. The code appears in the Inspect panel alongside built-in CSS/iOS/Android code

> **Key difference from standard plugins:** Codegen plugins do NOT have an iframe UI by default. The generated code appears directly in the Inspect panel. However, they CAN use `figma.showUI()` for advanced scenarios like action preferences (see Preferences section below).

---

### Codegen Plugin Manifest

Codegen plugin manifests use `editorType: ["dev"]` with `capabilities: ["codegen"]`. This is fundamentally different from standard plugin manifests.

> **Critical:** Do NOT use `editorType: ["figma"]` or `editorType: ["figma", "figjam"]` for codegen plugins. The audit specifically identified this as a common error. Codegen plugins MUST use `editorType: ["dev"]`.

#### Minimal Codegen Manifest

```json
{
  "name": "My Codegen Plugin",
  "id": "1234567890",
  "api": "1.0.0",
  "main": "code.js",
  "editorType": ["dev"],
  "documentAccess": "dynamic-page",
  "capabilities": ["codegen"],
  "codegenLanguages": [
    { "label": "React", "value": "react" }
  ]
}
```

#### Full Codegen Manifest with Preferences

```json
{
  "name": "Design-to-Code Generator",
  "id": "1234567890",
  "api": "1.0.0",
  "main": "code.js",
  "editorType": ["dev"],
  "documentAccess": "dynamic-page",
  "capabilities": ["codegen", "vscode"],
  "codegenLanguages": [
    { "label": "React", "value": "react" },
    { "label": "Vue", "value": "vue" },
    { "label": "HTML + CSS", "value": "html-css" }
  ],
  "codegenPreferences": [
    {
      "itemType": "unit",
      "propertyName": "Sizing Unit",
      "scaledUnit": "rem",
      "defaultScaleFactor": 16,
      "includedLanguages": ["react", "html-css"]
    },
    {
      "itemType": "select",
      "propertyName": "CSS Strategy",
      "options": [
        { "label": "CSS Modules", "value": "modules", "isDefault": true },
        { "label": "Tailwind", "value": "tailwind" },
        { "label": "Inline Styles", "value": "inline" }
      ],
      "includedLanguages": ["react"]
    },
    {
      "itemType": "action",
      "propertyName": "Component Mapping",
      "label": "Configure Mappings"
    }
  ],
  "networkAccess": {
    "allowedDomains": ["https://api.example.com"],
    "reasoning": "Fetch component mappings from design system server"
  }
}
```

#### Manifest Field Reference (Codegen-Specific)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `editorType` | string[] | Yes | Must be `["dev"]` for codegen plugins |
| `capabilities` | string[] | Yes | Must include `"codegen"`. Can also include `"vscode"` for VS Code extension integration and `"inspect"` for inspect panel plugins |
| `codegenLanguages` | object[] | Yes | Array of `{ label: string, value: string }` defining supported languages |
| `codegenPreferences` | object[] | No | Preference items for customizing code output (see Preferences section) |

#### codegenLanguages

Each entry defines a language/framework option in the Dev Mode dropdown:

```json
"codegenLanguages": [
  { "label": "React (TSX)", "value": "react-tsx" },
  { "label": "Vue SFC", "value": "vue-sfc" },
  { "label": "HTML + CSS", "value": "html-css" },
  { "label": "Tailwind", "value": "tailwind" },
  { "label": "SwiftUI", "value": "swiftui" }
]
```

- `label` — Display name shown in the dropdown
- `value` — Identifier passed to the generate callback

---

### Codegen API

The `figma.codegen` object provides the API for code generation plugins.

#### The Generate Callback

The core of every codegen plugin is the `generate` event handler:

```ts
figma.codegen.on('generate', (event: CodegenEvent): CodegenResult[] => {
  const { node, language } = event;

  // Generate code based on the selected node and language
  return [
    {
      title: 'JSX',
      code: generateJSX(node),
      language: 'TYPESCRIPT'
    },
    {
      title: 'Styles',
      code: generateCSS(node),
      language: 'CSS'
    }
  ];
});
```

#### CodegenEvent

```ts
interface CodegenEvent {
  /** The currently selected node in Dev Mode */
  node: SceneNode;

  /** The language value from codegenLanguages in manifest */
  language: string;
}
```

#### CodegenResult

Each result creates a titled code section in the Inspect panel:

```ts
interface CodegenResult {
  /** Section title displayed above the code block */
  title: string;

  /** The generated code string */
  code: string;

  /** Syntax highlighting language */
  language: 'BASH' | 'CPP' | 'CSS' | 'GO' | 'GRAPHQL' | 'HTML' | 'JAVA'
    | 'JAVASCRIPT' | 'JSON' | 'KOTLIN' | 'PLAINTEXT' | 'PYTHON' | 'RUBY'
    | 'RUST' | 'SASS' | 'SCSS' | 'SWIFT' | 'TYPESCRIPT' | 'XML';
}
```

Multiple results are rendered as separate collapsible sections in the Inspect panel. This allows a single generate callback to output HTML, CSS, and JavaScript as separate sections.

#### Async Generate Callback

The generate callback can return a Promise for async operations:

```ts
figma.codegen.on('generate', async (event: CodegenEvent): Promise<CodegenResult[]> => {
  const { node, language } = event;

  // Async operations (e.g., loading fonts, resolving variables)
  if (node.type === 'TEXT') {
    await figma.loadFontAsync(node.fontName as FontName);
  }

  return [{
    title: 'Component',
    code: await generateComponent(node, language),
    language: 'TYPESCRIPT'
  }];
});
```

> **Important:** The generate callback has a **3-second timeout**. If the callback does not resolve within 3 seconds, Figma will cancel it. Keep code generation fast.

#### Preferences API

Access current preference values in the generate callback:

```ts
figma.codegen.on('generate', (event) => {
  const prefs = figma.codegen.preferences;

  // Unit preference: { unit: string, scaleFactor: number }
  const sizingUnit = prefs.unit;          // e.g., "rem"
  const scaleFactor = prefs.scaleFactor;  // e.g., 16

  // Select preference: check current value
  const cssStrategy = prefs['CSS Strategy']; // e.g., "modules"

  // Use preferences in code generation
  const pxValue = node.width;
  const remValue = pxValue / scaleFactor;
  const sizeStr = sizingUnit === 'rem' ? `${remValue}rem` : `${pxValue}px`;

  return [{ title: 'Styles', code: `width: ${sizeStr};`, language: 'CSS' }];
});
```

#### Preference Change Events

```ts
// Listen for action preference changes (when user closes action UI)
figma.codegen.on('preferenceschange', (event) => {
  // Preferences have been updated, refresh will happen automatically
  // unless using action preferences that require manual refresh
});
```

#### Manual Refresh

```ts
// Force the Inspect panel to re-run the generate callback
figma.codegen.refresh();
```

---

### Codegen Preference Types

#### Unit Preferences

Allow users to choose a CSS unit and scale factor (e.g., px to rem conversion).

```json
{
  "itemType": "unit",
  "propertyName": "Size Unit",
  "scaledUnit": "rem",
  "defaultScaleFactor": 16,
  "includedLanguages": ["react", "html-css"]
}
```

- Defined once per language set
- Accessible via `figma.codegen.preferences.unit` and `.scaleFactor`
- Changing the preference automatically triggers the generate callback

#### Select Preferences

Multiple-choice dropdowns for formatting options.

```json
{
  "itemType": "select",
  "propertyName": "Style Format",
  "options": [
    { "label": "CSS Modules", "value": "modules", "isDefault": true },
    { "label": "Tailwind CSS", "value": "tailwind" },
    { "label": "Styled Components", "value": "styled" }
  ],
  "includedLanguages": ["react"]
}
```

- Accessible via `figma.codegen.preferences['Style Format']`
- Changing the selection automatically triggers the generate callback

#### Action Preferences

Open a custom UI for complex configuration (e.g., component mapping tables).

```json
{
  "itemType": "action",
  "propertyName": "Component Config",
  "label": "Configure Components"
}
```

- Clicking the action button opens the UI via `figma.showUI()`
- Data should be stored via `figma.clientStorage`
- Requires manual `figma.codegen.refresh()` after changes
- The UI must call `figma.closePlugin()` or be hidden when done

```ts
// Handle action preference
figma.codegen.on('preferenceschange', async (event) => {
  if (event.propertyName === 'Component Config') {
    // Show UI for configuration
    figma.showUI(__html__, { width: 500, height: 400 });
  }
});

// When UI sends updated config
figma.ui.on('message', async (msg) => {
  if (msg.type === 'CONFIG_SAVED') {
    await figma.clientStorage.setAsync('componentConfig', msg.config);
    figma.ui.hide();
    figma.codegen.refresh(); // Re-run generate with new config
  }
});
```

---

### Codegen Plugin Patterns

#### Basic React Code Generation

```ts
figma.codegen.on('generate', (event) => {
  const { node, language } = event;

  if (language !== 'react') return [];

  const componentName = toPascalCase(node.name);
  const styles = generateStyles(node);
  const jsx = generateJSX(node);

  return [
    {
      title: `${componentName}.tsx`,
      language: 'TYPESCRIPT',
      code: [
        `import styles from './${componentName}.module.css';`,
        '',
        `export function ${componentName}() {`,
        `  return (`,
        `    ${jsx}`,
        `  );`,
        `}`,
      ].join('\n')
    },
    {
      title: `${componentName}.module.css`,
      language: 'CSS',
      code: styles
    }
  ];
});

function toPascalCase(str: string): string {
  return str
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, c) => c.toUpperCase())
    .replace(/^./, (c) => c.toUpperCase());
}
```

#### Multi-Language Support

```ts
figma.codegen.on('generate', (event) => {
  const { node, language } = event;

  switch (language) {
    case 'react':
      return generateReact(node);
    case 'vue':
      return generateVue(node);
    case 'html-css':
      return generateHTML(node);
    case 'tailwind':
      return generateTailwind(node);
    default:
      return [{
        title: 'Unsupported',
        code: `// Language "${language}" not yet supported`,
        language: 'PLAINTEXT'
      }];
  }
});
```

#### Reading Layout Properties for CSS

```ts
function generateLayoutCSS(node: SceneNode): string {
  const rules: string[] = [];

  if ('layoutMode' in node && node.layoutMode !== 'NONE') {
    rules.push('display: flex;');
    rules.push(`flex-direction: ${node.layoutMode === 'HORIZONTAL' ? 'row' : 'column'};`);

    if (node.itemSpacing > 0) {
      rules.push(`gap: ${node.itemSpacing}px;`);
    }

    if (node.layoutWrap === 'WRAP') {
      rules.push('flex-wrap: wrap;');
    }

    // Primary axis alignment (justify-content)
    const justifyMap: Record<string, string> = {
      'MIN': 'flex-start',
      'CENTER': 'center',
      'MAX': 'flex-end',
      'SPACE_BETWEEN': 'space-between',
    };
    rules.push(`justify-content: ${justifyMap[node.primaryAxisAlignItems] || 'flex-start'};`);

    // Cross axis alignment (align-items)
    const alignMap: Record<string, string> = {
      'MIN': 'flex-start',
      'CENTER': 'center',
      'MAX': 'flex-end',
      'BASELINE': 'baseline',
    };
    rules.push(`align-items: ${alignMap[node.counterAxisAlignItems] || 'flex-start'};`);

    // Padding
    const { paddingTop, paddingRight, paddingBottom, paddingLeft } = node;
    if (paddingTop || paddingRight || paddingBottom || paddingLeft) {
      rules.push(`padding: ${paddingTop}px ${paddingRight}px ${paddingBottom}px ${paddingLeft}px;`);
    }
  }

  // Sizing
  if ('layoutSizingHorizontal' in node) {
    if (node.layoutSizingHorizontal === 'FIXED') {
      rules.push(`width: ${node.width}px;`);
    } else if (node.layoutSizingHorizontal === 'FILL') {
      rules.push('flex: 1 0 0;');
      rules.push('width: 100%;');
    }
    // HUG: width is auto (no explicit CSS needed)
  }

  if ('layoutSizingVertical' in node) {
    if (node.layoutSizingVertical === 'FIXED') {
      rules.push(`height: ${node.height}px;`);
    } else if (node.layoutSizingVertical === 'FILL') {
      rules.push('flex: 1 0 0;');
      rules.push('height: 100%;');
    }
    // HUG: height is auto (no explicit CSS needed)
  }

  return rules.join('\n');
}
```

#### Handling Component Instances vs Definitions

```ts
figma.codegen.on('generate', async ({ node, language }) => {
  if (node.type === 'INSTANCE') {
    const mainComponent = await node.getMainComponentAsync();
    if (mainComponent) {
      const componentName = toPascalCase(mainComponent.name);
      const props = extractOverrides(node, mainComponent);

      return [{
        title: 'Usage',
        language: 'TYPESCRIPT',
        code: `<${componentName} ${formatProps(props)} />`
      }];
    }
  }

  if (node.type === 'COMPONENT') {
    // Generate the component definition
    return generateComponentDefinition(node, language);
  }

  // For other nodes, generate inline code
  return generateInlineElement(node, language);
});
```

#### Using iframe for Complex Processing in Codegen

Although codegen plugins typically do not have a visible UI, they can use a hidden iframe for operations that need browser APIs:

```ts
let nextMessageIndex = 1;
const resolvers: Record<number, (result: CodegenResult[]) => void> = {};

// Show hidden UI for processing
figma.showUI('<script>/* processing code */</script>', { visible: false });

figma.ui.on('message', (msg) => {
  if (msg.type === 'CODEGEN_RESULT' && resolvers[msg.messageIdx]) {
    resolvers[msg.messageIdx](msg.results);
    delete resolvers[msg.messageIdx];
  }
});

figma.codegen.on('generate', async ({ node, language }) => {
  const messageIdx = nextMessageIndex++;

  return new Promise<CodegenResult[]>((resolve) => {
    resolvers[messageIdx] = resolve;
    figma.ui.postMessage({
      type: 'GENERATE',
      messageIdx,
      nodeData: serializeNode(node),
      language
    });
  });
});
```

---

### Dev Resources REST API

Dev Resources are links attached to Figma nodes that point to external developer references (code repos, documentation, Storybook, etc.). They are visible in the Dev Mode Inspect panel.

#### Authentication

All Dev Resources endpoints require a Figma API token (PAT or OAuth) with the appropriate scope:

| Operation | Scope Required |
|-----------|---------------|
| Read | `file_dev_resources:read` |
| Create / Update / Delete | `file_dev_resources:write` |

All Dev Resources endpoints are **Rate limit tier: Tier 2**.

#### GET /v1/files/:file_key/dev_resources

Retrieve dev resources from a file.

```bash
curl -H "X-Figma-Token: YOUR_FIGMA_TOKEN" \
  "https://api.figma.com/v1/files/FILE_KEY/dev_resources"
```

**Optional query parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `node_ids` | string | Comma-separated node IDs to filter results |

**Response:**

```ts
interface GetDevResourcesResponse {
  dev_resources: DevResource[];
}

interface DevResource {
  id: string;
  name: string;
  url: string;
  file_key: string;
  node_id: string;
}
```

#### POST /v1/dev_resources

Create dev resources in bulk (can span multiple files).

> **Critical:** The request body uses `dev_resources` (plural array), NOT a singular `dev_resource` object. This was specifically flagged in the audit as a common error.

```bash
curl -X POST \
  -H "X-Figma-Token: YOUR_FIGMA_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "dev_resources": [
      {
        "name": "React Component",
        "url": "https://github.com/org/repo/blob/main/src/Button.tsx",
        "file_key": "FILE_KEY",
        "node_id": "1:2"
      },
      {
        "name": "Storybook",
        "url": "https://storybook.example.com/?path=/story/button",
        "file_key": "FILE_KEY",
        "node_id": "1:2"
      }
    ]
  }' \
  "https://api.figma.com/v1/dev_resources"
```

**Response:**

```ts
interface CreateDevResourcesResponse {
  links_created: DevResource[];
  errors: Array<{
    file_key: string;
    node_id: string;
    error: string;
  }>;
}
```

**Constraints:**

| Constraint | Limit |
|-----------|-------|
| Max dev resources per node | 10 |
| Duplicate URLs per node | Not allowed |
| File key | Must be valid and accessible |

#### PUT /v1/dev_resources

Update dev resources in bulk.

```bash
curl -X PUT \
  -H "X-Figma-Token: YOUR_FIGMA_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "dev_resources": [
      {
        "id": "dev-resource-id-123",
        "name": "Updated Component Name",
        "url": "https://github.com/org/repo/blob/main/src/NewButton.tsx"
      }
    ]
  }' \
  "https://api.figma.com/v1/dev_resources"
```

**Response:**

```ts
interface UpdateDevResourcesResponse {
  links_updated: string[];  // IDs of successfully updated resources
  errors: Array<{
    id: string;
    error: string;
  }>;
}
```

#### DELETE /v1/files/:file_key/dev_resources/:dev_resource_id

Delete a single dev resource.

```bash
curl -X DELETE \
  -H "X-Figma-Token: YOUR_FIGMA_TOKEN" \
  "https://api.figma.com/v1/files/FILE_KEY/dev_resources/DEV_RESOURCE_ID"
```

Returns no content on success.

---

### Dev Resources Use Cases

#### Linking Components to Source Code

After generating code from Figma components, attach links back to the generated files:

```ts
async function linkComponentsToCode(
  fileKey: string,
  mappings: Array<{ nodeId: string; repoUrl: string; componentName: string }>
) {
  const response = await fetch('https://api.figma.com/v1/dev_resources', {
    method: 'POST',
    headers: {
      'X-Figma-Token': process.env.FIGMA_TOKEN!,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      dev_resources: mappings.map(m => ({
        name: `${m.componentName} (Source)`,
        url: m.repoUrl,
        file_key: fileKey,
        node_id: m.nodeId,
      })),
    }),
  });

  const result = await response.json();

  if (result.errors?.length > 0) {
    console.warn('Some dev resources failed:', result.errors);
  }

  return result.links_created;
}
```

#### Surfacing Generated Code in Dev Mode

Create dev resources that link to generated code output (e.g., a code preview URL):

```ts
async function attachCodePreview(
  fileKey: string,
  nodeId: string,
  previewUrl: string
) {
  await fetch('https://api.figma.com/v1/dev_resources', {
    method: 'POST',
    headers: {
      'X-Figma-Token': process.env.FIGMA_TOKEN!,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      dev_resources: [{
        name: 'Generated Code Preview',
        url: previewUrl,
        file_key: fileKey,
        node_id: nodeId,
      }],
    }),
  });
}
```

#### Design-to-Code Traceability

Build a bidirectional link between Figma designs and implemented code:

```ts
// 1. Fetch all dev resources for a file
async function getDevResources(fileKey: string): Promise<DevResource[]> {
  const res = await fetch(
    `https://api.figma.com/v1/files/${fileKey}/dev_resources`,
    { headers: { 'X-Figma-Token': process.env.FIGMA_TOKEN! } }
  );
  const data = await res.json();
  return data.dev_resources;
}

// 2. Build a node → code URL mapping
async function buildTraceabilityMap(fileKey: string): Promise<Map<string, string[]>> {
  const resources = await getDevResources(fileKey);
  const map = new Map<string, string[]>();

  for (const resource of resources) {
    const urls = map.get(resource.node_id) || [];
    urls.push(resource.url);
    map.set(resource.node_id, urls);
  }

  return map;
}
```

---

### Dev Mode Annotations

Annotations in Dev Mode provide additional context for developers inspecting designs.

#### Ready for Dev Status

Designers mark frames or sections as "Ready for dev" to signal that a design is complete and ready for implementation. This status is visible in Dev Mode and can be used to filter which components to process.

#### Plugin API Access

```ts
// Access annotations on a node
if ('annotations' in node) {
  const annotations = node.annotations;
  // Annotations contain measurements, notes, and status information
}
```

#### How Annotations Relate to Dev Resources

- **Annotations** are designer-created notes about a design's intent, measurements, and specifications. They live within Figma.
- **Dev Resources** are links to external developer references (code, docs, stories). They are created via the REST API or manually in Dev Mode.

Both appear in the Inspect panel and together provide a complete handoff context: annotations explain the "what" and "why" of the design, while dev resources point to the "where" and "how" of the implementation.

---

### Codegen vs Standard Plugin: Quick Comparison

| Aspect | Standard Plugin | Codegen Plugin |
|--------|:--------------:|:--------------:|
| `editorType` | `["figma"]` or `["figma", "figjam"]` | `["dev"]` |
| `capabilities` | None required | `["codegen"]` (required) |
| UI | iframe via `figma.showUI()` | No visible UI (code in Inspect panel) |
| Trigger | User runs from Plugins menu | User selects node in Dev Mode |
| Output | Side effects (node creation, export, etc.) | `CodegenResult[]` displayed in Inspect panel |
| Document access | Full read/write | Read-only |
| Primary use case | Design automation, export, analysis | Code generation for developers |
| `figma.mode` | `"default"` | `"codegen"` |
| Network access | Via UI iframe proxy | Via UI iframe proxy (if using hidden UI) |
| Timeout | None (runs until `closePlugin()`) | 3-second timeout on generate callback |

---

### Error Handling

#### Codegen Plugin Errors

| Error | Cause | Solution |
|-------|-------|----------|
| Generate callback timeout | Callback exceeds 3 seconds | Optimize code generation; pre-cache data; use simpler algorithms |
| Node properties unavailable | Accessing properties not on the node type | Check `node.type` before accessing type-specific properties |
| Font not loaded | Accessing text properties without loading font | Call `figma.loadFontAsync()` before reading text properties |

#### Dev Resources REST API Errors

| Status | Meaning | Action |
|--------|---------|--------|
| `400` | Invalid parameters (bad node_id, invalid URL) | Verify request body structure and field values |
| `401` | Authentication failed | Verify token and `file_dev_resources:read/write` scope |
| `403` | Insufficient permissions | Confirm file access permissions |
| `404` | Dev resource not found (DELETE only) | Verify the dev_resource_id exists |
| `429` | Rate limited | Use `Retry-After` header. See `figma-api-rest.md` for backoff strategy |

---

## Cross-References

- **`figma-api-rest.md`** — Core REST API reference (authentication, rate limits, file endpoints)
- **`figma-api-plugin.md`** — Standard plugin development (sandbox model, SceneNode types, IPC patterns)
- **`figma-api-variables.md`** — Variables API for design tokens (consumed during code generation)
- **`figma-api-webhooks.md`** — Webhooks v2 DEV_MODE_STATUS_UPDATE event for reacting to "Ready for dev" changes
- **`design-to-code-layout.md`** — Auto Layout to Flexbox mapping rules (used in codegen callbacks)
- **`design-to-code-visual.md`** — Visual property extraction (fills, strokes, effects for CSS generation)
- **`design-to-code-typography.md`** — Typography mapping (font families, sizes, line height for CSS)
- **`design-to-code-semantic.md`** — Semantic HTML generation patterns
- **`css-strategy.md`** — Layered CSS approach (Tailwind + CSS Custom Properties + CSS Modules)
- **`plugin-codegen.md`** — Production codegen plugin development patterns (generation pipeline, preferences, code quality, responsive output)
