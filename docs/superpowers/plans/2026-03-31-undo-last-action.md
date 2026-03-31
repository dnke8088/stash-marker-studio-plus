# Undo Last Action Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a single-level `Ctrl+Z` undo shortcut that reverses the most recent undoable marker action, including navigation.

**Architecture:** A new Redux middleware (`undoMiddleware`) intercepts undoable actions before they execute and saves a snapshot of the pre-action state to a module-level variable. A new `undoLastAction` thunk reads the snapshot and dispatches the appropriate reversal. The `system.undo` keyboard shortcut is wired up in `KeyboardShortcutService` and `useDynamicKeyboardShortcuts`.

**Tech Stack:** Redux Toolkit middleware, TypeScript, Jest

---

## File Map

| File | Change |
|---|---|
| `src/store/middleware/undoMiddleware.ts` | **Create** — snapshot logic + exported `clearUndoSnapshot` / `getUndoSnapshot` |
| `src/store/slices/markerSlice.ts` | **Modify** — add `undoLastAction` thunk |
| `src/store/index.ts` | **Modify** — register `undoMiddleware` |
| `src/config/defaultKeyboardShortcuts.ts` | **Modify** — add `system.undo` shortcut entry |
| `src/hooks/useDynamicKeyboardShortcuts.ts` | **Modify** — add `system.undo` handler |
| `src/store/middleware/undoMiddleware.test.ts` | **Create** — unit tests for snapshot logic |

---

## Task 1: Create `undoMiddleware` with snapshot logic

**Files:**
- Create: `src/store/middleware/undoMiddleware.ts`
- Create: `src/store/middleware/undoMiddleware.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/store/middleware/undoMiddleware.test.ts`:

```typescript
import { SceneMarker } from '../../services/StashappService';
import {
  getUndoSnapshot,
  clearUndoSnapshot,
  undoMiddleware,
  UndoSnapshot,
} from './undoMiddleware';

// Minimal SceneMarker for testing
const makeMarker = (id: string, seconds = 10, end_seconds = 30): SceneMarker => ({
  id,
  seconds,
  end_seconds,
  primary_tag: { id: 'tag1', name: 'Tag One' },
  tags: [],
  scene: { id: 'scene1', title: 'Scene', files: [] },
  title: '',
  created_at: '',
  updated_at: '',
  stream: '',
  screenshot: '',
});

const makeStore = (selectedMarkerId: string | null, markers: SceneMarker[]) => ({
  getState: () => ({
    marker: {
      ui: { selectedMarkerId },
      markers,
    },
  }),
});

const next = jest.fn((action) => action);

beforeEach(() => {
  clearUndoSnapshot();
  next.mockClear();
});

describe('undoMiddleware', () => {
  describe('setSelectedMarkerId', () => {
    it('saves a navigation snapshot before the action fires', () => {
      const store = makeStore('marker-A', []);
      const middleware = undoMiddleware(store as never)(next);

      middleware({ type: 'marker/setSelectedMarkerId', payload: 'marker-B' });

      const snapshot = getUndoSnapshot();
      expect(snapshot).toEqual({
        type: 'navigation',
        previousSelectedMarkerId: 'marker-A',
      });
    });

    it('passes the action to next', () => {
      const store = makeStore('marker-A', []);
      const middleware = undoMiddleware(store as never)(next);
      const action = { type: 'marker/setSelectedMarkerId', payload: 'marker-B' };

      middleware(action);

      expect(next).toHaveBeenCalledWith(action);
    });
  });

  describe('confirmMarker.pending', () => {
    it('saves a markerState snapshot with the current marker', () => {
      const marker = makeMarker('marker-A');
      const store = makeStore('marker-A', [marker]);
      const middleware = undoMiddleware(store as never)(next);

      middleware({
        type: 'marker/confirmMarker/pending',
        meta: { arg: { markerId: 'marker-A', sceneId: 'scene1' } },
      });

      const snapshot = getUndoSnapshot();
      expect(snapshot).toEqual({
        type: 'markerState',
        selectedMarkerId: 'marker-A',
        marker,
      });
    });
  });

  describe('rejectMarker.pending', () => {
    it('saves a markerState snapshot with the current marker', () => {
      const marker = makeMarker('marker-B');
      const store = makeStore('marker-B', [marker]);
      const middleware = undoMiddleware(store as never)(next);

      middleware({
        type: 'marker/rejectMarker/pending',
        meta: { arg: { markerId: 'marker-B', sceneId: 'scene1' } },
      });

      const snapshot = getUndoSnapshot();
      expect(snapshot).toMatchObject({ type: 'markerState', marker });
    });
  });

  describe('resetMarker.pending', () => {
    it('saves a markerState snapshot with the current marker', () => {
      const marker = makeMarker('marker-C');
      const store = makeStore('marker-C', [marker]);
      const middleware = undoMiddleware(store as never)(next);

      middleware({
        type: 'marker/resetMarker/pending',
        meta: { arg: { markerId: 'marker-C', sceneId: 'scene1' } },
      });

      const snapshot = getUndoSnapshot();
      expect(snapshot).toMatchObject({ type: 'markerState', marker });
    });
  });

  describe('updateMarkerTimes.pending', () => {
    it('saves a markerState snapshot with the current marker', () => {
      const marker = makeMarker('marker-D', 5, 25);
      const store = makeStore('marker-D', [marker]);
      const middleware = undoMiddleware(store as never)(next);

      middleware({
        type: 'marker/updateMarkerTimes/pending',
        meta: { arg: { markerId: 'marker-D', sceneId: 'scene1', startTime: 10, endTime: 30 } },
      });

      const snapshot = getUndoSnapshot();
      expect(snapshot).toMatchObject({ type: 'markerState', marker });
    });
  });

  describe('unrelated actions', () => {
    it('does not overwrite the snapshot for non-undoable actions', () => {
      const marker = makeMarker('marker-A');
      const store = makeStore('marker-A', [marker]);
      const middleware = undoMiddleware(store as never)(next);

      // First set a real snapshot
      middleware({ type: 'marker/setSelectedMarkerId', payload: 'marker-B' });
      const snapshotBefore = getUndoSnapshot();

      // Then fire a non-undoable action
      middleware({ type: 'video/seekToTime', payload: 42 });

      expect(getUndoSnapshot()).toEqual(snapshotBefore);
    });
  });

  describe('clearUndoSnapshot', () => {
    it('clears the snapshot', () => {
      const store = makeStore('marker-A', []);
      const middleware = undoMiddleware(store as never)(next);
      middleware({ type: 'marker/setSelectedMarkerId', payload: 'marker-B' });

      clearUndoSnapshot();

      expect(getUndoSnapshot()).toBeNull();
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /data/docker/new-marker-studio/stash-marker-studio
npx jest src/store/middleware/undoMiddleware.test.ts --no-coverage 2>&1 | tail -20
```

Expected: FAIL — `Cannot find module './undoMiddleware'`

- [ ] **Step 3: Create the middleware**

Create `src/store/middleware/undoMiddleware.ts`:

```typescript
import { Middleware } from '@reduxjs/toolkit';
import type { SceneMarker } from '../../services/StashappService';

export type UndoSnapshot =
  | { type: 'navigation'; previousSelectedMarkerId: string | null }
  | { type: 'markerState'; selectedMarkerId: string | null; marker: SceneMarker };

// Module-level snapshot — transient, not persisted
let snapshot: UndoSnapshot | null = null;

export function getUndoSnapshot(): UndoSnapshot | null {
  return snapshot;
}

export function clearUndoSnapshot(): void {
  snapshot = null;
}

// Action types that trigger a markerState snapshot (thunk .pending variants)
const MARKER_STATE_ACTIONS = new Set([
  'marker/confirmMarker/pending',
  'marker/rejectMarker/pending',
  'marker/resetMarker/pending',
  'marker/updateMarkerTimes/pending',
]);

interface AppStateSlice {
  marker: {
    ui: { selectedMarkerId: string | null };
    markers: SceneMarker[];
  };
}

export const undoMiddleware: Middleware<object, AppStateSlice> = (store) => (next) => (action) => {
  if (typeof action !== 'object' || !action || !('type' in action)) {
    return next(action);
  }

  const actionType = (action as { type: string }).type;

  if (actionType === 'marker/setSelectedMarkerId') {
    const state = store.getState();
    snapshot = {
      type: 'navigation',
      previousSelectedMarkerId: state.marker.ui.selectedMarkerId,
    };
  } else if (MARKER_STATE_ACTIONS.has(actionType)) {
    const state = store.getState();
    const meta = (action as { meta?: { arg?: { markerId?: string } } }).meta;
    const markerId = meta?.arg?.markerId;
    if (markerId) {
      const marker = state.marker.markers.find((m) => m.id === markerId);
      if (marker) {
        snapshot = {
          type: 'markerState',
          selectedMarkerId: state.marker.ui.selectedMarkerId,
          marker,
        };
      }
    }
  }

  return next(action);
};
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest src/store/middleware/undoMiddleware.test.ts --no-coverage 2>&1 | tail -20
```

Expected: All tests PASS

- [ ] **Step 5: Run lint and type check**

```bash
npm run lint -- --quiet && npx tsc --noEmit
```

Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add src/store/middleware/undoMiddleware.ts src/store/middleware/undoMiddleware.test.ts
git commit -m "feat: add undo middleware that snapshots pre-action marker state"
```

---

## Task 2: Register `undoMiddleware` in the store

**Files:**
- Modify: `src/store/index.ts`

- [ ] **Step 1: Add middleware to the store**

In `src/store/index.ts`, add the import and register `undoMiddleware`:

```typescript
import { configureStore } from '@reduxjs/toolkit';
import searchReducer from './slices/searchSlice';
import markerReducer from './slices/markerSlice';
import configReducer from './slices/configSlice';
import { persistenceMiddleware } from './middleware/persistenceMiddleware';
import { undoMiddleware } from './middleware/undoMiddleware';

export const store = configureStore({
  reducer: {
    search: searchReducer,
    marker: markerReducer,
    config: configReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE'],
      },
    }).concat(undoMiddleware, persistenceMiddleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
```

Note: `undoMiddleware` must come before `persistenceMiddleware` so it intercepts actions before they reach the reducers.

- [ ] **Step 2: Run lint and type check**

```bash
npm run lint -- --quiet && npx tsc --noEmit
```

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/store/index.ts
git commit -m "feat: register undoMiddleware in Redux store"
```

---

## Task 3: Add `undoLastAction` thunk to `markerSlice`

**Files:**
- Modify: `src/store/slices/markerSlice.ts`

The thunk reads the snapshot, determines the correct reversal, and dispatches it. The `showToast` callback is passed in because the thunk needs to surface feedback to the user without coupling to a specific toast component.

- [ ] **Step 1: Add the thunk**

In `src/store/slices/markerSlice.ts`, add this thunk after the existing thunks (e.g., after `resetMarker`). Import `getUndoSnapshot` and `clearUndoSnapshot` at the top of the file alongside the other store imports:

Add to imports at the top of `markerSlice.ts`:
```typescript
import { getUndoSnapshot, clearUndoSnapshot } from '../middleware/undoMiddleware';
import { isMarkerConfirmed, isMarkerRejected } from '../../core/marker/markerLogic';
```

Add the thunk (place it after `resetMarker`):

```typescript
// Undo the last undoable action
export const undoLastAction = createAsyncThunk(
  'marker/undoLastAction',
  async (
    { showToast }: { showToast: (message: string, type: 'success' | 'error') => void },
    { dispatch, getState }
  ) => {
    const snapshot = getUndoSnapshot();

    if (!snapshot) {
      showToast('Nothing to undo', 'error');
      return;
    }

    if (snapshot.type === 'navigation') {
      clearUndoSnapshot();
      dispatch(setSelectedMarkerId(snapshot.previousSelectedMarkerId));
      return;
    }

    // markerState snapshot
    const { marker, selectedMarkerId } = snapshot;
    const state = (getState() as { marker: MarkerState }).marker;
    const currentMarker = state.markers.find((m) => m.id === marker.id);

    if (!currentMarker) {
      showToast('Cannot undo — marker no longer exists', 'error');
      clearUndoSnapshot();
      return;
    }

    const sceneId = state.sceneId;
    if (!sceneId) return;

    try {
      // Determine which reversal to apply based on the snapshot's prior marker state
      if (isMarkerConfirmed(marker)) {
        // Was confirmed before the action — restore confirmation
        await dispatch(confirmMarker({ sceneId, markerId: marker.id })).unwrap();
      } else if (isMarkerRejected(marker)) {
        // Was rejected before the action — restore rejection
        await dispatch(rejectMarker({ sceneId, markerId: marker.id })).unwrap();
      } else if (marker.seconds !== currentMarker.seconds || marker.end_seconds !== currentMarker.end_seconds) {
        // Times changed — restore original times
        await dispatch(updateMarkerTimes({
          sceneId,
          markerId: marker.id,
          startTime: marker.seconds,
          endTime: marker.end_seconds ?? null,
        })).unwrap();
      } else {
        // Was unprocessed before — reset to unprocessed
        await dispatch(resetMarker({ sceneId, markerId: marker.id })).unwrap();
      }

      clearUndoSnapshot();
      // Restore marker selection to where it was before the action
      dispatch(setSelectedMarkerId(selectedMarkerId));
    } catch {
      showToast('Undo failed', 'error');
      // Leave snapshot in place so user can retry
    }
  }
);
```

- [ ] **Step 2: Run lint and type check**

```bash
npm run lint -- --quiet && npx tsc --noEmit
```

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/store/slices/markerSlice.ts
git commit -m "feat: add undoLastAction thunk to markerSlice"
```

---

## Task 4: Register `system.undo` keyboard shortcut

**Files:**
- Modify: `src/config/defaultKeyboardShortcuts.ts`

- [ ] **Step 1: Add the shortcut entry**

In `src/config/defaultKeyboardShortcuts.ts`, add the `system.undo` entry inside the `defaultShortcuts` array, in the `// System Actions` section, just before `system.escape`:

```typescript
  {
    id: 'system.undo',
    bindings: [{ key: 'z', modifiers: { ctrl: true } }],
    description: 'Undo last marker action',
    category: 'system',
    action: { type: 'function', functionName: 'undoLastAction' },
    enabled: true,
    editable: true,
  },
```

- [ ] **Step 2: Write a test that the shortcut resolves correctly**

In `src/config/defaultKeyboardShortcuts.test.ts` (or add to `src/services/KeyboardShortcutService.test.ts` if the shortcuts test file is more appropriate), add:

Open `src/services/KeyboardShortcutService.test.ts` and add this test inside the `'key binding lookup'` describe block (after the existing tests):

```typescript
    it('should find system.undo for Ctrl+Z', () => {
      const actionId = service.getActionForKeyBinding('z', { ctrl: true });
      expect(actionId).toBe('system.undo');
    });
```

- [ ] **Step 3: Run tests**

```bash
npx jest src/services/KeyboardShortcutService.test.ts --no-coverage 2>&1 | tail -20
```

Expected: All tests PASS

- [ ] **Step 4: Run lint and type check**

```bash
npm run lint -- --quiet && npx tsc --noEmit
```

Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/config/defaultKeyboardShortcuts.ts src/services/KeyboardShortcutService.test.ts
git commit -m "feat: register system.undo shortcut as Ctrl+Z"
```

---

## Task 5: Wire `system.undo` handler in `useDynamicKeyboardShortcuts`

**Files:**
- Modify: `src/hooks/useDynamicKeyboardShortcuts.ts`

- [ ] **Step 1: Add `undoLastAction` to imports**

In `src/hooks/useDynamicKeyboardShortcuts.ts`, add `undoLastAction` to the existing import from `../store/slices/markerSlice`:

```typescript
import {
  confirmMarker,
  rejectMarker,
  resetMarker,
  openCollectingModal,
  closeModal,
  togglePlayPause,
  setCreatingMarker,
  setDuplicatingMarker,
  setMarkers,
  setSelectedMarkerId,
  seekToTime,
  playVideo,
  updateMarkerTimes,
  setIncorrectMarkers,
  undoLastAction,       // ← add this
} from '../store/slices/markerSlice';
```

- [ ] **Step 2: Add the handler to `actionHandlers`**

In the `actionHandlers` callback, in the returned object, add `system.undo` alongside the other `system.*` handlers (just before `'system.escape'`):

```typescript
      'system.undo': () => {
        dispatch(undoLastAction({ showToast: params.showToast }));
      },
```

- [ ] **Step 3: Run lint and type check**

```bash
npm run lint -- --quiet && npx tsc --noEmit
```

Expected: No errors

- [ ] **Step 4: Run all tests**

```bash
npm run test -- --no-coverage 2>&1 | tail -30
```

Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useDynamicKeyboardShortcuts.ts
git commit -m "feat: wire Ctrl+Z undo shortcut into keyboard handler"
```

---

## Task 6: Bump version and verify

- [ ] **Step 1: Review commits since last tag**

```bash
git log $(git describe --tags --abbrev=0)..HEAD --oneline
```

- [ ] **Step 2: Bump version**

This is a new feature — bump minor version:

```bash
npm version minor --no-git-tag-version
```

- [ ] **Step 3: Commit the version bump**

```bash
git add package.json package-lock.json
git commit -m "chore: bump version to $(node -p "require('./package.json').version")"
```

- [ ] **Step 4: Manual smoke test**

1. Open the app, load a scene with markers
2. Press `z` to confirm a marker → press `Ctrl+Z` → marker should return to unprocessed
3. Press `x` to reject a marker → press `Ctrl+Z` → marker should return to unprocessed
4. Press `w` to set start time → press `Ctrl+Z` → marker start time should revert
5. Press `e` to set end time → press `Ctrl+Z` → marker end time should revert
6. Use arrow keys to navigate to a different marker → press `Ctrl+Z` → selection returns to previous marker
7. Press `Ctrl+Z` with nothing to undo → "Nothing to undo" toast appears
8. Press `Ctrl+Z` twice after one action → second press shows "Nothing to undo"
