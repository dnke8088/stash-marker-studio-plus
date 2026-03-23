import { useCallback, useEffect, useRef } from "react";
import { CompletionDefaults } from "../serverConfig";
import { useAppSelector, useAppDispatch } from "../store/hooks";
import {
  stashappService,
  type Tag,
  type SceneMarker,
} from "../services/StashappService";
import {
  selectMarkers,
  selectScene,
  selectAvailableTags,
  selectSelectedMarkerId,
  selectCurrentVideoTime,
  selectCopiedMarkerTimes,
  selectDeleteRejectedModalData,
  selectCorrespondingTagConversionModalData,
  openDeleteRejectedModal,
  openCorrespondingTagConversionModal,
  closeModal,
  setCopiedMarkerTimes,
  setError,
  clearError,
  loadMarkers,
  createMarker,
  splitMarker,
  updateMarkerTimes,
  pauseVideo,
  seekToTime,
  setSelectedMarkerId,
} from "../store/slices/markerSlice";
import {
  formatSeconds,
  isMarkerRejected,
  isShotBoundaryMarker,
  filterUnprocessedMarkers,
  calculateMarkerSummary,
} from "../core/marker/markerLogic";

type ToastFunction = (message: string, type: "success" | "error") => void;

export const useMarkerOperations = (
  actionMarkers: SceneMarker[],
  getShotBoundaries: () => SceneMarker[],
  showToast: ToastFunction
) => {
  const dispatch = useAppDispatch();
  
  // Redux selectors
  const markers = useAppSelector(selectMarkers);
  const scene = useAppSelector(selectScene);
  const availableTags = useAppSelector(selectAvailableTags);
  const selectedMarkerId = useAppSelector(selectSelectedMarkerId);
  const currentVideoTime = useAppSelector(selectCurrentVideoTime);
  const deleteRejectedModalData = useAppSelector(selectDeleteRejectedModalData);
  const correspondingTagConversionModalData = useAppSelector(selectCorrespondingTagConversionModalData);
  const copiedMarkerTimes = useAppSelector(selectCopiedMarkerTimes);

  // Track the refresh timeout so we can cancel it on unmount (prevents stale dispatch
  // when the user navigates away before the 2s marker-generation delay completes)
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (refreshTimeoutRef.current !== null) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, []);

  // Calculate marker summary
  const getMarkerSummary = useCallback(() => {
    if (!actionMarkers.length) return { confirmed: 0, rejected: 0, unknown: 0 };
    return calculateMarkerSummary(actionMarkers);
  }, [actionMarkers]);

  // Split current marker at playhead position
  const splitCurrentMarker = useCallback(async () => {
    if (!selectedMarkerId || !scene) return;

    const currentMarker = actionMarkers.find((m) => m.id === selectedMarkerId);
    if (!currentMarker) return;

    const currentTime = currentVideoTime;

    if (
      currentTime <= currentMarker.seconds ||
      (currentMarker.end_seconds && currentTime >= currentMarker.end_seconds)
    ) {
      dispatch(setError("Current time must be within the marker's range to split it"));
      return;
    }

    try {
      const originalTagIds = currentMarker.tags.map((tag) => tag.id);
      await dispatch(splitMarker({
        sceneId: scene.id,
        sourceMarkerId: currentMarker.id,
        splitTime: currentTime,
        tagId: currentMarker.primary_tag.id,
        originalTagIds: originalTagIds,
        sourceStartTime: currentMarker.seconds,
        sourceEndTime: currentMarker.end_seconds || null,
      })).unwrap();

      dispatch(pauseVideo());
      dispatch(seekToTime(currentTime));
      dispatch(setSelectedMarkerId(currentMarker.id));
    } catch (err) {
      console.error("Error splitting marker:", err);
      dispatch(setError(`Failed to split marker: ${err}`));
    }
  }, [actionMarkers, selectedMarkerId, scene, currentVideoTime, dispatch]);

  // Split a Video Cut marker at the current playhead position
  const splitVideoCutMarker = useCallback(async () => {
    const currentTime = currentVideoTime;
    const allMarkers = markers || [];

    // Find the Video Cut marker that contains the current time
    const videoCutMarker = allMarkers.find(
      (marker) =>
        isShotBoundaryMarker(marker) &&
        marker.seconds <= currentTime &&
        marker.end_seconds &&
        marker.end_seconds > currentTime
    );

    if (!videoCutMarker || !videoCutMarker.end_seconds || !scene) {
      console.log("Cannot split Video Cut marker:", {
        hasMarker: !!videoCutMarker,
        hasEndTime: !!videoCutMarker?.end_seconds,
        hasScene: !!scene,
      });
      dispatch(setError("No Video Cut marker found at current position"));
      return;
    }

    try {
      // Use Redux splitMarker thunk
      const originalTagIds = videoCutMarker.tags.map((tag) => tag.id);
      await dispatch(splitMarker({
        sceneId: scene.id,
        sourceMarkerId: videoCutMarker.id,
        splitTime: currentTime,
        tagId: videoCutMarker.primary_tag.id,
        originalTagIds: originalTagIds,
        sourceStartTime: videoCutMarker.seconds,
        sourceEndTime: videoCutMarker.end_seconds || null,
      })).unwrap();

      showToast("Video Cut marker split successfully", "success");
    } catch (err) {
      console.error("Error splitting Video Cut marker:", err);
      dispatch(setError("Failed to split Video Cut marker"));
    }
  }, [markers, currentVideoTime, scene, dispatch, showToast]);

  const createOrDuplicateMarker = useCallback(
    (startTime: number, endTime: number | null, sourceMarker?: SceneMarker) => {
      if (!scene || !availableTags?.length) return;

      const isDuplicate = !!sourceMarker;
      const tagId = isDuplicate
        ? sourceMarker.primary_tag.id
        : availableTags[0].id;

      return dispatch(createMarker({
        sceneId: scene.id,
        startTime,
        endTime,
        tagId,
      }));
    },
    [scene, availableTags, dispatch]
  );

  // Handle create marker
  const handleCreateMarker = useCallback(() => {
    const startTime = currentVideoTime;
    const endTime = currentVideoTime + 20; // Standard 20-second duration
    createOrDuplicateMarker(startTime, endTime);
  }, [createOrDuplicateMarker, currentVideoTime]);

  // Handle delete rejected markers
  const handleDeleteRejectedMarkers = useCallback(async () => {
    const rejected = actionMarkers.filter(isMarkerRejected);
    dispatch(openDeleteRejectedModal({ rejectedMarkers: rejected }));
  }, [actionMarkers, dispatch]);

  // Copy marker times function
  const copyMarkerTimes = useCallback(() => {
    if (!selectedMarkerId) return;
    const currentMarker = actionMarkers.find((m) => m.id === selectedMarkerId);
    if (!currentMarker) return;

    const copiedTimes = {
      start: currentMarker.seconds,
      end: currentMarker.end_seconds,
    };

    dispatch(setCopiedMarkerTimes(copiedTimes));

    // Show toast notification
    const endTimeStr = copiedTimes.end
      ? formatSeconds(copiedTimes.end, true)
      : "N/A";

    showToast(
      `Copied times: ${formatSeconds(copiedTimes.start, true)} - ${endTimeStr}`,
      "success"
    );
  }, [actionMarkers, selectedMarkerId, dispatch, showToast]);

  // Paste marker times function
  const pasteMarkerTimes = useCallback(async () => {
    if (!copiedMarkerTimes) {
      showToast("No marker times copied yet", "error");
      return;
    }

    const currentMarker = actionMarkers.find((m) => m.id === selectedMarkerId);
    if (!currentMarker || !scene) return;

    try {
      await dispatch(updateMarkerTimes({
        sceneId: scene.id,
        markerId: currentMarker.id,
        startTime: copiedMarkerTimes.start,
        endTime: copiedMarkerTimes.end ?? null
      })).unwrap();

      // Show toast notification
      const endTimeStr = copiedMarkerTimes.end
        ? formatSeconds(copiedMarkerTimes.end, true)
        : "N/A";

      showToast(
        `Pasted times: ${formatSeconds(
          copiedMarkerTimes.start,
          true
        )} - ${endTimeStr}`,
        "success"
      );
    } catch (err) {
      console.error("Error pasting marker times:", err);
      showToast("Failed to paste marker times", "error");
    }
  }, [copiedMarkerTimes, actionMarkers, selectedMarkerId, showToast, dispatch, scene]);

  // Confirm delete rejected markers
  const confirmDeleteRejectedMarkers = useCallback(async () => {
    try {
      const rejectedMarkers = deleteRejectedModalData?.rejectedMarkers || [];
      await stashappService.deleteMarkers(
        rejectedMarkers.map((m) => m.id)
      );
      if (scene?.id) await dispatch(loadMarkers(scene.id)).unwrap();
      dispatch(closeModal());
    } catch (err) {
      console.error("Error deleting rejected markers:", err);
      dispatch(setError("Failed to delete rejected markers"));
    }
  }, [deleteRejectedModalData, dispatch, scene?.id]);

  // Handle corresponding tag conversion
  const handleCorrespondingTagConversion = useCallback(async () => {
    try {
      const markers = await stashappService.convertConfirmedMarkersWithCorrespondingTags(
        actionMarkers
      );
      dispatch(openCorrespondingTagConversionModal({ markers }));
    } catch (err) {
      console.error("Error preparing corresponding tag conversion:", err);
      dispatch(setError("Failed to prepare markers for conversion"));
    }
  }, [actionMarkers, dispatch]);

  // Handle confirm corresponding tag conversion
  const handleConfirmCorrespondingTagConversion = useCallback(async () => {
    try {
      const markers = correspondingTagConversionModalData?.markers || [];
      for (const { sourceMarker, correspondingTag } of markers) {
        await stashappService.updateMarkerTagAndTitle(
          sourceMarker.id,
          correspondingTag.id
        );
      }
      if (scene?.id) await dispatch(loadMarkers(scene.id)).unwrap();
    } catch (err) {
      console.error("Error converting markers:", err);
      throw err; // Let the modal handle the error display
    }
  }, [correspondingTagConversionModalData, dispatch, scene?.id]);

  // Check if all markers are approved (confirmed or rejected)
  const checkAllMarkersApproved = useCallback(() => {
    if (actionMarkers.length === 0) return true;
    return filterUnprocessedMarkers(actionMarkers).length === 0;
  }, [actionMarkers]);

  // Helper function to identify AI tags that should be removed from the scene
  const identifyAITagsToRemove = useCallback(
    async (confirmedMarkers: SceneMarker[]): Promise<Tag[]> => {
      try {
        const [currentSceneTags, allTags] = await Promise.all([
          stashappService.getSceneTags(confirmedMarkers[0].scene.id),
          stashappService.getAllTags(),
        ]);

        const aiParentTag = allTags.findTags.tags.find((tag) => tag.name === "AI");
        if (!aiParentTag) return [];

        const aiChildTags = aiParentTag.children || [];
        return currentSceneTags.filter((sceneTag) =>
          aiChildTags.some((aiChild) => aiChild.id === sceneTag.id)
        );
      } catch (error) {
        console.error("Error identifying AI tags to remove:", error);
        return [];
      }
    },
    []
  );

  // Execute the scene tag update (page 2 of the completion flow).
  // Receives pre-computed tag lists from the caller — does NOT re-read actionMarkers.
  const executeSceneTagUpdate = useCallback(async (
    primaryTagsToAdd: Tag[],
    tagsToRemove: Tag[],
    selectedActions: CompletionDefaults
  ) => {
    if (!scene) return;

    try {
      if (selectedActions.addPrimaryTags || selectedActions.removeCorrespondingTags) {
        const tagsToAdd: Tag[] = selectedActions.addPrimaryTags ? primaryTagsToAdd : [];
        const tagsToActuallyRemove: Tag[] = selectedActions.removeCorrespondingTags ? tagsToRemove : [];

        if (tagsToAdd.length > 0 || tagsToActuallyRemove.length > 0) {
          await stashappService.updateScene(scene, tagsToAdd, tagsToActuallyRemove);
        }
      }

      // Refresh markers after generation completes (cancelled on unmount via ref)
      refreshTimeoutRef.current = setTimeout(() => {
        if (scene?.id) dispatch(loadMarkers(scene.id));
      }, 2000);

      dispatch(clearError());
    } catch (err) {
      console.error("Error updating scene tags:", err);
      dispatch(setError("Failed to update scene tags"));
    }
  }, [scene, dispatch]);

  return {
    getMarkerSummary,
    checkAllMarkersApproved,
    
    // Marker operations
    splitCurrentMarker,
    splitVideoCutMarker,
    createOrDuplicateMarker,
    handleCreateMarker,
    
    // Copy/paste operations
    copyMarkerTimes,
    pasteMarkerTimes,
    
    // Delete operations
    handleDeleteRejectedMarkers,
    confirmDeleteRejectedMarkers,
    
    // AI operations
    handleCorrespondingTagConversion,
    handleConfirmCorrespondingTagConversion,
    
    // Completion operations
    identifyAITagsToRemove,
    executeSceneTagUpdate,
  };
};