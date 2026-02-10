---
name: interpret-layout
description: Interpret Figma Auto Layout properties and generate correct CSS Flexbox. Use this skill when the user has Figma Auto Layout JSON data (layoutMode, sizing modes, alignment, spacing, wrap, constraints) and needs the corresponding CSS Flexbox output with accurate sizing mode handling.
---

@knowledge/design-to-code-layout.md

## Objective

Interpret Figma Auto Layout properties from node data and produce correct, production-grade CSS Flexbox. This skill handles the full pipeline: container detection, flex direction, alignment mapping, sizing modes (FIXED/HUG/FILL), gap and padding, wrap mode, min/max constraints, absolute positioning, non-Auto-Layout frames, and responsive multi-frame merging.

## Input

The user provides Figma node data as `$ARGUMENTS`. This may be:

- Raw Figma REST API JSON (a node or subtree with Auto Layout properties)
- Extracted Auto Layout properties (layoutMode, primaryAxisAlignItems, counterAxisAlignItems, itemSpacing, padding, layoutSizingHorizontal, layoutSizingVertical, layoutWrap, etc.)
- A description of the Figma Auto Layout configuration in plain language
- A screenshot or paste of Figma's design panel showing layout settings

If the input is incomplete, ask the user for the missing properties before generating CSS. At minimum you need: `layoutMode`, child sizing modes, and spacing.

## Process

Follow these steps in order. Consult `knowledge/design-to-code-layout.md` for all mapping tables and edge cases.

### Step 1: Detect Container Type

- Check if the node has `layoutMode` set to `HORIZONTAL` or `VERTICAL` (Auto Layout container).
- If `layoutMode` is `NONE` or absent, treat as non-Auto-Layout frame. Use absolute positioning with constraints (see Section 7 of the layout knowledge module).
- If the node is a `GROUP`, use absolute positioning with coordinate adjustment (subtract group position for child coordinates).

### Step 2: Map Container Properties

For Auto Layout containers, generate the base flex properties:

- `layoutMode: HORIZONTAL` -> `display: flex; flex-direction: row;`
- `layoutMode: VERTICAL` -> `display: flex; flex-direction: column;`
- `primaryAxisAlignItems` -> `justify-content` (MIN/CENTER/MAX/SPACE_BETWEEN)
- `counterAxisAlignItems` -> `align-items` (MIN/CENTER/MAX/BASELINE)
- Container sizing: `primaryAxisSizingMode` and `counterAxisSizingMode` determine if the container itself has explicit dimensions or hugs content.

### Step 3: Map Gap and Padding

- `itemSpacing` -> CSS `gap` (NOT padding -- this is spacing BETWEEN children)
- `counterAxisSpacing` -> only applies when `layoutWrap: WRAP`. Maps to `row-gap` or `column-gap` depending on direction.
- When both primary and counter gaps are equal, use `gap` shorthand. When different, use separate `row-gap` and `column-gap`.
- `paddingTop/Right/Bottom/Left` -> CSS `padding` with shorthand optimization.
- If any spacing or padding value has a variable binding, generate `var()` reference. External library variables get pixel fallbacks.

### Step 4: Handle Sizing Modes (CRITICAL)

This is the most error-prone step. For EACH child in the Auto Layout parent:

1. Determine which axis is PRIMARY (same as parent flex-direction) and which is COUNTER.
   - Parent `HORIZONTAL` -> horizontal = primary, vertical = counter
   - Parent `VERTICAL` -> vertical = primary, horizontal = counter

2. PRIMARY AXIS sizing:
   - `FILL` -> `flex-grow: 1; flex-basis: 0;` (BOTH required -- never omit `flex-basis: 0`)
   - `FIXED` -> `flex-shrink: 0;` + explicit dimension from bounds
   - `HUG` -> omit sizing CSS, let content determine size

3. COUNTER AXIS sizing:
   - `FILL` -> `align-self: stretch;`
   - `FILL` + max constraint on counter dimension -> `width: 100%` / `height: 100%` + `max-width`/`max-height` (NOT `align-self: stretch`)
   - `FIXED` -> explicit dimension from bounds
   - `HUG` -> omit, let content determine size

4. Check for `layoutAlign` overrides on individual children -> `align-self`

### Step 5: Handle Wrap Mode

- `layoutWrap: WRAP` -> `flex-wrap: wrap;`
- `counterAxisAlignContent` -> `align-content` (AUTO -> `flex-start`, SPACE_BETWEEN -> `space-between`)
- Counter axis gap becomes relevant only in wrap mode.

### Step 6: Handle Min/Max Constraints

- `minWidth` (if > 0) -> `min-width`
- `maxWidth` (if < Infinity) -> `max-width`
- `minHeight` (if > 0) -> `min-height`
- `maxHeight` (if < Infinity) -> `max-height`
- These apply to both containers and children.

### Step 7: Handle Absolute Children

- If any child has `layoutPositioning: ABSOLUTE`, add `position: relative` to the parent.
- Absolute children get `position: absolute` with offset values from constraints.
- These children do not participate in flex flow or gap distribution.

### Step 8: Responsive Multi-Frame (if applicable)

If multiple frames represent breakpoints (detected via `#mobile`/`#tablet`/`#desktop` suffix or variant properties):

- Smallest frame provides base styles (no media query).
- Larger frames contribute override styles in `@media (min-width: ...)` blocks.
- Only emit properties that differ from the base.
- Reset layout properties (`align-self: auto`, `flex-grow: 0`, `flex-shrink: 1`, `flex-basis: auto`) when they exist in base but not in the larger breakpoint.
- Transform fixed pixel widths in responsive overrides to `width: 100%; max-width: Npx` for fluid behavior.

## Output

Generate CSS with explanatory comments showing the Figma-to-CSS mapping:

```css
/* Container: layoutMode=HORIZONTAL, primaryAxis=SPACE_BETWEEN, counterAxis=CENTER */
.component-name {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  gap: 16px;              /* itemSpacing: 16 */
  padding: 24px 16px;     /* paddingTop/Bottom: 24, paddingLeft/Right: 16 */
}

/* Child: sizingH=FILL (primary), sizingV=HUG (counter) */
.component-name__content {
  flex-grow: 1;
  flex-basis: 0;
}

/* Child: sizingH=FIXED (primary, 200px), sizingV=FILL (counter) */
.component-name__sidebar {
  width: 200px;
  flex-shrink: 0;
  align-self: stretch;
}
```

When variable bindings are present, use CSS custom properties:

```css
.component-name {
  gap: var(--spacing-md);           /* Variable: spacing/md */
  padding: var(--spacing-lg, 24px); /* External variable with fallback */
}
```

### Output Checklist

Before returning CSS, verify:

- [ ] Every FILL on primary axis has BOTH `flex-grow: 1` AND `flex-basis: 0`
- [ ] STRETCH only appears on counter axis (never primary)
- [ ] `itemSpacing` maps to `gap`, not padding
- [ ] GROUP children use absolute positioning with adjusted coordinates
- [ ] FILL counter-axis + max constraint uses `width: 100%`/`height: 100%` instead of `align-self: stretch`
- [ ] Responsive overrides include layout property resets where needed
- [ ] Variable references use `var()` with fallbacks for external library variables
