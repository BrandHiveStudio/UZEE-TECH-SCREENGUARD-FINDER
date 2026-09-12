"use client";

import { useState, useRef } from "react";
import {
  X,
  UploadCloud,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Trash2,
} from "lucide-react";

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function BulkImportModal({ isOpen, onClose, onSuccess }: BulkImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [result, setResult] = useState<{ boxesAdded: number; modelsAdded: number } | null>(
    null
  );

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleReset = () => {
    setFile(null);
    setError(null);
    setValidationErrors([]);
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    setError(null);
    setValidationErrors([]);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (!droppedFile.name.toLowerCase().endsWith(".csv")) {
        setError("Please upload a valid .csv file.");
        return;
      }
      setFile(droppedFile);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setValidationErrors([]);
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (!selectedFile.name.toLowerCase().endsWith(".csv")) {
        setError("Please select a valid .csv file.");
        return;
      }
      setFile(selectedFile);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError("Please select a CSV file first.");
      return;
    }

    setIsUploading(true);
    setError(null);
    setValidationErrors([]);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/admin/boxes/bulk-import", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to import CSV.");
        if (Array.isArray(data.validationErrors)) {
          setValidationErrors(data.validationErrors);
        }
        return;
      }

      setResult({
        boxesAdded: data.boxesAdded || 0,
        modelsAdded: data.modelsAdded || 0,
      });

      if (Array.isArray(data.validationErrors) && data.validationErrors.length > 0) {
        setValidationErrors(data.validationErrors);
      }

      onSuccess();
    } catch {
      setError("Network error occurred while uploading. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownloadTemplate = () => {
    const link = document.createElement("a");
    link.href = "/api/admin/boxes/template";
    link.download = "screenguards_import_template.csv";
    link.click();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl shadow-2xl p-6 sm:p-7 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-brand-50 dark:bg-brand-950/80 text-brand-700 dark:text-brand-400">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Bulk CSV Box Import
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Batch import boxes, inventory stock, and compatible models
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

        {/* Success State */}
        {result ? (
          <div className="text-center py-6 space-y-4 animate-fade-in">
            <div className="inline-flex p-3 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                Import Successful!
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                Successfully added <strong className="text-emerald-600 dark:text-emerald-400 font-black">{result.boxesAdded}</strong> new boxes and{" "}
                <strong className="text-emerald-600 dark:text-emerald-400 font-black">{result.modelsAdded}</strong> compatible models.
              </p>
            </div>

            {validationErrors.length > 0 && (
              <div className="text-left p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-400 max-h-32 overflow-y-auto space-y-1">
                <p className="font-bold">Skipped rows with warnings:</p>
                {validationErrors.map((err, idx) => (
                  <p key={idx}>• {err}</p>
                ))}
              </div>
            )}

            <button
              onClick={handleClose}
              className="w-full py-3 px-4 rounded-xl font-bold text-sm text-white bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 transition-all shadow-sm"
            >
              Done &amp; Refresh Data
            </button>
          </div>
        ) : (
          <>
            {/* Template Download Prompt */}
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 gap-3">
              <div className="text-xs text-slate-600 dark:text-slate-300">
                <span className="font-bold text-slate-900 dark:text-white block">
                  Need the template file?
                </span>
                Pre-filled with sequential box numbers.
              </div>
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 font-bold text-xs border border-slate-200 dark:border-slate-600 transition-all flex items-center gap-1.5 shrink-0 shadow-sm"
              >
                <Download className="w-3.5 h-3.5 text-brand-700 dark:text-brand-400" />
                <span>Get Template</span>
              </button>
            </div>

            {/* Drag & Drop Zone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleFileDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`p-6 border-2 border-dashed rounded-3xl text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 ${
                isDragging
                  ? "border-brand-500 bg-brand-50/50 dark:bg-brand-950/20"
                  : "border-slate-200 dark:border-slate-800 hover:border-brand-400 dark:hover:border-brand-600 bg-white dark:bg-slate-900/60"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="hidden"
              />

              <div className="p-3 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                <UploadCloud className="w-6 h-6" />
              </div>

              <div>
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Click to browse or drag and drop your CSV file here
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Accepts standard UTF-8 .csv files with Box Number, Stock, and Models
                </p>
              </div>
            </div>

            {/* Selected File Card */}
            {file && (
              <div className="flex items-center justify-between p-3 rounded-2xl bg-brand-50 dark:bg-brand-950/40 border border-brand-200 dark:border-brand-800/60 animate-fade-in">
                <div className="flex items-center gap-2.5 overflow-hidden">
                  <FileSpreadsheet className="w-4 h-4 text-brand-700 dark:text-brand-400 shrink-0" />
                  <div className="truncate text-xs">
                    <span className="font-bold text-slate-900 dark:text-white truncate block">
                      {file.name}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {(file.size / 1024).toFixed(1)} KB
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-white dark:hover:bg-slate-800 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Error Notification */}
            {error && (
              <div className="p-3.5 rounded-2xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-xs font-medium space-y-1.5 animate-fade-in">
                <div className="flex items-center gap-2 font-bold">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
                {validationErrors.length > 0 && (
                  <div className="max-h-28 overflow-y-auto pl-6 text-[11px] space-y-0.5">
                    {validationErrors.map((err, idx) => (
                      <p key={idx}>• {err}</p>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleClose}
                disabled={isUploading}
                className="flex-1 py-2.5 px-4 rounded-xl font-bold text-xs text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUpload}
                disabled={!file || isUploading}
                className="flex-1 py-2.5 px-4 rounded-xl font-bold text-xs text-white bg-brand-700 hover:bg-brand-800 shadow-md disabled:opacity-50 transition-all flex items-center justify-center gap-2 active:scale-95"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Importing...</span>
                  </>
                ) : (
                  <>
                    <UploadCloud className="w-3.5 h-3.5" />
                    <span>Upload &amp; Import</span>
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
