import { Middleware } from '@reduxjs/toolkit';
import type { SceneMarker } from '../../services/StashappService';

export type UndoSnapshot =
  | { type: 'navigation'; previousSelectedMarkerId: string | null }
  | { type: 'markerState'; selectedMarkerId: string | null; marker: SceneMarker; sourceAction: 'confirmMarker' | 'rejectMarker' | 'resetMarker' | 'updateMarkerTimes' };

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

const SOURCE_ACTION_MAP: Record<string, 'confirmMarker' | 'rejectMarker' | 'resetMarker' | 'updateMarkerTimes'> = {
  'marker/confirmMarker/pending': 'confirmMarker',
  'marker/rejectMarker/pending': 'rejectMarker',
  'marker/resetMarker/pending': 'resetMarker',
  'marker/updateMarkerTimes/pending': 'updateMarkerTimes',
};

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
          sourceAction: SOURCE_ACTION_MAP[actionType],
        };
      }
    }
  }

  return next(action);
};
