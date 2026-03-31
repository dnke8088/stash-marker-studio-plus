"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
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
  const duration = useAppSelector(selectVideoDuration);
  const isPlaying = useAppSelector(selectVideoIsPlaying);

  const seekBarRef = useRef<HTMLInputElement>(null);
  const timeDisplayRef = useRef<HTMLSpanElement>(null);

  const [volume, setVolume] = useState(() => {
    const saved = localStorage.getItem("player-volume");
    if (saved !== null) return parseFloat(saved);
    return videoRef.current?.volume ?? 1;
  });
  const [muted, setMuted] = useState(() => {
    const saved = localStorage.getItem("player-muted");
    if (saved !== null) return saved === "true";
    return videoRef.current?.muted ?? false;
  });

  // Sync volume/mute to video element whenever they change
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = volume;
    video.muted = muted;
  }, [volume, muted, videoRef]);

  // Update seek bar and time display directly from video events — bypasses Redux re-renders
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const update = () => {
      const t = video.currentTime;
      const d = video.duration || 0;
      if (seekBarRef.current) seekBarRef.current.value = String(t);
      if (timeDisplayRef.current) {
        timeDisplayRef.current.textContent = `${formatSeconds(t)} / ${formatSeconds(d)}`;
      }
    };

    video.addEventListener("timeupdate", update);
    video.addEventListener("seeked", update);
    return () => {
      video.removeEventListener("timeupdate", update);
      video.removeEventListener("seeked", update);
    };
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

  return (
    <div className="flex items-center gap-3 bg-gray-800 px-4 py-2">
      {/* Play/pause */}
      <button
        onClick={handlePlayPause}
        aria-label={isPlaying ? "Pause" : "Play"}
        className="text-white hover:text-blue-400 transition-colors flex-shrink-0"
      >
        {isPlaying ? (
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
        ) : (
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
              clipRule="evenodd"
            />
          </svg>
        )}
      </button>

      {/* Seek bar — uncontrolled, updated directly via DOM ref */}
      <input
        ref={seekBarRef}
        type="range"
        aria-label="Seek"
        min={0}
        max={duration ?? 0}
        step={0.1}
        defaultValue={0}
        onChange={handleSeek}
        onMouseUp={(e) => e.currentTarget.blur()}
        tabIndex={-1}
        className="flex-1 h-1 accent-blue-500 cursor-pointer"
      />

      {/* Time display — updated directly via DOM ref */}
      <span
        ref={timeDisplayRef}
        className="text-gray-400 text-xs font-mono flex-shrink-0 tabular-nums"
      >
        {`${formatSeconds(0)} / ${formatSeconds(duration ?? 0)}`}
      </span>

      {/* Mute toggle */}
      <button
        onClick={handleMuteToggle}
        aria-label={muted ? "Unmute" : "Mute"}
        className="text-white hover:text-blue-400 transition-colors flex-shrink-0"
      >
        {muted || volume === 0 ? (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM12.293 7.293a1 1 0 011.414 0L15 8.586l1.293-1.293a1 1 0 111.414 1.414L16.414 10l1.293 1.293a1 1 0 01-1.414 1.414L15 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L13.586 10l-1.293-1.293a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
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
        onMouseUp={(e) => e.currentTarget.blur()}
        tabIndex={-1}
        className="w-20 h-1 accent-blue-500 cursor-pointer"
      />
    </div>
  );
}
