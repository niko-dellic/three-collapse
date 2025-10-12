# Publishing Guide

This guide explains how to publish `three-collapse` to npm and use it in other projects.

## Prerequisites

1. **npm account**: Create one at https://www.npmjs.com/signup
2. **npm CLI logged in**: Run `npm login` and enter your credentials
3. **Git repository** (recommended): Push to GitHub/GitLab

## Pre-Publishing Checklist

Before publishing, ensure:

- [ ] Update version in `package.json` following [semver](https://semver.org/)
- [ ] Update `repository.url` in `package.json` with your GitHub URL
- [ ] Add your name/email to `author` field in `package.json`
- [ ] Review and update `README.md` with installation instructions
- [ ] Test the library build: `npm run build:lib`
- [ ] Commit all changes to git
- [ ] Create a git tag: `git tag v1.0.0`

## Publishing to npm

### First Time Publishing

1. **Update package.json with your details:**

```json
{
  "name": "three-collapse",
  "author": "Your Name <your.email@example.com>",
  "repository": {
    "type": "git",
    "url": "https://github.com/yourusername/three-collapse.git"
  }
}
```

2. **Check package name availability:**

```bash
npm search three-collapse
```

If the name is taken, consider alternatives like:

- `@yourusername/three-collapse` (scoped package)
- `three-wfc`
- `threejs-wfc`
- `wave-collapse-3d`

3. **Test what will be published:**

```bash
npm pack --dry-run
```

This shows what files will be included. The `.npmignore` file controls this.

4. **Build the library:**

```bash
npm run build:lib
```

5. **Publish to npm:**

```bash
# For public package
npm publish

# For scoped package (free on npm)
npm publish --access public
```

### Updating an Existing Package

1. **Make your changes**

2. **Update version** in `package.json`:

   - Patch: `1.0.0` → `1.0.1` (bug fixes)
   - Minor: `1.0.0` → `1.1.0` (new features, backward compatible)
   - Major: `1.0.0` → `2.0.0` (breaking changes)

   Or use npm's version command:

   ```bash
   npm version patch  # 1.0.0 -> 1.0.1
   npm version minor  # 1.0.0 -> 1.1.0
   npm version major  # 1.0.0 -> 2.0.0
   ```

3. **Commit and tag:**

   ```bash
   git add .
   git commit -m "Release v1.0.1"
   git tag v1.0.1
   git push origin main --tags
   ```

4. **Publish:**
   ```bash
   npm publish
   ```

## Using the Package Locally (Before Publishing)

### Method 1: npm link (Development)

In the `three-collapse` directory:

```bash
npm run build:lib
npm link
```

In your project directory:

```bash
npm link three-collapse
```

Now you can import and use it:

```typescript
import { WFC3D, WFCTile3D } from "three-collapse";
```

**To unlink:**

```bash
# In your project
npm unlink three-collapse

# In three-collapse directory
npm unlink
```

### Method 2: Local File Path

In your project's `package.json`:

```json
{
  "dependencies": {
    "three-collapse": "file:../path/to/three-collapse"
  }
}
```

Then run:

```bash
npm install
```

### Method 3: GitHub Installation

Push to GitHub, then install in other projects:

```bash
npm install git+https://github.com/yourusername/three-collapse.git

# Or specific branch/tag
npm install git+https://github.com/yourusername/three-collapse.git#main
npm install git+https://github.com/yourusername/three-collapse.git#v1.0.0
```

## Using After Publishing to npm

Once published, users can install it normally:

```bash
npm install three-collapse three
```

### Import in Projects

**ESM (Modern):**

```typescript
import { WFC3D, WFCTile3D, VoxelTile3DConfig } from "three-collapse";
```

**CommonJS (Node.js):**

```javascript
const { WFC3D, WFCTile3D } = require("three-collapse");
```

## Package Structure

When published, the package includes:

```
three-collapse/
├── dist/lib/                    # Built library files
│   ├── three-collapse.js       # ESM build
│   ├── three-collapse.cjs      # CommonJS build
│   ├── index.d.ts              # TypeScript types
│   └── ...                     # Other type files
├── src/                        # Source code (for sourcemaps)
├── README.md
└── LICENSE
```

## Scoped Package (@username/package)

If you want to publish under your username:

1. **Update package name:**

```json
{
  "name": "@yourusername/three-collapse"
}
```

2. **Publish with public access:**

```bash
npm publish --access public
```

3. **Users install with:**

```bash
npm install @yourusername/three-collapse
```

## Continuous Deployment (Optional)

### GitHub Actions

Create `.github/workflows/publish.yml`:

```yaml
name: Publish to npm

on:
  release:
    types: [created]

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: "18"
          registry-url: "https://registry.npmjs.org"

      - run: npm ci
      - run: npm run build:lib
      - run: npm test # If you have tests

      - run: npm publish
        env:
          NODE_AUTH_TOKEN: ${{secrets.NPM_TOKEN}}
```

Then add your npm token to GitHub secrets:

1. Generate token: https://www.npmjs.com/settings/tokens
2. Add to GitHub: Settings → Secrets → New repository secret
3. Name: `NPM_TOKEN`, Value: your token

## Unpublishing (Emergency Only)

**Warning:** Unpublishing is discouraged and only works within 72 hours.

```bash
npm unpublish three-collapse@1.0.0  # Specific version
npm unpublish three-collapse --force  # Entire package (within 72h)
```

Better approach: Deprecate instead:

```bash
npm deprecate three-collapse@1.0.0 "This version has critical bugs, use 1.0.1+"
```

## Version Management Best Practices

### Semantic Versioning (semver)

- **Major (X.0.0)**: Breaking changes

  - API changes that break existing code
  - Removed features
  - Changed behavior

- **Minor (0.X.0)**: New features (backward compatible)

  - New methods/classes
  - New optional parameters
  - Deprecated features (not removed)

- **Patch (0.0.X)**: Bug fixes
  - Bug fixes
  - Performance improvements
  - Documentation updates

### Pre-release Versions

For testing before official release:

```bash
# Alpha versions
npm version 1.0.0-alpha.1
npm publish --tag alpha

# Beta versions
npm version 1.0.0-beta.1
npm publish --tag beta

# Release candidate
npm version 1.0.0-rc.1
npm publish --tag rc

# Users install with:
npm install three-collapse@alpha
npm install three-collapse@beta
npm install three-collapse@rc
```

## Testing Before Publishing

### Local Testing

```bash
# Build the library
npm run build:lib

# Pack it (creates a .tgz file)
npm pack

# In another project, install from the tarball
npm install ../path/to/three-collapse-1.0.0.tgz
```

### Test in Isolated Environment

```bash
# Create test directory
mkdir /tmp/test-package
cd /tmp/test-package

# Initialize new project
npm init -y

# Install your local package
npm install /path/to/three-collapse

# Create test file
cat > test.js << 'EOF'
import { WFC3D } from 'three-collapse';
console.log('Import successful!', WFC3D);
EOF

# Run it
node test.js
```

## Common Issues

### "Cannot find module 'three-collapse'"

**Solution:** Ensure the package is built before linking/publishing:

```bash
npm run build:lib
```

### TypeScript types not found

**Solution:** Check that `types` field in package.json points to the correct `.d.ts` file:

```json
{
  "types": "./dist/lib/index.d.ts"
}
```

### Missing dependencies in published package

**Solution:** Check that dependencies are in `dependencies` or `peerDependencies`, not `devDependencies`.

### Package too large

**Solution:** Review `.npmignore` to exclude unnecessary files:

```bash
# Check package size
npm pack --dry-run

# See what files will be included
npm pack
tar -tzf three-collapse-1.0.0.tgz
```

## Documentation

After publishing, consider adding:

1. **Badges to README:**

```markdown
![npm version](https://img.shields.io/npm/v/three-collapse)
![npm downloads](https://img.shields.io/npm/dm/three-collapse)
![license](https://img.shields.io/npm/l/three-collapse)
```

2. **Online documentation** using:

   - GitHub Pages
   - TypeDoc (generates docs from TypeScript)
   - Docsify

3. **Examples and demos:**
   - CodeSandbox examples
   - Live demo site
   - GitHub repo with examples

## Support

- **Issues**: Use GitHub Issues for bug reports and feature requests
- **Discussions**: Enable GitHub Discussions for questions
- **Discord/Slack**: Optional community channels
- **Documentation**: Keep LIBRARY_USAGE.md up to date

## Checklist for First Release

- [ ] Build succeeds: `npm run build:lib`
- [ ] Package.json fields are correct (name, version, author, repository)
- [ ] README.md is comprehensive
- [ ] LICENSE file exists
- [ ] .npmignore excludes unnecessary files
- [ ] Committed to git and pushed to GitHub
- [ ] Tagged version: `git tag v1.0.0`
- [ ] Logged into npm: `npm login`
- [ ] Test with `npm pack --dry-run`
- [ ] Publish: `npm publish`
- [ ] Test installation in another project
- [ ] Create GitHub release with notes

---

**Ready to publish?**

```bash
npm run build:lib
npm publish
```

Good luck! 🚀
