# HLS Video Player Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the direct `/stream` video source with HLS (`/stream.m3u8`) so that legacy formats like WMV and AVI transcode correctly in Safari while remaining fully functional in Chrome and Firefox.

**Architecture:** Install `hls.js`. In `VideoPlayer.tsx`, add a `useEffect` that detects native HLS support via `canPlayType` — Safari gets the URL set directly, all other browsers get an `Hls` instance attached to the video element. The `Hls` instance is destroyed on cleanup to prevent memory leaks. The `src` prop is removed from the `<video>` element since the effect manages the source.

**Tech Stack:** TypeScript, React, hls.js, Next.js

---

### Task 1: Install hls.js

**Files:**
- Modify: `package.json`, `package-lock.json`

- [ ] **Step 1: Install the package**

```bash
npm install hls.js
```

Expected output: `added 1 package` (or similar). `hls.js` bundles its own TypeScript types — no separate `@types/hls.js` needed.

- [ ] **Step 2: Verify TypeScript can resolve the types**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: add hls.js dependency for cross-browser HLS playback"
```

---

### Task 2: Switch VideoPlayer to HLS

**Files:**
- Modify: `src/components/marker/video/VideoPlayer.tsx`

The current file (127 lines) uses a plain `<video src={...}>` pointing at Stash's `/stream` endpoint. This task replaces that with HLS-based source management.

- [ ] **Step 1: Add the Hls import**

At the top of `src/components/marker/video/VideoPlayer.tsx`, add the import after the existing imports:

```ts
import Hls from "hls.js";
```

- [ ] **Step 2: Add the HLS setup effect**

Add the following `useEffect` after the volume-restore effect (after line 65, before the event-listener effect). It must depend on `scene`, `stashUrl`, and `stashApiKey`:

```ts
// Set up HLS source — handles both native HLS (Safari) and hls.js (Chrome/Firefox)
useEffect(() => {
  const video = videoRef.current;
  if (!video || !scene) return;

  const url = `${stashUrl}/scene/${scene.id}/stream.m3u8?apikey=${stashApiKey}`;

  if (video.canPlayType("application/vnd.apple.mpegurl")) {
    // Safari: native HLS support — set src directly
    video.src = url;
  } else if (Hls.isSupported()) {
    // Chrome, Firefox, etc.: use hls.js
    const hls = new Hls();
    hls.loadSource(url);
    hls.attachMedia(video);
    return () => hls.destroy();
  }
}, [scene, stashUrl, stashApiKey]);
```

- [ ] **Step 3: Remove the `src` prop from the `<video>` element**

Find the `<video>` JSX (around line 117). Remove the `src` prop — the effect now manages the source. The element should look like:

```tsx
<video
  ref={videoRef}
  controls
  className={`w-full h-full object-contain ${className}`}
  tabIndex={-1}
>
  Your browser does not support the video tag.
</video>
```

- [ ] **Step 4: Verify TypeScript compiles and lint passes**

```bash
npx tsc --noEmit && npm run lint
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/marker/video/VideoPlayer.tsx
git commit -m "feat: use HLS stream for cross-browser video playback including Safari"
```

---

### Task 3: Version bump

- [ ] **Step 1: Review commits since last tag**

```bash
git log $(git describe --tags --abbrev=0)..HEAD --oneline
```

This is a bug fix that restores Safari compatibility — patch version bump.

- [ ] **Step 2: Bump version**

```bash
npm version patch --no-git-tag-version
```

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: bump version to $(node -p "require('./package.json').version")"
```
