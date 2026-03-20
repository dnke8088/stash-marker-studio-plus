# Marker Time Editing — Design Spec

**Date:** 2026-03-20
**Status:** Approved

## Overview

Extend the existing inline marker edit form (triggered by the pencil icon) to include editable start and end time fields alongside the existing tag autocomplete. Users can also stamp the current video playhead position into either time field via "Set to current" buttons.

## Current Behavior

Clicking the pencil icon on a marker replaces the marker row with a `TagAutocomplete` input that lets the user change the primary tag. Saving calls `updateMarkerTagAndTitle()` via the `updateMarkerTag` Redux thunk.

## New Behavior

### Layout

The edit row expands inline with all fields in a single row:

```
[start time input] [▶ set] → [end time input] [▶ set]   [tag autocomplete]   [Save] [Cancel]
```

- **Start time input** — editable text field, format `M:SS.mmm` (e.g. `0:12.000`)
- **Set to current (start)** — small button that stamps the video playhead's current position into the start field
- **End time input** — editable text field, same format; may be empty if marker has no end time
- **Set to current (end)** — small button that stamps the video playhead's current position into the end field
- **Tag autocomplete** — existing `TagAutocomplete` component, unchanged
- **Save / Cancel** — existing buttons

### Time Format

Display and input format: `M:SS.mmm` (e.g. `0:12.000`, `1:04.500`). For markers at 60 minutes or beyond, the minutes field grows as needed (e.g. `65:00.000`) — no hours component.

The existing `formatSeconds()` in `markerLogic.ts` outputs `MM:SS.mmm` with zero-padded minutes and handles hours separately. A new utility `formatSecondsForInput()` will be added to `src/core/marker/timeFormat.ts` that outputs without zero-padded minutes and without an hours component, since marker times in practice are always expressed as total minutes:seconds.

- On load: convert `marker.seconds` / `marker.end_seconds` (float) → `M:SS.mmm` string via `formatSecondsForInput()`
- On save: parse `M:SS.mmm` string → float seconds via `parseTimeString()`
- Validation: reject non-parseable values (red border, no submit); reject `startTime >= endTime` when both fields are non-empty; reject `startTime <= 0` or `endTime <= 0` (see Pre-existing Bug note below)

### "Set to Current" Button

`MarkerListItem` will read the playhead position directly via `useAppSelector(selectCurrentVideoTime)`, consistent with how `page.tsx` reads the same value. The formatted string is written into the corresponding time input.

### Save Strategy

On save, two thunks are called sequentially if needed — matching the existing pattern in `page.tsx`:

1. `updateMarkerTag` — if the tag changed (existing thunk, unchanged)
2. `updateMarkerTimes` — if either time changed (existing thunk, unchanged)

Change detection for times:
- Start: `parsedStart !== marker.seconds`
- End: `parsedEnd !== (marker.end_seconds ?? null)` — treat `undefined` and `null` as equivalent empty states to avoid spurious API calls when end time was already absent

Empty end time field → pass `null` to `updateMarkerTimes`. `StashappService.updateMarkerTimes()` already accepts `number | null`.

**Note:** Because each thunk independently dispatches `loadMarkers`, a combined tag+time edit causes two sequential marker reloads with a brief intermediate state (new tag, old times) between them. This is an accepted tradeoff of the single-purpose thunk design.

### Pre-existing Bug in `StashappService.updateMarkerTimes()`

`updateMarkerTimes()` uses a falsy check `endSeconds ? ... : null` which would silently convert an `endSeconds` of `0` to `null`. To avoid this becoming reachable via the new UI, validation should reject any time value `<= 0`. The service-layer bug itself should be fixed as part of this feature: change the falsy check to an explicit null check (`endSeconds !== null ? ... : null`).

## Time Utility Functions

New file: `src/core/marker/timeFormat.ts`

```typescript
// seconds (float) → "M:SS.mmm" without zero-padded minutes, no hours component
export function formatSecondsForInput(s: number): string

// "M:SS.mmm" or "MM:SS.mmm" → seconds (float)
// throws on invalid input
export function parseTimeString(s: string): number
```

## Components Affected

### `src/core/marker/timeFormat.ts` (new)
- `formatSecondsForInput()` and `parseTimeString()` pure utilities

### `src/services/StashappService.ts`
- Fix falsy check in `updateMarkerTimes()`: `endSeconds !== null ? Math.round(endSeconds * 1000) / 1000 : null`

### `src/components/marker/MarkerListItem.tsx`
- Add `startTimeStr` and `endTimeStr` local state (strings), initialized from `marker.seconds` / `marker.end_seconds` when edit mode is entered
- Add `useAppSelector(selectCurrentVideoTime)` to read the playhead position
- Render the two time inputs, "Set to current" buttons, and validation error state when `isEditing`
- Update `MarkerListItemProps`: extend `onSaveEditWithTagId` signature to `(marker: SceneMarker, tagId?: string, startSeconds?: number, endSeconds?: number | null) => Promise<void>`

### `src/components/marker/MarkerList.tsx`
- Update `onSaveEditWithTagId` prop interface to match the new signature above

### `src/app/marker/[sceneId]/page.tsx`
- Extend the `useCallback` lambda parameter list of `handleSaveEditWithTagId` from `(marker, tagId?)` to `(marker, tagId?, startSeconds?: number, endSeconds?: number | null)`
- Inside the callback: after updating the tag (if changed), call `dispatch(updateMarkerTimes(...))` if either time changed (using the change detection formula above)

### `src/store/slices/markerSlice.ts`
- No changes — both `updateMarkerTag` and `updateMarkerTimes` thunks used as-is

## Error Handling

- Non-parseable time string: red border on the offending field, save blocked
- `startTime >= endTime` (when both non-empty): red border on start field, save blocked
- `startTime <= 0` or `endTime <= 0`: red border on offending field, save blocked
- GraphQL errors: handled by existing thunk error handling

## Known Gaps (future work)

- No keyboard shortcuts to stamp playhead time while the edit row is open (the app is keyboard-first; this could be a follow-up)
