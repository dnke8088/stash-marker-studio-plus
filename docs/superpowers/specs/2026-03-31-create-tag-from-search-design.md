# Design: Create Tag from Search

**Date:** 2026-03-31  
**Status:** Approved

## Overview

When a user types a tag name in the marker list tag search or the completion modal page 2 tag search and no matching tag exists, add a "Create" option — matching how Stash itself handles this. Selecting it creates the tag in Stashapp and immediately uses it.

## Scope

Two tag search surfaces get the create-tag capability:

1. **Marker list inline edit** — `TagAutocomplete` in `MarkerListItem`
2. **New/duplicate marker form** — `TagAutocomplete` in `TempMarkerForm`
3. **Completion modal page 2** — bespoke inline search replaced with `TagAutocomplete`

Settings pages (`ConfigTagAutocomplete` usages) are unaffected — they already have this feature.

## Component Architecture

### Merge `TagAutocomplete` ← `ConfigTagAutocomplete`

The two components are nearly identical — they diverged when create-tag was added to the settings variant. Merge them: add `onTagCreated` and `disabled` props to `TagAutocomplete`, incorporating the create-tag logic from `ConfigTagAutocomplete`.

**New `TagAutocomplete` props:**
```ts
onTagCreated?: (tag: Tag) => void  // opt-in: enables create option in dropdown
disabled?: boolean                  // default false
```

When `onTagCreated` is provided and the search input has text but no matching tags, the dropdown shows a `Create "{inputValue}"` option (green text) as the last item. It is keyboard-navigable via arrow keys and selectable via Enter or click. A loading state ("Creating...") disables the option during the async call.

When `onTagCreated` is absent, the "No tags found" message behavior is unchanged.

### `ConfigTagAutocomplete` becomes a re-export alias

```ts
// src/components/settings/ConfigTagAutocomplete.tsx
export { TagAutocomplete as ConfigTagAutocomplete } from "../marker/TagAutocomplete";
export type { TagAutocompleteProps as ConfigTagAutocompleteProps } from "../marker/TagAutocomplete";
```

All settings pages (`basic/page.tsx`, `shot-boundary/page.tsx`, `MarkerGroupSettings.tsx`) continue to import `ConfigTagAutocomplete` with no changes needed.

## Redux Integration

Add a synchronous action to `markerSlice`:

```ts
addAvailableTag: (state, action: PayloadAction<Tag>) => {
  state.availableTags.push(action.payload);
}
```

This is exported alongside `setAvailableTags`. No thunk needed.

## Wiring: Marker List and TempMarkerForm

`MarkerListItem` dispatches `addAvailableTag` in its `onTagCreated` callback, passed to both:
- `TagAutocomplete` in the inline edit row
- `TempMarkerForm` (which gets a new `onTagCreated?: (tag: Tag) => void` prop, passed straight through to its `TagAutocomplete`)

The page (`marker/[sceneId]/page.tsx`) does not need changes — `MarkerListItem` already has Redux dispatch access.

## Wiring: CompletionModal Page 2

The bespoke inline search (`<input>` + manual filtering + `<ul>`) is replaced with `TagAutocomplete`.

**Filtering:** The `availableTags` prop passed to `TagAutocomplete` is computed as:
```ts
allTags.filter(t =>
  !t.name.endsWith("_AI") &&
  !effectivePrimaryTagsToAdd.some(p => p.id === t.id)
)
```

**On tag selected:** `TagAutocomplete` calls `onSave(tagId)` after a tag is selected. The modal uses this as the trigger to add the tag to `manualTagsToAdd` and reset the search input. Since the modal adds tags to a list rather than holding a single selection, `value` is always `""` and `onChange` is a no-op — `onSave` is the sole signal that a tag was chosen.

**On tag created (`onTagCreated`):**
1. Add tag to local `allTags` state (so it's available in future searches within the same modal session)
2. Add tag to `manualTagsToAdd` (immediately queue it for addition to the scene)
3. Dispatch `addAvailableTag` to Redux (global session persistence)

**Minimum-character restriction removed:** The existing `tagSearchInput.length < 2` guard is dropped — `TagAutocomplete` shows results on any non-empty input.

## Keyboard Behavior

In `TagAutocomplete`, when `onTagCreated` is provided:
- Arrow Down past the last matching tag highlights the Create option
- Enter on the Create option calls `handleCreateTag()`
- Enter with no matches and no explicit highlight also calls `handleCreateTag()` (same as how `ConfigTagAutocomplete` works today)

## Error Handling

On create failure: log to console, set `isCreating` back to false, leave the input unchanged so the user can retry. No error toast (consistent with existing `ConfigTagAutocomplete` behavior).

## Files Changed

| File | Change |
|------|--------|
| `src/components/marker/TagAutocomplete.tsx` | Add `onTagCreated`, `disabled` props; incorporate create-tag logic from `ConfigTagAutocomplete` |
| `src/components/settings/ConfigTagAutocomplete.tsx` | Replace with re-export alias |
| `src/store/slices/markerSlice.ts` | Add `addAvailableTag` reducer action |
| `src/components/marker/MarkerListItem.tsx` | Pass `onTagCreated` to `TagAutocomplete` and `TempMarkerForm`; dispatch `addAvailableTag` |
| `src/components/marker/TempMarkerForm.tsx` | Add `onTagCreated` prop, pass through to `TagAutocomplete` |
| `src/components/marker/CompletionModal.tsx` | Replace inline page-2 search with `TagAutocomplete`; wire `onTagCreated` |

Settings pages (`basic/page.tsx`, `shot-boundary/page.tsx`, `MarkerGroupSettings.tsx`) require no changes.
