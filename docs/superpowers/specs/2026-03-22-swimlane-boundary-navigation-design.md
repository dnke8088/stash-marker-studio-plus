# Spec: Swim Lane Boundary Navigation

**Date:** 2026-03-22
**Status:** Approved

## Overview

Currently, the `m` and `n` keyboard shortcuts navigate between unprocessed markers within the current swim lane (right and left respectively). When they hit the boundary (first or last unprocessed marker in the lane), they stay put.

This feature extends the navigation to automatically cross swim lane boundaries. When `m` reaches the rightmost unprocessed marker in the current swim lane and is pressed again, it jumps to the first unprocessed marker in the next swim lane down. When `n` reaches the leftmost unprocessed marker and is pressed again, it jumps to the last unprocessed marker in the next swim lane up.

## Behavior

### Forward Navigation (`m` key)

- When the user presses `m` and there is an unprocessed marker forward in the current swim lane, navigate to it.
- When the user presses `m` at or after the rightmost unprocessed marker in the current swim lane:
  - Search the next swim lane down (swimlane index + 1) from its first marker for an unprocessed marker.
  - If found, navigate to it.
  - If the next swim lane has no unprocessed markers, continue searching further swim lanes down.
  - If the current swim lane is the last swim lane or no unprocessed marker is found anywhere, return `null` (stay put).

### Backward Navigation (`n` key)

- When the user presses `n` and there is an unprocessed marker backward in the current swim lane, navigate to it.
- When the user presses `n` at or before the leftmost unprocessed marker in the current swim lane:
  - Search the next swim lane up (swimlane index - 1) from its last marker for an unprocessed marker.
  - If found, navigate to it.
  - If the previous swim lane has no unprocessed markers, continue searching further swim lanes up.
  - If the current swim lane is the first swim lane or no unprocessed marker is found anywhere, return `null` (stay put).

### No-wrap Boundary Behavior

- `m` at last unprocessed marker of last swim lane → `null` (stay put)
- `n` at first unprocessed marker of first swim lane → `null` (stay put)

## Implementation

### Context

`findNextUnprocessedMarkerInSwimlane` is called by the `navigation.nextUnprocessedInSwimlane` keyboard action (`m` key, bound in `useDynamicKeyboardShortcuts.ts`). `findPreviousUnprocessedMarkerInSwimlane` is called by `navigation.previousUnprocessedInSwimlane` (`n` key). These are **modified in-place** — the keyboard wiring stays unchanged.

The existing `findNextUnprocessedGlobal` and `findPreviousUnprocessedGlobal` functions are separate (used by `Shift+M` / `Shift+N`) and are **not changed**.

### Functions to Modify

#### `findNextUnprocessedMarkerInSwimlane` (lines 194–233 in `src/hooks/useMarkerNavigation.ts`)

**Current behavior:** Searches forward in the current swim lane for an unprocessed marker. If none found, returns `selectedMarkerId` (stay put). **The return value changes to `null` at the boundary** — callers already handle `null` as a no-op.

**New behavior:**
1. Search forward in the current swim lane for an unprocessed marker.
2. If found, return it.
3. If no unprocessed marker is found after the current position in the current swim lane:
   - Get the next swim lane down (swimlane index + 1).
   - If no next swim lane exists, return `null`.
   - Search the next swim lane from its first marker (sorted ascending by time) for an unprocessed marker.
   - If found, return it.
   - If not found, repeat for further swim lanes down.
4. If no unprocessed marker is found in any swim lane down, return `null`.

#### `findPreviousUnprocessedMarkerInSwimlane` (lines 236–286 in `src/hooks/useMarkerNavigation.ts`)

**Current behavior:** Searches backward in the current swim lane. If none found, wraps to the end of the same swim lane (this wrap behavior should be removed). If still none, returns `null`. **The `selectedMarkerId` stay-put return is replaced by `null` at all hard boundaries** — callers already handle `null` as a no-op.

**New behavior:**
1. Search backward in the current swim lane for an unprocessed marker.
2. If found, return it.
3. If no unprocessed marker is found before the current position in the current swim lane:
   - Get the next swim lane up (swimlane index - 1).
   - If no previous swim lane exists, return `null`.
   - Search the previous swim lane from its last marker (sorted descending by time) for an unprocessed marker.
   - If found, return it.
   - If not found, repeat for further swim lanes up.
4. If no unprocessed marker is found in any swim lane up, return `null`.

## Files to Change

| File | Change |
|------|--------|
| `src/hooks/useMarkerNavigation.ts` | Update `findNextUnprocessedMarkerInSwimlane` and `findPreviousUnprocessedMarkerInSwimlane` |

## What Does NOT Change

- Keyboard shortcut wiring (`src/hooks/useDynamicKeyboardShortcuts.ts`) — unchanged
- `navigateWithinSwimlane` (used by arrow keys) — unchanged
- `navigateBetweenSwimlanes` — unchanged
- All other navigation functions — unchanged
- No new files, no new Redux state, no new API routes

## Backward Compatibility

This change is backward compatible. It extends the current behavior without breaking existing functionality:

- Markers within the same swim lane are navigated the same way as before.
- The keyboard shortcuts remain the same (`m` and `n`).
- No API or state management changes are required.
- Users who do not press the shortcut again at the boundary will see no difference in behavior.

## Testing Considerations

- Test forward navigation across swim lane boundaries with multiple swim lanes.
- Test backward navigation across swim lane boundaries with multiple swim lanes.
- Test staying put when at the first/last swim lane with the boundary marker selected.
- Test behavior when intermediate swim lanes have no unprocessed markers (should skip to the next swim lane with unprocessed markers).
- Test with single swim lane (should stay put at boundaries).
