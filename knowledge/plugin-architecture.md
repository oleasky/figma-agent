# Figma Plugin Architecture Patterns

## Purpose

Production-tested patterns for architecting Figma plugins — covering project setup with `@create-figma-plugin`, project structure by concern, type-safe IPC messaging, manifest configuration, UI architecture, and the extraction-generation-export data flow pipeline. This module documents **how to build** production plugins, not the Plugin API itself (see `figma-api-plugin.md` for API reference).

## When to Use

Reference this module when you need to:

- Set up a new Figma plugin project with `@create-figma-plugin`
- Structure a plugin codebase by domain concern (extraction, generation, export)
- Design a type-safe IPC event system between main thread and UI
- Configure `manifest.json` and `package.json` for `@create-figma-plugin`
- Build a plugin UI with Preact and `@create-figma-plugin/ui`
- Implement the extraction → generation → export data flow pipeline
- Handle errors, progress reporting, and large data transfer across IPC

---

## Content

### Project Setup with @create-figma-plugin

The `@create-figma-plugin` toolkit provides a modern build system, TypeScript support, Preact-based UI components, and automatic manifest generation. It is the recommended toolchain for production Figma plugins.

#### Scaffolding a New Project

```bash
# Create a new plugin project
npx create-figma-plugin

# Or initialize manually in an existing directory
npm init -y
npm install @create-figma-plugin/ui @create-figma-plugin/utilities preact
npm install -D @create-figma-plugin/build @create-figma-plugin/tsconfig \
  @figma/plugin-typings typescript
```

#### package.json Configuration

The `@create-figma-plugin` build system reads plugin configuration from the `figma-plugin` section of `package.json`. This replaces manually maintaining `manifest.json` — the build tool generates it automatically.

```json
{
  "name": "my-figma-plugin",
  "version": "1.0.0",
  "dependencies": {
    "@create-figma-plugin/ui": "^4.0.3",
    "@create-figma-plugin/utilities": "^4.0.3",
    "preact": ">=10"
  },
  "devDependencies": {
    "@create-figma-plugin/build": "^4.0.3",
    "@create-figma-plugin/tsconfig": "^4.0.3",
    "@figma/plugin-typings": "1.109.0",
    "typescript": ">=5"
  },
  "scripts": {
    "build": "build-figma-plugin --typecheck --minify",
    "watch": "build-figma-plugin --typecheck --watch"
  },
  "figma-plugin": {
    "name": "My Plugin",
    "id": "YOUR_PLUGIN_ID",
    "editorType": ["figma"],
    "main": "src/main.ts",
    "ui": "src/ui.tsx",
    "documentAccess": "dynamic-page",
    "networkAccess": {
      "allowedDomains": [
        "https://fonts.googleapis.com",
        "https://fonts.gstatic.com"
      ]
    }
  }
}
```

Key fields in `figma-plugin`:

| Field | Purpose | Example |
|-------|---------|---------|
| `name` | Plugin display name in Figma | `"My Plugin"` |
| `id` | Figma-assigned plugin ID (empty during development) | `"1234567890"` |
| `editorType` | Target editor(s) | `["figma"]`, `["dev"]` |
| `main` | Main thread entry point (TypeScript source) | `"src/main.ts"` |
| `ui` | UI entry point (TSX source) | `"src/ui.tsx"` |
| `documentAccess` | Page loading strategy | `"dynamic-page"` |
| `networkAccess` | Allowed domains for UI fetch | `{ "allowedDomains": [...] }` |

> **Important:** The build tool compiles TypeScript to JavaScript and generates `manifest.json` automatically from `figma-plugin` config. You do not need to maintain `manifest.json` manually. The output goes to `build/main.js` and `build/ui.js`.

#### Build Scripts

```json
{
  "scripts": {
    "build": "build-figma-plugin --typecheck --minify",
    "watch": "build-figma-plugin --typecheck --watch",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  }
}
```

- `--typecheck` — Run TypeScript type checking before build
- `--minify` — Minify output for production (important for plugin size limits)
- `--watch` — Rebuild on file changes during development

#### TypeScript Configuration

Extend the `@create-figma-plugin/tsconfig` base configuration:

```json
{
  "extends": "@create-figma-plugin/tsconfig/tsconfig.json",
  "compilerOptions": {
    "typeRoots": [
      "node_modules/@figma",
      "node_modules/@types"
    ]
  },
  "include": ["src/**/*.ts", "src/**/*.tsx"]
}
```

The base config includes `"jsx": "react"` with `"jsxFactory": "h"` for Preact compatibility and strict TypeScript settings.

---

### Project Structure Patterns

Organize plugin code by domain concern. This separation keeps modules focused, testable, and independently maintainable. The structure reflects the natural data flow: extraction → generation → export.

```
src/
├── main.ts                 # Plugin backend (Figma sandbox)
├── ui.tsx                  # UI entry point (Preact)
├── types/
│   ├── events.ts           # IPC event definitions
│   ├── extracted.ts        # Extracted data schema
│   ├── generated.ts        # Generated output types
│   ├── export.ts           # Export bundle types
│   └── figma.ts            # Figma-specific type helpers
├── extraction/
│   ├── traverse.ts         # Tree traversal and node extraction
│   ├── layout.ts           # Auto Layout property extraction
│   ├── visual.ts           # Fill, stroke, effect extraction
│   ├── text.ts             # Typography extraction
│   ├── assets.ts           # Asset detection and classification
│   └── variants.ts         # Component variant resolution
├── generation/
│   ├── render.ts           # HTML/CSS rendering orchestrator
│   ├── html.ts             # Element tree generation
│   ├── layout.ts           # Layout CSS generation
│   ├── visual.ts           # Visual CSS generation
│   ├── typography.ts       # Typography CSS generation
│   ├── semantic.ts         # Semantic HTML tag selection
│   ├── classname.ts        # BEM class name generation
│   ├── responsive.ts       # Responsive/breakpoint CSS
│   └── position.ts         # Positioning logic
├── tokens/
│   ├── promote.ts          # Token promotion (threshold-based)
│   ├── render.ts           # Token CSS variable rendering
│   ├── lookup.ts           # Token lookup table
│   └── types.ts            # Token type definitions
├── export/
│   ├── prepare.ts          # Export bundle preparation (main thread)
│   ├── bundle.ts           # Multi-frame bundle assembly
│   ├── assets.ts           # Asset export (images, SVGs)
│   ├── css.ts              # CSS file assembly
│   ├── html.ts             # HTML document assembly
│   ├── scss.ts             # SCSS file assembly
│   ├── units.ts            # Unit conversion (px → rem)
│   └── zip.ts              # ZIP creation (UI thread only)
├── components/
│   ├── LivePreview.tsx      # HTML preview in iframe
│   ├── CodeEditor.tsx       # CodeMirror code editor
│   ├── FileTabs.tsx         # File tab navigation
│   ├── SplitPane.tsx        # Resizable split view
│   ├── FrameSelector.tsx    # Frame selection grid
│   ├── ExportSettings.tsx   # Export configuration panel
│   ├── ExportDrawer.tsx     # Export progress drawer
│   ├── ErrorState.tsx       # Error display component
│   └── ElementSidebar.tsx   # Node-to-element mapping UI
├── hooks/
│   ├── useHistory.ts        # Undo/redo state management
│   └── useResize.ts         # Window resize handling
└── utils/
    └── codeValidator.ts     # HTML/CSS validation
```

#### Why This Structure

| Directory | Responsibility | IPC Boundary |
|-----------|---------------|:------------:|
| `types/` | Shared type definitions used on both sides | Crosses IPC |
| `extraction/` | Read Figma nodes → JSON-serializable data | Main thread only |
| `generation/` | Transform extracted data → element tree + CSS | Either side |
| `tokens/` | Design token promotion and rendering | Either side |
| `export/` | Bundle assembly, asset export, ZIP creation | Split across boundary |
| `components/` | Preact UI components | UI thread only |
| `hooks/` | UI state management hooks | UI thread only |
| `utils/` | Shared utilities (validation, helpers) | Either side |

> **Critical:** Code in `extraction/` can only run on the main thread because it accesses the Figma API (`figma.getNodeByIdAsync`, `node.exportAsync`). Code in `components/` and `hooks/` can only run in the UI iframe. Code in `types/`, `generation/`, and `tokens/` is pure data transformation and can run on either side.

---

### IPC Architecture

Communication between the main thread (sandbox) and UI (iframe) is the backbone of any non-trivial Figma plugin. A type-safe event system prevents mismatched payloads and makes the codebase self-documenting.

#### Event System with @create-figma-plugin/utilities

The `emit`/`on` helpers from `@create-figma-plugin/utilities` abstract raw `postMessage`/`onmessage` into a typed event system:

```ts
// Main thread (src/main.ts)
import { showUI, on, emit } from '@create-figma-plugin/utilities';

export default function () {
  showUI({ width: 520, height: 900 });

  on<ExtractFrameHandler>(EVENTS.EXTRACT_FRAME, async (nodeId: string) => {
    const extracted = await extractNodeTree(node);
    emit<FrameExtractedHandler>(EVENTS.FRAME_EXTRACTED, extracted);
  });
}
```

```tsx
// UI thread (src/ui.tsx)
import { emit, on } from '@create-figma-plugin/utilities';

function Plugin() {
  useEffect(() => {
    on<FrameExtractedHandler>(EVENTS.FRAME_EXTRACTED, (data) => {
      setExtractedData(data);
    });
  }, []);

  function handleExtract(nodeId: string) {
    emit<ExtractFrameHandler>(EVENTS.EXTRACT_FRAME, nodeId);
  }
}
```

#### Type-Safe Event Handler Definitions

Define event handler interfaces using `EventHandler` from `@create-figma-plugin/utilities`. This gives compile-time type checking for both emit and on calls:

```ts
import { EventHandler } from '@create-figma-plugin/utilities';

// Event name constants (centralized, typo-proof)
export const EVENTS = {
  CLOSE: 'CLOSE',
  GET_SELECTION: 'GET_SELECTION',
  SELECTION_DATA: 'SELECTION_DATA',
  SELECTION_CHANGED: 'SELECTION_CHANGED',
  EXTRACT_FRAME: 'EXTRACT_FRAME',
  FRAME_EXTRACTED: 'FRAME_EXTRACTED',
  GENERATE_CODE: 'GENERATE_CODE',
  CODE_GENERATED: 'CODE_GENERATED',
  GENERATE_FILES: 'GENERATE_FILES',
  FILES_GENERATED: 'FILES_GENERATED',
  EXPORT_FRAME: 'EXPORT_FRAME',
  EXPORT_READY: 'EXPORT_READY',
  ERROR: 'ERROR',
  EXTRACTION_PROGRESS: 'EXTRACTION_PROGRESS',
} as const;

// Handler type for each event
export interface ExtractFrameHandler extends EventHandler {
  name: 'EXTRACT_FRAME';
  handler: (nodeId: string) => void;
}

export interface FrameExtractedHandler extends EventHandler {
  name: 'FRAME_EXTRACTED';
  handler: (data: ExtractedNode) => void;
}

export interface ErrorHandler extends EventHandler {
  name: 'ERROR';
  handler: (error: ErrorData) => void;
}
```

#### Event Naming Conventions

Use `VERB_NOUN` for requests and `NOUN_VERBED` for responses. This makes it immediately clear which direction data flows:

| Request Event | Response Event | Direction |
|--------------|---------------|-----------|
| `EXTRACT_FRAME` | `FRAME_EXTRACTED` | UI → Main → UI |
| `GENERATE_CODE` | `CODE_GENERATED` | UI → Main → UI |
| `GENERATE_FILES` | `FILES_GENERATED` | UI → Main → UI |
| `EXPORT_FRAME` | `EXPORT_READY` | UI → Main → UI |
| `GET_SELECTION` | `SELECTION_DATA` | UI → Main → UI |
| `GET_THUMBNAILS` | `THUMBNAILS_READY` | UI → Main → UI |
| `SAVE_SETTINGS` | (fire-and-forget) | UI → Main |
| `LOAD_SETTINGS` | `SETTINGS_LOADED` | UI → Main → UI |

Additional push events (main → UI, no request):

| Event | Trigger |
|-------|---------|
| `SELECTION_CHANGED` | User changes selection in Figma |
| `EXTRACTION_PROGRESS` | Long extraction operation progress |
| `ERROR` | Any error during processing |

#### Progress Reporting Pattern

For long-running operations (large frame extraction, multi-frame export), report progress through dedicated events:

```ts
// Main thread
on<ExtractFrameHandler>(EVENTS.EXTRACT_FRAME, async (nodeId: string) => {
  const extracted = await extractNodeTree(node, {
    onProgress: (current, total) => {
      emit<ExtractionProgressHandler>(EVENTS.EXTRACTION_PROGRESS, {
        current,
        total,
        phase: 'extracting',
      });
    },
  });
  emit<FrameExtractedHandler>(EVENTS.FRAME_EXTRACTED, extracted);
});
```

```ts
// Progress data structure
export interface ExtractionProgress {
  current: number;
  total: number;
  phase: 'extracting' | 'generating' | 'exporting';
}
```

#### Structured Error Propagation

Never let errors silently fail across the IPC boundary. Define error codes and propagate structured errors:

```ts
// Error code constants
export const ERROR_CODES = {
  NO_SELECTION: 'NO_SELECTION',
  INVALID_NODE: 'INVALID_NODE',
  EXTRACTION_FAILED: 'EXTRACTION_FAILED',
  GENERATION_FAILED: 'GENERATION_FAILED',
  EXPORT_FAILED: 'EXPORT_FAILED',
} as const;

// Structured error data
export interface ErrorData {
  code: ErrorCode;
  message: string;      // User-facing message
  details?: string;     // Technical details (from caught exception)
}

// Helper function for consistent error emission
function emitError(code: ErrorData['code'], message: string, error?: unknown): void {
  const details = error instanceof Error
    ? error.message
    : error ? String(error) : undefined;
  console.error(`[Error] ${code}: ${message}`, details || '');
  emit<ErrorHandler>(EVENTS.ERROR, { code, message, details });
}
```

Usage in every handler:

```ts
on<ExtractFrameHandler>(EVENTS.EXTRACT_FRAME, async (nodeId: string) => {
  try {
    const node = await figma.getNodeByIdAsync(nodeId);
    if (!node) {
      emitError(ERROR_CODES.INVALID_NODE, 'Node not found. It may have been deleted.');
      return;
    }
    if (!('children' in node)) {
      emitError(ERROR_CODES.INVALID_NODE, 'Selected node is not a frame or group.');
      return;
    }

    const extracted = await extractNodeTree(node as SceneNode);
    emit<FrameExtractedHandler>(EVENTS.FRAME_EXTRACTED, extracted);
  } catch (error) {
    emitError(ERROR_CODES.EXTRACTION_FAILED, 'Failed to extract frame data.', error);
  }
});
```

#### Binary Data Transfer Across IPC

The IPC boundary only supports JSON-serializable data. Binary data (images, exported assets) must be converted to base64 strings for transfer:

```ts
// Main thread: Convert Uint8Array to base64 for message passing
function uint8ArrayToBase64(bytes: Uint8Array): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const len = bytes.length;
  const result = new Array(Math.ceil(len / 3) * 4);
  let ri = 0;

  for (let i = 0; i < len; i += 3) {
    const a = bytes[i];
    const b = bytes[i + 1];
    const c = bytes[i + 2];
    result[ri++] = chars[a >> 2];
    result[ri++] = chars[((a & 3) << 4) | ((b ?? 0) >> 4)];
    result[ri++] = b !== undefined ? chars[((b & 15) << 2) | ((c ?? 0) >> 6)] : '=';
    result[ri++] = c !== undefined ? chars[c & 63] : '=';
  }

  return result.join('');
}
```

> **Why manual base64?** The main thread sandbox does not have `btoa()` or `Buffer`. You must implement base64 encoding manually. The UI iframe has full browser APIs and can decode base64 normally.

---

### Plugin Manifest Configuration

For `@create-figma-plugin` projects, the manifest is generated from `package.json`. For non-toolchain projects, you maintain `manifest.json` directly.

#### Standard Plugin Manifest

```json
{
  "api": "1.0.0",
  "editorType": ["figma"],
  "id": "YOUR_PLUGIN_ID",
  "name": "My Plugin",
  "main": "build/main.js",
  "ui": "build/ui.js",
  "documentAccess": "dynamic-page",
  "networkAccess": {
    "allowedDomains": [
      "https://fonts.googleapis.com",
      "https://fonts.gstatic.com"
    ]
  }
}
```

#### documentAccess: dynamic-page

Always use `"dynamic-page"` for new plugins. This is now required and means:

- Pages load on demand (not all at once)
- Use `figma.getNodeByIdAsync()` for node access (async)
- Use `figma.loadAllPagesAsync()` if you need cross-page access
- Reduces memory usage for large files

> **Compatibility note:** Older plugins may use `"lazy"` document access. New plugins must use `"dynamic-page"`. See `figma-api-plugin.md` for the full manifest field reference.

#### networkAccess Patterns

The `networkAccess.allowedDomains` array controls which domains the UI iframe can fetch from:

```json
{ "allowedDomains": ["none"] }
```
No network access (most restrictive, recommended for security).

```json
{ "allowedDomains": ["https://fonts.googleapis.com", "https://fonts.gstatic.com"] }
```
Allow specific domains (font loading, API calls).

```json
{ "allowedDomains": ["*"] }
```
Allow all domains (least restrictive, use only if necessary).

> **Security principle:** Request the minimum network access your plugin needs. Figma reviews `networkAccess` during plugin publishing. Explain your domains in the `reasoning` field.

---

### UI Architecture

#### Preact vs React

Preact is strongly recommended for Figma plugins because of bundle size:

| Library | Minified Size | Impact |
|---------|:------------:|--------|
| Preact | ~4 KB | Fast load, within Figma limits |
| React + ReactDOM | ~40 KB | Slower load, eats into size budget |

The `@create-figma-plugin/ui` component library is built on Preact and provides Figma-native styled components (Button, Text, Container, SegmentedControl, etc.).

#### UI Entry Point Pattern

```tsx
import { render, Container, Button, Text, VerticalSpace } from '@create-figma-plugin/ui';
import { emit, on } from '@create-figma-plugin/utilities';
import { h } from 'preact';
import { useState, useEffect, useCallback } from 'preact/hooks';

function Plugin() {
  const [data, setData] = useState(null);
  const [error, setError] = useState<ErrorData | null>(null);

  useEffect(() => {
    // Register event listeners on mount
    on<FrameExtractedHandler>(EVENTS.FRAME_EXTRACTED, (extracted) => {
      setData(extracted);
    });
    on<ErrorHandler>(EVENTS.ERROR, (err) => {
      setError(err);
    });

    // Request initial selection
    emit<GetSelectionHandler>(EVENTS.GET_SELECTION);
  }, []);

  return (
    <Container space="medium">
      {error && <ErrorState error={error} />}
      {data && <DataView data={data} />}
    </Container>
  );
}

export default render(Plugin);
```

> **Critical:** The `render()` function from `@create-figma-plugin/ui` is the entry point wrapper. It handles Preact mounting and Figma theme integration. Always use it as the default export.

#### CodeMirror Integration for Code Display

For plugins that display or edit generated code, CodeMirror provides syntax highlighting and editing:

```tsx
import { EditorView, basicSetup } from '@codemirror/view';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';

function CodeEditor({ content, language, onChange }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const extensions = [
      basicSetup,
      language === 'html' ? html() : css(),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          onChange(update.state.doc.toString());
        }
      }),
    ];

    const view = new EditorView({
      doc: content,
      extensions,
      parent: containerRef.current,
    });

    return () => view.destroy();
  }, []);

  return <div ref={containerRef} />;
}
```

CodeMirror dependencies for a Figma plugin:

```json
{
  "@codemirror/commands": "^6.10.1",
  "@codemirror/lang-css": "^6.3.1",
  "@codemirror/lang-html": "^6.4.11",
  "@codemirror/language": "^6.12.1",
  "@codemirror/state": "^6.5.3",
  "@codemirror/view": "^6.39.9"
}
```

#### Live Preview Pattern

Render generated HTML/CSS in a sandboxed iframe within the plugin UI:

```tsx
function LivePreview({ html, css, assets }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!iframeRef.current) return;

    // Replace asset references with base64 data URLs for preview
    let previewHtml = html;
    for (const asset of assets) {
      previewHtml = previewHtml.replace(
        new RegExp(`assets/${asset.filename}`, 'g'),
        asset.dataUrl
      );
    }

    const doc = iframeRef.current.contentDocument;
    if (doc) {
      doc.open();
      doc.write(previewHtml);
      doc.close();
    }
  }, [html, css, assets]);

  return <iframe ref={iframeRef} sandbox="allow-same-origin" />;
}
```

#### Undo/Redo with useHistory Hook

For editable generated code, provide undo/redo functionality:

```ts
interface UseHistoryReturn<T> {
  value: T;
  set: (value: T) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  reset: (value: T) => void;
}

function useHistory<T>(initial: T): UseHistoryReturn<T> {
  const [state, setState] = useState({
    past: [] as T[],
    present: initial,
    future: [] as T[],
  });

  const set = useCallback((value: T) => {
    setState(prev => ({
      past: [...prev.past, prev.present],
      present: value,
      future: [],
    }));
  }, []);

  const undo = useCallback(() => {
    setState(prev => {
      if (prev.past.length === 0) return prev;
      const newPast = [...prev.past];
      const newPresent = newPast.pop()!;
      return {
        past: newPast,
        present: newPresent,
        future: [prev.present, ...prev.future],
      };
    });
  }, []);

  // ... redo is symmetric

  return {
    value: state.present,
    set, undo, redo,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    reset: (value) => setState({ past: [], present: value, future: [] }),
  };
}
```

#### Window Resize Pattern

Allow the UI to request window resizing through IPC:

```ts
// Main thread handler
on<ResizeWindowHandler>(EVENTS.RESIZE_WINDOW, (width: number, height: number) => {
  figma.ui.resize(width, height);
});

// UI-side emit
emit<ResizeWindowHandler>(EVENTS.RESIZE_WINDOW, 520, 900);
```

> **Note:** Figma does not expose the parent window dimensions. Use a sensible default size and allow the user or layout to request resizes.

---

### Data Flow Architecture

The core of a design-to-code plugin is a three-stage pipeline. Each stage produces a well-defined intermediate format that is JSON-serializable (can cross the IPC boundary).

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  EXTRACTION   │ ──► │  GENERATION   │ ──► │    EXPORT     │
│               │     │               │     │               │
│ Figma Nodes   │     │ ExtractedNode │     │ GeneratedOutput│
│ → ExtractedNode│    │ → HTML + CSS  │     │ → Files + ZIP  │
│               │     │   + Tokens    │     │               │
│ (Main thread) │     │ (Either side) │     │ (Split)       │
└──────────────┘     └──────────────┘     └──────────────┘
```

#### Stage 1: Extraction (Figma Nodes → ExtractedNode)

The extraction stage reads Figma's SceneNode tree and produces a JSON-serializable `ExtractedNode` tree. This is the **critical boundary** — everything after this point is pure data transformation with no Figma API dependency.

```ts
export interface ExtractedNode {
  id: string;            // Figma node ID (e.g., "123:456")
  name: string;          // Node name from Figma layers panel
  type: string;          // Node type (FRAME, TEXT, RECTANGLE, etc.)
  bounds: Bounds;        // Position and dimensions
  opacity: number;       // Node opacity (0-1)
  visible: boolean;      // Visibility state

  // Domain-specific extracted data
  layout?: LayoutProperties;          // Auto Layout → flex properties
  layoutChild?: LayoutChildProperties; // Child sizing within Auto Layout
  fills?: FillData[];                  // Background fills
  strokes?: StrokeData[];             // Border strokes
  effects?: EffectData[];             // Shadows, blurs
  cornerRadius?: CornerRadius;        // Border radius
  text?: TextData;                    // Typography and content
  asset?: AssetData;                  // Image/vector asset metadata
  componentRef?: ComponentReference;  // Instance → component link

  children?: ExtractedNode[];         // Recursive children
}
```

Key extraction principles:

1. **Filter invisible nodes** — Skip `visible: false` nodes during traversal (they contribute nothing to rendered output)
2. **Depth limiting** — Cap tree depth (30 levels is a safe default) to prevent performance degradation on deeply nested designs
3. **Progress reporting** — Emit progress events for large trees so the UI can show a loading indicator
4. **Type-safe property access** — Use type guards (`'children' in node`, `node.type === 'TEXT'`) before accessing type-specific properties

```ts
async function extractNodeTree(
  root: SceneNode,
  options?: { maxDepth?: number; onProgress?: (current: number, total: number) => void }
): Promise<ExtractedNode> {
  const state = {
    elementCount: 0,
    maxDepth: options?.maxDepth ?? 30,
    onProgress: options?.onProgress,
  };

  return extractNode(root, null, 0, state);
}
```

Each domain has its own extraction module that runs independently:

| Module | Input | Output | What It Extracts |
|--------|-------|--------|-----------------|
| `extraction/layout.ts` | FrameNode | `LayoutProperties` | Auto Layout direction, gap, padding, alignment, wrap |
| `extraction/visual.ts` | SceneNode | `FillData[]`, `StrokeData[]`, `EffectData[]` | Colors, gradients, images, borders, shadows |
| `extraction/text.ts` | TextNode | `TextData` | Content, font, size, weight, line height, styled segments |
| `extraction/assets.ts` | SceneNode | `AssetData` | Vector container detection, image hash, export strategy |
| `extraction/variants.ts` | InstanceNode | `ComponentReference` | Component set ID, variant properties, responsive property |

> **Cross-reference:** See `design-to-code-layout.md` for the Auto Layout → Flexbox mapping rules, `design-to-code-visual.md` for fill/stroke/effect extraction, and `design-to-code-typography.md` for text extraction patterns.

#### Stage 2: Generation (ExtractedNode → Element Tree + CSS)

The generation stage transforms the extracted data into a renderable element tree with CSS styles. This is pure data transformation — no Figma API calls.

```ts
export interface GeneratedElement {
  tag: string;                              // Semantic HTML tag
  className: string;                        // BEM class name
  styles: CSSStyles;                        // CSS properties
  children: (GeneratedElement | string)[];  // Child elements or text
  attributes?: Record<string, string>;      // HTML attributes
  figmaId?: string;                         // Source Figma node ID
}

export interface GeneratedOutput {
  html: GeneratedElement;    // Root element tree
  css: CSSRule[];            // Collected CSS rules
  fonts: string[];           // Google Fonts to link
  tokens?: DesignTokens;     // Promoted design tokens
}
```

The generation pipeline applies multiple concerns in order:

```ts
// For each ExtractedNode, generate a GeneratedElement:
function generateElement(node: ExtractedNode, options: GenerateOptions): GeneratedElement {
  const tag = getSemanticTag(node, context);           // semantic.ts
  const className = generateBEMClassName(node.name, parentClass, depth);  // classname.ts
  const styles: CSSStyles = {};

  // Apply styles from each domain
  Object.assign(styles, generateLayoutStyles(node));       // layout.ts
  Object.assign(styles, generateLayoutChildStyles(node));  // layout.ts
  Object.assign(styles, generateVisualStyles(node));       // visual.ts
  Object.assign(styles, generateTypographyStyles(node));   // typography.ts
  Object.assign(styles, generatePositionStyles(node));     // position.ts

  return { tag, className, styles, children: [...], figmaId: node.id };
}
```

**BEM Class Naming:**

```ts
// Root level → block name
"card"

// First children → block__element
"card__header", "card__body", "card__footer"

// Deeper children → flatten to block__element (never block__element__sub)
"card__title", "card__icon", "card__description"
```

Class names are deduplicated with a `ClassNameTracker` that appends numeric suffixes when names collide: `card__item`, `card__item-2`, `card__item-3`.

**Node-to-Element Mapping:**

The `figmaId` field on `GeneratedElement` enables bidirectional traceability:

```ts
interface NodeMapping {
  figmaId: string;       // Original Figma node ID
  elementPath: string;   // CSS selector (e.g., ".card__title")
  nodeType: string;      // Figma node type
  nodeName: string;      // Figma layer name
  isTextNode: boolean;   // Can be edited
}
```

This enables features like click-to-select (click HTML element → highlight Figma node) and live text sync (edit text in code → update Figma text node).

#### Stage 3: Export (GeneratedOutput → Files + ZIP)

The export stage assembles the generated output into downloadable files. This stage is **split across the IPC boundary**:

- **Main thread:** Prepare bundle (assemble file contents, export binary assets)
- **UI thread:** Create ZIP file (requires `jszip` which needs browser APIs)

```ts
// Main thread: Prepare bundle
export async function prepareExportBundle(
  node: ExtractedNode,
  options: ExportOptions
): Promise<PreparedExportBundle> {
  // 1. Build asset map for image fill → filename resolution
  const assetMap = buildAssetMap(node);

  // 2. Generate output (HTML/CSS/tokens)
  const output = await generateOutput(node, { assetMap });

  // 3. Export binary assets (images, SVGs) from Figma
  const assets = await exportAllAssets(node);

  // 4. Assemble bundle (text files + binary assets)
  const bundle = generateExportBundle([{ output, name: node.name }], options);
  bundle.assets.push(...assets);

  return { bundle, folderName: node.name, fileCount: bundle.files.length, assetCount: assets.length };
}
```

The `ExportBundle` structure:

```ts
interface ExportBundle {
  files: ExportFile[];    // Text files (HTML, CSS, SCSS)
  assets: AssetFile[];    // Binary assets (PNG, SVG, JPG)
  readme?: string;        // Optional build instructions
}

interface ExportFile {
  filename: string;       // e.g., "index.html", "styles/styles.css"
  content: string;        // File content
  type: 'html' | 'css' | 'scss';
}

interface AssetFile {
  filename: string;       // e.g., "assets/hero.png"
  data: Uint8Array;       // Binary data
  mimeType: string;       // e.g., "image/png"
}
```

**Multi-Frame Export:**

For exporting multiple frames (e.g., a full page with desktop + tablet + mobile views):

1. Extract each frame independently
2. Generate output for each frame with frame-specific naming
3. Merge design tokens across frames (dedup by name, keep highest usage count)
4. Generate an `index.html` table of contents linking to each frame
5. Package all files and shared assets into a single ZIP

```ts
// Responsive mode: Multiple frames → unified CSS with media queries
const extractedNodes = await Promise.all(frames.map(async (frame) => {
  const node = await figma.getNodeByIdAsync(frame.nodeId);
  return { node: await extractNodeTree(node), name: frame.frameName };
}));

const prepared = await prepareMultiFrameBundle(extractedNodes, options);
```

---

### Selection and Figma Event Handling

#### Selection Change Listener

Register for selection changes to keep the UI in sync with the user's current selection:

```ts
// Main thread
figma.on('selectionchange', () => {
  const selection = figma.currentPage.selection;
  const data = selection.map(extractNodeInfo);
  emit<SelectionChangedHandler>(EVENTS.SELECTION_CHANGED, data);
});

function extractNodeInfo(node: SceneNode): NodeInfo {
  const info: NodeInfo = {
    id: node.id,
    name: node.name,
    type: node.type,
    width: node.width,
    height: node.height,
    x: node.x,
    y: node.y,
  };

  if ('children' in node) {
    info.childCount = (node as ChildrenMixin & SceneNode).children.length;
  }

  if ('layoutMode' in node) {
    info.hasAutoLayout = node.layoutMode !== 'NONE';
  }

  return info;
}
```

#### Settings Persistence

Use `figma.clientStorage` for user preferences that persist across plugin sessions:

```ts
// Main thread
const SETTINGS_KEY = 'pluginSettings';

on<SaveSettingsHandler>(EVENTS.SAVE_SETTINGS, async (settings: PluginSettings) => {
  try {
    await figma.clientStorage.setAsync(SETTINGS_KEY, settings);
  } catch (error) {
    console.error('Failed to save settings:', error);
  }
});

on<LoadSettingsHandler>(EVENTS.LOAD_SETTINGS, async () => {
  try {
    const settings = await figma.clientStorage.getAsync(SETTINGS_KEY);
    emit<SettingsLoadedHandler>(EVENTS.SETTINGS_LOADED, settings || null);
  } catch (error) {
    emit<SettingsLoadedHandler>(EVENTS.SETTINGS_LOADED, null);
  }
});
```

> **Important:** `clientStorage` is local to the user's machine and plugin ID. It does not sync across devices. Use it for UI preferences, not for shared data.

---

### Bidirectional Sync Patterns

Advanced plugins can sync changes between the code editor and the Figma canvas.

#### Text Node Sync (Code → Figma)

When a user edits text in the generated HTML, propagate the change back to the Figma text node:

```ts
on<UpdateTextNodeHandler>(EVENTS.UPDATE_TEXT_NODE, async (figmaId: string, newText: string) => {
  try {
    const node = await figma.getNodeByIdAsync(figmaId);
    if (!node || node.type !== 'TEXT') {
      emit<TextNodeUpdatedHandler>(EVENTS.TEXT_NODE_UPDATED, false, figmaId, 'Not a text node');
      return;
    }

    const textNode = node as TextNode;

    // Load fonts before modifying text (required by Figma API)
    if (textNode.fontName === figma.mixed) {
      // Mixed fonts — load each font range
      const len = textNode.characters.length;
      const loaded = new Set<string>();
      for (let i = 0; i < len; i++) {
        const font = textNode.getRangeFontName(i, i + 1) as FontName;
        const key = `${font.family}-${font.style}`;
        if (!loaded.has(key)) {
          loaded.add(key);
          await figma.loadFontAsync(font);
        }
      }
    } else {
      await figma.loadFontAsync(textNode.fontName as FontName);
    }

    textNode.characters = newText;
    emit<TextNodeUpdatedHandler>(EVENTS.TEXT_NODE_UPDATED, true, figmaId);
  } catch (error) {
    emit<TextNodeUpdatedHandler>(EVENTS.TEXT_NODE_UPDATED, false, figmaId, String(error));
  }
});
```

#### Layout Property Sync (Code → Figma)

Sync CSS layout property changes back to Figma Auto Layout properties:

```ts
on<UpdateLayoutNodeHandler>(EVENTS.UPDATE_LAYOUT_NODE, async (figmaId, property, value) => {
  const node = await figma.getNodeByIdAsync(figmaId);
  if (!node || !('layoutMode' in node)) return;

  const frame = node as FrameNode;

  switch (property) {
    case 'flex-direction':
      frame.layoutMode = value === 'row' ? 'HORIZONTAL' : 'VERTICAL';
      break;
    case 'justify-content':
      const justifyMap = { 'flex-start': 'MIN', 'center': 'CENTER', 'flex-end': 'MAX', 'space-between': 'SPACE_BETWEEN' };
      frame.primaryAxisAlignItems = justifyMap[value] || 'MIN';
      break;
    case 'align-items':
      const alignMap = { 'flex-start': 'MIN', 'center': 'CENTER', 'flex-end': 'MAX', 'baseline': 'BASELINE' };
      frame.counterAxisAlignItems = alignMap[value] || 'MIN';
      break;
    case 'gap':
      frame.itemSpacing = parseInt(value, 10);
      break;
    case 'flex-wrap':
      frame.layoutWrap = value === 'wrap' ? 'WRAP' : 'NO_WRAP';
      break;
    // padding-top, padding-right, padding-bottom, padding-left...
  }

  emit<LayoutNodeUpdatedHandler>(EVENTS.LAYOUT_NODE_UPDATED, true, figmaId);
});
```

> **Key insight:** The `data-figma-id` attribute on generated HTML elements is what connects the rendered output back to the source Figma nodes. This attribute is included during HTML rendering and enables any bidirectional sync feature.

---

### Performance Patterns

#### Large Frame Warnings

Monitor extraction size and warn about performance implications:

```ts
const elementCount = countElements(extracted);
const extractionTime = Date.now() - startTime;
console.log(`[Extraction] ${elementCount} elements in ${extractionTime}ms`);

if (elementCount > 1000) {
  console.warn(`[Extraction] Large frame (${elementCount} elements). Performance may be affected.`);
}
```

#### Timing Instrumentation

Log timing for each pipeline stage to identify bottlenecks:

```ts
const extractStart = Date.now();
const extracted = await extractNodeTree(node);
const extractTime = Date.now() - extractStart;

const genStart = Date.now();
const output = await generateOutput(extracted, options);
const genTime = Date.now() - genStart;

console.log(
  `[Pipeline] ${elementCount} elements: ` +
  `extraction ${extractTime}ms, generation ${genTime}ms, ` +
  `total ${extractTime + genTime}ms`
);
```

#### Asset Export Optimization

Asset export (images, SVGs) is the slowest part of the pipeline. Optimize by:

1. **Deduplicating assets** by image hash before export
2. **Building an asset map** before generation so code references correct filenames
3. **Logging per-asset timing** for large exports to identify slow assets

```ts
const assetMap = buildAssetMap(extracted);  // Hash → filename mapping
setAssetMap(assetMap);                      // Make available to CSS generation
const output = await generateOutput(extracted, { assetMap });
const assets = await exportAllAssets(extracted);  // Export unique assets only
```

---

### Testing Patterns

The extraction and generation modules are pure functions operating on JSON data, making them highly testable:

```ts
// generation/layout.test.ts
import { describe, it, expect } from 'vitest';
import { generateLayoutStyles } from './layout';

describe('generateLayoutStyles', () => {
  it('generates flex-direction: row for FLEX_ROW mode', () => {
    const node = {
      layout: { mode: 'FLEX_ROW', gap: 8, padding: { top: 0, right: 0, bottom: 0, left: 0 } }
    };
    const styles = generateLayoutStyles(node);
    expect(styles.display).toBe('flex');
    expect(styles.flexDirection).toBe('row');
    expect(styles.gap).toBe('8px');
  });
});
```

Test setup in `package.json`:

```json
{
  "devDependencies": {
    "vitest": "^4.0.16",
    "@vitest/coverage-v8": "^4.0.16"
  },
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  }
}
```

> **Principle:** Keep Figma API calls isolated in `extraction/` and `export/assets.ts`. Everything else operates on plain TypeScript types and can be tested without any Figma environment.

---

## Cross-References

- **`figma-api-plugin.md`** — Plugin API reference (sandbox model, SceneNode types, manifest fields, API methods). This module builds on that foundation with architecture patterns.
- **`figma-api-devmode.md`** — Dev Mode codegen plugin API reference. For codegen-specific architecture, see `plugin-codegen.md`.
- **`design-to-code-layout.md`** — Auto Layout → Flexbox mapping rules consumed by `extraction/layout.ts` and `generation/layout.ts`.
- **`design-to-code-visual.md`** — Visual property extraction rules consumed by `extraction/visual.ts` and `generation/visual.ts`.
- **`design-to-code-typography.md`** — Typography extraction rules consumed by `extraction/text.ts` and `generation/typography.ts`.
- **`design-to-code-assets.md`** — Asset detection and export patterns consumed by `extraction/assets.ts` and `export/assets.ts`.
- **`design-to-code-semantic.md`** — Semantic HTML tag selection used by `generation/semantic.ts`.
- **`css-strategy.md`** — Three-layer CSS architecture (Tailwind + Custom Properties + CSS Modules) for organizing generated CSS.
- **`design-tokens.md`** — Token promotion and rendering patterns consumed by `tokens/` modules.
- **`plugin-codegen.md`** — Codegen plugin development patterns (Dev Mode integration, generate callback, preferences system).
- **`plugin-best-practices.md`** — Production best practices for error handling, performance, memory management, caching, async patterns, testing, and distribution. Complements the architecture patterns in this module with quality and reliability guidance.
