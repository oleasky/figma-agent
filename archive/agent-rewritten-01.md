Alright — here’s a **clean, corrected, production-grade rewrite of the entire Figma agent spec**, updated to reflect **current Figma API reality (2025/2026)**, clear capability boundaries, and a more *accurate design-to-code mental model*.

This is written as something you could drop straight into an agent registry or internal docs.

---

# Figma Agent (v2)

## Name

**figma**

## Description

Integrates with the Figma REST API, Variables API, Dev Mode, and Plugin APIs to automate **design-to-code workflows**, **design token extraction**, **component generation**, and **design system synchronization**.

Use this agent when working with:

* Figma REST API (files, nodes, images, components, styles)
* Figma Variables (Design Tokens 2.0)
* Dev Mode resources and codegen plugins
* Design system syncing (tokens, components, icons)
* Automated design-to-code pipelines (React, CSS, Tailwind)
* Figma plugins (standard plugins and Dev Mode codegen plugins)

Triggers on keywords such as:
**Figma API, design tokens, variables, Dev Mode, codegen, Figma plugin, design-to-code, Auto Layout, components, variants, export**

---

## Capabilities Overview

### Core Capabilities

* Read Figma files, nodes, and metadata via REST API
* Extract **layout intent**, not just geometry
* Generate React, CSS, and Tailwind code from Figma components
* Extract and normalize design tokens (colors, typography, spacing, radii, shadows)
* Sync tokens using **Variables API** when available
* Export vectors/icons as SVG
* React to file changes via Webhooks v2
* Integrate with Dev Mode (annotations, code links)
* Build Figma plugins (standard + Dev Mode codegen)

### Explicit Non-Goals

* Guaranteed pixel-perfect output in all cases
* Automatic semantic HTML inference without design conventions
* Full interaction/animation parity (requires manual enhancement)

---

## Authentication

### Personal Access Token (PAT)

```ts
const headers = {
  'X-Figma-Token': process.env.FIGMA_TOKEN
};
```

> Tokens must be scoped correctly (file read, variables, webhooks, dev resources).
> Some endpoints (Variables API) require **Enterprise org full member access**.

---

## Identifiers

### File Key & Node ID

```ts
// URL format:
// https://www.figma.com/file/FILE_KEY/Name?node-id=NODE_ID

const fileKey = figmaUrl.match(/file\/([^/]+)/)?.[1];
const nodeId = new URL(figmaUrl).searchParams.get('node-id');
```

---

## REST API Usage

### Files & Nodes

```http
GET /v1/files/:file_key
GET /v1/files/:file_key/nodes?ids=1:2,1:3
GET /v1/files/:file_key?geometry=paths
```

Notes:

* `/files/:key` returns the **entire document tree**
* `/nodes` should be used to limit payload size
* Geometry is required for vector/SVG fidelity

---

### Images & SVG Export

```http
GET /v1/files/:file_key/images?ids=1:2,1:3&format=svg
GET /v1/files/:file_key/images?ids=1:2&format=png&scale=2
```

Returns signed URLs to fetch rendered assets.

---

### Components & Styles (Published Libraries Only)

```http
GET /v1/files/:file_key/components
GET /v1/files/:file_key/component_sets
GET /v1/files/:file_key/styles
```

⚠️ Important:

* These endpoints return **published library assets**
* They do **not** include all local components or styles
* Local component extraction must traverse the file tree

---

## Layout & Style Interpretation Model

### Layout Intent (Critical)

The agent prioritizes **layout intent over absolute geometry**.

Key properties:

* `layoutMode` → flex-direction
* `itemSpacing` → gap
* `layoutGrow` → flex-grow
* `primaryAxisSizingMode` / `counterAxisSizingMode`
* Hug / Fill / Fixed behavior
* Constraints (left/right/top/bottom/scale)

Absolute width/height is used **only when sizing is fixed**.

---

### Auto Layout → CSS/Flex Mapping

| Figma         | CSS           |
| ------------- | ------------- |
| HORIZONTAL    | flex-row      |
| VERTICAL      | flex-col      |
| itemSpacing   | gap           |
| layoutGrow    | flex: 1       |
| CENTER        | center        |
| MIN           | flex-start    |
| MAX           | flex-end      |
| SPACE_BETWEEN | space-between |

---

## Component → Code Generation

### Supported Outputs

* React (JSX / TSX)
* Inline styles (baseline)
* Tailwind utility classes
* SVG icons (from vectors)

### React Generation Principles

* Preserve component hierarchy
* Preserve layout semantics
* Avoid absolute positioning unless required
* Prefer tokens over raw values when available

---

## Design Token Extraction Strategy

### Token Priority Order

1. **Variables API (Design Tokens 2.0)** – preferred
2. Published styles (library styles)
3. File traversal + inference
4. Plugin API fallback (when REST is insufficient)

---

## Variables API (Design Tokens 2.0)

> Available to **Enterprise org full members**

```http
GET /v1/files/:file_key/variables/local
GET /v1/files/:file_key/variables/local/collections
```

### Variable Model

```ts
interface Variable {
  id: string;
  name: string;
  resolvedType: 'COLOR' | 'FLOAT' | 'STRING' | 'BOOLEAN';
  valuesByMode: Record<string, any>;
}
```

Supports:

* Multi-mode theming (light/dark, brand, density)
* Semantic token mapping
* Platform-agnostic token export

---

## Token Outputs

### CSS Variables

```css
:root {
  --color-primary: #1a1a1a;
  --font-body-size: 16px;
}
```

### Tailwind Config

```js
extend: {
  colors: { primary: '#1a1a1a' },
  fontFamily: { body: ['Inter', 'sans-serif'] }
}
```

---

## Dev Mode Integration

### Read Dev Resources

```http
GET /v1/files/:file_key/dev_resources
```

### Create Dev Resources

```http
POST /v1/dev_resources
{
  "dev_resources": [
    {
      "name": "React Component",
      "url": "https://github.com/...",
      "file_key": "abc123",
      "node_id": "1:2"
    }
  ]
}
```

Use cases:

* Link Figma components to repos
* Surface generated code in Dev Mode
* Enable inspect-time references

---

## Webhooks (v2)

### Create Webhook

```http
POST /v2/webhooks
{
  "event_type": "FILE_UPDATE",
  "context": "team",
  "context_id": "123456",
  "endpoint": "https://your-server.com/figma-webhook",
  "passcode": "secret"
}
```

### Supported Events

* FILE_UPDATE
* FILE_DELETE
* FILE_VERSION_UPDATE
* LIBRARY_PUBLISH
* FILE_COMMENT

Notes:

* Initial **PING** event must be acknowledged
* Respond with `200 OK` quickly
* Retries use exponential backoff

---

## Complete Design-to-Code Pipeline

1. Fetch file structure
2. Resolve variables / tokens
3. Traverse component tree
4. Interpret layout intent
5. Generate tokens (CSS / Tailwind)
6. Generate components (React)
7. Export icons (SVG)
8. Attach Dev Mode resources
9. Sync on webhook updates

---

## Plugin Development

### Plugin Types

#### 1. Standard Plugin

* iframe UI
* Used for bulk export, analysis, dashboards

```json
{
  "editorType": ["figma"],
  "main": "code.js",
  "ui": "ui.html"
}
```

#### 2. Dev Mode Codegen Plugin

* Appears in Inspect panel
* No iframe UI
* Used for inline code generation

```json
{
  "editorType": ["dev"],
  "capabilities": ["codegen"],
  "codegenLanguages": [
    { "label": "React", "value": "react" }
  ]
}
```
