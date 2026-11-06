"use client";

import React, { useState } from "react";
import {
  X,
  ClipboardList,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Plus,
  Minus,
  Trash2,
  RotateCcw,
  Layers,
  ArrowRight,
  Check,
} from "lucide-react";
import type { Box } from "@/types/screenguard";
import { VARIANT_META, VariantKey } from "@/lib/screenguard";
import {
  parseRawManifestText,
  findMatchingBoxes,
  type ManifestItem,
} from "@/lib/manifestParser";

interface FastPasteManifestModalProps {
  isOpen: boolean;
  onClose: () => void;
  allBoxes: Box[];
  onCommitManifest: (
    items: Array<{ boxNumber: string; variant: VariantKey; quantity: number }>
  ) => Promise<void>;
}

const SAMPLE_CHIPS = [
  "Redmi Note 13 4G - 10 Privacy, 5 Super-D\nA05 15pcs\nBox 048 - 20 Matte",
  "Samsung A15 15pcs Super-D\niPhone 15 Pro - 8 Privacy\nRedmi 12 12 Matte",
  "Box 001 - 25pcs\nBox 012 - 10 Privacy, 10 Matte\nInfinix Hot 40 - 15 Borderless",
];

const VARIANTS: VariantKey[] = ["super_d", "privacy", "matte", "borderless"];

export function FastPasteManifestModal({
  isOpen,
  onClose,
  allBoxes,
  onCommitManifest,
}: FastPasteManifestModalProps) {
  const [rawText, setRawText] = useState("");
  const [items, setItems] = useState<ManifestItem[]>([]);
  const [isAnalyzed, setIsAnalyzed] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);

  if (!isOpen) return null;

  const handleAnalyze = () => {
    if (!rawText.trim()) return;
    const parsed = parseRawManifestText(rawText, allBoxes);
    setItems(parsed);
    setIsAnalyzed(true);
  };

  const handleClear = () => {
    setRawText("");
    setItems([]);
    setIsAnalyzed(false);
  };

  const toggleSelect = (id: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, selected: !item.selected } : item
      )
    );
  };

  const toggleSelectAll = (select: boolean) => {
    setItems((prev) =>
      prev.map((item) => (item.matchedBox ? { ...item, selected: select } : item))
    );
  };

  const updateQuantity = (id: string, delta: number) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, quantity: Math.max(1, item.quantity + delta) }
          : item
      )
    );
  };

  const setExactQuantity = (id: string, qty: number) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, quantity: Math.max(1, qty || 1) } : item
      )
    );
  };

  const setVariant = (id: string, variant: VariantKey) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, variant } : item))
    );
  };

  const setMatchedBox = (id: string, box: Box | null) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        return {
          ...item,
          matchedBox: box,
          matchStatus: box ? "MATCHED_100" : "UNMATCHED",
          selected: box !== null,
        };
      })
    );
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const selectedItems = items.filter((it) => it.selected && it.matchedBox);
  const totalUnits = selectedItems.reduce((sum, it) => sum + it.quantity, 0);

  const handleCommit = async () => {
    if (selectedItems.length === 0 || isCommitting) return;
    setIsCommitting(true);
    try {
      const payload = selectedItems.map((it) => ({
        boxNumber: it.matchedBox!.boxNumber,
        variant: it.variant,
        quantity: it.quantity,
      }));
      await onCommitManifest(payload);
      handleClear();
      onClose();
    } catch (err) {
      console.error("Failed to commit manifest", err);
    } finally {
      setIsCommitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center border border-teal-500/20">
              <ClipboardList className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                Fast-Paste Inward Manifest
                <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                  Batch Parser
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Paste supplier dispatch text or WhatsApp arrival lists to increment inventory automatically
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Input Area */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-teal-500" />
                Raw Manifest or Message Content
              </label>
              <div className="flex items-center gap-1 text-[11px] text-slate-400">
                <span>Quick Fill:</span>
                {SAMPLE_CHIPS.map((chip, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setRawText(chip)}
                    className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-teal-50 hover:text-teal-600 dark:hover:bg-teal-950 dark:hover:text-teal-300 font-medium transition text-[10px]"
                  >
                    Sample {idx + 1}
                  </button>
                ))}
              </div>
            </div>

            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="Paste raw delivery text, WhatsApp message, or invoice notes here...&#10;e.g.&#10;Redmi Note 13 4G - 10pcs Privacy, 5 Super-D&#10;A05 15pcs&#10;Box 048 - 20 matte"
              rows={4}
              className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-sm font-mono text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500 transition resize-y"
            />

            <div className="flex items-center justify-between gap-3">
              <div className="text-xs text-slate-400">
                Supports models, variants (Privacy, Matte, Super-D, Borderless), and box numbers (`Box 048`).
              </div>
              <div className="flex items-center gap-2">
                {rawText && (
                  <button
                    type="button"
                    onClick={handleClear}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold transition flex items-center gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Reset
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleAnalyze}
                  disabled={!rawText.trim()}
                  className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black text-xs transition shadow-lg shadow-teal-500/20 flex items-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  ⚡ Analyze Manifest
                </button>
              </div>
            </div>
          </div>

          {/* Staging / Review Table */}
          {isAnalyzed && (
            <div className="space-y-4 pt-2 border-t border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                    Parsed Line Items
                    <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300">
                      {items.length} detected
                    </span>
                  </h3>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => toggleSelectAll(true)}
                      className="px-2 py-0.5 rounded text-[11px] font-semibold text-teal-600 dark:text-teal-400 hover:underline"
                    >
                      Select All
                    </button>
                    <span className="text-slate-300 dark:text-slate-700">|</span>
                    <button
                      type="button"
                      onClick={() => toggleSelectAll(false)}
                      className="px-2 py-0.5 rounded text-[11px] font-semibold text-slate-500 hover:underline"
                    >
                      Deselect All
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {items.filter((i) => i.matchStatus === "MATCHED_100").length} Matched
                  </span>
                  <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-bold">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    {items.filter((i) => i.matchStatus === "MULTIPLE_MATCH").length} Multiple
                  </span>
                  <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 font-bold">
                    <HelpCircle className="w-3.5 h-3.5" />
                    {items.filter((i) => i.matchStatus === "UNMATCHED").length} Unmatched
                  </span>
                </div>
              </div>

              {items.length === 0 ? (
                <div className="py-12 text-center text-slate-400 dark:text-slate-500 space-y-1.5 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                  <ClipboardList className="w-8 h-8 mx-auto opacity-30" />
                  <p className="text-sm font-semibold">No valid phone models or boxes recognized in input</p>
                  <p className="text-xs">Ensure models like &quot;Redmi Note 13&quot; or box IDs like &quot;Box 048&quot; are present.</p>
                </div>
              ) : (
                <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-800/80 text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                          <th className="py-2.5 px-3 w-10 text-center">Inc</th>
                          <th className="py-2.5 px-3">Parsed Target</th>
                          <th className="py-2.5 px-3">Catalog Destination</th>
                          <th className="py-2.5 px-3">Variant</th>
                          <th className="py-2.5 px-3 w-36">Quantity</th>
                          <th className="py-2.5 px-3 w-28 text-center">Status</th>
                          <th className="py-2.5 px-3 w-10 text-center"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                        {items.map((item) => {
                          const isMatched = !!item.matchedBox;
                          return (
                            <tr
                              key={item.id}
                              className={`transition ${
                                !isMatched
                                  ? "bg-rose-50/40 dark:bg-rose-950/20"
                                  : item.selected
                                  ? "bg-teal-50/30 dark:bg-teal-950/20 hover:bg-teal-50/50 dark:hover:bg-teal-950/30"
                                  : "opacity-60 hover:opacity-100"
                              }`}
                            >
                              {/* Checkbox */}
                              <td className="py-3 px-3 text-center">
                                <input
                                  type="checkbox"
                                  checked={item.selected && isMatched}
                                  disabled={!isMatched}
                                  onChange={() => toggleSelect(item.id)}
                                  className="w-4 h-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500 cursor-pointer disabled:cursor-not-allowed"
                                />
                              </td>

                              {/* Target / Raw Query */}
                              <td className="py-3 px-3">
                                <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                                  <span>{item.modelQuery}</span>
                                </div>
                                <div className="text-[10px] text-slate-400 font-mono truncate max-w-xs" title={item.rawLine}>
                                  {item.rawLine}
                                </div>
                              </td>

                              {/* Catalog Destination Box */}
                              <td className="py-3 px-3">
                                {item.matchStatus === "MULTIPLE_MATCH" ? (
                                  <select
                                    value={item.matchedBox?.boxNumber || ""}
                                    onChange={(e) => {
                                      const picked = item.candidates.find(
                                        (c) => c.boxNumber === e.target.value
                                      );
                                      setMatchedBox(item.id, picked || null);
                                    }}
                                    className="px-2.5 py-1 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 font-bold text-xs focus:ring-2 focus:ring-amber-500"
                                  >
                                    {item.candidates.map((c) => (
                                      <option key={c.id} value={c.boxNumber}>
                                        {c.boxNumber} - {c.title}
                                      </option>
                                    ))}
                                  </select>
                                ) : item.matchedBox ? (
                                  <div className="flex items-center gap-2">
                                    <span className="px-2 py-0.5 rounded-lg bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-200 font-black text-xs border border-teal-200 dark:border-teal-800">
                                      {item.matchedBox.boxNumber}
                                    </span>
                                    <span className="text-slate-700 dark:text-slate-300 font-semibold truncate max-w-xs">
                                      {item.matchedBox.title}
                                    </span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[11px] text-rose-600 dark:text-rose-400 font-bold">
                                      No catalog match
                                    </span>
                                    <select
                                      defaultValue=""
                                      onChange={(e) => {
                                        const b = allBoxes.find(
                                          (box) => box.boxNumber === e.target.value
                                        );
                                        if (b) setMatchedBox(item.id, b);
                                      }}
                                      className="text-[11px] px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                                    >
                                      <option value="" disabled>
                                        Assign Box...
                                      </option>
                                      {allBoxes.map((b) => (
                                        <option key={b.id} value={b.boxNumber}>
                                          {b.boxNumber} - {b.title}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                )}
                              </td>

                              {/* Variant Selector */}
                              <td className="py-3 px-3">
                                <div className="flex items-center gap-1">
                                  {VARIANTS.map((v) => {
                                    const meta = VARIANT_META[v];
                                    const isSelected = item.variant === v;
                                    return (
                                      <button
                                        key={v}
                                        type="button"
                                        onClick={() => setVariant(item.id, v)}
                                        className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase transition ${
                                          isSelected
                                            ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm"
                                            : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                                        }`}
                                      >
                                        {meta.shortName}
                                      </button>
                                    );
                                  })}
                                </div>
                              </td>

                              {/* Quantity Stepper */}
                              <td className="py-3 px-3">
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => updateQuantity(item.id, -1)}
                                    className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center font-bold text-slate-700 dark:text-slate-300"
                                  >
                                    <Minus className="w-3.5 h-3.5" />
                                  </button>
                                  <input
                                    type="number"
                                    value={item.quantity}
                                    min={1}
                                    onChange={(e) =>
                                      setExactQuantity(
                                        item.id,
                                        parseInt(e.target.value, 10) || 1
                                      )
                                    }
                                    className="w-14 text-center py-1 font-black text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => updateQuantity(item.id, 1)}
                                    className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center font-bold text-slate-700 dark:text-slate-300"
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>

                              {/* Match Status */}
                              <td className="py-3 px-3 text-center">
                                {item.matchStatus === "MATCHED_100" && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                    Exact
                                  </span>
                                )}
                                {item.matchStatus === "MULTIPLE_MATCH" && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                    Multiple
                                  </span>
                                )}
                                {item.matchStatus === "UNMATCHED" && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                                    Not Found
                                  </span>
                                )}
                              </td>

                              {/* Remove action */}
                              <td className="py-3 px-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => removeItem(item.id)}
                                  className="p-1 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Selected to Inward:{" "}
              <span className="font-black text-slate-900 dark:text-white">
                {selectedItems.length} lines
              </span>{" "}
              /{" "}
              <span className="font-black text-teal-600 dark:text-teal-400 text-sm">
                +{totalUnits} total units
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isCommitting}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCommit}
              disabled={selectedItems.length === 0 || isCommitting}
              className="px-6 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-black transition shadow-lg shadow-teal-500/20 flex items-center gap-2"
            >
              {isCommitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Updating Inventory...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  🚀 Commit All Stock Increments (+{totalUnits})
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
