# Bulk Shot Boundary Detection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Detect Shots" button to the search page that runs shot boundary detection on all unprocessed scenes in the current search results, sequentially, with live progress and cancel.

**Architecture:** All changes are confined to `src/app/search/page.tsx`. Local React state tracks run progress; a `useRef` tracks the cancel flag so the async loop always reads the current value. The existing `POST /api/shot-boundary/process` endpoint is reused per-scene. After completion or cancel, a re-search is dispatched to refresh results.

**Tech Stack:** Next.js 15, React, TypeScript, Redux Toolkit, Tailwind CSS

---

## File Structure

**Modified:**
- `src/app/search/page.tsx` — add imports (`useState`, `useRef`, `selectShotBoundaryConfig`), local state, cancel ref, `handleBulkDetectShots` handler, derived `unprocessedScenes` count, and button/progress UI in header

No new files. No new API routes. No Redux changes.

---

### Task 1: Add state, ref, config selector, and derived count

**Files:**
- Modify: `src/app/search/page.tsx`

- [ ] **Step 1: Add imports**

At the top of `src/app/search/page.tsx`, add `useState` and `useRef` to the React import, and add `selectShotBoundaryConfig` to the configSlice import:

```tsx
import { useCallback, useEffect, useState, useRef } from "react";
```

Add after the existing imports:

```tsx
import { selectShotBoundaryConfig } from "@/store/slices/configSlice";
import Toast from "@/app/components/Toast";
```

- [ ] **Step 2: Read config in component**

Inside `SearchPage()`, after the existing `useAppSelector` calls, add:

```tsx
const shotBoundaryConfig = useAppSelector(selectShotBoundaryConfig);
```

- [ ] **Step 3: Add local state and cancel ref**

Inside `SearchPage()`, after the config selector line:

```tsx
const [bulkDetect, setBulkDetect] = useState({
  running: false,
  current: 0,
  total: 0,
});
const cancelRequestedRef = useRef(false);

// Toast state for bulk detect errors
const [bulkToast, setBulkToast] = useState<{ message: string; type: "error" } | null>(null);
const showBulkToast = useCallback((message: string) => {
  setBulkToast({ message, type: "error" });
  // Toast auto-dismisses after 5s and calls onClose, which sets bulkToast to null
}, []);
```

- [ ] **Step 4: Derive unprocessed scene count**

Inside `SearchPage()`, after the state/ref declarations:

```tsx
const shotBoundaryProcessedId = shotBoundaryConfig.shotBoundaryProcessed;
const unprocessedScenes = scenes.filter(
  (scene) => !scene.tags?.some((t) => t.id === shotBoundaryProcessedId)
);
const showBulkDetectButton =
  !!shotBoundaryProcessedId &&
  scenes.length > 0 &&
  unprocessedScenes.length > 0;
```

- [ ] **Step 5: Type-check**

```bash
cd /data/docker/new-marker-studio/stash-marker-studio && npx tsc --noEmit
```

Expected: no errors. If you see errors about `scene.tags`, check the `Scene` type in `src/services/StashappService.ts` — it should already have `tags?: Array<{ id: string; name: string }>`.

- [ ] **Step 6: Commit**

```bash
git add src/app/search/page.tsx
git commit -m "feat(search): add bulk detect state, config selector, unprocessed count"
```

---

### Task 2: Add the run handler

**Files:**
- Modify: `src/app/search/page.tsx`

- [ ] **Step 1: Add handleBulkDetectShots**

Inside `SearchPage()`, after `handleSettingsClick`, add:

```tsx
const handleBulkDetectShots = useCallback(async () => {
  const scenesToProcess = scenes.filter(
    (scene) => !scene.tags?.some((t) => t.id === shotBoundaryProcessedId)
  );
  if (scenesToProcess.length === 0) return;

  cancelRequestedRef.current = false;
  setBulkDetect({ running: true, current: 1, total: scenesToProcess.length });

  for (let i = 0; i < scenesToProcess.length; i++) {
    if (cancelRequestedRef.current) break;

    setBulkDetect((prev) => ({ ...prev, current: i + 1 }));

    const scene = scenesToProcess[i];
    try {
      const response = await fetch("/api/shot-boundary/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sceneId: scene.id }),
      });
      const data = await response.json() as { success: boolean; error?: string };
      if (!data.success) {
        const title = scene.title ?? scene.files?.[0]?.basename ?? scene.id;
        showBulkToast(`Shot detection failed for ${title}: ${data.error ?? "Unknown error"}`);
      }
    } catch (err) {
      const title = scene.title ?? scene.files?.[0]?.basename ?? scene.id;
      const message = err instanceof Error ? err.message : String(err);
      showBulkToast(`Shot detection failed for ${title}: ${message}`);
    }
  }

  setBulkDetect({ running: false, current: 0, total: 0 });
  dispatch(searchScenes({ query, selectedTags, sortField, sortDirection }));
}, [scenes, shotBoundaryProcessedId, showBulkToast, dispatch, query, selectedTags, sortField, sortDirection]);

const handleCancelBulkDetect = useCallback(() => {
  cancelRequestedRef.current = true;
}, []);
```

- [ ] **Step 2: Type-check**

```bash
cd /data/docker/new-marker-studio/stash-marker-studio && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Lint**

```bash
cd /data/docker/new-marker-studio/stash-marker-studio && npm run lint
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/search/page.tsx
git commit -m "feat(search): add bulk shot detection run handler and cancel"
```

---

### Task 3: Add button and progress UI to header

**Files:**
- Modify: `src/app/search/page.tsx`

- [ ] **Step 1: Replace the header div**

Find the header section (currently `{/* Header with settings icon */}` comment, lines ~228–257). Replace it with:

```tsx
{/* Header with settings icon */}
<div className="flex items-center justify-between mb-6">
  <h1 className="text-2xl font-bold text-white">Scene Search</h1>
  <div className="flex items-center gap-2">
    {showBulkDetectButton && (
      bulkDetect.running ? (
        <div className="flex items-center gap-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
          <span className="text-sm text-white">
            Detecting... {bulkDetect.current} / {bulkDetect.total}
          </span>
          <button
            onClick={handleCancelBulkDetect}
            className="px-3 py-1 text-sm bg-gray-600 text-white rounded hover:bg-gray-500"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          onClick={handleBulkDetectShots}
          className="px-3 py-1.5 text-sm bg-purple-700 text-white rounded hover:bg-purple-600 transition-colors"
        >
          Detect Shots ({unprocessedScenes.length})
        </button>
      )
    )}
    <Link
      href="/config"
      onClick={handleSettingsClick}
      className="flex items-center justify-center w-10 h-10 text-gray-300 hover:text-white hover:bg-gray-700 rounded transition-colors"
      title="Configuration"
    >
      <svg
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
        />
      </svg>
    </Link>
  </div>
</div>
```

- [ ] **Step 2: Add Toast render**

Inside the main return, just before the closing `</div>` of the outer container, add:

```tsx
{bulkToast && (
  <Toast
    message={bulkToast.message}
    type={bulkToast.type}
    onClose={() => setBulkToast(null)}
  />
)}
```

- [ ] **Step 3: Type-check**

```bash
cd /data/docker/new-marker-studio/stash-marker-studio && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Lint**

```bash
cd /data/docker/new-marker-studio/stash-marker-studio && npm run lint
```

Expected: no errors.

- [ ] **Step 5: Smoke test manually**

Start the dev server (`npm run dev`) and open the search page. Verify:
- Button is hidden when no results or when all results have `shotBoundaryProcessed` tag
- Button shows `Detect Shots (N)` with correct count when unprocessed scenes exist
- Clicking runs the loop: spinner + progress label appear, settings gear stays visible
- Cancel stops after the current scene finishes
- After completion or cancel, results refresh

- [ ] **Step 6: Commit**

```bash
git add src/app/search/page.tsx
git commit -m "feat(search): add Detect Shots button with progress and cancel"
```

---

### Task 4: Final checks and push

- [ ] **Step 1: Run full lint + type-check**

```bash
cd /data/docker/new-marker-studio/stash-marker-studio && npm run lint && npx tsc --noEmit
```

Expected: no errors from either.

- [ ] **Step 2: Run tests**

```bash
cd /data/docker/new-marker-studio/stash-marker-studio && npm run test
```

Expected: all existing tests pass (no new tests required — this feature has no unit-testable pure logic; the behaviour is UI/integration).

- [ ] **Step 3: Push**

```bash
git push
```
