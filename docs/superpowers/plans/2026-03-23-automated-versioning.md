# Automated Versioning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the app footer version auto-sync with `package.json`, and configure `npm version` with Conventional Commits-style commit messages and convenience release scripts.

**Architecture:** Read the version from `package.json` in `next.config.js` using `readFileSync` anchored to `import.meta.url` (correct ESM path resolution) and pass it as `NEXT_PUBLIC_APP_VERSION` — baked in at build time, works regardless of how the build is invoked. An `.npmrc` file configures the `npm version` commit message format. Two `package.json` scripts (`release:patch`, `release:minor`) wrap `npm version` for convenience.

**Tech Stack:** Node.js `npm version`, Next.js env vars via `next.config.js`, `.npmrc`

---

### Task 1: Expose version from `package.json` via Next.js config

**Files:**
- Modify: `next.config.js`

- [ ] **Step 1: Update `next.config.js` to read version from `package.json`**

The file uses ES module syntax (`export default`). Use `readFileSync` with a path anchored to `import.meta.url` so it resolves correctly regardless of the working directory at build time. The version is baked in as a static value at build time (not runtime).

Replace the full contents of `next.config.js` with:

```js
/** @type {import('next').NextConfig} */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const { version } = JSON.parse(readFileSync(join(__dirname, 'package.json'), 'utf-8'));

const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  distDir: process.env.BUILD_DIR || '.next',
  env: {
    NEXT_PUBLIC_APP_VERSION: version,
  },
  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "**",
      },
      {
        protocol: "https",
        hostname: "**",
      },
    ],
    unoptimized: true, // Since we're dealing with local Stash server images
  },
};

export default nextConfig;
```

- [ ] **Step 2: Smoke-test the build**

```bash
npm run build
```

Expected: build completes without errors. This confirms the config change is valid end-to-end before touching any other files.

- [ ] **Step 3: Commit**

```bash
git add next.config.js
git commit -m "build: pass package.json version to client via NEXT_PUBLIC_APP_VERSION"
```

---

### Task 2: Replace hardcoded version string in `ClientLayout.tsx`

**Files:**
- Modify: `src/app/ClientLayout.tsx`

The footer only appears on config pages (the `shouldApplyGuard === false` branch). There is one footer element in that branch with a hardcoded version string.

- [ ] **Step 1: Replace hardcoded version string**

In `src/app/ClientLayout.tsx`, find:

```tsx
              Stash Marker Studio Plus v2.4.0
```

Replace with:

```tsx
              Stash Marker Studio Plus v{process.env.NEXT_PUBLIC_APP_VERSION}
```

- [ ] **Step 2: Verify lint and type-check pass**

```bash
npm run lint && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/ClientLayout.tsx
git commit -m "feat(footer): eliminate hardcoded version — footer now stays in sync with package.json"
```

---

### Task 3: Configure `.npmrc` for Conventional Commits-style version commits

**Files:**
- Create: `.npmrc`

By default `npm version` creates a commit message like `2.4.1` and a tag `v2.4.1`. We want the commit to follow the project's Conventional Commits style: `chore: bump version to X.Y.Z`.

- [ ] **Step 1: Check if `.npmrc` already exists**

```bash
cat .npmrc 2>/dev/null && echo "EXISTS — merge settings manually" || echo "does not exist, safe to create"
```

If it already exists, add the two lines below to it rather than replacing it.

- [ ] **Step 2: Create (or append to) `.npmrc`**

```ini
message=chore: bump version to %s
tag-version-prefix=v
```

`%s` is replaced by the bare semver string (e.g. `2.4.1`, no `v` prefix). The git tag will be `v2.4.1`.

When `npm version` runs it updates both `package.json` and `package-lock.json` and includes both in the version bump commit automatically.

- [ ] **Step 3: Verify the config is picked up**

```bash
npm config get message
```

Expected:
```
chore: bump version to %s
```

- [ ] **Step 4: Commit**

```bash
git add .npmrc
git commit -m "chore: configure npm version commit message format"
```

---

### Task 4: Add `release:patch` and `release:minor` scripts to `package.json`

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add release scripts**

In `package.json`, add to the `"scripts"` block:

```json
"release:patch": "npm version patch",
"release:minor": "npm version minor"
```

- [ ] **Step 2: Verify lint and type-check still pass**

```bash
npm run lint && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "chore: add release:patch and release:minor npm scripts"
```

---

### Task 5: Push and rebuild

- [ ] **Step 1: Push all commits**

```bash
git push
```

- [ ] **Step 2: Rebuild Docker image and restart container**

```bash
docker compose build && docker compose up -d
```

- [ ] **Step 3: Verify footer shows the current version dynamically**

Check the current version:
```bash
node -p "require('./package.json').version"
```

Open the app config page in a browser and confirm the footer shows `Stash Marker Studio Plus v<that version>`.

---

## Usage Going Forward

To bump the patch version (bug fixes, small changes):
```bash
npm run release:patch
git push --follow-tags
```

To bump the minor version (new features):
```bash
npm run release:minor
git push --follow-tags
```

`npm version` will:
1. Update `package.json` and `package-lock.json`
2. Create a commit: `chore: bump version to X.Y.Z`
3. Create a git tag: `vX.Y.Z`

Then `git push --follow-tags` pushes both the commit and the tag. The footer will reflect the new version after the next Docker build.
