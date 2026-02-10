# Vector Container Detection & Asset Management

## Purpose

Authoritative reference for detecting which Figma nodes should be exported as image assets (SVG, PNG, JPG) versus rendered as CSS, and for managing the full asset pipeline: vector container detection, CSS-renderable shape identification, image fill handling, asset deduplication, and export format selection. Encodes production-proven heuristics that prevent attempting to render complex vector geometry as CSS divs while avoiding unnecessary asset exports for simple shapes that CSS handles natively.

## When to Use

Reference this module when you need to:

- Determine if a Figma frame/group should be exported as a single SVG (vector container detection)
- Decide whether a shape node (ELLIPSE, RECTANGLE, VECTOR, etc.) should be CSS or SVG
- Handle nodes with IMAGE fills (photos, textures, backgrounds)
- Map Figma `scaleMode` (FILL, FIT, CROP, TILE) to CSS `object-fit` / `background-size`
- Build an asset map for deduplication based on `imageHash`
- Select the correct export format (SVG, PNG@2x, JPG) for different asset types
- Understand the interaction between Auto Layout containers and vector container detection
- Handle edge cases like BOOLEAN_OPERATION nodes, mixed content containers, and icon detection
- Generate `<img>` tags with correct `src` and `alt` attributes from asset data

---

## Content

### 1. Vector Container Detection (Critical Heuristic)

The most important decision in asset management is determining which containers should be exported as a single SVG unit versus traversed as HTML/CSS. A **vector container** is a frame or group whose visible children are all vector-compatible types and that contains at least one "true" vector child (not just simple CSS shapes).

#### Why This Matters

Without vector container detection:
- An icon made of 5 VECTOR paths would produce 5 individual `<div>` elements (broken)
- A logo with BOOLEAN_OPERATION children would attempt CSS rendering of complex geometry (impossible)
- An illustration frame would generate dozens of meaningless positioned divs

With vector container detection:
- The entire icon frame is exported as a single SVG file
- The logo renders as one `<img src="logo.svg">` element
- The illustration becomes a clean image reference

#### Vector-Compatible Types

These node types can exist inside a vector container:

```typescript
const VECTOR_COMPATIBLE_TYPES = new Set([
  'VECTOR',            // Path-based vector shape
  'BOOLEAN_OPERATION',  // Union, Intersect, Subtract, Exclude of vectors
  'STAR',              // Star polygon
  'POLYGON',           // Regular polygon
  'LINE',              // Line segment
  'ELLIPSE',           // Circle or ellipse
  'RECTANGLE',         // Rectangle (may have rounded corners)
])
```

#### Container Types

These node types can hold vector children:

```typescript
const CONTAINER_TYPES = new Set([
  'GROUP',      // Figma group (no Auto Layout)
  'FRAME',      // Figma frame (may have Auto Layout)
  'COMPONENT',  // Component definition
  'INSTANCE',   // Component instance
])
```

#### Detection Algorithm

The detection is a multi-step process with several guard rails:

```
isVectorContainer(node):
  1. Must be a container type (GROUP, FRAME, COMPONENT, INSTANCE)
  2. Must have children
  3. Must have at least one visible child
  4. Must have at least one "true" vector child:
     - VECTOR, BOOLEAN_OPERATION, STAR, POLYGON, or LINE
     - (ELLIPSE and RECTANGLE alone do NOT qualify -- they're CSS-renderable)
  5. ALL visible children must be vector-compatible
  6. If ANY child is not vector-compatible → NOT a vector container
```

**Key insight:** A frame containing only RECTANGLE and ELLIPSE children is NOT a vector container. Those shapes are CSS-renderable. The container must have at least one type that requires SVG (VECTOR, BOOLEAN_OPERATION, STAR, POLYGON, LINE).

#### Implementation

```typescript
function isVectorContainer(node: SceneNode): boolean {
  // Must be a container type with children
  if (!CONTAINER_TYPES.has(node.type) || !('children' in node)) return false

  const visibleChildren = (node as ChildrenMixin & SceneNode)
    .children.filter(child => child.visible)

  // Must have at least one visible child
  if (visibleChildren.length === 0) return false

  // Must have at least one TRUE vector child (not just CSS shapes)
  const hasVectorChildren = visibleChildren.some(child =>
    child.type === 'VECTOR' ||
    child.type === 'BOOLEAN_OPERATION' ||
    child.type === 'STAR' ||
    child.type === 'POLYGON' ||
    child.type === 'LINE'
  )

  if (!hasVectorChildren) return false

  // ALL children must be vector-compatible
  return visibleChildren.every(child => isVectorCompatible(child))
}
```

#### Recursive Vector Compatibility

A container child (GROUP, FRAME) is vector-compatible if ALL of its own children are recursively vector-compatible:

```typescript
function isVectorCompatible(node: SceneNode): boolean {
  // Direct vector types are always compatible
  if (VECTOR_COMPATIBLE_TYPES.has(node.type)) return true

  // Container types: check all children recursively
  if (CONTAINER_TYPES.has(node.type) && 'children' in node) {
    const container = node as ChildrenMixin & SceneNode
    if (container.children.length === 0) return false  // Empty = not vector
    return container.children
      .filter(child => child.visible)
      .every(child => isVectorCompatible(child))
  }

  return false
}
```

---

### 2. CSS-Renderable Shapes vs SVG Export

Not every shape node needs to be exported as an image. Simple geometric shapes can be rendered more efficiently as CSS.

#### Decision Matrix

| Node Type | CSS-Renderable? | SVG Export? | CSS Technique |
|-----------|----------------|-------------|---------------|
| `RECTANGLE` | Yes | Only if complex fills | `<div>` with `border-radius`, `background-color` |
| `ELLIPSE` | Yes (if circle) | If non-circular | `border-radius: 50%` on equal width/height |
| `VECTOR` | No | Always | Complex path geometry |
| `BOOLEAN_OPERATION` | No | Always | Union/Intersect/Subtract/Exclude results |
| `STAR` | No | Always | Multi-point star polygon |
| `POLYGON` | No | Always | Regular polygon (triangle, hexagon, etc.) |
| `LINE` | Partial | Usually | `border-top` or `<hr>` for simple lines |

#### Decision Tree (Pseudocode)

```
decideRendering(node):
  IF node is TEXT:
    → Render as HTML text (NEVER export as image)
    → Exception: text with IMAGE fill = text with background image

  IF node is a vector container (Section 1):
    → Export entire container as single SVG

  IF node.type is VECTOR, BOOLEAN_OPERATION, STAR, POLYGON:
    → Export as SVG (single node)

  IF node.type is LINE:
    → IF simple horizontal/vertical line with solid stroke:
        → CSS border or `<hr>`
    → ELSE: Export as SVG

  IF node.type is ELLIPSE:
    → IF width === height (circle) AND solid fill only:
        → CSS `border-radius: 50%`
    → ELSE: Export as SVG (ellipse or complex fills)

  IF node.type is RECTANGLE:
    → IF solid/gradient fill only:
        → CSS `<div>` with background and border-radius
    → IF has IMAGE fill:
        → Render as `<img>` or `background-image`

  IF node is FRAME/GROUP with children:
    → Traverse children recursively (layout container, not asset)
```

#### Circle Detection

```typescript
if (node.type === 'ELLIPSE') {
  if (Math.abs(node.bounds.width - node.bounds.height) < 1) {
    styles.borderRadius = '50%'  // Circle
  }
  // Non-circular ellipses need SVG
}
```

---

### 3. SVG Export via Figma API

When a node is identified for SVG export, the actual export happens via the Figma REST API image export endpoint or the Plugin API's `exportAsync`.

#### REST API Export

```
GET /v1/files/:file_key/images?ids=NODE_ID&format=svg
```

**Parameters:**
- `ids` -- Comma-separated node IDs (URL-encoded, colons as `%3A`)
- `format` -- `svg`, `png`, `jpg`, or `pdf`
- `svg_include_id` -- Include Figma node IDs in SVG (default: false)
- `svg_include_node_id` -- Include `data-node-id` attributes (default: false)
- `svg_simplify_stroke` -- Simplify stroke geometry (default: true)

**Response:**

```json
{
  "err": null,
  "images": {
    "1:23": "https://figma-alpha-api.s3.us-west-2.amazonaws.com/images/..."
  }
}
```

The response contains temporary URLs to the generated SVG files. Download these immediately as URLs expire.

#### Plugin API Export

Within a Figma plugin, use `exportAsync`:

```typescript
const svgBuffer = await node.exportAsync({
  format: 'SVG',
  svgIdAttribute: false,
})
const svgString = String.fromCharCode(...new Uint8Array(svgBuffer))
```

#### SVG Cleanup

Exported SVGs from Figma often contain unnecessary metadata. Consider cleaning:

- Remove `xmlns:xlink` if no xlink references
- Remove empty `<defs>` blocks
- Remove Figma-specific metadata comments
- Optimize with SVGO (external tool) for production
- Preserve `viewBox` attribute (critical for correct scaling)
- Keep `fill` and `stroke` attributes that define the visual appearance

#### Inline SVG vs External File

| Approach | Use When | Advantages |
|----------|----------|------------|
| Inline `<svg>` | Icons, small graphics, need CSS styling | Styleable via CSS, no extra request, can change colors |
| External `<img src="icon.svg">` | Illustrations, logos, larger graphics | Cacheable, cleaner HTML, simpler code |
| CSS `background-image: url(icon.svg)` | Decorative, repeated patterns | No HTML impact, easy positioning |

**General rule:** Icons < 2KB inline, everything else external.

---

### 4. Image Fill Handling

Nodes with IMAGE fills contain raster image data referenced by an `imageHash`. These need to be exported and referenced correctly.

#### Detection

```typescript
if ('fills' in node) {
  const fills = node.fills
  if (fills !== figma.mixed && Array.isArray(fills)) {
    for (const fill of fills) {
      if (fill.type === 'IMAGE' && fill.imageHash) {
        asset.imageHash = fill.imageHash
        asset.exportAs = 'PNG'  // Default for image fills
        break  // Take first image fill
      }
    }
  }
}
```

#### scaleMode to CSS Mapping

Figma's `scaleMode` on IMAGE fills controls how the image is sized within its container. This maps directly to CSS properties.

| Figma `scaleMode` | CSS `object-fit` | CSS `background-size` | Behavior |
|-------------------|------------------|----------------------|----------|
| `FILL` | `cover` | `cover` | Image covers entire container, may crop |
| `FIT` | `contain` | `contain` | Image fits inside container, may letterbox |
| `CROP` | `cover` + `object-position` | `cover` + `background-position` | Cropped to specific region |
| `TILE` | N/A | `repeat` | Image tiles to fill the container |

#### CSS Generation for Image Fills

**As `<img>` element** (node without children):

```css
.hero-image {
  width: 400px;
  height: 300px;
}

.hero-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;  /* scaleMode: FILL */
}
```

**As `background-image`** (node with children -- image is behind child content):

```css
.hero-section {
  background-image: url('./assets/hero-bg.png');
  background-size: cover;     /* scaleMode: FILL */
  background-position: center;
  background-repeat: no-repeat;
}
```

#### CROP Mode with Position

When `scaleMode` is `CROP`, the image has specific crop bounds. Map these to `object-position`:

```css
.cropped-image img {
  object-fit: cover;
  object-position: 30% 20%;  /* Based on crop offset */
}
```

#### TILE Mode

```css
.tiled-background {
  background-image: url('./assets/pattern.png');
  background-size: auto;     /* Natural image size */
  background-repeat: repeat; /* scaleMode: TILE */
}
```

#### Retina Export

Always export image fills at **2x scale** for crisp display on high-DPI screens:

```
GET /v1/files/:key/images?ids=NODE_ID&format=png&scale=2
```

Or via Plugin API:

```typescript
const pngBuffer = await node.exportAsync({
  format: 'PNG',
  constraint: { type: 'SCALE', value: 2 },
})
```

#### Nodes WITH Children vs WITHOUT Children

The rendering strategy differs based on whether the node has visible children:

| Has Children? | Image Fill Rendering | HTML Output |
|---------------|---------------------|-------------|
| No | `<img>` element with `src` attribute | `<img src="./assets/photo.png" alt="Photo">` |
| Yes | CSS `background-image` on the container | `<div style="background-image: url(...)">...children...</div>` |

A frame with an image fill AND text children is a common pattern for hero sections: the image is the background, and the text sits on top.

---

### 5. Asset Map & Deduplication

When multiple nodes reference the same image (e.g., a profile photo used in several cards), the asset should be downloaded and stored only once.

#### Hash-Based Deduplication

Figma provides an `imageHash` for each IMAGE fill. This hash uniquely identifies the image content regardless of which node uses it.

```typescript
// Build asset map during extraction
const assetMap = new Map<string, { filename: string; url: string }>()

function registerAsset(nodeId: string, imageHash: string, nodeName: string): string {
  // Check if we already have this image
  if (assetMap.has(imageHash)) {
    return assetMap.get(imageHash)!.filename
  }

  // New image - create entry
  const filename = sanitizeFilename(nodeName)
  assetMap.set(imageHash, { filename, url: '' })  // URL filled later
  return filename
}
```

#### Filename Sanitization

Node names from Figma may contain characters invalid for filenames:

```typescript
function sanitizeFilename(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')           // Spaces to hyphens
    .replace(/[^a-z0-9-_]/g, '')    // Remove special characters
    .replace(/-+/g, '-')            // Collapse multiple hyphens
    .replace(/^-|-$/g, '')          // Trim leading/trailing hyphens
    || 'asset'                       // Fallback for empty names
}
```

**Examples:**
- `"Hero Image"` -> `hero-image`
- `"icon/arrow-right"` -> `iconarrow-right`
- `"Photo (2)"` -> `photo-2`
- `""` -> `asset`

#### Asset Map in HTML Generation

During HTML generation, the asset map provides `src` paths for `<img>` elements:

```typescript
if (tag === 'img' && node.asset && node.asset.exportAs && options.assetMap) {
  const filename = options.assetMap.get(node.id)
  if (filename) {
    attributes.src = `./assets/${filename}`
    attributes.alt = node.name || ''
  }
}
```

Generated HTML:

```html
<img class="card__photo" src="./assets/hero-image.png" alt="Hero Image">
<img class="card__icon" src="./assets/arrow-right.svg" alt="arrow-right">
```

---

### 6. Multi-Factor Detection Heuristics

Beyond the basic vector container check, several nuanced cases require additional heuristics.

#### Auto Layout Overrides Vector Detection

**Rule:** A frame with Auto Layout (`layoutMode !== 'NONE'`) is **ALWAYS** a layout container, never a vector container, regardless of its children.

**Rationale:** Auto Layout implies structural/layout intent. A designer who enables Auto Layout is building a layout, not an illustration.

```typescript
function hasAutoLayout(node: SceneNode): boolean {
  if (node.type === 'FRAME' || node.type === 'COMPONENT' || node.type === 'INSTANCE') {
    return (node as FrameNode).layoutMode !== 'NONE'
  }
  return false
}

// In getContainerExportStrategy:
if (hasAutoLayout(node)) {
  return 'none'  // Always layout, never asset
}
```

#### Text Children Limit

A container with more than one TEXT child is a layout container, not a vector illustration. A single TEXT child is allowed (e.g., an icon with a label that gets flattened into the SVG).

```typescript
const textChildren = visibleChildren.filter(child => child.type === 'TEXT')
if (textChildren.length > 1) {
  return 'none'  // Multiple text = layout container
}
```

When a single TEXT child is present, the text gets flattened before SVG export. The `hasTextToFlatten` flag is set on the AssetData:

```typescript
interface AssetData {
  // ...
  isVectorContainer?: boolean
  hasTextToFlatten?: boolean  // True if container has text to flatten pre-export
}
```

#### Container Export Strategy

The full detection algorithm combines all heuristics into a three-way decision:

```
getContainerExportStrategy(node) → 'svg' | 'png' | 'none'

  1. Not a container type? → 'none'
  2. Has Auto Layout? → 'none' (always layout)
  3. No visible children? → 'none'
  4. No true vector children? → 'none' (just CSS shapes)
  5. Multiple TEXT children? → 'none' (layout, not illustration)
  6. Any non-vector-compatible child? → 'none' (mixed content)
  7. Has IMAGE fills in children? → 'png' (rasterize vectors + images)
  8. All checks pass → 'svg' (pure vector content)
```

#### Simple Shapes: CSS, Not Assets

| Scenario | Rendering |
|----------|-----------|
| Single RECTANGLE with solid fill | CSS `<div>` with `background-color` and `border-radius` |
| Single ELLIPSE with equal width/height | CSS `<div>` with `border-radius: 50%` |
| Frame with only RECTANGLE + ELLIPSE children | CSS (no true vectors present) |
| RECTANGLE with IMAGE fill | `<img>` element (the image is the content) |

#### Complex Shapes: Always SVG

| Scenario | Rendering |
|----------|-----------|
| Group of VECTOR paths forming an icon | Single SVG asset |
| BOOLEAN_OPERATION (any sub-type) | SVG (complex geometry) |
| STAR node | SVG (multi-point polygon) |
| Frame with VECTOR + ELLIPSE children | SVG (has true vector content) |
| INSTANCE of a vector component | SVG (export the instance) |

#### Icon Detection Heuristic

Small vector containers (typically <= 48x48 pixels) are likely icons:

```typescript
function isLikelyIcon(node: SceneNode): boolean {
  if (node.width <= 48 && node.height <= 48) {
    if (node.type === 'VECTOR' || node.type === 'BOOLEAN_OPERATION') {
      return true
    }
    if ('children' in node) {
      return (node as ChildrenMixin & SceneNode).children.every(child =>
        child.type === 'VECTOR' ||
        child.type === 'BOOLEAN_OPERATION' ||
        child.type === 'ELLIPSE' ||
        child.type === 'RECTANGLE' ||
        child.type === 'LINE'
      )
    }
  }
  return false
}
```

Icons are always exported as SVG for crisp scaling at any size.

---

### 7. Export Format Selection

Different asset types require different formats for optimal quality and file size.

#### Format Decision Matrix

| Content Type | Format | Scale | Rationale |
|-------------|--------|-------|-----------|
| Vector icons | SVG | N/A (scalable) | Infinitely scalable, small file size, CSS-styleable |
| Vector illustrations | SVG | N/A | Scalable, preserves sharp edges |
| Photos | PNG@2x | 2x | Lossless, crisp on retina displays |
| Large photos | JPG@2x | 2x | Lossy but much smaller file size |
| Complex gradients | PNG@2x | 2x | Preserves gradient fidelity |
| Icons with image fills | PNG@2x | 2x | Can't be SVG if contains raster data |
| Print assets | PDF | N/A | Rare in web context |

#### Format Selection Logic

```typescript
function selectExportFormat(node: SceneNode, asset: AssetData): 'SVG' | 'PNG' | 'JPG' {
  // Vectors always export as SVG
  if (asset.isVector && !asset.imageHash) {
    return 'SVG'
  }

  // Vector containers with no image content → SVG
  if (asset.isVectorContainer && !hasImageContent(node)) {
    return 'SVG'
  }

  // Image fills default to PNG
  if (asset.imageHash) {
    return 'PNG'
  }

  // Fallback
  return 'PNG'
}
```

#### Figma Export Settings Override

When a designer has explicitly set export settings on a node in Figma, those settings take priority (for nodes without children):

```typescript
if ('exportSettings' in node && node.exportSettings.length > 0) {
  if (!hasChildren) {
    const format = node.exportSettings[0].format  // 'SVG', 'PNG', 'JPG'
    asset.exportAs = format
  }
}
```

**Exception:** Nodes WITH children ignore export settings for format selection. Their image fills become CSS `background-image` instead of `<img>` exports.

#### SVG for Vectors

**Always use SVG for:**
- Icons (typically < 48x48)
- Logos and wordmarks
- Geometric illustrations
- UI decorations (arrows, chevrons, checkmarks)
- Any VECTOR, BOOLEAN_OPERATION, STAR, POLYGON, LINE node

**SVG advantages:**
- Infinitely scalable without quality loss
- Typically tiny file size (< 5KB for icons)
- Can be styled with CSS (fill, stroke colors)
- Can be inlined for zero-request rendering
- Accessible (can include `<title>` and `<desc>`)

#### PNG for Raster Content

**Use PNG@2x for:**
- Photos and photographic imagery
- Complex imagery with transparency
- Screenshots or UI captures
- Anything with IMAGE fills

**2x scale rationale:** Modern displays (Retina, 4K) render at 2x or higher device pixel ratios. Exporting at 2x ensures crisp display:

```css
/* Image is 800x600 actual pixels, displayed at 400x300 CSS pixels */
.photo {
  width: 400px;
  height: 300px;
}
.photo img {
  width: 100%;
  height: 100%;
}
```

#### JPG for Photos (Size Optimization)

When file size matters more than pixel-perfect quality (e.g., large hero images, photo galleries), JPG offers significant compression:

```
GET /v1/files/:key/images?ids=NODE_ID&format=jpg&scale=2
```

JPG should only be used when:
- The image is photographic (no sharp edges or text)
- No transparency is needed
- File size reduction is a priority

---

### 8. Common Pitfalls

#### Pitfall: Exporting Every Node as an Image

**Problem:** Treating all visual nodes as assets, generating hundreds of unnecessary image files for simple rectangles, circles, and solid-fill elements.

**Rule:** Only export nodes that **cannot** be rendered as CSS. The vast majority of UI elements (rectangles, circles, containers with fills, gradients) are CSS-renderable. Only export:
- VECTOR, BOOLEAN_OPERATION, STAR, POLYGON (complex geometry)
- Nodes with IMAGE fills (raster content)
- Vector containers (groups/frames of vectors)

#### Pitfall: BOOLEAN_OPERATION Is Always SVG

**Problem:** Attempting to render a BOOLEAN_OPERATION as CSS. These nodes represent the union, intersection, subtraction, or exclusion of two or more shapes -- the resulting geometry cannot be expressed in CSS.

**Rule:** BOOLEAN_OPERATION nodes have a `booleanOperation` property indicating the operation type (UNION, INTERSECT, SUBTRACT, EXCLUDE). Regardless of the operation, always export as SVG.

```typescript
if (node.type === 'BOOLEAN_OPERATION') {
  asset.isVector = true
  asset.exportAs = 'SVG'
}
```

#### Pitfall: Image Fills on Text Nodes

**Problem:** Treating a text node with an IMAGE fill as an image asset, losing the text content.

**Rule:** An IMAGE fill on a TEXT node means the text has a **background image** or **clipping mask**, not that the text should be replaced with an image. The text must remain as HTML text for accessibility and SEO. The image fill can be rendered as a CSS `background-image` with `background-clip: text` for a clipped text effect, or ignored if it's decorative.

#### Pitfall: Vector Nodes Have Fills and Strokes

**Problem:** Trying to extract CSS `background-color` or `border` from VECTOR node fills/strokes.

**Rule:** VECTOR node fills and strokes define the SVG path's appearance. These become SVG `fill` and `stroke` attributes in the exported SVG, not CSS properties. Do not apply CSS visual property extraction to nodes marked for SVG export.

```typescript
// In HTML generation:
const isExportedAsset = (node.asset && node.asset.exportAs && tag === 'img') ||
  node.asset?.isVectorContainer

if (!isExportedAsset) {
  // Only apply visual styles (background, border, etc.) to non-asset nodes
  Object.assign(styles, generateVisualStyles(...))
}
```

#### Pitfall: Missing Retina Export

**Problem:** Exporting images at 1x scale, producing blurry results on Retina/HiDPI displays.

**Rule:** Always export raster images at **2x minimum**. This applies to both the REST API (`scale=2`) and Plugin API (`constraint: { type: 'SCALE', value: 2 }`). The CSS should display the image at half the exported pixel dimensions.

#### Pitfall: Large SVG File Size

**Problem:** A vector container with many children produces an SVG with thousands of path elements, resulting in a large file that's slower to render than a raster image.

**Rule:** Consider PNG fallback for vector containers with excessive complexity. Signs that SVG may be too large:
- Container has > 50 visible children
- The SVG output exceeds 50KB
- The content is an illustration with many overlapping gradients

In these cases, PNG@2x may be a better choice for web performance.

#### Pitfall: Empty Containers as Vector Containers

**Problem:** An empty GROUP or FRAME with no children passes the "all children are vector-compatible" check vacuously (all zero of them are compatible).

**Rule:** The detection explicitly checks for at least one visible child:

```typescript
if (visibleChildren.length === 0) return false
```

#### Pitfall: Confusing Export Settings with Image Fills

**Problem:** A node has export settings (configured in Figma's export panel) AND image fills. The export settings might say "SVG" but the node has a raster image fill.

**Rule:** Export settings on nodes WITHOUT children drive the export format. Export settings on nodes WITH children are informational only -- the image fill renders as `background-image` regardless. When a node has both export settings and an image fill:

```typescript
if (asset.imageHash) {
  // Image fill always exports as PNG, overriding SVG export settings
  if (!asset.exportAs) {
    asset.exportAs = 'PNG'
  }
}
```

#### Edge Case: INSTANCE of a Vector Component

When an INSTANCE node references a component that is a vector container, the instance itself should be exported as SVG. The detection checks the instance's own children (which mirror the component's structure), not the component definition.

#### Edge Case: Visible vs Hidden Children

Only **visible** children are considered in vector container detection. Hidden children (nodes with `visible: false`) are filtered out:

```typescript
const visibleChildren = containerNode.children.filter(child => child.visible)
```

This prevents a hidden TEXT layer inside an icon frame from disqualifying the frame as a vector container.

---

### Intermediate Type Reference

The complete intermediate type used for asset data between extraction and generation:

```typescript
interface AssetData {
  /** Export format: 'SVG', 'PNG', or 'JPG' */
  exportAs?: 'SVG' | 'PNG' | 'JPG'
  /** Image hash for IMAGE fill deduplication */
  imageHash?: string
  /** True if this is a vector type (VECTOR, STAR, POLYGON, BOOLEAN_OPERATION, ELLIPSE, LINE) */
  isVector?: boolean
  /** True if the node has export settings configured in Figma */
  hasExportSettings?: boolean
  /** True if this is a container to export as a single unit (SVG/PNG) */
  isVectorContainer?: boolean
  /** True if container has text that needs flattening before SVG export */
  hasTextToFlatten?: boolean
}
```

**Note on `isVector` for ELLIPSE and LINE:** These types are marked as `isVector: true` but do NOT trigger the `exportAs` flag by themselves. They are "potential assets" -- the layout engine decides whether to CSS-render them or include them in a parent vector container's SVG export.

```typescript
// ELLIPSE and LINE: marked as vector but not auto-exported
if (node.type === 'ELLIPSE' || node.type === 'LINE') {
  asset.isVector = true
  // No asset.exportAs set -- decision deferred to layout phase
}

// True vectors: marked AND set for SVG export
if (node.type === 'VECTOR' || node.type === 'STAR' ||
    node.type === 'POLYGON' || node.type === 'BOOLEAN_OPERATION') {
  asset.isVector = true
  asset.exportAs = 'SVG'  // Definite SVG export
}
```

---

### Asset Rendering in HTML

Vector containers render as self-closing `<img>` tags with no children, because their visual children are baked into the exported SVG/PNG:

```typescript
// In the traversal phase:
// Vector containers have children=[] set so they don't generate child elements
if (node.asset?.isVectorContainer) {
  node.children = []  // Children are in the SVG, not in HTML
}

// In HTML generation:
if (node.children && node.children.length > 0 && !node.asset?.isVectorContainer) {
  // Only generate child elements for non-vector-container nodes
}
```

**Generated HTML:**

```html
<!-- Vector container (icon) -->
<img class="nav__icon" src="./assets/menu-icon.svg" alt="menu-icon">

<!-- Image fill (photo) -->
<img class="card__photo" src="./assets/team-photo.png" alt="Team Photo">

<!-- Frame with image fill AND children (hero section) -->
<div class="hero" style="background-image: url('./assets/hero-bg.png'); background-size: cover;">
  <h1 class="hero__heading">Welcome</h1>
  <p class="hero__text">Get started today</p>
</div>
```

---

## Cross-References

- **`figma-api-rest.md`** -- Image export endpoint (`GET /v1/files/:key/images`), format options (svg, png, jpg, pdf), scale parameter, SVG options (`svg_include_id`, `svg_simplify_stroke`), temporary URL handling
- **`figma-api-plugin.md`** -- SceneNode types (VECTOR, BOOLEAN_OPERATION, STAR, POLYGON, LINE, ELLIPSE, RECTANGLE), `exportAsync` method, `fills` property, `imageHash`, `scaleMode`, `visible` property, `children` access
- **`design-to-code-layout.md`** -- Auto Layout detection (`layoutMode !== 'NONE'`) that overrides vector container detection, parent layout context for absolute positioning of asset `<img>` elements
- **`design-to-code-visual.md`** -- Fill extraction patterns shared with asset detection (SOLID, GRADIENT, IMAGE fill types), visual styles that are skipped for exported assets
- **`design-to-code-typography.md`** -- Text nodes that should never be exported as images, IMAGE fills on text nodes as background/clip effect, text flattening in vector containers
- **`design-to-code-semantic.md`** -- `<img>` tag selection for asset nodes (vector containers and image fills), `alt` attribute generation from node names, decorative shapes rendered as `<div>` not `<img>`, semantic context around asset elements
- **`css-strategy.md`** -- Asset file references in generated CSS (`background-image: url(...)`) and HTML (`<img src="...">`) within the layered CSS architecture. Asset references appear in Layer 3 (CSS Modules).
