"use client";

import React from "react";

interface DeleteSceneModalProps {
  isOpen: boolean;
  sceneName: string;
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function DeleteSceneModal({
  isOpen,
  sceneName,
  isDeleting,
  onCancel,
  onConfirm,
}: DeleteSceneModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-gray-800 p-6 rounded-lg max-w-md w-full">
        <h3 className="text-xl font-bold mb-4 text-red-400">Delete Scene</h3>
        <p className="mb-2 text-white">
          This will permanently delete{" "}
          <span className="font-bold break-all">{sceneName}</span> and all its files from
          Stash.
        </p>
        <p className="mb-6 text-red-400 font-medium">This cannot be undone.</p>
        <div className="flex justify-end space-x-4">
          <button
            onClick={onCancel}
            disabled={isDeleting}
            className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isDeleting && (
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            {isDeleting ? "Deleting…" : "Delete Scene"}
          </button>
        </div>
      </div>
    </div>
  );
}
