"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  FileText,
  Send,
  AlertTriangle,
  Zap,
  TrendingUp,
  Package,
  CheckCircle,
  Search,
  Filter,
  RefreshCw,
  Printer,
  ChevronRight,
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Box, ScreenGuardVariants } from "@/types/screenguard";
import { VARIANT_META } from "@/lib/screenguard";
import { generateSupplierPOWhatsAppUrl, getActiveSupplierNumber } from "@/lib/whatsapp";
import { ThermalLabelModal } from "@/components/ThermalLabelModal";
import { ThemeToggle } from "@/components/ThemeToggle";

export interface RestockCandidate {
  box: Box;
  boxNumber: string;
  title: string;
  displaySize: string;
  currentStock: number;
  variants: ScreenGuardVariants;
  unitsSold: number;
  isFastMover: boolean;
  priority: "CRITICAL" | "HIGH VELOCITY" | "STANDARD";
  suggestedQty: number;
}

export default function RestockHubPage() {
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<"ALL" | "CRITICAL" | "HIGH_VELOCITY" | "STANDARD">("ALL");
  const [customQuantities, setCustomQuantities] = useState<Record<string, number>>({});
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [selectedLabelBox, setSelectedLabelBox] = useState<Box | null>(null);

  // Fetch boxes
  const loadBoxes = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/screenguards?t=" + Date.now(), { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        setBoxes(Array.isArray(json.boxes) ? json.boxes : []);
      }
    } catch (e) {
      console.error("Failed to load inventory for restock", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBoxes();
  }, []);

  // Check if high demand / fast mover
  const isHighDemandLine = (box: Box): boolean => {
    const sold = box.unitsSold ?? 0;
    if (sold >= 3) return true;

    const textToMatch = `${box.title} ${(box.compatibleModels || []).join(" ")}`.toLowerCase();
    const highDemandKeywords = [
      "iphone",
      "galaxy a",
      "redmi note",
      "redmi 13",
      "redmi 14",
      "poco c",
      "poco m",
      "realme c",
      "y20",
      "spark",
      "hot 40",
      "a05",
      "a06",
      "a15",
      "a16",
      "a25",
      "a35",
      "a55",
    ];

    return highDemandKeywords.some((kw) => textToMatch.includes(kw));
  };

  // Compute restock candidates
  const restockCandidates = useMemo<RestockCandidate[]>(() => {
    const list: RestockCandidate[] = [];

    for (const b of boxes) {
      const stock = b.stockQuantity ?? 0;
      const isFast = isHighDemandLine(b);
      const isVerified = b.stockCountVerified ?? false;

      // Restock eligibility:
      // 1. Stock is 0 -> CRITICAL
      // 2. Fast mover with stock < 5 -> HIGH VELOCITY
      // 3. Any item with stock <= 3 -> STANDARD
      let priority: "CRITICAL" | "HIGH VELOCITY" | "STANDARD" | null = null;
      let defaultSuggested = 5;

      if (stock === 0 || b.stockStatus === "OUT_OF_STOCK") {
        priority = "CRITICAL";
        defaultSuggested = isFast ? 20 : 10;
      } else if (isFast && stock < 5) {
        priority = "HIGH VELOCITY";
        defaultSuggested = 15;
      } else if (stock <= 3) {
        priority = "STANDARD";
        defaultSuggested = 10;
      }

      if (priority) {
        const vars: ScreenGuardVariants = b.variants || {
          super_d: stock,
          privacy: 0,
          matte: 0,
          borderless: 0,
        };

        list.push({
          box: b,
          boxNumber: b.boxNumber,
          title: b.title,
          displaySize: b.displaySize || "Universal",
          currentStock: stock,
          variants: vars,
          unitsSold: b.unitsSold ?? 0,
          isFastMover: isFast,
          priority,
          suggestedQty: customQuantities[b.id] ?? defaultSuggested,
        });
      }
    }

    // Sort: CRITICAL first, then HIGH VELOCITY, then STANDARD
    const priorityWeight = { CRITICAL: 3, "HIGH VELOCITY": 2, STANDARD: 1 };
    return list.sort((a, b) => {
      const diff = priorityWeight[b.priority] - priorityWeight[a.priority];
      if (diff !== 0) return diff;
      return a.currentStock - b.currentStock;
    });
  }, [boxes, customQuantities]);

  // Filtered view
  const filteredCandidates = useMemo(() => {
    return restockCandidates.filter((item) => {
      if (priorityFilter === "CRITICAL" && item.priority !== "CRITICAL") return false;
      if (priorityFilter === "HIGH_VELOCITY" && item.priority !== "HIGH VELOCITY") return false;
      if (priorityFilter === "STANDARD" && item.priority !== "STANDARD") return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesBox = item.boxNumber.toLowerCase().includes(q);
        const matchesTitle = item.title.toLowerCase().includes(q);
        const matchesModels = (item.box.compatibleModels || []).some((m) => m.toLowerCase().includes(q));
        if (!matchesBox && !matchesTitle && !matchesModels) return false;
      }

      return true;
    });
  }, [restockCandidates, priorityFilter, searchQuery]);

  // Totals
  const criticalCount = restockCandidates.filter((c) => c.priority === "CRITICAL").length;
  const highVelocityCount = restockCandidates.filter((c) => c.priority === "HIGH VELOCITY").length;
  const totalSuggestedUnits = filteredCandidates.reduce((sum, item) => sum + item.suggestedQty, 0);

  // Update custom qty
  const handleQtyChange = (boxId: string, val: number) => {
    setCustomQuantities((prev) => ({
      ...prev,
      [boxId]: Math.max(1, val),
    }));
  };

  // Download PDF PO
  const handleDownloadPDF = () => {
    if (filteredCandidates.length === 0) {
      alert("No candidates available to generate Purchase Order.");
      return;
    }

    setIsGeneratingPdf(true);
    try {
      const doc = new jsPDF();
      const dateStr = new Date().toISOString().split("T")[0];

      // Document Header
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(24, 24, 27);
      doc.text("UZEE TECH — SCREEN GUARD PURCHASE ORDER", 14, 18);

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 100, 100);
      doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 24);
      doc.text(`Target Vendor WhatsApp: +${getActiveSupplierNumber()}`, 14, 29);
      doc.text(`Total Line Items: ${filteredCandidates.length} | Total Units Ordered: ${totalSuggestedUnits}`, 14, 34);

      // AutoTable data mapping
      const tableHeaders = [
        ["#", "Box Number", "Main Model / Compatible Group", "Cut / Size", "Stock", "Reorder Qty", "Priority"],
      ];

      const tableRows = filteredCandidates.map((item, idx) => [
        (idx + 1).toString(),
        item.boxNumber,
        item.title,
        item.displaySize,
        `${item.currentStock} pcs`,
        `+${item.suggestedQty} pcs`,
        item.priority,
      ]);

      autoTable(doc, {
        head: tableHeaders,
        body: tableRows,
        startY: 38,
        theme: "striped",
        headStyles: {
          fillColor: [15, 23, 42], // Slate-900
          textColor: [255, 255, 255],
          fontStyle: "bold",
          fontSize: 8,
        },
        styles: {
          fontSize: 8,
          cellPadding: 3,
        },
        columnStyles: {
          0: { cellWidth: 10, halign: "center" },
          1: { cellWidth: 24, fontStyle: "bold" },
          2: { cellWidth: "auto" },
          3: { cellWidth: 20 },
          4: { cellWidth: 20, halign: "center" },
          5: { cellWidth: 24, halign: "center", fontStyle: "bold" },
          6: { cellWidth: 28, halign: "center" },
        },
        didParseCell: (data) => {
          if (data.section === "body" && data.column.index === 6) {
            const val = String(data.cell.raw);
            if (val === "CRITICAL") {
              data.cell.styles.textColor = [225, 29, 72]; // Rose-600
              data.cell.styles.fontStyle = "bold";
            } else if (val === "HIGH VELOCITY") {
              data.cell.styles.textColor = [217, 119, 6]; // Amber-600
              data.cell.styles.fontStyle = "bold";
            }
          }
        },
      });

      doc.save(`UZEE_TECH_PURCHASE_ORDER_${dateStr}.pdf`);
    } catch (e) {
      console.error("PDF generation failed", e);
      alert("Failed to generate PDF. Please check browser console.");
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Dispatch WhatsApp Reorder Summary
  const handleDispatchWhatsApp = () => {
    if (filteredCandidates.length === 0) {
      alert("No restock items selected.");
      return;
    }

    const payload = filteredCandidates.map((c) => ({
      boxNumber: c.boxNumber,
      title: c.title,
      currentStock: c.currentStock,
      suggestedQty: c.suggestedQty,
      priority: c.priority,
    }));

    const url = generateSupplierPOWhatsAppUrl(payload);
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 pb-16">
      {/* Top Header Bar */}
      <header className="sticky top-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/admin"
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <h1 className="text-base sm:text-lg font-black tracking-tight leading-tight flex items-center gap-2">
                Smart Restock & Supplier Reorder Hub
                <span className="text-[10px] font-bold uppercase tracking-wider bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 px-2 py-0.5 rounded-full">
                  Velocity-Aware
                </span>
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Automated PO generation & fast vendor WhatsApp dispatch
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadPDF}
              disabled={isGeneratingPdf || filteredCandidates.length === 0}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-black dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-950 font-bold text-xs shadow-sm transition-all"
            >
              <FileText className="w-4 h-4 text-amber-400 dark:text-amber-600" />
              <span>Download PDF PO</span>
            </button>

            <button
              onClick={handleDispatchWhatsApp}
              disabled={filteredCandidates.length === 0}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-white font-medium text-xs shadow-sm transition-all"
            >
              <Send className="w-4 h-4" />
              <span className="hidden sm:inline">Send to Supplier WhatsApp</span>
              <span className="sm:hidden">WhatsApp</span>
            </button>

            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        {/* Metric Cards Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between text-rose-500">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Critical Zero Stock
              </span>
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-rose-600 dark:text-rose-400 mt-1">
              {criticalCount}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">Need immediate replenishment</p>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between text-amber-500">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                High Velocity Lines
              </span>
              <Zap className="w-4 h-4" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-amber-600 dark:text-amber-400 mt-1">
              {highVelocityCount}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">Stock &lt; 5 units</p>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between text-blue-500">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Total Reorder Lines
              </span>
              <Package className="w-4 h-4" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-1">
              {filteredCandidates.length}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">Of {boxes.length} catalog boxes</p>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between text-emerald-500">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Suggested Total Units
              </span>
              <TrendingUp className="w-4 h-4" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
              {totalSuggestedUnits}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">Based on velocity heuristics</p>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          {/* Search */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by box # or model..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500/30"
            />
          </div>

          {/* Priority filter pills */}
          <div className="flex items-center gap-1.5 flex-wrap w-full sm:w-auto">
            {(
              [
                { key: "ALL", label: `All (${restockCandidates.length})` },
                { key: "CRITICAL", label: `Critical (${criticalCount})` },
                { key: "HIGH_VELOCITY", label: `High Velocity (${highVelocityCount})` },
                { key: "STANDARD", label: "Standard (≤ 3)" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setPriorityFilter(tab.key)}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                  priorityFilter === tab.key
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Reorder Table */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-slate-400">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
              <p className="text-xs font-bold">Scanning inventory velocity...</p>
            </div>
          ) : filteredCandidates.length === 0 ? (
            <div className="p-12 text-center text-slate-400 space-y-2">
              <CheckCircle className="w-8 h-8 mx-auto text-emerald-500" />
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                All inventory levels healthy!
              </p>
              <p className="text-xs max-w-sm mx-auto">
                No boxes match the current low-stock reorder thresholds.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-800/50 text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    <th className="py-3.5 px-4">Box #</th>
                    <th className="py-3.5 px-4">Main Model & Cut</th>
                    <th className="py-3.5 px-4">Current Stock</th>
                    <th className="py-3.5 px-4">Priority Status</th>
                    <th className="py-3.5 px-4 text-center">Suggested PO Qty</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                  {filteredCandidates.map((item) => (
                    <tr key={item.box.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                      {/* Box Number */}
                      <td className="py-3.5 px-4 font-black">
                        <span className="px-2.5 py-1 rounded-xl bg-slate-900 text-white text-[11px]">
                          {item.boxNumber}
                        </span>
                      </td>

                      {/* Title & Display Size */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900 dark:text-white line-clamp-1">
                          {item.title}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5">
                          <span className="font-semibold text-brand-600 dark:text-brand-400">
                            Cut: {item.displaySize}
                          </span>
                          <span>•</span>
                          <span>{item.box.compatibleModels?.length || 0} models</span>
                        </div>
                      </td>

                      {/* Current Stock */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 font-bold">
                          <span
                            className={
                              item.currentStock === 0
                                ? "text-rose-600 dark:text-rose-400"
                                : "text-amber-600 dark:text-amber-400"
                            }
                          >
                            {item.currentStock} units
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Clear: {item.variants.super_d} | Priv: {item.variants.privacy} | Mat: {item.variants.matte}
                        </div>
                      </td>

                      {/* Priority Tag */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider border ${
                            item.priority === "CRITICAL"
                              ? "bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800"
                              : item.priority === "HIGH VELOCITY"
                              ? "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800"
                              : "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800"
                          }`}
                        >
                          {item.priority === "CRITICAL" ? "🔴" : item.priority === "HIGH VELOCITY" ? "⚡" : "📦"}{" "}
                          {item.priority}
                        </span>
                      </td>

                      {/* Suggested Reorder Qty (Editable) */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="inline-flex items-center gap-1.5">
                          <input
                            type="number"
                            min="1"
                            max="500"
                            value={item.suggestedQty}
                            onChange={(e) => handleQtyChange(item.box.id, parseInt(e.target.value) || 1)}
                            className="w-16 px-2 py-1 text-center font-black text-xs rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                          />
                          <span className="text-[11px] font-bold text-slate-400">pcs</span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedLabelBox(item.box)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          title="Print Thermal Box Label"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Thermal Label Modal */}
      <ThermalLabelModal
        isOpen={!!selectedLabelBox}
        onClose={() => setSelectedLabelBox(null)}
        box={selectedLabelBox}
      />
    </div>
  );
}

