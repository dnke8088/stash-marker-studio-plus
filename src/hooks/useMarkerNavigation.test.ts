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
    // m1 is the leftmost. Old code would wrap to m2 (end of lane). New code should return null.
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
