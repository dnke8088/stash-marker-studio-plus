"use client";

import { useCallback, useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppSelector } from "@/store/hooks";
import { selectStashUrl } from "@/store/slices/configSlice";
import type { Scene, SceneMarker } from "../../services/StashappService";
import { isMarkerRejected, isMarkerConfirmed } from "../../core/marker/markerLogic";
import { IncorrectMarker } from "../../utils/incorrectMarkerStorage";
import { navigationPersistence } from "@/utils/navigationPersistence";
import Link from "next/link";

interface MarkerPageHeaderProps {
  scene: Scene | null;
  markers: SceneMarker[] | null;
  incorrectMarkers: IncorrectMarker[];
  isLoading: boolean;
  checkAllMarkersApproved: () => boolean;
  onDeleteRejected: () => void;
  onOpenCollectModal: () => void;
  onCorrespondingTagConversion: () => void;
  onComplete: () => void;
  isShotBoundaryProcessed: boolean;
  isDetectingShots: boolean;
  onDetectShots: () => void;
  shotBoundaryEnabled: boolean;
}

export function MarkerPageHeader({
  scene,
  markers,
  incorrectMarkers,
  isLoading,
  checkAllMarkersApproved,
  onDeleteRejected,
  onOpenCollectModal,
  onCorrespondingTagConversion,
  onComplete,
  isShotBoundaryProcessed,
  isDetectingShots,
  onDetectShots,
  shotBoundaryEnabled,
}: MarkerPageHeaderProps) {
  const router = useRouter();
  const stashUrl = useAppSelector(selectStashUrl);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Calculate counts for button display
  const rejectedMarkersCount = markers?.filter(isMarkerRejected).length || 0;

  // Count confirmed markers that have corresponding tag metadata
  const correspondingTagsCount = markers?.filter(marker => {
    const isConfirmed = isMarkerConfirmed(marker);
    const description = marker.primary_tag.description || '';
    return isConfirmed && description.toLowerCase().includes('corresponding tag:');
  }).length || 0;

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSwitchScene = useCallback(() => {
    router.push("/search");
  }, [router]);

  const handleSettingsClick = useCallback(() => {
    const currentPath = window.location.pathname + window.location.search;
    const title = scene ? `Marker Review - ${scene.title}` : 'Marker Review';
    navigationPersistence.storePreviousPage(currentPath, title);
  }, [scene]);

  const handleMenuAction = useCallback((action: () => void) => {
    setMenuOpen(false);
    action();
  }, []);

  const sceneTitle = scene
    ? scene.title || scene.files?.[0]?.basename || scene.id
    : "Scene Markers";

  const starRating = scene?.rating100 != null
    ? Math.round(scene.rating100 / 20)
    : null;

  return (
    <div className="bg-gray-900 text-white px-6 py-3 border-b border-gray-700 flex-shrink-0">
      <div className="flex items-center gap-4">

        {/* Left: back button */}
        <button
          onClick={handleSwitchScene}
          className="bg-blue-500 hover:bg-blue-700 text-white px-3 py-1.5 rounded-sm text-sm transition-colors flex-shrink-0"
          title="Return to scene search"
        >
          ← Back
        </button>

        {/* Center: title + metadata, grows to fill space */}
        <div className="flex flex-col min-w-0 flex-1">
          {scene ? (
            <a
              href={`${stashUrl}/scenes/${scene.id}`}
              target="_blank"
              rel="noopener noreferrer"
              title="View in Stash"
              className="text-lg font-bold truncate hover:text-blue-300 transition-colors underline decoration-gray-600 underline-offset-2"
            >
              {sceneTitle}
            </a>
          ) : (
            <h1 className="text-lg font-bold truncate">{sceneTitle}</h1>
          )}
          {scene && (
            <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400">
              {scene.studio && (
                <span className="text-gray-300 font-medium">{scene.studio.name}</span>
              )}
              {starRating !== null && (
                <span className="tracking-tight" title={`${scene.rating100}/100`}>
                  {Array.from({ length: 5 }, (_, i) =>
                    i < starRating ? "★" : "☆"
                  ).join("")}
                </span>
              )}
              {scene.play_count != null && scene.play_count > 0 && (
                <span title="Play count">👁 {scene.play_count}</span>
              )}
              {scene.o_counter != null && scene.o_counter > 0 && (
                <span title="O-counter">💦 {scene.o_counter}</span>
              )}
            </div>
          )}
        </div>

        {/* Right: action buttons + settings */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {shotBoundaryEnabled && (
            <button
              onClick={onDetectShots}
              disabled={isLoading || isDetectingShots}
              className="px-3 py-1.5 rounded-sm text-sm transition-colors text-blue-300 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
              title={isShotBoundaryProcessed ? "Re-detect shot boundaries" : "Detect shot boundaries"}
            >
              {isDetectingShots ? (
                <span className="flex items-center gap-1.5">
                  <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Detecting…
                </span>
              ) : isShotBoundaryProcessed ? "Re-detect Shots" : "Detect Shots"}
            </button>
          )}

          <button
            onClick={onComplete}
            disabled={isLoading}
            className={`px-3 py-1.5 rounded-sm text-sm font-medium transition-colors ${
              !checkAllMarkersApproved()
                ? "bg-yellow-600 hover:bg-yellow-700 text-white"
                : "bg-green-600 hover:bg-green-700 text-white"
            } disabled:bg-gray-600 disabled:cursor-not-allowed`}
            title={
              !checkAllMarkersApproved()
                ? "Complete scene (some markers not approved - warnings will be shown)"
                : "Complete scene (generate markers, mark as reviewed, and clean up tags)"
            }
          >
            {!checkAllMarkersApproved() ? "⚠️ Complete" : "Complete"}
          </button>

          {/* More actions dropdown */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(prev => !prev)}
              className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-1.5 rounded-sm text-sm transition-colors flex items-center space-x-1"
              title="More actions"
            >
              <span>More</span>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {menuOpen && (
              <div className="absolute right-0 mt-1 w-56 bg-gray-800 border border-gray-600 rounded shadow-lg z-50">
                <button
                  onClick={() => handleMenuAction(onDeleteRejected)}
                  disabled={isLoading}
                  className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center justify-between ${
                    rejectedMarkersCount > 0
                      ? "text-red-300 hover:bg-gray-700"
                      : "text-gray-400 hover:bg-gray-700"
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <span>Delete Rejected</span>
                  {rejectedMarkersCount > 0 && (
                    <span className="bg-red-600 text-white text-xs px-1.5 py-0.5 rounded-full">
                      {rejectedMarkersCount}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => handleMenuAction(onOpenCollectModal)}
                  className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center justify-between ${
                    incorrectMarkers.length > 0
                      ? "text-purple-300 hover:bg-gray-700"
                      : "text-gray-400 hover:bg-gray-700"
                  }`}
                >
                  <span>Collect AI Feedback</span>
                  {incorrectMarkers.length > 0 && (
                    <span className="bg-purple-600 text-white text-xs px-1.5 py-0.5 rounded-full">
                      {incorrectMarkers.length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => handleMenuAction(onCorrespondingTagConversion)}
                  className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center justify-between ${
                    correspondingTagsCount > 0
                      ? "text-teal-300 hover:bg-gray-700"
                      : "text-gray-400 hover:bg-gray-700"
                  }`}
                >
                  <span>Convert Corresponding Tags</span>
                  {correspondingTagsCount > 0 && (
                    <span className="bg-teal-600 text-white text-xs px-1.5 py-0.5 rounded-full">
                      {correspondingTagsCount}
                    </span>
                  )}
                </button>
              </div>
            )}
          </div>

          <Link
            href="/config"
            onClick={handleSettingsClick}
            className="flex items-center justify-center w-9 h-9 text-gray-300 hover:text-white hover:bg-gray-700 rounded transition-colors"
            title="Configuration"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </Link>
        </div>

      </div>
    </div>
  );
}
