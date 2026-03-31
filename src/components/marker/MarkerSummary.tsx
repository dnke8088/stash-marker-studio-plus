"use client";

import { useCallback } from "react";
import type { SceneMarker } from "../../services/StashappService";

interface MarkerSummaryStats {
  confirmed: number;
  rejected: number;
  unknown: number;
}

interface MarkerSummaryProps {
  markerSummary: MarkerSummaryStats;
  shotBoundariesCount: number;
  incorrectMarkersCount: number;
  markers: SceneMarker[] | null;
  isCreatingMarker: boolean;
  isDuplicatingMarker: boolean;
  selectedMarkerId: string | null;
  onCreateMarker: () => void;
  onSplitMarker: () => void;
  actionMarkers: SceneMarker[];
  createOrDuplicateMarker: (startTime: number, endTime: number | null, sourceMarker?: SceneMarker) => void;
}

export function MarkerSummary({
  markerSummary,
  shotBoundariesCount,
  incorrectMarkersCount,
  markers,
  isCreatingMarker,
  isDuplicatingMarker,
  selectedMarkerId,
  onCreateMarker,
  onSplitMarker,
  actionMarkers,
  createOrDuplicateMarker,
}: MarkerSummaryProps) {
  const handleDuplicateClick = useCallback(() => {
    const currentMarker = actionMarkers.find(
      (m) => m.id === selectedMarkerId
    );
    if (!currentMarker) {
      console.log(
        "Cannot duplicate marker: No current marker found"
      );
      return;
    }
    createOrDuplicateMarker(
      currentMarker.seconds, 
      currentMarker.end_seconds ?? null, 
      currentMarker
    );
  }, [actionMarkers, selectedMarkerId, createOrDuplicateMarker]);

  const isMarkerActionDisabled = isCreatingMarker ||
    isDuplicatingMarker ||
    markers?.some((m) => m.id.startsWith("temp-"));

  return (
    <div
      className="bg-gray-700 p-4 rounded-none flex flex-wrap items-center gap-2 sticky top-0 z-10"
      data-testid="marker-summary"
    >
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center">
          <span className="text-green-400 mr-1">✓</span>
          <span className="text-white">
            {markerSummary.confirmed}
          </span>
        </div>
        <div className="flex items-center">
          <span className="text-red-400 mr-1">✗</span>
          <span className="text-white">
            {markerSummary.rejected}
          </span>
        </div>
        {incorrectMarkersCount > 0 && (
          <div className="flex items-center" title="Reject and flag for AI feedback (F)">
            <span className="text-purple-400 mr-1">⚑</span>
            <span className="text-white">
              {incorrectMarkersCount}
            </span>
          </div>
        )}
        <div className="flex items-center">
          <span className="text-yellow-400 mr-1">?</span>
          <span className="text-white">
            {markerSummary.unknown}
          </span>
        </div>
        {shotBoundariesCount > 0 && (
          <div className="flex items-center">
            <span className="text-gray-400 mr-1">🎥</span>
            <span className="text-white text-xs">
              {shotBoundariesCount} shots
            </span>
          </div>
        )}
      </div>
      {/* Compact marker action buttons */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={onCreateMarker}
          disabled={isMarkerActionDisabled}
          title="Create New Marker (A)"
          className={`px-2 py-1 rounded-sm text-xs flex items-center ${
            isMarkerActionDisabled
              ? "bg-gray-500 cursor-not-allowed text-gray-300"
              : "bg-green-500 hover:bg-green-700 text-white"
          }`}
        >
          <svg
            className="w-4 h-4 mr-1"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3m0 0v3m0-3h3m-3 0H9m9 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          New
        </button>
        <button
          onClick={onSplitMarker}
          title="Split Current Marker (S)"
          className="bg-blue-500 hover:bg-blue-700 text-white px-2 py-1 rounded-sm text-xs flex items-center"
        >
          <svg
            className="w-4 h-4 mr-1"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 6h16M4 12h8m-8 6h16"
            />
          </svg>
          Split
        </button>
        <button
          onClick={handleDuplicateClick}
          disabled={isMarkerActionDisabled}
          title="Duplicate Current Marker (D)"
          className={`px-2 py-1 rounded-sm text-xs flex items-center ${
            isMarkerActionDisabled
              ? "bg-gray-500 cursor-not-allowed text-gray-300"
              : "bg-indigo-500 hover:bg-indigo-700 text-white"
          }`}
        >
          <svg
            className="w-4 h-4 mr-1"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <rect
              x="9"
              y="9"
              width="13"
              height="13"
              rx="2"
              ry="2"
            />
            <rect
              x="1"
              y="1"
              width="13"
              height="13"
              rx="2"
              ry="2"
            />
          </svg>
          Duplicate
        </button>
      </div>
    </div>
  );
}