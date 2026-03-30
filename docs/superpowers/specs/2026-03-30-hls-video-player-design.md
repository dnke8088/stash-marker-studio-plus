# HLS Video Player

**Date:** 2026-03-30

## Problem

`VideoPlayer.tsx` uses Stash's `/stream` endpoint, which direct-streams the original file. Safari cannot play legacy formats (WMV, AVI, etc.) natively. Stash's HLS endpoint (`/stream.m3u8`) transcodes incompatible formats on the fly, but HLS is not supported natively by Chrome or Firefox.

## Solution

Use `hls.js` to play the HLS stream in all browsers. Safari supports HLS natively so it uses the `.m3u8` URL directly; all other browsers use `hls.js` to handle the stream.

## Behaviour

- All browsers play the HLS stream from Stash's `/stream.m3u8` endpoint.
- Safari (and any browser with native HLS support) uses the `<video src>` attribute directly.
- Chrome, Firefox, and other non-native browsers use `hls.js` attached to the video element.
- Detection is done via feature detection (`video.canPlayType('application/vnd.apple.mpegurl')`), not user-agent sniffing.
- The HLS instance is destroyed on component unmount and whenever the scene changes, preventing memory leaks.
- All existing behaviour (seek, play/pause, volume persistence, Redux event listeners) is unchanged.

## Dependencies

- Add `hls.js` npm package (`npm install hls.js`). TypeScript types are bundled — no separate `@types` package needed.

## Data Flow

The video URL changes from:
```
${stashUrl}/scene/${scene.id}/stream?apikey=${stashApiKey}
```
to:
```
${stashUrl}/scene/${scene.id}/stream.m3u8?apikey=${stashApiKey}
```

## Implementation

In `VideoPlayer.tsx`, add a `useEffect` that runs when `scene` changes:

```ts
useEffect(() => {
  const video = videoRef.current;
  if (!video || !scene) return;

  const url = `${stashUrl}/scene/${scene.id}/stream.m3u8?apikey=${stashApiKey}`;

  if (video.canPlayType('application/vnd.apple.mpegurl')) {
    // Safari: native HLS support
    video.src = url;
  } else if (Hls.isSupported()) {
    // Chrome, Firefox, etc.: use hls.js
    const hls = new Hls();
    hls.loadSource(url);
    hls.attachMedia(video);
    return () => hls.destroy();
  }
}, [scene, stashUrl, stashApiKey]);
```

The existing `src` prop is removed from the `<video>` element — the effect manages the source instead.

## Files Changed

- `src/components/marker/video/VideoPlayer.tsx` — add HLS.js setup effect, remove `src` prop from `<video>`
- `package.json` / `package-lock.json` — add `hls.js` dependency
