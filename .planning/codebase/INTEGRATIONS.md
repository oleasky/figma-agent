# External Integrations

**Analysis Date:** 2026-02-09

## APIs & External Services

**Figma REST API (planned - primary integration):**
- Base URL: `https://api.figma.com`
- Auth: `X-Figma-Token` header with `FIGMA_TOKEN` env var
- Key endpoints (from `agent-rewritten-01.md`):
  - `GET /v1/files/:file_key` - Full file data
  - `GET /v1/files/:file_key/nodes?ids=:node_ids` - Specific nodes
  - `GET /v1/files/:file_key/images` - Image/SVG export
  - `GET /v1/files/:file_key/variables/local` - Variables API (design tokens)
  - `POST /v2/webhooks` - Webhook management (v2 format)

**Payment Processing:**
- Not applicable

**Email/SMS:**
- Not applicable

## Data Storage

**Databases:**
- Not planned (stateless agent design)

**File Storage:**
- Output: Generated React/TSX files, CSS, design tokens (local filesystem)
- No cloud storage integration planned

**Caching:**
- Not planned yet (potential optimization for repeated API calls)

## Authentication & Identity

**Figma API Auth:**
- Personal Access Token via `FIGMA_TOKEN` env var
- Header: `X-Figma-Token: <token>`
- No OAuth flow (direct token usage)

**Webhook Verification:**
- `FIGMA_WEBHOOK_SECRET` env var for webhook signature validation
- Webhook v2 uses `context` + `context_id` (not deprecated `team_id`)

## Monitoring & Observability

**Error Tracking:**
- Not planned

**Analytics:**
- Not planned

**Logs:**
- Not planned

## CI/CD & Deployment

**Hosting:**
- Not determined

**CI Pipeline:**
- Not configured (no `.github/workflows/` or similar)

## Environment Configuration

**Development (planned):**
- Required env vars: `FIGMA_TOKEN`
- Optional env vars: `FIGMA_WEBHOOK_SECRET` (for webhook features)
- No `.env.example` file exists yet

**Production:**
- Not determined

## Webhooks & Callbacks

**Incoming (planned):**
- Figma Webhooks v2 - File change notifications
  - Events: `FILE_UPDATE`, `FILE_DELETE`, `FILE_VERSION_UPDATE`, `LIBRARY_PUBLISH`
  - Verification: Passcode validation via `FIGMA_WEBHOOK_SECRET`
  - Format: `context` + `context_id` fields (v2 format per `agent-rewritten-01.md`)

**Outgoing:**
- None planned

---

*Integration audit: 2026-02-09*
*Update when adding/removing external services*
