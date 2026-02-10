---
name: audit-plugin
description: Audit Figma plugin code against production best practices. Use this skill when the user has a Figma plugin codebase and wants a quality review covering error handling, performance, memory management, caching, async patterns, testing, and distribution readiness.
---

@knowledge/plugin-architecture.md
@knowledge/plugin-codegen.md
@knowledge/plugin-best-practices.md
@knowledge/figma-api-plugin.md

## Objective

Audit a Figma plugin codebase against 7 production best practice categories, plus codegen-specific checks and architectural pattern verification. Read the actual source files, identify concrete issues with code references, rate each section (pass/warn/fail), and provide actionable recommendations with fix examples. This is NOT generic advice -- every finding must reference specific code in the plugin.

## Input

The user provides plugin source code as `$ARGUMENTS`. This may be:

- **File paths** to plugin source files (manifest, main thread code, UI code, utilities)
- **Directory path** to the plugin project root
- **Description** of the plugin's purpose and architecture, with key file contents
- **Specific concern** to focus the audit on (e.g., "check my async patterns" or "review error handling")

If file paths are provided, read all relevant source files before starting the audit. At minimum, the audit needs:
- Manifest or `package.json` with `figma-plugin` section
- Main thread entry point (typically `src/main.ts`)
- UI entry point if it exists (typically `src/ui.tsx`)

If only a subset of files is available, audit what is provided and note which sections cannot be fully evaluated.

## Process

Read all provided source files first, then audit against each section in order. For each section, identify specific patterns (good and bad) in the code.

### Section 1: Error Handling

Consult `knowledge/plugin-best-practices.md` Section 1.

**Check for:**

- [ ] **Structured error types** -- Does the plugin define error codes (enum/const) with machine-readable codes, human-readable messages, and optional details? Or are errors thrown as raw strings?
- [ ] **Try/catch in IPC handlers** -- Is each IPC event handler (`on<Handler>(EVENT, async () => {...})`) wrapped in a single top-level try/catch? Or are there unprotected async handlers?
- [ ] **Centralized error emission** -- Is there a single `emitError()` helper that logs to console AND emits structured error data to the UI? Or are errors handled ad-hoc in each handler?
- [ ] **User-facing error messages** -- Are error messages non-technical and actionable (e.g., "Select a frame or component")? Or do they leak stack traces or technical details to users?
- [ ] **Graceful degradation** -- When processing a tree of nodes, does the plugin skip failed nodes and continue? Or does one failure abort the entire operation?
- [ ] **UI error display** -- Does the UI handle error events with recovery hints and retry options? Or do errors silently fail or show raw error objects?
- [ ] **figma.notify usage** -- Are `figma.notify()` calls used for quick user feedback (selection errors, completion messages)?

**Rating criteria:**
- **Pass**: Structured error types, centralized emission, try/catch on all handlers, graceful degradation
- **Warn**: Try/catch present but inconsistent, no structured types, some unprotected handlers
- **Fail**: No try/catch in handlers, raw error throwing, no error propagation to UI

### Section 2: Performance

Consult `knowledge/plugin-best-practices.md` Section 2.

**Check for:**

- [ ] **Progress reporting** -- For operations processing 100+ nodes, does the plugin report progress to the UI? Or does it appear frozen during long operations?
- [ ] **Pipeline timing** -- Are extraction and generation phases instrumented with timing logs? Or is there no visibility into where time is spent?
- [ ] **Depth limits** -- Is recursive tree traversal capped at a maximum depth (e.g., 30)? Or can deeply nested designs cause stack overflow?
- [ ] **Batch operations** -- Are child extractions parallelized with `Promise.all`? Are heavy I/O operations (exportAsync) done sequentially? Or is there unbounded parallelism on expensive operations?
- [ ] **Scoped traversal** -- Does the plugin scope searches to the selected subtree or current page? Or does it call `figma.root.findAll()` on the entire document?
- [ ] **Bundle size** -- Is the UI built with Preact (not React)? Are heavy libraries lazy-loaded? Is `--minify` enabled in the build?
- [ ] **Visible children filter** -- Does traversal filter out `visible: false` nodes early? Or are invisible nodes fully processed?

**Rating criteria:**
- **Pass**: Progress reporting, depth limits, pipeline timing, efficient traversal, optimized bundle
- **Warn**: Missing progress for long operations, no depth limit but no crashes observed, minor inefficiencies
- **Fail**: `figma.root.findAll()` without scoping, no depth limits, unbounded parallel exportAsync, React instead of Preact

### Section 3: Memory Management

Consult `knowledge/plugin-best-practices.md` Section 3.

**Check for:**

- [ ] **JSON-serializable intermediate format** -- Does the extraction phase produce a plain data structure (ExtractedNode-like)? Or does it try to pass Figma SceneNode objects across IPC?
- [ ] **Selective property extraction** -- Are only needed properties extracted from each node? Or is every property read regardless of usage?
- [ ] **Asset deduplication** -- Are images with the same `imageHash` exported only once? Or is the same image exported multiple times?
- [ ] **Large file safeguards** -- Are there element count warnings, depth limits, and pre-flight checks before heavy operations?
- [ ] **Cache cleanup** -- Are module-level caches cleared between extraction runs and on page changes? Or do caches grow unbounded?
- [ ] **Reference nulling** -- Are large data structures nulled out when no longer needed?

**Rating criteria:**
- **Pass**: Serializable intermediate format, selective extraction, deduplication, cache cleanup
- **Warn**: Serializable format but extracts unnecessary properties, no deduplication
- **Fail**: Passing SceneNode objects across IPC, no cache cleanup, unbounded memory growth

### Section 4: Caching

Consult `knowledge/plugin-best-practices.md` Section 4.

**Check for:**

- [ ] **Variable cache** -- Are local variable IDs loaded once and cached for the extraction run? Or is `getLocalVariablesAsync()` called repeatedly?
- [ ] **Font loading cache** -- Are already-loaded fonts tracked to avoid redundant `loadFontAsync` calls?
- [ ] **Component reference cache** -- Are component names cached to avoid repeated `getMainComponentAsync()` calls?
- [ ] **Cache invalidation** -- Are caches invalidated at appropriate times (extraction start, page change, selection change)?
- [ ] **Persistent storage** -- Are user preferences stored in `figma.clientStorage`? Is node-level metadata stored via `pluginData` where appropriate?
- [ ] **Session vs persistent separation** -- Are volatile caches (variable IDs, extracted data) kept in memory, while durable settings use clientStorage?

**Rating criteria:**
- **Pass**: Variable cache, font cache, proper invalidation, persistent settings
- **Warn**: Some caching but missing variable or font cache, manual invalidation
- **Fail**: No caching at all, repeated expensive API calls on every node

### Section 5: Async Patterns

Consult `knowledge/plugin-best-practices.md` Section 5.

**Check for:**

- [ ] **Async node access** -- Uses `getNodeByIdAsync` (not `getNodeById`)? Null-checks results?
- [ ] **Font loading before text modification** -- Calls `loadFontAsync` before setting `characters` or font properties? Handles `figma.mixed` for multi-font text?
- [ ] **exportAsync handling** -- Processes exports sequentially for heavy operations? Uses try/catch per export?
- [ ] **Timeout handling** -- Are long-running operations wrapped with timeout logic? Is there a cancellation pattern for plugin close?
- [ ] **Sequential vs parallel** -- Are read-only child extractions parallelized while I/O operations are sequential?
- [ ] **Promise rejection handling** -- Are all async handlers wrapped in try/catch? No unhandled promise rejections?

**Rating criteria:**
- **Pass**: Async-first API usage, proper font loading, timeout handling, cancellation, correct parallel/sequential choices
- **Warn**: Async APIs used but missing null checks, no timeout handling, minor parallel/sequential issues
- **Fail**: Sync API usage (getNodeById), no font loading before text modification, unhandled rejections

### Section 6: Testing

Consult `knowledge/plugin-best-practices.md` Section 6.

**Check for:**

- [ ] **Testable architecture** -- Is generation logic separated from Figma API calls? Can generation functions be tested with plain data input?
- [ ] **Mock data fixtures** -- Are there mock ExtractedNode fixtures for testing generation without the Figma runtime?
- [ ] **Unit tests for generation** -- Are pure generation functions (layout CSS, visual CSS, HTML rendering) unit tested?
- [ ] **Code validation** -- Does the plugin validate generated HTML/CSS output (tag matching, bracket matching, no JavaScript injection)?
- [ ] **Edge case coverage** -- Are edge cases handled: empty selection, zero-size frames, SLICE nodes, detached instances, mixed fonts, deeply nested groups?
- [ ] **Console logging strategy** -- Are logs prefixed by domain (`[Extraction]`, `[Generation]`, `[Export]`) with relevant data?

**Rating criteria:**
- **Pass**: Generation functions testable and tested, mock fixtures, validation, edge case handling, structured logging
- **Warn**: Architecture supports testing but few/no tests written, some edge cases missed
- **Fail**: Generation coupled to Figma API (untestable), no validation, crashes on common edge cases

### Section 7: Distribution

Consult `knowledge/plugin-best-practices.md` Section 7.

**Check for:**

- [ ] **Manifest correctness** -- Is `editorType` correct (["figma"] for standard, ["dev"] for codegen)? Is `documentAccess: "dynamic-page"` set?
- [ ] **Permission minimization** -- Are only necessary permissions declared? Most plugins need zero permissions.
- [ ] **Network access scoping** -- If `networkAccess` is declared, are domains specific (not wildcard `*`)? Is reasoning provided?
- [ ] **Version management** -- Is the version in package.json following semver? Is the version reflected in the plugin name or manifest?
- [ ] **Build configuration** -- Is `--typecheck` and `--minify` enabled in the build script?
- [ ] **Publishing metadata** -- Are name, description, icon, and cover image prepared?

**Rating criteria:**
- **Pass**: Correct manifest, minimal permissions, scoped network, semver, optimized build
- **Warn**: Correct manifest but missing optimization flags, overly broad permissions
- **Fail**: Wrong editorType, missing dynamic-page, wildcard network access without justification

### Section 8: Codegen-Specific Checks (If Applicable)

Only audit this section if the plugin is a codegen plugin (`editorType: ["dev"]`, `capabilities: ["codegen"]`).

Consult `knowledge/plugin-codegen.md`.

**Check for:**

- [ ] **3-second timeout compliance** -- Does the `generate` callback avoid network calls, heavy traversal, and unbounded operations? Is data pre-cached during `preferenceschange`?
- [ ] **Progressive complexity** -- Does the generator handle simple nodes quickly and only do heavy processing for complex nodes?
- [ ] **Language routing** -- Does the generate callback route to language-specific generators based on `event.language`?
- [ ] **CodegenResult format** -- Are results returned as an array of `{title, code, language}` with correct language constants?
- [ ] **Preferences system** -- Are user preferences (units, CSS strategy) exposed via codegen preferences?
- [ ] **Pre-caching** -- Is expensive data (component mappings, variable resolution) cached during preference changes, not during generation?

### Section 9: Architecture Checks

Consult `knowledge/plugin-architecture.md`.

**Check for:**

- [ ] **3-stage data flow** -- Is the codebase organized into extraction (Figma API) -> generation (data transformation) -> export (output assembly)?
- [ ] **IPC type safety** -- Are IPC events defined with TypeScript types? Are event names centralized as constants (not string literals)?
- [ ] **Domain separation** -- Are extraction, generation, and export in separate directories/modules? Or is everything in one file?
- [ ] **Event correlation** -- For request/response IPC patterns, are messages correlated (e.g., via IDs or specific event types)?

## Output

Generate an audit report with the following structure:

### Audit Report Format

```
# Figma Plugin Audit Report
Plugin: {plugin name}
Date: {date}
Files audited: {list of files}

## Summary
Overall: {PASS | WARN | FAIL}
{1-2 sentence summary of the plugin's quality level}

| Section | Rating | Key Finding |
|---------|--------|-------------|
| Error Handling | {PASS/WARN/FAIL} | {one-line summary} |
| Performance | {PASS/WARN/FAIL} | {one-line summary} |
| Memory Management | {PASS/WARN/FAIL} | {one-line summary} |
| Caching | {PASS/WARN/FAIL} | {one-line summary} |
| Async Patterns | {PASS/WARN/FAIL} | {one-line summary} |
| Testing | {PASS/WARN/FAIL} | {one-line summary} |
| Distribution | {PASS/WARN/FAIL} | {one-line summary} |
| Codegen (if applicable) | {PASS/WARN/FAIL} | {one-line summary} |
| Architecture | {PASS/WARN/FAIL} | {one-line summary} |

## Detailed Findings

### 1. Error Handling — {RATING}

**Good:**
- {specific finding with file:line reference}

**Issues:**
- {specific finding with file:line reference}
  - **Fix:** {concrete code suggestion}

### 2. Performance — {RATING}
... (repeat for each section)

## Priority Fixes
1. {highest priority fix — what and why}
2. {second priority fix}
3. {third priority fix}
```

### Report Rules

- **Every finding must reference a specific file and line/function** -- never say "you should add error handling" without pointing to where
- **Provide fix code examples** for WARN and FAIL findings -- show the corrected pattern, not just what is wrong
- **Acknowledge good patterns** -- call out what the plugin does well in each section
- **Priority fixes** should be ordered by impact: crashes > data loss > poor UX > code quality
- **Overall rating**: FAIL if any section is FAIL, WARN if any section is WARN and none are FAIL, PASS only if all sections pass
- If files are insufficient to evaluate a section, mark it as "INCOMPLETE" with a note on what files are needed
