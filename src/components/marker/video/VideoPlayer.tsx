"use client";

import { useEffect } from "react";
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
