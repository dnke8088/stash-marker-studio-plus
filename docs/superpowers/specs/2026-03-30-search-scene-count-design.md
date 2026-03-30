# Search Page Scene Count

**Date:** 2026-03-30

## Overview

When filters are active on the search page, show a "Showing X of Y scenes" line between the filter chips and the results grid. X is the total number of scenes matching the current filters (not capped at 200), Y is the total number of scenes in Stash.

## Behaviour

- The count line appears only when at least one filter is active (text query or one or more selected tags).
- When no filters are active, the line is hidden.
- While a search is loading, the line is hidden.
- X reflects the true total match count from Stash (the GraphQL `count` field), not the 200-scene display limit.
- Y is fetched fresh on every search alongside the filtered query.

## Data Layer

### New service method

`StashappService` gets a new method `getTotalSceneCount(): Promise<number>` that calls `findScenes` with `per_page: 0` and no filters, returning only the `count` field. This is the cheapest way to get the total — Stash returns count without fetching scene data.

### Updated Redux thunk

The `searchScenes` thunk fires both requests in parallel:

```ts
const [scenesResult, totalCount] = await Promise.all([
  stashappService.searchScenes(...),
  stashappService.getTotalSceneCount(),
]);
```

It returns `{ scenes, filteredCount, totalCount }` where `filteredCount` comes from `scenesResult.findScenes.count` (already present in the GraphQL response but previously discarded).

### Updated Redux state

Two new fields added to `SearchState`:

```ts
filteredCount: number | null;  // null until first search
totalCount: number | null;     // null until first search
```

Both are set to `null` on `searchScenes.pending` and populated on `searchScenes.fulfilled`. A new selector `selectSceneCounts` exposes both.

## UI Layer

In `search/page.tsx`, below the tag filter chips and above the results grid (after the error block), add:

```tsx
{!loading && hasFilters && filteredCount !== null && totalCount !== null && (
  <p className="text-sm text-gray-400 mb-4">
    Showing <span className="text-white font-semibold">{filteredCount.toLocaleString()}</span> of <span className="text-white font-semibold">{totalCount.toLocaleString()}</span> scenes
  </p>
)}
```

`hasFilters` is true when `query.trim()` is non-empty or `selectedTags.length > 0`. Numbers are formatted with `toLocaleString()` for readability (e.g., 1,203).

No new component is needed.

## Files Changed

- `src/services/StashappService.ts` — add `getTotalSceneCount()`
- `src/store/slices/searchSlice.ts` — add state fields, update thunk, add selector
- `src/app/search/page.tsx` — render count line
