# npm Package Setup - Complete

Your library is now ready to be published and used as an npm package! 🎉

## What Was Done

### 1. Library Entry Point (`src/index.ts`)

Created a main entry point that exports all public APIs:

- Core WFC system (WFC3D, WFCTile3D, WFC3DBuffer)
- Type definitions (VoxelTile3DConfig, ModelTile3DConfig, etc.)
- GLB loaders (GLBTileLoader)
- Renderers (InstancedModelRenderer)

### 2. Build Configuration

**`tsconfig.lib.json`** - TypeScript configuration for library builds:

- Generates `.d.ts` declaration files for TypeScript support
- Only includes library code (excludes demos)
- Outputs to `dist/lib/`

**`vite.lib.config.ts`** - Vite configuration for bundling:

- Creates both ESM (`.js`) and CommonJS (`.cjs`) builds
- Externalizes `three.js` (users provide their own)
- Optimized for library distribution

### 3. Package.json Updates

```json
{
  "main": "./dist/lib/three-collapse.cjs", // CommonJS entry
  "module": "./dist/lib/three-collapse.js", // ESM entry
  "types": "./dist/lib/index.d.ts", // TypeScript types
  "exports": {
    /* Conditional exports */
  },
  "files": ["dist/lib", "src", "README.md", "LICENSE"], // What gets published
  "peerDependencies": {
    "three": ">=0.150.0" // Users must install three.js
  }
}
```

**New Scripts:**

- `build:lib` - Build just the library (for npm)
- `build:demos` - Build the demo sites
- `build` - Build everything
- `prepublishOnly` - Auto-run before publishing

### 4. Files Configuration

**`.npmignore`** - Excludes from published package:

- Demo files (`examples/`, `index.html`, `models.html`)
- Build configurations
- Development files
- Implementation notes

**`files` field in package.json** - Includes in package:

- `dist/lib/` - Built library files
- `src/` - Source code (for source maps)
- `README.md` - Documentation
- `LICENSE` - License file

## Build Output

Running `npm run build:lib` generates:

```
dist/lib/
├── three-collapse.js          (11.88 kB) - ESM build
├── three-collapse.cjs         ( 7.67 kB) - CommonJS build
├── index.d.ts                            - Main type definitions
├── index.d.ts.map                        - Source map for types
├── wfc3d/
│   ├── WFC3D.d.ts
│   ├── WFC3DBuffer.d.ts
│   ├── WFCTile3D.d.ts
│   └── index.d.ts
├── loaders/
│   ├── GLBTileLoader.d.ts
│   └── index.d.ts
└── renderers/
    ├── InstancedModelRenderer.d.ts
    └── index.d.ts
```

All TypeScript declarations are included for full IDE support!

## Usage After Publishing

### Installation

```bash
npm install three-collapse three
```

### Import in Projects

**ESM (Modern):**

```typescript
import {
  WFC3D,
  WFCTile3D,
  VoxelTile3DConfig,
  ModelTile3DConfig,
  GLBTileLoader,
  InstancedModelRenderer,
} from "three-collapse";
```

**CommonJS:**

```javascript
const { WFC3D, WFCTile3D } = require("three-collapse");
```

### Tree-Shaking Support

The ESM build supports tree-shaking, so users only bundle what they use:

```typescript
// Only WFC3D will be bundled
import { WFC3D } from "three-collapse";
```

## Testing Locally Before Publishing

### Method 1: npm link (Recommended)

```bash
# In three-collapse directory
npm run build:lib
npm link

# In your test project
npm link three-collapse
```

Now you can import it normally:

```typescript
import { WFC3D } from "three-collapse";
```

### Method 2: Install from Directory

In your test project's `package.json`:

```json
{
  "dependencies": {
    "three-collapse": "file:../path/to/three-collapse",
    "three": "^0.180.0"
  }
}
```

### Method 3: Pack and Install

```bash
# In three-collapse directory
npm run build:lib
npm pack

# Creates: three-collapse-1.0.0.tgz

# In your test project
npm install ../path/to/three-collapse-1.0.0.tgz
```

## Publishing to npm

### First Time Setup

1. **Create npm account**: https://www.npmjs.com/signup

2. **Login to npm:**

   ```bash
   npm login
   ```

3. **Update package.json:**
   ```json
   {
     "name": "three-collapse", // or "@yourusername/three-collapse"
     "author": "Your Name <your.email@example.com>",
     "repository": {
       "type": "git",
       "url": "https://github.com/yourusername/three-collapse.git"
     }
   }
   ```

### Publishing

```bash
# Build the library
npm run build:lib

# Check what will be published
npm pack --dry-run

# Publish to npm
npm publish

# For scoped package (@username/package)
npm publish --access public
```

### Updating

```bash
# Update version
npm version patch  # 1.0.0 -> 1.0.1
# or
npm version minor  # 1.0.0 -> 1.1.0
# or
npm version major  # 1.0.0 -> 2.0.0

# Build and publish
npm run build:lib
npm publish
```

## Package Features

### ✅ Full TypeScript Support

- Complete type definitions
- IntelliSense in IDEs
- Type safety for users

### ✅ Multiple Module Formats

- ESM for modern bundlers
- CommonJS for Node.js
- Tree-shaking support

### ✅ Peer Dependency

- Users provide their own three.js version
- No duplicate three.js in bundles
- Compatible with three.js >= 0.150.0

### ✅ Optimized Build

- Small bundle size (11.88 kB ESM)
- Source maps included
- Production-ready

### ✅ Documentation

- `README.md` - Main documentation
- `LIBRARY_USAGE.md` - Usage examples
- `PUBLISHING.md` - Publishing guide
- `NPM_PACKAGE_SETUP.md` - This file

## Directory Structure

```
three-collapse/
├── src/
│   ├── index.ts              [New] - Library entry point
│   ├── wfc3d/                - Core WFC system
│   ├── loaders/              - GLB loading
│   ├── renderers/            - Instanced rendering
│   ├── main.ts               - Voxel demo (not in package)
│   └── wfc.worker.ts         - Web Worker (not in package)
│
├── dist/lib/                 - Built library (published)
│   ├── three-collapse.js     - ESM build
│   ├── three-collapse.cjs    - CommonJS build
│   └── *.d.ts                - Type definitions
│
├── examples/                 - Demo code (not published)
├── public/                   - Demo assets (not published)
│
├── package.json              [Updated] - Package configuration
├── tsconfig.lib.json         [New] - Library TS config
├── vite.lib.config.ts        [New] - Library build config
├── .npmignore                [New] - Publish exclusions
│
├── README.md                 - Main docs
├── LIBRARY_USAGE.md          [New] - Usage guide
├── PUBLISHING.md             [New] - Publishing guide
└── NPM_PACKAGE_SETUP.md      [New] - This file
```

## Quick Start Checklist

- [x] Library entry point created (`src/index.ts`)
- [x] Build configuration set up (TypeScript + Vite)
- [x] Package.json updated with entry points
- [x] Build tested successfully
- [x] Type declarations generated
- [x] Documentation created

### Ready to Publish?

- [ ] Update `author` in package.json
- [ ] Update `repository.url` in package.json
- [ ] Choose package name (check availability: `npm search three-collapse`)
- [ ] Test locally with `npm link`
- [ ] Run `npm run build:lib`
- [ ] Verify with `npm pack --dry-run`
- [ ] Login to npm: `npm login`
- [ ] Publish: `npm publish`

## Commands Reference

```bash
# Development
npm run dev                    # Start demo dev server

# Building
npm run build:lib             # Build library for npm
npm run build:demos           # Build demo sites
npm run build                 # Build everything

# Testing
npm run build:lib
npm link                      # Link for local testing

# Publishing
npm pack --dry-run            # Preview package contents
npm publish                   # Publish to npm
npm version patch             # Bump version
```

## Example Usage in Other Projects

Once published, users can use your library like this:

```typescript
// Install
// npm install three-collapse three

import * as THREE from "three";
import { WFC3D, WFCTile3D, VoxelTile3DConfig } from "three-collapse";

// Define tiles
const tiles: VoxelTile3DConfig[] = [
  {
    id: "grass",
    color: "#7CFC00",
    weight: 3,
    adjacency: {
      up: ["air"],
      down: ["dirt"],
      // ...
    },
  },
];

// Create WFC
const wfc = new WFC3D({
  width: 10,
  height: 10,
  depth: 10,
  tiles: tiles.map((t) => new WFCTile3D(t)),
  seed: Date.now(),
});

// Generate
await wfc.generate((progress) => {
  console.log(`${Math.round(progress * 100)}%`);
});

// Access results
const tileId = wfc.buffer.getTileAt(x, y, z);
```

## Support

For more detailed information, see:

- **Usage Examples**: `LIBRARY_USAGE.md`
- **Publishing Process**: `PUBLISHING.md`
- **Main Documentation**: `README.md`

## Notes

- The library is framework-agnostic (works with React, Vue, vanilla JS, etc.)
- Users must install three.js separately (peer dependency)
- The demos (`index.html`, `models.html`) are NOT included in the npm package
- Source code is included for better source maps and debugging

---

**Your library is production-ready and ready to publish!** 🚀

```bash
npm run build:lib && npm publish
```
