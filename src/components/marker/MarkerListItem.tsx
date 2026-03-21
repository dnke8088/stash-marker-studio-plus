"use client";

import React from "react";
import { SceneMarker } from "../../services/StashappService";
import { formatSeconds, isMarkerConfirmed, isMarkerRejected } from "../../core/marker/markerLogic";
import { TagAutocomplete } from "./TagAutocomplete";
import { TempMarkerForm } from "./TempMarkerForm";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import { formatSecondsForInput, parseTimeString } from "../../core/marker/timeFormat";
import { selectCurrentVideoTime } from "../../store/slices/markerSlice";
import { useState, useEffect } from "react";
import {
  setMarkers,
  setSelectedMarkerId,
  setCreatingMarker,
  setDuplicatingMarker,
  setError,
  createMarker,
} from "../../store/slices/markerSlice";
import { selectMarkerStatusConfirmed, selectMarkerStatusRejected } from "@/store/slices/configSlice";
import { type Tag } from "../../services/StashappService";
import { IncorrectMarker } from "../../utils/incorrectMarkerStorage";

interface MarkerListItemProps {
  marker: SceneMarker;
  selectedMarkerId: string | null;
  editingMarkerId: string | null;
  editingTagId: string;
  availableTags: Tag[];
  incorrectMarkers: IncorrectMarker[];
  videoElementRef: React.RefObject<HTMLVideoElement | null>;
  markers: SceneMarker[] | null;
  actionMarkers: SceneMarker[];
  onMarkerClick: (marker: SceneMarker) => void;
  onEditMarker: (marker: SceneMarker) => void;
  onSaveEditWithTagId: (marker: SceneMarker, tagId?: string, startSeconds?: number, endSeconds?: number | null) => Promise<void>;
  onCancelEdit: () => void;
  setEditingTagId: (tagId: string) => void;
}

export function MarkerListItem({
  marker,
  selectedMarkerId,
  editingMarkerId,
  editingTagId,
  availableTags,
  incorrectMarkers,
  videoElementRef,
  markers,
  actionMarkers,
  onMarkerClick,
  onEditMarker,
  onSaveEditWithTagId,
  onCancelEdit,
  setEditingTagId,
}: MarkerListItemProps) {
  const dispatch = useAppDispatch();
  const markerStatusConfirmed = useAppSelector(selectMarkerStatusConfirmed);
  const markerStatusRejected = useAppSelector(selectMarkerStatusRejected);

  const isEditing = editingMarkerId === marker.id;

  const currentVideoTime = useAppSelector(selectCurrentVideoTime);

  const [startTimeStr, setStartTimeStr] = useState("");
  const [endTimeStr, setEndTimeStr] = useState("");
  const [startTimeError, setStartTimeError] = useState(false);
  const [endTimeError, setEndTimeError] = useState(false);

  // Initialize time strings when entering edit mode; clear errors when leaving
  useEffect(() => {
    if (isEditing) {
      setStartTimeStr(formatSecondsForInput(marker.seconds));
      setEndTimeStr(marker.end_seconds != null ? formatSecondsForInput(marker.end_seconds) : "");
      setStartTimeError(false);
      setEndTimeError(false);
    } else {
      setStartTimeError(false);
      setEndTimeError(false);
    }
  }, [isEditing, marker.seconds, marker.end_seconds]);

  const handleSaveEdit = () => {
    // Initialize with marker's current start time; overwritten on successful parse.
    // Note: parsedStart <= 0 is blocked by validation. A marker at exactly 0:00.000
    // will always fail — editing such a marker's start time is a known limitation.
    let parsedStart: number = marker.seconds;
    let parsedEnd: number | null = null; // null = no end time, explicitly allowed
    let hasError = false;

    try {
      parsedStart = parseTimeString(startTimeStr);
      if (parsedStart <= 0) throw new Error("Must be > 0");
      setStartTimeError(false);
    } catch {
      setStartTimeError(true);
      hasError = true;
    }

    if (endTimeStr.trim() !== "") {
      try {
        parsedEnd = parseTimeString(endTimeStr);
        if (parsedEnd <= 0) throw new Error("Must be > 0");
        setEndTimeError(false);
      } catch {
        setEndTimeError(true);
        hasError = true;
      }
    }

    if (!hasError && parsedEnd !== null && parsedStart >= parsedEnd) {
      setStartTimeError(true);
      hasError = true;
    }

    if (!hasError) {
      void onSaveEditWithTagId(marker, editingTagId, parsedStart, parsedEnd);
    }
  };

  const isSelected = marker.id === selectedMarkerId;
  const isTemp = marker.id === "temp-new" || marker.id === "temp-duplicate";

  return (
    <div
      key={marker.id}
      data-marker-id={marker.id}
      className={`p-2 border-l-4 ${
        isTemp
          ? "bg-blue-800 border-blue-400"
          : isSelected
          ? "bg-gray-700 text-white border-blue-500"
          : incorrectMarkers.some((m) => m.markerId === marker.id)
          ? "bg-purple-900/50 border-purple-500 hover:bg-purple-800"
          : "hover:bg-gray-600 hover:text-white border-transparent"
      }`}
      onClick={() => onMarkerClick(marker)}
      onMouseEnter={() => {}}
      onMouseLeave={() => {}}
    >
      {isTemp ? (
        <TempMarkerForm
          marker={marker}
          availableTags={availableTags}
          videoElement={videoElementRef.current}
          onSave={async (newStart, newEnd, newTagId) => {
            try {
              const isDuplicating = marker.id === "temp-duplicate";
              
              // Remove temp markers first
              const realMarkers = (markers || []).filter(
                (m) => !m.id.startsWith("temp-")
              );
              dispatch(setMarkers(realMarkers));

              // Create marker using Redux thunk
              let result;
              if (isDuplicating) {
                // For duplication, we need the source marker ID
                // Since this is a temp marker, we don't have the original source ID
                // We'll use createMarker instead
                result = await dispatch(createMarker({
                  sceneId: marker.scene.id,
                  startTime: newStart,
                  endTime: newEnd ?? null,
                  tagId: newTagId,
                }));
              } else {
                result = await dispatch(createMarker({
                  sceneId: marker.scene.id,
                  startTime: newStart,
                  endTime: newEnd ?? null,
                  tagId: newTagId,
                }));
              }

              // On success, select the new marker
              if (createMarker.fulfilled.match(result)) {
                const newMarkerId = result.payload.id;
                dispatch(setSelectedMarkerId(newMarkerId));
              }

              // Clear UI flags
              dispatch(setCreatingMarker(false));
              dispatch(setDuplicatingMarker(false));
            } catch (error) {
              console.error("Error creating marker:", error);
              dispatch(setError(`Failed to create marker: ${error}`));

              // Clean up on error - remove temp markers and clear flags
              const realMarkers = (markers || []).filter(
                (m) => !m.id.startsWith("temp-")
              );
              dispatch(setMarkers(realMarkers));
              dispatch(setCreatingMarker(false));
              dispatch(setDuplicatingMarker(false));
            }
          }}
          onCancel={() => {
            // Remove temp marker
            const realMarkers = (markers || []).filter(
              (m) => !m.id.startsWith("temp-")
            );
            dispatch(setMarkers(realMarkers));
            // Reset selected marker to first marker
            if (actionMarkers.length > 0) {
              dispatch(setSelectedMarkerId(actionMarkers[0].id));
            } else {
              dispatch(setSelectedMarkerId(null));
            }
            dispatch(setCreatingMarker(false));
            dispatch(setDuplicatingMarker(false));
          }}
          isDuplicate={marker.id === "temp-duplicate"}
        />
      ) : (
        <div className="flex items-center justify-between">
          <div
            className="flex-1 cursor-pointer"
            onClick={() => !isEditing && onMarkerClick(marker)}
          >
            <div className="flex items-center">
              {isMarkerRejected(marker) && (
                <span className="text-red-500 mr-2">✗</span>
              )}
              {!isMarkerRejected(marker) && isMarkerConfirmed(marker) && (
                <span className="text-green-500 mr-2">✓</span>
              )}
              {!isMarkerRejected(marker) && !isMarkerConfirmed(marker) && (
                <span className="text-yellow-500 mr-2">?</span>
              )}

              {isEditing ? (
                <div className="flex items-center gap-2 flex-1 flex-wrap">
                  {/* Start time */}
                  <input
                    type="text"
                    value={startTimeStr}
                    onChange={(e) => setStartTimeStr(e.target.value)}
                    className={`w-24 bg-gray-700 text-white text-xs px-2 py-1 rounded-sm border ${startTimeError ? "border-red-500" : "border-transparent"}`}
                    placeholder="0:00.000"
                    aria-label="Start time"
                    title="Format: M:SS.mmm (e.g. 1:23.456). Must be greater than 0."
                  />
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setStartTimeStr(formatSecondsForInput(currentVideoTime ?? 0)); }}
                    className="text-xs text-gray-400 hover:text-white px-1"
                    title="Set start to current time"
                  >
                    ▶
                  </button>
                  <span className="text-gray-500 text-xs">→</span>
                  {/* End time */}
                  <input
                    type="text"
                    value={endTimeStr}
                    onChange={(e) => setEndTimeStr(e.target.value)}
                    className={`w-24 bg-gray-700 text-white text-xs px-2 py-1 rounded-sm border ${endTimeError ? "border-red-500" : "border-transparent"}`}
                    placeholder="none"
                    aria-label="End time"
                  />
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setEndTimeStr(formatSecondsForInput(currentVideoTime ?? 0)); }}
                    className="text-xs text-gray-400 hover:text-white px-1"
                    title="Set end to current time"
                  >
                    ▶
                  </button>
                  {/* Tag */}
                  <TagAutocomplete
                    value={editingTagId}
                    onChange={setEditingTagId}
                    availableTags={availableTags}
                    placeholder="Type to search tags..."
                    className="flex-1 min-w-32"
                    autoFocus={isEditing}
                    onCancel={onCancelEdit}
                  />
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleSaveEdit(); }}
                    className="text-xs text-gray-300 hover:text-white px-2 py-1 bg-gray-700 rounded"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onCancelEdit(); }}
                    className="text-xs text-gray-400 hover:text-white px-2 py-1 bg-gray-600 rounded"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <>
                  <span className="font-bold mr-2">
                    {marker.primary_tag.name}
                  </span>
                  <span className="text-xs text-gray-400">
                    {marker.end_seconds
                      ? `${formatSeconds(marker.seconds, true)} - ${formatSeconds(
                          marker.end_seconds,
                          true
                        )}`
                      : formatSeconds(marker.seconds, true)}
                  </span>
                </>
              )}
            </div>
            {!isEditing && (
              <p className="text-xs mt-1 text-gray-600">
                {marker.tags
                  .filter(
                    (tag) =>
                      tag.id !== markerStatusConfirmed &&
                      tag.id !== markerStatusRejected
                  )
                  .map((tag) => tag.name)
                  .join(", ")}
              </p>
            )}
          </div>
          {!isEditing && (
            <div className="flex items-center space-x-1 ml-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEditMarker(marker);
                }}
                className="text-gray-400 hover:text-white p-1"
                title="Edit marker (Q)"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                  />
                </svg>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}