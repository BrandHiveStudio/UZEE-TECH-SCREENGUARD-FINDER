"use client";

import { useState } from "react";
import {
  X,
  Trash2,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

interface BulkDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function BulkDeleteModal({
  isOpen,
  onClose,
  onSuccess,
}: BulkDeleteModalProps) {
  const [fromBox, setFromBox] = useState<string>("");
  const [toBox, setToBox] = useState<string>("");
  const [confirmText, setConfirmText] = useState<string>("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletedCount, setDeletedCount] = useState<number | null>(null);

  if (!isOpen) return null;

  const handleReset = () => {
    setFromBox("");
    setToBox("");
    setConfirmText("");
    setError(null);
    setDeletedCount(null);
    setIsDeleting(false);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const isConfirmed = confirmText.trim() === "DELETE";
  const isValidRange =
    fromBox.trim() !== "" &&
    toBox.trim() !== "" &&
    !isNaN(Number(fromBox)) &&
    !isNaN(Number(toBox)) &&
    Number(fromBox) > 0 &&
    Number(toBox) > 0;

  const canSubmit = isConfirmed && isValidRange && !isDeleting;

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setIsDeleting(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/boxes/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromBox: Number(fromBox),
          toBox: Number(toBox),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to delete boxes.");
      }

      setDeletedCount(data.deletedCount ?? 0);
      onSuccess();
    } catch (err) {
      console.error("Bulk delete failed:", err);
      setError(err instanceof Error ? err.message : "Failed to delete boxes.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-5 animate-scale-up">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Bulk Delete Boxes
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Permanently remove a range of boxes
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {deletedCount !== null ? (
          /* Success Result View */
          <div className="text-center py-5 space-y-4 animate-fade-in">
            <div className="inline-flex p-3 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Deletion Complete
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                {deletedCount > 0 ? (
                  <>
                    Successfully removed{" "}
                    <strong className="text-rose-600 dark:text-rose-400 font-bold">
                      {deletedCount}
                    </strong>{" "}
                    {deletedCount === 1 ? "box" : "boxes"} (from #{Math.min(Number(fromBox), Number(toBox))} to #{Math.max(Number(fromBox), Number(toBox))}) and all associated records.
                  </>
                ) : (
                  <>No boxes were found matching the specified range.</>
                )}
              </p>
            </div>

            <button
              onClick={handleClose}
              className="w-full py-2.5 px-4 rounded-xl font-bold text-sm text-white bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 transition-all shadow-sm"
            >
              Done &amp; Refresh Data
            </button>
          </div>
        ) : (
          /* Delete Form View */
          <form onSubmit={handleDelete} className="space-y-4">
            {/* Warning Alert */}
            <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-800 dark:text-rose-300 text-xs">
              <AlertTriangle className="w-5 h-5 flex-shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
              <div>
                <p className="font-bold text-rose-900 dark:text-rose-200 mb-0.5">
                  Permanent Data Deletion Warning
                </p>
                <p className="leading-relaxed">
                  This will permanently remove all boxes, stock counts, and compatible models within this range.
                </p>
              </div>
            </div>

            {/* Range Inputs */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  From Box #
                </label>
                <input
                  type="number"
                  min="1"
                  placeholder="e.g. 134"
                  value={fromBox}
                  onChange={(e) => setFromBox(e.target.value)}
                  required
                  disabled={isDeleting}
                  className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  To Box #
                </label>
                <input
                  type="number"
                  min="1"
                  placeholder="e.g. 181"
                  value={toBox}
                  onChange={(e) => setToBox(e.target.value)}
                  required
                  disabled={isDeleting}
                  className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all"
                />
              </div>
            </div>

            {/* DELETE Confirmation Input */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Type <span className="font-mono font-bold text-rose-600 dark:text-rose-400">DELETE</span> to confirm:
              </label>
              <input
                type="text"
                placeholder="Type DELETE"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                disabled={isDeleting}
                className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white placeholder-slate-400 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all"
              />
            </div>

            {/* Error Message */}
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400 text-xs">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={handleClose}
                disabled={isDeleting}
                className="px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 font-bold text-xs sm:text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!canSubmit}
                className="px-5 py-2.5 rounded-2xl font-bold text-xs sm:text-sm text-white bg-rose-600 hover:bg-rose-700 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 transition-all shadow-md shadow-rose-600/20 flex items-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Delete Range</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
