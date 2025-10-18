# Completion Callbacks System

The `WFCGenerator` now includes a robust callback system that allows you to register functions to be executed when the Wave Function Collapse solver completes successfully.

## Overview

The callback system provides:

- **Registration**: Add callbacks with unique IDs
- **Unregistration**: Remove callbacks by ID
- **Automatic triggering**: Callbacks fire when `generate()`, `expand()`, or `collapse()` complete successfully
- **Error handling**: Built-in try-catch prevents one failing callback from affecting others
- **Automatic cleanup**: All callbacks are cleared when `dispose()` is called

## API Reference

### `onComplete(id: string, callback: () => void): this`

Register a callback to be invoked when generation completes successfully.

**Parameters:**

- `id` - Unique identifier for this callback (used for unregistering)
- `callback` - Function to call when generation completes

**Returns:** The WFCGenerator instance for chaining

**Example:**

```typescript
generator.onComplete("myCallback", () => {
  console.log("Generation complete!");
});
```

### `offComplete(id: string): this`

Unregister a completion callback.

**Parameters:**

- `id` - The identifier of the callback to remove

**Returns:** The WFCGenerator instance for chaining

**Example:**

```typescript
generator.offComplete("myCallback");
```

### `clearCompleteCallbacks(): void`

Clear all registered completion callbacks.

**Example:**

```typescript
generator.clearCompleteCallbacks();
```

### `getRegisteredCallbacks(): string[]`

Get an array of all registered callback IDs.

**Returns:** Array of callback IDs

**Example:**

```typescript
const ids = generator.getRegisteredCallbacks();
console.log("Registered callbacks:", ids);
```

## When Callbacks Are Triggered

Callbacks are triggered when:

- ✅ `collapse()` completes successfully
- ✅ `generate()` completes successfully
- ✅ `expand()` completes successfully

Callbacks are **NOT** triggered when:

- ❌ Generation fails after all retries
- ❌ An error is thrown
- ❌ `shrink()` is called (it's a synchronous operation)

## Usage Examples

### Basic Usage

```typescript
const generator = new WFCGenerator(tiles, { scene });

generator.onComplete("log", () => {
  console.log("Generation finished!");
});

await generator.collapse({});
// Output: "Generation finished!"
```

### Multiple Callbacks

```typescript
generator
  .onComplete("analytics", () => trackEvent("generation_complete"))
  .onComplete("ui", () => updateUIState())
  .onComplete("export", () => exportToFile());

await generator.generate(10, 1, 10);
// All three callbacks will execute in order
```

### Temporary Callbacks

```typescript
const tempId = `temp-${Date.now()}`;

generator.onComplete(tempId, () => {
  console.log("This runs once");
  generator.offComplete(tempId); // Remove itself
});
```

### Loading State Management

```typescript
let isGenerating = false;

generator.onComplete("loading", () => {
  isGenerating = false;
  hideLoadingSpinner();
});

async function generate() {
  isGenerating = true;
  showLoadingSpinner();
  await generator.collapse({});
  // Loading state automatically updated via callback
}
```

### Performance Tracking

```typescript
let startTime: number;

async function generateWithTiming() {
  startTime = Date.now();

  generator.onComplete("timer", () => {
    const duration = Date.now() - startTime;
    console.log(`Generated in ${duration}ms`);
  });

  await generator.collapse({});
}
```

### Conditional Callbacks

```typescript
function setupCallbacks(enableAnalytics: boolean) {
  generator.onComplete("ui-update", () => updateUI());

  if (enableAnalytics) {
    generator.onComplete("analytics", () => trackEvent());
  }
}
```

## Error Handling

Callbacks are wrapped in try-catch blocks. If a callback throws an error:

- The error is logged to console
- Other callbacks continue to execute
- Generation is not affected

```typescript
generator.onComplete("risky", () => {
  throw new Error("Oops!");
  // Error logged, other callbacks still run
});

generator.onComplete("safe", () => {
  console.log("This still runs!");
});
```

## Best Practices

### 1. Use Descriptive IDs

```typescript
// Good
generator.onComplete("save-to-database", saveHandler);
generator.onComplete("update-ui", uiHandler);

// Avoid
generator.onComplete("cb1", handler1);
generator.onComplete("x", handler2);
```

### 2. Clean Up When Done

```typescript
// Remove temporary callbacks
generator.offComplete("one-time-callback");

// Or clear all when component unmounts
useEffect(() => {
  return () => generator.clearCompleteCallbacks();
}, []);
```

### 3. Avoid Heavy Operations

```typescript
// Good - Quick operations
generator.onComplete("ui", () => setState({ complete: true }));

// Risky - Heavy operations might slow down completion
generator.onComplete("export", async () => {
  // This runs synchronously, blocking other callbacks
  await heavyExportOperation(); // Consider running separately
});
```

### 4. Use for Side Effects, Not Critical Logic

```typescript
// Good - UI updates, analytics
generator.onComplete("ui", () => showSuccessMessage());

// Avoid - Critical logic should be in main flow
generator.onComplete("critical", () => {
  // Don't rely on callbacks for critical operations
  processCriticalData();
});
```

## Integration with Existing Features

### Works with Retries

```typescript
const generator = new WFCGenerator(tiles, {
  scene,
  maxRetries: 3,
});

generator.onComplete("success", () => {
  console.log("Succeeded, possibly after retries");
});

// Callback only fires if generation succeeds (possibly after retries)
await generator.collapse({});
```

### Works with Auto-Expansion

```typescript
const generator = new WFCGenerator(tiles, {
  scene,
  autoExpansion: true,
});

generator.onComplete("expansion", () => {
  console.log("Triggered on both generate AND expand");
});

await generator.collapse({}); // Callback triggered
await generator.expand(20, 1, 20); // Callback triggered again
```

### Survives Re-generation

```typescript
generator.onComplete("persistent", () => {
  console.log("Fires every time");
});

await generator.collapse({}); // Triggered
await generator.generate(5, 1, 5); // Triggered again
await generator.expand(10, 1, 10); // Triggered again
```

## Cleanup and Disposal

When you call `dispose()`, all callbacks are automatically cleared:

```typescript
generator.dispose();
// All callbacks removed
// Workers terminated
// Resources cleaned up
```

## TypeScript Types

The callbacks use TypeScript for type safety:

```typescript
onComplete(id: string, callback: () => void): this;
offComplete(id: string): this;
clearCompleteCallbacks(): void;
getRegisteredCallbacks(): string[];
```

## Migration from Previous Code

If you had custom code like this:

```typescript
// Before
const result = await generator.collapse({});
console.log("Done!");
updateUI();
```

You can now use:

```typescript
// After
generator
  .onComplete("log", () => console.log("Done!"))
  .onComplete("ui", () => updateUI());

const result = await generator.collapse({});
```

This separates concerns and makes callbacks reusable across multiple generations.
