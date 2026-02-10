Below is a “spec audit” of your **Figma agent** as-written, grounded in the current official Figma docs, plus the biggest opportunities to make it *more correct*, *more reliable*, and *more “pixel-faithful”* for design-to-code.

---

## What’s correct (and solid)

### ✅ Auth + base REST approach

* Using `X-Figma-Token` for PATs is correct. ([Figma Developer Docs][1])
* The general pattern “fetch file → fetch nodes → interpret → generate code” is aligned with how the REST API is intended to be used. ([Figma Developer Docs][2])

### ✅ File key + node-id parsing

* The URL shape `.../file/:file_key/...?...node-id=:id` is explicitly documented. ([Figma Developer Docs][2])

### ✅ Variables API endpoints exist (but plan-gated)

* `GET /v1/files/:file_key/variables/local` is real and documented. ([Figma Developer Docs][3])
* Your “Variables API (Design Tokens 2.0)” section is directionally correct (local/published variables, collections/modes concept). ([Figma Developer Docs][3])

### ✅ Dev Resources endpoints (mostly)

* `GET /v1/files/:file_key/dev_resources` is correct. ([Figma Developer Docs][4])

### ✅ Webhooks v2 concept + passcode concept

* Webhooks v2 are real, and “passcode echoed back for verification” is in the official API definition. ([Figma Developer Docs][5])

---

## What’s incorrect / misleading today

### 1) Webhooks v2: your request body is outdated (team_id → context)

Your example uses:

```json
{ "team_id": "...", "event_type": "...", "endpoint": "...", "passcode": "..." }
```

But current Webhooks v2 creation uses **`context`** + **`context_id`** (team/project/file), not `team_id`. ([Figma Developer Docs][5])

**Fix:**

```json
{
  "event_type": "FILE_UPDATE",
  "context": "team",
  "context_id": "123456",
  "endpoint": "https://...",
  "passcode": "..."
}
```

(Also note you’ll receive a **PING** on success, and Figma retries failed deliveries on an exponential backoff schedule.) ([Figma Developer Docs][6])

---

### 2) Dev Resources: POST payload shape is wrong

Your example uses:

```json
{ "dev_resource": { ... } }
```

But the documented endpoint is `POST /v1/dev_resources` with a **`dev_resources` array**. ([Figma Developer Docs][4])

**Fix:**

```json
{
  "dev_resources": [
    { "name": "...", "url": "...", "file_key": "...", "node_id": "..." }
  ]
}
```

---

### 3) “Export Images” endpoint: prefer `/v1/files/:key/images`

Your spec uses:

* `GET https://api.figma.com/v1/images/:file_key?...`

In current docs, the file image-URL endpoint is:

* `GET /v1/files/:key/images` ([Figma Developer Docs][2])

Reality: many people still use `/v1/images/:file_key`, but for correctness and future-proofing, your agent spec should lead with the documented `/v1/files/:key/images` and treat the other as legacy.

---

### 4) Components/styles endpoints: they return *published library assets*, not “all components”

Your spec implies:

* “Get all components in a file” via `GET /v1/files/:file_key/components`

In Figma REST, the `/files/:file_key/components`, `/component_sets`, and `/styles` endpoints are for **published library content** (Tier 3 “library” style access), not “everything sitting in the file.” ([Figma Developer Docs][7])

**Why this matters:**
If you’re trying to generate code for *local components* (not published), relying on these endpoints will silently miss a lot.

**Better approach for “all components used in the file”:**

* Use `GET /v1/files/:key` / `GET /v1/files/:key/nodes` and inspect the `components` map + node tree metadata (instances reference component origin). ([Figma Developer Docs][2])

---

### 5) Variables API access: your plan note is imprecise

You wrote “requires enterprise/organization plan”. The official doc language is: **available to full members of Enterprise orgs** (and it’s a Tier 2 endpoint requiring specific scopes). ([Figma Developer Docs][3])

So: correct directionally, but tighten wording to match reality.

---

### 6) Codegen plugin manifest: your `editorType` is wrong for codegen

Your manifest example:

```json
"editorType": ["figma", "figjam"],
"capabilities": ["codegen"]
```

But “plugins for code generation” are **Dev Mode** plugins. Figma’s docs explicitly say codegen plugins should use:

* `"editorType": ["dev"]`
* capabilities include `"codegen"` (and docs also mention `"vscode"` for codegen workflows). ([Figma Developer Docs][8])

So the manifest section needs a correction depending on whether you mean:

* a normal plugin with an iframe UI, **or**
* a Dev Mode **codegen** plugin that appears in the Inspect panel.

---

## Where this agent excels (as-is)

### ⭐ It’s a good “reference spine” for a design-automation agent

It covers the major buckets teams actually build:

* file fetch / node fetch
* token extraction
* component-to-code
* webhooks + syncing
* plugin scaffolding

### ⭐ The “Auto Layout → flexbox” mapping is a strong starting heuristic

For many design systems that lean heavily on Auto Layout, mapping:

* `layoutMode` → `flex-direction`
* `itemSpacing` → `gap`
* axis alignment → `justify/align`
  …gets you a surprisingly usable baseline quickly.

### ⭐ It’s already oriented toward “pipelines”

The “Complete pipeline: file → tokens + components + icons” is exactly how real teams operationalize Figma-to-code, even if some endpoints/edge cases need tightening.

---

## Highest-impact opportunities to improve accuracy

### A) Upgrade design-to-code from “absolute sizes everywhere” to **layout-intent**

Right now you set `width/height` from `absoluteBoundingBox` for many nodes. That often fights responsive behavior.

**Add logic for:**

* Auto Layout sizing modes (`layoutSizingHorizontal/Vertical` / hug/fill/fixed behavior)
* `layoutGrow` (maps to `flex: 1` / `flex-grow`)
* constraints (left/right/top/bottom/scale) for non-auto-layout frames
* “min/max” sizing when present, and “stretch” on cross-axis

This is the difference between “looks right in one viewport” and “actually behaves like the Figma layout.”

---

### B) Expand style extraction beyond SOLID fills + single radius

Right now you largely ignore:

* gradients + images
* strokes (border width, color, alignment)
* effects (drop shadow, inner shadow, layer blur)
* per-corner radii (Figma can have mixed radii)
* opacity at node level
* blend modes

If you want “near pixel-perfect,” you need these.

---

### C) Tokens: stop relying on `/files/:key/styles` for core token extraction

Because styles endpoints are “published library assets” oriented, they’re not a reliable universal token source. ([Figma Developer Docs][7])

**Preferred strategy hierarchy:**

1. **Variables API** when available (best structured, includes modes/themes). ([Figma Developer Docs][3])
2. Otherwise traverse the file and derive tokens by:

   * reading `styles` references on nodes
   * building a normalized token dictionary (colors/typography/effects)
3. Plugin API fallback for local styles/variables if REST is plan-limited

---

### D) Webhooks: include operational reality

Add to spec:

* successful creation triggers a **PING** ([Figma Developer Docs][6])
* retry policy + need to return `200 OK` promptly ([Figma Developer Docs][6])
* migrate examples to `context/context_id` ([Figma Developer Docs][5])

---

### E) Plugin manifest: separate “normal plugin” vs “Dev Mode codegen plugin”

Right now you mix concepts:

* iframe UI plugin with `figma.showUI()`
* codegen manifest fields

Split into two templates:

1. **Standard plugin**: `editorType: ["figma"]` / `["figma","figjam"]`, `ui`, `main`, optional networkAccess
2. **Dev Mode codegen plugin**: `editorType: ["dev"]`, capabilities include codegen (and per docs, vscode) ([Figma Developer Docs][8])

---

### F) Add “scopes + rate limits” as first-class constraints

Your agent should explicitly track:

* required scopes per endpoint tier (e.g., file content read vs variables vs dev resources vs webhooks) because modern PATs are scope-configured. ([Figma Developer Docs][1])
* backoff + caching strategies (file JSON is big; nodes endpoint can be chunked)

---

## Quick “patch list” you can apply directly to the spec

1. Replace webhook example body with `context/context_id`. ([Figma Developer Docs][5])
2. Replace Dev Resources POST body with `dev_resources: [...]`. ([Figma Developer Docs][4])
3. Prefer `GET /v1/files/:key/images` in docs/examples. ([Figma Developer Docs][2])
4. Clarify that `/files/:file_key/components` and `/files/:file_key/styles` are for **published library** content. ([Figma Developer Docs][7])
5. Fix codegen manifest: `editorType:["dev"]` (+ capabilities per docs). ([Figma Developer Docs][8])
6. Tighten Variables API plan note to “Enterprise org full members” + scopes/tier. ([Figma Developer Docs][3])

---

I recommend a rewrite of the entire agent spec into a “v2” that:

* has correct endpoint shapes,
* clearly distinguishes REST vs Plugin vs Dev Mode Codegen,
* includes token extraction decision tree (Variables API → plugin → inference),
* and includes a better Figma→layout→React/Tailwind mapping rubric (hug/fill, layoutGrow, constraints, etc.).

[1]: https://developers.figma.com/docs/rest-api/authentication/ "Authentication | Developer Docs"
[2]: https://developers.figma.com/docs/rest-api/file-endpoints/ "Endpoints | Developer Docs"
[3]: https://developers.figma.com/docs/rest-api/variables-endpoints/ "Endpoints | Developer Docs"
[4]: https://developers.figma.com/docs/rest-api/dev-resources-endpoints/ "Endpoints | Developer Docs"
[5]: https://developers.figma.com/docs/rest-api/webhooks-endpoints/ "Endpoints | Developer Docs"
[6]: https://developers.figma.com/docs/rest-api/webhooks/ "Webhooks V2 | Developer Docs"
[7]: https://developers.figma.com/docs/rest-api/component-endpoints/?utm_source=chatgpt.com "Endpoints | Developer Docs"
[8]: https://developers.figma.com/docs/plugins/codegen-plugins/?utm_source=chatgpt.com "Plugins for Code Generation | Developer Docs"
