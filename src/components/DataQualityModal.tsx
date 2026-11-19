"use client";

import { useState, useEffect } from "react";
import { X, ShieldAlert, CheckCircle, AlertTriangle, Info, Layers } from "lucide-react";
import type { Box } from "@/types/screenguard";

interface DataQualityModalProps {
  isOpen: boolean;
  onClose: () => void;
  boxes: Box[];
}

export function DataQualityModal({ isOpen, onClose, boxes }: DataQualityModalProps) {
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

  if (!isOpen) return null;

  // Run Data Quality Audit on current live boxes
  const duplicateGroupIds: string[] = [];
  const sameGroupDuplicates: { id: string; boxNumber: string; model: string }[] = [];
  const multiGroupModelsMap: Record<string, { id: string; boxNumber: string }[]> = {};
  const emptyModelGroups: { id: string; boxNumber: string }[] = [];
  const missingTitles: { id: string; boxNumber: string }[] = [];
  const missingDisplaySizes: { id: string; boxNumber: string }[] = [];
  const duplicateBoxNumbersMap: Record<string, string[]> = {};
  const suspiciousModels: { id: string; boxNumber: string; model: string; reason: string }[] = [];

  const seenGroupIds = new Set<string>();
  const seenBoxNumbers: Record<string, string[]> = {};

  const unverifiedStockGroups: { id: string; boxNumber: string }[] = [];
  const outOfStockGroups: { id: string; boxNumber: string }[] = [];
  const lowStockGroups: { id: string; boxNumber: string; qty: number }[] = [];
  const negativeStockGroups: { id: string; boxNumber: string; qty: number }[] = [];

  boxes.forEach((b) => {
    const qty = b.stockQuantity ?? 0;
    const verified = b.stockCountVerified ?? false;

    if (qty < 0) {
      negativeStockGroups.push({ id: b.id, boxNumber: b.boxNumber, qty });
    }

    if (!verified) {
      unverifiedStockGroups.push({ id: b.id, boxNumber: b.boxNumber });
    } else if (qty === 0) {
      outOfStockGroups.push({ id: b.id, boxNumber: b.boxNumber });
    } else if (qty <= 3) {
      lowStockGroups.push({ id: b.id, boxNumber: b.boxNumber, qty });
    }

    // 1. Duplicate Group ID
    if (seenGroupIds.has(b.id)) {
      duplicateGroupIds.push(b.id);
    } else {
      seenGroupIds.add(b.id);
    }

    // 2. Duplicate Box Numbers
    if (b.boxNumber) {
      seenBoxNumbers[b.boxNumber] = seenBoxNumbers[b.boxNumber] || [];
      seenBoxNumbers[b.boxNumber].push(b.id);
    }

    // 3. Missing Title
    if (!b.title || !b.title.trim()) {
      missingTitles.push({ id: b.id, boxNumber: b.boxNumber });
    }

    // 4. Missing Display Size
    if (!b.displaySize || b.displaySize === "Unknown" || !b.displaySize.trim()) {
      missingDisplaySizes.push({ id: b.id, boxNumber: b.boxNumber });
    }

    // 5. Empty Compatible Model List
    if (!b.compatibleModels || b.compatibleModels.length === 0) {
      emptyModelGroups.push({ id: b.id, boxNumber: b.boxNumber });
    }

    // Model level checks
    const seenModelsInBox = new Set<string>();
    b.compatibleModels.forEach((m) => {
      const mUpper = m.toUpperCase().trim();

      // Check same-group duplicates
      if (seenModelsInBox.has(mUpper)) {
        sameGroupDuplicates.push({ id: b.id, boxNumber: b.boxNumber, model: m });
      } else {
        seenModelsInBox.add(mUpper);
      }

      // Track multi-group models
      multiGroupModelsMap[mUpper] = multiGroupModelsMap[mUpper] || [];
      multiGroupModelsMap[mUpper].push({ id: b.id, boxNumber: b.boxNumber });

      // Check suspicious / truncated models
      if (m.endsWith(".") || m.endsWith("(") || m.length < 2) {
        suspiciousModels.push({
          id: b.id,
          boxNumber: b.boxNumber,
          model: m,
          reason: "Model name ends with punctuation or is unusually short",
        });
      }
    });
  });

  // Filter duplicate box numbers > 1
  Object.entries(seenBoxNumbers).forEach(([boxNum, groupIds]) => {
    if (groupIds.length > 1) {
      duplicateBoxNumbersMap[boxNum] = groupIds;
    }
  });

  // Filter multi-group models > 1
  const multiGroupModelsList = Object.entries(multiGroupModelsMap).filter(
    ([_, groupList]) => groupList.length > 1
  );

  const totalWarnings =
    duplicateGroupIds.length +
    sameGroupDuplicates.length +
    emptyModelGroups.length +
    missingTitles.length +
    missingDisplaySizes.length +
    Object.keys(duplicateBoxNumbersMap).length +
    suspiciousModels.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-3xl max-h-[90vh] flex flex-col border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-500 text-white font-bold">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Database Data Quality Audit
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Scanned {boxes.length} groups for anomalies, duplicates, and missing attributes
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Audit Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Status Overview Banner */}
          <div
            className={`p-4 rounded-2xl border flex items-center gap-3 ${
              totalWarnings === 0
                ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400"
                : "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300"
            }`}
          >
            {totalWarnings === 0 ? (
              <CheckCircle className="w-6 h-6 shrink-0 text-emerald-600" />
            ) : (
              <AlertTriangle className="w-6 h-6 shrink-0 text-amber-600" />
            )}
            <div>
              <h4 className="text-sm font-bold">
                {totalWarnings === 0
                  ? "Zero Critical Warnings Found"
                  : `${totalWarnings} Warnings Requiring Review`}
              </h4>
              <p className="text-xs opacity-90">
                {totalWarnings === 0
                  ? "Database meets all data quality integrity checks."
                  : "Review the flagged items below. Multi-group models represent valid cross-compatibility."}
              </p>
            </div>
          </div>

          {/* Audit Sections */}
          <div className="space-y-4">
            {/* 1. Duplicate Group IDs */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80">
              <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center justify-between">
                <span>Duplicate Group IDs</span>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                  {duplicateGroupIds.length}
                </span>
              </h5>
              {duplicateGroupIds.length === 0 ? (
                <p className="text-xs text-slate-500 mt-1">None found (Group IDs are 100% unique).</p>
              ) : (
                <ul className="text-xs text-red-600 font-medium mt-2 space-y-1">
                  {duplicateGroupIds.map((id, i) => (
                    <li key={i}>Duplicate ID: {id}</li>
                  ))}
                </ul>
              )}
            </div>

            {/* 2. Same-Group Duplicate Models */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80">
              <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center justify-between">
                <span>Same-Group Internal Duplicate Models</span>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                  {sameGroupDuplicates.length}
                </span>
              </h5>
              {sameGroupDuplicates.length === 0 ? (
                <p className="text-xs text-slate-500 mt-1">None found (Zero duplicate models inside same box).</p>
              ) : (
                <ul className="text-xs text-amber-600 font-medium mt-2 space-y-1">
                  {sameGroupDuplicates.map((item, i) => (
                    <li key={i}>
                      [{item.boxNumber} / {item.id}] Model &quot;{item.model}&quot; appears multiple times
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* 3. Multi-Group Models (Info) */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80">
              <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-blue-500" />
                  Multi-Group Models (Valid Cross-Brand Glass)
                </span>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                  {multiGroupModelsList.length}
                </span>
              </h5>
              <p className="text-[11px] text-slate-500 mt-1">
                Models legitimately matching &gt;1 Super-D compatibility group.
              </p>
              <div className="mt-2 max-h-36 overflow-y-auto space-y-1.5 pr-2">
                {multiGroupModelsList.map(([model, groupList], i) => (
                  <div
                    key={i}
                    className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-1"
                  >
                    <span className="font-bold text-slate-900 dark:text-white">{model}</span>
                    <span className="text-[11px] text-slate-500 font-medium">
                      Mapped to {groupList.length} groups: {groupList.map((g) => `${g.boxNumber} (${g.id})`).join(", ")}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* 4. Missing Display Sizes */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80">
              <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center justify-between">
                <span>Groups with Missing/Unknown Display Size</span>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                  {missingDisplaySizes.length}
                </span>
              </h5>
              {missingDisplaySizes.length === 0 ? (
                <p className="text-xs text-slate-500 mt-1">None found.</p>
              ) : (
                <div className="mt-2 flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                  {missingDisplaySizes.map((item, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-[11px] font-semibold"
                    >
                      {item.boxNumber} ({item.id})
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* 5. Suspicious / Truncated Model Strings */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80">
              <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center justify-between">
                <span>Suspicious / Incomplete Model Names</span>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                  {suspiciousModels.length}
                </span>
              </h5>
              {suspiciousModels.length === 0 ? (
                <p className="text-xs text-slate-500 mt-1">None found.</p>
              ) : (
                <ul className="text-xs text-amber-600 font-medium mt-2 space-y-1">
                  {suspiciousModels.map((item, i) => (
                    <li key={i}>
                      [{item.boxNumber} / {item.id}] &quot;{item.model}&quot; — {item.reason}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-4 border-t border-slate-100 dark:border-slate-800">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-bold text-sm hover:opacity-90 transition-opacity"
          >
            Close Data Quality Audit
          </button>
        </div>
      </div>
    </div>
  );
}
