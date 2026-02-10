# Figma Webhooks v2 Reference

## Purpose

Authoritative reference for Figma Webhooks v2 covering webhook scoping via `context` + `context_id`, all CRUD endpoints, event types with payload structures, operational considerations (passcode verification, retries, idempotency), and practical webhook listener patterns. This module documents the server-side integration for reacting to Figma file changes in real time.

## When to Use

Reference this module when you need to:

- Set up webhook listeners for Figma file change notifications
- Create, update, or delete webhooks via the REST API
- Handle webhook event payloads (FILE_UPDATE, LIBRARY_PUBLISH, etc.)
- Verify webhook authenticity using passcode comparison
- Understand retry behavior and operational requirements
- Build automated pipelines triggered by Figma design changes

---

## Content

### Webhooks v2 Overview

Webhooks enable your server to receive HTTP POST notifications when specific events occur in Figma files, projects, or teams. Webhooks v2 uses a `context` + `context_id` scoping model that supports team-level, project-level, and file-level granularity.

> **Critical:** Webhook creation uses `context` + `context_id` fields, NOT the deprecated `team_id` field. The `team_id` field in the WebhookV2 response object is a legacy read-only field (empty string for project/file-scoped webhooks).

#### Scoping Model

| Context | `context` value | `context_id` value | Who can create | Receives events for |
|---------|----------------|-------------------|----------------|-------------------|
| Team | `"team"` | Team ID | Team admins | All files available to team members (excludes invite-only project files) |
| Project | `"project"` | Project ID | Users with edit access to project | All files in the project |
| File | `"file"` | File key | Users with edit access to file | The specific file only |

#### Webhook Limits

| Context | Max webhooks per context |
|---------|:------------------------:|
| Team | 20 |
| Project | 5 |
| File | 3 |

**File webhook totals by plan:**

| Plan | Max file webhooks total |
|------|:-----------------------:|
| Professional | 150 |
| Organization | 300 |
| Enterprise | 600 |

#### Webhook Statuses

| Status | Description |
|--------|-------------|
| `ACTIVE` | The webhook is healthy and receives all events |
| `PAUSED` | The webhook is paused and will not receive any events |

> **Note:** You cannot programmatically set a webhook to an error state. Figma manages error states internally based on delivery failures.

#### WebhookV2 Object

```ts
interface WebhookV2 {
  /** Unique webhook identifier */
  id: number;

  /** The event type this webhook listens for */
  event_type: WebhookV2Event;

  /** Scoping context: "team", "project", or "file" */
  context: 'team' | 'project' | 'file';

  /** ID of the context (team ID, project ID, or file key) */
  context_id: string;

  /** Team subscription ID (empty string for project/file webhooks) */
  team_id: string;

  /** Team/organization plan API ID */
  plan_api_id: string;

  /** Current webhook status */
  status: 'ACTIVE' | 'PAUSED';

  /** OAuth application identifier (if created via OAuth) */
  client_id: string;

  /** Security passcode (empty in GET responses for security) */
  passcode: string;

  /** Target URL for webhook event delivery */
  endpoint: string;

  /** Optional user-provided description (max 140 characters) */
  description: string;
}
```

---

### Webhook Endpoints

All webhook endpoints use the `/v2/` prefix (unlike most Figma API endpoints which use `/v1/`).

**Authentication:** All endpoints require a Figma API token (PAT or OAuth) with the appropriate scope.

| Operation | Scope Required |
|-----------|---------------|
| Read webhooks | `webhooks:read` |
| Create / Update / Delete | `webhooks:write` |

**Rate limit tier:** All webhook endpoints are Tier 2.

#### POST /v2/webhooks — Create Webhook

Creates a new webhook subscription. On success, Figma immediately sends a `PING` event to the endpoint (unless `status` is set to `PAUSED`).

```bash
curl -X POST \
  -H "X-Figma-Token: YOUR_FIGMA_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "event_type": "FILE_UPDATE",
    "context": "team",
    "context_id": "123456",
    "endpoint": "https://your-server.com/figma-webhook",
    "passcode": "YOUR_WEBHOOK_PASSCODE"
  }' \
  "https://api.figma.com/v2/webhooks"
```

**Request body fields:**

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `event_type` | string | Yes | Event type to subscribe to (see Event Types section) |
| `context` | string | Yes | `"team"`, `"project"`, or `"file"` |
| `context_id` | string | Yes | The ID of the team, project, or file |
| `endpoint` | string | Yes | URL to receive webhook payloads (max 2048 characters) |
| `passcode` | string | Yes | Secret passcode echoed back in payloads for verification (max 100 characters) |
| `status` | string | No | Initial status: `"ACTIVE"` (default) or `"PAUSED"` |
| `description` | string | No | Human-readable description (max 150 characters) |

**Response:** Returns the created `WebhookV2` object.

> **Important:** The endpoint must be ready to receive and acknowledge the `PING` event before or immediately after creation. If the PING fails, the webhook is still created but may be in a degraded state.

#### GET /v2/webhooks/:webhook_id — Get Webhook

Retrieves a single webhook by ID.

```bash
curl -H "X-Figma-Token: YOUR_FIGMA_TOKEN" \
  "https://api.figma.com/v2/webhooks/WEBHOOK_ID"
```

**Response:** Returns the `WebhookV2` object (with `passcode` as empty string for security).

#### GET /v2/webhooks — List Webhooks

Lists webhooks with optional filtering by context.

```bash
# List all webhooks for a team
curl -H "X-Figma-Token: YOUR_FIGMA_TOKEN" \
  "https://api.figma.com/v2/webhooks?context=team&context_id=123456"

# List all webhooks for a file
curl -H "X-Figma-Token: YOUR_FIGMA_TOKEN" \
  "https://api.figma.com/v2/webhooks?context=file&context_id=FILE_KEY"
```

**Query parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `context` | string | Filter by context type (`"team"`, `"project"`, `"file"`) |
| `context_id` | string | Filter by context ID (used with `context`) |
| `plan_api_id` | string | Filter by plan API ID (cannot combine with `context`/`context_id`) |
| `cursor` | string | Pagination cursor from a previous response |

**Response:**

```ts
interface ListWebhooksResponse {
  webhooks: WebhookV2[];
  pagination: {
    next_page?: string;
    prev_page?: string;
  };
}
```

> **Note:** The deprecated `GET /v2/teams/:team_id/webhooks` endpoint is replaced by `GET /v2/webhooks?context=team&context_id=TEAM_ID`.

#### PUT /v2/webhooks/:webhook_id — Update Webhook

Updates an existing webhook. Only include the fields you want to change.

```bash
curl -X PUT \
  -H "X-Figma-Token: YOUR_FIGMA_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "event_type": "FILE_VERSION_UPDATE",
    "status": "PAUSED"
  }' \
  "https://api.figma.com/v2/webhooks/WEBHOOK_ID"
```

**Updatable fields:**

| Field | Type | Description |
|-------|------|-------------|
| `event_type` | string | Change the event type |
| `endpoint` | string | Change the delivery URL |
| `passcode` | string | Change the verification passcode |
| `status` | string | `"ACTIVE"` or `"PAUSED"` (cannot set to error state) |
| `description` | string | Change the description |

**Response:** Returns the updated `WebhookV2` object.

#### DELETE /v2/webhooks/:webhook_id — Delete Webhook

Permanently deletes a webhook. This operation is irreversible.

```bash
curl -X DELETE \
  -H "X-Figma-Token: YOUR_FIGMA_TOKEN" \
  "https://api.figma.com/v2/webhooks/WEBHOOK_ID"
```

**Response:** Returns the deleted `WebhookV2` object.

#### GET /v2/webhooks/:webhook_id/requests — Debug Webhook Activity

Retrieves the delivery history for a webhook from the last 7 days. Useful for debugging delivery issues.

```bash
curl -H "X-Figma-Token: YOUR_FIGMA_TOKEN" \
  "https://api.figma.com/v2/webhooks/WEBHOOK_ID/requests"
```

---

### Event Types

Each webhook subscribes to exactly one event type. To listen for multiple event types, create multiple webhooks.

#### PING

Sent automatically when a webhook is created (unless created with `status: "PAUSED"`). Used to verify that your endpoint is configured correctly.

**Payload:**

```json
{
  "event_type": "PING",
  "passcode": "YOUR_WEBHOOK_PASSCODE",
  "timestamp": "2026-01-15T10:30:00Z",
  "webhook_id": 12345
}
```

> **Important:** The PING event does NOT include `file_key` or `file_name`. It is the only event type with this minimal payload structure.

#### FILE_UPDATE

Triggers within **30 minutes of editing inactivity** in a file. This is a debounced event — it does not fire on every keystroke or edit, but after the file has been idle for a period.

**Payload:**

```json
{
  "event_type": "FILE_UPDATE",
  "file_key": "abc123DEF456",
  "file_name": "Design System v2",
  "passcode": "YOUR_WEBHOOK_PASSCODE",
  "timestamp": "2026-01-15T10:30:00Z",
  "webhook_id": 12345
}
```

#### FILE_DELETE

Triggers when a file is deleted. Does NOT trigger for files within deleted folders — only for directly deleted files.

**Payload:**

```json
{
  "event_type": "FILE_DELETE",
  "file_key": "abc123DEF456",
  "file_name": "Deleted Design",
  "passcode": "YOUR_WEBHOOK_PASSCODE",
  "timestamp": "2026-01-15T10:30:00Z",
  "triggered_by": {
    "id": "12345",
    "handle": "designer@example.com"
  },
  "webhook_id": 12345
}
```

#### FILE_VERSION_UPDATE

Triggers when a user creates a named version in the file's version history.

**Payload:**

```json
{
  "event_type": "FILE_VERSION_UPDATE",
  "file_key": "abc123DEF456",
  "file_name": "Design System v2",
  "created_at": "2026-01-15T10:30:00Z",
  "version_id": "987654321",
  "label": "v2.1 Release",
  "description": "Updated button variants and color tokens",
  "passcode": "YOUR_WEBHOOK_PASSCODE",
  "timestamp": "2026-01-15T10:30:00Z",
  "triggered_by": {
    "id": "12345",
    "handle": "designer@example.com"
  },
  "webhook_id": 12345
}
```

#### FILE_COMMENT

Triggers when a user posts a comment on a file.

**Payload:**

```json
{
  "event_type": "FILE_COMMENT",
  "file_key": "abc123DEF456",
  "file_name": "Design System v2",
  "comment": [
    { "text": "Can we update the " },
    { "mention": "67890" },
    { "text": " color here?" }
  ],
  "comment_id": 1001,
  "mentions": [
    { "id": "67890", "handle": "dev@example.com" }
  ],
  "order_id": 5,
  "parent_id": null,
  "created_at": "2026-01-15T10:30:00Z",
  "resolved_at": null,
  "passcode": "YOUR_WEBHOOK_PASSCODE",
  "timestamp": "2026-01-15T10:30:00Z",
  "triggered_by": {
    "id": "12345",
    "handle": "designer@example.com"
  },
  "webhook_id": 12345
}
```

**Comment-specific fields:**

| Field | Type | Description |
|-------|------|-------------|
| `comment` | CommentFragment[] | Array of text and mention fragments |
| `comment_id` | number | Unique comment identifier |
| `mentions` | User[] | Array of mentioned users |
| `order_id` | number | Top-level comment display number |
| `parent_id` | number or null | Parent comment ID if this is a reply |
| `created_at` | string | Comment creation timestamp |
| `resolved_at` | string or null | When the comment was resolved (null if unresolved) |

#### LIBRARY_PUBLISH

Triggers when a library file is published. Large publications may generate multiple events split by asset type.

**Payload:**

```json
{
  "event_type": "LIBRARY_PUBLISH",
  "file_key": "abc123DEF456",
  "file_name": "Design System v2",
  "description": "Added new icon set and updated color tokens",
  "created_components": [
    { "key": "comp:abc", "name": "Icon/Arrow" }
  ],
  "created_styles": [],
  "created_variables": [
    { "key": "var:def", "name": "color/accent" }
  ],
  "modified_components": [
    { "key": "comp:xyz", "name": "Button/Primary" }
  ],
  "modified_styles": [
    { "key": "style:123", "name": "Heading/H1" }
  ],
  "modified_variables": [],
  "deleted_components": [],
  "deleted_styles": [],
  "deleted_variables": [],
  "passcode": "YOUR_WEBHOOK_PASSCODE",
  "timestamp": "2026-01-15T10:30:00Z",
  "triggered_by": {
    "id": "12345",
    "handle": "designer@example.com"
  },
  "webhook_id": 12345
}
```

**Library item data:**

```ts
interface LibraryItemData {
  key: string;   // Unique key for the library item
  name: string;  // Display name
}
```

The `created_*`, `modified_*`, and `deleted_*` arrays provide granular detail about what changed in the library publish, including components, styles, and variables.

#### DEV_MODE_STATUS_UPDATE

Triggers when the Dev Mode status changes for a layer in a file (e.g., marked as "Ready for Dev" or "Completed").

**Payload:**

```json
{
  "event_type": "DEV_MODE_STATUS_UPDATE",
  "file_key": "abc123DEF456",
  "node_id": "1:234",
  "status": "READY_FOR_DEV",
  "change_message": "Header component ready for implementation",
  "related_links": [
    {
      "id": "dev-resource-id",
      "name": "React Component",
      "url": "https://github.com/org/repo/blob/main/src/Header.tsx",
      "file_key": "abc123DEF456",
      "node_id": "1:234"
    }
  ],
  "passcode": "YOUR_WEBHOOK_PASSCODE",
  "timestamp": "2026-01-15T10:30:00Z",
  "triggered_by": {
    "id": "12345",
    "handle": "designer@example.com"
  },
  "webhook_id": 12345
}
```

**Status values:** `NONE`, `READY_FOR_DEV`, `COMPLETED`

#### Common Payload Fields

Every webhook payload includes these fields:

| Field | Type | Present in | Description |
|-------|------|-----------|-------------|
| `event_type` | string | All events | The event type identifier |
| `passcode` | string | All events | The passcode you provided at webhook creation (for verification) |
| `timestamp` | string | All events | UTC ISO 8601 timestamp of the event |
| `webhook_id` | number | All events | The webhook ID that generated this event |
| `file_key` | string | All except PING | The file key that triggered the event |
| `file_name` | string | All except PING and DEV_MODE_STATUS_UPDATE | The file name |
| `triggered_by` | User | All except PING and FILE_UPDATE | The user who triggered the event |

---

### Operational Considerations

#### Passcode Verification

Every webhook payload includes the `passcode` field, which echoes back the secret you provided when creating the webhook. **Always verify this passcode** to confirm the request originated from Figma.

```ts
function verifyWebhookPasscode(
  payload: Record<string, any>,
  expectedPasscode: string
): boolean {
  return payload.passcode === expectedPasscode;
}
```

> **Warning:** The passcode is NOT a cryptographic signature. It is a shared secret sent in the request body. Always use HTTPS for your webhook endpoint to protect the passcode in transit.

#### Response Requirements

Your webhook endpoint must respond with a **200 OK** status code **quickly** (ideally within a few seconds). Figma interprets slow responses or non-200 status codes as failures and will initiate retry logic.

**Best practice:** Accept the webhook payload, return 200 immediately, then process the event asynchronously:

```ts
// Good: Respond immediately, process later
app.post('/figma-webhook', (req, res) => {
  res.status(200).send('OK');
  processEventAsync(req.body); // Fire-and-forget
});

// Bad: Process synchronously before responding
app.post('/figma-webhook', async (req, res) => {
  await heavyProcessing(req.body); // May timeout
  res.status(200).send('OK');
});
```

#### Retry Behavior

When Figma fails to deliver a webhook event (non-200 response or timeout), it retries with **exponential backoff**:

| Retry | Delay after failure |
|:-----:|:-------------------:|
| 1st | 5 minutes |
| 2nd | 30 minutes |
| 3rd | 3 hours |

After **3 failed retries**, the delivery is abandoned for that event. Figma does not retry further for that specific event.

#### Idempotency

The same event may be delivered more than once (e.g., if your server responded slowly and Figma retried). **Always handle webhook events idempotently:**

- Use `webhook_id` + `timestamp` + `event_type` as a deduplication key
- Track processed event identifiers in a store (database, Redis, etc.)
- Ensure that processing the same event twice produces the same result

```ts
const processedEvents = new Set<string>();

function handleWebhookEvent(payload: Record<string, any>): boolean {
  const eventKey = `${payload.webhook_id}:${payload.event_type}:${payload.timestamp}`;

  if (processedEvents.has(eventKey)) {
    return false; // Already processed — skip
  }

  processedEvents.add(eventKey);
  return true; // Process this event
}
```

> **Note:** In production, use a persistent store (database or cache with TTL) instead of an in-memory Set to survive server restarts.

#### Webhook Health and Disabling

Figma monitors webhook delivery success. After repeated delivery failures, Figma may internally flag the webhook. Use the requests endpoint to debug:

```bash
# Check delivery history for the last 7 days
curl -H "X-Figma-Token: YOUR_FIGMA_TOKEN" \
  "https://api.figma.com/v2/webhooks/WEBHOOK_ID/requests"
```

If a webhook becomes unreliable:
1. Check the requests endpoint for error details
2. Fix the endpoint issue
3. If paused, update the webhook status back to `ACTIVE`

#### Team Context Notification Scope

Team-scoped webhooks receive events for:
- Files available to all team members
- Files in view-only projects

Team-scoped webhooks do **NOT** receive events for:
- Files in invite-only projects (use project-scoped or file-scoped webhooks for these)

---

### Practical Patterns

#### Setting Up a Webhook Listener (Express)

```ts
import express from 'express';

const app = express();
app.use(express.json());

const WEBHOOK_PASSCODE = process.env.FIGMA_WEBHOOK_PASSCODE!;

app.post('/figma-webhook', (req, res) => {
  const payload = req.body;

  // 1. Verify passcode
  if (payload.passcode !== WEBHOOK_PASSCODE) {
    console.warn('Invalid webhook passcode — rejecting request');
    res.status(401).send('Unauthorized');
    return;
  }

  // 2. Respond immediately
  res.status(200).send('OK');

  // 3. Handle event asynchronously
  handleFigmaEvent(payload).catch(err => {
    console.error('Webhook processing error:', err);
  });
});

async function handleFigmaEvent(payload: Record<string, any>): Promise<void> {
  switch (payload.event_type) {
    case 'PING':
      console.log('Webhook verified:', payload.webhook_id);
      break;

    case 'FILE_UPDATE':
      console.log(`File updated: ${payload.file_name} (${payload.file_key})`);
      await syncFileChanges(payload.file_key);
      break;

    case 'FILE_VERSION_UPDATE':
      console.log(`New version: ${payload.label} for ${payload.file_name}`);
      await processNewVersion(payload.file_key, payload.version_id);
      break;

    case 'LIBRARY_PUBLISH':
      console.log(`Library published: ${payload.file_name}`);
      await syncLibraryChanges(payload);
      break;

    case 'FILE_COMMENT':
      console.log(`Comment on ${payload.file_name} by ${payload.triggered_by.handle}`);
      await notifyTeam(payload);
      break;

    case 'FILE_DELETE':
      console.log(`File deleted: ${payload.file_name}`);
      await handleFileDeletion(payload.file_key);
      break;

    case 'DEV_MODE_STATUS_UPDATE':
      console.log(`Dev status changed: ${payload.status} for node ${payload.node_id}`);
      await handleDevStatusChange(payload);
      break;

    default:
      console.warn('Unknown event type:', payload.event_type);
  }
}

app.listen(3000, () => console.log('Webhook listener running on port 3000'));
```

#### Setting Up a Webhook Listener (Next.js API Route)

```ts
// app/api/figma-webhook/route.ts
import { NextRequest, NextResponse } from 'next/server';

const WEBHOOK_PASSCODE = process.env.FIGMA_WEBHOOK_PASSCODE!;

export async function POST(request: NextRequest) {
  const payload = await request.json();

  // Verify passcode
  if (payload.passcode !== WEBHOOK_PASSCODE) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Respond immediately — Next.js edge/serverless functions have timeouts
  // Queue async processing to a background job system if heavy processing needed

  switch (payload.event_type) {
    case 'PING':
      console.log('Webhook verified:', payload.webhook_id);
      break;

    case 'FILE_UPDATE':
      // Queue for background processing
      await queueJob('figma-file-sync', { fileKey: payload.file_key });
      break;

    case 'LIBRARY_PUBLISH':
      await queueJob('figma-token-sync', {
        fileKey: payload.file_key,
        createdVariables: payload.created_variables,
        modifiedVariables: payload.modified_variables,
        deletedVariables: payload.deleted_variables,
      });
      break;
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
```

#### Creating a Webhook Programmatically

```ts
async function createFigmaWebhook(options: {
  eventType: string;
  context: 'team' | 'project' | 'file';
  contextId: string;
  endpoint: string;
  passcode: string;
  description?: string;
}): Promise<WebhookV2> {
  const response = await fetch('https://api.figma.com/v2/webhooks', {
    method: 'POST',
    headers: {
      'X-Figma-Token': process.env.FIGMA_TOKEN!,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      event_type: options.eventType,
      context: options.context,
      context_id: options.contextId,
      endpoint: options.endpoint,
      passcode: options.passcode,
      description: options.description,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to create webhook: ${response.status} ${JSON.stringify(error)}`);
  }

  return response.json();
}

// Example: Listen for file updates on a team
const webhook = await createFigmaWebhook({
  eventType: 'FILE_UPDATE',
  context: 'team',
  contextId: '123456',
  endpoint: 'https://your-server.com/figma-webhook',
  passcode: process.env.FIGMA_WEBHOOK_PASSCODE!,
  description: 'Design-to-code sync trigger',
});

console.log('Webhook created:', webhook.id);
```

#### Processing FILE_UPDATE for Design-to-Code Sync

```ts
async function syncFileChanges(fileKey: string): Promise<void> {
  // 1. Fetch the latest file version
  const fileRes = await fetch(
    `https://api.figma.com/v1/files/${fileKey}?depth=2`,
    { headers: { 'X-Figma-Token': process.env.FIGMA_TOKEN! } }
  );
  const file = await fileRes.json();

  // 2. Compare with cached version
  const cachedVersion = await getStoredVersion(fileKey);
  if (file.version === cachedVersion) {
    console.log('No changes detected (same version)');
    return;
  }

  // 3. Extract updated components and tokens
  const components = findComponents(file.document);
  const tokens = await extractTokens(fileKey);

  // 4. Regenerate code for changed components
  for (const component of components) {
    await generateCode(component, tokens);
  }

  // 5. Update stored version
  await storeVersion(fileKey, file.version);
  console.log(`Synced ${components.length} components from ${file.name}`);
}
```

#### Processing LIBRARY_PUBLISH for Token Sync

```ts
async function syncLibraryChanges(payload: Record<string, any>): Promise<void> {
  const { file_key, created_variables, modified_variables, deleted_variables } = payload;

  const hasVariableChanges =
    created_variables?.length > 0 ||
    modified_variables?.length > 0 ||
    deleted_variables?.length > 0;

  if (!hasVariableChanges) {
    console.log('No variable changes in this publish — skipping token sync');
    return;
  }

  // Fetch the latest variables from the file
  const varsRes = await fetch(
    `https://api.figma.com/v1/files/${file_key}/variables/local`,
    { headers: { 'X-Figma-Token': process.env.FIGMA_TOKEN! } }
  );
  const { meta } = await varsRes.json();

  // Regenerate CSS custom properties
  const cssOutput = generateCSSVariables(meta.variables, meta.variableCollections);

  // Write to tokens file
  await writeTokensFile(cssOutput);

  console.log(`Token sync complete: ${created_variables?.length || 0} created, ` +
    `${modified_variables?.length || 0} modified, ${deleted_variables?.length || 0} deleted`);
}
```

#### Managing Webhooks Lifecycle

```ts
// List all webhooks for a team
async function listTeamWebhooks(teamId: string): Promise<WebhookV2[]> {
  const res = await fetch(
    `https://api.figma.com/v2/webhooks?context=team&context_id=${teamId}`,
    { headers: { 'X-Figma-Token': process.env.FIGMA_TOKEN! } }
  );
  const data = await res.json();
  return data.webhooks;
}

// Pause a webhook
async function pauseWebhook(webhookId: number): Promise<void> {
  await fetch(`https://api.figma.com/v2/webhooks/${webhookId}`, {
    method: 'PUT',
    headers: {
      'X-Figma-Token': process.env.FIGMA_TOKEN!,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status: 'PAUSED' }),
  });
}

// Resume a webhook
async function resumeWebhook(webhookId: number): Promise<void> {
  await fetch(`https://api.figma.com/v2/webhooks/${webhookId}`, {
    method: 'PUT',
    headers: {
      'X-Figma-Token': process.env.FIGMA_TOKEN!,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status: 'ACTIVE' }),
  });
}

// Delete a webhook
async function deleteWebhook(webhookId: number): Promise<void> {
  await fetch(`https://api.figma.com/v2/webhooks/${webhookId}`, {
    method: 'DELETE',
    headers: { 'X-Figma-Token': process.env.FIGMA_TOKEN! },
  });
}
```

---

### Error Handling

| Status | Meaning | Action |
|--------|---------|--------|
| `400` | Invalid parameters (bad context, invalid event_type, endpoint too long) | Check request body against field constraints |
| `401` | Authentication failed | Verify token and `webhooks:read` or `webhooks:write` scope |
| `403` | Insufficient permissions (not a team admin for team context, no edit access for project/file context) | Confirm appropriate permissions for the webhook context |
| `404` | Webhook not found | Verify the webhook ID exists |
| `429` | Rate limited | Use `Retry-After` header. See `figma-api-rest.md` for backoff strategy |

---

## Cross-References

- **`figma-api-rest.md`** — Core REST API reference (authentication, rate limits, file endpoints, node structure)
- **`figma-api-variables.md`** — Variables API for design tokens (consumed by LIBRARY_PUBLISH sync patterns)
- **`figma-api-plugin.md`** — Plugin API for in-editor access (alternative to webhook-triggered server-side processing)
- **`figma-api-devmode.md`** — Dev Mode and Dev Resources (DEV_MODE_STATUS_UPDATE event, Dev Resources linking)
- **`design-tokens.md`** — Token extraction strategies (used in LIBRARY_PUBLISH token sync pipelines)
