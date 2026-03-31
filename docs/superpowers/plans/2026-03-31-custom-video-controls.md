# Custom Video Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Safari's native `<video controls>` (which dims the video when paused) with a custom controls toolbar below the video.

**Architecture:** Remove the `controls` attribute from `VideoPlayer`. Accept `videoRef` as a prop instead of creating it internally. A new `VideoControls` component sits below `VideoPlayer` in the layout, reads playback state from Redux, dispatches play/pause/seek via existing Redux actions, and controls volume/mute directly on the video element via the ref. The `videoElementRef` already exists in the marker page and is already passed to other components — we just wire it through `VideoPlayer` and add `VideoControls`.

**Tech Stack:** Next.js 15, React, Redux Toolkit, TypeScript, Tailwind CSS, Jest

---

## File Map

- **Modify:** `src/components/marker/video/VideoPlayer.tsx` — accept `videoRef` as prop, remove `controls`, remove internal localStorage volume restore
- **Create:** `src/components/marker/video/VideoControls.tsx` — the new controls toolbar
- **Modify:** `src/app/marker/[sceneId]/page.tsx` — pass `videoElementRef` to `VideoPlayer`, add `<VideoControls>` below it
- **Test:** `src/components/marker/video/VideoControls.test.tsx` — unit tests for controls component

---

## Task 1: Thread `videoRef` into `VideoPlayer`

**Files:**
- Modify: `src/components/marker/video/VideoPlayer.tsx`
- Modify: `src/app/marker/[sceneId]/page.tsx`

The page already has `videoElementRef = useRef<HTMLVideoElement | null>(null)` and passes it to other components. We just need to pass it into `VideoPlayer` so the same ref points at the actual `<video>` element.

- [ ] **Step 1: Update `VideoPlayer` props interface and accept the ref**

In `src/components/marker/video/VideoPlayer.tsx`, replace the current component with:

```tsx
import { useEffect, useRef } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  selectPendingSeek,
  selectPendingPlayPause,
  selectScene,
  setVideoDuration,
  setCurrentVideoTime,
  setVideoPlaying,
  clearPendingSeek,
  clearPendingPlayPause,
} from "@/store/slices/markerSlice";
import { selectStashUrl, selectStashApiKey } from "@/store/slices/configSlice";
import Hls from "hls.js";

interface VideoPlayerProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  className?: string;
}

export function VideoPlayer({ videoRef, className = "" }: VideoPlayerProps) {
  const dispatch = useAppDispatch();
  const scene = useAppSelector(selectScene);
  const pendingSeek = useAppSelector(selectPendingSeek);
  const pendingPlayPause = useAppSelector(selectPendingPlayPause);

  const stashUrl = useAppSelector(selectStashUrl);
  const stashApiKey = useAppSelector(selectStashApiKey);

  // Handle pending seek commands from Redux
  useEffect(() => {
    if (pendingSeek && videoRef.current) {
      const video = videoRef.current;
      const clampedTime = Math.max(
        0,
        Math.min(pendingSeek.time, video.duration || pendingSeek.time)
      );
      video.currentTime = clampedTime;
      dispatch(clearPendingSeek());
    }
  }, [pendingSeek, dispatch, videoRef]);

  // Handle pending play/pause commands from Redux
  useEffect(() => {
    if (pendingPlayPause && videoRef.current) {
      const video = videoRef.current;
      if (pendingPlayPause.action === "play") {
        video.play().catch(console.error);
      } else {
        video.pause();
      }
      dispatch(clearPendingPlayPause());
    }
  }, [pendingPlayPause, dispatch, videoRef]);

  // Set up HLS source — handles both native HLS (Safari) and hls.js (Chrome/Firefox)
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !scene) return;

    const url = `${stashUrl}/scene/${scene.id}/stream.m3u8${stashApiKey ? `?apikey=${stashApiKey}` : ""}`;

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = url;
      return () => {
        video.removeAttribute("src");
        video.load();
      };
    } else if (Hls.isSupported()) {
      const hls = new Hls();
      hls.loadSource(url);
      hls.attachMedia(video);
      return () => hls.destroy();
    }
  }, [scene, stashUrl, stashApiKey, videoRef]);

  // Set up video event listeners to dispatch metadata updates to Redux
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedMetadata = () => {
      dispatch(setVideoDuration(video.duration));
    };
    const handleTimeUpdate = () => {
      dispatch(setCurrentVideoTime(video.currentTime));
    };
    const handlePlay = () => {
      dispatch(setVideoPlaying(true));
    };
    const handlePause = () => {
      dispatch(setVideoPlaying(false));
    };

    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("seeking", handleTimeUpdate);
    video.addEventListener("seeked", handleTimeUpdate);
    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);

    return () => {
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("seeking", handleTimeUpdate);
      video.removeEventListener("seeked", handleTimeUpdate);
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
    };
  }, [dispatch, videoRef]);

  if (!scene) {
    return null;
  }

  return (
    <video
      ref={videoRef}
      className={`w-full h-full object-contain ${className}`}
      tabIndex={-1}
    >
      Your browser does not support the video tag.
    </video>
  );
}
```

Key changes from original:
- `videoRef` is now a prop (removed internal `useRef`)
- Removed `controls` attribute
- Removed `volumechange` event listener and `localStorage` volume restore (moved to `VideoControls`)
- Added `videoRef` to all effect dependency arrays

- [ ] **Step 2: Pass `videoElementRef` to `VideoPlayer` in the marker page**

In `src/app/marker/[sceneId]/page.tsx`, find the `<VideoPlayer>` usage (around line 1237):

```tsx
<VideoPlayer className="w-full h-full object-contain" />
```

Replace with:

```tsx
<VideoPlayer videoRef={videoElementRef} className="w-full h-full object-contain" />
```

- [ ] **Step 3: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors related to `VideoPlayer`.

- [ ] **Step 4: Run lint**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/marker/video/VideoPlayer.tsx src/app/marker/[sceneId]/page.tsx
git commit -m "refactor: lift videoRef into VideoPlayer prop, remove native controls"
```

---

## Task 2: Create `VideoControls` component

**Files:**
- Create: `src/components/marker/video/VideoControls.tsx`
- Create: `src/components/marker/video/VideoControls.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `src/components/marker/video/VideoControls.test.tsx`:

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { VideoControls } from "./VideoControls";
import markerReducer from "@/store/slices/markerSlice";
import configReducer from "@/store/slices/configSlice";

function makeStore(overrides = {}) {
  return configureStore({
    reducer: { marker: markerReducer, config: configReducer },
    preloadedState: {
      marker: {
        video: {
          isPlaying: false,
          currentTime: 65,
          duration: 252,
          pendingSeek: null,
          pendingPlayPause: null,
          playbackRate: 1,
        },
      },
      ...overrides,
    } as any,
  });
}

function makeVideoRef(overrides: Partial<HTMLVideoElement> = {}) {
  const video = {
    volume: 0.8,
    muted: false,
    ...overrides,
  } as HTMLVideoElement;
  return { current: video } as React.RefObject<HTMLVideoElement | null>;
}

describe("VideoControls", () => {
  it("renders play button when paused", () => {
    render(
      <Provider store={makeStore()}>
        <VideoControls videoRef={makeVideoRef()} />
      </Provider>
    );
    expect(screen.getByRole("button", { name: /play/i })).toBeInTheDocument();
  });

  it("renders pause button when playing", () => {
    const store = makeStore();
    store.dispatch({ type: "marker/setVideoPlaying", payload: true });
    render(
      <Provider store={store}>
        <VideoControls videoRef={makeVideoRef()} />
      </Provider>
    );
    expect(screen.getByRole("button", { name: /pause/i })).toBeInTheDocument();
  });

  it("displays formatted current time and duration", () => {
    render(
      <Provider store={makeStore()}>
        <VideoControls videoRef={makeVideoRef()} />
      </Provider>
    );
    // 65s = 1:05, 252s = 4:12
    expect(screen.getByText("1:05 / 4:12")).toBeInTheDocument();
  });

  it("dispatches togglePlayPause on play button click", () => {
    const store = makeStore();
    const dispatch = jest.spyOn(store, "dispatch");
    render(
      <Provider store={store}>
        <VideoControls videoRef={makeVideoRef()} />
      </Provider>
    );
    fireEvent.click(screen.getByRole("button", { name: /play/i }));
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: "marker/togglePlayPause" })
    );
  });

  it("renders seek bar with correct value", () => {
    render(
      <Provider store={makeStore()}>
        <VideoControls videoRef={makeVideoRef()} />
      </Provider>
    );
    const seekBar = screen.getByRole("slider", { name: /seek/i });
    expect(seekBar).toHaveValue("65");
  });

  it("renders volume slider with value from videoRef", () => {
    render(
      <Provider store={makeStore()}>
        <VideoControls videoRef={makeVideoRef({ volume: 0.8 } as HTMLVideoElement)} />
      </Provider>
    );
    const volumeSlider = screen.getByRole("slider", { name: /volume/i });
    expect(volumeSlider).toHaveValue("0.8");
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- VideoControls.test --no-coverage
```

Expected: FAIL — `VideoControls` module not found.

- [ ] **Step 3: Create `VideoControls` component**

Create `src/components/marker/video/VideoControls.tsx`:

```tsx
import { useCallback, useEffect, useState } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  selectCurrentVideoTime,
  selectVideoDuration,
  selectVideoIsPlaying,
  seekToTime,
  togglePlayPause,
} from "@/store/slices/markerSlice";
import { formatSeconds } from "@/core/marker/markerLogic";

interface VideoControlsProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
}

export function VideoControls({ videoRef }: VideoControlsProps) {
  const dispatch = useAppDispatch();
  const currentTime = useAppSelector(selectCurrentVideoTime);
  const duration = useAppSelector(selectVideoDuration);
  const isPlaying = useAppSelector(selectVideoIsPlaying);

  const [volume, setVolume] = useState(() => {
    const saved = localStorage.getItem("player-volume");
    return saved !== null ? parseFloat(saved) : 1;
  });
  const [muted, setMuted] = useState(() => {
    const saved = localStorage.getItem("player-muted");
    return saved === "true";
  });

  // Sync volume/mute to video element whenever they change
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = volume;
    video.muted = muted;
  }, [volume, muted, videoRef]);

  // Restore volume/mute from localStorage on mount (was previously in VideoPlayer)
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = volume;
    video.muted = muted;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoRef]);

  const handleSeek = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      dispatch(seekToTime(parseFloat(e.target.value)));
    },
    [dispatch]
  );

  const handleVolumeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = parseFloat(e.target.value);
      setVolume(value);
      localStorage.setItem("player-volume", String(value));
      if (value > 0 && muted) {
        setMuted(false);
        localStorage.setItem("player-muted", "false");
      }
    },
    [muted]
  );

  const handleMuteToggle = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      localStorage.setItem("player-muted", String(next));
      return next;
    });
  }, []);

  const handlePlayPause = useCallback(() => {
    dispatch(togglePlayPause());
  }, [dispatch]);

  const timeDisplay = `${formatSeconds(currentTime)} / ${formatSeconds(duration ?? 0)}`;

  return (
    <div className="flex items-center gap-2 bg-gray-800 px-3 py-1.5">
      {/* Play/pause */}
      <button
        onClick={handlePlayPause}
        aria-label={isPlaying ? "Pause" : "Play"}
        className="text-white hover:text-blue-400 transition-colors flex-shrink-0"
      >
        {isPlaying ? (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
              clipRule="evenodd"
            />
          </svg>
        )}
      </button>

      {/* Seek bar */}
      <input
        type="range"
        aria-label="Seek"
        min={0}
        max={duration ?? 0}
        step={0.1}
        value={currentTime}
        onChange={handleSeek}
        className="flex-1 h-1 accent-blue-500 cursor-pointer"
      />

      {/* Time display */}
      <span className="text-gray-400 text-xs font-mono flex-shrink-0 tabular-nums">
        {timeDisplay}
      </span>

      {/* Mute toggle */}
      <button
        onClick={handleMuteToggle}
        aria-label={muted ? "Unmute" : "Mute"}
        className="text-white hover:text-blue-400 transition-colors flex-shrink-0"
      >
        {muted || volume === 0 ? (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM12.293 7.293a1 1 0 011.414 0L15 8.586l1.293-1.293a1 1 0 111.414 1.414L16.414 10l1.293 1.293a1 1 0 01-1.414 1.414L15 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L13.586 10l-1.293-1.293a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM12.22 5.22a.75.75 0 011.06 0c.98.98 1.594 2.327 1.594 3.78s-.615 2.8-1.594 3.78a.75.75 0 11-1.06-1.06A3.502 3.502 0 0013.874 9a3.502 3.502 0 00-1.654-2.72.75.75 0 010-1.06z"
              clipRule="evenodd"
            />
          </svg>
        )}
      </button>

      {/* Volume slider */}
      <input
        type="range"
        aria-label="Volume"
        min={0}
        max={1}
        step={0.05}
        value={muted ? 0 : volume}
        onChange={handleVolumeChange}
        className="w-20 h-1 accent-blue-500 cursor-pointer"
      />
    </div>
  );
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- VideoControls.test --no-coverage
```

Expected: all 6 tests PASS.

- [ ] **Step 5: Run TypeScript check and lint**

```bash
npx tsc --noEmit && npm run lint
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/marker/video/VideoControls.tsx src/components/marker/video/VideoControls.test.tsx
git commit -m "feat: add VideoControls component with seek, play/pause, volume"
```

---

## Task 3: Wire `VideoControls` into the marker page layout

**Files:**
- Modify: `src/app/marker/[sceneId]/page.tsx`

- [ ] **Step 1: Import `VideoControls` in the marker page**

In `src/app/marker/[sceneId]/page.tsx`, add to the imports:

```tsx
import { VideoControls } from "../../../components/marker/video/VideoControls";
```

- [ ] **Step 2: Add `<VideoControls>` below `<VideoPlayer>` in the JSX**

Find the video section in the layout (around line 1234–1239):

```tsx
<div className="w-2/3 flex flex-col min-h-0 bg-black">
  <VideoPlayer videoRef={videoElementRef} className="w-full h-full object-contain" />
</div>
```

Replace with:

```tsx
<div className="w-2/3 flex flex-col min-h-0 bg-black">
  <VideoPlayer videoRef={videoElementRef} className="w-full flex-1 object-contain" />
  <VideoControls videoRef={videoElementRef} />
</div>
```

- [ ] **Step 3: Run TypeScript check and lint**

```bash
npx tsc --noEmit && npm run lint
```

Expected: no errors.

- [ ] **Step 4: Run full test suite**

```bash
npm test -- --no-coverage
```

Expected: all tests pass (255+ passing).

- [ ] **Step 5: Commit**

```bash
git add src/app/marker/[sceneId]/page.tsx
git commit -m "feat: wire VideoControls into marker page below video"
```

---

## Task 4: Manual verification

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

- [ ] **Step 2: Open the marker page in Safari and verify**
  - Video plays without dimming when paused ✓
  - Play/pause button reflects correct state ✓
  - Seek bar scrubs video ✓
  - Time display updates as video plays ✓
  - Volume slider changes volume ✓
  - Mute toggle mutes/unmutes ✓
  - Existing keyboard shortcuts still work (space, arrow keys etc.) ✓

- [ ] **Step 3: Open in Chrome/Firefox and verify same behavior**

- [ ] **Step 4: Bump version**

```bash
npm version patch --no-git-tag-version
```

Then commit:

```bash
git add package.json package-lock.json
git commit -m "chore: bump version to $(node -p "require('./package.json').version")"
```
