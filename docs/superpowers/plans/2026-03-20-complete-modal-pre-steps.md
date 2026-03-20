# Complete Modal Pre-Steps Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add "Delete rejected markers" and "Convert corresponding tags" checkboxes to the Complete modal so users can perform all three operations in one click.

**Architecture:** Add two new optional boolean fields to `CompletionDefaults` (the existing config type), pass rejected-marker count and corresponding-tags marker list into `CompletionModal` as new props, render the two checkboxes at the top of the modal's action list, and execute those steps inside `executeCompletionWrapper` in `page.tsx` before calling the existing `executeCompletion`.

**Tech Stack:** Next.js 15, TypeScript, Redux Toolkit, Tailwind CSS

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `src/serverConfig.ts` | **Modify** | Add `deleteRejected` and `convertCorrespondingTags` to `CompletionDefaults` type |
| `src/components/marker/CompletionModal.tsx` | **Modify** | Add two new props and two new checkboxes |
| `src/app/marker/[sceneId]/page.tsx` | **Modify** | Pass new props to `CompletionModal`; execute pre-steps in `executeCompletionWrapper` |

---

## Task 1: Extend `CompletionDefaults` type

**Files:**
- Modify: `src/serverConfig.ts`

The `CompletionDefaults` type drives both the modal checkboxes and the "Save as Default" feature. We add two new optional fields so existing configs without them still work (they default to `true` in the modal).

- [ ] **Step 1: Find `CompletionDefaults` in `src/serverConfig.ts`**

```bash
grep -n "CompletionDefaults" /data/docker/new-marker-studio/stash-marker-studio/src/serverConfig.ts
```

Read the type definition and note the exact shape.

- [ ] **Step 2: Add the two new optional fields**

Locate the `CompletionDefaults` interface/type and add:

```typescript
deleteRejected?: boolean;
convertCorrespondingTags?: boolean;
```

The fields are `optional` (`?`) so existing saved configs without them continue to work — the modal will default both to `true` when they are absent.

- [ ] **Step 3: Verify no type errors**

```bash
cd /data/docker/new-marker-studio/stash-marker-studio
npx tsc --noEmit 2>&1 | head -20
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add src/serverConfig.ts
git commit -m "feat: add deleteRejected and convertCorrespondingTags to CompletionDefaults"
```

---

## Task 2: Add new props and checkboxes to `CompletionModal`

**Files:**
- Modify: `src/components/marker/CompletionModal.tsx`

The modal needs to know how many rejected markers exist and how many markers have corresponding tags, so it can show counts and set sensible defaults.

- [ ] **Step 1: Read `CompletionModal.tsx` to understand the current props interface and checkbox list**

File: `src/components/marker/CompletionModal.tsx`
The props interface is at lines 7-16. The checkbox list starts around line 155.

- [ ] **Step 2: Add two new props to `CompletionModalProps`**

Add to the interface (after `tagsToRemove`):

```typescript
rejectedMarkersCount: number;
correspondingTagsCount: number;
```

And add to the destructured props list in the function signature.

- [ ] **Step 3: Update `useState` initial values to include the new fields**

The initial state (line 28) is:

```typescript
const [selectedActions, setSelectedActions] = useState<CompletionDefaults>({
  deleteVideoCutMarkers: true,
  generateMarkers: true,
  addAiReviewedTag: true,
  addPrimaryTags: true,
  removeCorrespondingTags: true,
});
```

Change to:

```typescript
const [selectedActions, setSelectedActions] = useState<CompletionDefaults>({
  deleteVideoCutMarkers: true,
  generateMarkers: true,
  addAiReviewedTag: true,
  addPrimaryTags: true,
  removeCorrespondingTags: true,
  deleteRejected: true,
  convertCorrespondingTags: true,
});
```

- [ ] **Step 4: Update `loadDefaults` to fill in the new fields with sensible defaults**

The `loadDefaults` function (line 43) sets `selectedActions` from config. When saved config doesn't have the new fields (old configs), they should default to `true`. Update `setSelectedActions` inside `loadDefaults`:

```typescript
setSelectedActions({
  deleteVideoCutMarkers: true,
  generateMarkers: true,
  addAiReviewedTag: true,
  addPrimaryTags: true,
  removeCorrespondingTags: true,
  deleteRejected: true,
  convertCorrespondingTags: true,
  ...config.completionDefaults,
});
```

This spreads the saved config on top of the defaults, so any missing fields stay `true`.

- [ ] **Step 5: Add the two new checkboxes at the TOP of the "Select which actions to perform" list**

Find the `<div className="space-y-3">` that contains the existing checkboxes. Add these two items **before** the existing `deleteVideoCutMarkers` checkbox:

```tsx
<div className="flex items-start space-x-3">
  <input
    type="checkbox"
    id="deleteRejected"
    checked={selectedActions.deleteRejected ?? true}
    onChange={() => handleActionToggle('deleteRejected')}
    className="mt-1 w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
  />
  <label htmlFor="deleteRejected" className="text-sm text-gray-300 flex-1">
    <span className="font-medium">Delete rejected markers</span>
    {rejectedMarkersCount > 0 ? (
      <span className="text-red-300"> ({rejectedMarkersCount} marker{rejectedMarkersCount !== 1 ? "s" : ""})</span>
    ) : (
      <span className="text-gray-500"> (none)</span>
    )}
  </label>
</div>

<div className="flex items-start space-x-3">
  <input
    type="checkbox"
    id="convertCorrespondingTags"
    checked={selectedActions.convertCorrespondingTags ?? true}
    onChange={() => handleActionToggle('convertCorrespondingTags')}
    className="mt-1 w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
  />
  <label htmlFor="convertCorrespondingTags" className="text-sm text-gray-300 flex-1">
    <span className="font-medium">Convert corresponding tags</span>
    {correspondingTagsCount > 0 ? (
      <span className="text-teal-300"> ({correspondingTagsCount} marker{correspondingTagsCount !== 1 ? "s" : ""})</span>
    ) : (
      <span className="text-gray-500"> (none)</span>
    )}
  </label>
</div>
```

- [ ] **Step 6: Verify type check and lint**

```bash
npx tsc --noEmit 2>&1 | head -20
npm run lint 2>&1 | tail -10
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/marker/CompletionModal.tsx
git commit -m "feat: add delete-rejected and convert-corresponding-tags checkboxes to Complete modal"
```

---

## Task 3: Wire up new props and execute pre-steps in `page.tsx`

**Files:**
- Modify: `src/app/marker/[sceneId]/page.tsx`

Two changes needed:
1. Pass `rejectedMarkersCount` and `correspondingTagsCount` to `<CompletionModal>`
2. Execute delete-rejected and convert-corresponding-tags steps in `executeCompletionWrapper` before calling `executeCompletion`

- [ ] **Step 1: Add missing imports to `page.tsx`**

`isMarkerRejected` and `isMarkerConfirmed` are NOT currently imported in `page.tsx`. Add them to the existing `markerLogic` import.

Find the current import (around line 72):
```typescript
import {
  formatSeconds,
  isShotBoundaryMarker,
  filterUnprocessedMarkers,
  getMarkerStatus,
} from "../../../core/marker/markerLogic";
```

Change to:
```typescript
import {
  formatSeconds,
  isShotBoundaryMarker,
  filterUnprocessedMarkers,
  getMarkerStatus,
  isMarkerRejected,
  isMarkerConfirmed,
} from "../../../core/marker/markerLogic";
```

- [ ] **Step 2: Pass new props to `<CompletionModal>`**

Find the `<CompletionModal>` JSX (around line 1168). It currently looks like:

```tsx
<CompletionModal
  isOpen={isCompletionModalOpen}
  completionWarnings={completionModalData?.warnings || []}
  videoCutMarkersToDelete={completionModalData?.videoCutMarkersToDelete || []}
  hasAiReviewedTag={completionModalData?.hasAiReviewedTag || false}
  primaryTagsToAdd={completionModalData?.primaryTagsToAdd || []}
  tagsToRemove={completionModalData?.tagsToRemove || []}
  onCancel={() => dispatch(closeModal())}
  onConfirm={executeCompletionWrapper}
/>
```

Add two new props:

- `rejectedMarkersCount` — count of rejected markers from `actionMarkers`
- `correspondingTagsCount` — count of confirmed markers whose primary tag description contains `"corresponding tag:"`. **Note:** this is the same approximation used by `MarkerPageHeader` for its button badge count. It may differ slightly from the number of markers actually converted by the service (which does a more precise remote lookup), but it is an acceptable estimate for the UI count display.

```tsx
<CompletionModal
  isOpen={isCompletionModalOpen}
  completionWarnings={completionModalData?.warnings || []}
  videoCutMarkersToDelete={completionModalData?.videoCutMarkersToDelete || []}
  hasAiReviewedTag={completionModalData?.hasAiReviewedTag || false}
  primaryTagsToAdd={completionModalData?.primaryTagsToAdd || []}
  tagsToRemove={completionModalData?.tagsToRemove || []}
  rejectedMarkersCount={actionMarkers?.filter(isMarkerRejected).length ?? 0}
  correspondingTagsCount={actionMarkers?.filter(m => isMarkerConfirmed(m) && (m.primary_tag.description ?? "").toLowerCase().includes("corresponding tag:")).length ?? 0}
  onCancel={() => dispatch(closeModal())}
  onConfirm={executeCompletionWrapper}
/>
```

- [ ] **Step 3: Execute pre-steps in `executeCompletionWrapper`**

Find `executeCompletionWrapper` (around line 450). It currently reads:

```typescript
const executeCompletionWrapper = useCallback(async (selectedActions: import("../../../serverConfig").CompletionDefaults) => {
  const modalData = completionModalData;
  if (!modalData) return;
  dispatch(closeModal());
  await executeCompletion(modalData.videoCutMarkersToDelete, selectedActions);
}, [executeCompletion, completionModalData, dispatch]);
```

Replace with:

```typescript
const executeCompletionWrapper = useCallback(async (selectedActions: import("../../../serverConfig").CompletionDefaults) => {
  const modalData = completionModalData;
  if (!modalData) return;
  dispatch(closeModal());

  // Pre-step A: Delete rejected markers (if selected)
  if (selectedActions.deleteRejected) {
    const rejected = actionMarkers?.filter(isMarkerRejected) ?? [];
    if (rejected.length > 0) {
      try {
        await stashappService.deleteMarkers(rejected.map(m => m.id));
        if (scene?.id) await dispatch(loadMarkers(scene.id)).unwrap();
      } catch (err) {
        console.error("Error deleting rejected markers during completion:", err);
        dispatch(setError(`Failed to delete rejected markers: ${err}`));
        return;
      }
    }
  }

  // Pre-step B: Convert corresponding tags (if selected)
  // Note: this intentionally duplicates the logic from handleConfirmCorrespondingTagConversion
  // in useMarkerOperations — that function relies on pre-fetched Redux modal state, which is
  // not available here after the modal is closed. Inline duplication is intentional.
  if (selectedActions.convertCorrespondingTags) {
    const currentActionMarkers = actionMarkers ?? [];
    try {
      const markersToConvert = await stashappService.convertConfirmedMarkersWithCorrespondingTags(currentActionMarkers);
      for (const { sourceMarker, correspondingTag } of markersToConvert) {
        await stashappService.updateMarkerTagAndTitle(sourceMarker.id, correspondingTag.id);
      }
      if (scene?.id && markersToConvert.length > 0) await dispatch(loadMarkers(scene.id)).unwrap();
    } catch (err) {
      console.error("Error converting corresponding tags during completion:", err);
      dispatch(setError(`Failed to convert corresponding tags: ${err}`));
      return;
    }
  }

  await executeCompletion(modalData.videoCutMarkersToDelete, selectedActions);
}, [executeCompletion, completionModalData, dispatch, actionMarkers, scene]);
```

**Important:** `stashappService` is already imported/available in `page.tsx` (it's a singleton imported at the top). Verify:

```bash
grep -n "stashappService" src/app/marker/\[sceneId\]/page.tsx | head -3
```

Also check that `loadMarkers` and `setError` are imported from `markerSlice`:

```bash
grep -n "loadMarkers\|setError" src/app/marker/\[sceneId\]/page.tsx | head -5
```

- [ ] **Step 4: Verify type check and lint**

```bash
npx tsc --noEmit 2>&1 | head -30
npm run lint 2>&1 | tail -10
```

Expected: no errors.

- [ ] **Step 5: Run all tests**

```bash
npm test -- --no-coverage 2>&1 | tail -15
```

Expected: all passing.

- [ ] **Step 6: Commit**

```bash
git add "src/app/marker/[sceneId]/page.tsx"
git commit -m "feat: execute delete-rejected and convert-tags pre-steps from Complete modal"
```

---

## Task 4: Smoke Test

- [ ] **Step 1: Rebuild Docker container**

```bash
cd /data/docker/new-marker-studio/stash-marker-studio
docker compose up -d --build 2>&1 | tail -5
```

- [ ] **Step 2: Manual smoke test**

1. Open a scene with rejected markers and markers with corresponding tags
2. Click **Complete** — confirm the modal now shows "Delete rejected markers" and "Convert corresponding tags" checkboxes at the top
3. Verify counts are shown next to each checkbox label
4. Confirm both are checked by default
5. Click **Save as Default** — reopen the modal, confirm checkboxes are restored
6. With both checked, click **Complete** — verify rejected markers are gone, corresponding tags are converted, and normal completion steps run
7. Uncheck both and click **Complete** — verify only the normal completion steps run (rejected markers and corresponding tags unchanged)

- [ ] **Step 3: Final type check**

```bash
npx tsc --noEmit && npm run lint
```

Expected: clean.
