"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Header } from "@/components/Header";
import { AdminBoxModal } from "@/components/AdminBoxModal";
import { DataQualityModal } from "@/components/DataQualityModal";
import { StockCountModeModal } from "@/components/StockCountModeModal";
import { UserManagementModal } from "@/components/UserManagementModal";
import { BulkImportModal } from "@/components/BulkImportModal";
import { BulkDeleteModal } from "@/components/BulkDeleteModal";
import type { Box } from "@/types/screenguard";
import {
  Package,
  Plus,
  Edit3,
  Trash2,
  ArrowLeft,
  Search,
  Check,
  Smartphone,
  ShieldAlert,
  Download,
  Layers,
  RefreshCw,
  Users,
  MoreHorizontal,
  ChevronDown,
  TrendingUp,
  Copy,
  FileSpreadsheet,
  UploadCloud,
} from "lucide-react";

function getOrderRecommendation(unitsSold: number) {
  if (unitsSold >= 10) {
    return {
      badge: "Suggested Order: 15–20 pcs (Fast Mover 🔥)",
      orderQty: "15–20 pcs",
      badgeClass:
        "bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800",
      isFastMover: true,
    };
  }
  if (unitsSold >= 5) {
    return {
      badge: "Suggested Order: 10 pcs (Steady Seller)",
      orderQty: "10 pcs",
      badgeClass:
        "bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800",
      isFastMover: false,
    };
  }
  return {
    badge: "Suggested Order: 5–10 pcs (Standard Restock)",
    orderQty: "5–10 pcs",
    badgeClass:
      "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700",
    isFastMover: false,
  };
}

export default function AdminPage() {
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Filters & Tabs State ───────────────────────────────────────────────────
  const [searchFilter, setSearchFilter] = useState("");
  const [boxNumberFilter, setBoxNumberFilter] = useState("");
  const [brandFilter, setBrandFilter] = useState("");
  const [displaySizeFilter, setDisplaySizeFilter] = useState("");
  const [groupIdFilter, setGroupIdFilter] = useState("");
  const [verificationFilter, setVerificationFilter] = useState("");
  const [stockStatusFilter, setStockStatusFilter] = useState<
    "ALL" | "IN_STOCK" | "NEEDS_RESTOCK" | "NOT_COUNTED" | "PURCHASE_LIST"
  >("ALL");

  // ── Purchase List State ────────────────────────────────────────────────────
  const [purchaseSort, setPurchaseSort] = useState<"velocity" | "boxNumber">("velocity");
  const [copiedPO, setCopiedPO] = useState(false);

  // ── Modals & Menu State ────────────────────────────────────────────────────
  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isQualityModalOpen, setIsQualityModalOpen] = useState(false);
  const [editingBox, setEditingBox] = useState<Box | null>(null);
  const [saving, setSaving] = useState(false);
  const [isStockCountModalOpen, setIsStockCountModalOpen] = useState(false);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // ── Load all data from API ────────────────────────────────────────────────
  async function fetchData() {
    setLoading(true);
    try {
      const res = await fetch("/api/screenguards?t=" + Date.now(), {
        cache: "no-store",
      });
      if (res.ok) {
        const json = await res.json();
        setBoxes(Array.isArray(json.boxes) ? json.boxes : []);
      }
    } catch (e) {
      console.error("Failed to load admin data", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  // ── Save a box (add or edit) via API ──────────────────────────────────────
  const handleSaveModalBox = async (box: Box) => {
    setSaving(true);
    setSaveStatus("idle");
    try {
      const res = await fetch("/api/screenguards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "upsert", box }),
      });

      if (res.ok) {
        const json = await res.json();
        setBoxes((prev) => {
          const idx = prev.findIndex((b) => b.id === box.id);
          if (idx >= 0) {
            const updated = [...prev];
            updated[idx] = json.box ?? box;
            return updated;
          }
          return [...prev, json.box ?? box];
        });
        setSaveStatus("success");
        setTimeout(() => setSaveStatus("idle"), 3000);
      } else {
        setSaveStatus("error");
      }
    } catch (e) {
      console.error("Upsert failed", e);
      setSaveStatus("error");
    } finally {
      setSaving(false);
    }
  };

  // ── Delete a box via API ────────────────────────────────────────────────────
  const handleDeleteBox = async (boxId: string) => {
    if (!confirm("Are you sure you want to delete this compatibility group?")) return;

    setDeleteId(boxId);
    try {
      const res = await fetch("/api/screenguards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", id: boxId }),
      });

      if (res.ok) {
        setBoxes((prev) => prev.filter((b) => b.id !== boxId));
      } else {
        alert("Delete failed. Please try again.");
      }
    } catch (e) {
      console.error("Delete failed", e);
      alert("Delete failed. Please try again.");
    } finally {
      setDeleteId(null);
    }
  };

  const handleOpenAddModal = () => {
    setEditingBox(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (box: Box) => {
    setEditingBox(box);
    setIsModalOpen(true);
  };

  // ── Download CSV with Inventory & Sales Fields ─────────────────────────────
  const handleDownloadCSV = () => {
    if (boxes.length === 0) {
      alert("No data available to export.");
      return;
    }

    const headers = [
      "Group ID",
      "Box Number",
      "Display Size",
      "Title",
      "Compatible Models",
      "Stock Quantity",
      "Units Sold",
      "Stock Status",
      "Stock Count Verified",
      "Source",
      "Verification",
      "Category",
      "Notes",
    ];

    const csvRows = [headers.join(",")];

    boxes.forEach((b) => {
      const qty = b.stockQuantity ?? 0;
      const sold = b.unitsSold ?? 0;
      const status =
        b.stockStatus || (qty >= 4 ? "IN_STOCK" : qty >= 1 ? "LOW_STOCK" : "OUT_OF_STOCK");
      const verified = b.stockCountVerified ? "YES" : "NO";

      const row = [
        `"${(b.id || "").replace(/"/g, '""')}"`,
        `"${(b.boxNumber || "").replace(/"/g, '""')}"`,
        `"${(b.displaySize || "Unknown").replace(/"/g, '""')}"`,
        `"${(b.title || "").replace(/"/g, '""')}"`,
        `"${(b.compatibleModels || []).join(" | ").replace(/"/g, '""')}"`,
        `"${qty}"`,
        `"${sold}"`,
        `"${status.replace("_", " ")}"`,
        `"${verified}"`,
        `"${(b.source || "").replace(/"/g, '""')}"`,
        `"${(b.verification || "").replace(/"/g, '""')}"`,
        `"${(b.category || "Super-D").replace(/"/g, '""')}"`,
        `"${(b.notes || "").replace(/"/g, '""')}"`,
      ];
      csvRows.push(row.join(","));
    });

    const csvString = csvRows.join("\n");
    const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const dateStr = new Date().toISOString().split("T")[0];
    const filename = `UZEE_TECH_SCREENGUARD_STOCK_${dateStr}.csv`;

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadImportTemplate = () => {
    const link = document.createElement("a");
    link.href = "/api/admin/boxes/template";
    link.download = "screenguards_import_template.csv";
    link.click();
  };

  // ── Focused 4-Card Inventory Statistics ────────────────────────────────────
  const stats = useMemo(() => {
    const totalGroups = boxes.length;
    let inStockCount = 0;
    let needsRestockCount = 0;
    let totalStockCount = 0;
    let notCountedCount = 0;

    boxes.forEach((b) => {
      const qty = b.stockQuantity ?? 0;
      const verified = b.stockCountVerified ?? false;

      if (!verified) {
        notCountedCount++;
        if (qty === 0) {
          needsRestockCount++;
        }
      } else {
        totalStockCount += qty;
        if (qty > 0) {
          inStockCount++;
        }
        if (qty <= 3) {
          needsRestockCount++;
        }
      }
    });

    return {
      totalGroups,
      inStockCount,
      needsRestockCount,
      totalStockCount,
      notCountedCount,
    };
  }, [boxes]);

  // Available unique brands for brand filter
  const availableBrands = useMemo(() => {
    const brandsSet = new Set<string>();
    boxes.forEach((b) => {
      b.compatibleModels.forEach((m) => {
        const firstWord = m.trim().split(" ")[0];
        if (firstWord) {
          brandsSet.add(firstWord);
        }
      });
    });
    return Array.from(brandsSet).sort();
  }, [boxes]);

  // ── Automated Purchase List Calculation & Sorting ──────────────────────────
  const restockBoxes = useMemo(() => {
    return boxes.filter((b) => {
      const qty = b.stockQuantity ?? 0;
      const verified = b.stockCountVerified ?? false;
      return (
        (verified && qty <= 3) ||
        qty === 0 ||
        b.stockStatus === "OUT_OF_STOCK" ||
        b.stockStatus === "LOW_STOCK"
      );
    });
  }, [boxes]);

  const sortedPurchaseList = useMemo(() => {
    const list = [...restockBoxes];
    if (purchaseSort === "velocity") {
      return list.sort((a, b) => (b.unitsSold ?? 0) - (a.unitsSold ?? 0));
    }
    return list.sort((a, b) =>
      a.boxNumber.localeCompare(b.boxNumber, undefined, { numeric: true, sensitivity: "base" })
    );
  }, [restockBoxes, purchaseSort]);

  // Export Purchase Order to formatted WhatsApp text / clipboard
  const handleExportPurchaseOrder = () => {
    if (sortedPurchaseList.length === 0) {
      alert("No boxes currently meet the restock criteria (Stock ≤ 3 units).");
      return;
    }

    const dateStr = new Date().toISOString().split("T")[0];
    const lines = [
      `📦 *UZEE TECH — SCREEN GUARD PURCHASE ORDER*`,
      `📅 Date: ${dateStr}`,
      `📊 Total Boxes to Order: ${sortedPurchaseList.length}`,
      "--------------------------------------------------",
      ...sortedPurchaseList.map((b, idx) => {
        const sold = b.unitsSold ?? 0;
        const rec = getOrderRecommendation(sold);
        const titleOrModel =
          b.title || (b.compatibleModels && b.compatibleModels[0]) || "Screen Guard";
        return `${idx + 1}. [${b.boxNumber}] - ${titleOrModel} - Current Stock: ${
          b.stockQuantity ?? 0
        } - ${rec.badge}`;
      }),
      "--------------------------------------------------",
      `Generated by UZEE TECH ScreenGuard Finder Admin`,
    ];

    const exportText = lines.join("\n");
    navigator.clipboard
      .writeText(exportText)
      .then(() => {
        setCopiedPO(true);
        setTimeout(() => setCopiedPO(false), 3500);
      })
      .catch(() => {
        const blob = new Blob([exportText], { type: "text/plain;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `UZEE_TECH_PURCHASE_ORDER_${dateStr}.txt`;
        a.click();
        URL.revokeObjectURL(url);
      });
  };

  // ── Filtered Boxes for Groups View ─────────────────────────────────────────
  const filteredBoxes = useMemo(() => {
    return boxes.filter((b) => {
      const qty = b.stockQuantity ?? 0;
      const verified = b.stockCountVerified ?? false;

      // Stock status filter tab
      if (stockStatusFilter === "NOT_COUNTED" && verified) return false;
      if (stockStatusFilter === "IN_STOCK" && (!verified || qty <= 0)) return false;
      if (
        stockStatusFilter === "NEEDS_RESTOCK" &&
        !((verified && qty <= 3) || qty === 0)
      ) {
        return false;
      }

      // 1. General search filter
      if (searchFilter.trim()) {
        const q = searchFilter.toLowerCase();
        const matchesGeneral =
          b.id.toLowerCase().includes(q) ||
          b.boxNumber.toLowerCase().includes(q) ||
          (b.displaySize && b.displaySize.toLowerCase().includes(q)) ||
          b.title.toLowerCase().includes(q) ||
          b.compatibleModels.some((m) => m.toLowerCase().includes(q));
        if (!matchesGeneral) return false;
      }

      // 2. Box Number Filter
      if (boxNumberFilter.trim()) {
        const qBox = boxNumberFilter.toLowerCase().trim();
        if (!b.boxNumber.toLowerCase().includes(qBox)) return false;
      }

      // 3. Brand Filter
      if (brandFilter.trim()) {
        const qBrand = brandFilter.toLowerCase();
        const matchesBrand = b.compatibleModels.some((m) =>
          m.toLowerCase().startsWith(qBrand)
        );
        if (!matchesBrand) return false;
      }

      // 4. Display Size Filter
      if (displaySizeFilter.trim()) {
        const qSize = displaySizeFilter.toLowerCase().trim();
        if (!b.displaySize || !b.displaySize.toLowerCase().includes(qSize))
          return false;
      }

      // 5. Group ID Filter
      if (groupIdFilter.trim()) {
        const qId = groupIdFilter.toLowerCase().trim();
        if (!b.id.toLowerCase().includes(qId)) return false;
      }

      // 6. Verification Filter
      if (verificationFilter.trim()) {
        const qVer = verificationFilter.toLowerCase().trim();
        if (!b.verification || !b.verification.toLowerCase().includes(qVer))
          return false;
      }

      return true;
    });
  }, [
    boxes,
    stockStatusFilter,
    searchFilter,
    boxNumberFilter,
    brandFilter,
    displaySizeFilter,
    groupIdFilter,
    verificationFilter,
  ]);

  const resetFilters = () => {
    setStockStatusFilter("ALL");
    setSearchFilter("");
    setBoxNumberFilter("");
    setBrandFilter("");
    setDisplaySizeFilter("");
    setGroupIdFilter("");
    setVerificationFilter("");
  };

  const hasActiveFilters =
    stockStatusFilter !== "ALL" ||
    searchFilter ||
    boxNumberFilter ||
    brandFilter ||
    displaySizeFilter ||
    groupIdFilter ||
    verificationFilter;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      <Header totalBoxes={boxes.length} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Admin Navigation & Consolidate Action Buttons */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 hover:text-brand-700 dark:hover:text-brand-400 hover:bg-slate-100 dark:hover:bg-slate-800 shadow-sm transition-all mb-3 active:scale-95"
            >
              <ArrowLeft className="w-4 h-4 text-brand-700 dark:text-brand-400" />
              <span>← Back to Public Search</span>
            </Link>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
              Admin Compatibility &amp; Inventory Manager
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">
              Super-D Master Dataset (Permanent Group IDs + Verified Stock &amp; Sales Velocity)
            </p>
          </div>

          {/* Action Control Buttons */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* 1. Primary Red: Add Compatibility Group */}
            <button
              onClick={handleOpenAddModal}
              className="px-4 py-2.5 rounded-2xl bg-brand-700 hover:bg-brand-800 text-white font-bold text-xs sm:text-sm shadow-md transition-all flex items-center gap-2 active:scale-95"
            >
              <Plus className="w-4 h-4" /> Add Compatibility Group
            </button>

            {/* 2. Accent Blue: Stock Count Mode */}
            <button
              onClick={() => setIsStockCountModalOpen(true)}
              className="px-4 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm shadow-md transition-all flex items-center gap-2 active:scale-95"
            >
              <Package className="w-4 h-4" /> Stock Count Mode
            </button>

            {/* 3. Grouped Tools Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsToolsOpen(!isToolsOpen)}
                className="px-3.5 py-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs sm:text-sm shadow-sm transition-all flex items-center gap-1.5 active:scale-95 border border-slate-200 dark:border-slate-700"
              >
                <MoreHorizontal className="w-4 h-4" />
                <span>Tools</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform ${isToolsOpen ? "rotate-180" : ""}`}
                />
              </button>

              {isToolsOpen && (
                <>
                  <div
                    className="fixed inset-0 z-20"
                    onClick={() => setIsToolsOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 py-1.5 z-30 animate-in fade-in slide-in-from-top-2 duration-150">
                    <button
                      onClick={() => {
                        setIsToolsOpen(false);
                        setIsQualityModalOpen(true);
                      }}
                      className="w-full text-left px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5 transition-colors"
                    >
                      <ShieldAlert className="w-4 h-4 text-amber-500" />
                      <span>Data Quality &amp; Duplicates</span>
                    </button>

                    <button
                      onClick={() => {
                        setIsToolsOpen(false);
                        handleDownloadCSV();
                      }}
                      className="w-full text-left px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5 transition-colors"
                    >
                      <Download className="w-4 h-4 text-emerald-600" />
                      <span>Download Stock CSV</span>
                    </button>

                    <div className="my-1 border-t border-slate-100 dark:border-slate-800" />

                    <button
                      onClick={() => {
                        setIsToolsOpen(false);
                        handleDownloadImportTemplate();
                      }}
                      className="w-full text-left px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5 transition-colors"
                    >
                      <FileSpreadsheet className="w-4 h-4 text-blue-500" />
                      <span>Download Import Template (CSV)</span>
                    </button>

                    <button
                      onClick={() => {
                        setIsToolsOpen(false);
                        setIsImportModalOpen(true);
                      }}
                      className="w-full text-left px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5 transition-colors"
                    >
                      <UploadCloud className="w-4 h-4 text-brand-700 dark:text-brand-400" />
                      <span>Import Boxes (CSV)</span>
                    </button>

                    <div className="my-1 border-t border-slate-100 dark:border-slate-800" />

                    <button
                      onClick={() => {
                        setIsToolsOpen(false);
                        setIsBulkDeleteModalOpen(true);
                      }}
                      className="w-full text-left px-4 py-2.5 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center gap-2.5 transition-colors"
                    >
                      <Trash2 className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                      <span>Bulk Delete Boxes</span>
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* 4. Top Header: Manage Users */}
            <button
              onClick={() => setIsUserModalOpen(true)}
              className="px-4 py-2.5 rounded-2xl bg-slate-800 dark:bg-slate-700 hover:bg-slate-700 dark:hover:bg-slate-600 text-white font-bold text-xs sm:text-sm shadow-md transition-all flex items-center gap-2 active:scale-95"
            >
              <Users className="w-4 h-4 text-brand-400" /> Manage Users
            </button>

            {/* Save Status Banner */}
            {saveStatus === "success" && (
              <span className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 font-bold text-xs">
                <Check className="w-4 h-4" /> Saved Successfully
              </span>
            )}
            {saveStatus === "error" && (
              <span className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400 font-bold text-xs">
                Save Failed — Try Again
              </span>
            )}
          </div>
        </div>

        {/* Streamlined Metric Cards: Exactly 4 Focused Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total Groups */}
          <button
            onClick={() => setStockStatusFilter("ALL")}
            className={`p-5 rounded-3xl border text-left transition-all flex items-center gap-4 ${
              stockStatusFilter === "ALL"
                ? "bg-white dark:bg-slate-900 border-brand-500 ring-2 ring-brand-500/20 shadow-md"
                : "bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 shadow-sm"
            }`}
          >
            <div className="p-3.5 rounded-2xl bg-brand-50 dark:bg-brand-950 text-brand-700 dark:text-brand-400 shrink-0">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">
                Total Groups
              </p>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white">
                {stats.totalGroups}
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">Master compatibility</p>
            </div>
          </button>

          {/* Card 2: In Stock */}
          <button
            onClick={() => setStockStatusFilter("IN_STOCK")}
            className={`p-5 rounded-3xl border text-left transition-all flex items-center gap-4 ${
              stockStatusFilter === "IN_STOCK"
                ? "bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 ring-2 ring-emerald-500/20 shadow-md"
                : "bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-emerald-300 shadow-sm"
            }`}
          >
            <div className="p-3.5 rounded-2xl bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 shrink-0 font-bold">
              <Check className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">
                In Stock
              </p>
              <h3 className="text-2xl font-black text-emerald-700 dark:text-emerald-400">
                {stats.inStockCount}
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">Verified &gt; 0 units</p>
            </div>
          </button>

          {/* Card 3: Needs Restock */}
          <button
            onClick={() => setStockStatusFilter("NEEDS_RESTOCK")}
            className={`p-5 rounded-3xl border text-left transition-all flex items-center gap-4 ${
              stockStatusFilter === "NEEDS_RESTOCK"
                ? "bg-amber-50 dark:bg-amber-950/60 border-amber-500 ring-2 ring-amber-500/20 shadow-md"
                : "bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-amber-300 shadow-sm"
            }`}
          >
            <div className="p-3.5 rounded-2xl bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 shrink-0">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">
                Needs Restock
              </p>
              <h3 className="text-2xl font-black text-amber-700 dark:text-amber-400">
                {stats.needsRestockCount}
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">Stock ≤ 3 or 0 units</p>
            </div>
          </button>

          {/* Card 4: Total Units on Hand */}
          <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center gap-4">
            <div className="p-3.5 rounded-2xl bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 shrink-0">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">
                Total Units on Hand
              </p>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white">
                {stats.totalStockCount}
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">Counted physical stock</p>
            </div>
          </div>
        </div>

        {/* Filter Bar & Tabs: Streamlined Single Row Layout */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            {/* Tab selector */}
            <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800/80 flex-wrap">
              <button
                onClick={() => setStockStatusFilter("ALL")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  stockStatusFilter === "ALL"
                    ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                All Groups ({boxes.length})
              </button>

              <button
                onClick={() => setStockStatusFilter("IN_STOCK")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  stockStatusFilter === "IN_STOCK"
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "text-slate-500 hover:text-emerald-600"
                }`}
              >
                In Stock ({stats.inStockCount})
              </button>

              <button
                onClick={() => setStockStatusFilter("NEEDS_RESTOCK")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  stockStatusFilter === "NEEDS_RESTOCK"
                    ? "bg-amber-500 text-white shadow-sm"
                    : "text-slate-500 hover:text-amber-500"
                }`}
              >
                Needs Restock ({stats.needsRestockCount})
              </button>

              <button
                onClick={() => setStockStatusFilter("NOT_COUNTED")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  stockStatusFilter === "NOT_COUNTED"
                    ? "bg-slate-700 text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                Not Counted ({stats.notCountedCount})
              </button>

              <button
                onClick={() => setStockStatusFilter("PURCHASE_LIST")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  stockStatusFilter === "PURCHASE_LIST"
                    ? "bg-brand-700 text-white shadow-sm"
                    : "text-slate-500 hover:text-brand-700"
                }`}
              >
                🛒 Purchase List ({sortedPurchaseList.length})
              </button>
            </div>

            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                className="text-xs font-semibold text-brand-700 dark:text-brand-400 hover:underline flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" /> Reset Filters
              </button>
            )}
          </div>

          {stockStatusFilter !== "PURCHASE_LIST" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-1">
              {/* General Search */}
              <div className="relative lg:col-span-2">
                <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                <input
                  type="text"
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  placeholder="Search model, box, title..."
                  className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-700/30"
                />
              </div>

              {/* Box Number */}
              <div>
                <input
                  type="text"
                  value={boxNumberFilter}
                  onChange={(e) => setBoxNumberFilter(e.target.value)}
                  placeholder="Box (e.g. BOX 041)"
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-700/30"
                />
              </div>

              {/* Brand Dropdown */}
              <div>
                <select
                  value={brandFilter}
                  onChange={(e) => setBrandFilter(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-700/30"
                >
                  <option value="">All Brands</option>
                  {availableBrands.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>

              {/* Display Size */}
              <div>
                <input
                  type="text"
                  value={displaySizeFilter}
                  onChange={(e) => setDisplaySizeFilter(e.target.value)}
                  placeholder='Size (e.g. 6.7")'
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-700/30"
                />
              </div>
            </div>
          )}
        </div>

        {/* Main Content Area: Automated Purchase List vs Groups Table */}
        {stockStatusFilter === "PURCHASE_LIST" ? (
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 space-y-6">
            {/* Header & Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <span>🛒 Automated Purchase Recommendations</span>
                  <span className="px-2.5 py-0.5 rounded-full bg-brand-100 dark:bg-brand-950/80 text-brand-700 dark:text-brand-400 text-xs font-bold">
                    {sortedPurchaseList.length} boxes need restock
                  </span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Automatically queries all boxes meeting restock criteria (Stock ≤ 3 units or 0 units).
                  Reorder quantities calculated from historical sales velocity.
                </p>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                {/* Sort Toggle */}
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                  <button
                    onClick={() => setPurchaseSort("velocity")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                      purchaseSort === "velocity"
                        ? "bg-white dark:bg-slate-900 text-brand-700 dark:text-brand-400 shadow-sm"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                    }`}
                  >
                    <TrendingUp className="w-3.5 h-3.5" />
                    <span>Velocity (Most Sold)</span>
                  </button>
                  <button
                    onClick={() => setPurchaseSort("boxNumber")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                      purchaseSort === "boxNumber"
                        ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                    }`}
                  >
                    <span>Box # (Asc)</span>
                  </button>
                </div>

                {/* Export Purchase Order Button */}
                <button
                  onClick={handleExportPurchaseOrder}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition-all flex items-center gap-2 active:scale-95"
                >
                  {copiedPO ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Copied to Clipboard!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Export Purchase Order</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {sortedPurchaseList.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <Check className="w-10 h-10 mx-auto text-emerald-500 mb-2 opacity-80" />
                <h4 className="font-bold text-slate-700 dark:text-slate-300">
                  All Stock Verified &amp; Healthy
                </h4>
                <p className="text-xs text-slate-500 mt-1">
                  No boxes currently meet the restock threshold (Stock ≤ 3 units).
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {sortedPurchaseList.map((box) => {
                  const sold = box.unitsSold ?? 0;
                  const qty = box.stockQuantity ?? 0;
                  const rec = getOrderRecommendation(sold);

                  return (
                    <div
                      key={box.id}
                      className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 flex flex-col justify-between gap-4 hover:border-slate-300 dark:hover:border-slate-600 transition-all shadow-sm"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2">
                            <span className="px-3 py-1 bg-brand-700 text-white rounded-xl font-black text-sm tracking-wide">
                              {box.boxNumber}
                            </span>
                            <span className="px-2 py-0.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold">
                              {box.displaySize || "Unknown"}
                            </span>
                          </div>

                          {/* Units Sold Velocity Badge */}
                          <div className="flex items-center gap-1 text-xs font-bold text-slate-600 dark:text-slate-400">
                            <TrendingUp className="w-3.5 h-3.5 text-blue-500" />
                            <span>{sold} Units Sold</span>
                          </div>
                        </div>

                        <div>
                          <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                            {box.title || box.id}
                          </h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                            {box.compatibleModels.join(", ")}
                          </p>
                        </div>

                        {/* Dynamic Suggested Order Badge */}
                        <div className="pt-1">
                          <span
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black border ${rec.badgeClass}`}
                          >
                            {rec.badge}
                          </span>
                        </div>
                      </div>

                      {/* Bottom Row: Current Stock & Restock Quick Actions */}
                      <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-700/60">
                        <div className="text-xs">
                          <span className="text-slate-400 font-semibold">Current Stock: </span>
                          <span
                            className={`font-black ${
                              qty === 0 ? "text-rose-600" : "text-amber-600"
                            }`}
                          >
                            {qty} {qty === 1 ? "unit" : "units"}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={async () => {
                              await fetch("/api/inventory", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  action: "update_stock",
                                  groupId: box.id,
                                  stockAction: "RESTOCK",
                                  amount: 10,
                                }),
                              });
                              fetchData();
                            }}
                            className="px-3 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors"
                            title="Quick restock +10"
                          >
                            +10 Restock
                          </button>
                          <button
                            onClick={() => handleOpenEditModal(box)}
                            className="p-1.5 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 text-xs transition-colors"
                            title="Edit Box"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* Groups Results List */
          loading ? (
            <div className="text-center py-12 text-slate-400 font-semibold">
              Loading Super-D Master compatibility groups…
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400 px-1">
                <span>
                  Showing {filteredBoxes.length} of {boxes.length} Groups
                </span>
              </div>

              {filteredBoxes.length === 0 ? (
                <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 text-slate-400 font-semibold">
                  No matching compatibility groups found. Try resetting filters.
                </div>
              ) : (
                filteredBoxes.map((box) => {
                  const qty = box.stockQuantity ?? 0;
                  const sold = box.unitsSold ?? 0;
                  const ver = box.stockCountVerified ?? false;
                  const st =
                    box.stockStatus ||
                    (ver
                      ? qty >= 4
                        ? "IN_STOCK"
                        : qty >= 1
                        ? "LOW_STOCK"
                        : "OUT_OF_STOCK"
                      : "NOT_COUNTED");

                  return (
                    <div
                      key={box.id}
                      className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
                    >
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className="px-2.5 py-0.5 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-lg font-black text-xs">
                            {box.id}
                          </span>
                          <span className="px-3 py-1 bg-brand-700 text-white rounded-xl font-black text-sm tracking-wide">
                            {box.boxNumber}
                          </span>
                          <span className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-bold text-xs border border-slate-200/60 dark:border-slate-700/60 flex items-center gap-1">
                            <Smartphone className="w-3.5 h-3.5 text-brand-700 dark:text-brand-400" />
                            <span>{box.displaySize || "Unknown"}</span>
                          </span>

                          {/* Stock & Sales Column */}
                          <div className="flex items-center gap-3">
                            <div className="flex flex-col">
                              <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400">
                                STOCK
                              </span>
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-black text-slate-900 dark:text-white">
                                  {ver ? `${qty} units` : "Not Counted"}
                                </span>
                                <span
                                  className={`px-2 py-0.5 rounded-md text-[10px] font-black tracking-wider uppercase border ${
                                    st === "IN_STOCK"
                                      ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-800"
                                      : st === "LOW_STOCK"
                                      ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-800"
                                      : st === "NOT_COUNTED"
                                      ? "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700"
                                      : "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-400 dark:border-rose-800"
                                  }`}
                                >
                                  {st === "IN_STOCK"
                                    ? "IN STOCK"
                                    : st === "LOW_STOCK"
                                    ? "LOW STOCK"
                                    : st === "NOT_COUNTED"
                                    ? "NOT COUNTED"
                                    : "OUT OF STOCK"}
                                </span>
                              </div>
                            </div>

                            {/* Velocity */}
                            <div className="flex flex-col border-l border-slate-200 dark:border-slate-700 pl-3">
                              <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400">
                                VELOCITY
                              </span>
                              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                                <TrendingUp className="w-3 h-3 text-blue-500" />
                                {sold} sold
                              </span>
                            </div>
                          </div>

                          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                            {box.title}
                          </h3>
                        </div>

                        <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-2">
                          {box.compatibleModels.map((m, idx) => (
                            <span
                              key={idx}
                              className="px-2.5 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-medium text-slate-600 dark:text-slate-300"
                            >
                              {m}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Quick Stock Controls on row & Edit */}
                      <div className="flex items-center gap-2 shrink-0 flex-wrap border-t md:border-t-0 border-slate-100 dark:border-slate-800 pt-3 md:pt-0">
                        <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800/80 px-2.5 py-1.5 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                          <button
                            onClick={async () => {
                              if (qty <= 0 || !ver) return;
                              await fetch("/api/inventory", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  action: "update_stock",
                                  groupId: box.id,
                                  stockAction: "SALE",
                                  amount: 1,
                                }),
                              });
                              fetchData();
                            }}
                            disabled={qty <= 0 || !ver}
                            className="w-7 h-7 flex items-center justify-center bg-rose-500 text-white rounded-lg font-black text-sm hover:bg-rose-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            title={
                              !ver
                                ? "Stock must be physically counted first"
                                : "Record 1 unit sold (increments units_sold)"
                            }
                          >
                            −
                          </button>
                          <span className="text-sm font-black px-2 min-w-[24px] text-center text-slate-900 dark:text-white">
                            {ver ? qty : "?"}
                          </span>
                          <button
                            onClick={async () => {
                              await fetch("/api/inventory", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  action: "update_stock",
                                  groupId: box.id,
                                  stockAction: "RESTOCK",
                                  amount: 5,
                                }),
                              });
                              fetchData();
                            }}
                            className="w-7 h-7 flex items-center justify-center bg-emerald-600 text-white rounded-lg font-black text-sm hover:bg-emerald-700 transition-colors"
                            title="Quick restock +5"
                          >
                            +
                          </button>
                        </div>

                        <button
                          onClick={() => handleOpenEditModal(box)}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold transition-colors"
                        >
                          <Edit3 className="w-3.5 h-3.5" /> Edit
                        </button>

                        <button
                          onClick={() => handleDeleteBox(box.id)}
                          disabled={deleteId === box.id}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 text-xs font-semibold transition-colors disabled:opacity-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          {deleteId === box.id ? "Deleting…" : "Delete"}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )
        )}
      </main>

      <AdminBoxModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveModalBox}
        initialBox={editingBox}
        existingBoxCount={boxes.length}
      />

      <DataQualityModal
        isOpen={isQualityModalOpen}
        onClose={() => setIsQualityModalOpen(false)}
        boxes={boxes}
      />

      <StockCountModeModal
        isOpen={isStockCountModalOpen}
        onClose={() => setIsStockCountModalOpen(false)}
        boxes={boxes}
        onComplete={fetchData}
      />

      <UserManagementModal
        isOpen={isUserModalOpen}
        onClose={() => setIsUserModalOpen(false)}
      />

      <BulkImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={fetchData}
      />

      <BulkDeleteModal
        isOpen={isBulkDeleteModalOpen}
        onClose={() => setIsBulkDeleteModalOpen(false)}
        onSuccess={fetchData}
      />
    </div>
  );
}
