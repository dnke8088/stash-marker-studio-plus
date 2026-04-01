"use client";

import { useEffect, useRef } from "react";
import Hls from "hls.js";

interface UseHlsPreloaderParams {
  url: string | null;
  targetTime: number | null;
}

export function useHlsPreloader({ url, targetTime }: UseHlsPreloaderParams) {
  const hlsRef = useRef<Hls | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Create the hidden video element once on mount
  useEffect(() => {
    if (!Hls.isSupported()) return; // Safari uses native HLS; skip

    const video = document.createElement("video");
    video.muted = true;
    video.preload = "auto";
    video.style.cssText = "display:none;position:absolute;pointer-events:none";
    video.setAttribute("aria-hidden", "true");
    document.body.appendChild(video);
    videoRef.current = video;

    return () => {
      hlsRef.current?.destroy();
      hlsRef.current = null;
      video.remove();
      videoRef.current = null;
    };
  }, []);

  // When url or targetTime changes, seek the preloader to the new position
  useEffect(() => {
    if (!Hls.isSupported() || !url || targetTime === null) return;
    const video = videoRef.current;
    if (!video) return;

    hlsRef.current?.destroy();

    const hls = new Hls({
      autoStartLoad: false,
      maxBufferLength: 12,
      maxMaxBufferLength: 12,
      startPosition: targetTime,
      debug: false,
    });

    hls.loadSource(url);
    hls.attachMedia(video);

    hls.once(Hls.Events.MANIFEST_PARSED, () => {
      video.currentTime = targetTime;
      hls.startLoad(targetTime);
    });

    hlsRef.current = hls;

    return () => {
      hls.destroy();
      hlsRef.current = null;
    };
  }, [url, targetTime]);
}
