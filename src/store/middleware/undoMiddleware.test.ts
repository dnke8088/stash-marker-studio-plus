import { SceneMarker } from '../../services/StashappService';
import {
  getUndoSnapshot,
  clearUndoSnapshot,
  undoMiddleware,
} from './undoMiddleware';

// Minimal SceneMarker for testing
const makeMarker = (id: string, seconds = 10, end_seconds = 30): SceneMarker => ({
  id,
  seconds,
  end_seconds,
  primary_tag: { id: 'tag1', name: 'Tag One' },
  tags: [],
  scene: { id: 'scene1', title: 'Scene' },
  title: '',
  stream: '',
  preview: '',
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
