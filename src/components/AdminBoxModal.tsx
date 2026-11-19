"use client";

import { useState, useEffect, useRef } from "react";
import { X, Plus, Package, Smartphone, Check } from "lucide-react";
import type { Box, ScreenGuardVariants } from "@/types/screenguard";

interface AdminBoxModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (box: Box) => void;
  initialBox?: Box | null;
  existingBoxCount: number;
}

export function AdminBoxModal({
  isOpen,
  onClose,
  onSave,
  initialBox,
  existingBoxCount,
}: AdminBoxModalProps) {
  const [boxNumber, setBoxNumber] = useState("");
  const [displaySize, setDisplaySize] = useState("");
  const [title, setTitle] = useState("");
  const [models, setModels] = useState<string[]>([]);
  const [newModelInput, setNewModelInput] = useState("");
  const [notes, setNotes] = useState("");
  const [source, setSource] = useState("");
  const [verification, setVerification] = useState("");
  const [error, setError] = useState("");

  // 4 individual finish variant counts
  const [clearStock, setClearStock] = useState(0);
  const [privacyStock, setPrivacyStock] = useState(0);
  const [matteStock, setMatteStock] = useState(0);
  const [borderlessStock, setBorderlessStock] = useState(0);

  const [stockCountVerified, setStockCountVerified] = useState(false);
  const [historyList, setHistoryList] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  // Live total units across all 4 finishes
  const totalUnits = clearStock + privacyStock + matteStock + borderlessStock;

  // ESC key closing & Ctrl+Enter submit directly inside AdminBoxModal with capture
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      } else if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        formRef.current?.requestSubmit();
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (initialBox) {
      setBoxNumber(initialBox.boxNumber);
      setDisplaySize(initialBox.displaySize || "Unknown");
      setTitle(initialBox.title);
      setModels([...initialBox.compatibleModels]);
      setNotes(initialBox.notes || "");
      setSource(initialBox.source || "");
      setVerification(initialBox.verification || "");

      const v = initialBox.variants;
      const rawStock = Math.max(0, initialBox.stockQuantity ?? 0);
      if (v) {
        setClearStock(Math.max(0, Number(v.super_d ?? 0)));
        setPrivacyStock(Math.max(0, Number(v.privacy ?? 0)));
        setMatteStock(Math.max(0, Number(v.matte ?? 0)));
        setBorderlessStock(Math.max(0, Number(v.borderless ?? 0)));
      } else {
        setClearStock(rawStock);
        setPrivacyStock(0);
        setMatteStock(0);
        setBorderlessStock(0);
      }
      setStockCountVerified(initialBox.stockCountVerified ?? false);

      // Load history for this group
      fetch(`/api/inventory?type=history&groupId=${initialBox.id}`)
        .then((res) => res.json())
        .then((json) => {
          if (Array.isArray(json.history)) setHistoryList(json.history);
        })
        .catch(() => {});
    } else {
      const nextNum = existingBoxCount + 1;
      const padded = String(nextNum).padStart(3, "0");
      setBoxNumber(`BOX ${padded} PRIVACY/CLEAR/MATTE/BORDERLESS`);
      setDisplaySize("Unknown");
      setTitle("");
      setModels([]);
      setNotes("");
      setSource("");
      setVerification("");
      setClearStock(0);
      setPrivacyStock(0);
      setMatteStock(0);
      setBorderlessStock(0);
      setStockCountVerified(false);
      setHistoryList([]);
    }
    setNewModelInput("");
    setError("");
    setShowHistory(false);
  }, [initialBox, existingBoxCount, isOpen]);

  const handleAddModel = () => {
    if (!newModelInput.trim()) return;

    // Support bulk add via slash, comma, or newline
    const items = newModelInput
      .split(/[\/\n,]/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const updated = [...models];
    for (const item of items) {
      if (!updated.includes(item)) {
        updated.push(item);
      }
    }

    setModels(updated);
    setNewModelInput("");
  };

  const handleRemoveModel = (index: number) => {
    setModels(models.filter((_, i) => i !== index));
  };

  const handleAddToPurchaseList = async () => {
    if (!initialBox) return;
    const input = window.prompt(`Order quantity for ${boxNumber}:`, "10");
    if (!input) return;
    const qty = parseInt(input, 10);
    if (isNaN(qty) || qty <= 0) return;

    try {
      const res = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_purchase_item",
          groupId: initialBox.id,
          requestedQuantity: qty,
          note: "Added from Admin Box Modal",
        }),
      });
      if (res.ok) {
        alert(`Added ${boxNumber} (${qty} units) to Purchase List!`);
      }
    } catch (e) {
      console.error("Add to purchase list failed", e);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    let currentModels = [...models];
    if (newModelInput.trim()) {
      const items = newModelInput
        .split(/[\/\n,]/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      for (const item of items) {
        if (!currentModels.includes(item)) {
          currentModels.push(item);
        }
      }
    }

    if (!boxNumber.trim()) {
      setError("Box Number is required");
      return;
    }
    if (!title.trim() && currentModels.length === 0) {
      setError("Please provide a title or add at least one compatible model");
      return;
    }

    const calculatedTotal = clearStock + privacyStock + matteStock + borderlessStock;
    const variants: ScreenGuardVariants = {
      super_d: clearStock,
      privacy: privacyStock,
      matte: matteStock,
      borderless: borderlessStock,
    };

    const finalBox: Box = {
      id: initialBox ? initialBox.id : `SD-NEW-${Date.now()}`,
      boxNumber: boxNumber.trim().toUpperCase(),
      displaySize: displaySize.trim() || "Unknown",
      title: title.trim() || currentModels.join("/"),
      compatibleModels: currentModels.length > 0 ? currentModels : [title.trim()],
      rawText: initialBox?.rawText || title.trim(),
      category: initialBox?.category || "Super-D",
      notes: notes.trim() || undefined,
      source: source.trim() || undefined,
      verification: verification.trim() || undefined,
      stockQuantity: calculatedTotal,
      variants,
      stockCountVerified,
    };

    onSave(finalBox);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-brand-700 text-white font-bold">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {initialBox ? `Edit ${initialBox.boxNumber} (${initialBox.id})` : "Add New Compatibility Box"}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Configure box number, finish stock counts, display size, and model listings
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <kbd className="hidden sm:inline-flex items-center gap-1 text-[10px] font-mono font-bold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-1 rounded-lg shadow-2xs">
              ESC ✕
            </kbd>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Close (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Form Body */}
        <form ref={formRef} onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="p-3.5 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs font-semibold text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          {/* INVENTORY CONTROLS CARD (Rendered for BOTH Edit Box and Add New Box modes) */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-3.5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-0.5">
                  {initialBox ? "INVENTORY CONTROLS" : "INITIAL STOCK SETUP"}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-black text-slate-900 dark:text-white">
                    {totalUnits} units
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-lg text-xs font-black uppercase border ${
                      totalUnits >= 4
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800"
                        : totalUnits >= 1
                        ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-300 dark:border-amber-800"
                        : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border-rose-300 dark:border-rose-800"
                    }`}
                  >
                    {totalUnits >= 4 ? "IN STOCK" : totalUnits >= 1 ? "LOW STOCK" : "OUT OF STOCK"}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={stockCountVerified}
                    onChange={(e) => setStockCountVerified(e.target.checked)}
                    className="w-4 h-4 rounded text-brand-700 focus:ring-brand-700"
                  />
                  <span>Physical Count Verified</span>
                </label>
              </div>
            </div>

            {/* 4-COLUMN VARIANT STOCK INPUTS GRID */}
            <div className="space-y-1.5 pt-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Finish Breakdown (Clear • Privacy • Matte • Borderless)
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {/* 1. Clear / Super-D */}
                <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 shadow-xs flex flex-col justify-between space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <span>✨</span> Clear
                    </span>
                    <span className="text-[9px] font-mono font-bold uppercase bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded">
                      Super-D
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        const val = Math.max(0, clearStock - 1);
                        setClearStock(val);
                        if (val > 0) setStockCountVerified(true);
                      }}
                      disabled={clearStock <= 0}
                      className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-black text-sm flex items-center justify-center transition disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min="0"
                      value={clearStock}
                      onChange={(e) => {
                        const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                        setClearStock(val);
                        if (val > 0) setStockCountVerified(true);
                      }}
                      className="w-full text-center py-1.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl font-black text-slate-900 dark:text-white text-base focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setClearStock(clearStock + 1);
                        setStockCountVerified(true);
                      }}
                      className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-black text-sm flex items-center justify-center transition"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* 2. Privacy */}
                <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 shadow-xs flex flex-col justify-between space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <span>🕶️</span> Privacy
                    </span>
                    <span className="text-[9px] font-mono font-bold uppercase bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 px-1.5 py-0.5 rounded">
                      Dark
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        const val = Math.max(0, privacyStock - 1);
                        setPrivacyStock(val);
                        if (val > 0) setStockCountVerified(true);
                      }}
                      disabled={privacyStock <= 0}
                      className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-black text-sm flex items-center justify-center transition disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min="0"
                      value={privacyStock}
                      onChange={(e) => {
                        const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                        setPrivacyStock(val);
                        if (val > 0) setStockCountVerified(true);
                      }}
                      className="w-full text-center py-1.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl font-black text-slate-900 dark:text-white text-base focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setPrivacyStock(privacyStock + 1);
                        setStockCountVerified(true);
                      }}
                      className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-black text-sm flex items-center justify-center transition"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* 3. Matte */}
                <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 shadow-xs flex flex-col justify-between space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <span>🌫️</span> Matte
                    </span>
                    <span className="text-[9px] font-mono font-bold uppercase bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded">
                      Anti-Glare
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        const val = Math.max(0, matteStock - 1);
                        setMatteStock(val);
                        if (val > 0) setStockCountVerified(true);
                      }}
                      disabled={matteStock <= 0}
                      className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-black text-sm flex items-center justify-center transition disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min="0"
                      value={matteStock}
                      onChange={(e) => {
                        const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                        setMatteStock(val);
                        if (val > 0) setStockCountVerified(true);
                      }}
                      className="w-full text-center py-1.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl font-black text-slate-900 dark:text-white text-base focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setMatteStock(matteStock + 1);
                        setStockCountVerified(true);
                      }}
                      className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-black text-sm flex items-center justify-center transition"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* 4. Borderless */}
                <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 shadow-xs flex flex-col justify-between space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <span>🔲</span> Borderless
                    </span>
                    <span className="text-[9px] font-mono font-bold uppercase bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded">
                      Edge
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        const val = Math.max(0, borderlessStock - 1);
                        setBorderlessStock(val);
                        if (val > 0) setStockCountVerified(true);
                      }}
                      disabled={borderlessStock <= 0}
                      className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-black text-sm flex items-center justify-center transition disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min="0"
                      value={borderlessStock}
                      onChange={(e) => {
                        const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                        setBorderlessStock(val);
                        if (val > 0) setStockCountVerified(true);
                      }}
                      className="w-full text-center py-1.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl font-black text-slate-900 dark:text-white text-base focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setBorderlessStock(borderlessStock + 1);
                        setStockCountVerified(true);
                      }}
                      className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-black text-sm flex items-center justify-center transition"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Sub-actions (Add to Purchase List & History) */}
            {initialBox && (
              <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                <button
                  type="button"
                  onClick={handleAddToPurchaseList}
                  className="px-3 py-1.5 rounded-xl bg-brand-50 dark:bg-brand-950 text-brand-700 dark:text-brand-300 font-bold text-xs border border-brand-200 dark:border-brand-800 hover:bg-brand-100 transition-colors"
                >
                  + Add to Purchase List
                </button>
                <button
                  type="button"
                  onClick={() => setShowHistory(!showHistory)}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs hover:bg-slate-200 transition-colors"
                >
                  {showHistory ? "Hide History" : `History (${historyList.length})`}
                </button>
              </div>
            )}

            {/* History Log Drawer */}
            {initialBox && showHistory && (
              <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700 max-h-40 overflow-y-auto space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Recent Inventory History
                </span>
                {historyList.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No inventory transactions logged yet.</p>
                ) : (
                  historyList.map((t, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between text-xs py-1 px-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800"
                    >
                      <span className="font-bold text-slate-700 dark:text-slate-300">
                        {t.transactionType}: {t.previousQuantity} → {t.newQuantity} (
                        {t.quantityChange > 0 ? `+${t.quantityChange}` : t.quantityChange})
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(t.createdAt).toLocaleDateString()}{" "}
                        {new Date(t.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* BOX DETAILS SECTION */}
          <div className="space-y-4">
            {/* Box Number (Widened Full Width to ensure no horizontal clipping) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Box Identifier
                </label>
                <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">
                  Standard: BOX XXX PRIVACY/CLEAR/MATTE/BORDERLESS
                </span>
              </div>
              <input
                type="text"
                value={boxNumber}
                onChange={(e) => setBoxNumber(e.target.value)}
                placeholder="e.g. BOX 001 PRIVACY/CLEAR/MATTE/BORDERLESS"
                className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono font-bold text-sm tracking-wide focus:outline-none focus:ring-2 focus:ring-brand-700/30"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Display Size */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Display Size
                </label>
                <input
                  type="text"
                  value={displaySize}
                  onChange={(e) => setDisplaySize(e.target.value)}
                  placeholder='e.g. 6.7", 6.1", Unknown'
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-bold text-base focus:outline-none focus:ring-2 focus:ring-brand-700/30"
                />
              </div>

              {/* Box Group Title */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Box Title / Raw Description
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. SAM A05/A06 4G/A06 5G/REDMI 13C"
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-medium text-sm focus:outline-none focus:ring-2 focus:ring-brand-700/30"
                />
              </div>
            </div>
          </div>

          {/* Compatible Models List Manager */}
          <div className="space-y-3 pt-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5" />
                Compatible Models ({models.length})
              </span>
              <span className="text-[11px] text-slate-400 font-normal lowercase">
                (bulk paste separated by / or newlines)
              </span>
            </label>

            {/* Input & Add Button */}
            <div className="flex gap-2">
              <input
                type="text"
                value={newModelInput}
                onChange={(e) => setNewModelInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddModel();
                  }
                }}
                placeholder="Type model name (e.g. Samsung A06 5G) and press Add"
                className="flex-1 px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-700/30"
              />
              <button
                type="button"
                onClick={handleAddModel}
                className="px-4 py-2.5 rounded-xl bg-brand-700 text-white font-semibold text-sm hover:bg-brand-800 transition-colors flex items-center gap-1 shrink-0"
              >
                <Plus className="w-4 h-4" /> Add
              </button>
            </div>

            {/* Models Tag Cloud */}
            <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60">
              {models.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-2 w-full text-center">
                  No compatible models added yet.
                </p>
              ) : (
                models.map((model, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-sm"
                  >
                    <span>{model}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveModel(idx)}
                      className="text-slate-400 hover:text-red-500 transition-colors"
                      title="Remove model"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ))
              )}
            </div>
          </div>

          {/* Action Footer */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl font-semibold text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-brand-700 hover:bg-brand-800 text-white font-bold text-sm shadow-md transition-colors flex items-center gap-2"
            >
              <Check className="w-4 h-4" />
              <span>{initialBox ? "Save Changes" : "Create Box"}</span>
              <kbd className="hidden sm:inline-block text-[10px] bg-brand-800/80 text-white/90 px-1.5 py-0.5 rounded font-mono font-normal">
                Ctrl+↵
              </kbd>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
