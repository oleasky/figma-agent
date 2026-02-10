# Figma Plugin Best Practices

## Purpose

Production-hardened best practices for Figma plugin development — covering error handling, performance optimization, memory management, caching strategies, async patterns, testing and debugging, and plugin distribution. These patterns are extracted from a production Figma plugin that extracts designs and generates HTML/CSS code. For plugin architecture patterns (project structure, IPC, data flow), see `plugin-architecture.md`. For the Plugin API reference, see `figma-api-plugin.md`.

## When to Use

Reference this module when you need to:

- Implement robust error handling with structured error types and IPC propagation
- Optimize plugin performance for large Figma files (1000+ elements)
- Manage memory effectively when processing complex node trees
- Cache Figma API results (variables, fonts, component references) to reduce repeated calls
- Write correct async code with Figma's async APIs (getNodeByIdAsync, loadFontAsync, exportAsync)
- Test and debug plugin logic without the Figma runtime environment
- Prepare a plugin for publishing (permissions, manifest, versioning)

---

## Content

### 1. Error Handling Patterns

Reliable error handling is the difference between a plugin that users trust and one they abandon. Every error in a Figma plugin falls into one of three categories: validation errors (bad input), processing errors (extraction/generation failures), and infrastructure errors (Figma API failures).

#### Structured Error Types

Define error data that the UI can display and act upon. A structured error includes a machine-readable code, a human-readable message, and optional technical details:

```ts
// Error code enum — one code per failure category
export const ERROR_CODES = {
  NO_SELECTION: 'NO_SELECTION',
  INVALID_NODE: 'INVALID_NODE',
  EXTRACTION_FAILED: 'EXTRACTION_FAILED',
  GENERATION_FAILED: 'GENERATION_FAILED',
  EXPORT_FAILED: 'EXPORT_FAILED',
  THUMBNAIL_FAILED: 'THUMBNAIL_FAILED',
} as const;

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];

// Structured error data for UI display
export interface ErrorData {
  code: ErrorCode;
  message: string;      // User-facing message (non-technical)
  details?: string;     // Technical details (from caught exception)
}
```

Why codes instead of just messages:
- The UI can show different recovery actions per error code
- Error codes are stable across refactors (messages can change)
- Logging and analytics can aggregate by code
- Localization can map codes to translated messages

#### Error Propagation Across IPC

Errors originating in the main thread must be propagated to the UI thread through IPC. Use a centralized `emitError` helper so every error follows the same pattern:

```ts
import { emit } from '@create-figma-plugin/utilities';

function emitError(code: ErrorData['code'], message: string, error?: unknown): void {
  const details = error instanceof Error
    ? error.message
    : error ? String(error) : undefined;

  // Always log to console for developer debugging
  console.error(`[Error] ${code}: ${message}`, details || '');

  // Emit structured error to UI
  emit<ErrorHandler>(EVENTS.ERROR, { code, message, details });
}
```

Benefits of a centralized helper:
- Console logging is automatic (developers see errors during development)
- Error structure is consistent (UI can always expect the same shape)
- Unknown error types are safely converted to strings
- The `code` field enables the UI to show contextual recovery suggestions

#### Try/Catch Placement

Wrap the entire body of each IPC event handler in a single try/catch. Do NOT wrap individual operations within a handler — that fragments error handling and makes it easy to miss paths:

```ts
// GOOD: Single try/catch per handler
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

// BAD: Multiple try/catch blocks per handler
on<ExtractFrameHandler>(EVENTS.EXTRACT_FRAME, async (nodeId: string) => {
  let node;
  try {
    node = await figma.getNodeByIdAsync(nodeId);
  } catch (e) {
    emitError(ERROR_CODES.INVALID_NODE, 'Node lookup failed.', e);
    return;
  }
  let extracted;
  try {
    extracted = await extractNodeTree(node as SceneNode);
  } catch (e) {
    emitError(ERROR_CODES.EXTRACTION_FAILED, 'Extraction failed.', e);
    return;
  }
  // ... more fragmented try/catch blocks
});
```

The exception to this rule is operations where you want to skip a failure and continue (e.g., asset export for individual files where one failure should not block others).

#### Graceful Degradation

When processing a tree of nodes, skip unsupported or problematic nodes rather than failing the entire operation:

```ts
// Asset export: skip failures, continue with remaining assets
for (let i = 0; i < nodesWithAssets.length; i++) {
  const assetNode = nodesWithAssets[i];
  try {
    const data = await exportAsset(assetNode.id, format);
    assets.push({ filename, data, mimeType });
  } catch (error) {
    // Log but continue with other assets
    console.warn(`[Export] Failed to export asset "${assetNode.name}":`, error);
  }
}

// Thumbnail generation: add placeholder on failure
try {
  const bytes = await node.exportAsync({ format: 'PNG', constraint: { type: 'WIDTH', value: 200 } });
  thumbnails.push({ id: nodeId, name: node.name, thumbnail: base64Data });
} catch (error) {
  console.error('[Thumbnails] Failed for node:', nodeId, error);
  // Still include the frame with empty thumbnail — UI shows placeholder
  thumbnails.push({ id: nodeId, name: node.name, thumbnail: '' });
}
```

#### UI Error Display and Recovery

On the UI side, handle error events by showing actionable messages with recovery options:

```tsx
on<ErrorHandler>(EVENTS.ERROR, (error: ErrorData) => {
  setError(error);
});

function ErrorState({ error, onRetry }: { error: ErrorData; onRetry?: () => void }) {
  const recoveryHint = getRecoveryHint(error.code);

  return (
    <Container space="medium">
      <Text style="bold">{error.message}</Text>
      {recoveryHint && <Text style="muted">{recoveryHint}</Text>}
      {error.details && <Text style="code">{error.details}</Text>}
      {onRetry && <Button onClick={onRetry}>Retry</Button>}
    </Container>
  );
}

function getRecoveryHint(code: ErrorCode): string | null {
  switch (code) {
    case 'NO_SELECTION':
      return 'Select a frame or component in the Figma canvas.';
    case 'INVALID_NODE':
      return 'Select a frame, component, or group — not a page or individual shape.';
    case 'EXTRACTION_FAILED':
      return 'The design may be too complex. Try selecting a smaller section.';
    case 'EXPORT_FAILED':
      return 'Export failed. Try again or check if any images are missing.';
    default:
      return null;
  }
}
```

---

### 2. Performance Patterns

Performance is critical for plugin adoption. A plugin that freezes Figma for 5 seconds on every interaction will be uninstalled immediately. The key insight: the extraction phase (reading Figma nodes) is the bottleneck, not generation (pure data transformation).

#### Progress Tracking for Long Operations

For any operation that processes more than ~100 nodes, report progress to the UI so users see that the plugin is working:

```ts
// Extraction statistics for performance monitoring
export interface ExtractionStats {
  elementCount: number;
  maxDepthReached: number;
  depthLimitHit: boolean;
  extractionTimeMs: number;
}

// Internal mutable state during extraction
interface ExtractionState {
  elementCount: number;
  maxDepthReached: number;
  depthLimitHit: boolean;
  onProgress?: (current: number, total: number) => void;
  maxDepth: number;
}

// Emit progress every N elements
if (state.onProgress && state.elementCount % 50 === 0) {
  state.onProgress(state.elementCount, state.elementCount + 100); // Estimate total
}
```

Wire progress to the UI through IPC:

```ts
const extracted = await extractNodeTree(node, {
  onProgress: (current, total) => {
    emit<ExtractionProgressHandler>(EVENTS.EXTRACTION_PROGRESS, {
      current,
      total,
      phase: 'extracting',
    });
  },
});
```

#### Pipeline Timing Instrumentation

Log timing for each stage of the extraction-generation-export pipeline to identify bottlenecks:

```ts
// Extraction phase
const extractStart = Date.now();
const extracted = await extractNodeTree(node as SceneNode);
const extractTime = Date.now() - extractStart;

// Generation phase
const genStart = Date.now();
const output = await generateOutput(extracted, options);
const genTime = Date.now() - genStart;

const elementCount = countElements(extracted);
console.log(
  `[Pipeline] ${elementCount} elements: ` +
  `extraction ${extractTime}ms, generation ${genTime}ms, ` +
  `total ${extractTime + genTime}ms`
);

// Warn about large frames
if (elementCount > 1000) {
  console.warn(
    `[Extraction] Large frame detected (${elementCount} elements). ` +
    `Performance may be affected.`
  );
}
```

This instrumentation reveals where to invest optimization effort. In practice, extraction typically accounts for 60-80% of total time because it involves async Figma API calls, while generation is pure synchronous computation.

#### Depth Limits on Recursive Traversal

Cap tree traversal depth to prevent performance degradation on deeply nested designs. Figma designs rarely exceed 15-20 levels of nesting intentionally — deeper nesting usually indicates auto-layout structure rather than meaningful visual hierarchy:

```ts
const MAX_DEPTH = 30;

async function extractNode(
  node: SceneNode,
  parent: SceneNode | null,
  depth: number,
  state: ExtractionState
): Promise<ExtractedNode | null> {
  // Check depth limit before recursing
  if ('children' in node) {
    if (depth >= state.maxDepth) {
      state.depthLimitHit = true;
      console.warn(
        `[Extraction] Depth limit (${state.maxDepth}) reached at "${node.name}", ` +
        `truncating ${node.children.length} children`
      );
      return extracted; // Return node without children
    }

    const visibleChildren = node.children.filter(child => child.visible);
    extracted.children = await Promise.all(
      visibleChildren.map(child => extractNode(child, node, depth + 1, state))
    );
  }

  return extracted;
}
```

A depth of 30 is a safe production default — it accommodates complex designs while preventing runaway recursion on pathological files.

#### Batch Sequential Operations

When processing children of a node, batch operations sequentially rather than firing all at once. Figma's API can handle some parallelism, but excessive concurrent calls can cause issues:

```ts
// GOOD: Process children with controlled parallelism
const visibleChildren = containerNode.children.filter(child => child.visible);
const childResults = await Promise.all(
  visibleChildren.map(child => extractNode(child, node, depth + 1, state))
);

// GOOD: Sequential for Figma API calls that modify state
for (const font of fontsToLoad) {
  await figma.loadFontAsync(font);
}

// BAD: Unbounded parallelism on heavy Figma API operations
const allExports = await Promise.all(
  allNodes.map(node => node.exportAsync({ format: 'PNG' })) // Can overwhelm Figma
);
```

For pure extraction (reading properties), parallel `Promise.all` on children is fine. For operations that involve I/O like `exportAsync`, process sequentially or in small batches.

#### UI Responsiveness During Extraction

The main thread shares execution time with Figma's renderer. Long synchronous operations block the UI. Use progress callbacks and chunked processing to keep the plugin responsive:

```ts
// Report progress periodically during traversal
if (state.onProgress && state.elementCount % 50 === 0) {
  state.onProgress(state.elementCount, state.elementCount + 100);
}
```

For asset export (the slowest operation), log per-asset timing to help identify slow exports:

```ts
for (const asset of assets) {
  const assetStartTime = Date.now();
  const base64 = uint8ArrayToBase64(asset.data);
  const assetTime = Date.now() - assetStartTime;
  if (assetTime > 100) {
    console.log(
      `[Export] Base64 conversion: ${asset.filename} ` +
      `(${asset.data.length} bytes) took ${assetTime}ms`
    );
  }
}
```

#### Bundle Size Optimization

Plugin load time affects perceived performance. The UI iframe must load all JavaScript before the plugin becomes interactive:

| Library | Minified Size | Recommendation |
|---------|:------------:|----------------|
| Preact | ~4 KB | Use this for plugin UI |
| React + ReactDOM | ~40 KB | Avoid — 10x larger than Preact |
| CodeMirror (basic) | ~150 KB | Worth it for code editing features |
| JSZip | ~100 KB | Load only when export is triggered |

Optimization strategies:
- Use Preact (not React) with `@create-figma-plugin/ui` components
- Enable `--minify` in the build script (`build-figma-plugin --typecheck --minify`)
- Tree shake unused modules by using named imports
- Consider dynamic import for heavy libraries (CodeMirror, JSZip) loaded only when needed

> **Cross-reference:** See `plugin-architecture.md` for the Preact vs React comparison and `@create-figma-plugin` build configuration.

---

### 3. Memory Management

Figma plugins run in a constrained environment. The main thread sandbox has limited memory, and the IPC bridge can only transfer JSON-serializable data. Memory mismanagement causes crashes on large files.

#### JSON-Serializable Intermediate Format

The most critical architectural decision in any design-to-code plugin: the extraction stage must produce a **JSON-serializable** intermediate format. You cannot pass Figma `SceneNode` objects across the IPC boundary — they are live references to the document graph, not plain data.

```ts
// WRONG: Trying to pass Figma nodes to the UI
figma.ui.postMessage({
  type: 'NODE_DATA',
  node: figma.currentPage.selection[0], // Fails — not serializable
});

// RIGHT: Extract to a plain data structure first
export interface ExtractedNode {
  id: string;
  name: string;
  type: string;
  bounds: { x: number; y: number; width: number; height: number };
  opacity: number;
  visible: boolean;
  layout?: LayoutProperties;
  fills?: FillData[];
  strokes?: StrokeData[];
  effects?: EffectData[];
  text?: TextData;
  asset?: AssetData;
  children?: ExtractedNode[];
}

// Extract first, then pass across IPC
const extracted = await extractNodeTree(node);
emit<FrameExtractedHandler>(EVENTS.FRAME_EXTRACTED, extracted);
```

This pattern also provides a clean separation between Figma API access (main thread only) and code generation (can run on either side).

#### Selective Property Extraction

Extract only the properties that your generation pipeline needs. Reading every property on every node wastes time and memory:

```ts
// GOOD: Extract only what generation needs
const extracted: ExtractedNode = {
  id: node.id,
  name: node.name,
  type: node.type,
  bounds: {
    x: Math.round(node.x),
    y: Math.round(node.y),
    width: Math.round(node.width),
    height: Math.round(node.height),
  },
  opacity: 'opacity' in node ? node.opacity : 1,
  visible: node.visible,
};

// Only extract layout if the node has Auto Layout
const layout = await extractLayout(node);
if (layout) extracted.layout = layout;

// Only extract text if it's a TEXT node
const text = await extractText(node);
if (text) extracted.text = text;
```

Each domain extraction module (layout, visual, text, assets) runs independently and only populates its fields when relevant. Nodes that are plain rectangles with no special properties carry minimal extracted data.

#### Asset Deduplication by Hash

Figma files commonly reuse the same image across multiple nodes (a logo, avatar, pattern). Export each unique image once, not once per usage:

```ts
// Track already-exported imageHashes to avoid duplicates
const exportedImageHashes = new Map<string, string>(); // imageHash -> filename

for (const assetNode of nodesWithAssets) {
  const imageHash = assetNode.asset!.imageHash;

  // Skip duplicate image exports — same imageHash means same image
  if (imageHash && exportedImageHashes.has(imageHash)) {
    console.log(`[Export] Skipping duplicate image "${assetNode.name}" (same hash)`);
    continue;
  }

  const data = await exportAsset(assetNode.id, format);
  assets.push({ filename, data, mimeType });

  // Track exported hash
  if (imageHash) {
    exportedImageHashes.set(imageHash, filename);
  }
}
```

The same deduplication applies to the asset map used by the generation pipeline:

```ts
// Build a map from node ID and imageHash to asset filename
export function buildAssetMap(node: ExtractedNode): Map<string, string> {
  const assetMap = new Map<string, string>();
  const imageHashToFilename = new Map<string, string>();

  for (const assetNode of nodesWithAssets) {
    const imageHash = assetNode.asset!.imageHash;

    // Reuse existing filename for same hash
    if (imageHash && imageHashToFilename.has(imageHash)) {
      assetMap.set(assetNode.id, imageHashToFilename.get(imageHash)!);
      continue;
    }

    const filename = filenameTracker.getUnique(baseName, extension);
    assetMap.set(assetNode.id, filename);

    if (imageHash) {
      assetMap.set(imageHash, filename);
      imageHashToFilename.set(imageHash, filename);
    }
  }

  return assetMap;
}
```

#### Large File Handling

For files with hundreds of frames or thousands of nodes, implement safeguards:

- **Element count warnings:** Log warnings at thresholds (e.g., 1000+ elements) so developers know to optimize
- **Depth limiting:** Cap recursion depth to prevent stack overflow (see Performance Patterns above)
- **Pagination:** For multi-frame export, process frames sequentially rather than loading all into memory at once
- **Asset budget:** Log asset count and total size estimates before starting export

```ts
// Pre-flight check before starting heavy export
const elementCount = countElements(extracted);
let assetCount = 0;
const countAssets = (n: ExtractedNode) => {
  if (n.asset) assetCount++;
  n.children?.forEach(countAssets);
};
countAssets(extracted);

console.log(`[Export] Pre-flight: ${elementCount} elements, ${assetCount} assets`);
```

#### Clean Up References

Null out large cached data structures when they are no longer needed. Module-level caches in the main thread persist for the plugin's entire lifetime:

```ts
// Module-level variable cache
let localVariableIds: Set<string> | null = null;

// Clear when starting a new extraction run
export function clearVariableCache(): void {
  localVariableIds = null;
}
```

---

### 4. Caching Strategies

Figma's async APIs have non-trivial overhead. Caching results of repeated calls dramatically improves performance, especially during tree traversal where the same information is needed for every node.

#### Variable Cache (Lazy-Load Once, Reuse)

The most impactful cache in a design-to-code plugin: loading local variables once and reusing the set for every node's variable bindings check:

```ts
// Cache for local variable IDs — populated once per extraction run
let localVariableIds: Set<string> | null = null;

async function isLocalVariable(variableId: string): Promise<boolean> {
  if (localVariableIds === null) {
    // Lazy-load: first call populates the cache
    try {
      const localVars = await figma.variables.getLocalVariablesAsync();
      localVariableIds = new Set(localVars.map(v => v.id));
    } catch {
      localVariableIds = new Set();
    }
  }
  return localVariableIds.has(variableId);
}
```

Without this cache, every fill/stroke/effect extraction that checks for variable bindings would call `getLocalVariablesAsync()` — a slow async operation. With the cache, the first node pays the cost and all subsequent nodes get an O(1) Set lookup.

#### Font Loading Cache

Font loading is required before text node modification but not before text node reading during extraction. For operations that modify text nodes (like bidirectional sync), cache already-loaded fonts:

```ts
const loadedFonts = new Set<string>();

async function ensureFontLoaded(fontName: FontName): Promise<void> {
  const key = `${fontName.family}-${fontName.style}`;
  if (loadedFonts.has(key)) return;

  await figma.loadFontAsync(fontName);
  loadedFonts.add(key);
}

// Usage in text sync handler
if (textNode.fontName === figma.mixed) {
  const len = textNode.characters.length;
  for (let i = 0; i < len; i++) {
    const font = textNode.getRangeFontName(i, i + 1) as FontName;
    await ensureFontLoaded(font);
  }
} else {
  await ensureFontLoaded(textNode.fontName as FontName);
}
```

#### Component Reference Cache

When processing instances, cache the mapping from component IDs to component names to avoid repeated `getMainComponentAsync()` calls:

```ts
const componentNameCache = new Map<string, string>();

async function getComponentName(instance: InstanceNode): Promise<string | null> {
  const mainComponent = instance.mainComponent;
  if (!mainComponent) return null;

  const cached = componentNameCache.get(mainComponent.id);
  if (cached) return cached;

  componentNameCache.set(mainComponent.id, mainComponent.name);
  return mainComponent.name;
}
```

#### Cache Invalidation

Caches must be invalidated when the underlying data changes:

| Cache | Invalidation Trigger | Strategy |
|-------|---------------------|----------|
| Variable IDs | New extraction run | Clear at extraction start |
| Loaded fonts | Never (fonts don't change) | Persist for plugin lifetime |
| Component names | Page change | Clear on `currentpagechange` |
| Extracted node data | Selection change | Clear and re-extract |
| Asset map | New extraction run | Rebuild per extraction |

```ts
// Clear caches on page change
figma.on('currentpagechange', () => {
  componentNameCache.clear();
  clearVariableCache();
});
```

#### Session vs Persistent Caching

Two storage mechanisms are available for caching:

**Session-scoped (module-level variables):**
- Lives in memory for the plugin's lifetime
- Lost when plugin is closed
- Use for: variable IDs, font caches, component names, extracted data

**Persistent (`figma.clientStorage`):**
- Survives plugin restarts
- Local to user's machine and plugin ID
- Use for: user preferences, export settings, component mapping configs

```ts
// Persistent: User settings survive restarts
const SETTINGS_KEY = 'pluginSettings';
await figma.clientStorage.setAsync(SETTINGS_KEY, settings);
const settings = await figma.clientStorage.getAsync(SETTINGS_KEY);

// Persistent: Clear all stored data
const keys = await figma.clientStorage.keysAsync();
for (const key of keys) {
  await figma.clientStorage.deleteAsync(key);
}
```

**Node-level (`pluginData`):**
- Stored on individual Figma nodes
- Persists with the file, visible only to your plugin
- Use for: per-node metadata, export markers, last-generated state

```ts
// Store export metadata on a node
node.setPluginData('lastExport', JSON.stringify({ timestamp: Date.now(), format: 'html' }));
const meta = JSON.parse(node.getPluginData('lastExport') || 'null');
```

---

### 5. Async Patterns

Figma's Plugin API is heavily async. The most common plugin bugs come from incorrect async handling — using sync methods in dynamic-page plugins, forgetting to load fonts, or not handling timeouts.

#### getNodeByIdAsync for Dynamic-Page Plugins

All new plugins must use `documentAccess: "dynamic-page"`. This means pages load on demand and node access is async:

```ts
// CORRECT: Async node access (required for dynamic-page)
const node = await figma.getNodeByIdAsync(nodeId);

// WRONG: Sync access (deprecated, fails with dynamic-page)
const node = figma.getNodeById(nodeId); // Don't use this
```

Always null-check the result — nodes can be deleted, on unloaded pages, or invalid:

```ts
const node = await figma.getNodeByIdAsync(nodeId);
if (!node) {
  emitError(ERROR_CODES.INVALID_NODE, 'Node not found. It may have been deleted.');
  return;
}
```

#### loadFontAsync Before Text Modifications

Font loading is **mandatory** before modifying text node content or style properties. Reading text content (during extraction) does not require font loading:

```ts
// Reading text — NO font loading needed
const content = textNode.characters; // Works without loading fonts
const fontSize = textNode.fontSize;  // Works without loading fonts

// Modifying text — MUST load fonts first
await figma.loadFontAsync(textNode.fontName as FontName);
textNode.characters = 'New text'; // Throws if font not loaded

// Mixed fonts — must load each font range
if (textNode.fontName === figma.mixed) {
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
}
```

#### exportAsync for Images and SVGs

`exportAsync()` is the most time-consuming Figma API call. Use it carefully:

```ts
// PNG/JPG export with retina scaling
const pngBytes = await node.exportAsync({
  format: 'PNG',
  constraint: { type: 'SCALE', value: 2 }, // 2x for retina
});

// SVG export (vector-native, no scaling needed)
const svgBytes = await node.exportAsync({ format: 'SVG' });

// Thumbnail export with fixed width (consistent quality)
const thumbBytes = await node.exportAsync({
  format: 'PNG',
  constraint: { type: 'WIDTH', value: 200 },
});
```

For image fills, prefer exporting from Figma's image store directly to get original quality:

```ts
async function exportImageByHash(imageHash: string): Promise<Uint8Array> {
  const image = figma.getImageByHash(imageHash);
  if (!image) throw new Error(`Image not found: ${imageHash}`);
  return image.getBytesAsync();
}
```

#### Timeout Handling for Long Operations

Wrap long-running operations with timeouts to prevent the plugin from appearing frozen:

```ts
const EXPORT_TIMEOUT_MS = 10000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Export timeout after ${ms}ms for: ${label}`));
    }, ms);

    promise
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

// Usage
const svgData = await withTimeout(
  node.exportAsync({ format: 'SVG' }),
  EXPORT_TIMEOUT_MS,
  `SVG export of "${node.name}"`
);
```

> **Note:** The main thread sandbox does not have `setTimeout`. This `withTimeout` pattern works because the timer is created inside a Promise executor, using the Promise-based timing that the sandbox does support. For codegen plugins, the 3-second hard timeout set by Figma itself is the limiting factor — see `plugin-codegen.md`.

#### Sequential vs Parallel Async

Use this decision guide for async patterns:

| Operation | Strategy | Why |
|-----------|:--------:|-----|
| Extract child node properties | Parallel (`Promise.all`) | Read-only, no contention |
| Export multiple assets | Sequential (for loop) | Each `exportAsync` is heavy, avoids overwhelming Figma |
| Load multiple fonts | Sequential (for loop) | Font loading can fail if too many concurrent |
| Process multiple frames | Sequential (for loop) | Each frame extraction is memory-intensive |
| Generate code from extracted data | Synchronous | Pure data transformation, no async needed |

```ts
// Parallel: extracting children (read-only, safe)
const childResults = await Promise.all(
  visibleChildren.map(child => extractNode(child, node, depth + 1, state))
);

// Sequential: exporting assets (heavy I/O, one at a time)
for (const assetNode of nodesWithAssets) {
  const data = await exportAsset(assetNode.id, format);
  assets.push({ filename, data, mimeType });
}
```

#### Cancellation Patterns

For long-running operations, check whether the plugin is still active before continuing:

```ts
// Check if plugin was closed during a long operation
let pluginActive = true;
figma.on('close', () => { pluginActive = false; });

async function extractLargeTree(root: SceneNode): Promise<ExtractedNode> {
  for (const child of root.children) {
    if (!pluginActive) {
      console.log('[Extraction] Plugin closed, aborting');
      throw new Error('Plugin closed during extraction');
    }
    await extractNode(child);
  }
}
```

---

### 6. Testing and Debugging

Plugin code is challenging to test because extraction modules depend on the Figma API runtime. The key strategy: isolate Figma API calls to a thin extraction layer and make everything else pure functions on plain data.

#### Console Logging Strategy

Use prefixed, structured console logging throughout the plugin for debugging:

```ts
// Good: prefixed, contextual, with relevant data
console.log('[Extraction] 450 elements in 234ms');
console.log('[Export] Processing asset 3/12: "hero-image" as PNG');
console.log('[Settings] Saved settings to client storage');
console.warn('[Extraction] Depth limit (30) reached at "deeply-nested-frame"');
console.error('[Export] Failed to export asset "broken-image":', error);

// Bad: unprefixed, no context
console.log('done');
console.log(node.name);
console.log('error', e);
```

Use consistent prefixes per domain:
- `[Extraction]` — Node tree traversal and property extraction
- `[Generation]` — HTML/CSS code generation
- `[Export]` — Asset export and bundle preparation
- `[Settings]` — Settings persistence
- `[TextSync]` — Bidirectional text sync
- `[LayoutSync]` — Bidirectional layout sync
- `[Cache]` — Cache operations
- `[Thumbnails]` — Thumbnail generation
- `[Error]` — Error propagation
- `[Pipeline]` — Overall pipeline timing
- `[Variants]` — Component variant resolution

#### Code Validation

Validate generated HTML and CSS before displaying to users. Broken output erodes trust:

```ts
interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  sanitizedCode: string;
}

// HTML validation: tag structure, bracket matching, script removal
function validateHTML(html: string): ValidationResult {
  const errors: ValidationError[] = [];
  let sanitized = html;

  sanitized = removeJavaScript(sanitized, errors);  // Security
  validateTagStructure(sanitized, errors);           // Unclosed tags
  validateBrackets(sanitized, errors);               // Quote matching

  return { valid: errors.filter(e => e.type === 'error').length === 0, errors, sanitizedCode: sanitized };
}

// CSS validation: bracket matching, property syntax, JS removal
function validateCSS(css: string): ValidationResult {
  const errors: ValidationError[] = [];
  let sanitized = css;

  sanitized = removeJSFromCSS(sanitized, errors);   // Security
  validateCSSBrackets(sanitized, errors);            // Brace matching
  validateCSSProperties(sanitized, errors);          // Semicolons, colons

  return { valid: errors.filter(e => e.type === 'error').length === 0, errors, sanitizedCode: sanitized };
}
```

Always strip JavaScript from generated output for security — generated HTML should never contain executable code:

```ts
function removeJavaScript(html: string, errors: ValidationError[]): string {
  let result = html;
  // Remove <script> tags
  result = result.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
  // Remove inline event handlers (onclick, onerror, etc.)
  result = result.replace(/\s(on\w+)=["'][^"']*["']/gi, '');
  // Remove javascript: URLs
  result = result.replace(/href=["']javascript:[^"']*["']/gi, 'href="#"');
  return result;
}
```

> **Cross-reference:** See `plugin-codegen.md` for code quality patterns specific to codegen plugins (HTML validation, CSS validation, formatting).

#### Mock Data for UI Development

Develop and test the plugin UI independently of the Figma runtime by creating mock data fixtures:

```ts
// test/fixtures/mock-extracted.ts
export const mockExtractedFrame: ExtractedNode = {
  id: '1:100',
  name: 'Hero Section',
  type: 'FRAME',
  bounds: { x: 0, y: 0, width: 1440, height: 600 },
  opacity: 1,
  visible: true,
  layout: {
    mode: 'FLEX_COLUMN',
    gap: 24,
    padding: { top: 48, right: 64, bottom: 48, left: 64 },
    primaryAlign: 'CENTER',
    crossAlign: 'CENTER',
  },
  children: [
    {
      id: '1:101',
      name: 'Title',
      type: 'TEXT',
      bounds: { x: 0, y: 0, width: 800, height: 48 },
      opacity: 1,
      visible: true,
      text: {
        content: 'Welcome to Our Platform',
        font: { family: 'Inter', style: 'Bold', size: 48, weight: 700 },
      },
    },
    // ... more mock children
  ],
};
```

Use these fixtures for:
- UI component development (render with mock data, no Figma needed)
- Unit tests for generation modules
- Visual regression testing of generated HTML output
- Developing export features offline

#### Testing Pure Generation Functions

The generation pipeline operates on `ExtractedNode` data, not Figma API objects. This makes it fully testable with standard test frameworks:

```ts
// generation/layout.test.ts
import { describe, it, expect } from 'vitest';
import { generateLayoutStyles } from './layout';

describe('generateLayoutStyles', () => {
  it('generates flex-direction: row for horizontal layout', () => {
    const node = {
      layout: {
        mode: 'FLEX_ROW',
        gap: 8,
        padding: { top: 0, right: 0, bottom: 0, left: 0 },
      },
    };
    const styles = generateLayoutStyles(node);
    expect(styles.display).toBe('flex');
    expect(styles.flexDirection).toBe('row');
    expect(styles.gap).toBe('8px');
  });

  it('generates flex-wrap for wrapping layouts', () => {
    const node = {
      layout: { mode: 'FLEX_ROW', wrap: true, gap: 16 },
    };
    const styles = generateLayoutStyles(node);
    expect(styles.flexWrap).toBe('wrap');
  });
});
```

#### Edge Case Handling

Common edge cases that cause plugin crashes or incorrect output:

| Edge Case | Symptom | Defense |
|-----------|---------|--------|
| Empty selection | `figma.currentPage.selection` is `[]` | Check length before processing |
| Text without fonts loaded | `fontName === figma.mixed` | Handle mixed fonts with range iteration |
| Zero-size frames | `width: 0, height: 0` | Filter out or skip in generation |
| SLICE nodes | Not renderable, no visual output | Skip during traversal (`node.type === 'SLICE'`) |
| Invisible nodes | `visible: false` | Filter during extraction |
| Detached instances | `instance.mainComponent` is `null` | Null-check before accessing component |
| Deeply nested groups | 50+ levels of nesting | Depth limit (MAX_DEPTH = 30) |
| Deleted nodes | `getNodeByIdAsync` returns `null` | Null-check after every async lookup |
| Stale selection | Node deleted after selection event | Re-validate before processing |
| Missing image fills | Image removed from library | Try/catch around image export |

```ts
// SLICE node handling in traversal
if (node.type === 'SLICE') {
  return null; // Skip entirely — SLICE nodes are export regions, not visual elements
}

// Zero-size frame handling
if (node.width === 0 || node.height === 0) {
  console.warn(`[Extraction] Skipping zero-size node: "${node.name}"`);
  return null;
}

// Detached instance handling
if (node.type === 'INSTANCE') {
  const mainComponent = instance.mainComponent;
  if (!mainComponent) {
    console.warn(`[Extraction] Detached instance: "${instance.name}"`);
    // Continue extraction without component reference
  }
}
```

#### Common Pitfalls Checklist

Before publishing, verify your plugin handles these scenarios:

1. **Accessing node after deletion** — Always use `getNodeByIdAsync` and null-check the result
2. **Font not loaded before text modification** — Call `loadFontAsync` before setting `characters`
3. **Stale selection data** — Re-fetch selection on each operation, do not cache selection state
4. **Sync API in dynamic-page plugin** — Use async variants (`getNodeByIdAsync`, not `getNodeById`)
5. **Binary data across IPC** — Convert `Uint8Array` to base64 string before `postMessage`
6. **Missing `figma.mixed` handling** — Properties like `fontName`, `cornerRadius`, `fills` can be `figma.mixed`
7. **Module-level cache leaks** — Clear caches between extraction runs or on page change
8. **Unbounded `findAll()` calls** — Never call `figma.root.findAll()` on large files; scope to current page or selected subtree
9. **Unhandled promise rejections** — Wrap every async handler in try/catch
10. **Plugin close during async operation** — Check `pluginActive` flag in long operations

---

### 7. Plugin Distribution

Preparing a plugin for publishing requires attention to manifest metadata, permissions, and version management.

#### Manifest Metadata

For `@create-figma-plugin` projects, metadata is configured in the `figma-plugin` section of `package.json`. For manual projects, it goes in `manifest.json`:

```json
{
  "figma-plugin": {
    "name": "My Plugin",
    "id": "YOUR_PLUGIN_ID",
    "editorType": ["figma"],
    "main": "src/main.ts",
    "ui": "src/ui.tsx",
    "documentAccess": "dynamic-page"
  }
}
```

Publishing checklist:
- **Name:** Clear, descriptive, max 50 characters
- **Description:** Explain what the plugin does in 1-2 sentences
- **Icon:** 128x128 PNG with rounded corners (Figma enforces this)
- **Cover image:** 1920x960 PNG showing the plugin in action
- **Tags:** Choose relevant tags for discoverability (up to 5)

#### Permission Minimization

Request only the permissions your plugin actually needs. Figma reviews permissions during publishing:

| Permission | Grants | When to Use |
|-----------|--------|-------------|
| `currentuser` | Read current user's name and ID | Personalized settings, analytics |
| `activeusers` | Read names/IDs of users currently viewing the file | Collaborative features |
| `fileusers` | Read all file collaborators | Collaboration tracking |
| `payments` | Access payment/licensing APIs | Paid plugins |
| `teamlibrary` | Access team library styles/components | Design system tools |

```json
{
  "permissions": ["currentuser"]
}
```

Most plugins need **zero** permissions. Only add permissions you actively use and can justify.

#### Network Access Justification

If your plugin makes network requests (through the UI iframe), declare the domains and provide reasoning:

```json
{
  "networkAccess": {
    "allowedDomains": [
      "https://fonts.googleapis.com",
      "https://fonts.gstatic.com"
    ],
    "reasoning": "Google Fonts: Used to preview generated HTML with the correct fonts."
  }
}
```

Figma reviewers check network access claims. Use the narrowest domain scope possible:

```json
// GOOD: Specific domains
{ "allowedDomains": ["https://api.example.com"] }

// ACCEPTABLE: Wildcard subdomain
{ "allowedDomains": ["https://*.example.com"] }

// BAD: Open access (requires strong justification)
{ "allowedDomains": ["*"] }

// BEST: No network access
{ "allowedDomains": ["none"] }
```

#### Version Management with @create-figma-plugin

Version your plugin through `package.json`. The build tool includes the version in the generated manifest:

```json
{
  "version": "1.2.0",
  "figma-plugin": {
    "name": "My Plugin v1.2.0"
  }
}
```

Use semantic versioning:
- **Major:** Breaking changes (UI redesign, data format changes)
- **Minor:** New features (new export format, new settings)
- **Patch:** Bug fixes (crash fix, rendering correction)

Build and publish workflow:

```bash
# Development
npm run watch                          # Rebuild on changes

# Production build
npm run build                          # build-figma-plugin --typecheck --minify

# Testing
npm test                               # vitest run

# Publishing
# 1. Update version in package.json
# 2. Build production bundle
# 3. In Figma desktop app: Plugins > Manage plugins > Publish
# 4. Upload build/main.js and build/ui.js
# 5. Add description, tags, cover image
# 6. Submit for review
```

> **Cross-reference:** See `plugin-architecture.md` for the complete `@create-figma-plugin` project setup and build configuration.

---

## Cross-References

- **`plugin-architecture.md`** — Production plugin architecture patterns: project setup with `@create-figma-plugin`, project structure, IPC event system, data flow pipeline (extraction → generation → export), UI architecture. This module builds on that foundation with quality and reliability patterns.
- **`plugin-codegen.md`** — Codegen plugin development patterns: Dev Mode integration, generate callback, preferences system, code quality. Shares many best practices from this module (error handling, caching, code validation) applied to the codegen context.
- **`figma-api-plugin.md`** — Plugin API reference: sandbox model, SceneNode types, manifest fields, key API methods, constraints. This module provides the production patterns for using those APIs correctly.
- **`figma-api-devmode.md`** — Dev Mode and codegen API reference. Codegen plugins face additional constraints (3-second timeout) that amplify the need for caching and performance optimization documented here.
- **`design-to-code-layout.md`** — Auto Layout to Flexbox mapping rules consumed by extraction and generation modules.
- **`design-to-code-visual.md`** — Visual property extraction patterns consumed by extraction modules.
- **`design-to-code-assets.md`** — Asset detection and export patterns. The deduplication and timeout patterns in this module apply directly to asset export.
- **`design-tokens-variables.md`** — Figma Variables to CSS custom property mapping. The variable caching pattern in this module optimizes the variable resolution described there.
