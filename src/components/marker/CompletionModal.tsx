"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { SceneMarker, Tag, stashappService } from "../../services/StashappService";
import { CompletionDefaults } from "../../serverConfig";

type ModalPage = "page1" | "loading" | "page2";

interface CompletionModalProps {
  isOpen: boolean;
  completionWarnings: string[];
  videoCutMarkersToDelete: SceneMarker[];
  hasAiReviewedTag: boolean;
  rejectedMarkersCount: number;
  correspondingTagsCount: number;
  hasNextScene: boolean;
  page2Data: { primaryTagsToAdd: Tag[]; tagsToRemove: Tag[] } | null;
  onCancel: () => void;
  onPage1Confirm: (selectedActions: CompletionDefaults) => void;
  onPage2Confirm: (selectedActions: CompletionDefaults, primaryTagsToAdd: Tag[]) => void;
}

export function CompletionModal({
  isOpen,
  completionWarnings,
  videoCutMarkersToDelete,
  hasAiReviewedTag,
  rejectedMarkersCount,
  correspondingTagsCount,
  hasNextScene,
  page2Data,
  onCancel,
  onPage1Confirm,
  onPage2Confirm,
}: CompletionModalProps) {
  const [manualTagsToAdd, setManualTagsToAdd] = useState<Tag[]>([]);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [tagSearchInput, setTagSearchInput] = useState("");
  const [tagHighlightedIndex, setTagHighlightedIndex] = useState(-1);
  const tagSearchRef = useRef<HTMLInputElement>(null);
  const [selectedActions, setSelectedActions] = useState<CompletionDefaults>({
    deleteVideoCutMarkers: true,
    generateMarkers: true,
    addAiReviewedTag: true,
    addPrimaryTags: true,
    removeCorrespondingTags: true,
    deleteRejected: true,
    convertCorrespondingTags: true,
    switchToNextScene: true,
  });
  const [currentPage, setCurrentPage] = useState<ModalPage>("page1");

  useEffect(() => {
    if (isOpen) {
      setCurrentPage("page1");
      setManualTagsToAdd([]);
      setAllTags([]);
      setTagSearchInput("");
      loadDefaults();
    }
  }, [isOpen]);

  // Transition from loading to page 2 when page2Data arrives
  useEffect(() => {
    if (page2Data !== null && currentPage === "loading") {
      setCurrentPage("page2");
    }
  }, [page2Data, currentPage]);

  // Fetch all tags and focus the tag search input when page 2 becomes active
  useEffect(() => {
    if (currentPage !== "page2") return;
    stashappService.getAllTags().then(result => {
      setAllTags(result.findTags.tags);
    }).catch(err => {
      console.warn("Failed to load tags for search:", err);
    });
    // Small delay to let the page 2 DOM render before focusing
    setTimeout(() => tagSearchRef.current?.focus(), 50);
  }, [currentPage]);

  const loadDefaults = async () => {
    try {
      const response = await fetch("/api/config");
      if (response.ok) {
        const config = await response.json();
        if (config.completionDefaults) {
          setSelectedActions({
            deleteVideoCutMarkers: true,
            generateMarkers: true,
            addAiReviewedTag: true,
            addPrimaryTags: true,
            removeCorrespondingTags: true,
            deleteRejected: true,
            convertCorrespondingTags: true,
            switchToNextScene: true,
            ...config.completionDefaults,
          });
        }
      }
    } catch (error) {
      console.warn("Failed to load completion defaults:", error);
    }
  };

  const saveDefaults = async () => {
    try {
      const response = await fetch("/api/config");
      let config = {};
      if (response.ok) {
        config = await response.json();
      }

      await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...config, completionDefaults: selectedActions }),
      });
    } catch (error) {
      console.error("Failed to save completion defaults:", error);
    }
  };

  const handleActionToggle = (action: keyof CompletionDefaults) => {
    setSelectedActions((prev) => ({ ...prev, [action]: !prev[action] }));
  };

  const handlePage1Next = useCallback(() => {
    setCurrentPage("loading");
    onPage1Confirm(selectedActions);
  }, [selectedActions, onPage1Confirm]);

  // Handle Enter/Escape keyboard shortcuts for the modal
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if the user is typing in a text input/textarea
      // Note: checkboxes are HTMLInputElement too, but we DO want to intercept Enter on those
      if (
        (e.target instanceof HTMLInputElement && e.target.type !== "checkbox") ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        if (currentPage === "page1") {
          handlePage1Next();
        } else if (currentPage === "page2" && page2Data) {
          const effectivePrimaryTagsToAdd = [
            ...page2Data.primaryTagsToAdd,
            ...manualTagsToAdd.filter(t => !page2Data.primaryTagsToAdd.some(p => p.id === t.id)),
          ];
          onPage2Confirm(selectedActions, effectivePrimaryTagsToAdd);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onCancel();
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [isOpen, currentPage, page2Data, manualTagsToAdd, selectedActions, handlePage1Next, onPage2Confirm, onCancel]);

  const handleRemoveTagClick = (tag: Tag) => {
    const desc = tag.description ?? "";
    if (!desc.toLowerCase().includes("corresponding tag:")) return;
    const correspondingName = desc.split(/corresponding tag:/i)[1].trim();
    if (!correspondingName) return;

    const currentPrimaryTagsToAdd = page2Data?.primaryTagsToAdd ?? [];
    const effectiveList = [
      ...currentPrimaryTagsToAdd,
      ...manualTagsToAdd.filter(t => !currentPrimaryTagsToAdd.some(p => p.id === t.id)),
    ];
    if (effectiveList.some(t => t.name === correspondingName)) return;

    const resolved = allTags.find(t => t.name === correspondingName) ?? null;
    if (!resolved) return;

    setManualTagsToAdd(prev => [...prev, resolved]);
  };

  if (!isOpen) return null;

  // ── Loading page ────────────────────────────────────────────────────────────
  if (currentPage === "loading") {
    return (
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-gray-800 p-6 rounded-lg max-w-2xl w-full relative">
          <h3 className="text-xl font-bold mb-6">Complete Scene Processing</h3>
          <div className="flex flex-col items-center py-8 text-gray-300">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white mb-4" />
            <p>Processing marker operations…</p>
          </div>
          <div className="flex justify-end">
            <button
              onClick={onCancel}
              className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Page 2 ──────────────────────────────────────────────────────────────────
  if (currentPage === "page2" && page2Data) {
    const { primaryTagsToAdd, tagsToRemove } = page2Data;
    const effectivePrimaryTagsToAdd = [
      ...primaryTagsToAdd,
      ...manualTagsToAdd.filter(t => !primaryTagsToAdd.some(p => p.id === t.id)),
    ];
    const tagSuggestions: Tag[] =
      tagSearchInput.length < 2
        ? []
        : allTags.filter(t =>
            !t.name.endsWith("_AI") &&
            t.name.toLowerCase().includes(tagSearchInput.toLowerCase()) &&
            !effectivePrimaryTagsToAdd.some(p => p.id === t.id)
          ).slice(0, 10);
    return (
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-gray-800 p-6 rounded-lg max-w-2xl w-full relative">
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-xl font-bold">
              Complete Scene Processing — Step 2 of 2
            </h3>
            <button
              onClick={saveDefaults}
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-sm text-sm"
            >
              Save as Default
            </button>
          </div>

          <div className="mb-4">
            <p className="mb-3">Select scene tag actions to perform:</p>
            <div className="space-y-3">
              <div className="flex items-start space-x-3">
                <input
                  type="checkbox"
                  id="addPrimaryTags"
                  checked={selectedActions.addPrimaryTags}
                  onChange={() => handleActionToggle("addPrimaryTags")}
                  className="mt-1 w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                />
                <label htmlFor="addPrimaryTags" className="text-sm text-gray-300 flex-1">
                  <span className="font-medium">Add tags from confirmed markers to the scene</span>
                  {effectivePrimaryTagsToAdd.length > 0 ? (
                    <span className="text-green-300">
                      {" "}({effectivePrimaryTagsToAdd.length} new tag{effectivePrimaryTagsToAdd.length !== 1 ? "s" : ""})
                    </span>
                  ) : (
                    <span className="text-gray-400"> (all already present)</span>
                  )}
                </label>
              </div>

              <div className="flex items-start space-x-3">
                <input
                  type="checkbox"
                  id="removeCorrespondingTags"
                  checked={selectedActions.removeCorrespondingTags}
                  onChange={() => handleActionToggle("removeCorrespondingTags")}
                  className="mt-1 w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                />
                <label htmlFor="removeCorrespondingTags" className="text-sm text-gray-300 flex-1">
                  <span className="font-medium">Remove tags with corresponding tag metadata from the scene</span>
                  {tagsToRemove.length > 0 ? (
                    <span className="text-red-300">
                      {" "}({tagsToRemove.length} tag{tagsToRemove.length !== 1 ? "s" : ""})
                    </span>
                  ) : (
                    <span className="text-gray-500"> (none found)</span>
                  )}
                </label>
              </div>

              {hasNextScene && (
                <div className="flex items-start space-x-3">
                  <input
                    type="checkbox"
                    id="switchToNextScene"
                    checked={selectedActions.switchToNextScene ?? true}
                    onChange={() => handleActionToggle("switchToNextScene")}
                    className="mt-1 w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                  />
                  <label htmlFor="switchToNextScene" className="text-sm text-gray-300 flex-1">
                    <span className="font-medium">Switch to next scene after completing</span>
                  </label>
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 relative">
            <input
              ref={tagSearchRef}
              type="text"
              value={tagSearchInput}
              onChange={e => { setTagSearchInput(e.target.value); setTagHighlightedIndex(-1); }}
              onKeyDown={e => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setTagHighlightedIndex(prev => Math.min(prev + 1, tagSuggestions.length - 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setTagHighlightedIndex(prev => Math.max(prev - 1, -1));
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  e.stopPropagation();
                  const tag = tagHighlightedIndex >= 0
                    ? tagSuggestions[tagHighlightedIndex]
                    : tagSuggestions.length > 0 ? tagSuggestions[0] : null;
                  if (tag) {
                    setManualTagsToAdd(prev => [...prev, tag]);
                    setTagSearchInput("");
                    setTagHighlightedIndex(-1);
                  } else {
                    // No tag being selected — complete the scene
                    onPage2Confirm(selectedActions, effectivePrimaryTagsToAdd);
                  }
                } else if (e.key === "Escape") {
                  setTagSearchInput("");
                  setTagHighlightedIndex(-1);
                }
              }}
              placeholder="Search tags to add…"
              className="w-full px-3 py-2 bg-gray-700 text-gray-100 border border-gray-600 rounded-sm text-sm placeholder-gray-400 focus:outline-none focus:border-teal-500"
            />
            {tagSuggestions.length > 0 && (
              <ul className="absolute z-10 w-full mt-1 bg-gray-700 border border-gray-600 rounded-sm shadow-lg max-h-48 overflow-y-auto">
                {tagSuggestions.map((tag, index) => (
                  <li key={tag.id}>
                    <button
                      onClick={() => {
                        setManualTagsToAdd(prev => [...prev, tag]);
                        setTagSearchInput("");
                        setTagHighlightedIndex(-1);
                      }}
                      className={`w-full text-left px-3 py-2 text-sm text-gray-100 transition-colors font-mono ${index === tagHighlightedIndex ? "bg-blue-600" : "hover:bg-gray-600"}`}
                    >
                      {tag.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {effectivePrimaryTagsToAdd.length > 0 && (
            <div className="mt-4 p-3 bg-green-900/30 border border-green-600/50 rounded">
              <h4 className="font-semibold text-green-200 mb-2">
                ✅ New primary tags from the markers to be added to the scene:
              </h4>
              <div className="flex flex-wrap gap-2">
                {effectivePrimaryTagsToAdd.map((tag) => {
                  const isManual = manualTagsToAdd.some(m => m.id === tag.id);
                  return isManual ? (
                    <button
                      key={`add-${tag.id}`}
                      onClick={() => setManualTagsToAdd(prev => prev.filter(m => m.id !== tag.id))}
                      title="Click to remove"
                      className="px-2 py-1 bg-teal-800/50 text-teal-200 rounded-sm text-xs font-mono hover:bg-teal-700/70 transition-colors cursor-pointer flex items-center gap-1"
                    >
                      {tag.name}
                      <span className="text-teal-400 leading-none">×</span>
                    </button>
                  ) : (
                    <span
                      key={`add-${tag.id}`}
                      className="px-2 py-1 bg-green-800/50 text-green-200 rounded-sm text-xs font-mono"
                    >
                      {tag.name}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {effectivePrimaryTagsToAdd.length === 0 && (
            <div className="mt-4 p-3 bg-gray-900/30 border border-gray-600/50 rounded">
              <h4 className="font-semibold text-gray-300 mb-2">ℹ️ No new tags to add</h4>
              <p className="text-gray-400 text-sm">
                All primary tags from confirmed markers are already present on the scene.
              </p>
            </div>
          )}

          {tagsToRemove.length > 0 && (
            <div className="mt-4 p-3 bg-red-900/30 border border-red-600/50 rounded">
              <h4 className="font-semibold text-red-200 mb-2">🗑️ Tags to be removed from the scene:</h4>
              <div className="flex flex-wrap gap-2">
                {tagsToRemove.map((tag) => {
                  const hasCorresponding = (tag.description ?? "").toLowerCase().includes("corresponding tag:");
                  return (
                    <button
                      key={`remove-${tag.id}`}
                      onClick={() => handleRemoveTagClick(tag)}
                      title={hasCorresponding ? "Click to add corresponding tag to scene" : undefined}
                      className={`px-2 py-1 bg-red-800/50 text-red-200 rounded-sm text-xs font-mono transition-colors ${
                        hasCorresponding ? "hover:bg-red-700/70 cursor-pointer" : "cursor-default"
                      }`}
                    >
                      {tag.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex justify-between items-center mt-4">
            <div className="text-sm text-gray-400">
              Press{" "}
              <kbd className="px-1 py-0.5 bg-gray-700 rounded text-xs">Enter</kbd>{" "}
              to complete,{" "}
              <kbd className="px-1 py-0.5 bg-gray-700 rounded text-xs">Esc</kbd>{" "}
              to cancel
            </div>
            <div className="flex space-x-4">
              <button
                onClick={onCancel}
                className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => onPage2Confirm(selectedActions, effectivePrimaryTagsToAdd)}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-sm font-medium"
              >
                Complete
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Page 1 ──────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-gray-800 p-6 rounded-lg max-w-2xl w-full relative">
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-xl font-bold">
            Complete Scene Processing — Step 1 of 2
          </h3>
          <button
            onClick={saveDefaults}
            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-sm text-sm"
          >
            Save as Default
          </button>
        </div>

        {completionWarnings.length > 0 && (
          <div className="mb-4 p-3 bg-yellow-900 border border-yellow-600 rounded">
            <div className="flex items-center text-yellow-200 text-sm">
              <span className="mr-2">⚠️</span>
              <span>Warning! {completionWarnings[0]}. It is not recommended to complete the review.</span>
            </div>
          </div>
        )}

        <div className="mb-4">
          <p className="mb-3">Select marker operations to perform:</p>
          <div className="space-y-3">
            <div className="flex items-start space-x-3">
              <input
                type="checkbox"
                id="deleteRejected"
                checked={selectedActions.deleteRejected ?? true}
                onChange={() => handleActionToggle("deleteRejected")}
                className="mt-1 w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
              />
              <label htmlFor="deleteRejected" className="text-sm text-gray-300 flex-1">
                <span className="font-medium">Delete rejected markers</span>
                {rejectedMarkersCount > 0 ? (
                  <span className="text-red-300">
                    {" "}({rejectedMarkersCount} marker{rejectedMarkersCount !== 1 ? "s" : ""})
                  </span>
                ) : (
                  <span className="text-gray-500"> (none)</span>
                )}
              </label>
            </div>

            <div className="flex items-start space-x-3">
              <input
                type="checkbox"
                id="convertCorrespondingTags"
                checked={selectedActions.convertCorrespondingTags ?? true}
                onChange={() => handleActionToggle("convertCorrespondingTags")}
                className="mt-1 w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
              />
              <label htmlFor="convertCorrespondingTags" className="text-sm text-gray-300 flex-1">
                <span className="font-medium">Convert corresponding tags</span>
                {correspondingTagsCount > 0 ? (
                  <span className="text-teal-300">
                    {" "}({correspondingTagsCount} marker{correspondingTagsCount !== 1 ? "s" : ""})
                  </span>
                ) : (
                  <span className="text-gray-500"> (none)</span>
                )}
              </label>
            </div>

            <div className="flex items-start space-x-3">
              <input
                type="checkbox"
                id="deleteVideoCutMarkers"
                checked={selectedActions.deleteVideoCutMarkers}
                onChange={() => handleActionToggle("deleteVideoCutMarkers")}
                className="mt-1 w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
              />
              <label htmlFor="deleteVideoCutMarkers" className="text-sm text-gray-300 flex-1">
                <span className="font-medium">Delete Video Cut markers</span>
                {videoCutMarkersToDelete.length > 0 ? (
                  <span className="text-red-300">
                    {" "}({videoCutMarkersToDelete.length} marker{videoCutMarkersToDelete.length !== 1 ? "s" : ""})
                  </span>
                ) : (
                  <span className="text-gray-500"> (none found)</span>
                )}
              </label>
            </div>

            <div className="flex items-start space-x-3">
              <input
                type="checkbox"
                id="generateMarkers"
                checked={selectedActions.generateMarkers}
                onChange={() => handleActionToggle("generateMarkers")}
                className="mt-1 w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
              />
              <label htmlFor="generateMarkers" className="text-sm text-gray-300 flex-1">
                <span className="font-medium">Generate markers (screenshots and previews)</span>
              </label>
            </div>

            <div className="flex items-start space-x-3">
              <input
                type="checkbox"
                id="addAiReviewedTag"
                checked={selectedActions.addAiReviewedTag}
                onChange={() => handleActionToggle("addAiReviewedTag")}
                className="mt-1 w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
              />
              <label htmlFor="addAiReviewedTag" className="text-sm text-gray-300 flex-1">
                <span className="font-medium">Add &quot;AI_Reviewed&quot; tag to the scene</span>
                {hasAiReviewedTag ? (
                  <span className="text-gray-400"> (already present)</span>
                ) : (
                  <span className="text-green-300"> (will be added)</span>
                )}
              </label>
            </div>
          </div>

          <div className="mt-4 text-xs text-gray-400">
            Step 2 will show the scene tag changes after marker operations complete.
          </div>
        </div>

        <div className="flex justify-between items-center">
          <div className="text-sm text-gray-400">
            Press{" "}
            <kbd className="px-1 py-0.5 bg-gray-700 rounded text-xs">Enter</kbd>{" "}
            to proceed,{" "}
            <kbd className="px-1 py-0.5 bg-gray-700 rounded text-xs">Esc</kbd>{" "}
            to cancel
          </div>
          <div className="flex space-x-4">
            <button
              onClick={onCancel}
              className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-sm"
            >
              Cancel
            </button>
            <button
              onClick={handlePage1Next}
              className={`px-4 py-2 rounded-sm font-medium ${
                completionWarnings.length > 0
                  ? "bg-yellow-600 hover:bg-yellow-700 text-white"
                  : "bg-blue-600 hover:bg-blue-700 text-white"
              }`}
            >
              {completionWarnings.length > 0 ? "Proceed Anyway →" : "Next →"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
