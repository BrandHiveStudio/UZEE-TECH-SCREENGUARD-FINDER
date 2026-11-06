"use client";

import React, { useState } from "react";
import {
  X,
  AlertTriangle,
  Minus,
  Plus,
  ShieldAlert,
  Sparkles,
  Layers,
  FileText,
  CheckCircle2,
} from "lucide-react";
import type { Box, ScreenGuardVariants } from "@/types/screenguard";
import { VARIANT_META, VariantKey, normalizeVariants } from "@/lib/screenguard";
import {
  WASTE_REASON_META,
  WasteReason,
  WasteLogEntry,
} from "@/lib/wasteLog";

interface WasteTrackerModalProps {
  isOpen: boolean;
  onClose: () => void;
  box: Box | null;
  initialVariant?: VariantKey;
  onWasteRecorded: (updatedBox: Box, log: WasteLogEntry) => void;
}

const VARIANTS: VariantKey[] = ["super_d", "privacy", "matte", "borderless"];
const REASONS: WasteReason[] = [
  "INSTALLATION_BUBBLE",
  "CRACKED_ON_APPLICATION",
  "CUSTOMER_RETURN_DEFECT",
  "SUPPLIER_DEAD_ON_ARRIVAL",
];

export function WasteTrackerModal({
  isOpen,
  onClose,
  box,
  initialVariant = "super_d",
  onWasteRecorded,
}: WasteTrackerModalProps) {
  const [selectedVariant, setSelectedVariant] = useState<VariantKey>(initialVariant);
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState<WasteReason>("INSTALLATION_BUBBLE");
  const [technicianNotes, setTechnicianNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen || !box) return null;

  const currentVariants: ScreenGuardVariants = normalizeVariants(
    box.variants,
    box.stockQuantity ?? 0
  );

  const availableStockForVariant = currentVariants[selectedVariant] ?? 0;

  const handleVariantChange = (v: VariantKey) => {
    setSelectedVariant(v);
    const stock = currentVariants[v] ?? 0;
    if (quantity > stock && stock > 0) {
      setQuantity(stock);
    } else if (stock === 0) {
      setQuantity(1);
    }
  };

  const handleQuantityDelta = (delta: number) => {
    setQuantity((prev) => {
      const next = prev + delta;
      if (next < 1) return 1;
      if (next > availableStockForVariant && availableStockForVariant > 0) {
        return availableStockForVariant;
      }
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (availableStockForVariant <= 0) {
      setErrorMessage(`No stock available for ${VARIANT_META[selectedVariant].label} in ${box.boxNumber}`);
      return;
    }

    if (quantity > availableStockForVariant) {
      setErrorMessage(
        `Quantity (${quantity}) exceeds available stock (${availableStockForVariant}) for this variant.`
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/admin/waste-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          boxNumber: box.boxNumber,
          variant: selectedVariant,
          quantity,
          reason,
          technicianNotes: technicianNotes.trim() || undefined,
          modelName: box.compatibleModels?.[0] || box.title,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to log waste event");
      }

      onWasteRecorded(data.updatedBox, data.log);
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error recording waste";
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-rose-50/50 dark:bg-rose-950/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center border border-rose-500/20">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                Record Physical Waste / Shrinkage
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Track broken, defective, or bubble-spoiled guards without billing customers
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Box Target Card */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="px-2.5 py-1 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-black text-xs">
                {box.boxNumber}
              </span>
              <div>
                <h4 className="font-bold text-xs text-slate-900 dark:text-white">
                  {box.title}
                </h4>
                <p className="text-[11px] text-slate-400">
                  Display Cut: {box.displaySize || "Standard"} • Total Stock: {box.stockQuantity ?? 0}
                </p>
              </div>
            </div>
          </div>

          {/* Variant Selection */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
              Damaged Variant
            </label>
            <div className="grid grid-cols-2 gap-2">
              {VARIANTS.map((v) => {
                const meta = VARIANT_META[v];
                const stock = currentVariants[v] ?? 0;
                const isSelected = selectedVariant === v;
                const isOutOfStock = stock <= 0;

                return (
                  <button
                    key={v}
                    type="button"
                    disabled={isOutOfStock}
                    onClick={() => handleVariantChange(v)}
                    className={`p-2.5 rounded-xl border text-left flex items-center justify-between transition ${
                      isSelected
                        ? "bg-rose-50 dark:bg-rose-950/40 border-rose-400 dark:border-rose-600 text-rose-900 dark:text-rose-100 ring-2 ring-rose-500/20"
                        : isOutOfStock
                        ? "opacity-40 cursor-not-allowed bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400"
                        : "bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 hover:border-slate-300 text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    <div>
                      <div className="font-bold text-xs">{meta.label}</div>
                      <div className="text-[10px] text-slate-400">
                        {stock > 0 ? `${stock} in stock` : "0 stock"}
                      </div>
                    </div>
                    {isSelected && (
                      <CheckCircle2 className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quantity Stepper */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                Quantity Broken / Scrapped
              </label>
              <span className="text-[11px] text-slate-400">
                Available: {availableStockForVariant} units
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleQuantityDelta(-1)}
                  disabled={quantity <= 1}
                  className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 flex items-center justify-center font-bold text-slate-700 dark:text-slate-300"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <input
                  type="number"
                  min={1}
                  max={Math.max(1, availableStockForVariant)}
                  value={quantity}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10) || 1;
                    setQuantity(Math.min(Math.max(1, val), Math.max(1, availableStockForVariant)));
                  }}
                  className="w-20 text-center py-2 font-black text-base bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
                <button
                  type="button"
                  onClick={() => handleQuantityDelta(1)}
                  disabled={quantity >= availableStockForVariant}
                  className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 flex items-center justify-center font-bold text-slate-700 dark:text-slate-300"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <div className="text-xs text-rose-600 dark:text-rose-400 font-bold">
                -{quantity} unit will be deducted from {VARIANT_META[selectedVariant].shortName}
              </div>
            </div>
          </div>

          {/* Reason Selection */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
              Scrap Reason
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {REASONS.map((r) => {
                const meta = WASTE_REASON_META[r];
                const isSelected = reason === r;

                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setReason(r)}
                    className={`p-2.5 rounded-xl border text-left transition ${
                      isSelected
                        ? "bg-rose-50 dark:bg-rose-950/40 border-rose-400 dark:border-rose-600 text-rose-900 dark:text-rose-100 ring-2 ring-rose-500/20"
                        : "bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 hover:border-slate-300 text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    <div className="flex items-center gap-2 font-bold text-xs">
                      <span>{meta.icon}</span>
                      <span>{meta.label}</span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">
                      {meta.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Technician Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              Technician Notes (Optional)
            </label>
            <input
              type="text"
              value={technicianNotes}
              onChange={(e) => setTechnicianNotes(e.target.value)}
              placeholder="e.g. Trapped lint under upper camera bezel, cracked on firm press"
              className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
          </div>

          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Footer Actions */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || availableStockForVariant <= 0}
              className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-black transition shadow-lg shadow-rose-500/20 flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Recording Waste...
                </>
              ) : (
                <>
                  <ShieldAlert className="w-4 h-4" />
                  ⚠️ Deduct &amp; Record Waste (-{quantity} {VARIANT_META[selectedVariant].shortName})
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
