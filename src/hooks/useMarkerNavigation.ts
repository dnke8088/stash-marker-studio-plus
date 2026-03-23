import { useCallback } from 'react';
import { useAppDispatch } from '../store/hooks';
import { setSelectedMarkerId } from '../store/slices/markerSlice';
import { isUnprocessed } from '../core/marker/markerLogic';
import { type SceneMarker } from '../services/StashappService';
import { MarkerWithTrack } from '../core/marker/types';

const PLAYHEAD_WINDOW_SECONDS = 15;

interface UseMarkerNavigationParams {
  actionMarkers: SceneMarker[];
  markersWithTracks: MarkerWithTrack[];
  tagGroups: { name: string; [key: string]: unknown }[];
  selectedMarkerId: string | null;
  currentVideoTime: number;
}

export const useMarkerNavigation = (params: UseMarkerNavigationParams) => {
  const dispatch = useAppDispatch();
  const {
    actionMarkers,
    markersWithTracks,
    tagGroups,
    selectedMarkerId,
    currentVideoTime,
  } = params;

  // Helper function to find next unprocessed marker globally (wraps around)
  const findNextUnprocessedMarker = useCallback((): string | null => {
    const currentMarker = actionMarkers.find((m) => m.id === selectedMarkerId);
    const currentIndex = currentMarker ? actionMarkers.indexOf(currentMarker) : -1;

    for (let i = currentIndex + 1; i < actionMarkers.length; i++) {
      if (isUnprocessed(actionMarkers[i])) return actionMarkers[i].id;
    }
    for (let i = 0; i < currentIndex; i++) {
      if (isUnprocessed(actionMarkers[i])) return actionMarkers[i].id;
    }
    return null;
  }, [actionMarkers, selectedMarkerId]);

  // Find previous/next unprocessed marker globally (cross-swimlane, no rollover)
  const findUnprocessedGlobal = useCallback((direction: 'previous' | 'next'): string | null => {
    if (markersWithTracks.length === 0 || tagGroups.length === 0) return null;

    const actionMarkerById = new Map(actionMarkers.map(m => [m.id, m]));
    const currentMarker = actionMarkerById.get(selectedMarkerId ?? '');

    if (!currentMarker) {
      // No marker selected — search from first or last swimlane
      const swimlaneRange = direction === 'next'
        ? Array.from({ length: tagGroups.length }, (_, i) => i)
        : Array.from({ length: tagGroups.length }, (_, i) => tagGroups.length - 1 - i);

      for (const swimlaneIndex of swimlaneRange) {
        const swimlaneMarkers = markersWithTracks
          .filter(m => m.swimlane === swimlaneIndex)
          .sort((a, b) => direction === 'next' ? a.seconds - b.seconds : b.seconds - a.seconds);
        for (const marker of swimlaneMarkers) {
          const actionMarker = actionMarkerById.get(marker.id);
          if (actionMarker && isUnprocessed(actionMarker)) return actionMarker.id;
        }
      }
      return null;
    }

    const currentSwimlaneIndex = markersWithTracks.find(m => m.id === currentMarker.id)?.swimlane ?? 0;

    const swimlaneRange = direction === 'next'
      ? Array.from({ length: tagGroups.length - currentSwimlaneIndex }, (_, i) => currentSwimlaneIndex + i)
      : Array.from({ length: currentSwimlaneIndex + 1 }, (_, i) => currentSwimlaneIndex - i);

    for (const swimlaneIndex of swimlaneRange) {
      const swimlaneMarkers = markersWithTracks
        .filter(m => m.swimlane === swimlaneIndex)
        .sort((a, b) => direction === 'next' ? a.seconds - b.seconds : b.seconds - a.seconds);

      if (swimlaneMarkers.length === 0) continue;

      const startIndex = swimlaneIndex === currentSwimlaneIndex
        ? swimlaneMarkers.findIndex(m =>
            direction === 'next' ? m.seconds > currentMarker.seconds : m.seconds < currentMarker.seconds
          )
        : 0;

      if (swimlaneIndex === currentSwimlaneIndex && startIndex === -1) continue;

      for (let i = Math.max(0, startIndex); i < swimlaneMarkers.length; i++) {
        const actionMarker = actionMarkerById.get(swimlaneMarkers[i].id);
        if (actionMarker && isUnprocessed(actionMarker)) return actionMarker.id;
      }
    }

    return null;
  }, [markersWithTracks, tagGroups, actionMarkers, selectedMarkerId]);

  const findPreviousUnprocessedGlobal = useCallback(
    () => findUnprocessedGlobal('previous'),
    [findUnprocessedGlobal]
  );

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
  }, [markersWithTracks, tagGroups, actionMarkers, selectedMarkerId]);

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
  }, [markersWithTracks, actionMarkers, selectedMarkerId]);

  const findNextUnprocessedGlobal = useCallback(
    () => findUnprocessedGlobal('next'),
    [findUnprocessedGlobal]
  );

  // Helper function for swimlane navigation
  const navigateBetweenSwimlanes = useCallback(
    (direction: "up" | "down", useTemporalLocality: boolean = true) => {
      // Find current marker
      const currentMarker = actionMarkers.find(
        (m) => m.id === selectedMarkerId
      );
      if (!currentMarker) {
        // If no marker is selected, select the first one
        if (actionMarkers.length > 0) {
          dispatch(setSelectedMarkerId(actionMarkers[0].id));
        }
        return;
      }

      // Find current marker in markersWithTracks
      const currentMarkerWithTrack = markersWithTracks.find(
        (m) => m.id === currentMarker.id
      );
      if (!currentMarkerWithTrack) return;

      const currentSwimlane = currentMarkerWithTrack.swimlane;
      let targetSwimlane;

      if (direction === "up") {
        targetSwimlane =
          currentSwimlane > 0 ? currentSwimlane - 1 : currentSwimlane;
      } else {
        targetSwimlane =
          currentSwimlane < tagGroups.length - 1
            ? currentSwimlane + 1
            : currentSwimlane;
      }

      if (targetSwimlane === currentSwimlane) return;

      // Find all markers in target swimlane
      const swimlaneMarkers = markersWithTracks.filter(
        (m) => m.swimlane === targetSwimlane
      );

      if (swimlaneMarkers.length === 0) return;

      let bestMatch;
      if (useTemporalLocality) {
        // Find the marker closest in time to the playhead position
        bestMatch = swimlaneMarkers.reduce((closest, marker) => {
          if (!closest) return marker;
          const currentDiff = Math.abs(marker.seconds - currentVideoTime);
          const closestDiff = Math.abs(closest.seconds - currentVideoTime);
          return currentDiff < closestDiff ? marker : closest;
        }, null as MarkerWithTrack | null);
      } else {
        // Just take the first marker in the swimlane
        bestMatch = swimlaneMarkers[0];
      }

      if (bestMatch) {
        dispatch(setSelectedMarkerId(bestMatch.id));
      }
    },
    [
      markersWithTracks,
      tagGroups,
      actionMarkers,
      selectedMarkerId,
      currentVideoTime,
      dispatch
    ]
  );

  // Helper function for same-swimlane navigation
  const navigateWithinSwimlane = useCallback(
    (direction: "left" | "right") => {
      // Find current marker
      const currentMarker = actionMarkers.find(
        (m) => m.id === selectedMarkerId
      );
      if (!currentMarker) {
        // If no marker is selected, select the first one
        if (actionMarkers.length > 0) {
          dispatch(setSelectedMarkerId(actionMarkers[0].id));
        }
        return;
      }

      // Find current marker in markersWithTracks
      const currentMarkerWithTrack = markersWithTracks.find(
        (m) => m.id === currentMarker.id
      );
      if (!currentMarkerWithTrack) return;

      // Find all markers in the same swimlane, sorted by time
      const swimlaneMarkers = markersWithTracks
        .filter((m) => m.swimlane === currentMarkerWithTrack.swimlane)
        .sort((a, b) => a.seconds - b.seconds);

      const currentIndex = swimlaneMarkers.findIndex(
        (m) => m.id === currentMarker.id
      );
      if (currentIndex === -1) return;

      let targetIndex;
      if (direction === "left") {
        targetIndex = currentIndex > 0 ? currentIndex - 1 : currentIndex;
      } else {
        targetIndex =
          currentIndex < swimlaneMarkers.length - 1
            ? currentIndex + 1
            : currentIndex;
      }

      if (targetIndex === currentIndex) return;

      const targetMarker = swimlaneMarkers[targetIndex];
      dispatch(setSelectedMarkerId(targetMarker.id));
    },
    [
      markersWithTracks,
      actionMarkers,
      selectedMarkerId,
      dispatch
    ]
  );

  // Helper function to find markers that touch the playhead
  const findMarkersAtPlayhead = useCallback((currentTime: number): SceneMarker[] => {
    return actionMarkers.filter(marker => {
      const startTime = marker.seconds;
      const endTime = marker.end_seconds || marker.seconds + 30;
      return (currentTime + PLAYHEAD_WINDOW_SECONDS >= startTime) && (currentTime - PLAYHEAD_WINDOW_SECONDS <= endTime);
    });
  }, [actionMarkers]);

  // Helper function to navigate through markers at playhead, skipping current swimlane
  const findMarkerAtPlayheadInDirection = useCallback((currentTime: number, direction: 'next' | 'previous'): string | null => {
    const markersAtPlayhead = findMarkersAtPlayhead(currentTime);
    if (markersAtPlayhead.length === 0) return null;

    // Determine current swimlane
    const currentMarker = actionMarkers.find(m => m.id === selectedMarkerId);
    const currentSwimlaneIndex = currentMarker
      ? markersWithTracks.find(m => m.id === currentMarker.id)?.swimlane ?? -1
      : -1;

    // Sort by swimlane (if available) or by tag name for consistent ordering
    const sortedMarkers = markersAtPlayhead.sort((a, b) => {
      // Try to use swimlane data if available
      const aTrack = markersWithTracks.find(m => m.id === a.id);
      const bTrack = markersWithTracks.find(m => m.id === b.id);

      if (aTrack && bTrack) {
        // Primary: sort by swimlane
        if (aTrack.swimlane !== bTrack.swimlane) {
          return aTrack.swimlane - bTrack.swimlane;
        }
        // Secondary: within same swimlane, sort by temporal proximity to playhead
        const aDistance = Math.abs(a.seconds - currentTime);
        const bDistance = Math.abs(b.seconds - currentTime);
        return aDistance - bDistance;
      }

      // Fallback to tag name sorting
      return a.primary_tag.name.localeCompare(b.primary_tag.name);
    });

    // Filter out markers from the current swimlane
    const markersExcludingCurrent = sortedMarkers.filter(m => {
      const track = markersWithTracks.find(t => t.id === m.id);
      return !track || track.swimlane !== currentSwimlaneIndex;
    });

    if (markersExcludingCurrent.length === 0) {
      // All markers are in current swimlane, wrap to first/last marker
      return direction === 'next'
        ? sortedMarkers[0].id
        : sortedMarkers[sortedMarkers.length - 1].id;
    }

    if (direction === 'next') {
      // Find first marker in a swimlane after the current one
      for (const marker of markersExcludingCurrent) {
        const track = markersWithTracks.find(t => t.id === marker.id);
        if (track && track.swimlane > currentSwimlaneIndex) {
          return marker.id;
        }
      }
      // No marker found after current swimlane, wrap to first marker from excluded list
      return markersExcludingCurrent[0].id;
    } else {
      // Find last marker in a swimlane before the current one (iterate backwards)
      for (let i = markersExcludingCurrent.length - 1; i >= 0; i--) {
        const marker = markersExcludingCurrent[i];
        const track = markersWithTracks.find(t => t.id === marker.id);
        if (track && track.swimlane < currentSwimlaneIndex) {
          return marker.id;
        }
      }
      // No marker found before current swimlane, wrap to last marker from excluded list
      return markersExcludingCurrent[markersExcludingCurrent.length - 1].id;
    }
  }, [findMarkersAtPlayhead, markersWithTracks, selectedMarkerId, actionMarkers]);

  // Helper function to cycle through markers at playhead (top-to-bottom)
  const findNextMarkerAtPlayhead = useCallback((currentTime: number): string | null => {
    return findMarkerAtPlayheadInDirection(currentTime, 'next');
  }, [findMarkerAtPlayheadInDirection]);

  // Helper function to cycle through markers at playhead (bottom-to-top)
  const findPreviousMarkerAtPlayhead = useCallback((currentTime: number): string | null => {
    return findMarkerAtPlayheadInDirection(currentTime, 'previous');
  }, [findMarkerAtPlayheadInDirection]);

  return {
    findNextUnprocessedMarker,
    findPreviousUnprocessedGlobal,
    findNextUnprocessedMarkerInSwimlane,
    findPreviousUnprocessedMarkerInSwimlane,
    findNextUnprocessedGlobal,
    navigateBetweenSwimlanes,
    navigateWithinSwimlane,
    findMarkersAtPlayhead,
    findNextMarkerAtPlayhead,
    findPreviousMarkerAtPlayhead,
  };
};