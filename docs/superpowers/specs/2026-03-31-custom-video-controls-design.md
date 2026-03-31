# Custom Video Controls — Design Spec

**Date:** 2026-03-31
**Status:** Approved

## Problem

Safari applies a native dim overlay to the `<video>` element when paused. There is no CSS hook to suppress this. The fix is to remove the native `controls` attribute and replace it with custom controls.

## Design

### Layout

A new `VideoControls` component is placed directly below `VideoPlayer` and above the timeline in the marker page layout. The toolbar is a slim dark bar (`bg-gray-800`) using the same Tailwind dark-theme visual language as the rest of the app.

### Controls (left to right)

| Control | Description |
|---|---|
| Play/pause button | Icon reflects Redux `isPlaying` state. Click dispatches play or pause. |
| Seek bar | `<input type="range">`. Reads `currentVideoTime` / `videoDuration` from Redux. Dispatches `seekToTime` on change. Independent scrubber — does not replace the timeline. |
| Time display | `1:23 / 4:12` format using existing `formatSeconds` utility. |
| Mute toggle | Icon toggles mute on the video element directly. |
| Volume slider | Horizontal `<input type="range">`. Persists to `localStorage` (key: `player-volume`) on change, same as existing logic in `VideoPlayer`. |

### State wiring

- **Playback state** (play/pause, current time, duration) — read from Redux, dispatch via existing actions (`seekToTime`, `pendingPlayPause`).
- **Volume/mute** — cannot go through Redux; the video element owns volume. The `videoRef` is lifted up to the marker page (`[sceneId]/page.tsx`) and passed as a prop to both `VideoPlayer` and `VideoControls`. This gives `VideoControls` direct access to `video.volume` and `video.muted`.

### Changes to `VideoPlayer`

- Remove `controls` attribute from the `<video>` element.
- Accept `videoRef` as a prop instead of creating it internally (ref lift).
- Remove internal `localStorage` volume/mute restore logic — move to `VideoControls` which now owns that concern.

### `VideoControls` component

New file: `src/components/marker/video/VideoControls.tsx`

Props:
```ts
interface VideoControlsProps {
  videoRef: React.RefObject<HTMLVideoElement>;
}
```

Reads from Redux: `selectCurrentVideoTime`, `selectVideoDuration`, `selectIsVideoPlaying`
Dispatches: `seekToTime`, `pendingPlayPause`
Local state: `volume` and `muted` (synced from `videoRef` on mount, persisted to `localStorage` on change)

## Out of Scope

- Fullscreen button — not requested.
- Keyboard shortcut changes — existing shortcuts continue to work unchanged.
- Any changes to the timeline component.
