# Figma Plugin API Reference

## Purpose

Authoritative reference for the Figma Plugin API covering the sandbox execution model, SceneNode type hierarchy, IPC messaging patterns, standard plugin manifest configuration, key API methods, and plugin constraints. This module covers **standard plugins** (design-mode plugins with optional UI). For Dev Mode codegen plugins, see `figma-api-devmode.md`.

## When to Use

Reference this module when you need to:

- Understand the plugin sandbox model (main thread vs UI iframe)
- Build a standard Figma plugin with a UI
- Navigate the SceneNode type hierarchy in plugin code
- Implement IPC (inter-process communication) between plugin main thread and UI
- Configure `manifest.json` for a standard plugin
- Access node properties, traverse the document tree, or create nodes
- Load fonts, export images, or store plugin data
- Understand plugin execution constraints and limitations

---

## Content

### Plugin Architecture: Sandbox Model

Figma plugins use a **two-environment execution model** for security and stability.

#### Main Thread (Sandbox)

The plugin's main code (`main` entry in manifest) runs on Figma's **main thread in a sandbox**. This sandbox is a minimal JavaScript environment that:

- Has access to the full Figma document tree (read and write)
- Provides standard ES6+ JavaScript (Promise, JSON, Uint8Array, etc.)
- Provides the `figma` global object with all Plugin API methods
- Does **NOT** expose browser APIs (no DOM, no `window`, no `document`)
- Does **NOT** have `fetch()`, `XMLHttpRequest`, or any network APIs
- Does **NOT** have `setTimeout`/`setInterval` (use `figma.timer` in FigJam only)

#### UI Thread (iframe)

The plugin's UI (`ui` entry in manifest) runs in a standard browser `<iframe>`. This iframe:

- Has full access to browser APIs (DOM, `fetch`, Canvas, WebAssembly, etc.)
- Can render HTML/CSS/JavaScript UIs
- Does **NOT** have direct access to the Figma document tree or Plugin API
- Must communicate with the main thread via message passing

#### Communication Flow

```
┌─────────────────────────┐     message passing     ┌─────────────────────────┐
│     Main Thread          │ ◄─────────────────────► │     UI iframe            │
│     (Sandbox)            │                         │     (Browser)            │
│                          │                         │                          │
│  • figma.* API access    │   figma.ui.postMessage  │  • DOM / HTML / CSS      │
│  • Document tree R/W     │ ──────────────────────► │  • fetch() / XHR         │
│  • Node creation/edit    │                         │  • Canvas / WebGL        │
│  • Style/variable access │   parent.postMessage    │  • WebAssembly           │
│  • No DOM, no fetch      │ ◄────────────────────── │  • No figma.* API        │
└─────────────────────────┘                         └─────────────────────────┘
```

---

### Manifest: Standard Plugins

The `manifest.json` file configures a plugin. For **standard plugins** (design-mode plugins with optional UI), the manifest uses `editorType: ["figma"]` or `["figma", "figjam"]`.

> **Critical distinction:** Standard plugins use `editorType: ["figma"]`. Dev Mode codegen plugins use `editorType: ["dev"]` with `capabilities: ["codegen"]`. These are fundamentally different plugin types. See `figma-api-devmode.md` for codegen manifests.

#### Minimal Standard Plugin Manifest

```json
{
  "name": "My Plugin",
  "id": "1234567890",
  "api": "1.0.0",
  "main": "code.js",
  "editorType": ["figma"],
  "documentAccess": "dynamic-page"
}
```

#### Full Standard Plugin Manifest

```json
{
  "name": "My Plugin",
  "id": "1234567890",
  "api": "1.0.0",
  "main": "code.js",
  "ui": "ui.html",
  "editorType": ["figma", "figjam"],
  "documentAccess": "dynamic-page",
  "networkAccess": {
    "allowedDomains": ["https://*.example.com"],
    "reasoning": "Needed for syncing design tokens to server"
  },
  "permissions": ["currentuser"],
  "menu": [
    {
      "name": "Export Components",
      "command": "export"
    },
    {
      "name": "Settings",
      "command": "settings"
    }
  ],
  "relaunchButtons": [
    {
      "command": "relaunch",
      "name": "Re-export",
      "multipleSelection": false
    }
  ],
  "enableProposedApi": false
}
```

#### Manifest Field Reference

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `name` | string | Yes | Plugin display name |
| `id` | string | Yes | Unique plugin ID (assigned by Figma) |
| `api` | string | Yes | API version (e.g., `"1.0.0"`) |
| `main` | string | Yes | Path to main thread JavaScript entry |
| `ui` | string or object | No | Path to UI HTML file (string) or named UI files (object) |
| `editorType` | string[] | No | `["figma"]`, `["figjam"]`, `["figma", "figjam"]`, `["dev"]`, `["slides"]`, `["buzz"]` |
| `documentAccess` | string | Yes (new plugins) | Must be `"dynamic-page"` — pages load on demand |
| `networkAccess` | object | No | `allowedDomains` array, `reasoning` string, `devAllowedDomains` array |
| `permissions` | string[] | No | `"currentuser"`, `"activeusers"`, `"fileusers"`, `"payments"`, `"teamlibrary"` |
| `capabilities` | string[] | No | `"textreview"`, `"codegen"`, `"inspect"`, `"vscode"` (for Dev Mode plugins) |
| `menu` | object[] | No | Menu items with `name`, `command`, optional nested `menu` |
| `parameters` | object[] | No | Quick action parameters with `name`, `key`, `description`, `allowFreeform`, `optional` |
| `parameterOnly` | boolean | No | If true (default when parameters exist), plugin only runs via quick actions |
| `relaunchButtons` | object[] | No | Buttons attached to nodes for re-running plugin commands |
| `enableProposedApi` | boolean | No | Enable experimental API features |
| `build` | string | No | Build command for plugin bundling |

#### editorType Rules

- `["figma"]` — Runs in Figma Design editor only
- `["figjam"]` — Runs in FigJam only
- `["figma", "figjam"]` — Runs in both Figma Design and FigJam
- `["dev"]` — Runs in Dev Mode only (for codegen/inspect plugins)
- `["slides"]` — Runs in Figma Slides only
- `["buzz"]` — Runs in Figma Buzz only
- Cannot combine `"figjam"` with `"dev"`

#### networkAccess Patterns

```json
{ "allowedDomains": ["none"] }
{ "allowedDomains": ["*"] }
{ "allowedDomains": ["https://api.example.com", "https://*.cdn.example.com"] }
{ "allowedDomains": ["wss://realtime.example.com"] }
```

Network restrictions apply to requests made by the plugin (fetch, XHR), not to resources loaded by websites rendered within the iframe.

---

### SceneNode Type Hierarchy

In Figma, every layer corresponds to a node. The Plugin API exposes these as TypeScript types.

#### Type Tree

```
BaseNode
  ├── DocumentNode
  └── SceneNode
        ├── FrameNode          (container, optional Auto Layout)
        ├── GroupNode           (visual grouping, no layout properties)
        ├── SectionNode         (organizational section on canvas)
        ├── ComponentNode       (reusable component definition)
        ├── ComponentSetNode    (variant container)
        ├── InstanceNode        (instance of a component)
        ├── TextNode            (text layer)
        ├── RectangleNode       (rectangle shape)
        ├── EllipseNode         (ellipse/circle shape)
        ├── VectorNode          (arbitrary vector path)
        ├── LineNode            (line segment)
        ├── StarNode            (star shape)
        ├── PolygonNode         (polygon shape)
        ├── BooleanOperationNode (union/subtract/intersect/exclude)
        ├── SliceNode           (export region, not rendered)
        ├── StickyNode          (FigJam only)
        ├── ShapeWithTextNode   (FigJam only)
        ├── ConnectorNode       (FigJam only)
        ├── CodeBlockNode       (FigJam only)
        ├── TableNode           (FigJam only)
        ├── EmbedNode           (embedded content)
        ├── LinkUnfurlNode      (link preview)
        └── MediaNode           (video/GIF)
```

#### Key Mixins (Shared Interfaces)

Figma uses TypeScript mixins to share properties across node types:

| Mixin | Provides | Used By |
|-------|----------|---------|
| `ChildrenMixin` | `children`, `findAll()`, `findOne()`, `findChildren()`, `findAllWithCriteria()` | FrameNode, GroupNode, ComponentNode, InstanceNode, BooleanOperationNode, SectionNode |
| `LayoutMixin` | `layoutSizingHorizontal/Vertical`, `layoutGrow`, `layoutAlign`, `resize()`, `rescale()` | All SceneNodes |
| `AutoLayoutMixin` | `layoutMode`, `itemSpacing`, `paddingLeft/Right/Top/Bottom`, `primaryAxisAlignItems`, `counterAxisAlignItems`, `layoutWrap` | FrameNode, ComponentNode, ComponentSetNode, InstanceNode |
| `GeometryMixin` | `fills`, `strokes`, `strokeWeight`, `strokeAlign`, `fillGeometry`, `strokeGeometry` | FrameNode, RectangleNode, EllipseNode, VectorNode, TextNode, etc. |
| `CornerMixin` | `cornerRadius`, `cornerSmoothing` | FrameNode, RectangleNode, ComponentNode, InstanceNode |
| `RectangleCornerMixin` | `topLeftRadius`, `topRightRadius`, `bottomLeftRadius`, `bottomRightRadius` | FrameNode, RectangleNode, ComponentNode, InstanceNode |
| `BlendMixin` | `opacity`, `blendMode`, `effects`, `isMask` | All SceneNodes |
| `ExportMixin` | `exportAsync()`, `exportSettings` | All SceneNodes |
| `MinimalFillsMixin` | `fills` (read-only subset) | Some nodes |
| `MinimalStrokesMixin` | `strokes` (read-only subset) | Some nodes |

#### FrameNode vs GroupNode

This is a critical distinction for design-to-code:

| Property | FrameNode | GroupNode |
|----------|:---------:|:---------:|
| Auto Layout (`layoutMode`) | Yes | No |
| Padding properties | Yes | No |
| `itemSpacing` (gap) | Yes | No |
| `clipsContent` | Yes | No |
| `fills` (background) | Yes | No |
| `cornerRadius` | Yes | No |
| `effects` (shadows, blur) | Yes | No |
| `constraints` | Yes | No |
| Children positioning | Managed by layout | Absolute relative to group |

**Rule:** If a node has `layoutMode !== 'NONE'`, it is an Auto Layout frame and should map to a CSS flexbox container. Groups should map to a simple wrapper `<div>` with no layout styles.

#### ComponentNode vs InstanceNode

| Property | ComponentNode | InstanceNode |
|----------|:-------------:|:------------:|
| Is a definition | Yes | No (it is a usage) |
| `mainComponent` reference | N/A | Points to its ComponentNode |
| Overrides | N/A | Can override fills, text, visibility, etc. |
| Has component properties | Defines them | Consumes them |
| Can be detached | N/A | `detachInstance()` converts to FrameNode |

```ts
// Accessing the source component from an instance
if (node.type === 'INSTANCE') {
  const component = await node.getMainComponentAsync();
  if (component) {
    console.log('Component name:', component.name);
    console.log('Component key:', component.key);
  }
}
```

---

### Key Plugin API Methods

#### Document and Page Access

```ts
// Root document node
const doc: DocumentNode = figma.root;

// Current active page
const page: PageNode = figma.currentPage;

// Switch to a different page (async — loads page data)
await figma.setCurrentPageAsync(targetPage);

// Load all pages (needed if documentAccess is "dynamic-page")
await figma.loadAllPagesAsync();
```

#### Node Retrieval

```ts
// Get a specific node by ID (async — preferred)
const node = await figma.getNodeByIdAsync('1:2');

// Find nodes matching criteria in a subtree
const allText = page.findAll(node => node.type === 'TEXT');
const firstButton = page.findOne(node => node.name === 'Button');
const directChildren = frame.findChildren(node => node.visible);

// Find with specific criteria (more efficient)
const components = page.findAllWithCriteria({ types: ['COMPONENT'] });
```

#### Node Creation

```ts
// Create basic shapes
const frame = figma.createFrame();
const rect = figma.createRectangle();
const text = figma.createText();
const ellipse = figma.createEllipse();
const vector = figma.createVector();
const line = figma.createLine();

// Create components
const component = figma.createComponent();
const componentFromNode = figma.createComponentFromNode(existingNode);

// Create from SVG
const svgFrame = figma.createNodeFromSvg('<svg>...</svg>');

// Create a page
const newPage = figma.createPage();

// Create a section
const section = figma.createSection();

// Append to parent
frame.appendChild(rect);
page.appendChild(frame);
```

#### Font Loading

Font loading is **required** before reading or modifying text content:

```ts
// Load a specific font (MUST be called before modifying text)
await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
await figma.loadFontAsync({ family: 'Inter', style: 'Bold' });

// Now safe to modify text
textNode.characters = 'Hello World';
textNode.fontSize = 16;

// List available fonts
const fonts = await figma.listAvailableFontsAsync();
```

> **Important:** `figma.loadFontAsync()` must be called for each font family + style combination used in a text node before modifying that node's characters or style properties. Failure to load fonts before modification throws an error.

#### Exporting Nodes

```ts
// Export a node as PNG
const pngBytes: Uint8Array = await node.exportAsync({
  format: 'PNG',
  constraint: { type: 'SCALE', value: 2 }
});

// Export as SVG
const svgBytes: Uint8Array = await node.exportAsync({
  format: 'SVG',
  svgOutlineText: true,
  svgIdAttribute: false
});

// Export as PDF
const pdfBytes: Uint8Array = await node.exportAsync({
  format: 'PDF'
});

// Export as JPG
const jpgBytes: Uint8Array = await node.exportAsync({
  format: 'JPG',
  constraint: { type: 'SCALE', value: 1 }
});
```

#### Plugin Data Storage

```ts
// Store data on a node (private to this plugin)
node.setPluginData('metadata', JSON.stringify({ exported: true }));

// Read data from a node
const data = node.getPluginData('metadata');

// Store data shared across plugins
node.setSharedPluginData('namespace', 'key', 'value');
const shared = node.getSharedPluginData('namespace', 'key');

// Persistent client-side storage (survives plugin restarts)
await figma.clientStorage.setAsync('settings', { theme: 'dark' });
const settings = await figma.clientStorage.getAsync('settings');
```

#### Styles and Variables (Plugin API)

```ts
// Get local styles
const paintStyles = await figma.getLocalPaintStylesAsync();
const textStyles = await figma.getLocalTextStylesAsync();
const effectStyles = await figma.getLocalEffectStylesAsync();

// Get a style by ID
const style = await figma.getStyleByIdAsync('S:abc123');

// Import a published style by key
const importedStyle = await figma.importStyleByKeyAsync('component-key');

// Import a published component by key
const component = await figma.importComponentByKeyAsync('component-key');

// Access local variables (Plugin API — works on all plans)
const variables = await figma.variables.getLocalVariablesAsync();
const collections = await figma.variables.getLocalVariableCollectionsAsync();
```

> **Note:** The Plugin API `figma.variables` gives access to local variables on ALL Figma plans. The REST API Variables endpoints require Enterprise. This makes the Plugin API the preferred fallback for variable access on non-Enterprise plans.

#### Events

```ts
// Run event — fired when plugin starts
figma.on('run', (event: RunEvent) => {
  console.log('Command:', event.command);
  console.log('Parameters:', event.parameters);
});

// Selection change
figma.on('selectionchange', () => {
  const selection = figma.currentPage.selection;
  console.log('Selected:', selection.length, 'nodes');
});

// Document change
figma.on('documentchange', (event: DocumentChangeEvent) => {
  for (const change of event.documentChanges) {
    console.log('Changed:', change.type, change.id);
  }
});

// Close event — cleanup before plugin closes
figma.on('close', () => {
  // Perform cleanup
});

// Drop event — handle drag-and-drop onto canvas
figma.on('drop', (event: DropEvent) => {
  const { items, node, dropMetadata } = event;
  // Handle dropped items
  return false; // return true to prevent default behavior
});
```

#### UI Management

```ts
// Show the UI iframe
figma.showUI(__html__, {
  width: 400,
  height: 600,
  title: 'My Plugin',
  visible: true,
  themeColors: true  // Use Figma's theme colors
});

// Show named UI (when ui is an object in manifest)
figma.showUI(__uiFiles__['settings'], { width: 300, height: 200 });

// Resize after creation
figma.ui.resize(500, 700);

// Reposition
figma.ui.reposition(100, 100);

// Hide without destroying
figma.ui.hide();
figma.ui.show();

// Close and destroy
figma.ui.close();

// Close the entire plugin
figma.closePlugin('Done!'); // Optional message shown to user
```

#### Utilities

```ts
// Show a notification toast
figma.notify('Export complete!', { timeout: 3000 });
figma.notify('Error occurred', { error: true });

// Open external URL (requires user confirmation)
figma.openExternal('https://example.com');

// Base64 encode/decode
const encoded = figma.base64Encode(uint8Array);
const decoded = figma.base64Decode(encodedString);

// Create an image from bytes
const image = figma.createImage(pngBytes);

// Create an image from URL (fetched by Figma)
const image = await figma.createImageAsync('https://example.com/image.png');

// Save version history
await figma.saveVersionHistoryAsync('Auto-export v2', 'Exported all components');
```

---

### IPC Messaging Patterns

Communication between the main thread and UI iframe uses structured message passing.

#### Basic Pattern: Main Thread to UI

```ts
// Main thread (code.ts)
figma.showUI(__html__);

// Send data to UI
figma.ui.postMessage({
  type: 'NODE_DATA',
  payload: {
    name: node.name,
    width: node.width,
    height: node.height
  }
});
```

```html
<!-- UI (ui.html) -->
<script>
  window.onmessage = (event) => {
    const msg = event.data.pluginMessage;
    if (msg.type === 'NODE_DATA') {
      document.getElementById('name').textContent = msg.payload.name;
    }
  };
</script>
```

#### Basic Pattern: UI to Main Thread

```html
<!-- UI (ui.html) -->
<script>
  function exportSelection() {
    parent.postMessage({
      pluginMessage: {
        type: 'EXPORT',
        format: 'svg',
        scale: 2
      }
    }, '*');
  }
</script>
```

```ts
// Main thread (code.ts)
figma.ui.onmessage = (msg) => {
  if (msg.type === 'EXPORT') {
    // Handle export request
    const bytes = await node.exportAsync({ format: msg.format });
    figma.ui.postMessage({ type: 'EXPORT_RESULT', data: bytes });
  }
};

// Alternative: multiple handlers with .on()
figma.ui.on('message', (msg) => {
  if (msg.type === 'EXPORT') { /* ... */ }
});
```

#### Pattern: Request/Response with Correlation IDs

For complex plugins with concurrent operations, use correlation IDs to match responses:

```ts
// Main thread (code.ts)
figma.ui.on('message', async (msg) => {
  if (msg.type === 'FETCH_REQUEST') {
    // Process the request
    const nodes = figma.currentPage.findAll(n => n.type === msg.nodeType);
    const result = nodes.map(n => ({ id: n.id, name: n.name }));

    figma.ui.postMessage({
      type: 'FETCH_RESPONSE',
      requestId: msg.requestId,  // Echo the correlation ID
      payload: result
    });
  }
});
```

```html
<!-- UI (ui.html) -->
<script>
  let nextRequestId = 1;
  const pendingRequests = new Map();

  function fetchNodes(nodeType) {
    return new Promise((resolve) => {
      const requestId = nextRequestId++;
      pendingRequests.set(requestId, resolve);
      parent.postMessage({
        pluginMessage: {
          type: 'FETCH_REQUEST',
          requestId,
          nodeType
        }
      }, '*');
    });
  }

  window.onmessage = (event) => {
    const msg = event.data.pluginMessage;
    if (msg.type === 'FETCH_RESPONSE' && pendingRequests.has(msg.requestId)) {
      pendingRequests.get(msg.requestId)(msg.payload);
      pendingRequests.delete(msg.requestId);
    }
  };
</script>
```

#### Pattern: Network Proxy (fetch via UI)

Since the main thread cannot make network requests, proxy them through the UI:

```ts
// Main thread (code.ts)
figma.ui.postMessage({
  type: 'API_REQUEST',
  url: 'https://api.example.com/tokens',
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(tokenData)
});

figma.ui.on('message', (msg) => {
  if (msg.type === 'API_RESPONSE') {
    if (msg.ok) {
      figma.notify('Tokens synced!');
    } else {
      figma.notify('Sync failed: ' + msg.error, { error: true });
    }
  }
});
```

```html
<!-- UI (ui.html) -->
<script>
  window.onmessage = async (event) => {
    const msg = event.data.pluginMessage;
    if (msg.type === 'API_REQUEST') {
      try {
        const res = await fetch(msg.url, {
          method: msg.method,
          headers: msg.headers,
          body: msg.body
        });
        const data = await res.json();
        parent.postMessage({
          pluginMessage: {
            type: 'API_RESPONSE',
            ok: res.ok,
            status: res.status,
            data
          }
        }, '*');
      } catch (err) {
        parent.postMessage({
          pluginMessage: {
            type: 'API_RESPONSE',
            ok: false,
            error: err.message
          }
        }, '*');
      }
    }
  };
</script>
```

---

### Common Plugin Patterns

#### Walking the Node Tree

```ts
function walkTree(node: BaseNode, callback: (node: BaseNode) => void): void {
  callback(node);
  if ('children' in node) {
    for (const child of node.children) {
      walkTree(child, callback);
    }
  }
}

// Usage: collect all text content
const textNodes: TextNode[] = [];
walkTree(figma.currentPage, (node) => {
  if (node.type === 'TEXT') {
    textNodes.push(node as TextNode);
  }
});
```

#### Reading Auto Layout Properties

```ts
function getLayoutInfo(node: FrameNode | ComponentNode | InstanceNode) {
  if (node.layoutMode === 'NONE') {
    return { isAutoLayout: false };
  }

  return {
    isAutoLayout: true,
    direction: node.layoutMode,          // 'HORIZONTAL' | 'VERTICAL'
    gap: node.itemSpacing,               // number (maps to CSS gap)
    wrap: node.layoutWrap,               // 'NO_WRAP' | 'WRAP'
    padding: {
      top: node.paddingTop,
      right: node.paddingRight,
      bottom: node.paddingBottom,
      left: node.paddingLeft,
    },
    primaryAlign: node.primaryAxisAlignItems,    // 'MIN' | 'CENTER' | 'MAX' | 'SPACE_BETWEEN'
    crossAlign: node.counterAxisAlignItems,      // 'MIN' | 'CENTER' | 'MAX' | 'BASELINE'
    crossContentAlign: node.counterAxisAlignContent, // 'AUTO' | 'SPACE_BETWEEN'
    sizingH: node.layoutSizingHorizontal,        // 'FIXED' | 'HUG' | 'FILL'
    sizingV: node.layoutSizingVertical,          // 'FIXED' | 'HUG' | 'FILL'
  };
}
```

#### Reading Visual Properties

```ts
function getVisualInfo(node: SceneNode) {
  const info: Record<string, any> = {
    opacity: 'opacity' in node ? node.opacity : 1,
    blendMode: 'blendMode' in node ? node.blendMode : 'NORMAL',
    visible: node.visible,
  };

  // Fills
  if ('fills' in node && node.fills !== figma.mixed) {
    info.fills = (node.fills as readonly Paint[]).filter(f => f.visible !== false);
  }

  // Strokes
  if ('strokes' in node) {
    info.strokes = node.strokes;
    info.strokeWeight = 'strokeWeight' in node ? node.strokeWeight : 0;
    info.strokeAlign = 'strokeAlign' in node ? node.strokeAlign : 'CENTER';
  }

  // Corner radius
  if ('cornerRadius' in node) {
    if (node.cornerRadius !== figma.mixed) {
      info.cornerRadius = node.cornerRadius;
    } else if ('topLeftRadius' in node) {
      info.cornerRadius = [
        node.topLeftRadius,
        node.topRightRadius,
        node.bottomRightRadius,
        node.bottomLeftRadius
      ];
    }
  }

  // Effects (shadows, blur)
  if ('effects' in node) {
    info.effects = node.effects.filter(e => e.visible !== false);
  }

  return info;
}
```

#### Processing Component Instances

```ts
async function processInstances(page: PageNode) {
  const instances = page.findAllWithCriteria({ types: ['INSTANCE'] }) as InstanceNode[];

  for (const instance of instances) {
    const mainComponent = await instance.getMainComponentAsync();

    if (!mainComponent) {
      console.log(`${instance.name}: detached or missing component`);
      continue;
    }

    // Check if from external library
    const isRemote = mainComponent.remote;
    const componentKey = mainComponent.key;
    const componentName = mainComponent.name;

    // Access overridden properties
    const overrides = instance.overrides;

    console.log(`Instance "${instance.name}" → Component "${componentName}" (remote: ${isRemote})`);
  }
}
```

---

### Plugin Constraints and Limitations

#### Execution Constraints

| Constraint | Details |
|-----------|---------|
| **Single plugin at a time** | Users can only run one plugin and one widget simultaneously |
| **No background execution** | Plugins cannot run in the background; they must be actively invoked |
| **Plugin lifecycle** | Must call `figma.closePlugin()` to terminate (unless using `figma.on('close', ...)`) |
| **Dynamic page loading** | Pages load on demand (`documentAccess: "dynamic-page"`). Use `figma.loadAllPagesAsync()` if you need all pages |
| **Asynchronous operations** | Font loading, page switching, image creation, and many node lookups are async |

#### Main Thread Sandbox Restrictions

| Restriction | Details |
|------------|---------|
| **No DOM access** | `document`, `window`, `HTMLElement`, etc. are not available |
| **No network access** | `fetch()`, `XMLHttpRequest`, WebSocket are not available — proxy through UI iframe |
| **No timers** | `setTimeout`, `setInterval` are not available in the main sandbox (except FigJam `figma.timer`) |
| **No external fonts** | Can only load fonts available in the Figma editor via `figma.loadFontAsync()` |
| **No file metadata** | Cannot access team info, permissions, comments, or version history (except `figma.saveVersionHistoryAsync()`) |

#### Data and Access Limitations

| Limitation | Details |
|-----------|---------|
| **Library access** | Cannot access library styles/components unless imported into the current file |
| **Font requirement** | Must call `figma.loadFontAsync()` before modifying any text node's characters or style |
| **Image data** | Can create images from bytes or URL, but cannot read pixel data from existing image fills directly |
| **Plugin data scope** | `setPluginData()` is private to the plugin ID; use `setSharedPluginData()` for cross-plugin data |
| **Client storage** | `figma.clientStorage` is local to the user's machine and plugin ID |

#### Performance Considerations

- Avoid calling `figma.root.findAll()` on large files — use page-level searches or `findAllWithCriteria()` for type-filtered searches
- Batch node modifications before yielding control to reduce re-renders
- Use `figma.skipInvisibleInstanceChildren = true` to skip hidden instance children during traversal
- Prefer async API variants (`getNodeByIdAsync`, `getLocalPaintStylesAsync`, etc.) — sync versions are deprecated

---

### @create-figma-plugin Tooling

The `@create-figma-plugin` package is a popular open-source toolkit for building Figma plugins with modern tooling:

```bash
npx create-figma-plugin
```

Key features:
- TypeScript support out of the box
- Preact-based UI components matching Figma's design
- Build system with esbuild
- Module-based plugin structure (separates handler and UI)
- Automatic manifest generation from package.json

**Handler pattern:**

```ts
// src/main.ts
import { on, emit, showUI } from '@create-figma-plugin/utilities';

export default function () {
  on('EXPORT_REQUEST', async (format: string) => {
    const selection = figma.currentPage.selection;
    // Process selection...
    emit('EXPORT_RESULT', { success: true, count: selection.length });
  });

  showUI({ width: 400, height: 300 });
}
```

```tsx
// src/ui.tsx
import { render, useWindowResize } from '@create-figma-plugin/ui';
import { emit, on } from '@create-figma-plugin/utilities';
import { h } from 'preact';
import { useState } from 'preact/hooks';

function Plugin() {
  const [result, setResult] = useState(null);

  on('EXPORT_RESULT', (data) => setResult(data));

  function handleExport() {
    emit('EXPORT_REQUEST', 'svg');
  }

  return (
    <div>
      <button onclick={handleExport}>Export</button>
      {result && <p>Exported {result.count} nodes</p>}
    </div>
  );
}

export default render(Plugin);
```

The `emit`/`on` helpers from `@create-figma-plugin/utilities` abstract the raw `postMessage`/`onmessage` IPC pattern into a typed event system.

---

## Cross-References

- **`figma-api-rest.md`** — REST API for file/node fetching from outside Figma (authentication, endpoints, rate limits)
- **`figma-api-devmode.md`** — Dev Mode codegen plugins (different manifest, different lifecycle, `figma.codegen` API)
- **`figma-api-variables.md`** — Variables REST API for design tokens (Enterprise only; Plugin API `figma.variables` works on all plans)
- **`figma-api-webhooks.md`** — Webhooks v2 for reacting to file changes externally
- **`design-to-code-layout.md`** — Auto Layout to Flexbox mapping (consumes layout properties from Plugin API)
- **`design-to-code-visual.md`** — Visual property extraction patterns (fills, strokes, effects)
- **`design-to-code-assets.md`** — Asset export patterns using `node.exportAsync()`
- **`plugin-architecture.md`** — Production plugin architecture patterns (project setup, IPC design, data flow pipeline)
- **`plugin-best-practices.md`** — Best practices for Figma plugin development
