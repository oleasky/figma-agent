# Figma Variables API Reference

## Purpose

Authoritative reference for the Figma Variables REST API covering access requirements, endpoints, the variable data model (Variable, VariableCollection, modes, scopes), variable resolution mechanics, multi-mode theming patterns, and practical token extraction strategies. This is the design tokens foundation that all token-related modules depend on.

## When to Use

Reference this module when you need to:

- Extract design tokens from Figma files via the Variables API
- Understand variable collections, modes, and the `valuesByMode` structure
- Resolve variable aliases and bound variables on nodes
- Implement multi-mode theming (light/dark, brand variants)
- Build token dictionaries from Figma Variables for CSS/Tailwind/platform export
- Determine access requirements for Variables API endpoints

---

## Content

### Access Requirements

The Variables REST API is restricted to **full members of Enterprise organizations**. Guests and members of non-Enterprise plans cannot access these endpoints.

| Requirement | Details |
|------------|---------|
| **Figma plan** | Enterprise |
| **Seat type** | Full member (not guest) |
| **Read scope** | `file_variables:read` |
| **Write scope** | `file_variables:write` |
| **Read permission** | View access to the file |
| **Write permission** | Edit access to the file |

> **Important:** If your organization is not on an Enterprise plan, you must extract tokens by traversing the file tree and reading style properties from nodes. See `figma-api-rest.md` for file traversal patterns.

---

### Endpoints

#### GET /v1/files/:file_key/variables/local

Retrieves all local variables and collections created in the file, plus any remote variables consumed by the file.

**Scope required:** `file_variables:read`
**Rate limit tier:** Tier 2

```bash
curl -H "X-Figma-Token: YOUR_FIGMA_TOKEN" \
  "https://api.figma.com/v1/files/FILE_KEY/variables/local"
```

**Response shape:**

```ts
interface GetLocalVariablesResponse {
  status: number;
  error: boolean;
  meta: {
    variables: Record<string, Variable>;
    variableCollections: Record<string, VariableCollection>;
  };
}
```

This endpoint returns:
- All variables defined locally in the file
- All remote (external library) variables that are referenced/used in the file
- All variable collections (local and remote)

Use the `remote` boolean field on each variable/collection to distinguish local from external.

#### GET /v1/files/:file_key/variables/published

Retrieves variables that have been published from the specified file (for library consumers).

**Scope required:** `file_variables:read`
**Rate limit tier:** Tier 2

```bash
curl -H "X-Figma-Token: YOUR_FIGMA_TOKEN" \
  "https://api.figma.com/v1/files/FILE_KEY/variables/published"
```

**Key differences from `/local`:**

- Returns only published variables (not local-only or unpublished)
- Each variable and collection includes a `subscribed_id` field for consumer tracking
- Mode details are omitted from the response

Use this endpoint when building tooling for library consumers who need to reference published tokens.

#### POST /v1/files/:file_key/variables

Bulk create, update, and delete variables, collections, and modes.

**Scope required:** `file_variables:write`
**Rate limit tier:** Tier 3

```bash
curl -X POST \
  -H "X-Figma-Token: YOUR_FIGMA_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "variableCollections": [...], "variables": [...] }' \
  "https://api.figma.com/v1/files/FILE_KEY/variables"
```

**Request body arrays (processed in order):**

| Array | Purpose |
|-------|---------|
| `variableCollections` | Create, update, or delete collections |
| `variableModes` | Create, update, or delete modes |
| `variables` | Create, update, or delete variables |
| `variableModeValues` | Set variable values per mode |

**Constraints:**

| Constraint | Limit |
|-----------|-------|
| Max modes per collection | 40 |
| Max variables per collection | 5,000 |
| Max request payload | 4 MB |
| Mode name length | 40 characters |
| Variable name restrictions | Cannot contain `.`, `{`, `}` |
| Variable name uniqueness | Must be unique within collection |

**Atomicity:** All changes in a single POST request succeed or fail together. Partial application does not occur.

**Temporary IDs:** When creating new objects, you can use temporary IDs (prefixed with any string) to reference objects created in the same request. For example, create a collection and immediately add variables to it.

> **Important:** Variables created or updated via the REST API must be **published** before they become accessible in other files. The API does not auto-publish.

---

### Variable Data Model

#### Variable

A single design token that defines values for each mode in its parent collection.

```ts
interface Variable {
  /** Unique identifier within the file */
  id: string;

  /** Variable name (e.g., "primary/500", "spacing/md") */
  name: string;

  /** Stable key for cross-file references */
  key: string;

  /** Parent collection ID */
  variableCollectionId: string;

  /** Resolved type of this variable's values */
  resolvedType: 'BOOLEAN' | 'FLOAT' | 'STRING' | 'COLOR';

  /** Values indexed by mode ID */
  valuesByMode: Record<string, VariableValue>;

  /** Whether this variable comes from an external library */
  remote: boolean;

  /** Human-readable description */
  description: string;

  /** If true, excluded from library publishing */
  hiddenFromPublishing: boolean;

  /** Controls which UI pickers show this variable */
  scopes: VariableScope[];

  /** Platform-specific code syntax for Dev Mode */
  codeSyntax: VariableCodeSyntax;

  /**
   * True if the variable was deleted but is still referenced
   * by other variables or nodes in the file
   */
  deletedButReferenced?: boolean;
}
```

#### VariableCollection

A grouping of related variables that share the same set of modes.

```ts
interface VariableCollection {
  /** Unique identifier within the file */
  id: string;

  /** Collection name (e.g., "Colors", "Spacing", "Typography") */
  name: string;

  /** Stable key for cross-file references */
  key: string;

  /** Modes defined in this collection: { modeId: modeName } */
  modes: Record<string, string>;

  /** The default mode ID (used when no explicit mode is set) */
  defaultModeId: string;

  /** Whether this collection comes from an external library */
  remote: boolean;

  /** If true, excluded from library publishing */
  hiddenFromPublishing: boolean;

  /** Ordered list of variable IDs in this collection */
  variableIds: string[];

  /** Whether this is an extended (inherited) collection */
  isExtension?: boolean;

  /** Parent collection ID (for extended collections) */
  parentVariableCollectionId?: string;

  /** Root collection ID in the extension chain */
  rootVariableCollectionId?: string;

  /** Variable IDs inherited from parent (extended collections) */
  inheritedVariableIds?: string[];

  /** Variable IDs created locally (extended collections) */
  localVariableIds?: string[];

  /** Override values for inherited variables */
  variableOverrides?: Record<string, any>;
}
```

#### VariableValue

A variable's value for a given mode is either a direct value or an alias to another variable.

```ts
/** Direct values based on resolvedType */
type VariableValue =
  | boolean              // BOOLEAN
  | number               // FLOAT
  | string               // STRING
  | RGBA                 // COLOR
  | VariableAlias;       // Reference to another variable

interface RGBA {
  r: number;  // 0-1
  g: number;  // 0-1
  b: number;  // 0-1
  a: number;  // 0-1
}

interface VariableAlias {
  type: 'VARIABLE_ALIAS';
  id: string;  // The referenced variable's ID
}
```

> **Note:** Color values use 0-1 range, NOT 0-255. Multiply by 255 and round when converting to hex/rgb CSS values.

#### VariableScope

Scopes control which property pickers in the Figma UI show the variable. Scopes do NOT prevent programmatic binding via the API or plugin code.

```ts
type VariableScope =
  | 'ALL_SCOPES'          // Shown in all pickers (if set, no other scopes allowed)
  | 'TEXT_CONTENT'         // String variables: text content
  | 'CORNER_RADIUS'       // Float variables: border radius
  | 'WIDTH_HEIGHT'         // Float variables: width/height
  | 'GAP'                 // Float variables: auto layout gap/spacing
  | 'ALL_FILLS'           // Color variables: all fill types
  | 'FRAME_FILL'          // Color variables: frame fills only
  | 'SHAPE_FILL'          // Color variables: shape fills only
  | 'TEXT_FILL'           // Color variables: text fills only
  | 'STROKE_COLOR'        // Color variables: stroke colors
  | 'EFFECT_COLOR'        // Color variables: effect colors (shadows, etc.)
  | 'STROKE_FLOAT'        // Float variables: stroke width
  | 'EFFECT_FLOAT'        // Float variables: effect values (blur, spread)
  | 'OPACITY'             // Float variables: opacity
  | 'FONT_FAMILY'         // String variables: font family
  | 'FONT_STYLE'          // String variables: font style
  | 'FONT_WEIGHT'         // Float variables: font weight
  | 'FONT_SIZE'           // Float variables: font size
  | 'LINE_HEIGHT'         // Float variables: line height
  | 'LETTER_SPACING'      // Float variables: letter spacing
  | 'PARAGRAPH_SPACING'   // Float variables: paragraph spacing
  | 'PARAGRAPH_INDENT'    // Float variables: paragraph indent
  ;
```

**Scope validity by resolvedType:**

| resolvedType | Valid Scopes |
|-------------|-------------|
| `BOOLEAN` | `ALL_SCOPES` |
| `FLOAT` | `ALL_SCOPES`, `TEXT_CONTENT`, `CORNER_RADIUS`, `WIDTH_HEIGHT`, `GAP`, `OPACITY`, `STROKE_FLOAT`, `EFFECT_FLOAT`, `FONT_WEIGHT`, `FONT_SIZE`, `LINE_HEIGHT`, `LETTER_SPACING`, `PARAGRAPH_SPACING`, `PARAGRAPH_INDENT` |
| `STRING` | `ALL_SCOPES`, `TEXT_CONTENT`, `FONT_FAMILY`, `FONT_STYLE` |
| `COLOR` | `ALL_SCOPES`, `ALL_FILLS`, `FRAME_FILL`, `SHAPE_FILL`, `TEXT_FILL`, `STROKE_COLOR`, `EFFECT_COLOR` |

#### VariableCodeSyntax

Platform-specific code representations displayed in Dev Mode.

```ts
interface VariableCodeSyntax {
  WEB?: string;      // e.g., "var(--color-primary)"
  ANDROID?: string;  // e.g., "@color/primary"
  iOS?: string;      // e.g., "Color.primary"
}
```

---

### Variable Resolution

#### Direct Values vs Aliases

A variable's value for each mode can be either a **direct value** (literal boolean, number, string, or color) or a **variable alias** (reference to another variable).

```ts
// Direct value example (COLOR type, mode "light"):
{
  "valuesByMode": {
    "mode-light-id": { "r": 0.067, "g": 0.067, "b": 0.067, "a": 1 },
    "mode-dark-id": { "r": 0.933, "g": 0.933, "b": 0.933, "a": 1 }
  }
}

// Alias example (references another variable):
{
  "valuesByMode": {
    "mode-light-id": { "type": "VARIABLE_ALIAS", "id": "VariableID:1234:0" },
    "mode-dark-id": { "type": "VARIABLE_ALIAS", "id": "VariableID:5678:0" }
  }
}
```

#### Resolving Alias Chains

Aliases can chain: Variable A references Variable B which references Variable C. To resolve to a final value, follow the chain:

```ts
function resolveVariable(
  variableId: string,
  modeId: string,
  variables: Record<string, Variable>
): VariableValue {
  const variable = variables[variableId];
  if (!variable) throw new Error(`Variable ${variableId} not found`);

  const value = variable.valuesByMode[modeId];
  if (!value) {
    // Fall back to default mode
    const collection = findCollection(variable.variableCollectionId);
    return variable.valuesByMode[collection.defaultModeId];
  }

  // If it's an alias, resolve recursively
  if (typeof value === 'object' && 'type' in value && value.type === 'VARIABLE_ALIAS') {
    return resolveVariable(value.id, modeId, variables);
  }

  return value;
}
```

> **Note:** Figma prevents alias cycles — a variable cannot reference itself directly or through a chain.

#### Mode Resolution and Fallbacks

Each variable has values indexed by mode ID in its `valuesByMode` map. Resolution order:

1. Look up the value for the **requested mode ID**
2. If no value exists for that mode, use the **collection's `defaultModeId`**
3. If the value is an alias, resolve the referenced variable using the **same mode ID**

When an alias references a variable in a **different** collection, the referenced variable resolves using its own collection's modes. Cross-collection mode mapping is not automatic.

#### Bound Variables on Nodes

Nodes in the Figma file tree indicate which variables are bound to their properties via the `boundVariables` field:

```ts
// Example: a frame with variables bound to fills and corner radius
{
  "type": "FRAME",
  "name": "Card",
  "boundVariables": {
    "fills": [
      {
        "type": "VARIABLE_ALIAS",
        "id": "VariableID:1234:0"
      }
    ],
    "topLeftRadius": {
      "type": "VARIABLE_ALIAS",
      "id": "VariableID:5678:0"
    },
    "topRightRadius": {
      "type": "VARIABLE_ALIAS",
      "id": "VariableID:5678:0"
    },
    "itemSpacing": {
      "type": "VARIABLE_ALIAS",
      "id": "VariableID:9012:0"
    }
  }
}
```

**Properties that can have bound variables include:** fills, strokes, effects, cornerRadius (and individual corners), itemSpacing, paddingLeft/Right/Top/Bottom, width, height, opacity, fontFamily, fontSize, fontWeight, lineHeight, letterSpacing, and more.

The `boundVariables` map tells you which properties are token-driven vs hard-coded, which is essential for design-to-code token mapping.

---

### Multi-Mode Theming

#### Pattern: Light/Dark Mode

The most common multi-mode pattern is light and dark themes.

**Figma structure:**

```
Collection: "Theme"
  Modes: ["Light", "Dark"]
  Variables:
    "bg/primary"     → Light: #FFFFFF, Dark: #1A1A1A
    "bg/secondary"   → Light: #F5F5F5, Dark: #2D2D2D
    "text/primary"   → Light: #1A1A1A, Dark: #FFFFFF
    "text/secondary"  → Light: #666666, Dark: #A0A0A0
    "border/default" → Light: #E0E0E0, Dark: #404040
```

**CSS output (class-based switching):**

```css
:root,
[data-theme="light"] {
  --bg-primary: #ffffff;
  --bg-secondary: #f5f5f5;
  --text-primary: #1a1a1a;
  --text-secondary: #666666;
  --border-default: #e0e0e0;
}

[data-theme="dark"] {
  --bg-primary: #1a1a1a;
  --bg-secondary: #2d2d2d;
  --text-primary: #ffffff;
  --text-secondary: #a0a0a0;
  --border-default: #404040;
}
```

**CSS output (media query):**

```css
:root {
  --bg-primary: #ffffff;
  --text-primary: #1a1a1a;
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg-primary: #1a1a1a;
    --text-primary: #ffffff;
  }
}
```

#### Pattern: Brand Theming

Multiple brands sharing a common token structure.

**Figma structure:**

```
Collection: "Brand"
  Modes: ["Brand A", "Brand B", "Brand C"]
  Variables:
    "color/primary"   → A: #0066FF, B: #FF3366, C: #00CC88
    "color/secondary" → A: #003399, B: #CC0033, C: #009966
    "font/heading"    → A: "Inter",  B: "Poppins", C: "DM Sans"
```

**CSS output (class-based):**

```css
.brand-a {
  --color-primary: #0066ff;
  --color-secondary: #003399;
  --font-heading: 'Inter', sans-serif;
}

.brand-b {
  --color-primary: #ff3366;
  --color-secondary: #cc0033;
  --font-heading: 'Poppins', sans-serif;
}

.brand-c {
  --color-primary: #00cc88;
  --color-secondary: #009966;
  --font-heading: 'DM Sans', sans-serif;
}
```

#### Pattern: Layered Modes (Theme + Density)

Multiple collections with independent modes that compose together.

**Figma structure:**

```
Collection: "Theme"
  Modes: ["Light", "Dark"]
  Variables: color tokens...

Collection: "Density"
  Modes: ["Compact", "Default", "Comfortable"]
  Variables: spacing tokens...
```

In CSS, these compose naturally because each collection maps to independent custom properties:

```css
/* Theme layer */
[data-theme="light"] { --bg: #fff; --text: #1a1a1a; }
[data-theme="dark"]  { --bg: #1a1a1a; --text: #fff; }

/* Density layer (independent) */
[data-density="compact"]      { --spacing-md: 8px; --spacing-lg: 12px; }
[data-density="default"]      { --spacing-md: 16px; --spacing-lg: 24px; }
[data-density="comfortable"]  { --spacing-md: 24px; --spacing-lg: 32px; }
```

---

### Practical Patterns

#### Extracting All Color Tokens

```ts
interface ColorToken {
  name: string;
  variableId: string;
  collection: string;
  values: Record<string, { hex: string; rgba: RGBA }>;
}

async function extractColorTokens(fileKey: string): Promise<ColorToken[]> {
  const res = await fetch(
    `https://api.figma.com/v1/files/${fileKey}/variables/local`,
    { headers: { 'X-Figma-Token': process.env.FIGMA_TOKEN! } }
  );
  const { meta } = await res.json();
  const tokens: ColorToken[] = [];

  for (const variable of Object.values(meta.variables) as Variable[]) {
    if (variable.resolvedType !== 'COLOR') continue;
    if (variable.remote) continue; // Skip imported variables

    const collection = meta.variableCollections[variable.variableCollectionId];

    const values: Record<string, { hex: string; rgba: RGBA }> = {};
    for (const [modeId, value] of Object.entries(variable.valuesByMode)) {
      const resolved = resolveToColor(value as VariableValue, modeId, meta.variables);
      if (resolved) {
        const modeName = collection.modes[modeId] || modeId;
        values[modeName] = {
          hex: rgbaToHex(resolved),
          rgba: resolved,
        };
      }
    }

    tokens.push({
      name: variable.name,
      variableId: variable.id,
      collection: collection.name,
      values,
    });
  }

  return tokens;
}

function rgbaToHex(c: RGBA): string {
  const toHex = (v: number) => Math.round(v * 255).toString(16).padStart(2, '0');
  const hex = `#${toHex(c.r)}${toHex(c.g)}${toHex(c.b)}`;
  return c.a < 1 ? `${hex}${toHex(c.a)}` : hex;
}
```

#### Building a Complete Token Dictionary

```ts
interface TokenDictionary {
  colors: Record<string, Record<string, string>>;   // name → { modeName: hex }
  numbers: Record<string, Record<string, number>>;  // name → { modeName: value }
  strings: Record<string, Record<string, string>>;  // name → { modeName: value }
  booleans: Record<string, Record<string, boolean>>; // name → { modeName: value }
}

async function buildTokenDictionary(fileKey: string): Promise<TokenDictionary> {
  const res = await fetch(
    `https://api.figma.com/v1/files/${fileKey}/variables/local`,
    { headers: { 'X-Figma-Token': process.env.FIGMA_TOKEN! } }
  );
  const { meta } = await res.json();

  const dict: TokenDictionary = { colors: {}, numbers: {}, strings: {}, booleans: {} };

  for (const variable of Object.values(meta.variables) as Variable[]) {
    if (variable.remote) continue;
    if (variable.hiddenFromPublishing) continue;

    const collection = meta.variableCollections[variable.variableCollectionId];
    const tokenName = `${collection.name}/${variable.name}`;

    for (const [modeId, rawValue] of Object.entries(variable.valuesByMode)) {
      const modeName = collection.modes[modeId] || modeId;
      const value = resolveValue(rawValue as VariableValue, modeId, meta.variables);

      switch (variable.resolvedType) {
        case 'COLOR':
          dict.colors[tokenName] ??= {};
          dict.colors[tokenName][modeName] = rgbaToHex(value as RGBA);
          break;
        case 'FLOAT':
          dict.numbers[tokenName] ??= {};
          dict.numbers[tokenName][modeName] = value as number;
          break;
        case 'STRING':
          dict.strings[tokenName] ??= {};
          dict.strings[tokenName][modeName] = value as string;
          break;
        case 'BOOLEAN':
          dict.booleans[tokenName] ??= {};
          dict.booleans[tokenName][modeName] = value as boolean;
          break;
      }
    }
  }

  return dict;
}
```

#### Detecting Which Variables Are Actually Used

Combine file tree traversal with the Variables API to find which tokens are actively bound to design elements:

```ts
async function findUsedVariables(fileKey: string): Promise<Set<string>> {
  // 1. Fetch the file tree
  const fileRes = await fetch(
    `https://api.figma.com/v1/files/${fileKey}`,
    { headers: { 'X-Figma-Token': process.env.FIGMA_TOKEN! } }
  );
  const file = await fileRes.json();

  // 2. Walk the tree and collect all bound variable IDs
  const usedIds = new Set<string>();

  function walk(node: any) {
    if (node.boundVariables) {
      for (const bindings of Object.values(node.boundVariables)) {
        if (Array.isArray(bindings)) {
          for (const b of bindings) {
            if (b && typeof b === 'object' && b.type === 'VARIABLE_ALIAS') {
              usedIds.add(b.id);
            }
          }
        } else if (bindings && typeof bindings === 'object') {
          const b = bindings as any;
          if (b.type === 'VARIABLE_ALIAS') {
            usedIds.add(b.id);
          }
        }
      }
    }
    if (node.children) {
      node.children.forEach(walk);
    }
  }

  walk(file.document);
  return usedIds;
}
```

#### Generating CSS Custom Properties from Variables

```ts
async function generateCSSVariables(fileKey: string): Promise<string> {
  const res = await fetch(
    `https://api.figma.com/v1/files/${fileKey}/variables/local`,
    { headers: { 'X-Figma-Token': process.env.FIGMA_TOKEN! } }
  );
  const { meta } = await res.json();

  const output: string[] = [];

  // Group variables by collection
  for (const collection of Object.values(meta.variableCollections) as VariableCollection[]) {
    if (collection.remote) continue;

    const collectionVars = collection.variableIds
      .map(id => meta.variables[id])
      .filter((v): v is Variable => v != null && !v.hiddenFromPublishing);

    // Generate CSS for each mode
    const modeEntries = Object.entries(collection.modes);

    for (const [modeId, modeName] of modeEntries) {
      const isDefault = modeId === collection.defaultModeId;
      const selector = isDefault
        ? ':root'
        : `[data-${slugify(collection.name)}="${slugify(modeName)}"]`;

      output.push(`${selector} {`);

      for (const variable of collectionVars) {
        const value = variable.valuesByMode[modeId];
        if (!value) continue;

        const resolved = resolveValue(value, modeId, meta.variables);
        const cssName = `--${tokenToCSSName(variable.name)}`;
        const cssValue = formatCSSValue(resolved, variable.resolvedType);

        output.push(`  ${cssName}: ${cssValue};`);
      }

      output.push('}');
      output.push('');
    }
  }

  return output.join('\n');
}

function tokenToCSSName(name: string): string {
  return name
    .replace(/\//g, '-')
    .replace(/\s+/g, '-')
    .replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)
    .replace(/^-/, '')
    .toLowerCase();
}

function slugify(str: string): string {
  return str.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

function formatCSSValue(value: any, type: string): string {
  switch (type) {
    case 'COLOR': {
      const c = value as RGBA;
      if (c.a < 1) {
        return `rgba(${Math.round(c.r * 255)}, ${Math.round(c.g * 255)}, ${Math.round(c.b * 255)}, ${c.a})`;
      }
      return rgbaToHex(c);
    }
    case 'FLOAT':
      return `${value}px`;
    case 'STRING':
      return `'${value}'`;
    case 'BOOLEAN':
      return value ? '1' : '0';
    default:
      return String(value);
  }
}
```

#### Platform-Agnostic Token Export

The `codeSyntax` field on variables provides platform-specific token names for Dev Mode:

```ts
// Example: use codeSyntax for platform-aware export
function exportForPlatform(
  variable: Variable,
  platform: 'WEB' | 'ANDROID' | 'iOS'
): string | null {
  // Prefer explicit codeSyntax if set by designers
  if (variable.codeSyntax[platform]) {
    return variable.codeSyntax[platform];
  }

  // Fall back to auto-generated name
  switch (platform) {
    case 'WEB':
      return `var(--${tokenToCSSName(variable.name)})`;
    case 'ANDROID':
      return `@dimen/${variable.name.replace(/\//g, '_').toLowerCase()}`;
    case 'iOS':
      return variable.name.replace(/\//g, '.').replace(/\s+/g, '');
    default:
      return null;
  }
}
```

---

### Token Extraction Priority

When extracting design tokens from a Figma file, use this priority order:

1. **Variables API** (this module) — Best structured source. Includes modes, scopes, aliases, and explicit token definitions. Requires Enterprise plan.

2. **Published styles** — Use `/files/:key/styles` for published library styles. Limited to published content only. See `figma-api-rest.md`.

3. **File tree traversal + inference** — Walk the node tree, read fill/stroke/effect properties, and derive tokens by frequency analysis (threshold-based promotion). Works on all plans but requires heuristics.

4. **Plugin API** — For local styles and variables when REST is plan-limited. Requires running a Figma plugin in-context. See `figma-api-plugin.md`.

---

### Error Handling

| Status | Meaning | Action |
|--------|---------|--------|
| `400` | Invalid parameter (bad variable name, scope mismatch) | Check request body against constraints |
| `401` | Authentication failed | Verify token and `file_variables:read/write` scope |
| `403` | Insufficient permissions (non-Enterprise or guest) | Confirm Enterprise plan, full member status, and file access |
| `404` | File not found | Verify file key |
| `413` | Payload exceeds 4 MB | Split POST request into smaller batches |
| `429` | Rate limited | Use `Retry-After` header. See `figma-api-rest.md` for backoff strategy |

---

## Cross-References

- **`figma-api-rest.md`** — Core REST API reference (authentication, file endpoints, rate limits, node structure)
- **`figma-api-plugin.md`** — Plugin API alternative for variables access on non-Enterprise plans
- **`figma-api-webhooks.md`** — Webhooks v2 LIBRARY_PUBLISH event for reacting to published variable changes
- **`design-tokens.md`** — Token extraction strategies, CSS variable naming, threshold-based promotion
- **`design-tokens-variables.md`** — Deep dive on Figma Variables patterns (modes, fallback chains, scope usage)
- **`css-strategy.md`** — Layered CSS approach for consuming design tokens
- **`design-to-code-visual.md`** — Visual property extraction that consumes bound variable data
