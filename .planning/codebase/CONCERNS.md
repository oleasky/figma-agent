# Codebase Concerns

**Analysis Date:** 2026-02-09

## Tech Debt

**No error handling in spec code examples:**
- Issue: All fetch calls in `initial-agent.md` lack try/catch and response.ok validation
- Files: `initial-agent.md` (lines 110-115, 279-283, 313-316, 343-347, 472-476, 577-581)
- Impact: Implementing these examples as-is will cause silent failures and crashes on API errors
- Fix approach: Add comprehensive error handling in actual implementation; don't copy examples verbatim

**Unsafe nested property access:**
- Issue: Direct property access without null checks: `data.nodes[nodeId].document`, `data.meta.components`, `svgData.images[icon.nodeId]`
- Files: `initial-agent.md` (lines 115, 285, 351, 358, 584)
- Impact: Runtime crashes when API returns unexpected structure
- Fix approach: Add validation/optional chaining in implementation

**Sequential async operations instead of parallel:**
- Issue: `generateAllComponentsCode()` and `extractTypography()` use sequential `await` in loops instead of `Promise.all()`
- Files: `initial-agent.md` (lines 295-305, 351-367)
- Impact: Dramatically slower execution for large files (100 components = 100x slower)
- Fix approach: Use batched `Promise.all()` with rate limiting in implementation

## Known Bugs

**Incorrect API endpoint documentation in original spec:**
- Symptoms: `/components` and `/styles` endpoints documented as returning "all components/styles in file" but actually return only published library assets
- Files: `initial-agent.md` (lines 278-292, 312-332)
- Identified in: `initial-agent-audit.md` (lines 95-108)
- Fix: Use `/files/:key` or `/files/:key/nodes` to get all components (addressed in `agent-rewritten-01.md`)

**Outdated webhook format in original spec:**
- Symptoms: Uses deprecated `team_id` field instead of v2 `context` + `context_id`
- Files: `initial-agent.md` (lines 503-510)
- Identified in: `initial-agent-audit.md` (lines 33-56)
- Fix: Corrected in `agent-rewritten-01.md`

**Mixed plugin manifest concepts:**
- Symptoms: Codegen plugin example uses `editorType: ["figma", "figjam"]` instead of `["dev"]`
- Files: `initial-agent.md` (lines 604-610)
- Identified in: `initial-agent-audit.md` (lines 120-137)
- Fix: Corrected in `agent-rewritten-01.md`

## Security Considerations

**Environment variable usage (positive):**
- Risk: Low - specs correctly use `process.env.FIGMA_TOKEN` rather than hardcoded secrets
- Current mitigation: Proper env var pattern throughout
- Recommendations: Create `.env.example` with placeholder values when implementing

**Missing input validation:**
- Risk: File keys and node IDs from user input used directly in URL construction without validation
- Files: `initial-agent.md` (lines 24, 32, 111, 280)
- Current mitigation: None
- Recommendations: Validate format of file keys, node IDs, and URLs before API calls

## Performance Bottlenecks

**Oversimplified design-to-code generation:**
- Problem: Code examples only handle basic cases (solid fills, uniform corner radius, basic auto layout)
- Files: `initial-agent.md` (lines 142-185)
- Missing: Responsive sizing modes, gradients, per-corner radii, flex-grow, constraints, min/max sizing
- Improvement path: The corrected spec (`agent-rewritten-01.md`) documents these gaps; implementation should handle them

## Fragile Areas

**Original spec (`initial-agent.md`):**
- Why fragile: Contains multiple inaccuracies identified by audit
- Common failures: API endpoints documented incorrectly, webhook format outdated
- Safe modification: Refer to `agent-rewritten-01.md` as authoritative source
- Note: The audit (`initial-agent-audit.md`) provides a comprehensive patch list

## Dependencies at Risk

- Not applicable (no dependencies installed yet)

## Missing Critical Features

**Missing `toPascalCase()` utility:**
- Problem: Referenced in component generation code (`initial-agent.md` line 569) but never defined
- Blocks: Component naming in code generation output
- Implementation complexity: Low (simple string utility)

## Test Coverage Gaps

**No tests exist:**
- What's not tested: Everything (no test infrastructure)
- Risk: No validation of code generation output, API integration, or token extraction
- Priority: High - should be established when implementation begins
- Recommended focus areas: Style extraction accuracy, JSX generation correctness, design token format

---

*Concerns audit: 2026-02-09*
*Update as issues are fixed or new ones discovered*
