"use client";

import { useState, useEffect, useMemo } from "react";
import {
  X,
  Printer,
  FileText,
  Search,
  Plus,
  Minus,
  Trash2,
  Layers,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  Sparkles,
  RefreshCw,
} from "lucide-react";
import type { Box } from "@/types/screenguard";
import {
  generateA4LabelsPdf,
  printA4LabelsDirect,
  type SelectedLabelItem,
} from "@/lib/a4LabelGenerator";

interface A4LabelPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  allBoxes: Box[];
  initialBox?: Box | null;
}

export function A4LabelPrintModal({
  isOpen,
  onClose,
  allBoxes,
  initialBox,
}: A4LabelPrintModalProps) {
  const [activeTab, setActiveTab] = useState<"custom" | "full">("custom");
  const [searchQuery, setSearchQuery] = useState("");
  const [queue, setQueue] = useState<Map<string, { item: Box; quantity: number }>>(new Map());
  const [globalQty, setGlobalQty] = useState(1);
  const [previewPageIndex, setPreviewPageIndex] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);

  // Initialize with initialBox or restore state
  useEffect(() => {
    if (isOpen) {
      if (initialBox) {
        setQueue(new Map([[initialBox.id, { item: initialBox, quantity: 1 }]]));
        setActiveTab("custom");
      }
      setPreviewPageIndex(0);
    }
  }, [isOpen, initialBox]);

  // Tab 2: Full Inventory auto-populate
  const handleSwitchToFull = () => {
    setActiveTab("full");
    const fullMap = new Map<string, { item: Box; quantity: number }>();
    allBoxes.forEach((b) => {
      fullMap.set(b.id, { item: b, quantity: globalQty });
    });
    setQueue(fullMap);
  };

  const handleSwitchToCustom = () => {
    setActiveTab("custom");
    if (initialBox) {
      setQueue(new Map([[initialBox.id, { item: initialBox, quantity: 1 }]]));
    } else {
      setQueue(new Map());
    }
  };

  // Change global quantity for Full Inventory tab
  const handleGlobalQtyChange = (qty: number) => {
    const validQty = Math.max(1, qty);
    setGlobalQty(validQty);
    setQueue((prev) => {
      const next = new Map(prev);
      next.forEach((val, key) => {
        next.set(key, { ...val, quantity: validQty });
      });
      return next;
    });
  };

  // Queue item updates
  const setItemQuantity = (box: Box, qty: number) => {
    setQueue((prev) => {
      const next = new Map(prev);
      if (qty <= 0) {
        next.delete(box.id);
      } else {
        next.set(box.id, { item: box, quantity: qty });
      }
      return next;
    });
  };

  const removeItem = (boxId: string) => {
    setQueue((prev) => {
      const next = new Map(prev);
      next.delete(boxId);
      return next;
    });
  };

  const clearQueue = () => {
    setQueue(new Map());
  };

  // Search results for Custom Selection tab
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    return allBoxes
      .filter((b) => {
        const matchBox = b.boxNumber.toLowerCase().includes(q);
        const matchTitle = b.title.toLowerCase().includes(q);
        const matchModel = b.compatibleModels?.some((m) => m.toLowerCase().includes(q));
        return matchBox || matchTitle || matchModel;
      })
      .slice(0, 10);
  }, [searchQuery, allBoxes]);

  // Convert queue to array
  const queueArray = useMemo<Array<{ item: Box; quantity: number }>>(() => {
    return Array.from(queue.values());
  }, [queue]);

  // Flatten for A4 pages (12 per sheet)
  const flattenedStickers = useMemo(() => {
    const list: Box[] = [];
    queueArray.forEach(({ item, quantity }) => {
      for (let i = 0; i < quantity; i++) {
        list.push(item);
      }
    });
    return list;
  }, [queueArray]);

  const totalLabels = flattenedStickers.length;
  const totalSheets = Math.max(1, Math.ceil(totalLabels / 12));

  // Items for current preview page (12 slots)
  const currentSheetStickers = useMemo(() => {
    const start = previewPageIndex * 12;
    return flattenedStickers.slice(start, start + 12);
  }, [flattenedStickers, previewPageIndex]);

  // Handle direct print
  const handlePrintDirect = () => {
    if (queueArray.length === 0) {
      alert("Please add at least one box to the print queue.");
      return;
    }
    setIsGenerating(true);
    try {
      printA4LabelsDirect(queueArray);
    } catch (e) {
      console.error("Direct print failed", e);
      alert("Could not trigger print dialog.");
    } finally {
      setIsGenerating(false);
    }
  };

  // Handle PDF download
  const handleDownloadPdf = () => {
    if (queueArray.length === 0) {
      alert("Please add at least one box to the print queue.");
      return;
    }
    setIsGenerating(true);
    try {
      const doc = generateA4LabelsPdf(queueArray);
      doc.save("UZEE_TECH_CUSTOM_LABELS.pdf");
    } catch (e) {
      console.error("PDF download failed", e);
      alert("Failed to download PDF.");
    } finally {
      setIsGenerating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-6xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh] animate-scale-in">
        {/* Top Header */}
        <div className="px-5 py-3.5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-base tracking-tight leading-tight flex items-center gap-2">
                A4 Label Print Studio
                <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full">
                  12 Slots / Sheet
                </span>
              </h3>
              <p className="text-xs text-slate-400 font-medium">
                Standard 3x4 grid stickers with spine strip, cut guides, and full models list
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

        {/* Real-Time Summary & Mode Bar */}
        <div className="px-5 py-2.5 bg-slate-100 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Mode Switcher Tabs */}
          <div className="flex rounded-xl bg-slate-200 dark:bg-slate-700/80 p-0.5 font-bold">
            <button
              type="button"
              onClick={handleSwitchToCustom}
              className={`px-3.5 py-1.5 rounded-lg transition-all ${
                activeTab === "custom"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm"
                  : "text-slate-600 dark:text-slate-400"
              }`}
            >
              Custom Selection ({queue.size})
            </button>
            <button
              type="button"
              onClick={handleSwitchToFull}
              className={`px-3.5 py-1.5 rounded-lg transition-all ${
                activeTab === "full"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm"
                  : "text-slate-600 dark:text-slate-400"
              }`}
            >
              Print Full Inventory ({allBoxes.length})
            </button>
          </div>

          {/* Stats Bar */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 dark:text-slate-400">Total Labels:</span>
              <span className="font-black text-slate-900 dark:text-white">{totalLabels}</span>
            </div>
            <span>•</span>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 dark:text-slate-400">Sheets Required:</span>
              <span className="font-black text-amber-600 dark:text-amber-400">
                {totalLabels > 0 ? totalSheets : 0} A4 Sheet{totalSheets > 1 ? "s" : ""}
              </span>
            </div>

            {queue.size > 0 && (
              <button
                type="button"
                onClick={clearQueue}
                className="text-rose-600 dark:text-rose-400 hover:underline font-bold ml-2"
              >
                Clear All
              </button>
            )}
          </div>
        </div>

        {/* Two-Column Workspace */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden divide-y lg:divide-y-0 lg:divide-x divide-slate-200 dark:divide-slate-800">
          {/* Left Panel: Search & Queue Controls (col-span-5) */}
          <div className="lg:col-span-5 p-4 flex flex-col overflow-y-auto space-y-4 max-h-[50vh] lg:max-h-[70vh]">
            {activeTab === "custom" ? (
              <>
                {/* Search Input */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                    <Search className="w-3.5 h-3.5 text-brand-600" /> Search Box or Phone Model
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 048, A05, Redmi 13C, iPhone 16..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                  />
                </div>

                {/* Search Results Dropdown / Quick Add List */}
                {searchResults.length > 0 && (
                  <div className="p-2 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700/50 max-h-40 overflow-y-auto">
                    {searchResults.map((b) => (
                      <div
                        key={b.id}
                        className="py-1.5 px-2 flex items-center justify-between text-xs hover:bg-white dark:hover:bg-slate-700/50 rounded-xl transition-colors"
                      >
                        <div>
                          <span className="font-black text-slate-900 dark:text-white mr-1.5">
                            {b.boxNumber}
                          </span>
                          <span className="text-slate-500 truncate max-w-[150px] inline-block align-bottom">
                            {b.title}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const cur = queue.get(b.id)?.quantity || 0;
                            setItemQuantity(b, cur + 1);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-brand-700 hover:bg-brand-800 text-white font-bold text-[11px] flex items-center gap-1"
                        >
                          <Plus className="w-3 h-3" /> Add
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              /* Full Inventory Controls */
              <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-black text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-amber-500" /> Global Sticker Quantity
                  </span>
                  <div className="flex items-center rounded-xl bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 p-0.5">
                    <button
                      type="button"
                      onClick={() => handleGlobalQtyChange(globalQty - 1)}
                      className="w-7 h-7 flex items-center justify-center font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-8 text-center font-black text-slate-900 dark:text-white">
                      {globalQty}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleGlobalQtyChange(globalQty + 1)}
                      className="w-7 h-7 flex items-center justify-center font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                <p className="text-[11px] text-amber-800 dark:text-amber-300 font-medium">
                  Applies to all {allBoxes.length} boxes in the catalog. You can still adjust individual rows below.
                </p>
              </div>
            )}

            {/* Print Queue List */}
            <div className="space-y-2 flex-1">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-blue-500" />
                Sticker Print Queue ({queue.size} Boxes)
              </span>

              {queue.size === 0 ? (
                <div className="text-center py-8 text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-xs font-semibold">
                  Queue is empty. Search a box or click &quot;Print Full Inventory&quot;.
                </div>
              ) : (
                <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                  {queueArray.map(({ item, quantity }) => (
                    <div
                      key={item.boxNumber}
                      className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/80 flex items-center justify-between text-xs"
                    >
                      <div className="flex-1 mr-2 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-black text-slate-900 dark:text-white">
                            {item.boxNumber}
                          </span>
                          <span className="text-[10px] text-slate-400 truncate">
                            {item.displaySize ? `[${item.displaySize}]` : ""}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          {item.title}
                        </p>
                      </div>

                      {/* Quantity Stepper */}
                      <div className="flex items-center gap-1.5">
                        <div className="flex items-center rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-0.5">
                          <button
                            type="button"
                            onClick={() => setItemQuantity(item as Box, quantity - 1)}
                            className="w-6 h-6 flex items-center justify-center font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-7 text-center font-black text-slate-900 dark:text-white text-xs">
                            {quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => setItemQuantity(item as Box, quantity + 1)}
                            className="w-6 h-6 flex items-center justify-center font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => removeItem(item.boxNumber)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Panel: Live Scaled A4 Sheet Visualizer (col-span-7) */}
          <div className="lg:col-span-7 p-4 bg-slate-200/50 dark:bg-slate-950 flex flex-col items-center justify-center overflow-y-auto">
            {/* Sheet Paginator */}
            <div className="w-full flex items-center justify-between mb-2 px-2 text-xs">
              <span className="font-extrabold text-slate-500 uppercase tracking-wider text-[11px]">
                A4 Sheet Preview (3 x 4 Grid)
              </span>

              {totalSheets > 1 && (
                <div className="flex items-center gap-1 bg-white dark:bg-slate-900 px-2.5 py-1 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm font-bold">
                  <button
                    type="button"
                    disabled={previewPageIndex === 0}
                    onClick={() => setPreviewPageIndex((p) => Math.max(0, p - 1))}
                    className="p-1 disabled:opacity-30"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-slate-900 dark:text-white px-1">
                    Sheet {previewPageIndex + 1} of {totalSheets}
                  </span>
                  <button
                    type="button"
                    disabled={previewPageIndex >= totalSheets - 1}
                    onClick={() => setPreviewPageIndex((p) => Math.min(totalSheets - 1, p + 1))}
                    className="p-1 disabled:opacity-30"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {/* The Scaled A4 Sheet Container */}
            <div className="w-full max-w-[420px] aspect-[210/297] bg-white text-black rounded-lg shadow-xl border border-slate-300 p-2 grid grid-cols-3 grid-rows-4 gap-1.5 overflow-hidden font-mono select-none">
              {Array.from({ length: 12 }).map((_, slotIdx) => {
                const boxItem = currentSheetStickers[slotIdx];
                if (!boxItem) {
                  return (
                    <div
                      key={slotIdx}
                      className="border border-dashed border-slate-300 rounded p-1 flex items-center justify-center text-[9px] text-slate-400"
                    >
                      Empty Slot
                    </div>
                  );
                }

                const primaryModel = Array.isArray(boxItem.compatibleModels)
                  ? boxItem.compatibleModels[0] || boxItem.title
                  : boxItem.title;

                const modelsSnippet = Array.isArray(boxItem.compatibleModels)
                  ? boxItem.compatibleModels.slice(0, 3).join(", ")
                  : boxItem.title;

                return (
                  <div
                    key={slotIdx}
                    className="border border-dashed border-slate-400 rounded flex flex-col justify-between p-1 bg-slate-50/50 text-[7px] leading-tight overflow-hidden"
                  >
                    {/* Spine Strip (Top 25%) */}
                    <div className="flex items-center gap-1 border-b border-slate-300 pb-0.5">
                      <div className="px-1 py-0.5 bg-black text-white rounded font-black text-[7.5px] shrink-0">
                        {boxItem.boxNumber}
                      </div>
                      <div className="overflow-hidden">
                        <p className="font-bold text-[7px] truncate">{boxItem.title}</p>
                        <p className="text-[6px] text-slate-500">{boxItem.displaySize || ""}</p>
                      </div>
                    </div>

                    {/* Front Face Card */}
                    <div className="flex-1 flex flex-col justify-center text-center py-0.5">
                      <p className="font-black text-[8px] uppercase tracking-wide">
                        {boxItem.boxNumber}
                      </p>
                      <hr className="my-0.5 border-slate-300" />
                      <p className="font-bold text-[7.5px] text-black truncate">{primaryModel}</p>
                      <p className="text-[6px] text-slate-600 line-clamp-2 mt-0.5">
                        {modelsSnippet}
                      </p>
                    </div>

                    {/* Footer Cut Guide watermark */}
                    <p className="text-[5px] text-slate-400 text-center uppercase tracking-tighter">
                      UZEE TECH
                    </p>
                  </div>
                );
              })}
            </div>

            <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center mt-2">
              Auto-scaled A4 sheet representation (67mm x 72mm cut guides per sticker).
            </p>
          </div>
        </div>

        {/* Action Bottom Bar */}
        <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold transition-colors"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={queue.size === 0 || isGenerating}
              onClick={handleDownloadPdf}
              className="px-4 py-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-40"
            >
              <FileText className="w-4 h-4 text-amber-500" />
              <span>Download A4 PDF</span>
            </button>

            <button
              type="button"
              disabled={queue.size === 0 || isGenerating}
              onClick={handlePrintDirect}
              className="px-5 py-2.5 rounded-2xl bg-slate-900 hover:bg-black dark:bg-amber-500 dark:hover:bg-amber-400 text-white dark:text-slate-950 font-black text-xs shadow-lg active:scale-95 transition-all flex items-center gap-2 disabled:opacity-40"
            >
              <Printer className="w-4 h-4" />
              <span>
                {isGenerating
                  ? "Rendering Sheets..."
                  : `Print ${totalLabels} Label${totalLabels !== 1 ? "s" : ""} Directly`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
