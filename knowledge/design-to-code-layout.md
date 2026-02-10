# Auto Layout → CSS Flexbox Mapping

## Purpose

Authoritative reference for converting Figma Auto Layout properties to CSS Flexbox. Encodes production-proven mapping rules covering the complete pipeline: extracting Auto Layout data from Figma nodes, transforming it into intermediate types, and generating pixel-accurate CSS. This is the foundational design-to-code module that all component generation depends on.

## When to Use

Reference this module when you need to:

- Convert a Figma Auto Layout frame into CSS Flexbox (`display: flex`)
- Determine the correct CSS for Figma sizing modes (FIXED, HUG, FILL)
- Map Figma alignment properties to `justify-content` and `align-items`
- Generate gap, padding, and spacing CSS from Figma properties
- Handle flex-wrap and `align-content` for wrapped layouts
- Apply min/max constraints to flex containers and children
- Position absolute children within Auto Layout parents
- Convert non-Auto-Layout frames (GROUP, legacy FRAME) to CSS
- Build responsive CSS from multiple Figma frames representing breakpoints
- Avoid common design-to-code pitfalls (flex-basis, STRETCH, sizing interactions)

---

## Content

### 1. Auto Layout → Flexbox Core Mapping

Figma's Auto Layout maps directly to CSS Flexbox. Any FRAME, COMPONENT, or INSTANCE node with `layoutMode` set to `HORIZONTAL` or `VERTICAL` is an Auto Layout container.

#### Container Detection

Only these node types can have Auto Layout:
- `FRAME`
- `COMPONENT`
- `INSTANCE`

When `layoutMode` is `NONE`, the frame has no Auto Layout — children use absolute or constraint-based positioning (see Section 7).

#### Flex Direction

| Figma `layoutMode` | CSS `flex-direction` | Intermediate Mode |
|---------------------|----------------------|-------------------|
| `HORIZONTAL`        | `row`                | `FLEX_ROW`        |
| `VERTICAL`          | `column`             | `FLEX_COL`        |
| `NONE`              | _(no flexbox)_       | `NONE`            |

Every Auto Layout container generates:

```css
display: flex;
flex-direction: row; /* or column */
```

#### Primary Axis Alignment (justify-content)

`primaryAxisAlignItems` controls distribution along the flex direction.

| Figma `primaryAxisAlignItems` | CSS `justify-content` |
|-------------------------------|-----------------------|
| `MIN`                         | `flex-start`          |
| `CENTER`                      | `center`              |
| `MAX`                         | `flex-end`            |
| `SPACE_BETWEEN`               | `space-between`       |

#### Counter Axis Alignment (align-items)

`counterAxisAlignItems` controls alignment perpendicular to the flex direction.

| Figma `counterAxisAlignItems` | CSS `align-items` |
|-------------------------------|-------------------|
| `MIN`                         | `flex-start`      |
| `CENTER`                      | `center`          |
| `MAX`                         | `flex-end`        |
| `BASELINE`                    | `baseline`        |

> **Important:** `STRETCH` does not appear in the `counterAxisAlignItems` extraction mapping. Stretch behavior is controlled at the child level through sizing modes (FILL on the counter-axis). See Section 2 for how FILL on the counter-axis produces `align-self: stretch`.

#### Complete Container Example

A horizontal Auto Layout frame with center alignment and space-between distribution:

```
Figma properties:
  layoutMode: HORIZONTAL
  primaryAxisAlignItems: SPACE_BETWEEN
  counterAxisAlignItems: CENTER
```

```css
display: flex;
flex-direction: row;
justify-content: space-between;
align-items: center;
```

---

### 2. Sizing Modes (CRITICAL)

Sizing modes are the **most common source of bugs** in Figma-to-CSS generation. Every child in an Auto Layout container has two sizing properties:

- `layoutSizingHorizontal`: `FIXED` | `HUG` | `FILL`
- `layoutSizingVertical`: `FIXED` | `HUG` | `FILL`

These interact with the parent's flex direction. The same property (e.g., `layoutSizingHorizontal`) produces different CSS depending on whether horizontal is the **primary axis** (parent is `FLEX_ROW`) or the **counter axis** (parent is `FLEX_COL`).

#### Intermediate Types

```typescript
interface LayoutChildProperties {
  flexGrow: number;             // From layoutGrow (0 or 1)
  alignSelf: 'auto' | 'flex-start' | 'center' | 'flex-end' | 'stretch';
  sizingHorizontal: 'FIXED' | 'HUG' | 'FILL';
  sizingVertical: 'FIXED' | 'HUG' | 'FILL';
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;
}
```

#### Sizing Mode → CSS Decision Tree

```
For each child in an Auto Layout parent:

1. Determine which axis is PRIMARY (same as parent flex-direction)
   - Parent FLEX_ROW → horizontal = primary, vertical = counter
   - Parent FLEX_COL → vertical = primary, horizontal = counter

2. PRIMARY AXIS sizing:
   ├─ FILL  → flex-grow: 1; flex-basis: 0;
   ├─ FIXED → flex-shrink: 0;  (explicit width/height set separately from bounds)
   └─ HUG   → (omit — let content determine size)

3. COUNTER AXIS sizing:
   ├─ FILL  → align-self: stretch;
   │         (EXCEPTION: if child has max-width/max-height constraint,
   │          use width: 100% / height: 100% instead — see Section 2.5)
   ├─ FIXED → (explicit width/height set separately from bounds)
   └─ HUG   → (omit — let content determine size)
```

#### 2.1 FILL on Primary Axis

FILL on the primary axis means the child expands to take available space. **Both properties are required:**

```css
flex-grow: 1;
flex-basis: 0;
```

> **CRITICAL: `flex-basis: 0` is essential.** Without it, `flex-basis` defaults to `auto`, which uses the element's content size as the starting point. This causes content-heavy siblings to take disproportionately more space while empty elements (like image placeholders) get squeezed to near-zero width. Setting `flex-basis: 0` ensures all FILL children start from zero and share space equally based on their `flex-grow` factor.

**Example — two FILL children in a row:**

```
Parent: layoutMode: HORIZONTAL
Child A: layoutSizingHorizontal: FILL (lots of text content)
Child B: layoutSizingHorizontal: FILL (empty image placeholder)
```

Correct CSS:
```css
/* Both children get equal space */
.child-a { flex-grow: 1; flex-basis: 0; }
.child-b { flex-grow: 1; flex-basis: 0; }
```

Wrong CSS (without flex-basis: 0):
```css
/* Child A takes 80%+ because its content is larger */
.child-a { flex-grow: 1; }  /* BAD — flex-basis defaults to auto */
.child-b { flex-grow: 1; }  /* BAD — gets squeezed */
```

#### 2.2 FIXED on Primary Axis

FIXED means the child maintains an exact size. On the primary axis, prevent flex shrinking:

```css
flex-shrink: 0;
width: 200px;   /* or height, depending on axis */
```

The explicit dimension comes from the node's bounds (set elsewhere in generation). The `flex-shrink: 0` prevents the flex container from compressing this element below its specified size.

#### 2.3 HUG (Content-Based)

HUG means the element sizes to its content. No explicit sizing CSS is needed — the default flex behavior handles it:

```css
/* No width/height, no flex-grow, no flex-shrink override */
/* The element naturally sizes to its content */
```

#### 2.4 FILL on Counter Axis

FILL on the counter axis means the child stretches to fill the parent's cross-axis dimension:

```css
align-self: stretch;
```

**Example — column layout with horizontal FILL child:**

```
Parent: layoutMode: VERTICAL
Child: layoutSizingHorizontal: FILL
```

```css
.child {
  align-self: stretch;
}
```

#### 2.5 FILL on Counter Axis with Max Constraint (Special Case)

When a child has FILL on the counter-axis **and** a max-width or max-height constraint, using `align-self: stretch` would ignore the constraint in some cases. Instead, use percentage sizing:

```
Parent: layoutMode: HORIZONTAL (primary = horizontal)
Child: layoutSizingVertical: FILL, maxHeight: 300
```

```css
.child {
  height: 100%;
  max-height: 300px;
}
```

This allows the parent's `align-items` to position the element correctly when the max constraint caps its size (e.g., centering a capped-height element).

The rule:
- **FILL counter-axis + max constraint on counter dimension** → `width: 100%` / `height: 100%` instead of `align-self: stretch`
- **FILL counter-axis without max constraint** → `align-self: stretch`

#### 2.6 Mixed Sizing

Children within the same parent can have different sizing modes. This is valid and common:

```
Parent: layoutMode: HORIZONTAL

Child 1: sizingHorizontal: FIXED (sidebar, 280px)
Child 2: sizingHorizontal: FILL  (main content, takes remaining)
Child 3: sizingHorizontal: HUG   (icon, sizes to content)
```

```css
.sidebar { width: 280px; flex-shrink: 0; }
.main    { flex-grow: 1; flex-basis: 0; }
.icon    { /* no explicit sizing */ }
```

#### 2.7 Align Self Override

A child's `layoutAlign` property in Figma can override the parent's `counterAxisAlignItems`. This maps to `align-self`:

| Figma `layoutAlign` | CSS `align-self` |
|----------------------|------------------|
| `INHERIT`            | `auto`           |
| `MIN`                | `flex-start`     |
| `CENTER`             | `center`         |
| `MAX`                | `flex-end`       |
| `STRETCH`            | `stretch`        |

> **Note:** `align-self` is only emitted when it differs from `auto` **and** the child is not already using `width: 100%` / `height: 100%` for the FILL + max-constraint pattern. The max-constraint pattern takes precedence.

---

### 3. Gap & Spacing

#### Primary Axis Gap

`itemSpacing` sets the gap between children along the primary axis:

| Figma Property  | CSS Property |
|-----------------|--------------|
| `itemSpacing`   | `gap`        |

```
Figma: itemSpacing: 16
CSS:   gap: 16px;
```

> **Important:** `itemSpacing` is spacing **between** children, not padding around them. This maps to CSS `gap`, not `padding`.

#### Counter Axis Gap (Wrap Mode Only)

`counterAxisSpacing` sets the gap between wrapped rows/columns. It only applies when `layoutWrap: WRAP`:

| Figma Property        | CSS Property   |
|-----------------------|----------------|
| `counterAxisSpacing`  | `row-gap` or `column-gap` (depending on direction) |

#### Gap Direction Mapping

The CSS gap properties depend on the flex direction:

| Layout Mode | Primary Gap (`itemSpacing`) | Cross Gap (`counterAxisSpacing`) |
|-------------|----------------------------|----------------------------------|
| `FLEX_ROW`  | `column-gap`               | `row-gap`                        |
| `FLEX_COL`  | `row-gap`                  | `column-gap`                     |

**Shorthand optimization:** When both `row-gap` and `column-gap` are equal, use the `gap` shorthand:

```css
/* Both gaps equal → shorthand */
gap: 16px;

/* Gaps differ → individual properties */
row-gap: 8px;
column-gap: 16px;
```

#### Variable Bindings for Gap

When `itemSpacing` or `counterAxisSpacing` is bound to a Figma Variable, generate CSS `var()` references instead of raw pixel values:

```typescript
interface VariableReference {
  id: string;       // Figma variable ID
  name: string;     // Variable name path (e.g., "spacing/md")
  isLocal: boolean; // Local to this file vs. external library
}
```

**CSS generation with variables:**

```css
/* Local variable (defined in same file) — no fallback needed */
gap: var(--spacing-md);

/* External library variable — include px fallback */
gap: var(--spacing-md, 16px);
```

The variable name is converted from Figma's slash-delimited path to CSS custom property naming: `spacing/md` → `--spacing-md`.

#### Padding

Figma padding is per-side: `paddingTop`, `paddingRight`, `paddingBottom`, `paddingLeft`.

**Shorthand optimization:**

```css
/* All four sides equal */
padding: 24px;

/* Mixed sides — full longhand */
padding: 24px 16px 24px 16px;
```

**With variable bindings:**

```css
/* All four sides bound to the same variable */
padding: var(--spacing-lg);

/* Mixed — some variable-bound, some raw */
padding: var(--spacing-lg, 24px) 16px var(--spacing-lg, 24px) 16px;
```

The shorthand optimization checks both the numeric values **and** the variable IDs. All four sides must have the same value and the same variable binding (or all unbound) to use the single-value shorthand.

---

### 4. Wrap Mode

#### Enabling Wrap

| Figma Property | CSS Property    |
|----------------|-----------------|
| `layoutWrap: WRAP` | `flex-wrap: wrap` |

When `layoutWrap` is not `WRAP` (default `NO_WRAP`), no `flex-wrap` property is emitted.

#### Align Content (Wrapped Line Distribution)

When wrapping is enabled, `counterAxisAlignContent` controls how wrapped lines are distributed:

| Figma `counterAxisAlignContent` | CSS `align-content` |
|---------------------------------|---------------------|
| `AUTO`                          | `flex-start`        |
| `SPACE_BETWEEN`                 | `space-between`     |

`align-content` is only emitted when `layoutWrap: WRAP`.

#### Counter Axis Gap in Wrap Mode

`counterAxisSpacing` becomes relevant in wrap mode — it controls the spacing between wrapped rows/columns. Without wrap, `counterAxisSpacing` has no visual effect.

#### Wrap Example

```
Figma:
  layoutMode: HORIZONTAL
  layoutWrap: WRAP
  itemSpacing: 16
  counterAxisSpacing: 12
  counterAxisAlignContent: SPACE_BETWEEN
```

```css
display: flex;
flex-direction: row;
flex-wrap: wrap;
column-gap: 16px;
row-gap: 12px;
align-content: space-between;
```

---

### 5. Min/Max Constraints

Figma nodes can have min/max size constraints that map directly to CSS:

| Figma Property | CSS Property | Extraction Rule |
|----------------|--------------|-----------------|
| `minWidth`     | `min-width`  | Only if > 0     |
| `maxWidth`     | `max-width`  | Only if < Infinity |
| `minHeight`    | `min-height` | Only if > 0     |
| `maxHeight`    | `max-height` | Only if < Infinity |

Constraints apply to both containers and children. They are extracted when the value is meaningful (not zero for min, not infinity for max).

#### Container Constraints

```typescript
// Extraction: only include non-trivial values
if (frame.minWidth !== null && frame.minWidth > 0) {
  layout.minWidth = frame.minWidth;
}
if (frame.maxWidth !== null && frame.maxWidth < Infinity) {
  layout.maxWidth = frame.maxWidth;
}
```

```css
/* Container with constraints */
.card {
  display: flex;
  flex-direction: column;
  min-width: 200px;
  max-width: 600px;
}
```

#### Child Constraints

Children in Auto Layout also support min/max. Common patterns:

```css
/* FILL child with max-width — prevents over-expansion */
.content {
  flex-grow: 1;
  flex-basis: 0;
  max-width: 800px;
}

/* FILL child with min-width — prevents collapse */
.sidebar {
  flex-grow: 1;
  flex-basis: 0;
  min-width: 200px;
}
```

#### Interaction with Sizing Modes

- **FILL + max constraint**: The element grows to fill available space but caps at max. See Section 2.5 for the counter-axis special case.
- **FIXED + min constraint**: The element has a fixed size but won't go below min (relevant when `flex-shrink` allows some compression).
- **HUG + max constraint**: Content-sized but capped — useful for text containers that shouldn't exceed a reading width.

---

### 6. Absolute Position Children

Figma allows placing children with `layoutPositioning: ABSOLUTE` inside an Auto Layout parent. These children are taken out of the Auto Layout flow.

#### CSS Generation

```css
/* Auto Layout parent automatically becomes positioning context */
.parent {
  display: flex;
  flex-direction: column;
  position: relative; /* Required for absolute children */
}

/* Absolutely positioned child within Auto Layout */
.overlay {
  position: absolute;
  /* Offsets derived from constraint-based positioning */
  top: 8px;
  right: 8px;
}
```

#### Key Rules

1. **Parent needs `position: relative`**: In Figma, the Auto Layout frame is implicitly the positioning context. In CSS, you must add `position: relative` explicitly.
2. **Child is removed from flex flow**: The absolute child does not participate in flex sizing or gap distribution.
3. **Offset calculation**: The child's position within the parent is determined by its constraints (see Section 7 for constraint mapping), not by flex ordering.

---

### 7. Non-Auto-Layout Frames (GROUP, Legacy FRAME)

When a frame has `layoutMode: NONE` or the node is a `GROUP`, children are positioned using absolute coordinates and constraints.

#### GROUP Nodes

GROUP nodes have no layout mode. Their children use absolute positioning based on bounds:

```css
/* GROUP container */
.group {
  position: relative;
  overflow: hidden; /* Matches Figma's default "Clip content" */
}

/* GROUP children — absolute positioned */
.group__child {
  position: absolute;
  left: 120px;
  top: 45px;
  width: 200px;
  height: 80px;
}
```

#### Coordinate System Difference (CRITICAL for GROUPs)

Figma has different coordinate systems for FRAME vs GROUP children:

| Parent Type | Child coordinates (`x`, `y`) are relative to... |
|-------------|--------------------------------------------------|
| `FRAME`     | The frame itself (use directly)                  |
| `GROUP`     | The containing FRAME, not the group              |

For GROUP children, you must **subtract the group's position** to get coordinates relative to the group:

```typescript
const isGroupParent = parentType === 'GROUP';
const relativeX = isGroupParent && parentBounds
  ? bounds.x - parentBounds.x
  : bounds.x;
const relativeY = isGroupParent && parentBounds
  ? bounds.y - parentBounds.y
  : bounds.y;
```

#### Legacy FRAME (No Auto Layout)

A FRAME with `layoutMode: NONE` behaves like a GROUP for positioning purposes but uses frame-relative coordinates (no subtraction needed):

```css
.legacy-frame {
  position: relative;
  overflow: hidden;
}

.legacy-frame__child {
  position: absolute;
  left: 50px;
  top: 30px;
  width: 300px;
  height: 150px;
}
```

#### Constraint Mapping

Figma's constraint system positions children relative to their parent frame edges. Constraints apply when the parent resizes:

| Figma Constraint | CSS Positioning | Description |
|------------------|-----------------|-------------|
| `LEFT`           | `left: Xpx`    | Fixed distance from left edge |
| `RIGHT`          | `right: Xpx`   | Fixed distance from right edge |
| `TOP`            | `top: Xpx`     | Fixed distance from top edge |
| `BOTTOM`         | `bottom: Xpx`  | Fixed distance from bottom edge |
| `CENTER`         | Centered via `left: 50%; transform: translateX(-50%)` | Centered on axis |
| `SCALE`          | Percentage-based positioning | Scales proportionally |
| `LEFT_RIGHT`     | `left: Xpx; right: Ypx` | Stretches horizontally |
| `TOP_BOTTOM`     | `top: Xpx; bottom: Ypx` | Stretches vertically |

#### Z-Index in Non-Auto-Layout

For absolutely positioned children, later children (higher index in Figma's layer order) render on top:

```css
.child-0 { z-index: 0; }
.child-1 { z-index: 1; }
.child-2 { z-index: 2; }
```

Z-index is only set when there are multiple children.

---

### 8. Responsive Multi-Frame Pattern

Figma does not have built-in responsive breakpoints. The pattern for responsive design is to create **multiple frames** — one for each breakpoint — and merge them into unified CSS with media queries.

#### Two Approaches for Responsive Grouping

##### Approach A: #Breakpoint Suffix (Preferred)

Frames are grouped by a `#breakpoint` suffix in their name:

```
Card #mobile    → base styles (smallest)
Card #tablet    → @media (min-width: 768px)
Card #desktop   → @media (min-width: 1024px)
```

Recognized suffix patterns:
- `"Card - #desktop"` — dash separator
- `"Card #tablet"` — space separator
- `"Card(#mobile)"` — parentheses
- `"Card [#desktop]"` — brackets

The `#` prefix is the strict marker. Only `#mobile`, `#tablet`, `#desktop` are recognized (case-insensitive).

**Classification rules:**
- A valid responsive group requires **2+ frames** with the same base name and different `#breakpoint` suffixes
- Frames without `#breakpoint` suffix are treated as standalone layout frames
- Orphan variants (only one frame for a base name) are treated as standalone layout frames
- Duplicate breakpoints within the same group are treated as standalone layout frames

##### Approach B: Variant Component Detection

For COMPONENT_SET nodes, responsive variants are detected through variant properties:

**Recognized responsive property names** (case-insensitive):
- `Device`, `Breakpoint`, `Screen`, `Viewport`, `Responsive`, `Size`

**Value-to-breakpoint mapping:**

| Variant Value | Maps To    |
|---------------|------------|
| `mobile`, `phone`, `small`, `sm`, `xs` | `mobile` |
| `tablet`, `medium`, `md` | `tablet` |
| `desktop`, `large`, `lg`, `xl` | `desktop` |

Detection requires at least 2 values that map to different standard breakpoint names.

#### Standard Breakpoints (Mobile-First)

| Breakpoint | min-width | max-width | CSS |
|------------|-----------|-----------|-----|
| `mobile`   | _(base)_  | 767px     | No media query (base styles) |
| `tablet`   | 768px     | 1023px    | `@media (min-width: 768px)` |
| `desktop`  | 1024px    | _(none)_  | `@media (min-width: 1024px)` |

Breakpoint detection also falls back to frame dimensions:
- Width < 768px → mobile
- Width 768–1023px → tablet
- Width >= 1024px → desktop

#### Mobile-First CSS Generation

The smallest frame provides **base styles** (no media query). Larger frames contribute **override styles** wrapped in `@media (min-width: ...)` blocks:

```css
/* Base styles from mobile frame */
.card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
}

.card__title {
  font-size: 18px;
}

/* Tablet overrides — only properties that differ */
@media (min-width: 768px) {
  .card {
    flex-direction: row;
    gap: 24px;
    padding: 24px;
  }
  .card__title {
    font-size: 22px;
  }
}

/* Desktop overrides — only properties that differ from base */
@media (min-width: 1024px) {
  .card {
    gap: 32px;
    padding: 32px;
  }
  .card__title {
    font-size: 28px;
  }
}
```

#### BEM Suffix Matching

Elements are matched across breakpoint frames using **BEM class suffix matching**. The BEM block name differs between frames (e.g., `.card---mobile` vs `.card---desktop`), but the element/modifier suffix is identical for elements at the same position:

```
Mobile frame:   .card---mobile           → suffix: ""        (root)
                .card---mobile__title    → suffix: "__title"
                .card---mobile__body     → suffix: "__body"

Desktop frame:  .card---desktop          → suffix: ""        (root)
                .card---desktop__title   → suffix: "__title"
                .card---desktop__body    → suffix: "__body"
```

Matching by suffix: `""` matches `""`, `"__title"` matches `"__title"`, etc.

After matching, selectors are remapped to a unified component class: `.card---mobile__title` and `.card---desktop__title` both become `.card__title` in the output.

#### Style Diffing and Overrides

Only **changed properties** are emitted in media query blocks. The diff algorithm:

1. Compare each property in the larger breakpoint against the base
2. Include properties that are new or have different values
3. **Reset layout properties** that exist in base but not in the larger breakpoint

Layout properties that need explicit resets to prevent cascade leaking:

| Property      | Reset Value |
|---------------|-------------|
| `align-self`  | `auto`      |
| `flex-grow`   | `0`         |
| `flex-shrink` | `1`         |
| `flex-basis`  | `auto`      |

**Example of reset:**

```css
/* Mobile base: column layout, child stretches */
.card__image {
  align-self: stretch;
  flex-grow: 1;
  flex-basis: 0;
}

/* Desktop: row layout, child is fixed — must reset mobile layout props */
@media (min-width: 1024px) {
  .card__image {
    width: 100%;
    max-width: 277px;
    align-self: auto;     /* Reset — no longer stretching */
    flex-grow: 0;         /* Reset — no longer filling */
    flex-shrink: 1;       /* Reset — back to default */
    flex-basis: auto;     /* Reset — back to default */
  }
}
```

#### Responsive Width Transformation

Fixed pixel widths in responsive overrides are transformed to a fluid pattern to prevent overflow at intermediate viewport widths:

```css
/* Before transformation */
.card__sidebar {
  width: 277px;
}

/* After transformation — fluid with cap */
.card__sidebar {
  width: 100%;
  max-width: 277px;
}
```

This only applies to responsive override styles (not base styles) and only when no `max-width` is already explicitly set.

---

### 9. Common Pitfalls & Edge Cases

#### Pitfall: Missing `flex-basis: 0` for FILL Items

**Problem:** Without `flex-basis: 0`, FILL children distribute space based on content size, not equally.

**Rule:** FILL on primary axis always requires both `flex-grow: 1` AND `flex-basis: 0`.

```css
/* CORRECT */
.fill-child { flex-grow: 1; flex-basis: 0; }

/* WRONG — content-based distribution */
.fill-child { flex-grow: 1; }
```

#### Pitfall: STRETCH Only Exists on Counter Axis

**Problem:** Trying to apply STRETCH behavior on the primary axis.

**Rule:** `STRETCH` / `align-self: stretch` only affects the **counter axis**. On the primary axis, expanding behavior is achieved through FILL (`flex-grow: 1; flex-basis: 0`), not stretch.

#### Pitfall: `itemSpacing` Is Not Padding

**Problem:** Confusing `itemSpacing` (gap between children) with `padding` (space around children).

**Rule:** `itemSpacing` → CSS `gap`. Padding uses the separate `paddingTop/Right/Bottom/Left` properties.

#### Pitfall: GROUP Nodes Have No Layout Mode

**Problem:** Treating GROUP children as flex items.

**Rule:** GROUP nodes never have Auto Layout. All GROUP children must use `position: absolute` with coordinates adjusted for the GROUP's coordinate system (subtract parent position).

#### Pitfall: "Auto" in Figma UI Means HUG, Not FILL

**Problem:** When Figma's UI shows "Auto" for width/height, it maps to `HUG` (content-based sizing), not `FILL` (expand to fill).

**Rule:** "Auto" in the Figma UI → `layoutSizingHorizontal: HUG` or `layoutSizingVertical: HUG`. FILL is shown as "Fill container" in the UI.

#### Pitfall: Layout Property Cascade Leaking

**Problem:** In responsive CSS, mobile base styles for `flex-grow`, `flex-basis`, `align-self`, and `flex-shrink` leak into larger breakpoints via the cascade when the desktop layout no longer uses those properties.

**Rule:** When a layout property exists in the base breakpoint but not in a larger breakpoint, explicitly reset it. See Section 8 for the reset values.

#### Edge Case: FILL Counter-Axis + Max Constraint

When a child has FILL on the counter-axis and a max-width/max-height constraint, use `width: 100%` / `height: 100%` instead of `align-self: stretch`. This preserves the parent's ability to position the element with `align-items` when the constraint caps its size. See Section 2.5.

#### Edge Case: Container primaryAxisSizing and counterAxisSizing

The Auto Layout container itself has sizing modes for its own dimensions:

| Property | Value | Meaning |
|----------|-------|---------|
| `primaryAxisSizingMode` | `FIXED` | Container has explicit size on primary axis |
| `primaryAxisSizingMode` | `AUTO` | Container hugs its content on primary axis |
| `counterAxisSizingMode` | `FIXED` | Container has explicit size on counter axis |
| `counterAxisSizingMode` | `AUTO` | Container hugs its content on counter axis |

These determine whether the container itself gets an explicit width/height or sizes to content. They are separate from the child-level `layoutSizingHorizontal`/`layoutSizingVertical` properties.

#### Edge Case: Variable Fallback Strategy

When a Figma Variable is from an **external library** (not local to the file), include a pixel fallback in the `var()` expression:

```css
/* Local variable — no fallback */
gap: var(--spacing-md);

/* External library variable — include fallback */
gap: var(--spacing-md, 16px);
```

This ensures the CSS works even if the variable definition is not available in the consuming project.

---

### Intermediate Type Reference

The complete intermediate types used between extraction and generation:

```typescript
interface LayoutProperties {
  mode: 'NONE' | 'FLEX_ROW' | 'FLEX_COL' | 'GRID';
  primaryAxisSizing: 'FIXED' | 'AUTO';
  counterAxisSizing: 'FIXED' | 'AUTO';
  justify: 'flex-start' | 'flex-end' | 'center' | 'space-between';
  align: 'flex-start' | 'flex-end' | 'center' | 'baseline' | 'stretch';
  gap: number;
  gapVariable?: VariableReference;
  counterAxisGap?: number;
  counterAxisGapVariable?: VariableReference;
  padding: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  paddingVariables?: {
    top?: VariableReference;
    right?: VariableReference;
    bottom?: VariableReference;
    left?: VariableReference;
  };
  wrap: boolean;
  wrapAlign?: 'flex-start' | 'space-between';
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;
}

interface LayoutChildProperties {
  flexGrow: number;
  alignSelf: 'auto' | 'flex-start' | 'center' | 'flex-end' | 'stretch';
  sizingHorizontal: 'FIXED' | 'HUG' | 'FILL';
  sizingVertical: 'FIXED' | 'HUG' | 'FILL';
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;
}

interface VariableReference {
  id: string;
  name: string;
  isLocal: boolean;
}
```

---

## Cross-References

- **`figma-api-rest.md`** — Node tree structure, `absoluteBoundingBox` for bounds, file/node fetching for accessing layout data via REST API
- **`figma-api-plugin.md`** — SceneNode types (FrameNode, ComponentNode, InstanceNode, GroupNode), LayoutMixin properties (`layoutMode`, `layoutSizingHorizontal`, `layoutAlign`, `itemSpacing`, etc.), plugin sandbox model for extraction code
- **`figma-api-variables.md`** — Variables API for resolving `boundVariables` references, variable collections, modes, and the `figma.variables.getVariableByIdAsync()` method used in extraction
- **`design-to-code-visual.md`** — Visual properties (fills, strokes, effects) that combine with layout for complete component CSS; visual and layout styles are generated independently and merged
- **`design-to-code-typography.md`** — Text properties that interact with sizing modes (text auto-resize vs layout sizing), vertical alignment requiring flex, styled segments
- **`design-to-code-assets.md`** — Vector container detection interacts with Auto Layout detection (Auto Layout overrides vector container), asset nodes skip layout child sizing
- **`design-to-code-semantic.md`** — BEM naming conventions used in responsive matching and class generation, semantic tag selection that consumes layout context
- **`css-strategy.md`** — Layered CSS approach (Tailwind for layout bones, CSS Modules for visual skin) that consumes layout CSS output. Property placement decision tree for layout properties (Layer 1).
