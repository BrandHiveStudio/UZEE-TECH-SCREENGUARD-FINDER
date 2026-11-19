"use client";

import { useState, useEffect } from "react";
import { X, Check, ArrowRight, ArrowLeft, Package, Save } from "lucide-react";
import type { Box } from "@/types/screenguard";

interface StockCountModeModalProps {
  isOpen: boolean;
  onClose: () => void;
  boxes: Box[];
  onComplete: () => void;
}

export function StockCountModeModal({
  isOpen,
  onClose,
  boxes,
  onComplete,
}: StockCountModeModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [countsMap, setCountsMap] = useState<Record<string, number>>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [isOpen, onClose]);

  if (!isOpen || boxes.length === 0) return null;

  const currentBox = boxes[currentIndex];
  const totalBoxes = boxes.length;
  const currentCount = countsMap[currentBox.id] ?? (currentBox.stockCountVerified ? currentBox.stockQuantity ?? 0 : "");

  const handleNext = () => {
    if (currentIndex < totalBoxes - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleCountChange = (val: string) => {
    const parsed = parseInt(val, 10);
    setCountsMap((prev) => ({
      ...prev,
      [currentBox.id]: isNaN(parsed) ? 0 : Math.max(0, parsed),
    }));
  };

  const handleSaveAll = async () => {
    setIsSaving(true);
    const payload = Object.entries(countsMap).map(([groupId, quantity]) => ({
      groupId,
      quantity,
    }));

    if (payload.length === 0) {
      alert("No stock counts were modified.");
      setIsSaving(false);
      onClose();
      return;
    }

    try {
      const res = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_bulk_counts",
          counts: payload,
        }),
      });

      if (res.ok) {
        alert(`Successfully verified and saved physical stock counts for ${payload.length} boxes!`);
        onComplete();
        onClose();
      } else {
        alert("Failed to save stock counts. Please try again.");
      }
    } catch (e) {
      console.error("Save bulk counts failed", e);
      alert("Error saving stock counts.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md animate-fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-lg flex flex-col border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-scale-in">
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-brand-700 text-white">
          <div className="flex items-center gap-2.5">
            <Package className="w-5 h-5" />
            <div>
              <h3 className="text-base font-black tracking-wide uppercase">
                Stock Count Mode
              </h3>
              <p className="text-[11px] text-white/80 font-medium">
                Physical Inventory Walkthrough ({currentIndex + 1} / {totalBoxes})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <kbd className="hidden sm:inline-flex items-center gap-1 text-[10px] font-mono font-bold text-white/80 bg-white/10 border border-white/20 px-2 py-0.5 rounded-lg shadow-2xs">
              ESC ✕
            </kbd>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition-colors"
              title="Close (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Walkthrough Content Card */}
        <div className="p-6 space-y-6 flex-1 overflow-y-auto">
          {/* Progress Bar */}
          <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
            <div
              className="bg-brand-700 h-full transition-all duration-300"
              style={{ width: `${((currentIndex + 1) / totalBoxes) * 100}%` }}
            />
          </div>

          {/* Current Box Header */}
          <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-2 text-center">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-2xl bg-brand-700 text-white font-black text-xl shadow-md">
              {currentBox.boxNumber}
            </div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Display Size: <span className="font-bold text-slate-900 dark:text-white">{currentBox.displaySize || "Unknown"}</span>
            </p>
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
              {currentBox.title}
            </h4>
          </div>

          {/* Quantity Entry Field */}
          <div className="space-y-2 text-center">
            <label className="text-xs font-black uppercase tracking-wider text-slate-400 block">
              Physical Stock Count
            </label>
            <input
              type="number"
              min="0"
              value={currentCount}
              onChange={(e) => handleCountChange(e.target.value)}
              placeholder="Enter physical stock quantity"
              className="w-full max-w-xs text-center mx-auto px-4 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 border-2 border-brand-700 text-slate-900 dark:text-white font-bold text-lg sm:text-xl focus:outline-none focus:ring-4 focus:ring-brand-700/20"
              autoFocus
            />
            <p className="text-[11px] text-slate-400">
              Current state: <span className="font-bold">{currentBox.stockCountVerified ? `${currentBox.stockQuantity} (Verified)` : "Not Counted"}</span>
            </p>
          </div>

          {/* Quick Increment Buttons */}
          <div className="flex justify-center gap-2">
            {[0, 1, 3, 5, 10, 20].map((num) => (
              <button
                key={num}
                onClick={() => setCountsMap((prev) => ({ ...prev, [currentBox.id]: num }))}
                className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-brand-50 dark:hover:bg-brand-950 text-slate-800 dark:text-slate-200 font-bold text-xs border border-slate-200 dark:border-slate-700"
              >
                ={num}
              </button>
            ))}
          </div>
        </div>

        {/* Navigation & Action Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrev}
              disabled={currentIndex === 0}
              className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 disabled:opacity-40"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>

            <button
              onClick={handleNext}
              disabled={currentIndex === totalBoxes - 1}
              className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 disabled:opacity-40"
            >
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleNext}
              className="px-4 py-2.5 rounded-xl bg-slate-200 dark:bg-slate-800 font-bold text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-300"
            >
              Skip
            </button>

            <button
              onClick={handleSaveAll}
              disabled={isSaving || Object.keys(countsMap).length === 0}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              <Save className="w-4 h-4" /> Save ({Object.keys(countsMap).length})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
