"use client";

import React, { useState, useMemo } from "react";
import {
  Package,
  Copy,
  Check,
  Maximize2,
  Zap,
  ShieldAlert,
  Printer,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { Box, SearchResultItem } from "@/types/screenguard";
import { findCrossFitAlternatives } from "@/lib/crossFitMatcher";
import {
  inferGeometryProfile,
  NOTCH_META,
  EDGE_META,
} from "@/lib/geometryGuard";
import { normalizeVariants } from "@/lib/screenguard";

interface ResultCardProps {
  result: SearchResultItem;
  searchQuery?: string;
  allBoxes?: Box[];
  onStockUpdate?: () => void;
  onSelectBox?: (boxNumber: string) => void;
  onRequestDeadStockOrder?: (model: string) => void;
  onRequestWasteLog?: (box: Box) => void;
  onQueueA4Label?: (box: Box) => void;
}

export function ResultCard({
  result,
  searchQuery,
  allBoxes,
  onStockUpdate,
  onSelectBox,
  onRequestDeadStockOrder,
  onRequestWasteLog,
  onQueueA4Label,
}: ResultCardProps) {
  const { item, matchedModel } = result;
  const [copiedBox, setCopiedBox] = useState(false);
  const [isUpdatingStock, setIsUpdatingStock] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const stockQty = item.stockQuantity ?? 0;
  const isVerified = item.stockCountVerified ?? false;
  const stockStatus =
    item.stockStatus ||
    (isVerified
      ? stockQty >= 4
        ? "IN_STOCK"
        : stockQty >= 1
        ? "LOW_STOCK"
        : "OUT_OF_STOCK"
      : "NOT_COUNTED");

  const variants = useMemo(
    () => normalizeVariants(item.variants, stockQty),
    [item.variants, stockQty]
  );

  // Inferred Phone / Screen Guard Geometry Profile
  const itemGeometry = useMemo(() => inferGeometryProfile(item), [item]);

  // Compute Cross-Fit Alternatives
  const crossFitAlternatives = useMemo(() => {
    if (!allBoxes || allBoxes.length === 0) return [];
    return findCrossFitAlternatives(item, allBoxes);
  }, [item, allBoxes]);

  const handleCopyBox = () => {
    navigator.clipboard.writeText(item.boxNumber);
    setCopiedBox(true);
    setTimeout(() => setCopiedBox(false), 1600);
  };

  const handleQuickSale = async () => {
    if (stockQty <= 0) return;
    setIsUpdatingStock(true);
    try {
      const res = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_stock",
          groupId: item.id,
          stockAction: "SALE",
          amount: 1,
        }),
      });
      if (res.ok && onStockUpdate) {
        onStockUpdate();
      }
    } catch (e) {
      console.error("Quick sale failed", e);
    } finally {
      setIsUpdatingStock(false);
    }
  };

  const highlightMatch = (text: string) => {
    if (!searchQuery?.trim()) return text;
    const q = searchQuery.trim();
    const idx = text.toLowerCase().indexOf(q.toLowerCase());
    if (idx === -1) return text;
    return (
      <>
        {text.substring(0, idx)}
        <mark className="bg-amber-400 text-slate-950 rounded px-1 font-black">
          {text.substring(idx, idx + q.length)}
        </mark>
        {text.substring(idx + q.length)}
      </>
    );
  };

  const aliases = item.compatibleModels || [];
  const initialDisplayCount = 6;
  const visibleAliases = isExpanded ? aliases : aliases.slice(0, initialDisplayCount);
  const remainingCount = aliases.length - visibleAliases.length;

  return (
    <div className="flex flex-col justify-between bg-white dark:bg-[#111827] hover:bg-zinc-50 dark:hover:bg-[#151e30] border border-zinc-200 dark:border-slate-800 hover:border-zinc-300 dark:hover:border-slate-700 rounded-2xl p-3.5 sm:p-4 shadow-sm hover:shadow-md transition-all duration-200 gap-2.5 group">
      {/* 1. Header: Box ID Badge + Primary Model + Display Size + Geometry */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* High-contrast BOX badge */}
          <button
            type="button"
            onClick={handleCopyBox}
            className="flex items-center gap-1.5 px-3 py-1 bg-brand-700 hover:bg-brand-600 text-white rounded-xl font-black text-xs sm:text-sm tracking-wide shadow-sm shadow-brand-700/20 active:scale-95 transition"
            title="Click to copy box number"
          >
            <Package className="w-4 h-4 shrink-0" />
            <span>{item.boxNumber}</span>
            {copiedBox ? (
              <Check className="w-3.5 h-3.5 text-emerald-300 ml-0.5" />
            ) : (
              <Copy className="w-3 h-3 text-white/60 ml-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
            )}
          </button>

          {/* Screen Size Pill */}
          <div className="flex items-center gap-1 px-2.5 py-1 bg-zinc-100 dark:bg-slate-800/80 border border-zinc-200 dark:border-slate-700/80 rounded-xl text-xs font-bold text-zinc-700 dark:text-slate-300">
            <Maximize2 className="w-3 h-3 text-brand-500" />
            <span>{item.displaySize || "Standard"}</span>
          </div>

          {/* Geometry Cut Pill */}
          <div className="hidden sm:flex items-center gap-1 px-2 py-1 bg-zinc-100 dark:bg-slate-800/60 border border-zinc-200 dark:border-slate-700/60 rounded-xl text-[11px] font-bold text-zinc-600 dark:text-slate-400">
            <span>{NOTCH_META[itemGeometry.notchType].icon}</span>
            <span>{NOTCH_META[itemGeometry.notchType].short}</span>
            <span>•</span>
            <span>{EDGE_META[itemGeometry.edgeCut].short}</span>
          </div>
        </div>

        {/* Stock Status Pill */}
        <div className="shrink-0 flex items-center gap-1.5">
          <span
            className={`px-2.5 py-1 rounded-xl text-[10px] font-black tracking-wider uppercase border ${
              stockStatus === "IN_STOCK"
                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                : stockStatus === "LOW_STOCK"
                ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30"
                : stockStatus === "NOT_COUNTED"
                ? "bg-zinc-100 dark:bg-slate-800 text-zinc-600 dark:text-slate-400 border-zinc-200 dark:border-slate-700"
                : "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30"
            }`}
          >
            {stockStatus === "IN_STOCK"
              ? `${stockQty} IN STOCK`
              : stockStatus === "LOW_STOCK"
              ? `${stockQty} LOW STOCK`
              : stockStatus === "NOT_COUNTED"
              ? "NOT COUNTED"
              : "OUT OF STOCK"}
          </span>
        </div>
      </div>

      {/* Series Title & Direct Search Match Highlight */}
      <div>
        <h3 className="text-base font-extrabold text-zinc-900 dark:text-white tracking-tight flex items-center gap-2">
          <span>{highlightMatch(item.title)}</span>
          {matchedModel && matchedModel.toLowerCase() !== item.title.toLowerCase() && (
            <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/20">
              Match: {highlightMatch(matchedModel)}
            </span>
          )}
        </h3>
      </div>

      {/* 2. Variant Availability Strip */}
      <div className="grid grid-cols-4 gap-1.5 p-1 rounded-xl bg-zinc-100/90 dark:bg-slate-950/80 border border-zinc-200 dark:border-slate-800 text-[11px]">
        {/* Clear */}
        <div
          className={`flex flex-col items-center justify-center py-1 px-1 rounded-lg border transition ${
            (variants.super_d ?? 0) > 0
              ? "bg-emerald-500/15 dark:bg-emerald-500/20 border-emerald-500/40 text-emerald-800 dark:text-emerald-300 font-bold"
              : "bg-white/60 dark:bg-slate-900/50 border-zinc-200/80 dark:border-slate-800/70 text-zinc-500 dark:text-slate-400"
          }`}
        >
          <span className="text-[10px] text-zinc-500 dark:text-slate-400 font-medium">Clear</span>
          <span className="font-black text-xs text-zinc-900 dark:text-white">{variants.super_d ?? 0}</span>
        </div>

        {/* Privacy */}
        <div
          className={`flex flex-col items-center justify-center py-1 px-1 rounded-lg border transition ${
            (variants.privacy ?? 0) > 0
              ? "bg-purple-500/15 dark:bg-purple-500/20 border-purple-500/40 text-purple-800 dark:text-purple-300 font-bold ring-1 ring-purple-500/20"
              : "bg-white/60 dark:bg-slate-900/50 border-zinc-200/80 dark:border-slate-800/70 text-zinc-500 dark:text-slate-400"
          }`}
        >
          <span className="text-[10px] text-zinc-500 dark:text-slate-400 font-medium">🕶️ Privacy</span>
          <span className="font-black text-xs text-zinc-900 dark:text-white">{variants.privacy ?? 0}</span>
        </div>

        {/* Matte */}
        <div
          className={`flex flex-col items-center justify-center py-1 px-1 rounded-lg border transition ${
            (variants.matte ?? 0) > 0
              ? "bg-blue-500/15 dark:bg-blue-500/20 border-blue-500/40 text-blue-800 dark:text-blue-300 font-bold"
              : "bg-white/60 dark:bg-slate-900/50 border-zinc-200/80 dark:border-slate-800/70 text-zinc-500 dark:text-slate-400"
          }`}
        >
          <span className="text-[10px] text-zinc-500 dark:text-slate-400 font-medium">🌫️ Matte</span>
          <span className="font-black text-xs text-zinc-900 dark:text-white">{variants.matte ?? 0}</span>
        </div>

        {/* Borderless */}
        <div
          className={`flex flex-col items-center justify-center py-1 px-1 rounded-lg border transition ${
            (variants.borderless ?? 0) > 0
              ? "bg-amber-500/15 dark:bg-amber-500/20 border-amber-500/40 text-amber-800 dark:text-amber-300 font-bold"
              : "bg-white/60 dark:bg-slate-900/50 border-zinc-200/80 dark:border-slate-800/70 text-zinc-500 dark:text-slate-400"
          }`}
        >
          <span className="text-[10px] text-zinc-500 dark:text-slate-400 font-medium">🔲 Border</span>
          <span className="font-black text-xs text-zinc-900 dark:text-white">{variants.borderless ?? 0}</span>
        </div>
      </div>

      {/* 3. Cross-Fit Fallback Alert (ONLY displayed when out of stock AND alternatives exist) */}
      {(stockQty === 0 || stockStatus === "OUT_OF_STOCK") && crossFitAlternatives.length > 0 && (
        <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-1.5">
          <div className="flex items-center justify-between text-xs font-black text-amber-600 dark:text-amber-400">
            <span className="flex items-center gap-1">
              <span>⚠️</span>
              <span>Cross-Fit Alternatives ({crossFitAlternatives.length}):</span>
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold">
              {item.displaySize || "Screen"} Cut
            </span>
          </div>

          <div className="space-y-1">
            {crossFitAlternatives.slice(0, 2).map((alt) => (
              <div
                key={alt.boxId}
                className="flex items-center justify-between gap-2 bg-white dark:bg-slate-900/90 p-2 rounded-lg border border-amber-500/20 text-xs shadow-sm"
              >
                <div className="min-w-0 flex-1">
                  <span className="font-black text-zinc-900 dark:text-white mr-1.5">{alt.boxNumber}</span>
                  <span className="text-zinc-600 dark:text-slate-300 text-[11px]">
                    ({alt.matchedModelSummary}) — {alt.totalStock} in stock
                  </span>
                </div>
                {onSelectBox && (
                  <button
                    type="button"
                    onClick={() => onSelectBox(alt.boxNumber)}
                    className="px-2 py-0.5 rounded-md bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[10px] transition shrink-0"
                  >
                    View Box
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. Compatible Aliases (Compact pill tags) */}
      <div className="space-y-1.5">
        <div className="flex flex-wrap gap-1.5 max-h-20 overflow-hidden">
          {visibleAliases.map((model, idx) => {
            const isMatched =
              searchQuery &&
              model.toLowerCase().includes(searchQuery.trim().toLowerCase());
            return (
              <span
                key={idx}
                className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-medium transition ${
                  isMatched
                    ? "bg-brand-500/20 text-brand-700 dark:text-brand-300 border border-brand-500/40 font-bold"
                    : "bg-zinc-100 dark:bg-slate-800/80 text-zinc-700 dark:text-slate-300 border border-zinc-200 dark:border-slate-700/60 hover:bg-zinc-200 dark:hover:bg-slate-700/60"
                }`}
              >
                {highlightMatch(model)}
              </span>
            );
          })}
        </div>

        {aliases.length > initialDisplayCount && (
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-[11px] font-bold text-zinc-500 hover:text-zinc-900 dark:text-slate-400 dark:hover:text-white flex items-center gap-1 transition"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="w-3 h-3" /> Show Less
              </>
            ) : (
              <>
                <ChevronDown className="w-3 h-3" /> +{remainingCount} more models
              </>
            )}
          </button>
        )}
      </div>

      {/* 5. Action Footer */}
      <div className="pt-2 border-t border-zinc-200 dark:border-slate-800/80 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          {/* Quick SOLD (-1) */}
          <button
            type="button"
            onClick={handleQuickSale}
            disabled={isUpdatingStock || stockQty <= 0}
            className={`px-3 py-1.5 rounded-xl font-black text-xs transition border flex items-center gap-1 ${
              stockQty > 0
                ? "bg-rose-50 dark:bg-rose-500/15 hover:bg-rose-100 dark:hover:bg-rose-500/25 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-500/30 active:scale-95"
                : "bg-zinc-100 dark:bg-slate-800/40 text-zinc-400 dark:text-slate-600 border-zinc-200 dark:border-slate-800 cursor-not-allowed"
            }`}
            title="Decrement 1 unit sold"
          >
            <span>SOLD (-1)</span>
          </button>

          {/* Quick Waste */}
          {onRequestWasteLog && (
            <button
              type="button"
              onClick={() => onRequestWasteLog(item)}
              disabled={stockQty <= 0}
              className="px-2.5 py-1.5 rounded-xl font-bold text-xs bg-zinc-100 hover:bg-zinc-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-zinc-700 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 border border-zinc-200 dark:border-slate-700 transition flex items-center gap-1"
              title="Record broken, defect, or bubble-spoiled glass"
            >
              <ShieldAlert className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400" />
              <span className="hidden sm:inline">Waste</span>
            </button>
          )}

          {/* A4 Label Queue */}
          {onQueueA4Label && (
            <button
              type="button"
              onClick={() => onQueueA4Label(item)}
              className="p-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-zinc-700 dark:text-slate-300 hover:text-zinc-900 dark:hover:text-white border border-zinc-200 dark:border-slate-700 transition"
              title="Queue sticker in A4 Print Studio"
            >
              <Printer className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* WhatsApp Customer / Dead-Stock Order */}
        {onRequestDeadStockOrder && (
          <button
            type="button"
            onClick={() => onRequestDeadStockOrder(matchedModel || item.title)}
            className="px-3 py-1.5 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold text-xs transition flex items-center gap-1.5 shadow-sm active:scale-95"
            title="Send instant WhatsApp reorder"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>WA Order</span>
          </button>
        )}
      </div>
    </div>
  );
}
