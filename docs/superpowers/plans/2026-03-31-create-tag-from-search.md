# Create Tag from Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Create tag" option to tag search dropdowns in the marker list and completion modal page 2, matching how Stash itself handles unknown tag names.

**Architecture:** Merge `TagAutocomplete` and `ConfigTagAutocomplete` into a single component with optional `onTagCreated`/`disabled` props. Add `addAvailableTag` to Redux. Wire the new props through `MarkerListItem`, `TempMarkerForm`, and replace the bespoke inline search in `CompletionModal` page 2 with `TagAutocomplete`.

**Tech Stack:** Next.js 15, TypeScript, Redux Toolkit, Tailwind CSS, Jest

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/components/marker/TagAutocomplete.tsx` | Modify | Add `onTagCreated`, `disabled` props + create-tag logic |
| `src/components/settings/ConfigTagAutocomplete.tsx` | Replace | Re-export alias pointing to `TagAutocomplete` |
| `src/store/slices/markerSlice.ts` | Modify | Add `addAvailableTag` reducer action |
| `src/components/marker/MarkerListItem.tsx` | Modify | Dispatch `addAvailableTag` via `onTagCreated` on both inline edit and TempMarkerForm |
| `src/components/marker/TempMarkerForm.tsx` | Modify | Thread `onTagCreated` prop through to `TagAutocomplete` |
| `src/components/marker/CompletionModal.tsx` | Modify | Replace bespoke page-2 search with `TagAutocomplete`; wire `onTagCreated` |

---

## Task 1: Add `addAvailableTag` to Redux markerSlice

**Files:**
- Modify: `src/store/slices/markerSlice.ts`

- [ ] **Step 1: Add the reducer action**

In `src/store/slices/markerSlice.ts`, locate the `reducers` object inside `createSlice` (around line 763). Add after `setAvailableTags`:

```ts
addAvailableTag: (state, action: PayloadAction<Tag>) => {
  state.availableTags.push(action.payload);
},
```

- [ ] **Step 2: Export the new action**

In the `export const {` block (around line 1260), add `addAvailableTag` alongside `setAvailableTags`:

```ts
export const {
  setMarkers,
  setScene,
  setAvailableTags,
  addAvailableTag,   // ← add this line
  setSelectedMarkerId,
  // ... rest unchanged
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/store/slices/markerSlice.ts
git commit -m "feat: add addAvailableTag reducer action to markerSlice"
```

---

## Task 2: Merge `TagAutocomplete` — add `onTagCreated` and `disabled` props

**Files:**
- Modify: `src/components/marker/TagAutocomplete.tsx`

This task adds the create-tag capability from `ConfigTagAutocomplete` into `TagAutocomplete`. When `onTagCreated` is absent the component behaves exactly as before.

- [ ] **Step 1: Update the props interface and add `isCreating` state**

Replace the existing `TagAutocompleteProps` interface and the `TagAutocomplete` function signature with:

```tsx
interface TagAutocompleteProps {
  value: string;
  onChange: (tagId: string) => void;
  availableTags: Tag[];
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
  onSave?: (tagId?: string) => void;
  onCancel?: () => void;
  onTagCreated?: (tag: Tag) => void;
  disabled?: boolean;
}

export function TagAutocomplete({
  value,
  onChange,
  availableTags,
  placeholder = "Type to search tags...",
  className = "",
  autoFocus = false,
  onSave,
  onCancel,
  onTagCreated,
  disabled = false,
}: TagAutocompleteProps) {
```

Add the `isCreating` state alongside the other state declarations (after `const [shouldAutoOpen, ...]`):

```tsx
const [isCreating, setIsCreating] = useState(false);
```

- [ ] **Step 2: Add `handleCreateTag` function**

Add this function after `handleSelectTag` (around line 154):

```tsx
const handleCreateTag = async () => {
  if (!inputValue.trim() || isCreating || !onTagCreated) return;

  setIsCreating(true);
  try {
    const newTag = await stashappService.createTag(inputValue.trim());
    onTagCreated(newTag);
    handleSelectTag(newTag);
  } catch (error) {
    console.error("Failed to create tag:", error);
  } finally {
    setIsCreating(false);
  }
};
```

- [ ] **Step 3: Update the import to include `stashappService`**

At the top of the file, the existing import is:
```tsx
import { type Tag } from "../../services/StashappService";
```

Change it to:
```tsx
import { type Tag, stashappService } from "../../services/StashappService";
```

- [ ] **Step 4: Update `handleInputChange` to respect `disabled`**

Replace the existing `handleInputChange`:

```tsx
const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  if (disabled) return;
  const newValue = e.target.value;
  setInputValue(newValue);
  setIsOpen(true);
  setSelectedIndex(-1);
  checkDropdownDirection();
};
```

- [ ] **Step 5: Update `handleInputFocus` to respect `disabled`**

Replace the existing `handleInputFocus`:

```tsx
const handleInputFocus = () => {
  if (disabled) return;
  if (shouldAutoOpen) {
    setIsOpen(true);
    checkDropdownDirection();
    setShouldAutoOpen(false);
  }
};
```

- [ ] **Step 6: Update `handleKeyDown` to support create option**

Replace the existing `handleKeyDown`:

```tsx
const handleKeyDown = (e: React.KeyboardEvent) => {
  if (e.key === "ArrowDown") {
    e.preventDefault();
    const totalOptions =
      filteredTags.length + (showCreateOption ? 1 : 0);
    setSelectedIndex((prev) =>
      prev < totalOptions - 1 ? prev + 1 : prev
    );
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
  } else if (e.key === "Enter") {
    e.preventDefault();
    if (selectedIndex >= 0 && selectedIndex < filteredTags.length) {
      handleSelectTag(filteredTags[selectedIndex]);
    } else if (filteredTags.length > 0 && selectedIndex < filteredTags.length) {
      handleSelectTag(filteredTags[0]);
    } else if (showCreateOption && (selectedIndex === filteredTags.length || filteredTags.length === 0)) {
      void handleCreateTag();
    } else if (filteredTags.length > 0) {
      handleSelectTag(filteredTags[0]);
    } else {
      if (onSave) onSave();
    }
  } else if (e.key === "Escape") {
    setIsOpen(false);
    setSelectedIndex(-1);
    inputRef.current?.blur();
    if (onCancel) {
      onCancel();
    }
  }
};
```

- [ ] **Step 7: Add `showCreateOption` derived value**

Add this line just before the `return (` statement:

```tsx
const showCreateOption = !!onTagCreated && filteredTags.length === 0 && !!inputValue.trim();
```

- [ ] **Step 8: Update the JSX — input element**

Update the `<input>` element to use `disabled`:

```tsx
<input
  ref={inputRef}
  type="text"
  className={`w-full bg-gray-700 text-white px-2 py-1 rounded-sm ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
  value={inputValue}
  onChange={handleInputChange}
  onFocus={handleInputFocus}
  onKeyDown={handleKeyDown}
  placeholder={placeholder}
  autoComplete="off"
  disabled={disabled}
/>
```

- [ ] **Step 9: Update the JSX — dropdown with create option**

Replace the entire dropdown section (the two `{isOpen && ...}` blocks after the `<input>`) with:

```tsx
{isOpen && (filteredTags.length > 0 || showCreateOption) && (
  <div
    ref={dropdownRef}
    className={`absolute z-50 w-full bg-gray-700 border border-gray-600 rounded-sm shadow-lg max-h-48 overflow-y-auto ${
      openUpward ? "bottom-full mb-1" : "top-full mt-1"
    }`}
  >
    {filteredTags.map((tag, index) => (
      <div
        key={tag.id}
        className={`px-3 py-2 cursor-pointer text-white ${
          index === selectedIndex ? "bg-blue-600" : "hover:bg-gray-600"
        }`}
        onClick={() => handleSelectTag(tag)}
        title={tag.description || undefined}
      >
        <div className="font-medium">{tag.name}</div>
      </div>
    ))}
    {showCreateOption && (
      <div
        className={`px-3 py-2 cursor-pointer text-white border-t border-gray-600 ${
          selectedIndex === filteredTags.length ? "bg-blue-600" : "hover:bg-gray-600"
        } ${isCreating ? "opacity-50 cursor-not-allowed" : ""}`}
        onClick={isCreating ? undefined : () => void handleCreateTag()}
      >
        <div className="font-medium text-green-400">
          {isCreating ? "Creating..." : `Create "${inputValue}"`}
        </div>
      </div>
    )}
  </div>
)}
{isOpen && filteredTags.length === 0 && inputValue && !showCreateOption && (
  <div
    ref={dropdownRef}
    className={`absolute z-50 w-full bg-gray-700 border border-gray-600 rounded-sm shadow-lg ${
      openUpward ? "bottom-full mb-1" : "top-full mt-1"
    }`}
  >
    <div className="px-3 py-2 text-gray-400">
      No tags found matching &quot;{inputValue}&quot;
    </div>
  </div>
)}
```

- [ ] **Step 10: Export the props type**

Add this line just before the interface declaration so callers can reference it:

```tsx
export type { TagAutocompleteProps };
```

Actually, place `export` directly on the interface:

```tsx
export interface TagAutocompleteProps {
```

- [ ] **Step 11: Type-check and lint**

```bash
npx tsc --noEmit && npm run lint
```

Expected: no errors.

- [ ] **Step 12: Commit**

```bash
git add src/components/marker/TagAutocomplete.tsx
git commit -m "feat: add onTagCreated and disabled props to TagAutocomplete"
```

---

## Task 3: Replace `ConfigTagAutocomplete` with re-export alias

**Files:**
- Modify: `src/components/settings/ConfigTagAutocomplete.tsx`

- [ ] **Step 1: Replace the entire file contents**

```tsx
"use client";

export { TagAutocomplete as ConfigTagAutocomplete } from "../marker/TagAutocomplete";
export type { TagAutocompleteProps as ConfigTagAutocompleteProps } from "../marker/TagAutocomplete";
```

- [ ] **Step 2: Verify settings pages still compile**

```bash
npx tsc --noEmit
```

Expected: no errors. The settings pages import `ConfigTagAutocomplete` by name — the re-export keeps that name intact.

- [ ] **Step 3: Lint**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/settings/ConfigTagAutocomplete.tsx
git commit -m "refactor: make ConfigTagAutocomplete a re-export alias of TagAutocomplete"
```

---

## Task 4: Wire `onTagCreated` in `TempMarkerForm`

**Files:**
- Modify: `src/components/marker/TempMarkerForm.tsx`

- [ ] **Step 1: Add `onTagCreated` to the props interface and function signature**

The current interface is:
```tsx
interface TempMarkerFormProps {
  marker: SceneMarker;
  availableTags: Tag[];
  videoElement: HTMLVideoElement | null;
  onSave: (start: number, end: number | null, tagId: string) => void;
  onCancel: () => void;
  isDuplicate?: boolean;
}
```

Replace with:
```tsx
interface TempMarkerFormProps {
  marker: SceneMarker;
  availableTags: Tag[];
  videoElement: HTMLVideoElement | null;
  onSave: (start: number, end: number | null, tagId: string) => void;
  onCancel: () => void;
  isDuplicate?: boolean;
  onTagCreated?: (tag: Tag) => void;
}
```

Update the function signature destructuring:
```tsx
export function TempMarkerForm({
  marker,
  availableTags,
  videoElement,
  onSave,
  onCancel,
  isDuplicate = false,
  onTagCreated,
}: TempMarkerFormProps) {
```

- [ ] **Step 2: Pass `onTagCreated` to `TagAutocomplete`**

Find the `<TagAutocomplete` usage in `TempMarkerForm` (around line 95). Add the `onTagCreated` prop:

```tsx
<TagAutocomplete
  value={tagId}
  onChange={setTagId}
  availableTags={availableTags}
  placeholder={
    isDuplicate
      ? `Duplicating: ${marker.primary_tag.name}`
      : "Type to search tags..."
  }
  className="flex-1"
  autoFocus={true}
  onSave={(selectedTagId) => {
    if (selectedTagId) {
      onSave(
        parseTimeColonDot(start),
        end === "" ? null : parseTimeColonDot(end),
        selectedTagId
      );
    }
  }}
  onTagCreated={onTagCreated}
/>
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/marker/TempMarkerForm.tsx
git commit -m "feat: thread onTagCreated prop through TempMarkerForm to TagAutocomplete"
```

---

## Task 5: Wire `onTagCreated` in `MarkerListItem`

**Files:**
- Modify: `src/components/marker/MarkerListItem.tsx`

- [ ] **Step 1: Import `addAvailableTag`**

At the top of the file, find the import from `markerSlice`:

```tsx
import {
  setMarkers,
  setSelectedMarkerId,
  setCreatingMarker,
  setDuplicatingMarker,
  setError,
  createMarker,
} from "../../store/slices/markerSlice";
```

Add `addAvailableTag`:

```tsx
import {
  setMarkers,
  setSelectedMarkerId,
  setCreatingMarker,
  setDuplicatingMarker,
  setError,
  createMarker,
  addAvailableTag,
} from "../../store/slices/markerSlice";
```

- [ ] **Step 2: Add `onTagCreated` callback where `TagAutocomplete` is used in inline edit**

Find the `<TagAutocomplete` in the inline edit row (inside the `isEditing` branch, around line 277). Add `onTagCreated`:

```tsx
<TagAutocomplete
  value={editingTagId}
  onChange={setEditingTagId}
  availableTags={availableTags}
  placeholder="Type to search tags..."
  className="flex-1 min-w-32"
  autoFocus={isEditing}
  onCancel={onCancelEdit}
  onSave={(tagId) => handleSaveEdit(tagId)}
  onTagCreated={(tag) => dispatch(addAvailableTag(tag))}
/>
```

- [ ] **Step 3: Pass `onTagCreated` to `TempMarkerForm`**

Find the `<TempMarkerForm` usage (inside the `isTemp` branch, around line 143). Add `onTagCreated`:

```tsx
<TempMarkerForm
  marker={marker}
  availableTags={availableTags}
  videoElement={videoElementRef.current}
  onSave={async (newStart, newEnd, newTagId) => {
    // ... existing onSave body unchanged ...
  }}
  onCancel={() => {
    // ... existing onCancel body unchanged ...
  }}
  isDuplicate={marker.id === "temp-duplicate"}
  onTagCreated={(tag) => dispatch(addAvailableTag(tag))}
/>
```

- [ ] **Step 4: Type-check and lint**

```bash
npx tsc --noEmit && npm run lint
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/marker/MarkerListItem.tsx
git commit -m "feat: dispatch addAvailableTag from MarkerListItem on tag creation"
```

---

## Task 6: Replace bespoke search in `CompletionModal` page 2 with `TagAutocomplete`

**Files:**
- Modify: `src/components/marker/CompletionModal.tsx`

- [ ] **Step 1: Add imports**

At the top of the file, find the existing imports:

```tsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import { SceneMarker, Tag, stashappService } from "../../services/StashappService";
import { CompletionDefaults } from "../../serverConfig";
```

Add the new imports:

```tsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import { SceneMarker, Tag, stashappService } from "../../services/StashappService";
import { CompletionDefaults } from "../../serverConfig";
import { TagAutocomplete } from "./TagAutocomplete";
import { useAppDispatch } from "../../store/hooks";
import { addAvailableTag } from "../../store/slices/markerSlice";
```

- [ ] **Step 2: Add `dispatch` and a tag search key inside the component**

The component currently uses `stashappService` directly and has no Redux access. Add `dispatch` at the top of the component body, after the existing `useState` declarations:

```tsx
const dispatch = useAppDispatch();
```

Also add a key state to force-reset `TagAutocomplete` after a tag is selected (since `value=""` always, we need to reset the internal input):

```tsx
const [tagSearchKey, setTagSearchKey] = useState(0);
```

- [ ] **Step 3: Remove `tagSearchInput`, `tagHighlightedIndex`, and `tagSearchRef`**

Remove these three state/ref declarations:
```tsx
// DELETE these:
const [tagSearchInput, setTagSearchInput] = useState("");
const [tagHighlightedIndex, setTagHighlightedIndex] = useState(-1);
const tagSearchRef = useRef<HTMLInputElement>(null);
```

Also remove the `tagSearchInput` reset in the `isOpen` effect:
```tsx
// In the useEffect that runs when isOpen:
setTagSearchInput("");   // DELETE this line
```

And remove the focus call that used `tagSearchRef`:
```tsx
// In the currentPage === "page2" useEffect, DELETE:
setTimeout(() => tagSearchRef.current?.focus(), 50);
```

- [ ] **Step 4: Remove `tagSuggestions` derived variable**

In the page 2 render section, remove:

```tsx
// DELETE this block:
const tagSuggestions: Tag[] =
  tagSearchInput.length < 2
    ? []
    : allTags.filter(t =>
        !t.name.endsWith("_AI") &&
        t.name.toLowerCase().includes(tagSearchInput.toLowerCase()) &&
        !effectivePrimaryTagsToAdd.some(p => p.id === t.id)
      ).slice(0, 10);
```

- [ ] **Step 5: Replace the bespoke `<input>` + `<ul>` search block with `<TagAutocomplete>`**

The existing block is the `<div className="mt-4 relative">` containing the `<input ref={tagSearchRef} ...>` and `{tagSuggestions.length > 0 && (<ul ...>)}`.

Replace the entire `<div className="mt-4 relative">` block with:

```tsx
<div className="mt-4">
  <TagAutocomplete
    key={tagSearchKey}
    value=""
    onChange={() => {}}
    availableTags={allTags.filter(t =>
      !t.name.endsWith("_AI") &&
      !effectivePrimaryTagsToAdd.some(p => p.id === t.id)
    )}
    placeholder="Search tags to add…"
    className="w-full"
    autoFocus={true}
    onSave={(tagId) => {
      if (!tagId) return;
      const tag = allTags.find(t => t.id === tagId);
      if (!tag) return;
      setManualTagsToAdd(prev => [...prev, tag]);
      setTagSearchKey(k => k + 1);
    }}
    onTagCreated={(tag) => {
      setAllTags(prev => [...prev, tag]);
      setManualTagsToAdd(prev => [...prev, tag]);
      dispatch(addAvailableTag(tag));
      setTagSearchKey(k => k + 1);
    }}
  />
</div>
```

- [ ] **Step 6: Type-check and lint**

```bash
npx tsc --noEmit && npm run lint
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/marker/CompletionModal.tsx
git commit -m "feat: replace CompletionModal page-2 search with TagAutocomplete, add create-tag support"
```

---

## Task 7: Run all tests and verify

- [ ] **Step 1: Run the full test suite**

```bash
npm run test
```

Expected: all existing tests pass. No tests exercise `TagAutocomplete` directly in unit tests (the component is UI-only), so no test changes should be needed unless a snapshot test exists.

- [ ] **Step 2: Check for snapshot tests**

```bash
grep -r "toMatchSnapshot\|toMatchInlineSnapshot" src/
```

If any snapshot tests reference `TagAutocomplete`, update them:

```bash
npm run test -- --updateSnapshot
```

- [ ] **Step 3: Final type-check and lint**

```bash
npx tsc --noEmit && npm run lint
```

Expected: no errors.

- [ ] **Step 4: Final commit if any snapshot updates were needed**

```bash
git add -A
git commit -m "test: update snapshots for TagAutocomplete merge"
```

(Skip if no snapshots were updated.)
