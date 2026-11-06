"use client";

import { useState } from "react";
import {
  X,
  AlertTriangle,
  Database,
  CheckCircle2,
  RefreshCw,
  FolderArchive,
  Layers,
  ShieldAlert,
  ArrowRight,
} from "lucide-react";

interface DatabaseMigrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => Promise<void> | void;
}

export function DatabaseMigrationModal({
  isOpen,
  onClose,
  onSuccess,
}: DatabaseMigrationModalProps) {
  const [confirmationInput, setConfirmationInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    backupFile: string;
    seededRecordsCount: number;
    archivedFilesCount: number;
  } | null>(null);

  const REQUIRED_PHRASE = "RESET AND MIGRATE 2026";
  const isMatch = confirmationInput.trim() === REQUIRED_PHRASE;

  const handleResetState = () => {
    setConfirmationInput("");
    setLoading(false);
    setError(null);
    setResult(null);
  };

  const handleExecuteMigration = async () => {
    if (!isMatch) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/database-migration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmationPhrase: confirmationInput.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Database migration failed.");
      }

      setResult({
        backupFile: data.backupFile,
        seededRecordsCount: data.seededRecordsCount,
        archivedFilesCount: data.archivedFilesCount,
      });

      if (onSuccess) {
        await onSuccess();
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An unexpected error occurred during migration.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-scale-in">
        {/* Header (High-alert Red Banner) */}
        <div className="px-5 py-4 bg-gradient-to-r from-rose-600 via-red-600 to-rose-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center font-bold shadow-inner">
              <ShieldAlert className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-black text-base tracking-tight leading-tight flex items-center gap-2">
                Database Reset &amp; Migration Hub
                <span className="text-[10px] font-bold uppercase tracking-wider bg-black/20 px-2 py-0.5 rounded-full">
                  Danger Zone
                </span>
              </h3>
              <p className="text-xs text-rose-100 font-medium">
                Consolidate 148 Clean Boxes with automatic backup
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              handleResetState();
              onClose();
            }}
            className="p-1.5 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {!result ? (
            <>
              {/* Warning Alert Banner */}
              <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 space-y-2 text-rose-900 dark:text-rose-200 text-xs">
                <div className="flex items-center gap-2 font-black text-sm text-rose-700 dark:text-rose-300">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>Permanent Database Re-seeding Action</span>
                </div>
                <p className="leading-relaxed">
                  This procedure will execute the following steps in a single atomic operation:
                </p>
                <ul className="list-disc list-inside space-y-1 font-medium pl-1 text-[11px] text-rose-800 dark:text-rose-300">
                  <li>
                    <strong>Snapshot:</strong> Creates a complete timestamped JSON backup in{" "}
                    <code className="px-1 py-0.5 rounded bg-rose-200/60 dark:bg-rose-900/60 font-mono">
                      data/backups/
                    </code>
                    .
                  </li>
                  <li>
                    <strong>Seed Clean Master:</strong> Inserts the 148 verified consolidated boxes
                    with 0 stock and initialized variants.
                  </li>
                  <li>
                    <strong>Clean Root Clutter:</strong> Safely moves loose Excel exports and test
                    JSONs into{" "}
                    <code className="px-1 py-0.5 rounded bg-rose-200/60 dark:bg-rose-900/60 font-mono">
                      archive/legacy_seeds_and_excels/
                    </code>
                    .
                  </li>
                </ul>
              </div>

              {/* Handshake Prompt */}
              <div className="space-y-2 pt-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span>To confirm, type the phrase below:</span>
                  <span className="font-mono text-[11px] text-rose-600 dark:text-rose-400 select-all font-bold">
                    {REQUIRED_PHRASE}
                  </span>
                </label>
                <input
                  type="text"
                  placeholder="Type RESET AND MIGRATE 2026 to unlock"
                  value={confirmationInput}
                  onChange={(e) => setConfirmationInput(e.target.value)}
                  disabled={loading}
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500/40 uppercase"
                />
              </div>

              {error && (
                <div className="p-3 rounded-xl bg-rose-100 dark:bg-rose-900/50 border border-rose-300 text-rose-700 dark:text-rose-200 text-xs font-bold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </>
          ) : (
            /* Results View */
            <div className="space-y-4 py-2 animate-scale-in">
              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-900 dark:text-emerald-200 space-y-3">
                <div className="flex items-center gap-2 font-black text-base text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>Migration Successfully Completed!</span>
                </div>

                <div className="space-y-2 text-xs font-medium divide-y divide-emerald-200/60 dark:divide-emerald-800/40">
                  <div className="pt-1 flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                      <Database className="w-4 h-4 text-emerald-600" /> Pre-migration Snapshot:
                    </span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">
                      {result.backupFile}
                    </span>
                  </div>

                  <div className="pt-2 flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                      <Layers className="w-4 h-4 text-emerald-600" /> Master Boxes Seeded:
                    </span>
                    <span className="font-bold text-slate-900 dark:text-white">
                      {result.seededRecordsCount} Clean Boxes (BOX 001–148)
                    </span>
                  </div>

                  <div className="pt-2 flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                      <FolderArchive className="w-4 h-4 text-emerald-600" /> Legacy Files Archived:
                    </span>
                    <span className="font-bold text-slate-900 dark:text-white">
                      {result.archivedFilesCount} files moved to /archive
                    </span>
                  </div>
                </div>
              </div>

              <p className="text-xs text-slate-500 text-center font-medium">
                Your database is now operating on the official 148-box dataset with initialized variant counts.
              </p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
          {!result ? (
            <>
              <button
                type="button"
                onClick={() => {
                  handleResetState();
                  onClose();
                }}
                disabled={loading}
                className="px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 text-xs font-bold transition-colors"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleExecuteMigration}
                disabled={!isMatch || loading}
                className="px-5 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white font-black text-xs shadow-lg shadow-rose-600/20 active:scale-95 transition-all flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Executing Migration...</span>
                  </>
                ) : (
                  <>
                    <Database className="w-4 h-4" />
                    <span>Confirm Snapshot &amp; Overwrite</span>
                  </>
                )}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => {
                handleResetState();
                onClose();
              }}
              className="px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-lg shadow-emerald-600/20 transition-all flex items-center gap-2"
            >
              <span>Done &amp; Close</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

