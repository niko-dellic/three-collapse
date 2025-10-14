# Shared Demo UI Components

## Overview

The expansion mode and worker configuration controls have been moved from individual demo implementations into the shared `DemoUI` utility, making them available across all examples without code duplication.

## Changes Made

### Modified Files

1. **`src/utils/DemoUI.ts`**

   - Added optional `showExpansionToggle` config option
   - Added optional `showWorkerControls` config option
   - Added expansion and worker control callbacks to `DemoUIConfig`
   - Added expansion and worker UI elements to `DemoUIElements`
   - Automatically creates expansion toggle and worker controls when enabled

2. **`examples/models/demo.ts`**
   - Removed `setupAdditionalUI()` method (~107 lines)
   - Removed local properties: `expansionCheckbox`, `useWorkersCheckbox`, `workerCountInput`
   - Updated `createDemoUI()` call to use shared controls
   - Code reduction: ~107 lines removed

## New API

### DemoUIConfig Extended Interface

```typescript
export interface DemoUIConfig {
  // ... existing properties ...

  // Optional expansion and worker controls
  showExpansionToggle?: boolean;
  expansionMode?: boolean;
  onExpansionChange?: (enabled: boolean) => void;
  showWorkerControls?: boolean;
  useWorkers?: boolean;
  workerCount?: number;
  onUseWorkersChange?: (enabled: boolean) => void;
  onWorkerCountChange?: (count: number) => void;
}
```

### DemoUIElements Extended Interface

```typescript
export interface DemoUIElements {
  // ... existing properties ...

  // Optional elements (only present if enabled in config)
  expansionCheckbox?: HTMLInputElement;
  useWorkersCheckbox?: HTMLInputElement;
  workerCountInput?: HTMLInputElement;
}
```

## Usage Example

### With All Controls

```typescript
const ui = createDemoUI({
  title: "My WFC Demo",
  width: 20,
  height: 10,
  depth: 20,
  seed: Date.now(),
  onGenerate: () => generate(),
  onRandomSeed: () => {
    /* ... */
  },
  onSeedChange: (seed) => {
    /* ... */
  },
  onWidthChange: (width) => {
    /* ... */
  },
  onHeightChange: (height) => {
    /* ... */
  },
  onDepthChange: (depth) => {
    /* ... */
  },

  // Enable expansion controls
  showExpansionToggle: true,
  expansionMode: true,
  onExpansionChange: (enabled) => {
    expansionMode = enabled;
    if (!enabled) {
      resetExpansionState();
    }
  },

  // Enable worker controls
  showWorkerControls: true,
  useWorkers: true,
  workerCount: 4,
  onUseWorkersChange: (enabled) => {
    useWorkers = enabled;
  },
  onWorkerCountChange: (count) => {
    workerCount = count;
  },
});
```

### Without Optional Controls (Backward Compatible)

```typescript
const ui = createDemoUI({
  title: "Simple Demo",
  width: 20,
  height: 10,
  depth: 20,
  seed: Date.now(),
  onGenerate: () => generate(),
  onRandomSeed: () => {
    /* ... */
  },
  onSeedChange: (seed) => {
    /* ... */
  },
  onWidthChange: (width) => {
    /* ... */
  },
  onHeightChange: (height) => {
    /* ... */
  },
  onDepthChange: (depth) => {
    /* ... */
  },
  // No expansion or worker controls - UI stays simple
});
```

## UI Layout

When all controls are enabled, the UI structure is:

```
┌─────────────────────────────┐
│ Title                       │
│ Grid: 20×10×20             │
│                            │
│ Grid Size                  │
│ ├─ Width slider           │
│ ├─ Height slider          │
│ └─ Depth slider           │
│                            │
│ ─────────────────────────  │ (separator)
│                            │
│ ☑ Auto-expand mode        │ (if showExpansionToggle)
│                            │
│ Workers                    │ (if showWorkerControls)
│ ☑ Enable multi-worker     │
│ Worker count: [4] (max: 8)│
│                            │
│ ─────────────────────────  │ (separator)
│                            │
│ Seed: [12345]             │
│ [Generate] [Random Seed]  │
│                            │
│ Progress Bar               │
└─────────────────────────────┘
```

## Benefits

### Code Reuse

- Expansion and worker controls are now shared across all demos
- No need to duplicate UI creation code in each demo
- Consistent UI appearance and behavior

### Maintainability

- Single source of truth for these controls
- Bug fixes and improvements apply to all demos
- Easier to add new shared controls in the future

### Flexibility

- Controls are optional - use them only when needed
- Backward compatible - existing demos work without changes
- Easy to customize via callbacks

## Before vs After

### Before (ModelDemo specific)

```typescript
class ModelDemo {
  expansionCheckbox: HTMLInputElement;
  workerCountInput: HTMLInputElement;
  useWorkersCheckbox: HTMLInputElement;

  constructor() {
    this.ui = createDemoUI({
      /* ... */
    });
    this.setupAdditionalUI(); // ~107 lines of DOM manipulation
  }

  private setupAdditionalUI(): void {
    // Manually create expansion checkbox
    // Manually create worker controls
    // Manually wire up event listeners
    // ~107 lines of code
  }
}
```

### After (Shared via DemoUI)

```typescript
class ModelDemo {
  constructor() {
    this.ui = createDemoUI({
      /* ... */,
      // Just enable what you need
      showExpansionToggle: true,
      expansionMode: this.expansionMode,
      onExpansionChange: (enabled) => { /* ... */ },
      showWorkerControls: true,
      useWorkers: this.useWorkers,
      workerCount: this.workerCount,
      onUseWorkersChange: (enabled) => { /* ... */ },
      onWorkerCountChange: (count) => { /* ... */ },
    });
    // No setupAdditionalUI needed!
  }
}
```

## Accessing UI Elements

The optional UI elements are available through the `ui` object:

```typescript
const ui = createDemoUI({
  showExpansionToggle: true,
  showWorkerControls: true,
  /* ... */
});

// Access the elements (they're optional, so check first)
if (ui.expansionCheckbox) {
  console.log("Expansion enabled:", ui.expansionCheckbox.checked);
}

if (ui.useWorkersCheckbox) {
  console.log("Workers enabled:", ui.useWorkersCheckbox.checked);
}

if (ui.workerCountInput) {
  console.log("Worker count:", ui.workerCountInput.value);
}
```

## Future Enhancements

Additional shared controls that could be added:

1. **Quality Settings**: Render quality, shadow resolution, etc.
2. **View Controls**: Toggle shadows, wireframe, bounding boxes
3. **Debug Info**: Show FPS, tile count, generation time
4. **Export Controls**: Save/load configurations
5. **Preset Selector**: Choose from predefined configurations

## Migration Guide

If you have a demo with custom UI controls, here's how to migrate:

1. **Identify** the controls you want to share
2. **Add** config options to `DemoUIConfig`
3. **Add** UI elements to `DemoUIElements`
4. **Implement** the UI creation in `createDemoUI()`
5. **Update** your demo to use the new options
6. **Remove** the old custom UI code
7. **Test** to ensure everything works

## Examples in the Codebase

- **`examples/models/demo.ts`**: Uses both expansion and worker controls
- **`src/main.ts`**: Uses basic controls only (no expansion/workers)

## Testing

When testing demos with these controls:

1. Verify expansion toggle enables/disables expansion behavior
2. Verify worker toggle enables/disables worker input
3. Verify worker count changes are applied
4. Verify controls are hidden when flags are false
5. Verify backward compatibility (demos without flags still work)

## Conclusion

Moving the expansion and worker controls to the shared DemoUI provides:

- ✅ **Code Reuse**: ~107 lines saved per demo
- ✅ **Consistency**: Same UI across all demos
- ✅ **Maintainability**: Single source of truth
- ✅ **Flexibility**: Optional, easy to use
- ✅ **Extensibility**: Easy to add more shared controls
