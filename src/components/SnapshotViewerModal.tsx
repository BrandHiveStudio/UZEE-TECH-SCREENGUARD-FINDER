"use client";

import { useState, useEffect } from "react";
import {
  X,
  FolderArchive,
  Download,
  Eye,
  RefreshCw,
  Calendar,
  Layers,
  Database,
  FileCode,
  HardDrive,
} from "lucide-react";

export interface SnapshotMeta {
  fileName: string;
  sizeBytes: number;
  createdAt: string;
  totalBoxes: number;
}

interface SnapshotViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SnapshotViewerModal({ isOpen, onClose }: SnapshotViewerModalProps) {
  const [snapshots, setSnapshots] = useState<SnapshotMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [previewContent, setPreviewContent] = useState<{
    fileName: string;
    data: any;
  } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const fetchSnapshots = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/database-migration");
      if (res.ok) {
        const json = await res.json();
        setSnapshots(Array.isArray(json.snapshots) ? json.snapshots : []);
      }
    } catch (e) {
      console.error("Failed to fetch snapshots", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchSnapshots();
      setPreviewContent(null);
    }
  }, [isOpen]);

  const handleDownload = async (fileName: string) => {
    try {
      const res = await fetch(`/api/admin/database-migration?file=${encodeURIComponent(fileName)}`);
      if (!res.ok) throw new Error("Failed to load snapshot file");
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Download failed", e);
      alert("Failed to download snapshot file.");
    }
  };

  const handlePreview = async (fileName: string) => {
    if (previewContent?.fileName === fileName) {
      setPreviewContent(null);
      return;
    }
    setPreviewLoading(true);
    try {
      const res = await fetch(`/api/admin/database-migration?file=${encodeURIComponent(fileName)}`);
      if (!res.ok) throw new Error("Failed to load snapshot file");
      const data = await res.json();
      setPreviewContent({ fileName, data });
    } catch (e) {
      console.error("Preview failed", e);
      alert("Failed to preview snapshot.");
    } finally {
      setPreviewLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-scale-in">
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold">
              <FolderArchive className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-base tracking-tight leading-tight flex items-center gap-2">
                Database Backup Snapshot Browser
                <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">
                  data/backups/
                </span>
              </h3>
              <p className="text-xs text-slate-400 font-medium">
                Review and download historical database state snapshots
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 overflow-y-auto flex-1 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <HardDrive className="w-4 h-4 text-blue-500" />
              Available Snapshots ({snapshots.length})
            </span>
            <button
              onClick={fetchSnapshots}
              disabled={loading}
              className="text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-blue-500 flex items-center gap-1 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
            </button>
          </div>

          {loading ? (
            <div className="py-12 text-center text-slate-400 space-y-2">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-500" />
              <p className="text-xs font-semibold">Reading backup snapshots...</p>
            </div>
          ) : snapshots.length === 0 ? (
            <div className="py-12 text-center text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl space-y-2">
              <FolderArchive className="w-8 h-8 mx-auto opacity-40 text-slate-500" />
              <p className="text-xs font-bold">No snapshots found in data/backups/</p>
              <p className="text-[11px] max-w-xs mx-auto">
                Snapshots are automatically created prior to any migration or database reset.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {snapshots.map((snap) => (
                <div
                  key={snap.fileName}
                  className="rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/80 p-3 space-y-2 transition-all hover:border-blue-400/60"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <FileCode className="w-4 h-4 text-blue-500 shrink-0" />
                        <span className="font-mono font-bold text-xs text-slate-900 dark:text-white">
                          {snap.fileName}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-1">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(snap.createdAt).toLocaleString()}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300">
                          <Layers className="w-3 h-3 text-amber-500" />
                          {snap.totalBoxes} Boxes
                        </span>
                        <span>•</span>
                        <span>{Math.round(snap.sizeBytes / 1024)} KB</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 self-end sm:self-center">
                      <button
                        type="button"
                        onClick={() => handlePreview(snap.fileName)}
                        className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 text-xs font-semibold flex items-center gap-1 transition-all"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>{previewContent?.fileName === snap.fileName ? "Hide" : "Inspect"}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDownload(snap.fileName)}
                        className="px-2.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1 shadow-sm transition-all"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download</span>
                      </button>
                    </div>
                  </div>

                  {/* Inline Preview */}
                  {previewContent?.fileName === snap.fileName && (
                    <div className="mt-2 p-3 rounded-xl bg-slate-900 text-slate-200 font-mono text-[11px] max-h-48 overflow-y-auto space-y-1.5 border border-slate-800">
                      <div className="text-amber-400 font-bold border-b border-slate-800 pb-1 flex justify-between">
                        <span>Snapshot Content Sample:</span>
                        <span>Total: {previewContent.data?.totalBoxes || 0}</span>
                      </div>
                      <div className="space-y-1 text-slate-300">
                        {(previewContent.data?.boxes || []).slice(0, 5).map((b: any, idx: number) => (
                          <div key={idx} className="flex gap-2">
                            <span className="text-emerald-400 font-bold">{b.boxNumber}:</span>
                            <span className="text-slate-200 font-medium">{b.title}</span>
                            <span className="text-slate-500 truncate">
                              ({(b.compatibleModels || []).slice(0, 3).join(", ")})
                            </span>
                          </div>
                        ))}
                        {(previewContent.data?.boxes || []).length > 5 && (
                          <p className="text-slate-500 pt-1 italic">
                            ...and {(previewContent.data?.boxes || []).length - 5} more records.
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

