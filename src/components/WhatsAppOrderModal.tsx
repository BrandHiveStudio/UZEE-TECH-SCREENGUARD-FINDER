"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import {
  X,
  Phone,
  User,
  Smartphone,
  ShieldCheck,
  Edit2,
  Check,
} from "lucide-react";
import {
  getActiveSupplierNumber,
  setActiveSupplierNumber,
  formatWhatsAppPhone,
  generateWhatsAppOrderUrl,
  WhatsAppOrderDetails,
} from "@/lib/whatsapp";

interface WhatsAppOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialModel?: string;
  initialVariant?: "super_d" | "privacy" | "matte" | "borderless";
  catalogModels?: string[];
}

export function WhatsAppOrderModal({
  isOpen,
  onClose,
  initialModel = "",
  initialVariant = "super_d",
  catalogModels = [],
}: WhatsAppOrderModalProps) {
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [phoneModel, setPhoneModel] = useState(initialModel);
  const [variant, setVariant] = useState<"super_d" | "privacy" | "matte" | "borderless">(initialVariant);
  const [urgency, setUrgency] = useState<"COUNTER_WAITING" | "ADVANCE_ORDER">("COUNTER_WAITING");
  const [notes, setNotes] = useState("");

  // Supplier number editing in header
  const [supplierNumber, setSupplierNumber] = useState("");
  const [isEditingSupplier, setIsEditingSupplier] = useState(false);
  const [tempSupplierInput, setTempSupplierInput] = useState("");

  // Autocomplete dropdown
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const modelInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      const active = getActiveSupplierNumber();
      setSupplierNumber(active);
      setTempSupplierInput(active);
      if (initialModel) setPhoneModel(initialModel);
      if (initialVariant) setVariant(initialVariant);
      setTimeout(() => modelInputRef.current?.focus(), 100);
    }
  }, [isOpen, initialModel, initialVariant]);

  // Model suggestions
  const modelSuggestions = useMemo(() => {
    if (!phoneModel.trim() || !catalogModels.length) return [];
    const q = phoneModel.trim().toLowerCase();
    const matches: string[] = [];
    const seen = new Set<string>();

    for (const m of catalogModels) {
      if (m.toLowerCase().includes(q) && !seen.has(m.toLowerCase())) {
        seen.add(m.toLowerCase());
        matches.push(m);
        if (matches.length >= 8) break;
      }
    }
    return matches;
  }, [phoneModel, catalogModels]);

  if (!isOpen) return null;

  const handleSaveSupplier = () => {
    if (tempSupplierInput.trim()) {
      const sanitized = formatWhatsAppPhone(tempSupplierInput.trim());
      if (sanitized) {
        setActiveSupplierNumber(sanitized);
        setSupplierNumber(sanitized);
        setTempSupplierInput(sanitized);
      }
    }
    setIsEditingSupplier(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneModel.trim()) {
      alert("Please enter the required phone model.");
      return;
    }

    const orderDetails: WhatsAppOrderDetails = {
      customerName,
      customerPhone,
      phoneModel: phoneModel.trim(),
      variant,
      urgency,
      advancePaymentOrNotes: notes,
    };

    const sanitizedSupplier = formatWhatsAppPhone(supplierNumber) || getActiveSupplierNumber();
    const url = generateWhatsAppOrderUrl(orderDetails, sanitizedSupplier);
    window.open(url, "_blank", "noopener,noreferrer");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-[#111827] border border-zinc-200 dark:border-slate-800 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-scale-in">
        {/* Top Header: Thin, elegant banner with vendor WhatsApp badge */}
        <div className="px-5 py-3.5 border-b border-zinc-100 dark:border-slate-800/80 flex items-center justify-between bg-zinc-50/70 dark:bg-[#0E1522]">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-[#25D366] animate-pulse" />
            <h3 className="font-black text-sm text-zinc-900 dark:text-white tracking-tight">
              Dispatch WhatsApp Order
            </h3>
            {/* Vendor WhatsApp Badge */}
            <div className="flex items-center gap-1 ml-1 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/60 text-[10px] font-bold text-emerald-800 dark:text-emerald-300">
              {isEditingSupplier ? (
                <div className="flex items-center gap-1">
                  <span>+</span>
                  <input
                    type="text"
                    value={tempSupplierInput}
                    onChange={(e) => setTempSupplierInput(e.target.value)}
                    className="w-24 px-1 py-0 text-[10px] font-mono bg-white dark:bg-slate-800 text-zinc-900 dark:text-white rounded border border-emerald-300 dark:border-emerald-700 focus:outline-none"
                    placeholder="94770000000"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={handleSaveSupplier}
                    className="text-emerald-700 dark:text-emerald-400 hover:text-emerald-900"
                  >
                    <Check className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <>
                  <span className="font-mono">Vendor: +{supplierNumber || "94770000000"}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setTempSupplierInput(supplierNumber);
                      setIsEditingSupplier(true);
                    }}
                    className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 ml-0.5"
                    title="Edit Vendor WhatsApp"
                  >
                    <Edit2 className="w-2.5 h-2.5" />
                  </button>
                </>
              )}
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-700 dark:text-slate-400 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Subtle WhatsApp green accent line */}
        <div className="h-0.5 bg-[#25D366] w-full" />

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-3.5 overflow-y-auto flex-1">
          {/* Urgency Selector: Compact 2-pill toggle */}
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-zinc-100 dark:bg-[#1E293B] rounded-2xl border border-zinc-200/80 dark:border-slate-700/60">
            <button
              type="button"
              onClick={() => setUrgency("COUNTER_WAITING")}
              className={`py-2 px-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                urgency === "COUNTER_WAITING"
                  ? "bg-brand-600 text-white shadow-sm"
                  : "text-zinc-600 dark:text-slate-400 hover:text-zinc-900 dark:hover:text-white"
              }`}
            >
              <span>🚨</span>
              <span>Customer Waiting</span>
            </button>
            <button
              type="button"
              onClick={() => setUrgency("ADVANCE_ORDER")}
              className={`py-2 px-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                urgency === "ADVANCE_ORDER"
                  ? "bg-slate-800 text-white dark:bg-slate-700 shadow-sm"
                  : "text-zinc-600 dark:text-slate-400 hover:text-zinc-900 dark:hover:text-white"
              }`}
            >
              <span>📋</span>
              <span>Advance Order</span>
            </button>
          </div>

          {/* Phone Model Searchable Input */}
          <div className="space-y-1 relative">
            <label className="text-[11px] font-extrabold uppercase tracking-wider text-zinc-500 dark:text-slate-400 flex items-center gap-1">
              <Smartphone className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
              Phone Model Required *
            </label>
            <input
              ref={modelInputRef}
              type="text"
              required
              placeholder="e.g. Samsung Galaxy A05, Redmi 14C..."
              value={phoneModel}
              onChange={(e) => {
                setPhoneModel(e.target.value);
                setIsModelDropdownOpen(true);
              }}
              onFocus={() => setIsModelDropdownOpen(true)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-[#1E293B] border border-zinc-200 dark:border-slate-700 font-bold text-xs sm:text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#25D366]/30 focus:border-[#25D366]"
            />

            {/* Dropdown Suggestions */}
            {isModelDropdownOpen && modelSuggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-slate-800 border border-zinc-200 dark:border-slate-700 rounded-2xl shadow-xl z-20 max-h-44 overflow-y-auto divide-y divide-zinc-100 dark:divide-slate-700/50">
                {modelSuggestions.map((m, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setPhoneModel(m);
                      setIsModelDropdownOpen(false);
                    }}
                    className="w-full px-3.5 py-2 text-left text-xs font-semibold text-zinc-800 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors flex items-center justify-between"
                  >
                    <span>{m}</span>
                    <span className="text-[10px] text-zinc-400 dark:text-slate-400">In Catalog</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Variant Selector: Horizontal inline chips in one row */}
          <div className="space-y-1">
            <label className="text-[11px] font-extrabold uppercase tracking-wider text-zinc-500 dark:text-slate-400 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              Variant / Finish
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { key: "super_d", icon: "✨", label: "Clear" },
                { key: "privacy", icon: "🕶️", label: "Privacy" },
                { key: "matte", icon: "🌫️", label: "Matte" },
                { key: "borderless", icon: "🔲", label: "Borderless" },
              ].map((v) => {
                const isSelected = variant === v.key;
                return (
                  <button
                    key={v.key}
                    type="button"
                    onClick={() => setVariant(v.key as any)}
                    className={`py-2 px-1 text-center rounded-xl text-[11px] font-bold transition border ${
                      isSelected
                        ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-500 ring-2 ring-emerald-500/20"
                        : "bg-zinc-50 dark:bg-[#1E293B] text-zinc-700 dark:text-slate-300 border-zinc-200 dark:border-slate-700 hover:bg-zinc-100 dark:hover:bg-slate-700/50"
                    }`}
                  >
                    <span className="block text-sm leading-none">{v.icon}</span>
                    <span className="truncate block mt-1">{v.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Customer Details: Side-by-side 2-column flex/grid row */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <label className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 flex items-center gap-1">
                <User className="w-3 h-3" /> Customer Name
              </label>
              <input
                type="text"
                placeholder="Optional (e.g. Kasun)"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-[#1E293B] border border-zinc-200 dark:border-slate-700 text-xs font-medium text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#25D366]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 flex items-center gap-1">
                <Phone className="w-3 h-3" /> Customer Phone
              </label>
              <input
                type="tel"
                placeholder="Optional (077XXXXXXX)"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-[#1E293B] border border-zinc-200 dark:border-slate-700 text-xs font-medium text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#25D366]"
              />
            </div>
          </div>

          {/* Special Notes: Compact single-line input */}
          <div className="space-y-1">
            <label className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">
              Special Notes / Advance Paid
            </label>
            <input
              type="text"
              placeholder="e.g. Rs. 500 advance paid, collect at 5 PM"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-[#1E293B] border border-zinc-200 dark:border-slate-700 text-xs font-medium text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#25D366]"
            />
          </div>

          {/* Footer Action: High-contrast WhatsApp green submit button */}
          <div className="pt-2">
            <button
              type="submit"
              className="w-full py-3 rounded-2xl bg-[#25D366] hover:bg-[#20bd5a] text-white font-black text-xs sm:text-sm shadow-md active:scale-95 transition flex items-center justify-center gap-2"
            >
              <span>✈️</span>
              <span>Send via WhatsApp</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
