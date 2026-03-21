# Spec: Bulk Shot Boundary Detection on Search Page

**Date:** 2026-03-21
**Status:** Approved

## Overview

Add a "Detect Shots" button to the search page that runs PySceneDetect on all scenes in the current search results that have not yet been processed (i.e. do not have the `shotBoundaryProcessed` tag). Scenes are processed sequentially with live progress feedback and a cancel option.

## Scope

- New UI in the search page header
- No new API routes — reuses the existing `POST /api/shot-boundary/process` endpoint
- No new Redux slices — transient run state is local React state in the search page component
- No changes to the search query — scene `tags` are already fetched

## Button Visibility and Label

The button is shown in the search page header (right side, left of the settings gear) when **all** of the following are true:
- `shotBoundaryConfig.shotBoundaryProcessed` is non-empty (use `selectShotBoundaryConfig` selector)
- There are scenes in the current search results
- At least one scene does not have the `shotBoundaryProcessed` tag

If the tag ID is not configured, the button is hidden entirely.

**Labels:**
- Idle: `Detect Shots (N)` where N is the count of unprocessed scenes in current results
- Running: `Detecting... X / N` with a spinner, where X is `current` from state (1-based, starts at 1 before first API call). The `current: 0` initial state is never shown — state is set to `current: 1` before the loop body begins.
- Cancel button appears next to the progress label while running

After a run completes or is cancelled, dispatch a re-search using the current Redux search parameters (`query`, `selectedTags`, `sortField`, `sortDirection` from Redux state at that moment). Re-searching after cancel is intentional — it refreshes the count even for partial runs.

## Local State and Refs

```ts
// useState for display
const [bulkDetect, setBulkDetect] = useState({
  running: false,
  current: 0,
  total: 0,
});

// useRef for cancel flag — must be a ref so the async loop sees current value
const cancelRequestedRef = useRef(false);
```

The cancel flag **must** use `useRef` (not `useState`) because the run loop is an async function that would otherwise capture a stale closure value of a state variable.

## Run Flow

1. User clicks "Detect Shots (N)"
2. Compute `unprocessedScenes`: scenes in current results whose `tags` array does not include `shotBoundaryProcessed` tag ID
3. If `unprocessedScenes.length === 0`, return (no-op guard)
4. Reset `cancelRequestedRef.current = false`
5. Set state: `{ running: true, current: 1, total: unprocessedScenes.length }`
6. Loop over `unprocessedScenes` with index `i` (0-based):
   a. If `cancelRequestedRef.current === true`, break
   b. Set state: `current = i + 1`
   c. Call `POST /api/shot-boundary/process` with `{ sceneId: scene.id }`
   d. On error: show toast `"Shot detection failed for [title]: [error]"` (see Scene Title below), continue to next iteration
7. Set state: `running: false`
8. Dispatch re-search with current Redux search parameters

## Cancel Behaviour

- "Cancel" button appears next to progress label while running
- Clicking Cancel sets `cancelRequestedRef.current = true`
- Cancel is checked at the top of each iteration (step 6a), before the API call
- The scene currently being processed always finishes — no in-flight request is aborted
- Re-search fires after cancel (step 8) to refresh the unprocessed count

## Error Handling

- Per-scene errors: toast `"Shot detection failed for [title]: [message]"`, continue
- If `shotBoundaryProcessed` tag ID is not configured, button is hidden — no runtime guard needed
- API-side config errors (e.g. missing shot boundary tag IDs in app-config.json) surface as per-scene error messages from the existing route and are handled by the per-scene toast

## Config Selector

Use `selectShotBoundaryConfig` from `@/store/slices/configSlice` to read `shotBoundaryConfig.shotBoundaryProcessed`.

## Scene Title in Toast

`scene.title ?? scene.files?.[0]?.basename ?? scene.id` — matches the fallback pattern already used in the search page scene list.

## Files to Change

- `src/app/search/page.tsx` — primary change: button, local state, ref, and run loop
- No new API routes, Redux slices, or shared components required. Existing toast and spinner patterns from the page are reused.
