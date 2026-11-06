"use client";

import React, { useEffect, useState, useRef } from "react";
import { RotateCcw, X, Info } from "lucide-react";

export interface UndoToastItem {
  id: string;
  message: string;
  onUndo: () => Promise<void> | void;
}

interface UndoToastProps {
  toast: UndoToastItem | null;
  onDismiss: () => void;
  durationMs?: number;
}

export function UndoToast({
  toast,
  onDismiss,
  durationMs = 5000,
}: UndoToastProps) {
  const [progress, setProgress] = useState(100);
  const [isUndoing, setIsUndoing] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!toast) {
      setProgress(100);
      return;
    }

    setIsUndoing(false);
    setProgress(100);
    startTimeRef.current = Date.now();

    // Smooth progress bar update
    const updateProgress = () => {
      const elapsed = Date.now() - startTimeRef.current;
      const remaining = Math.max(0, 100 - (elapsed / durationMs) * 100);
      setProgress(remaining);

      if (remaining > 0) {
        animFrameRef.current = requestAnimationFrame(updateProgress);
      }
    };

    animFrameRef.current = requestAnimationFrame(updateProgress);

    timerRef.current = setTimeout(() => {
      onDismiss();
    }, durationMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [toast, durationMs, onDismiss]);

  if (!toast) return null;

  const handleUndo = async () => {
    setIsUndoing(true);
    try {
      await toast.onUndo();
    } finally {
      setIsUndoing(false);
      onDismiss();
    }
  };

  return (
    <div className="fixed bottom-5 right-5 z-50 max-w-sm w-full animate-in slide-in-from-bottom-5 fade-in duration-200">
      <div className="relative overflow-hidden rounded-2xl bg-slate-900/95 dark:bg-slate-900/95 text-white shadow-2xl border border-slate-700 backdrop-blur-md p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-brand-500/20 text-brand-400 flex items-center justify-center shrink-0">
              <Info className="w-4 h-4" />
            </div>
            <p className="text-xs sm:text-sm font-semibold truncate text-slate-100">
              {toast.message}
            </p>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={handleUndo}
              disabled={isUndoing}
              className="px-3 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm active:scale-95 disabled:opacity-50"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${isUndoing ? "animate-spin" : ""}`} />
              <span>{isUndoing ? "Undoing…" : "Undo"}</span>
            </button>
            <button
              onClick={onDismiss}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Progress bar countdown */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-800">
          <div
            className="h-full bg-brand-500 transition-none"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}
