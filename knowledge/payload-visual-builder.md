# PayloadCMS Visual Builder Plugin Architecture

## Purpose

Authoritative reference for the `@eab/payload-visual-builder` plugin architecture. Documents the complete plugin system including the two-entry-point pattern (server + client), configuration API, core components (VisualBuilder, Canvas, BlockWrapper, Inspector, BlockLayers, TabbedSidebar), the edit block registry, inline editing primitives (EditableText, EditableMedia, Lexical editors), container adapter pattern for block nesting, drag-and-drop via dnd-kit, undo/redo history context, debounced save queue, keyboard shortcuts, responsive viewport preview, CSS token architecture, and the thin wrapper pattern for consuming applications. Encodes production patterns from a PayloadCMS 3.x visual page builder implementation.

## When to Use

Reference this module when you need to:

- Understand the visual builder plugin architecture and component hierarchy
- Build or extend visual editing capabilities for PayloadCMS blocks
- Add new edit block components to the registry
- Implement inline editing for new block types using EditableText, EditableMedia, or Lexical
- Work with the container adapter pattern for nested block structures
- Understand the drag-and-drop implementation across containers
- Debug the undo/redo history system or save queue behavior
- Add keyboard shortcuts or viewport preview presets
- Build a Figma-to-CMS importer that needs to understand the visual editing layer
- Customize the plugin CSS token system for a consuming application
- Mount the visual builder in a new PayloadCMS project

---

## Content

### 1. Purpose and When to Use

The `@eab/payload-visual-builder` plugin adds a canvas-based visual editing experience to PayloadCMS collections that use the blocks field type. Instead of editing blocks through Payload's default form interface, editors get a WYSIWYG-like canvas where they can:

- See blocks rendered with frontend-like styling
- Edit text and media inline (without navigating to field forms)
- Drag and drop blocks to reorder them within and across containers
- Use an inspector panel for block properties and layout controls
- Navigate the block hierarchy through a layers panel
- Preview layouts at different viewport sizes
- Undo and redo changes with full history tracking

The plugin is designed as a portable package that can be installed into any PayloadCMS 3.x project with minimal configuration. It does NOT replace Payload's built-in editing -- it provides an additional "Visual Builder" tab on document views for collections that opt in.

**Key architectural decision:** The plugin uses `useDocumentInfo()` to read initial block data and direct API calls (`PATCH /api/{collection}/{id}`) to persist changes. It deliberately avoids Payload's form state hooks to prevent re-render cascades during visual editing. This is the most important architectural decision in the entire plugin.

### 2. Plugin Architecture Overview

The plugin follows a **two-entry-point pattern** that separates server-safe code from browser-only React components.

#### Entry Points

```
@eab/payload-visual-builder
├── index.ts          → Re-exports from plugin-entry.ts
├── src/
│   ├── plugin-entry.ts  → Server entry (Node-safe, no CSS)
│   ├── client-entry.ts  → Client entry (React, CSS, browser-only)
│   ├── plugin.ts        → Plugin factory function
│   ├── types/           → Shared type definitions
│   ├── components/      → React components (client-only)
│   ├── hooks/           → React hooks (client-only)
│   ├── context/         → React contexts (client-only)
│   ├── registry/        → Block registry (client-only)
│   ├── utils/           → Utility functions (shared)
│   └── styles/          → CSS Modules + tokens (client-only)
```

#### Server Entry (`index.ts` / `plugin-entry.ts`)

The server entry is imported in `payload.config.ts`. It exports:

- `visualBuilderPlugin()` -- Plugin factory function
- `VisualBuilderPluginConfig`, `VisualBuilderFeatures`, `ResolvedVisualBuilderConfig` -- Types
- `defaultFeatures`, `resolveConfig` -- Configuration utilities
- `validatePluginConfig`, `validateCollectionsExist` -- Validation utilities

**Critical rule:** This entry must NEVER import React components or CSS files. It runs in Node.js during Payload startup.

#### Client Entry (`client-entry.ts`)

The client entry is imported in React components (browser context). It exports:

- All React components (VisualBuilder, Canvas, BlockWrapper, etc.)
- All hooks (useSaveQueue, useBlockKeyboardShortcuts, etc.)
- Registry functions (registerEditBlock, getEditBlock, etc.)
- Utility functions (createBlock, isContainer, findBlockById, etc.)
- Style utilities (cn, getCSSVar, setCSSVar, tokens, etc.)
- Type re-exports for consumer convenience

**Usage pattern:**
```typescript
// In payload.config.ts (server)
import { visualBuilderPlugin } from '@eab/payload-visual-builder'

// In React components (client)
import { VisualBuilder } from '@eab/payload-visual-builder/client'
```

#### Plugin Factory Pattern

The `visualBuilderPlugin()` function follows Payload's plugin convention -- it returns a config modifier function:

```typescript
export const visualBuilderPlugin = (
  pluginConfig: VisualBuilderPluginConfig
): ((config: Config) => Config) => {
  validatePluginConfig(pluginConfig)
  const resolvedConfig = resolveConfig(pluginConfig)

  return (config: Config): Config => {
    validateCollectionsExist(pluginConfig, config)

    const modifiedCollections = (config.collections ?? []).map((collection) => {
      if (resolvedConfig.collections.includes(collection.slug)) {
        return addVisualBuilderToCollection(collection, resolvedConfig)
      }
      return collection
    })

    return { ...config, collections: modifiedCollections }
  }
}
```

The factory validates configuration, resolves defaults, and modifies the target collections by injecting `admin.custom.visualBuilder` metadata with the plugin's settings.

### 3. Configuration API

#### VisualBuilderPluginConfig

```typescript
interface VisualBuilderPluginConfig {
  /** Collections to enable Visual Builder on */
  collections: string[]

  /** Path to the blocks field (dot notation). Default: 'layout.blocks' */
  blocksFieldPath?: string

  /** Feature flags for optional capabilities */
  features?: VisualBuilderFeatures

  /** Custom block registry mapping slugs to edit components */
  blockRegistry?: Record<string, ComponentType<unknown>>
}
```

#### VisualBuilderFeatures

All features default to `true`:

```typescript
interface VisualBuilderFeatures {
  inlineEditing?: boolean      // Inline text/media editing
  dragAndDrop?: boolean        // Block reordering via drag
  inspector?: boolean          // Side panel for properties
  keyboardShortcuts?: boolean  // Keyboard shortcuts
  undoRedo?: boolean           // Undo/redo history
  responsivePreview?: boolean  // Viewport size switching
}
```

#### Configuration Flow

1. Consumer calls `visualBuilderPlugin({ collections: ['pages'], blocksFieldPath: 'layout.blocks' })`
2. `resolveConfig()` merges user config with `defaultFeatures`
3. Plugin modifies each target collection's `admin.custom.visualBuilder` with resolved config
4. At runtime, the VisualBuilder component reads this config to determine behavior

#### Example Usage

```typescript
// payload.config.ts
import { buildConfig } from 'payload'
import { visualBuilderPlugin } from '@eab/payload-visual-builder'

export default buildConfig({
  plugins: [
    visualBuilderPlugin({
      collections: ['pages'],
      blocksFieldPath: 'layout.blocks',
      features: {
        responsivePreview: true,
        undoRedo: true,
      },
    }),
  ],
})
```

### 4. Core Components

#### VisualBuilder (`VisualBuilder.tsx`)

The top-level component. It wraps `VisualBuilderInner` with a `HistoryProvider` for undo/redo support.

**Data flow:**

1. `useDocumentInfo()` provides `initialData` from Payload's document context
2. Blocks are extracted from `initialData.layout.blocks` (configurable path)
3. Local `useState` manages the blocks array -- this is the source of truth during editing
4. Changes flow through `handleBlocksChange()` which: validates blocks, updates local state, records a history snapshot, queues a debounced API save, and marks the document as dirty

**Key state:**
- `blocks: Block[]` -- Current block tree
- `selectedBlockId: string | null` -- Currently selected block
- `hoveredBlockId: string | null` -- Block hovered in layers panel
- `activeTab: string` -- Current sidebar tab ('fields' | 'outline' | 'blocks')
- `showPreview: boolean` -- Preview modal visibility

**Critical behavior:**
- Initial data loads ONCE per document (tracked by `initialLoadDoneRef`)
- Collapses Payload's main nav on mount to maximize horizontal space
- Text edits are batched via `useTextEditHistory` (1s debounce) to avoid flooding history
- Undo/redo do NOT trigger saves -- they are exploratory. The user must explicitly continue editing to trigger a save.

**Component tree:**
```
VisualBuilder
  └── HistoryProvider
      └── VisualBuilderInner
          ├── DndContext (dnd-kit)
          │   ├── TabbedSidebar
          │   │   ├── Inspector (fields tab)
          │   │   ├── BlockLayers (outline tab)
          │   │   └── BlockLibrary (blocks tab)
          │   ├── Canvas
          │   │   └── VisualCanvas
          │   │       └── SortableBlockCard[]
          │   │           └── EditBlockRenderer
          │   │               └── [EditBlock component]
          │   └── DragOverlay
          └── PreviewModal
```

#### Canvas (`Canvas.tsx`)

Renders the block list with drag-and-drop support. Provides the `Block` type definition used throughout the plugin:

```typescript
export type Block = {
  id: string
  blockType: string
  [key: string]: unknown
}
```

**Features:**
- `SortableContext` from dnd-kit for reordering
- `useDroppable` for canvas-level drop zone
- Viewport-constrained container with dashed edge indicators
- Empty state when no blocks exist
- Block inserter at footer and inline after each block
- Recursive rendering of nested container children via `SortableBlockCard`

**Block operations:** Remove, move up, move down, duplicate, insert after -- all implemented as immutable array operations using path-based tree updates.

#### BlockWrapper (`BlockWrapper.tsx`)

Provides the visual editing chrome around each block:

- **Selection outline:** 2px solid blue when selected, 1px dashed blue on hover, transparent otherwise
- **Top bar:** Positioned above the block (-32px), appears on hover/selection/menu-open
  - Left: Block type label pill with drag handle (GripVertical icon)
  - Right: BlockActionsMenu (move up/down, add below, duplicate, remove)
- **Click behavior:** Clicks on the wrapper select the block. Clicks on editable content (contenteditable, input, textarea) pass through without selecting.
- **Hover debounce:** 100ms delay on mouse leave to allow cursor travel from content to toolbar

#### Inspector (`Inspector.tsx`)

Side panel for editing selected block properties:

- **No selection state:** Shows empty state with "No Block Selected" message
- **Selected block:** Shows block type header, truncated block ID, "Edit Content" button (navigates to Payload's Edit tab), ContainerControls (for container blocks), and generic BlockControls (layoutMeta fields)
- Uses `onBlockUpdate(blockId, updates)` callback for all property changes

#### BlockLayers (`BlockLayers.tsx`)

Hierarchical tree view of the page block structure:

- Recursive `LayerNode` components with depth-based indentation (16px per level)
- Expand/collapse chevrons for containers
- Click-to-select (syncs with canvas selection)
- Mouse hover triggers `onHoverBlock` (syncs with canvas highlight)
- Exposed via `forwardRef` with `BlockLayersRef` interface for external expand/collapse all
- ARIA tree roles for accessibility (`role="tree"`, `role="treeitem"`, `aria-expanded`)

#### TabbedSidebar (`TabbedSidebar.tsx`)

Combines `IconRail` (vertical icon tab strip) and `TabPanel` (content area) into the sidebar:

- Default tabs: Fields (Sliders icon), Outline (Layers icon), Blocks (LayoutGrid icon)
- Position switching (left/right) persisted via `useSidebarPosition` hook to localStorage
- Configurable panel width (default 220px)
- Optional header actions (e.g., expand/collapse all for Outline tab)

### 5. Edit Block System

Edit blocks are React components that render block content with inline editing capabilities. They are the visual representations of Payload blocks in the canvas.

#### EditBlockProps Interface

Every edit block receives these props:

```typescript
interface EditBlockProps<T extends Block = Block> {
  block: T                           // Block data from Payload
  onChange: (updates: Partial<T>) => void  // Partial update callback
  isSelected: boolean                // Whether this block is selected
  onSelect: () => void               // Selection callback
  showControls?: boolean             // Show editing controls
  dragHandleProps?: HTMLAttributes    // dnd-kit drag handle
  onEditInPayload?: () => void       // Navigate to Payload edit tab
  onRemove?: () => void              // Remove this block
  onMoveUp?: () => void              // Move block up
  onMoveDown?: () => void            // Move block down
  onDuplicate?: () => void           // Duplicate this block
  onAddBelow?: () => void            // Insert block below
  selectedBlockId?: string | null    // Currently selected block (for nested)
  onBlockSelect?: (id: string | null) => void  // Select any block (for nested)
  hoveredBlockId?: string | null     // Hovered block for highlight sync
  parentContainerId?: string | null  // Parent container for hierarchy
}
```

#### Registry Pattern

Edit blocks are registered in a global `Map<string, EditBlockRegistryEntry>`:

```typescript
// Registration
registerEditBlock('hero', HeroEdit, { label: 'Hero', icon: Star })

// Lookup
const EditComponent = getEditBlock('hero')  // Returns HeroEdit or null

// Check
hasEditBlock('hero')  // true

// List all
getRegisteredBlockTypes()  // ['hero', 'richText', 'container', ...]
```

The registry is initialized once via `initializeEditBlocks()`, called at module load time in `VisualBuilder.tsx`. This function is idempotent (safe to call multiple times).

#### Registered Block Types

Phase B (core):
- `richText` (RichTextEdit) -- Lexical rich text editor
- `hero` (HeroEdit) -- Hero section with image, rich text, buttons
- `media` (MediaEdit) -- Media/image block
- `button` (ButtonEdit) -- Button with editable label
- `container` (ContainerEdit) -- Recursive container with nested blocks

Phase C (content):
- `card` (CardEdit) -- Card with image, title, description
- `accordion` (AccordionEdit) -- Expandable accordion items
- `video` (VideoEdit) -- Video embed
- `testimonial` (TestimonialEdit) -- Quote with attribution
- `stats` (StatsEdit) -- Statistics display
- `callToAction` (CallToActionEdit) -- CTA section
- `stickyCTA` (StickyCTAEdit) -- Sticky CTA bar
- `subnavigation` (SubNavigationEdit) -- Sub-navigation links
- `formEmbed` (FormEmbedEdit) -- Form embed

#### Fallback for Unregistered Blocks

When `getEditBlock()` returns null for a block type, the `EditBlockRenderer` falls back to a generic card view showing the block type and basic metadata.

#### How Edit Blocks Use Inline Primitives

Each edit block composes inline editing primitives to make its content editable. For example, `HeroEdit`:

```typescript
// HeroEdit composition
<BlockWrapper block={block} blockType="Hero" ...>
  <div className={containerClass}>
    <EditableMedia                    // Background image
      value={imageData}
      onChange={handleImageChange}
      size="full"
    />
    <PayloadLexicalEditor             // Rich text content
      value={richTextData}
      onChange={handleRichTextChange}
      showToolbar={isSelected}
    />
    {buttons.map((btn, idx) => (
      <EditableText                   // Button labels
        value={btn.link?.label || ''}
        onChange={(label) => handleButtonLabelChange(idx, label)}
        tag="span"
      />
    ))}
  </div>
</BlockWrapper>
```

**Pattern:** Every edit block wraps its content in `BlockWrapper` for selection chrome, then uses `EditableText` for short text fields, `EditableMedia` for images, and `PayloadLexicalEditor` or `InlineLexicalEditor` for rich text areas. The `onChange` prop on each primitive calls the parent's `onChange` with a partial block update.

#### ContainerEdit: Recursive Rendering

`ContainerEdit` is unique because it recursively renders its children using `EditBlockRenderer`, creating nested sortable contexts:

```
ContainerEdit
  └── BlockWrapper
      └── <Tag> (dynamic: div, section, article, etc.)
          └── SortableContext (per container)
              ├── SortableChildBlock → EditBlockRenderer → [EditBlock]
              ├── SortableChildBlock → EditBlockRenderer → ContainerEdit (recursive)
              │   └── SortableContext (nested)
              │       └── ...
              └── ContainerEndDropZone
```

Container settings (layout direction, alignment, gap, grid columns, width) are rendered as CSS flexbox/grid properties directly on the container element.

### 6. Inline Editing Components

These primitives enable in-place content editing within edit blocks.

#### EditableText (`EditableText.tsx`)

A `contenteditable` div component for inline text editing.

**Props:**
```typescript
interface EditableTextProps {
  value: string                    // Current text value
  onChange: (newValue: string) => void  // Fires on blur or Enter (single-line)
  placeholder?: string             // Placeholder when empty
  tag?: 'span' | 'div' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p' | 'label'
  className?: string
  style?: React.CSSProperties
  multiline?: boolean              // Enter adds newline vs. submits
  disabled?: boolean
  enableFormatting?: boolean        // Rich text mode (bold, italic, link)
  htmlValue?: string               // HTML value when formatting enabled
  onHtmlChange?: (html: string) => void  // HTML change callback
}
```

**Behavior:**
- Renders the specified HTML tag with `contenteditable`
- Changes propagate on blur (always) or Enter (single-line mode)
- Escape reverts to last committed value
- Paste strips formatting in plain text mode, preserves in rich text mode
- When `enableFormatting` is true, shows a floating `FormatToolbar` on text selection
- Format shortcuts: Cmd+B (bold), Cmd+I (italic), Cmd+K (link)

**Use cases:** Hero headlines, card titles, button labels, any short text field.

#### EditableMedia (`EditableMedia.tsx`)

Clickable image component that opens Payload's media drawer.

**Props:**
```typescript
interface EditableMediaProps {
  value: Media | string | null       // Full object, ID string, or null
  onChange: (newMedia: Media | null) => void
  alt?: string
  placeholder?: string
  aspectRatio?: string               // CSS aspect-ratio (e.g., '16/9')
  style?: React.CSSProperties
  disabled?: boolean
  size?: 'small' | 'medium' | 'large' | 'full'
}
```

**Behavior:**
- Displays current image with hover overlay ("Click to change")
- Empty state shows dashed border with "Add image" placeholder
- Click opens `useListDrawer` from `@payloadcms/ui` for media selection
- Remove button (X) clears the media
- Resolves media by ID via `/api/media/{id}` with in-memory cache
- Keyboard accessible: Enter/Space to open drawer

**Use cases:** Hero background images, card images, media blocks, any image field.

#### PayloadLexicalEditor (`PayloadLexicalEditor.tsx`)

Full Lexical rich text editor with a Payload-styled toolbar.

**Features:**
- Full formatting: bold, italic, underline, strikethrough, code
- Headings: H1-H4 via dropdown selector
- Lists: bullet and numbered
- Block quotes
- Text alignment: left, center, right, justify (via dropdown)
- Links: insert and remove
- Undo/redo (Lexical-internal history)
- Toolbar appears on focus or when externally controlled

**Architecture:** Uses `LexicalComposer` with `HeadingNode`, `QuoteNode`, `ListNode`, `ListItemNode`, and `LinkNode`. The `InitialStatePlugin` hydrates the editor from serialized Lexical JSON on mount only (never resets during typing).

#### InlineLexicalEditor (`InlineLexicalEditor.tsx`)

Full-featured rich text editor with a dark-themed toolbar. Similar to PayloadLexicalEditor but with a different visual treatment.

**Key difference from PayloadLexicalEditor:** Uses a dark toolbar style (#1f2937 background) with icon-only buttons. Shows toolbar only when focused or externally controlled via `showToolbar` prop.

#### FormatToolbar (`FormatToolbar.tsx`)

Floating toolbar for inline text formatting, rendered via React portal.

**Features:**
- Appears above selected text
- Three buttons: Bold (Cmd+B), Italic (Cmd+I), Link (Cmd+K)
- Viewport-aware positioning (prevents going off-screen)
- Dark theme (#1f2937 background)
- Active state highlighting for current formats
- `onMouseDown={preventDefault}` to preserve text selection during clicks

### 7. Container Adapter Pattern

All container nesting logic is abstracted through `containerAdapter.ts`. This is the single source of truth for how blocks contain children.

#### Two Container Schemas

The system supports two container data structures:

```
Main Container (layout schema):    block.layout.content.blocks
Nested Container (content schema): block.content.content.blocks
```

Both share the same `blockType: 'container'` slug. The adapter determines which schema to use by checking for the presence of a `layout` property.

#### Adapter Functions

```typescript
// Check if block is a container
isContainer(block: Block): boolean
// Returns true if blockType === 'container'

// Determine which schema is used
getContainerSchema(block: Block): 'layout' | 'content' | null
// Returns 'layout' if block has layout property, else 'content'

// Check for children
hasChildren(block: Block): boolean

// Get children array
getChildren(block: Block): Block[]
// Returns [] for non-containers or empty containers

// Set children (immutably)
setChildren(block: Block, children: Block[]): Block
// Returns new block with updated children at correct schema path

// Get path array for children (used by Canvas for deep updates)
getChildrenPath(block: Block): string[]
// Returns ['layout', 'content', 'blocks'] or ['content', 'content', 'blocks']

// Recursive block search
findBlockById(blocks: Block[], id: string): Block | null

// Find parent container of a block
findParentContainer(blocks: Block[], childId: string): Block | null

// Recursive immutable block update
updateBlockInTree(blocks: Block[], blockId: string, updates: Partial<Block>): Block[]

// Cycle detection for drag-and-drop
wouldCreateCycle(blocks: Block[], draggedId: string, targetId: string): boolean
```

#### Why This Abstraction Matters

Without the adapter, every component that touches container children would need to know about both schema variants. The adapter centralizes this knowledge so that Canvas, ContainerEdit, BlockLayers, dnd handlers, and the save pipeline all work through a single interface.

**Rule:** Never access `block.layout.content.blocks` or `block.content.content.blocks` directly. Always use `getChildren()` and `setChildren()`.

#### Container Adapter in Practice

The adapter is used across the entire plugin:

| Consumer | Functions Used | Purpose |
|----------|---------------|---------|
| `Canvas.tsx` | `isContainer`, `getChildren`, `getChildrenPath` | Recursive block rendering, path-based updates |
| `ContainerEdit.tsx` | `getContainerSchema`, `getChildren`, `setChildren` | Child CRUD operations, layout rendering |
| `BlockLayers.tsx` | `isContainer`, `getChildren` | Tree view hierarchy |
| `VisualBuilder.tsx` | `findBlockById`, `updateBlockInTree`, `findParentContainer`, `isContainer`, `getChildren`, `setChildren` | Selection, updates, insert logic |
| `useDndHandlers.ts` | `isContainer`, `getChildren`, `setChildren`, `getChildrenPath`, `wouldCreateCycle` | Cross-container moves, cycle prevention |
| `useBlockKeyboardShortcuts.ts` | (via blockOperations) | Delete, duplicate, move operations |

#### Path-Based Deep Updates

The Canvas uses a path-based approach for deeply nested updates. A path like `['0', 'layout', 'content', 'blocks', '2', 'content', 'content', 'blocks']` describes how to reach a specific nested block array. The `updateBlocksAtPath()` function walks this path and applies an updater function at the target level, returning a new immutable tree.

### 8. Drag and Drop (dnd-kit)

The plugin uses `@dnd-kit/core` and `@dnd-kit/sortable` for drag-and-drop.

#### Architecture

```
DndContext (in VisualBuilder)
  ├── sensors: [PointerSensor { distance: 8 }]
  ├── collisionDetection: pointerWithin
  ├── onDragStart → setActiveId
  ├── onDragOver → cycle detection + visual feedback
  └── onDragEnd → block reorder/move
      ├── SortableContext (root blocks in Canvas)
      │   └── SortableBlockCard[] (useSortable per block)
      └── SortableContext (per container in ContainerEdit)
          └── SortableChildBlock[] (useSortable per child)
```

#### Key Implementation Details

**PointerSensor activation:** 8px movement threshold before drag activates. This allows regular clicks to work on blocks without accidentally triggering drags.

**Collision detection:** `pointerWithin` is used instead of `closestCenter` because it provides more accurate hit detection for nested containers.

**Cycle prevention:** Before any drop, `wouldCreateCycle()` checks whether dropping block A into block B would create a cycle (e.g., dropping a container into itself or its descendants). The check uses `isDescendant()` recursive traversal. Invalid drop targets get visual feedback (red highlight) via the `invalidDropTarget` state.

**Cross-container moves:** When moving a block between containers:
1. Remove the block from its source container
2. Recalculate the target container's children path (indices may have shifted)
3. Insert the block at the target position

**New block drops from library:** The BlockLibrary supports dragging new blocks onto the canvas. New blocks have IDs prefixed with `library-{blockType}`. On drop, `createBlock(blockType)` generates a fresh block with a new UUID.

**DragOverlay:** Shows a `BlockCardPreview` of the dragged block floating under the cursor.

#### Container-Specific Drop Zones

Each container provides:
- `ContainerEmptyDropZone` -- Shown when container has no children (dashed border, "Add blocks" or "Drop block here")
- `ContainerEndDropZone` -- Shown at the end of children during drag (thin bar indicator)
- Per-child drop indicators -- Horizontal or vertical lines based on container layout direction

#### Layout-Aware Sorting

ContainerEdit uses layout-aware sorting strategies:
- `verticalListSortingStrategy` for column and grid layouts (default)
- `horizontalListSortingStrategy` for row layouts

Drop indicators match the layout direction:
- Column/grid layouts: horizontal line above the drop position
- Row layouts: vertical line to the left of the drop position

Both indicator types use a 4px thick blue (#3b82f6) bar with a glow effect (`box-shadow: 0 0 8px rgba(59, 130, 246, 0.6)`).

#### Block Library Drag Source

The `BlockLibrary` component allows dragging new block types from the sidebar onto the canvas. Library items are configured as drag sources with:
- `id: 'library-{blockType}'` -- Unique ID format for distinguishing from existing blocks
- `data: { type: 'new-block', blockType }` -- Data payload for the drop handler

On drop, the `handleDragEnd` in `useDndHandlers` detects the `new-block` type, creates a fresh block via `createBlock()`, and inserts it at the target position.

### 9. History and Undo/Redo

#### HistoryContext (`HistoryContext.tsx`)

A React context providing undo/redo functionality with these safety measures:

**Deep cloning:** Uses `JSON.parse(JSON.stringify(blocks))` for deep cloning. Not `structuredClone`, because the blocks may contain non-cloneable references. The `safeCloneBlocks()` utility handles this with validation.

**Validation:** Every snapshot is validated before recording AND before restoring. If validation fails, the operation is rejected with a console error.

**Maximum entries:** 50 entries maximum. When exceeded, oldest entries are pruned.

**Cursor-based navigation:** The history maintains an array of entries and a cursor. Undo decrements the cursor, redo increments it. New edits truncate everything after the current cursor (destroying redo history).

#### HistoryEntry Structure

```typescript
interface HistoryEntry {
  id: string              // crypto.randomUUID()
  timestamp: number       // Date.now()
  blocks: Block[]         // Deep-cloned block state
  operation: OperationType  // 'initial' | 'insert' | 'remove' | 'move' | 'duplicate' | 'update' | 'batch'
  label: string           // Human-readable label
}
```

#### Text Edit Batching (`useTextEditHistory`)

Rapid keystrokes during text editing would create one history entry per keystroke. The `useTextEditHistory` hook batches them:

1. First keystroke calls `startBatch()` -- clones current blocks as "before" state
2. Subsequent keystrokes within 1000ms reset the debounce timer
3. After 1000ms of inactivity OR explicit `flushPending()` -- records a single "Edit text" entry
4. Non-text changes (structural operations) auto-flush any pending text batch first

**Flush triggers:**
- Debounce timeout (1000ms)
- Focus leaves the VisualBuilder container (onBlur)
- Non-text structural change (move, delete, insert)

#### Undo/Redo Behavior

**Undo** restores the previous state WITHOUT triggering a save. The rationale: undo is exploratory. The user may undo several steps just to look, then redo back. Only when the user makes a new edit from an undone state does a save get queued.

**Redo** similarly restores without saving.

**History-aware save status:** The `SaveStatusIndicator` compares the current history cursor with the last saved cursor to determine if the user is exploring history (viewing a state older than what was saved).

### 10. Save Strategy

#### Direct API Approach

The visual builder does NOT use Payload's form state for writes. Instead:

```typescript
// In VisualBuilder.tsx
const saveBlocks = async (blocksToSave: Block[]) => {
  const response = await fetch(
    `/api/${collectionSlug}/${documentId}?depth=0`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ layout: { blocks: blocksToSave } }),
    }
  )
  // ... error handling
}
```

#### Why NOT Form State

Payload's form state hooks (`useField`, `useForm`) trigger React re-renders on every field change. In a visual editor with many blocks, each containing multiple fields, this creates render cascades that degrade performance. By managing local state and saving via direct API calls, the visual builder achieves:

- **Instant UI updates:** `setBlocks()` updates local state immediately
- **Debounced saves:** Only one API call per 500ms burst of changes
- **No form re-renders:** Block changes don't cascade through Payload's form system
- **Optimistic UI:** Changes appear instantly; save happens in the background

#### useSaveQueue Hook

```typescript
const { status, queueSave, retry } = useSaveQueue(saveFn, {
  debounceMs: 500,           // Wait 500ms after last change
  savedDisplayMs: 2000,      // Show "Saved" status for 2s
  onSuccess: () => { ... },  // Called after successful save
  onError: (err) => { ... }, // Called on save failure
})
```

**Save states:** `idle` -> `dirty` -> `saving` -> `saved` -> `idle` (or `error`)

**Queue behavior:**
1. `queueSave(data)` stores the latest data and starts a debounce timer
2. After 500ms of no new calls, `executeSave()` fires
3. If a new `queueSave()` arrives during save, it stores as pending
4. After save completes, if pending data exists, it saves again
5. Only one request is in-flight at a time

**Error handling:** On save failure, the pending data is preserved for retry. The `retry()` function re-attempts the last failed save.

#### Unsaved Changes Warning

The `useUnsavedChanges` hook sets up a `beforeunload` event listener when the document has unsaved changes, warning users before navigating away.

### 11. Keyboard Shortcuts

#### Block Operations (`useBlockKeyboardShortcuts`)

| Shortcut | Action | Condition |
|----------|--------|-----------|
| Delete / Backspace | Delete selected block | Block selected, not in editable |
| Cmd+D | Duplicate selected block | Block selected, not in editable |
| Cmd+ArrowUp | Move block up | Block selected, not in editable |
| Cmd+ArrowDown | Move block down | Block selected, not in editable |
| Escape | Clear selection | Any time |

**Skip conditions:** All shortcuts (except Escape) are disabled when focus is in an input, textarea, or contenteditable element to avoid interfering with text editing.

#### Global Shortcuts (in VisualBuilder)

| Shortcut | Action |
|----------|--------|
| Cmd+Z | Undo |
| Cmd+Shift+Z | Redo |
| Cmd+P | Open preview modal |

These global shortcuts also skip when focus is in input/textarea/contenteditable.

#### Inline Text Shortcuts (in EditableText)

| Shortcut | Action | Condition |
|----------|--------|-----------|
| Cmd+B | Bold | `enableFormatting` is true |
| Cmd+I | Italic | `enableFormatting` is true |
| Cmd+K | Insert/remove link | `enableFormatting` is true |
| Enter | Submit (blur) | Single-line mode |
| Cmd+Enter | Submit (blur) | Multiline mode |
| Escape | Revert and blur | Always |

### 12. Responsive Preview

#### useViewportPreset Hook

```typescript
const VIEWPORT_PRESETS = {
  desktop: { width: 1280, label: 'Desktop', icon: 'Monitor' },
  tablet:  { width: 768,  label: 'Tablet',  icon: 'Tablet' },
  mobile:  { width: 375,  label: 'Mobile',  icon: 'Smartphone' },
  full:    { width: null,  label: 'Full Width', icon: 'Maximize2' },
}

const { preset, setPreset, width } = useViewportPreset()
```

- `width: null` means no constraint (full canvas width)
- Default preset is `desktop` (1280px)
- No persistence -- resets on unmount

#### Canvas Viewport Containment

When a viewport width is set, the Canvas applies:
```css
max-width: ${viewportWidth}px;
margin: 0 auto;
transition: max-width 0.2s ease;
```

Dashed blue edge indicators (opacity 0.6) show the viewport boundaries.

#### ViewportSwitcher Component

A segmented control in the toolbar that shows the available presets and allows switching between them. Each button shows the preset's icon (Monitor, Tablet, Smartphone, Maximize2).

#### Preview Modal

`PreviewModal` shows a full-screen overlay with the block tree rendered at selected viewport sizes. It provides separate viewport switching independent of the editor viewport.

**Preview viewport widths:**
```typescript
const PREVIEW_VIEWPORT_WIDTHS = {
  desktop: 1280,
  tablet: 768,
  mobile: 375,
}
```

The preview modal renders blocks via `PreviewBlockRenderer`, which renders blocks without editing chrome (no BlockWrapper, no inline editing). This provides a clean preview of the final layout.

### 13. CSS Architecture

#### Plugin CSS Variables (`--vb-*`)

The plugin defines its own CSS custom properties in `tokens.css`:

```css
:root {
  --vb-font-family: system-ui, ...;
  --vb-font-size-base: 18px;
  --vb-spacing-md: 16px;
  --vb-color-primary: #3b82f6;
  --vb-radius-md: 8px;
  --vb-shadow-md: 0 4px 6px ...;
  --vb-transition-fast: 150ms ease;
  /* ... */
}
```

**DEPRECATED:** The `tokens.css` file is deprecated in favor of the frontend's `--token-*` variables. The `VisualCanvas` component now aliases:
```css
--vb-color-primary: var(--token-color-primary, #3b82f6);
```

This means consuming projects that define `--token-*` variables get automatic parity between their frontend and the visual builder.

#### CSS Modules

Components use SCSS or CSS Modules for scoped styles:
- `visualBuilder.module.scss` -- Layout container, header, toolbar
- `tabbedSidebar.module.scss` -- Sidebar layout, icon rail, tab panel
- `blockLayers.module.scss` -- Tree view nodes, expand/collapse
- `blockLibrary.module.scss` -- Block library grid
- `visualCanvas.module.css` -- Canvas containment and token aliasing
- `viewportSwitcher.module.css` -- Preset buttons
- `previewModal.module.scss` -- Modal overlay

#### Block-Specific Styles

Each edit block has its own CSS Module exposed via `styles/blocks.ts`:
```typescript
export {
  heroStyles,
  containerStyles,
  cardStyles,
  richTextStyles,
  mediaStyles,
  buttonStyles,
  // ...
} from './blocks'
```

These are CSS Module objects that edit blocks import for their visual treatment.

#### CSS Containment

The `VisualCanvas` component uses CSS containment to isolate the rendering context:
```css
.visualCanvas {
  /* Style isolation from Payload admin */
  isolation: isolate;
  contain: content;
}
```

This prevents Payload's admin styles from bleeding into block rendering and vice versa.

#### Style Utilities

```typescript
// Class name merging (falsy-safe)
cn('base', isActive && 'active', undefined)  // => 'base active'

// Read CSS variable
getCSSVar('vb-color-primary', '#3b82f6')

// Set CSS variable on element
setCSSVar(element, 'vb-color-primary', '#2563eb')

// TypeScript token access
tokens.colors.primary  // => '#3b82f6'
getToken('colors.primary')  // => '#3b82f6'
```

### 14. Thin Wrapper Pattern

Consuming applications mount the Visual Builder through a thin wrapper pattern.

#### How It Works

1. The plugin registers itself on target collections via `visualBuilderPlugin()`
2. The consuming app creates a thin wrapper component that re-exports the Visual Builder:

```typescript
// In consuming app (e.g., app/(payload)/admin/components/VisualBuilder.tsx)
export { VisualBuilder as default } from '@eab/payload-visual-builder/client'
```

3. Payload's import map resolution picks up this component for the custom document view tab

#### Plugin Import Map

The plugin uses Payload 3.x's import map system to inject the Visual Builder as a custom document view tab. When a user navigates to a document in an enabled collection, they see an additional "Visual Builder" tab alongside the default "Edit" tab.

#### Customization Points

- **Block registry:** Consumers can register additional edit blocks or override existing ones
- **CSS variables:** Setting `--token-*` variables in the admin context customizes the visual builder's appearance
- **Feature flags:** Individual features can be disabled via the config
- **Tab configuration:** The sidebar tabs can be customized (though defaults are provided)
- **Block categories:** The `BLOCK_CATEGORIES` and `getBlocksByCategory` utilities organize blocks in the library

### 15. Figma Parallels

The Visual Builder's architecture mirrors Figma's design patterns, which is intentional -- it informs the design of a future Figma-to-CMS importer.

| Visual Builder | Figma | Notes |
|----------------|-------|-------|
| Canvas | Figma canvas | Root rendering surface, click-to-deselect |
| Block selection (blue outline) | Node selection (blue outline) | Both use outline + box-shadow |
| Inspector panel | Right panel (Design/Prototype/Inspect) | Properties for selected element |
| BlockLayers panel | Layers panel | Hierarchical tree with expand/collapse |
| TabbedSidebar (Fields/Outline/Blocks) | Left sidebar (Layers/Assets/Pages) | Icon rail + panel content |
| Container nesting | Auto Layout frames | Both support recursive nesting |
| ContainerEdit (flex/grid layout) | Auto Layout settings | Direction, gap, alignment, padding |
| BlockWrapper hover/select chrome | Node hover/select chrome | Label pill, action buttons |
| Drag-and-drop reorder | Layer drag reorder | Within and across containers |
| Inline text editing (EditableText) | Text layer double-click editing | Direct content manipulation |
| Undo/redo (HistoryContext) | Undo/redo (Cmd+Z / Cmd+Shift+Z) | Snapshot-based history |
| Viewport presets | Device frames | Desktop/tablet/mobile preview |
| DragOverlay (ghost preview) | Drag ghost | Visual feedback during drag |
| BlockLibrary | Assets panel | Catalog of available components |
| Block categories | Component sections | Organizational grouping |

#### Implications for Figma Importer

Understanding these parallels means a Figma importer can map:
- Figma page structure -> Visual Builder block tree
- Figma Auto Layout frames -> Container blocks with layout settings
- Figma component instances -> Registered edit blocks
- Figma text layers -> EditableText or Lexical content
- Figma image fills -> EditableMedia values
- Figma component properties -> Block field values

The mapping rules in `payload-figma-mapping.md` formalize these correspondences.

### 16. Cross-References

This module connects to several other knowledge modules:

- **`payload-blocks.md`** -- Block configurations (slug, fields, tabs) that the edit block system renders. Every `EditBlockComponent` corresponds to a block config defined in this module. Container schemas (layout vs. content) documented here are the same schemas the container adapter handles.

- **`payload-figma-mapping.md`** -- Mapping rules that determine which Figma components become which block types. The visual builder's edit block registry mirrors the block catalog from this mapping. Container nesting rules translate between Figma Auto Layout and the Container block's flex/grid settings.

- **`design-to-code-layout.md`** -- Auto Layout to CSS Flexbox mapping. ContainerEdit renders the same CSS flexbox/grid properties documented in this module: flex-direction, align-items, justify-content, gap, grid-template-columns. The visual builder makes these properties editable via ContainerControls.

- **`css-strategy.md`** -- The three-layer CSS architecture (Tailwind + Custom Properties + CSS Modules). The visual builder's CSS architecture follows this strategy: `--vb-*` custom properties for tokens, CSS Modules for scoped component styles, and the `--token-*` variable bridge for frontend parity.

- **`design-tokens.md`** -- Token extraction pipeline and CSS rendering. The visual builder's `tokens.css` and `styles/utils.ts` implement the same token categories (colors, typography, spacing, radii, shadows) documented in this module. The deprecated `--vb-*` to `--token-*` migration reflects the tokens module's single-source-of-truth principle.

- **`figma-api-plugin.md`** -- Figma plugin sandbox model and development patterns. The visual builder's plugin architecture (two-entry pattern, configuration factory) parallels Figma's plugin model. Both use message-passing (Figma: main/UI threads; Visual Builder: server/client entries) and registration patterns.

- **`design-to-code-semantic.md`** -- Semantic HTML generation. ContainerEdit supports dynamic HTML tags (section, article, div, nav, aside) matching the semantic element mapping documented in this module. The visual builder preserves semantic structure during visual editing.

- **`design-to-code-visual.md`** -- Visual property mapping (fills, strokes, effects). Edit blocks like HeroEdit apply visual properties (background images, overlays, shadows) that correspond to the Figma visual properties documented in this module.
