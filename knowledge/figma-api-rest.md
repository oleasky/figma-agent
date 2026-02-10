# Figma REST API Reference

## Purpose

Authoritative reference for the Figma REST API covering authentication, core endpoints, node tree structure, image export, component/style retrieval, pagination, rate limits, and common pitfalls. This is the foundational API module that all other Figma knowledge modules depend on.

## When to Use

Reference this module when you need to:

- Authenticate against the Figma API (PATs or OAuth2)
- Fetch file data, specific nodes, or metadata
- Export images or SVGs from Figma nodes
- Retrieve published library components or styles
- Parse Figma URLs to extract file keys and node IDs
- Understand rate limits and plan access controls
- Navigate the Figma node tree structure

---

## Content

### Base URL

```
https://api.figma.com
```

Government cloud: `https://api.figma-gov.com`

All endpoints are versioned under `/v1/` (except Webhooks v2 which uses `/v2/`).

---

### Authentication

Figma supports two authentication methods:

#### Personal Access Tokens (PATs)

Pass the token via the `X-Figma-Token` header:

```ts
const headers = {
  'X-Figma-Token': process.env.FIGMA_TOKEN,
};
```

```bash
curl -H "X-Figma-Token: YOUR_FIGMA_TOKEN" \
  "https://api.figma.com/v1/files/FILE_KEY"
```

**Creating a PAT:**

1. Log in to Figma, open account menu (top-left) and select **Settings**
2. Select the **Security** tab
3. Under **Personal access tokens**, click **Generate new token**
4. Configure expiration and scopes, then click **Generate token**
5. Copy the token immediately (it is only shown once)

**Important:** As of 2025, PATs have a maximum expiry of 90 days. Non-expiring PATs can no longer be created.

#### OAuth 2.0

For apps acting on behalf of users:

**Authorization URL:**

```
GET https://www.figma.com/oauth
  ?client_id=:client_id
  &redirect_uri=:callback
  &scope=:scope
  &state=:state
  &response_type=code
```

**Token exchange** (must happen within 30 seconds of authorization):

```
POST https://api.figma.com/v1/oauth/token
```

Uses HTTP Basic Auth with Base64-encoded `client_id:client_secret`. Returns: `access_token`, `refresh_token`, `expires_in` (90 days default), `user_id`.

**Token refresh:**

```
POST https://api.figma.com/v1/oauth/refresh
```

**Usage:** Include `Authorization: Bearer <TOKEN>` header.

#### Token Scopes

Scopes control which endpoints a token can access. Scopes do not override organizational permissions — users can only access files they created or were granted access to.

| Scope | Description | Notes |
|-------|-------------|-------|
| `file_content:read` | Read file contents (nodes, editor type) | Required for most file operations |
| `file_metadata:read` | Read file metadata only | |
| `file_comments:read` | Read file comments | |
| `file_comments:write` | Post/delete comments and reactions | |
| `file_dev_resources:read` | Read dev resources | |
| `file_dev_resources:write` | Write dev resources | |
| `file_variables:read` | Read variables | Enterprise only |
| `file_variables:write` | Write variables and collections | Enterprise only |
| `file_versions:read` | Read version history | |
| `library_content:read` | Read published components/styles of files | |
| `library_assets:read` | Read individual published component/style data | |
| `team_library_content:read` | Read published components/styles of teams | |
| `library_analytics:read` | Read design system analytics | Enterprise only |
| `projects:read` | List projects and files in projects | |
| `current_user:read` | Read user name, email, profile image | |
| `selections:read` | Read most recent selection in files | |
| `webhooks:read` | Read webhook metadata | |
| `webhooks:write` | Create and manage webhooks | |

> **Deprecated:** `files:read` grants broad access but is deprecated. Use specific scopes instead.

---

### Core Endpoints

#### GET /v1/files/:file_key

Returns the entire document tree as JSON.

**Scope required:** `file_content:read`
**Rate limit tier:** Tier 1

```bash
curl -H "X-Figma-Token: YOUR_FIGMA_TOKEN" \
  "https://api.figma.com/v1/files/FILE_KEY"
```

**Query parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `version` | string | Specific version ID (omit for current) |
| `ids` | string | Comma-separated node IDs to filter returned tree |
| `depth` | number | Traversal depth (e.g., `2` = pages + top-level objects) |
| `geometry` | string | Set to `paths` to include vector path data |
| `plugin_data` | string | Set to `shared` to include shared plugin data |
| `branch_data` | boolean | Include branch metadata |

**Response shape:**

```ts
interface GetFileResponse {
  name: string;
  role: string;
  lastModified: string;        // ISO 8601 timestamp
  editorType: string;          // "figma" | "figjam"
  thumbnailUrl: string;
  version: string;
  document: DocumentNode;      // Root DOCUMENT node with children
  components: Record<string, ComponentMetadata>;
  componentSets: Record<string, ComponentSetMetadata>;
  schemaVersion: number;
  styles: Record<string, StyleMetadata>;
  mainFileKey?: string;        // Present on branches
  branches?: BranchMetadata[];
}
```

> **Warning:** Full file fetches can return enormous payloads (tens of MB for complex files). Always use `/nodes` for targeted access when possible.

#### GET /v1/files/:file_key/nodes

Fetches specific nodes by ID. This is the preferred endpoint for targeted data retrieval.

**Scope required:** `file_content:read`
**Rate limit tier:** Tier 1

```bash
curl -H "X-Figma-Token: YOUR_FIGMA_TOKEN" \
  "https://api.figma.com/v1/files/FILE_KEY/nodes?ids=1:2,3:4"
```

**Query parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `ids` | string | **Required.** Comma-separated node IDs (e.g., `1:2,3:4`) |
| `version` | string | Specific version ID |
| `depth` | number | Traversal depth below each requested node |
| `geometry` | string | Set to `paths` for vector data |
| `plugin_data` | string | Set to `shared` for shared plugin data |

**Response shape:**

```ts
interface GetFileNodesResponse {
  name: string;
  lastModified: string;
  version: string;
  nodes: Record<string, {
    document: Node;
    components: Record<string, ComponentMetadata>;
    schemaVersion: number;
    styles: Record<string, StyleMetadata>;
  } | null>;  // null if node ID is invalid or unrenderable
}
```

> **Note:** The `nodes` map may contain `null` values for non-existent or unrenderable node IDs.

#### GET /v1/files/:file_key/meta

Returns file metadata only (no document tree). Lightweight alternative when you only need file info.

**Scope required:** `file_metadata:read`
**Rate limit tier:** Tier 3

---

### Image Export

#### GET /v1/images/:file_key

Renders specific nodes as images and returns temporary URLs.

**Scope required:** `file_content:read`
**Rate limit tier:** Tier 1

```bash
# Export as SVG
curl -H "X-Figma-Token: YOUR_FIGMA_TOKEN" \
  "https://api.figma.com/v1/images/FILE_KEY?ids=1:2,3:4&format=svg"

# Export as PNG at 2x scale
curl -H "X-Figma-Token: YOUR_FIGMA_TOKEN" \
  "https://api.figma.com/v1/images/FILE_KEY?ids=1:2&format=png&scale=2"
```

**Query parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `ids` | string | — | **Required.** Comma-separated node IDs |
| `format` | string | `png` | `jpg`, `png`, `svg`, or `pdf` |
| `scale` | number | `1` | Scale factor (0.01 to 4) |
| `svg_include_id` | boolean | `false` | Include node IDs in SVG output |
| `svg_include_node_id` | boolean | `false` | Include `data-node-id` attribute in SVG elements |
| `svg_simplify_stroke` | boolean | `true` | Simplify inside/outside strokes to center strokes |
| `use_absolute_bounds` | boolean | `false` | Use node's full dimensions (not cropped) |
| `contents_only` | boolean | `true` | Exclude containing frame from render |

**Response shape:**

```ts
interface GetImageResponse {
  err: string | null;
  images: Record<string, string | null>;  // node ID → signed URL (or null on error)
}
```

> **Important:** Image URLs expire after **30 days**. Cache the rendered images, not the URLs.

#### GET /v1/files/:file_key/images

Returns download URLs for all images present in image fills throughout the document. This is different from the rendering endpoint above — it returns the original uploaded images, not rendered node exports.

**Scope required:** `file_content:read`
**Rate limit tier:** Tier 1

**Response shape:**

```ts
interface GetFileImagesResponse {
  err: boolean;
  images: Record<string, string>;  // image ref → download URL
}
```

> **Important:** These image fill URLs expire within **14 days**.

---

### Components and Styles (Published Library Only)

These endpoints return **published library assets only**. They do NOT return all local components or styles in a file. This is a critical distinction.

#### GET /v1/files/:file_key/components

Returns published components from the file's library.

**Scope required:** `library_content:read`
**Rate limit tier:** Tier 3

#### GET /v1/files/:file_key/component_sets

Returns published component sets from the file's library.

**Scope required:** `library_content:read`
**Rate limit tier:** Tier 3

#### GET /v1/files/:file_key/styles

Returns published styles from the file's library.

**Scope required:** `library_content:read`
**Rate limit tier:** Tier 3

**Response metadata for each asset:**

```ts
interface PublishedAssetMetadata {
  key: string;
  file_key: string;
  node_id: string;
  thumbnail_url: string;
  name: string;
  description: string;
  updated_at: string;
  created_at: string;
  user: UserInfo;
}
```

#### Team-Level Endpoints

Paginated endpoints for browsing an entire team's published library:

```
GET /v1/teams/:team_id/components
GET /v1/teams/:team_id/component_sets
GET /v1/teams/:team_id/styles
```

**Scope required:** `team_library_content:read`
**Rate limit tier:** Tier 3

#### Individual Asset Lookup

```
GET /v1/components/:key
GET /v1/component_sets/:key
GET /v1/styles/:key
```

**Scope required:** `library_assets:read`
**Rate limit tier:** Tier 3

#### Finding ALL Components in a File (Including Unpublished)

Since the library endpoints only return published assets, to find all components in a file you must traverse the document tree:

```ts
async function findAllComponents(fileKey: string): Promise<Node[]> {
  const response = await fetch(
    `https://api.figma.com/v1/files/${fileKey}`,
    { headers: { 'X-Figma-Token': process.env.FIGMA_TOKEN! } }
  );
  const file = await response.json();

  const components: Node[] = [];
  function walk(node: any) {
    if (node.type === 'COMPONENT' || node.type === 'COMPONENT_SET') {
      components.push(node);
    }
    if (node.children) {
      node.children.forEach(walk);
    }
  }
  walk(file.document);
  return components;
}
```

> **Note:** It is not possible to publish from branches, so branch file keys cannot be used with library endpoints.

---

### Node Tree Structure

Every Figma file is a tree of nodes. The root is always a `DOCUMENT` node, whose children are `CANVAS` nodes (pages).

#### Node Type Hierarchy

```
DOCUMENT
  └── CANVAS (page)
        ├── FRAME
        │     ├── FRAME (nested)
        │     ├── GROUP
        │     ├── COMPONENT
        │     ├── COMPONENT_SET
        │     ├── INSTANCE
        │     ├── TEXT
        │     ├── RECTANGLE
        │     ├── ELLIPSE
        │     ├── VECTOR
        │     ├── LINE
        │     ├── STAR
        │     ├── POLYGON
        │     ├── BOOLEAN_OPERATION
        │     ├── SLICE
        │     └── SECTION
        └── ...
```

#### Key Node Types for Design-to-Code

| Type | Description | Has Children |
|------|-------------|:---:|
| `DOCUMENT` | Root node | Yes |
| `CANVAS` | Page | Yes |
| `FRAME` | Container with optional Auto Layout | Yes |
| `GROUP` | Visual grouping (no layout) | Yes |
| `SECTION` | Organization section on canvas | Yes |
| `COMPONENT` | Reusable component definition | Yes |
| `COMPONENT_SET` | Variant container | Yes |
| `INSTANCE` | Instance of a component | Yes |
| `TEXT` | Text layer | No |
| `RECTANGLE` | Rectangle shape | No |
| `ELLIPSE` | Ellipse/circle shape | No |
| `VECTOR` | Arbitrary vector path | No |
| `LINE` | Line | No |
| `STAR` | Star shape | No |
| `POLYGON` | Polygon shape | No |
| `BOOLEAN_OPERATION` | Union/subtract/intersect/exclude | Yes |
| `SLICE` | Export region (not rendered) | No |

#### Global Properties (All Nodes)

```ts
interface BaseNode {
  id: string;                    // Unique within document (e.g., "1:2")
  name: string;                  // User-assigned name
  visible: boolean;              // Default: true
  type: string;                  // Node type enum
  rotation: number;              // Rotation in degrees
  pluginData: any;               // Plugin-specific data (private)
  sharedPluginData: any;         // Plugin-specific data (shared)
  componentPropertyReferences: Record<string, string>;
  boundVariables: Record<string, VariableAlias | VariableAlias[]>;
  explicitVariableModes: Record<string, string>;
}
```

#### Layout-Related Properties (Frames, Components, Instances)

```ts
interface LayoutNode {
  // Bounding boxes
  absoluteBoundingBox: Rectangle;    // Position + size on canvas
  absoluteRenderBounds: Rectangle;   // Accounts for strokes, shadows, blur
  size: Vector;                      // Width and height

  // Auto Layout
  layoutMode: 'NONE' | 'HORIZONTAL' | 'VERTICAL';
  layoutWrap: 'NO_WRAP' | 'WRAP';
  primaryAxisSizingMode: 'FIXED' | 'AUTO';
  counterAxisSizingMode: 'FIXED' | 'AUTO';
  primaryAxisAlignItems: 'MIN' | 'CENTER' | 'MAX' | 'SPACE_BETWEEN';
  counterAxisAlignItems: 'MIN' | 'CENTER' | 'MAX' | 'BASELINE';
  counterAxisAlignContent: 'AUTO' | 'SPACE_BETWEEN';
  itemSpacing: number;               // Gap between children
  paddingLeft: number;
  paddingRight: number;
  paddingTop: number;
  paddingBottom: number;

  // Child sizing
  layoutSizingHorizontal: 'FIXED' | 'HUG' | 'FILL';
  layoutSizingVertical: 'FIXED' | 'HUG' | 'FILL';
  layoutGrow: number;                // 0 = fixed, 1 = fill (flex-grow)
  layoutAlign: 'INHERIT' | 'STRETCH' | 'MIN' | 'CENTER' | 'MAX';

  // Constraints (non-Auto-Layout frames)
  constraints: {
    vertical: 'TOP' | 'BOTTOM' | 'CENTER' | 'TOP_BOTTOM' | 'SCALE';
    horizontal: 'LEFT' | 'RIGHT' | 'CENTER' | 'LEFT_RIGHT' | 'SCALE';
  };

  // Visual
  fills: Paint[];
  strokes: Paint[];
  strokeWeight: number;
  strokeAlign: 'INSIDE' | 'OUTSIDE' | 'CENTER';
  cornerRadius: number;
  rectangleCornerRadii: [number, number, number, number]; // TL, TR, BR, BL
  effects: Effect[];
  opacity: number;
  blendMode: string;
  clipsContent: boolean;
}
```

#### Key Distinction: absoluteBoundingBox vs absoluteRenderBounds

- **`absoluteBoundingBox`** — The geometric bounding box of the node (position + dimensions). Does NOT account for strokes, shadows, or blur that extend beyond the shape.
- **`absoluteRenderBounds`** — The visual bounding box including all rendered effects (outside strokes, drop shadows, blur radius). Use this when determining actual visual footprint.

For design-to-code, use `absoluteBoundingBox` for sizing/positioning and `absoluteRenderBounds` when you need to ensure no visual clipping.

---

### Pagination

Library and team endpoints that return lists use **cursor-based pagination**.

**Response includes:**

```ts
interface PaginatedResponse {
  meta: {
    cursor: {
      before: number;
      after: number;
    };
  };
  // ... data
}
```

**Query parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `page_size` | number | Number of items per page (default varies by endpoint) |
| `cursor` | string | Cursor value from previous response for next page |

Use `cursor.after` from the response as the `cursor` parameter for the next request.

---

### Rate Limits

Figma uses a **leaky bucket algorithm** for rate limiting. Limits are per-minute and vary by endpoint tier, Figma plan, and seat type.

#### Rate Limit Tiers (requests per minute)

| Tier | View/Collab Seats | Dev/Full (Starter) | Dev/Full (Pro) | Dev/Full (Org) | Dev/Full (Enterprise) |
|------|:-----------------:|:------------------:|:--------------:|:--------------:|:---------------------:|
| Tier 1 | Up to 6/month | 10/min | 15/min | 20/min | 20/min |
| Tier 2 | Up to 5/min | 25/min | 50/min | 100/min | 100/min |
| Tier 3 | Up to 10/min | 50/min | 100/min | 150/min | 150/min |

**Tracking:**

- **PATs:** Rate limits tracked per-user, per-plan
- **OAuth apps:** Rate limits tracked per-user, per-plan, per-app (each app gets separate budget)

#### Endpoint Tier Assignments

| Endpoint | Tier |
|----------|------|
| `GET /v1/files/:key` | 1 |
| `GET /v1/files/:key/nodes` | 1 |
| `GET /v1/images/:key` | 1 |
| `GET /v1/files/:key/images` | 1 |
| `GET /v1/files/:key/variables/local` | 2 |
| `GET /v1/files/:key/variables/published` | 2 |
| `POST /v1/files/:key/variables` | 3 |
| `GET /v1/files/:key/meta` | 3 |
| `GET /v1/files/:key/components` | 3 |
| `GET /v1/files/:key/component_sets` | 3 |
| `GET /v1/files/:key/styles` | 3 |

#### Handling 429 Errors

When rate-limited, the API returns `429 Too Many Requests` with these headers:

| Header | Description |
|--------|-------------|
| `Retry-After` | Seconds to wait before retrying |
| `X-Figma-Plan-Tier` | Resource's plan tier (`enterprise`, `org`, `pro`, `starter`) |
| `X-Figma-Rate-Limit-Type` | Seat classification (`low` for Collab/Viewer, `high` for Full/Dev) |

**Recommended backoff strategy:**

```ts
async function fetchWithRetry(
  url: string,
  headers: Record<string, string>,
  maxRetries = 3
): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, { headers });

    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get('Retry-After') || '60', 10);
      console.warn(`Rate limited. Retrying after ${retryAfter}s (attempt ${attempt + 1})`);
      await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
      continue;
    }

    return response;
  }
  throw new Error(`Failed after ${maxRetries} retries`);
}
```

**Mitigation strategies:**

1. **Use `/nodes` instead of `/files`** — Fetch only the nodes you need
2. **Cache aggressively** — Store file data and refresh selectively using version checks
3. **Batch node IDs** — Combine multiple node IDs in a single `/nodes` or `/images` request
4. **Respect `Retry-After`** — Always use the header value, not a fixed delay

---

### Parsing Figma URLs

Extract file key and node ID from Figma URLs:

```ts
/**
 * Parse a Figma URL to extract file key and optional node ID.
 *
 * Supported URL formats:
 *   https://www.figma.com/file/FILE_KEY/Title
 *   https://www.figma.com/design/FILE_KEY/Title
 *   https://www.figma.com/file/FILE_KEY/Title?node-id=1-2
 *   https://www.figma.com/design/FILE_KEY/Title?node-id=1-2
 */
function parseFigmaUrl(url: string): { fileKey: string; nodeId?: string } | null {
  const match = url.match(/figma\.com\/(?:file|design)\/([a-zA-Z0-9]+)/);
  if (!match) return null;

  const fileKey = match[1];
  const nodeId = new URL(url).searchParams.get('node-id');

  return {
    fileKey,
    // Figma URLs use hyphen (1-2) but API expects colon (1:2)
    nodeId: nodeId?.replace(/-/g, ':') || undefined,
  };
}
```

#### Node ID Encoding

- **Internal format:** `1:2` (colon-separated)
- **URL format:** `1-2` (hyphen in `node-id` query param) or `1%3A2` (URL-encoded colon in API params)
- **API `ids` parameter:** Use colon format: `?ids=1:2,3:4` (colons are valid in query string values)

---

### Common Pitfalls

1. **`/components` and `/styles` return published library content only.** To find all components in a file (including unpublished), traverse the document tree from `GET /v1/files/:key`.

2. **Full file fetches are expensive.** A complex design file can return 10-50+ MB of JSON. Always prefer `GET /v1/files/:key/nodes?ids=...` for targeted access. Use `depth` parameter to limit tree traversal.

3. **Node IDs use colon format but URLs use hyphens.** The API expects `1:2` in the `ids` parameter, but Figma UI URLs show `node-id=1-2`. Always convert hyphens to colons when passing node IDs to the API.

4. **`absoluteBoundingBox` vs `absoluteRenderBounds`.** Use `absoluteBoundingBox` for layout positioning. Use `absoluteRenderBounds` when you need the full visual extent including strokes and shadows that extend beyond the shape.

5. **Image URLs are temporary.** Rendered image URLs from `/images` expire after 30 days. Image fill URLs from `/files/:key/images` expire after 14 days. Cache the image data, not the URLs.

6. **Vector data requires `geometry=paths`.** Without this query parameter, vector nodes will not include path data needed for SVG export.

7. **Variables API requires Enterprise.** The `file_variables:read` and `file_variables:write` scopes require Enterprise organization full member access. See `figma-api-variables.md` for details.

8. **Branch files have limitations.** You cannot publish from branches, so library endpoints will not work with branch file keys. The main file key is available via `mainFileKey` in the file response.

9. **`null` values in node responses.** The `/nodes` endpoint may return `null` for a requested node ID if the node does not exist or is unrenderable. Always check for null.

10. **PATs expire after 90 days maximum.** Non-expiring tokens can no longer be created. Plan for token rotation in automated workflows.

---

### TypeScript Helper: Figma API Client

```ts
const FIGMA_BASE = 'https://api.figma.com/v1';

interface FigmaClientOptions {
  token: string;
}

class FigmaClient {
  private headers: Record<string, string>;

  constructor(options: FigmaClientOptions) {
    this.headers = { 'X-Figma-Token': options.token };
  }

  /** Fetch specific nodes from a file (preferred over full file fetch) */
  async getNodes(fileKey: string, nodeIds: string[]): Promise<GetFileNodesResponse> {
    const ids = nodeIds.join(',');
    const res = await fetch(
      `${FIGMA_BASE}/files/${fileKey}/nodes?ids=${ids}`,
      { headers: this.headers }
    );
    if (!res.ok) throw new Error(`Figma API ${res.status}: ${res.statusText}`);
    return res.json();
  }

  /** Export nodes as images */
  async exportImages(
    fileKey: string,
    nodeIds: string[],
    options: { format?: 'svg' | 'png' | 'jpg' | 'pdf'; scale?: number } = {}
  ): Promise<Record<string, string | null>> {
    const params = new URLSearchParams({
      ids: nodeIds.join(','),
      format: options.format || 'png',
      scale: String(options.scale || 1),
    });
    const res = await fetch(
      `${FIGMA_BASE}/images/${fileKey}?${params}`,
      { headers: this.headers }
    );
    if (!res.ok) throw new Error(`Figma API ${res.status}: ${res.statusText}`);
    const data = await res.json();
    return data.images;
  }

  /** Fetch full file (use sparingly — prefer getNodes) */
  async getFile(fileKey: string, depth?: number): Promise<GetFileResponse> {
    const params = depth ? `?depth=${depth}` : '';
    const res = await fetch(
      `${FIGMA_BASE}/files/${fileKey}${params}`,
      { headers: this.headers }
    );
    if (!res.ok) throw new Error(`Figma API ${res.status}: ${res.statusText}`);
    return res.json();
  }
}

// Usage:
const figma = new FigmaClient({ token: process.env.FIGMA_TOKEN! });
const nodes = await figma.getNodes('FILE_KEY', ['1:2', '3:4']);
```

---

## Cross-References

- **`figma-api-variables.md`** — Variables API for design tokens (collections, modes, bound variables)
- **`figma-api-plugin.md`** — Plugin API for sandbox access, SceneNode types, and IPC patterns
- **`figma-api-webhooks.md`** — Webhooks v2 for real-time file change notifications
- **`figma-api-devmode.md`** — Dev Mode, codegen plugins, and Dev Resources API
- **`design-to-code-layout.md`** — Auto Layout to Flexbox mapping (consumes node layout properties)
- **`design-to-code-assets.md`** — Image/SVG export patterns (consumes image endpoints)
