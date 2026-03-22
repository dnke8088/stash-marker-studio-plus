# Swim Lane Boundary Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When `m`/`n` reach the last/first unprocessed marker in a swim lane, pressing again jumps to the first/last unprocessed marker in the adjacent swim lane instead of staying put.

**Architecture:** Two functions in `useMarkerNavigation.ts` are modified in-place. `findNextUnprocessedMarkerInSwimlane` (called by `m`) adds a forward cross-lane search after exhausting the current lane. `findPreviousUnprocessedMarkerInSwimlane` (called by `n`) removes its existing intra-lane wrap and adds a backward cross-lane search instead. No other files change.

**Tech Stack:** TypeScript, React hooks, Jest

---

## File Structure

**Modified:**
- `src/hooks/useMarkerNavigation.ts` — update `findNextUnprocessedMarkerInSwimlane` (lines 194–233) and `findPreviousUnprocessedMarkerInSwimlane` (lines 236–286)

**Created:**
- `src/hooks/useMarkerNavigation.test.ts` — unit tests for both functions

---

### Task 1: Test the current boundary behaviour (TDD baseline)

**Files:**
- Create: `src/hooks/useMarkerNavigation.test.ts`

The functions under test are plain logic functions but they're buried inside a React hook that uses `useCallback` and `useAppDispatch`. To test them without a Redux store, we extract the logic by calling the hook through `renderHook` from `@testing-library/react` with a mock dispatch, or we test the pure logic directly.

Because the hook depends on `useAppDispatch`, the simplest approach is to mock the dispatch and use `renderHook`. The test file below follows this pattern.

Key domain facts:
- `markersWithTracks` is an array of `MarkerWithTrack` — each has `{ id, seconds, swimlane }`.
- `actionMarkers` is an array of `SceneMarker` — the full marker objects. A marker is "unprocessed" if it has no confirmed or rejected status tag (tag IDs come from `stashappService`).
- Swimlane indices are integers starting at 0.
- `tagGroups` is an array of objects with at least a `name` field — its length determines the number of swimlanes.

- [ ] **Step 1: Create the test file with helper setup**

Create `src/hooks/useMarkerNavigation.test.ts`:

```ts
import { renderHook } from "@testing-library/react";
import { useMarkerNavigation } from "./useMarkerNavigation";
import { createUnprocessedMarker, createConfirmedMarker } from "../core/marker/testUtils";
import { MarkerWithTrack } from "../core/marker/types";
import { SceneMarker } from "../services/StashappService";

// Mock Redux dispatch
jest.mock("../store/hooks", () => ({
  useAppDispatch: () => jest.fn(),
}));

// Mock stashappService with the same IDs used in testUtils
jest.mock("../services/StashappService", () => ({
  stashappService: {
    markerStatusConfirmed: "100001",
    markerStatusRejected: "100002",
    markerSourceManual: "100003",
    markerShotBoundary: "300001",
    markerAiReviewed: "100004",
  },
}));

// Helper: build a MarkerWithTrack
function mwt(id: string, seconds: number, swimlane: number): MarkerWithTrack {
  return { id, seconds, swimlane, track: 0 };
}

// Helper: build a tagGroups array with N lanes
function tagGroups(n: number) {
  return Array.from({ length: n }, (_, i) => ({ name: `Lane ${i}` }));
}

// Helper: render the hook and extract the two functions under test
function setup(params: {
  actionMarkers: SceneMarker[];
  markersWithTracks: MarkerWithTrack[];
  tagGroupCount: number;
  selectedMarkerId: string | null;
}) {
  const { result } = renderHook(() =>
    useMarkerNavigation({
      actionMarkers: params.actionMarkers,
      markersWithTracks: params.markersWithTracks,
      tagGroups: tagGroups(params.tagGroupCount),
      selectedMarkerId: params.selectedMarkerId,
      currentVideoTime: 0,
    })
  );
  return result.current;
}
```

- [ ] **Step 2: Write failing tests for `findNextUnprocessedMarkerInSwimlane` boundary crossing**

Append to the test file:

```ts
describe("findNextUnprocessedMarkerInSwimlane", () => {
  it("navigates forward within the same swimlane normally", () => {
    const m1 = createUnprocessedMarker({ id: "m1", seconds: 10 });
    const m2 = createUnprocessedMarker({ id: "m2", seconds: 20 });
    const { findNextUnprocessedMarkerInSwimlane } = setup({
      actionMarkers: [m1, m2],
      markersWithTracks: [mwt("m1", 10, 0), mwt("m2", 20, 0)],
      tagGroupCount: 1,
      selectedMarkerId: "m1",
    });
    expect(findNextUnprocessedMarkerInSwimlane()).toBe("m2");
  });

  it("crosses to the first unprocessed marker of the next swimlane when at the rightmost marker", () => {
    const m1 = createUnprocessedMarker({ id: "m1", seconds: 10 });
    const m2 = createUnprocessedMarker({ id: "m2", seconds: 5 });
    const { findNextUnprocessedMarkerInSwimlane } = setup({
      actionMarkers: [m1, m2],
      markersWithTracks: [mwt("m1", 10, 0), mwt("m2", 5, 1)],
      tagGroupCount: 2,
      selectedMarkerId: "m1",
    });
    expect(findNextUnprocessedMarkerInSwimlane()).toBe("m2");
  });

  it("skips swimlanes with no unprocessed markers when crossing boundary", () => {
    const m1 = createUnprocessedMarker({ id: "m1", seconds: 10 });
    const m2 = createConfirmedMarker({ id: "m2", seconds: 5 });
    const m3 = createUnprocessedMarker({ id: "m3", seconds: 15 });
    const { findNextUnprocessedMarkerInSwimlane } = setup({
      actionMarkers: [m1, m2, m3],
      markersWithTracks: [mwt("m1", 10, 0), mwt("m2", 5, 1), mwt("m3", 15, 2)],
      tagGroupCount: 3,
      selectedMarkerId: "m1",
    });
    expect(findNextUnprocessedMarkerInSwimlane()).toBe("m3");
  });

  it("returns null when at the last unprocessed marker of the last swimlane", () => {
    const m1 = createUnprocessedMarker({ id: "m1", seconds: 10 });
    const { findNextUnprocessedMarkerInSwimlane } = setup({
      actionMarkers: [m1],
      markersWithTracks: [mwt("m1", 10, 0)],
      tagGroupCount: 1,
      selectedMarkerId: "m1",
    });
    expect(findNextUnprocessedMarkerInSwimlane()).toBeNull();
  });

  it("returns null when no unprocessed markers exist in any subsequent swimlane", () => {
    const m1 = createUnprocessedMarker({ id: "m1", seconds: 10 });
    const m2 = createConfirmedMarker({ id: "m2", seconds: 5 });
    const { findNextUnprocessedMarkerInSwimlane } = setup({
      actionMarkers: [m1, m2],
      markersWithTracks: [mwt("m1", 10, 0), mwt("m2", 5, 1)],
      tagGroupCount: 2,
      selectedMarkerId: "m1",
    });
    expect(findNextUnprocessedMarkerInSwimlane()).toBeNull();
  });
});
```

- [ ] **Step 3: Write failing tests for `findPreviousUnprocessedMarkerInSwimlane` boundary crossing**

Append to the test file:

```ts
describe("findPreviousUnprocessedMarkerInSwimlane", () => {
  it("navigates backward within the same swimlane normally", () => {
    const m1 = createUnprocessedMarker({ id: "m1", seconds: 10 });
    const m2 = createUnprocessedMarker({ id: "m2", seconds: 20 });
    const { findPreviousUnprocessedMarkerInSwimlane } = setup({
      actionMarkers: [m1, m2],
      markersWithTracks: [mwt("m1", 10, 0), mwt("m2", 20, 0)],
      tagGroupCount: 1,
      selectedMarkerId: "m2",
    });
    expect(findPreviousUnprocessedMarkerInSwimlane()).toBe("m1");
  });

  it("crosses to the last unprocessed marker of the previous swimlane when at the leftmost marker", () => {
    const m1 = createUnprocessedMarker({ id: "m1", seconds: 10 });
    const m2 = createUnprocessedMarker({ id: "m2", seconds: 5 });
    const { findPreviousUnprocessedMarkerInSwimlane } = setup({
      actionMarkers: [m1, m2],
      markersWithTracks: [mwt("m1", 10, 0), mwt("m2", 5, 1)],
      tagGroupCount: 2,
      selectedMarkerId: "m2",
    });
    expect(findPreviousUnprocessedMarkerInSwimlane()).toBe("m1");
  });

  it("picks the last unprocessed marker by time in the previous swimlane", () => {
    const m1 = createUnprocessedMarker({ id: "m1", seconds: 10 });
    const m2 = createUnprocessedMarker({ id: "m2", seconds: 30 });
    const m3 = createUnprocessedMarker({ id: "m3", seconds: 5 });
    const { findPreviousUnprocessedMarkerInSwimlane } = setup({
      actionMarkers: [m1, m2, m3],
      markersWithTracks: [mwt("m1", 10, 0), mwt("m2", 30, 0), mwt("m3", 5, 1)],
      tagGroupCount: 2,
      selectedMarkerId: "m3",
    });
    // m2 is the last (highest seconds) unprocessed marker in swimlane 0
    expect(findPreviousUnprocessedMarkerInSwimlane()).toBe("m2");
  });

  it("skips swimlanes with no unprocessed markers when crossing boundary", () => {
    const m1 = createUnprocessedMarker({ id: "m1", seconds: 10 });
    const m2 = createConfirmedMarker({ id: "m2", seconds: 20 });
    const m3 = createUnprocessedMarker({ id: "m3", seconds: 5 });
    const { findPreviousUnprocessedMarkerInSwimlane } = setup({
      actionMarkers: [m1, m2, m3],
      markersWithTracks: [mwt("m1", 10, 0), mwt("m2", 20, 1), mwt("m3", 5, 2)],
      tagGroupCount: 3,
      selectedMarkerId: "m3",
    });
    expect(findPreviousUnprocessedMarkerInSwimlane()).toBe("m1");
  });

  it("returns null when at the first unprocessed marker of the first swimlane", () => {
    const m1 = createUnprocessedMarker({ id: "m1", seconds: 10 });
    const { findPreviousUnprocessedMarkerInSwimlane } = setup({
      actionMarkers: [m1],
      markersWithTracks: [mwt("m1", 10, 0)],
      tagGroupCount: 1,
      selectedMarkerId: "m1",
    });
    expect(findPreviousUnprocessedMarkerInSwimlane()).toBeNull();
  });

  it("does NOT wrap within the same swimlane (old wrap behaviour removed)", () => {
    // m1 is the leftmost. Old code would wrap to m2 (end of lane). New code should return null (cross to previous lane, none exists).
    const m1 = createUnprocessedMarker({ id: "m1", seconds: 10 });
    const m2 = createUnprocessedMarker({ id: "m2", seconds: 20 });
    const { findPreviousUnprocessedMarkerInSwimlane } = setup({
      actionMarkers: [m1, m2],
      markersWithTracks: [mwt("m1", 10, 0), mwt("m2", 20, 0)],
      tagGroupCount: 1,
      selectedMarkerId: "m1",
    });
    expect(findPreviousUnprocessedMarkerInSwimlane()).toBeNull();
  });
});
```

- [ ] **Step 4: Run the tests to confirm they fail**

```bash
cd /data/docker/new-marker-studio/stash-marker-studio && npm run test -- --testPathPattern=useMarkerNavigation 2>&1 | tail -30
```

Expected: Tests fail (boundary crossing tests return `selectedMarkerId` or wrong value instead of the expected marker ID or `null`).

---

### Task 2: Implement the new boundary behaviour

**Files:**
- Modify: `src/hooks/useMarkerNavigation.ts` (lines 194–286)

- [ ] **Step 1: Replace `findNextUnprocessedMarkerInSwimlane`**

In `src/hooks/useMarkerNavigation.ts`, replace the entire `findNextUnprocessedMarkerInSwimlane` function (from the `const findNextUnprocessedMarkerInSwimlane = useCallback(` line through its closing `}, [...])`):

```ts
// Helper function to find next unprocessed marker in current swimlane,
// crossing to the next swimlane down if the current lane is exhausted.
const findNextUnprocessedMarkerInSwimlane = useCallback((): string | null => {
  if (markersWithTracks.length === 0) return null;

  const currentMarker = actionMarkers.find((m) => m.id === selectedMarkerId);
  if (!currentMarker) return null;

  const currentMarkerWithTrack = markersWithTracks.find((m) => m.id === currentMarker.id);
  if (!currentMarkerWithTrack) return null;

  const currentSwimlane = currentMarkerWithTrack.swimlane;

  // Search from current swimlane onwards (including current, starting after current marker)
  for (let lane = currentSwimlane; lane < tagGroups.length; lane++) {
    const laneMarkers = markersWithTracks
      .filter((m) => m.swimlane === lane)
      .sort((a, b) => a.seconds - b.seconds);

    // In the current lane, only look after the current marker
    const startIndex = lane === currentSwimlane
      ? laneMarkers.findIndex((m) => m.id === currentMarker.id) + 1
      : 0;

    for (let i = startIndex; i < laneMarkers.length; i++) {
      const actionMarker = actionMarkers.find((m) => m.id === laneMarkers[i].id);
      if (actionMarker && isUnprocessed(actionMarker)) {
        return actionMarker.id;
      }
    }
  }

  return null;
}, [markersWithTracks, tagGroups, actionMarkers, selectedMarkerId, isUnprocessed]);
```

- [ ] **Step 2: Replace `findPreviousUnprocessedMarkerInSwimlane`**

Replace the entire `findPreviousUnprocessedMarkerInSwimlane` function (from `const findPreviousUnprocessedMarkerInSwimlane = useCallback(` through its closing `}, [...])`):

```ts
// Helper function to find previous unprocessed marker in current swimlane,
// crossing to the next swimlane up if the current lane is exhausted.
// Does NOT wrap within the same swimlane.
const findPreviousUnprocessedMarkerInSwimlane = useCallback((): string | null => {
  if (markersWithTracks.length === 0) return null;

  const currentMarker = actionMarkers.find((m) => m.id === selectedMarkerId);
  if (!currentMarker) return null;

  const currentMarkerWithTrack = markersWithTracks.find((m) => m.id === currentMarker.id);
  if (!currentMarkerWithTrack) return null;

  const currentSwimlane = currentMarkerWithTrack.swimlane;

  // Search from current swimlane backwards (including current, starting before current marker)
  for (let lane = currentSwimlane; lane >= 0; lane--) {
    const laneMarkers = markersWithTracks
      .filter((m) => m.swimlane === lane)
      .sort((a, b) => b.seconds - a.seconds); // descending — last marker first

    // In the current lane, only look before the current marker (i.e. lower seconds)
    const startIndex = lane === currentSwimlane
      ? laneMarkers.findIndex((m) => m.id === currentMarker.id) + 1
      : 0;

    for (let i = startIndex; i < laneMarkers.length; i++) {
      const actionMarker = actionMarkers.find((m) => m.id === laneMarkers[i].id);
      if (actionMarker && isUnprocessed(actionMarker)) {
        return actionMarker.id;
      }
    }
  }

  return null;
}, [markersWithTracks, tagGroups, actionMarkers, selectedMarkerId, isUnprocessed]);
```

- [ ] **Step 3: Run the tests**

```bash
cd /data/docker/new-marker-studio/stash-marker-studio && npm run test -- --testPathPattern=useMarkerNavigation 2>&1 | tail -30
```

Expected: All tests pass.

- [ ] **Step 4: Run the full test suite**

```bash
cd /data/docker/new-marker-studio/stash-marker-studio && npm run test 2>&1 | tail -15
```

Expected: All 235+ tests pass.

- [ ] **Step 5: Type-check and lint**

```bash
cd /data/docker/new-marker-studio/stash-marker-studio && npx tsc --noEmit && npm run lint
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
cd /data/docker/new-marker-studio/stash-marker-studio
git add src/hooks/useMarkerNavigation.ts src/hooks/useMarkerNavigation.test.ts
git commit -m "feat(navigation): cross swimlane boundary when m/n reaches first/last unprocessed marker"
```

---

### Task 3: Push

- [ ] **Step 1: Push**

```bash
cd /data/docker/new-marker-studio/stash-marker-studio && git push
```
