# Undo Last Action — Design Spec

**Date:** 2026-03-31

## Overview

Add a single-level undo shortcut (`Ctrl+Z` / `Cmd+Z`) that reverses the most recent undoable marker action, including navigation to a different marker.

## Scope

### Undoable actions

| Action | Snapshot captured | How to undo |
|---|---|---|
| `confirmMarker` | Previous marker (with tags) | `resetMarker` or `rejectMarker` based on prior tag state |
| `rejectMarker` | Previous marker (with tags) | `resetMarker` or `confirmMarker` based on prior tag state |
| `resetMarker` | Previous marker (with tags) | Re-`confirmMarker` or re-`rejectMarker` based on prior tag state |
| `updateMarkerTimes` | Previous `seconds` and `end_seconds` | `updateMarkerTimes` with old values |
| `setSelectedMarkerId` | Previous selected marker ID | `setSelectedMarkerId` with old value (no API call) |

### Not undoable (out of scope)

- Marker creation, deletion, split
- Copy/paste times
- Corresponding tag conversion
- Scene tag updates (completion flow)
- Video seek, zoom, modal actions

## Architecture

### Snapshot storage

A module-level variable in the middleware file holds the single snapshot:

```ts
type UndoSnapshot =
  | { type: 'markerState'; selectedMarkerId: string | null; marker: SceneMarker }
  | { type: 'navigation'; previousSelectedMarkerId: string | null };
```

This is transient — not in Redux state, not persisted across page refresh. It is replaced on every new undoable action and cleared after a successful undo.

### Middleware (`src/store/middleware/undoMiddleware.ts`)

A Redux middleware that intercepts actions before they are processed:

- For `confirmMarker`, `rejectMarker`, `resetMarker`, `updateMarkerTimes` (all async thunk `.pending` actions): read the current marker from state and save a `markerState` snapshot.
- For `setSelectedMarkerId`: save a `navigation` snapshot with the previous selected marker ID.
- All other actions: pass through without touching the snapshot.

### Undo thunk (`undoLastAction`)

Added to `markerSlice`. On dispatch:

1. Read the snapshot.
2. If no snapshot: dispatch a toast "Nothing to undo" and return.
3. If `navigation` snapshot: dispatch `setSelectedMarkerId` with the saved ID, clear snapshot.
4. If `markerState` snapshot:
   - If marker no longer exists in current state: show toast "Cannot undo — marker no longer exists", clear snapshot, return.
   - Determine the correct reverse thunk based on the saved marker's tag state (confirmed → reset/reject, rejected → reset/confirm, unprocessed → re-apply the change).
   - Dispatch the reverse thunk.
   - On success: clear snapshot.
   - On failure: show error toast, leave snapshot in place so user can retry.

### Keyboard shortcut

- New action ID: `system.undo`
- Key binding: `Ctrl+Z` (the existing code treats `Cmd` as `Ctrl`, so Mac is covered automatically)
- Registered in `KeyboardShortcutService` alongside existing system shortcuts
- Handled in `useDynamicKeyboardShortcuts` `actionHandlers` map

## Behavior

- **Undo navigation**: instant, no API call, snaps selected marker back to previous.
- **Undo marker state change**: calls Stashapp API, reloads markers on success.
- **Nothing to undo**: brief toast notification, no other effect.
- **Undo fails**: error toast, snapshot preserved so user can retry.
- **Marker deleted before undo**: toast "Cannot undo — marker no longer exists", snapshot cleared.
- Each successful undo clears the snapshot — there is no double-undo.

## Files to change

- `src/store/middleware/undoMiddleware.ts` — new file
- `src/store/index.ts` — register middleware
- `src/store/slices/markerSlice.ts` — add `undoLastAction` thunk
- `src/services/KeyboardShortcutService.ts` — register `system.undo` action and default `Ctrl+Z` binding
- `src/hooks/useDynamicKeyboardShortcuts.ts` — add handler for `system.undo`
