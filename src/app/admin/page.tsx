"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { AdminSidebar, type AdminView } from "@/components/AdminSidebar";
import { AdminBoxModal } from "@/components/AdminBoxModal";
import { DataQualityModal } from "@/components/DataQualityModal";
import { StockCountModeModal } from "@/components/StockCountModeModal";
import { UserManagementModal } from "@/components/UserManagementModal";
import { BulkImportModal } from "@/components/BulkImportModal";
import { BulkDeleteModal } from "@/components/BulkDeleteModal";
import { UndoToast, type UndoToastItem } from "@/components/UndoToast";
import { SessionAuditDrawer, type SessionAuditLog } from "@/components/SessionAuditDrawer";
import { ThermalLabelModal } from "@/components/ThermalLabelModal";
import { A4LabelPrintModal } from "@/components/A4LabelPrintModal";
import { WhatsAppOrderModal } from "@/components/WhatsAppOrderModal";
import { DatabaseMigrationModal } from "@/components/DatabaseMigrationModal";
import { SnapshotViewerModal } from "@/components/SnapshotViewerModal";
import { FastPasteManifestModal } from "@/components/FastPasteManifestModal";
import { WasteTrackerModal } from "@/components/WasteTrackerModal";
import { inferGeometryProfile, NOTCH_META, EDGE_META } from "@/lib/geometryGuard";
import {
  type WasteLogEntry,
  type WasteStats,
  WASTE_REASON_META,
} from "@/lib/wasteLog";
import { getNextBoxSequence, normalizeVariants, calculateTotalStock, type VariantKey, VARIANT_META } from "@/lib/screenguard";
import { matchesBox } from "@/lib/searchNormalizer";
import type { Box, ScreenGuardVariants } from "@/types/screenguard";
import {
  Package,
  Plus,
  Edit3,
  Trash2,
  Search,
  Check,
  ShieldAlert,
  Download,
  Copy,
  Printer,
  FileText,
  AlertTriangle,
  FolderArchive,
  ClipboardList,
  KeyRound,
  Lock,
  CheckCircle2,
  ChevronDown,
  Layers,
  Receipt,
} from "lucide-react";

export default function AdminPage() {
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [loading, setLoading] = useState(true);
  const [adminView, setAdminView] = useState<AdminView>("inventory");

  // ── Filters State ──────────────────────────────────────────────────────────
  const [searchFilter, setSearchFilter] = useState("");
  const [boxNumberFilter, setBoxNumberFilter] = useState("");
  const [brandFilter, setBrandFilter] = useState("");
  const [sizeFilter, setSizeFilter] = useState("");
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
  const [, setSaving] = useState(false);
  const [isStockCountModalOpen, setIsStockCountModalOpen] = useState(false);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [, setSaveStatus] = useState<"idle" | "success" | "error">("idle");
  const [, setDeleteId] = useState<string | null>(null);

  // ── Retail Workflow Feature Modals ─────────────────────────────────────────
  const [selectedThermalBox, setSelectedThermalBox] = useState<Box | null>(null);
  const [isThermalStudioOpen, setIsThermalStudioOpen] = useState(false);
  const [isA4ModalOpen, setIsA4ModalOpen] = useState(false);
  const [a4InitialBox, setA4InitialBox] = useState<Box | null>(null);
  const [isFastPasteModalOpen, setIsFastPasteModalOpen] = useState(false);
  const [wasteTargetBox, setWasteTargetBox] = useState<Box | null>(null);
  const [isWasteModalOpen, setIsWasteModalOpen] = useState(false);
  const [wasteLogs, setWasteLogs] = useState<WasteLogEntry[]>([]);
  const [wasteStats, setWasteStats] = useState<WasteStats | null>(null);

  // ── Terminal Security Settings State ───────────────────────────────────────
  const [authLength, setAuthLength] = useState<4 | 6>(6);
  const [, setRecoveryEmail] = useState("uzeetechcare@gmail.com");
  const [newPasscode, setNewPasscode] = useState("");
  const [confirmPasscode, setConfirmPasscode] = useState("");
  const [securityStatus, setSecurityStatus] = useState<string | null>(null);
  const [isUpdatingSecurity, setIsUpdatingSecurity] = useState(false);

  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);
  const [whatsAppTargetModel, setWhatsAppTargetModel] = useState("");
  const [isMigrationModalOpen, setIsMigrationModalOpen] = useState(false);
  const [isSnapshotViewerOpen, setIsSnapshotViewerOpen] = useState(false);

  // ── Session Audit Log & Undo Toast State ──────────────────────────────────
  const [undoToast, setUndoToast] = useState<UndoToastItem | null>(null);
  const [sessionLogs, setSessionLogs] = useState<SessionAuditLog[]>([]);
  const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState(false);

  const addAuditLog = (logItem: Omit<SessionAuditLog, "id" | "timestamp">) => {
    const fullLog: SessionAuditLog = {
      ...logItem,
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: Date.now(),
    };
    setSessionLogs((prev) => [fullLog, ...prev].slice(0, 25));
  };

  // ── Load all data from API ────────────────────────────────────────────────
  async function fetchData() {
    setLoading(true);
    try {
      const res = await fetch("/api/screenguards?t=" + Date.now(), { cache: "no-store" });
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

  // ── Load waste logs & shrinkage stats ─────────────────────────────────────
  async function fetchWasteData() {
    try {
      const res = await fetch("/api/admin/waste-log?t=" + Date.now(), { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        setWasteLogs(Array.isArray(json.logs) ? json.logs : []);
        setWasteStats(json.stats || null);
      }
    } catch (e) {
      console.error("Failed to load waste data", e);
    }
  }

  // ── Load terminal authentication settings ───────────────────────────────────
  async function fetchAuthSettings() {
    try {
      const res = await fetch("/api/admin/auth-settings?t=" + Date.now(), { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        if (json.settings) {
          setAuthLength(json.settings.passcodeLength || 6);
          setRecoveryEmail(json.settings.recoveryEmail || "uzeetechcare@gmail.com");
        }
      }
    } catch (e) {
      console.error("Failed to load auth settings", e);
    }
  }

  useEffect(() => {
    fetchData();
    fetchWasteData();
    fetchAuthSettings();
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
      console.error("Delete error", e);
      alert("Delete request failed.");
    } finally {
      setDeleteId(null);
    }
  };

  // ── Stepper stock increment / decrement ────────────────────────────────────
  const handleStepStock = async (box: Box, delta: number) => {
    const currentStock = box.stockQuantity ?? 0;
    const newStock = Math.max(0, currentStock + delta);
    if (currentStock === newStock && delta <= 0) return;

    const prevVars = normalizeVariants(box.variants, currentStock);
    const updatedVariants: ScreenGuardVariants = {
      ...prevVars,
      super_d: Math.max(0, (prevVars.super_d ?? 0) + delta),
    };
    const calculatedStock = calculateTotalStock(updatedVariants);
    const finalStock = delta > 0 ? (calculatedStock > newStock ? calculatedStock : newStock) : newStock;
    const newStatus = finalStock > 0 ? (finalStock <= 3 ? "LOW_STOCK" : "IN_STOCK") : "OUT_OF_STOCK";

    const updatedBox: Box = {
      ...box,
      variants: updatedVariants,
      stockQuantity: finalStock,
      stockCountVerified: true,
      stockStatus: newStatus,
    };

    setBoxes((prev) => prev.map((b) => (b.id === box.id ? updatedBox : b)));

    try {
      await fetch("/api/screenguards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "upsert", box: updatedBox }),
      });
      addAuditLog({
        type: "STOCK_STEP",
        boxNumber: box.boxNumber,
        description: `Stock ${delta > 0 ? "+" : ""}${delta} on ${box.boxNumber} (${finalStock} total)`,
        previousValue: String(currentStock),
        newValue: String(finalStock),
      });
    } catch (err) {
      console.error("Failed to step stock", err);
      setBoxes((prev) => prev.map((b) => (b.id === box.id ? box : b)));
    }
  };

  // ── Stepper controls for variants ──────────────────────────────────────────
  const handleStepVariantStock = async (
    box: Box,
    variantKey: VariantKey,
    delta: number
  ) => {
    const rawStock = box.stockQuantity ?? 0;
    const prevVariants = normalizeVariants(box.variants, rawStock);
    const currentVal = prevVariants[variantKey] ?? 0;
    const updatedVal = Math.max(0, currentVal + delta);
    if (currentVal === updatedVal) return;

    const updatedVariants: ScreenGuardVariants = {
      ...prevVariants,
      [variantKey]: updatedVal,
    };
    const newTotalStock = calculateTotalStock(updatedVariants);
    const newStatus = newTotalStock > 0 ? (newTotalStock <= 3 ? "LOW_STOCK" : "IN_STOCK") : "OUT_OF_STOCK";

    const updatedBox: Box = {
      ...box,
      variants: updatedVariants,
      stockQuantity: newTotalStock,
      stockCountVerified: true,
      stockStatus: newStatus,
    };

    setBoxes((prev) => prev.map((b) => (b.id === box.id ? updatedBox : b)));

    try {
      await fetch("/api/screenguards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "upsert", box: updatedBox }),
      });
    } catch (err) {
      console.error("Failed to step variant stock", err);
      setBoxes((prev) => prev.map((b) => (b.id === box.id ? box : b)));
    }
  };

  // ── Fast-Paste Inward Manifest Batch Commit ───────────────────────────────
  const handleCommitManifest = async (
    items: Array<{ boxNumber: string; variant: VariantKey; quantity: number }>
  ) => {
    let totalUnits = 0;
    const rollbackSnapshots: Array<{ id: string; box: Box }> = [];

    for (const item of items) {
      const targetBox = boxes.find(
        (b) => b.boxNumber.trim().toLowerCase() === item.boxNumber.trim().toLowerCase()
      );
      if (!targetBox) continue;

      rollbackSnapshots.push({ id: targetBox.id, box: { ...targetBox } });

      const prevVars = normalizeVariants(targetBox.variants, targetBox.stockQuantity ?? 0);
      const varKey = item.variant as keyof ScreenGuardVariants;
      const updatedVars: ScreenGuardVariants = {
        ...prevVars,
        [varKey]: (prevVars[varKey] ?? 0) + item.quantity,
      };
      const newTotal = calculateTotalStock(updatedVars);

      const updatedBox: Box = {
        ...targetBox,
        variants: updatedVars,
        stockQuantity: newTotal,
        stockCountVerified: true,
        stockStatus: newTotal > 0 ? "IN_STOCK" : "OUT_OF_STOCK",
      };

      try {
        await fetch("/api/screenguards", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "upsert", box: updatedBox }),
        });
        totalUnits += item.quantity;
      } catch (err) {
        console.error("Failed to update box from manifest", err);
      }
    }

    await fetchData();

    const rollbackManifest = async () => {
      for (const snap of rollbackSnapshots) {
        await fetch("/api/screenguards", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "upsert", box: snap.box }),
        });
      }
      await fetchData();
    };

    setUndoToast({
      id: `manifest-undo-${Date.now()}`,
      message: `Inwarded +${totalUnits} units across ${items.length} lines via Fast-Paste Manifest`,
      onUndo: rollbackManifest,
    });
  };

  // ── Waste Recording Callback ──────────────────────────────────────────────
  const handleWasteRecorded = async (updatedBox: Box, log: WasteLogEntry) => {
    await fetchData();
    await fetchWasteData();

    const previousBox = boxes.find((b) => b.id === updatedBox.id);

    const rollbackWaste = async () => {
      if (previousBox) {
        await fetch("/api/screenguards", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "upsert", box: previousBox }),
        });
        await fetchData();
        await fetchWasteData();
      }
    };

    setUndoToast({
      id: `waste-undo-${Date.now()}`,
      message: `Recorded -${log.quantity} ${VARIANT_META[log.variant]?.shortName || log.variant} waste on ${log.boxNumber}`,
      onUndo: rollbackWaste,
    });
  };

  // ── Update Terminal Passcode or Length ─────────────────────────────────────
  const handleUpdateSecurity = async (e: React.FormEvent) => {
    e.preventDefault();
    setSecurityStatus(null);
    if (!newPasscode) {
      setSecurityStatus("Please enter a new PIN.");
      return;
    }
    if (newPasscode !== confirmPasscode) {
      setSecurityStatus("PIN confirmation does not match.");
      return;
    }
    const regex = authLength === 4 ? /^\d{4}$/ : /^\d{6}$/;
    if (!regex.test(newPasscode)) {
      setSecurityStatus(`PIN must be exactly ${authLength} numeric digits.`);
      return;
    }

    setIsUpdatingSecurity(true);
    try {
      const res = await fetch("/api/admin/auth-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newPasscode,
          passcodeLength: authLength,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update passcode");
      }
      setSecurityStatus(`SUCCESS: Terminal PIN updated to ${authLength}-digit passcode.`);
      setNewPasscode("");
      setConfirmPasscode("");
      await fetchAuthSettings();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error updating PIN";
      setSecurityStatus(`ERROR: ${msg}`);
    } finally {
      setIsUpdatingSecurity(false);
    }
  };

  const handleTogglePasscodeLength = async (newLen: 4 | 6) => {
    setAuthLength(newLen);
    try {
      await fetch("/api/admin/auth-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcodeLength: newLen }),
      });
      await fetchAuthSettings();
    } catch (e) {
      console.error("Failed to toggle passcode length", e);
    }
  };

  const handleResetDefaultPasscode = async () => {
    if (!window.confirm("Reset terminal PIN to default '123456'?")) return;
    setIsUpdatingSecurity(true);
    try {
      await fetch("/api/admin/auth-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newPasscode: "123456",
          passcodeLength: 6,
        }),
      });
      setAuthLength(6);
      setSecurityStatus("SUCCESS: Terminal PIN reset to default '123456' (6 digits).");
      await fetchAuthSettings();
    } catch {
      setSecurityStatus("ERROR: Failed to reset passcode.");
    } finally {
      setIsUpdatingSecurity(false);
    }
  };

  const handleDownloadWasteCSV = () => {
    if (wasteLogs.length === 0) return;
    const headers = ["Timestamp", "Date", "Box Number", "Model", "Variant", "Quantity", "Reason", "Technician Notes", "Recorded By"];
    const rows = wasteLogs.map((l) => [
      l.timestamp,
      new Date(l.timestamp).toISOString(),
      l.boxNumber,
      `"${(l.modelName || "").replace(/"/g, '""')}"`,
      l.variant,
      l.quantity,
      `"${(WASTE_REASON_META[l.reason]?.label || l.reason).replace(/"/g, '""')}"`,
      `"${(l.technicianNotes || "").replace(/"/g, '""')}"`,
      l.recordedBy || "Counter Staff",
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `UZEE_TECH_WASTE_SHRINKAGE_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadCSV = () => {
    if (boxes.length === 0) return;
    const headers = [
      "Group ID", "Box Number", "Display Size", "Title", "Compatible Models",
      "Stock Quantity", "Units Sold", "Stock Status", "Stock Count Verified"
    ];
    const csvRows = [headers.join(",")];
    for (const b of boxes) {
      csvRows.push([
        `"${b.id}"`,
        `"${b.boxNumber}"`,
        `"${b.displaySize || ""}"`,
        `"${(b.title || "").replace(/"/g, '""')}"`,
        `"${(b.compatibleModels || []).join(" | ").replace(/"/g, '""')}"`,
        b.stockQuantity ?? 0,
        b.unitsSold ?? 0,
        `"${b.stockStatus || ""}"`,
        `"${b.stockCountVerified ? "YES" : "NO"}"`,
      ].join(","));
    }
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `screenguards_inventory_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // ── Stats calculation ──────────────────────────────────────────────────────
  const stats = useMemo(() => {
    let inStockCount = 0;
    let needsRestockCount = 0;
    let notCountedCount = 0;
    let totalUnits = 0;

    boxes.forEach((b) => {
      const qty = b.stockQuantity ?? 0;
      totalUnits += qty;
      const verified = b.stockCountVerified ?? false;

      if (!verified) {
        notCountedCount++;
        if (qty === 0) needsRestockCount++;
      } else {
        if (qty > 0) inStockCount++;
        if (qty <= 3) needsRestockCount++;
      }
    });

    return {
      totalGroups: boxes.length,
      inStockCount,
      needsRestockCount,
      notCountedCount,
      totalUnits,
    };
  }, [boxes]);

  const availableBrands = useMemo(() => {
    const brandsSet = new Set<string>();
    boxes.forEach((b) => {
      b.compatibleModels.forEach((m) => {
        const firstWord = m.trim().split(" ")[0];
        if (firstWord) brandsSet.add(firstWord);
      });
    });
    return Array.from(brandsSet).sort();
  }, [boxes]);

  // ── Filtered Boxes for High-Density Card View ──────────────────────────────
  const filteredBoxes = useMemo(() => {
    return boxes.filter((b) => {
      const qty = b.stockQuantity ?? 0;
      const verified = b.stockCountVerified ?? false;

      if (stockStatusFilter === "NOT_COUNTED" && verified) return false;
      if (stockStatusFilter === "IN_STOCK" && (!verified || qty <= 0)) return false;
      if (stockStatusFilter === "NEEDS_RESTOCK" && !((verified && qty <= 3) || qty === 0)) return false;
      if (stockStatusFilter === "PURCHASE_LIST" && qty > 3) return false;

      // Filter by Box Number input
      if (boxNumberFilter.trim()) {
        const bnQ = boxNumberFilter.trim().toLowerCase().replace(/^box\s*/i, "");
        const bNumDigits = b.boxNumber.replace(/\D/g, "");
        if (!b.boxNumber.toLowerCase().includes(bnQ) && !bNumDigits.includes(bnQ)) {
          return false;
        }
      }

      // Filter by Display Size
      if (sizeFilter.trim()) {
        const sQ = sizeFilter.trim().toLowerCase().replace(/["”]/g, "");
        const dSize = (b.displaySize || "").toLowerCase().replace(/["”]/g, "");
        if (!dSize.includes(sQ)) {
          return false;
        }
      }

      return matchesBox(b, searchFilter, brandFilter);
    });
  }, [boxes, stockStatusFilter, brandFilter, searchFilter, boxNumberFilter, sizeFilter]);

  // ── Purchase Order List ───────────────────────────────────────────────────
  const purchaseOrderBoxes = useMemo(() => {
    const needs = boxes.filter((b) => {
      const qty = b.stockQuantity ?? 0;
      const verified = b.stockCountVerified ?? false;
      return (verified && qty <= 3) || qty === 0;
    });

    return [...needs].sort((a, b) => {
      if (purchaseSort === "velocity") {
        return (b.unitsSold ?? 0) - (a.unitsSold ?? 0);
      }
      return a.boxNumber.localeCompare(b.boxNumber, undefined, { numeric: true });
    });
  }, [boxes, purchaseSort]);

  const handleExportPO = () => {
    if (purchaseOrderBoxes.length === 0) return;
    const headers = ["Box Number", "Model Series", "Display Size", "Current Stock", "Sales Velocity", "Suggested Order Qty", "Compatible Models"];
    const rows = purchaseOrderBoxes.map((b) => {
      const qty = b.stockQuantity ?? 0;
      const velocity = b.unitsSold ?? 0;
      const suggested = velocity > 5 ? 15 : 10;
      return [
        `"${b.boxNumber}"`,
        `"${(b.title || "").replace(/"/g, '""')}"`,
        `"${b.displaySize || ""}"`,
        qty,
        velocity,
        suggested,
        `"${(b.compatibleModels || []).join(" | ").replace(/"/g, '""')}"`,
      ];
    });
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `UZEE_TECH_PURCHASE_ORDER_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyPO = async () => {
    if (purchaseOrderBoxes.length === 0) return;
    const dateStr = new Date().toISOString().split("T")[0];
    const lines = [
      `*UZEE TECH - PURCHASE ORDER RECOMMENDATIONS*`,
      `Date: ${dateStr}`,
      `Total Boxes Needing Restock: ${purchaseOrderBoxes.length}`,
      `------------------------------------------`,
      ...purchaseOrderBoxes.map((b) => {
        const qty = b.stockQuantity ?? 0;
        const velocity = b.unitsSold ?? 0;
        const suggested = velocity > 5 ? 15 : 10;
        return `• ${b.boxNumber}: ${b.title} (${b.displaySize || "Universal"}) - Current: ${qty} | Order: ${suggested} pcs`;
      }),
    ];
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopiedPO(true);
      setTimeout(() => setCopiedPO(false), 2500);
    } catch (err) {
      console.error("Failed to copy PO", err);
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

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0B0F19] text-zinc-900 dark:text-slate-100 flex flex-col lg:flex-row antialiased selection:bg-brand-600 selection:text-white">
      {/* 1. Left Sidebar Architecture */}
      <AdminSidebar
        activeView={adminView}
        onSelectView={(v) => {
          if (v === "purchase") setStockStatusFilter("PURCHASE_LIST");
          if (v === "inventory") setStockStatusFilter("ALL");
          if (v === "a4-labels") {
            setA4InitialBox(null);
            setIsA4ModalOpen(true);
            return;
          }
          if (v === "thermal-labels") {
            if (!selectedThermalBox && boxes.length > 0) {
              setSelectedThermalBox(boxes[0]);
            }
            setIsThermalStudioOpen(true);
            return;
          }
          setAdminView(v);
        }}
        onOpenAddGroup={handleOpenAddModal}
        onOpenStockCount={() => setIsStockCountModalOpen(true)}
        onOpenDataQuality={() => setIsQualityModalOpen(true)}
        onOpenImportCSV={() => setIsImportModalOpen(true)}
        onDownloadCSV={handleDownloadCSV}
        onDownloadTemplate={() => {
          window.location.href = "/api/admin/boxes/template";
        }}
        onOpenBulkDelete={() => setIsBulkDeleteModalOpen(true)}
        onOpenUserModal={() => setIsUserModalOpen(true)}
        setIsA4StudioOpen={setIsA4ModalOpen}
        setIsThermalStudioOpen={(open) => {
          setIsThermalStudioOpen(open);
          if (open && !selectedThermalBox && boxes.length > 0) {
            setSelectedThermalBox(boxes[0]);
          }
        }}
        onOpenA4Studio={() => {
          setA4InitialBox(null);
          setIsA4ModalOpen(true);
        }}
        onOpenThermalStudio={() => {
          if (!selectedThermalBox && boxes.length > 0) {
            setSelectedThermalBox(boxes[0]);
          }
          setIsThermalStudioOpen(true);
        }}
        totalBoxes={boxes.length}
        restockCount={stats.needsRestockCount}
        uncountedCount={stats.notCountedCount}
      />

      {/* Main Workspace */}
      <div className="flex-1 min-w-0 flex flex-col transition-all duration-300">
        <main className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl w-full mx-auto">
          {/* Header Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80 dark:border-slate-800">
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                  Inventory &amp; Compatibility Manager
                </h1>
                <span className="px-2.5 py-0.5 rounded-full bg-[#BE123C] text-white font-bold text-[10px] tracking-wider uppercase shadow-sm">
                  SUPER-D MASTER
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Permanent Group IDs + Live Stock &amp; Sales Velocity Audit
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleOpenAddModal}
                className="px-4 py-2 rounded-xl bg-[#BE123C] hover:bg-[#9F1239] text-white font-semibold text-xs transition shadow-sm flex items-center gap-1.5 active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>+ Add Group</span>
              </button>
              <Link
                href="/"
                className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-semibold text-xs transition shadow-sm flex items-center gap-1.5"
              >
                <span>← Public Finder</span>
              </Link>
            </div>
          </div>

          {/* View: Waste & Breakage */}
          {adminView === "waste" ? (
            <div className="bg-slate-900/90 rounded-2xl p-6 border border-slate-800 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
                <div>
                  <h2 className="text-xl font-black text-white flex items-center gap-2">
                    <ShieldAlert className="w-5 h-5 text-rose-500" />
                    <span>Damaged &amp; Defective Guard Waste Tracker</span>
                    <span className="px-2.5 py-0.5 rounded-full bg-rose-500/15 text-rose-400 text-xs font-black border border-rose-500/30">
                      {wasteStats?.totalWastedUnits ?? 0} units scrapped
                    </span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Track broken, bubble-spoiled, or supplier DOA screen guards without customer billing.
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={handleDownloadWasteCSV}
                    disabled={wasteLogs.length === 0}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5 text-rose-400" /> Export CSV
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setWasteTargetBox(boxes[0] || null);
                      setIsWasteModalOpen(true);
                    }}
                    className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition flex items-center gap-1.5 shadow-md shadow-rose-600/20"
                  >
                    <Plus className="w-4 h-4" /> Record Waste Incident
                  </button>
                </div>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                <div className="p-4 rounded-xl bg-slate-950/70 border border-rose-500/30">
                  <span className="text-[10px] font-black uppercase tracking-wider text-rose-400">Total Loss Units</span>
                  <span className="text-3xl font-black text-white mt-1 block">{wasteStats?.totalWastedUnits ?? 0}</span>
                  <span className="text-[11px] text-slate-400">Across {wasteLogs.length} incident logs</span>
                </div>
                <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Primary Failures</span>
                  <div className="mt-2 space-y-1 text-xs">
                    <div className="flex justify-between font-bold text-slate-300">
                      <span>🫧 Bubble / Dust:</span>
                      <span className="text-rose-400">{wasteStats?.byReason.INSTALLATION_BUBBLE ?? 0} pcs</span>
                    </div>
                    <div className="flex justify-between font-bold text-slate-300">
                      <span>💥 Cracked in Fit:</span>
                      <span className="text-rose-400">{wasteStats?.byReason.CRACKED_ON_APPLICATION ?? 0} pcs</span>
                    </div>
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Variant Breakdown</span>
                  <div className="mt-2 grid grid-cols-2 gap-1 text-[11px] font-bold text-slate-300">
                    <div>Clear: {wasteStats?.byVariant.super_d ?? 0}</div>
                    <div>Privacy: {wasteStats?.byVariant.privacy ?? 0}</div>
                    <div>Matte: {wasteStats?.byVariant.matte ?? 0}</div>
                    <div>Border: {wasteStats?.byVariant.borderless ?? 0}</div>
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Top Shrinkage Boxes</span>
                  <div className="mt-2 space-y-1 text-xs font-bold text-slate-300 truncate">
                    {wasteStats?.topWastedBoxes && wasteStats.topWastedBoxes.length > 0 ? (
                      wasteStats.topWastedBoxes.slice(0, 2).map((b, i) => (
                        <div key={i} className="flex justify-between truncate">
                          <span className="truncate">{b.boxNumber} ({b.title})</span>
                          <span className="text-rose-400 shrink-0 ml-1">-{b.count}</span>
                        </div>
                      ))
                    ) : (
                      <span className="text-slate-500 font-normal">No logs recorded</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Log Table */}
              <div className="space-y-2">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">Recent Breakage Events</h3>
                <div className="border border-slate-800 rounded-xl overflow-hidden">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-950 text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-800">
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Box #</th>
                        <th className="py-2.5 px-3">Variant</th>
                        <th className="py-2.5 px-3 text-center">Qty Lost</th>
                        <th className="py-2.5 px-3">Reason</th>
                        <th className="py-2.5 px-3">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {wasteLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-800/40">
                          <td className="py-2.5 px-3 text-slate-400 font-mono text-[11px]">
                            {new Date(log.timestamp).toLocaleDateString()}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-white">
                            {log.boxNumber} ({log.modelName})
                          </td>
                          <td className="py-2.5 px-3 text-slate-300 font-semibold uppercase text-[10px]">
                            {log.variant.replace("_", " ")}
                          </td>
                          <td className="py-2.5 px-3 text-center font-black text-rose-400">
                            -{log.quantity}
                          </td>
                          <td className="py-2.5 px-3 text-slate-300">
                            {WASTE_REASON_META[log.reason]?.label || log.reason}
                          </td>
                          <td className="py-2.5 px-3 text-slate-400 italic truncate max-w-xs">
                            {log.technicianNotes || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : adminView === "security" ? (
            /* View: Terminal Security */
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 space-y-6 max-w-2xl shadow-sm">
              <div className="flex items-center gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center border border-purple-500/30">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white">Terminal Security &amp; Passcode</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Manage counter passcode PIN mode and recovery</p>
                </div>
              </div>

              {/* Mode Toggle */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Passcode Mode
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => handleTogglePasscodeLength(4)}
                    className={`p-3.5 rounded-xl border text-left transition ${
                      authLength === 4
                        ? "bg-purple-500/15 border-purple-500/40 text-purple-900 dark:text-purple-200 ring-1 ring-purple-500/30"
                        : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    <div className="font-bold text-sm">4-Digit PIN Mode</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">Fast counter retail entry</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTogglePasscodeLength(6)}
                    className={`p-3.5 rounded-xl border text-left transition ${
                      authLength === 6
                        ? "bg-purple-500/15 border-purple-500/40 text-purple-900 dark:text-purple-200 ring-1 ring-purple-500/30"
                        : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    <div className="font-bold text-sm">6-Digit PIN Mode (Default)</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">High security terminal</div>
                  </button>
                </div>
              </div>

              {/* Change PIN Form */}
              <form onSubmit={handleUpdateSecurity} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-4">
                <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">Update Terminal PIN</h3>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={authLength}
                    value={newPasscode}
                    onChange={(e) => setNewPasscode(e.target.value.replace(/\D/g, ""))}
                    placeholder={`New ${authLength}-digit PIN`}
                    className="px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-mono text-sm tracking-widest focus:outline-none focus:ring-1 focus:ring-purple-500"
                  />
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={authLength}
                    value={confirmPasscode}
                    onChange={(e) => setConfirmPasscode(e.target.value.replace(/\D/g, ""))}
                    placeholder="Confirm PIN"
                    className="px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-mono text-sm tracking-widest focus:outline-none focus:ring-1 focus:ring-purple-500"
                  />
                </div>

                {securityStatus && (
                  <div className={`p-2.5 rounded-lg text-xs font-bold ${securityStatus.startsWith("SUCCESS") ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300" : "bg-rose-500/20 text-rose-700 dark:text-rose-300"}`}>
                    {securityStatus}
                  </div>
                )}

                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={handleResetDefaultPasscode}
                    className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white transition hover:underline"
                  >
                    Reset Factory (123456)
                  </button>
                  <button
                    type="submit"
                    disabled={isUpdatingSecurity || !newPasscode || newPasscode.length !== authLength}
                    className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold text-xs transition"
                  >
                    {isUpdatingSecurity ? "Updating..." : "Update PIN"}
                  </button>
                </div>
              </form>
            </div>
          ) : adminView === "purchase" ? (
            /* View: Purchase Order Restock Planner */
            <div className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                <div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
                      Automated Purchase Recommendations
                    </h2>
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 text-xs font-bold border border-amber-500/20">
                      {stats.needsRestockCount} boxes need restock
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Smart reorder planner prioritized by real retail sales velocity and zero-stock shortages.
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* Sort Velocity vs Box # */}
                  <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => setPurchaseSort("velocity")}
                      className={`px-3 py-1.5 rounded-lg transition ${
                        purchaseSort === "velocity"
                          ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-bold"
                          : "text-slate-500 hover:text-slate-900 dark:text-slate-400"
                      }`}
                    >
                      📈 Velocity
                    </button>
                    <button
                      type="button"
                      onClick={() => setPurchaseSort("boxNumber")}
                      className={`px-3 py-1.5 rounded-lg transition ${
                        purchaseSort === "boxNumber"
                          ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-bold"
                          : "text-slate-500 hover:text-slate-900 dark:text-slate-400"
                      }`}
                    >
                      Box #
                    </button>
                  </div>

                  {/* Copy PO Text */}
                  <button
                    type="button"
                    onClick={handleCopyPO}
                    className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs transition flex items-center gap-1.5"
                  >
                    {copiedPO ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedPO ? "Copied!" : "Copy List"}</span>
                  </button>

                  {/* Export PO Button */}
                  <button
                    type="button"
                    onClick={handleExportPO}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition flex items-center gap-1.5 shadow-sm active:scale-95"
                  >
                    <Download className="w-4 h-4" />
                    <span>📥 Export Purchase Order</span>
                  </button>
                </div>
              </div>

              {/* 2-Column Grid Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {purchaseOrderBoxes.length === 0 ? (
                  <div className="col-span-full p-12 text-center text-slate-500 font-bold bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                    All boxes are fully stocked! No purchase orders required.
                  </div>
                ) : (
                  purchaseOrderBoxes.map((box) => {
                    const qty = box.stockQuantity ?? 0;
                    const velocity = box.unitsSold ?? 0;
                    const suggestedOrder = velocity > 5 ? 15 : 10;

                    return (
                      <div
                        key={box.id}
                        className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between gap-4"
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="px-2.5 py-0.5 rounded-lg bg-[#BE123C] text-white font-bold text-xs shadow-sm">
                                {box.boxNumber}
                              </span>
                              <span className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs">
                                📱 {box.displaySize || "Universal"}
                              </span>
                            </div>
                            <span
                              className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                                qty === 0
                                  ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                                  : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                              }`}
                            >
                              {qty === 0 ? "Out of Stock" : `${qty} left (Low)`}
                            </span>
                          </div>

                          <h4 className="text-base font-black text-slate-900 dark:text-white">
                            {box.title}
                          </h4>

                          <div className="flex flex-wrap gap-1 text-[11px] text-slate-500">
                            {(box.compatibleModels || []).slice(0, 4).map((m, idx) => (
                              <span key={idx} className="bg-slate-100 dark:bg-slate-800/60 px-2 py-0.5 rounded-md">
                                {m}
                              </span>
                            ))}
                            {(box.compatibleModels || []).length > 4 && (
                              <span className="text-slate-400 px-1 py-0.5">
                                +{(box.compatibleModels || []).length - 4} more
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
                          <div>
                            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                              Recommended Order
                            </div>
                            <div className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                              Suggested: {suggestedOrder} pcs (Standard Restock)
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleStepStock(box, 10)}
                            className="px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/60 text-emerald-600 dark:text-emerald-400 font-bold text-xs flex items-center gap-1.5 transition active:scale-95 border border-emerald-200 dark:border-emerald-800"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>+10 Restock</span>
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ) : (
            /* View: Master Inventory (Default View) */
            <div className="space-y-5">
              {/* 1. Top Metric KPI Ribbon */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
                {/* TOTAL GROUPS */}
                <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-rose-200/80 dark:border-rose-950/60 shadow-sm flex items-center justify-between">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-wider text-rose-600 dark:text-rose-400">
                      TOTAL GROUPS: {stats.totalGroups}
                    </div>
                    <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-1 tabular-nums">
                      {stats.totalGroups}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Master compatibility
                    </div>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20 flex items-center justify-center">
                    <Package className="w-5 h-5" />
                  </div>
                </div>

                {/* IN STOCK */}
                <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center justify-between">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                      IN STOCK: {stats.inStockCount}
                    </div>
                    <div className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-1 tabular-nums">
                      {stats.inStockCount}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Verified &gt; 0 units
                    </div>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                </div>

                {/* NEEDS RESTOCK */}
                <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center justify-between">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">
                      NEEDS RESTOCK: {stats.needsRestockCount}
                    </div>
                    <div className="text-2xl sm:text-3xl font-black text-amber-600 dark:text-amber-400 mt-1 tabular-nums">
                      {stats.needsRestockCount}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Stock ≤ 3 or 0 units
                    </div>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20 flex items-center justify-center">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                </div>

                {/* TOTAL UNITS ON HAND */}
                <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center justify-between">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400">
                      TOTAL UNITS ON HAND: {stats.totalUnits}
                    </div>
                    <div className="text-2xl sm:text-3xl font-black text-blue-600 dark:text-blue-400 mt-1 tabular-nums">
                      {stats.totalUnits}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Counted physical stock
                    </div>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20 flex items-center justify-center">
                    <Layers className="w-5 h-5" />
                  </div>
                </div>
              </div>

              {/* 2. Action Toolbar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={handleOpenAddModal}
                    className="px-4 py-2 rounded-xl bg-[#BE123C] hover:bg-[#9F1239] text-white font-semibold text-xs transition shadow-sm flex items-center gap-1.5 active:scale-95"
                  >
                    <Plus className="w-4 h-4" />
                    <span>+ Add Group</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsFastPasteModalOpen(true)}
                    className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-semibold text-xs transition flex items-center gap-1.5 active:scale-95"
                  >
                    <ClipboardList className="w-3.5 h-3.5 text-blue-500" />
                    <span>Fast Inward</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setA4InitialBox(null);
                      setIsA4ModalOpen(true);
                    }}
                    className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-semibold text-xs transition flex items-center gap-1.5 active:scale-95"
                  >
                    <Printer className="w-3.5 h-3.5 text-purple-500" />
                    <span>A4 Studio</span>
                  </button>
                </div>

                {/* Tools ▾ Dropdown Menu */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsToolsOpen(!isToolsOpen)}
                    className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-semibold text-xs transition flex items-center gap-1.5 active:scale-95"
                  >
                    <span>Tools</span>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                  </button>

                  {isToolsOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-20"
                        onClick={() => setIsToolsOpen(false)}
                      />
                      <div className="absolute right-0 top-full mt-1.5 z-30 w-52 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl py-1 text-xs">
                        <button
                          type="button"
                          onClick={() => {
                            setIsToolsOpen(false);
                            handleDownloadCSV();
                          }}
                          className="w-full text-left px-3.5 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center gap-2 font-medium"
                        >
                          <Download className="w-3.5 h-3.5 text-emerald-500" />
                          <span>Export CSV</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsToolsOpen(false);
                            setAdminView("waste");
                          }}
                          className="w-full text-left px-3.5 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center gap-2 font-medium"
                        >
                          <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
                          <span>Waste &amp; Shrinkage Log</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsToolsOpen(false);
                            setAdminView("security");
                          }}
                          className="w-full text-left px-3.5 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center gap-2 font-medium"
                        >
                          <KeyRound className="w-3.5 h-3.5 text-purple-500" />
                          <span>Passcode Security</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsToolsOpen(false);
                            setIsMigrationModalOpen(true);
                          }}
                          className="w-full text-left px-3.5 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center gap-2 font-medium"
                        >
                          <FolderArchive className="w-3.5 h-3.5 text-blue-500" />
                          <span>Database Migration</span>
                        </button>
                        <div className="border-t border-slate-200 dark:border-slate-800 my-1" />
                        <button
                          type="button"
                          onClick={() => {
                            setIsToolsOpen(false);
                            setIsStockCountModalOpen(true);
                          }}
                          className="w-full text-left px-3.5 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center gap-2 font-medium"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-teal-500" />
                          <span>Stock Count Mode</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsToolsOpen(false);
                            setIsImportModalOpen(true);
                          }}
                          className="w-full text-left px-3.5 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center gap-2 font-medium"
                        >
                          <FileText className="w-3.5 h-3.5 text-amber-500" />
                          <span>Bulk CSV Import</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsToolsOpen(false);
                            setIsBulkDeleteModalOpen(true);
                          }}
                          className="w-full text-left px-3.5 py-2 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center gap-2 font-medium"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Bulk Reset / Clean</span>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* 3. Filter Navigation Pills & Search Bar */}
              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                {/* Filter Navigation Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-200/60 dark:border-slate-800">
                  {[
                    { id: "ALL", label: `All Groups (${stats.totalGroups})` },
                    { id: "IN_STOCK", label: `In Stock (${stats.inStockCount})` },
                    { id: "NEEDS_RESTOCK", label: `Needs Restock (${stats.needsRestockCount})` },
                    { id: "NOT_COUNTED", label: `Not Counted (${stats.notCountedCount})` },
                    { id: "PURCHASE_LIST", label: `Purchase List (${stats.needsRestockCount})` },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => {
                        setStockStatusFilter(tab.id as any);
                        if (tab.id === "PURCHASE_LIST") {
                          setAdminView("purchase");
                        }
                      }}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition shrink-0 ${
                        stockStatusFilter === tab.id
                          ? "bg-[#0F172A] text-white dark:bg-slate-800 shadow-sm"
                          : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* 4-Column Search Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                  {/* Search model, box, title... */}
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      value={searchFilter}
                      onChange={(e) => setSearchFilter(e.target.value)}
                      placeholder="Search model, box, title..."
                      className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-rose-500"
                    />
                  </div>

                  {/* Box (e.g. BOX 041) */}
                  <div>
                    <input
                      type="text"
                      value={boxNumberFilter}
                      onChange={(e) => setBoxNumberFilter(e.target.value)}
                      placeholder="Box (e.g. BOX 041)"
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-rose-500"
                    />
                  </div>

                  {/* All Brands Dropdown */}
                  <div>
                    <select
                      value={brandFilter}
                      onChange={(e) => setBrandFilter(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-rose-500"
                    >
                      <option value="">All Brands</option>
                      {availableBrands.map((b) => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                  </div>

                  {/* Size (e.g. 6.7") Input & Reset */}
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={sizeFilter}
                      onChange={(e) => setSizeFilter(e.target.value)}
                      placeholder='Size (e.g. 6.7")'
                      className="flex-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-rose-500"
                    />
                    {(searchFilter || boxNumberFilter || brandFilter || sizeFilter || stockStatusFilter !== "ALL") && (
                      <button
                        type="button"
                        onClick={() => {
                          setSearchFilter("");
                          setBoxNumberFilter("");
                          setBrandFilter("");
                          setSizeFilter("");
                          setStockStatusFilter("ALL");
                        }}
                        className="px-2.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-rose-600 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-bold transition shrink-0"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* 4. Physical Box Row Card Layout */}
              <div className="space-y-3">
                {loading ? (
                  <div className="p-12 text-center text-slate-500 font-bold bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                    Loading master inventory…
                  </div>
                ) : filteredBoxes.length === 0 ? (
                  <div className="p-12 text-center text-slate-500 font-bold bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                    No matching boxes found.
                  </div>
                ) : (
                  filteredBoxes.map((box) => {
                    const qty = box.stockQuantity ?? 0;
                    const ver = box.stockCountVerified ?? false;
                    const boxVariants = normalizeVariants(box.variants, qty);
                    const geom = inferGeometryProfile(box);
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
                        className="bg-white dark:bg-[#111827] border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 sm:p-5 mb-3 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 hover:shadow-md transition"
                      >
                        {/* Left Block */}
                        <div className="space-y-2 flex-1 min-w-0">
                          {/* Meta Row */}
                          <div className="flex items-center gap-2 flex-wrap">
                            {/* box-001 (Black pill) */}
                            <span className="px-2.5 py-0.5 rounded-lg bg-slate-900 text-white font-mono text-xs font-bold shadow-sm">
                              {box.id}
                            </span>

                            {/* BOX 001 (Red brand pill) */}
                            <span className="px-2.5 py-0.5 rounded-lg bg-[#BE123C] text-white font-bold text-xs shadow-sm">
                              {box.boxNumber}
                            </span>

                            {/* Screen size */}
                            <span className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs border border-slate-200 dark:border-slate-700">
                              📱 {box.displaySize || "4.7\""}
                            </span>

                            {/* Notch / Edge Cut */}
                            <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 font-medium text-xs border border-slate-200 dark:border-slate-700/60">
                              <span>{NOTCH_META[geom.notchType].icon}</span>
                              <span>{NOTCH_META[geom.notchType].short}</span>
                              <span>•</span>
                              <span>{EDGE_META[geom.edgeCut].short}</span>
                            </span>

                            {/* Stock Status Pill */}
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider border ${
                                st === "IN_STOCK"
                                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                                  : st === "LOW_STOCK"
                                  ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30"
                                  : st === "NOT_COUNTED"
                                  ? "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700"
                                  : "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30"
                              }`}
                            >
                              STOCK: {qty > 0 ? `${qty} IN STOCK` : st === "NOT_COUNTED" ? "NOT COUNTED" : "OUT OF STOCK"}
                            </span>

                            {/* Sales Velocity */}
                            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                              VELOCITY: ~ {box.unitsSold ?? 0} sold
                            </span>
                          </div>

                          {/* Series / Model Name Title in bold black */}
                          <div>
                            <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
                              {box.title}
                            </h3>
                          </div>

                          {/* Bottom Aliases: Soft gray pill tags */}
                          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                            {(box.compatibleModels || []).map((m, mIdx) => (
                              <span
                                key={mIdx}
                                className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium border border-slate-200/80 dark:border-slate-700"
                              >
                                {m}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Right Action Steppers & Buttons */}
                        <div className="flex items-center gap-3 shrink-0 flex-wrap justify-between md:justify-end border-t md:border-t-0 pt-3 md:pt-0 border-slate-100 dark:border-slate-800">
                          {/* Stock Steppers: [-] [qty] [+] */}
                          <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-900 p-1 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                            <button
                              type="button"
                              onClick={() => handleStepStock(box, -1)}
                              disabled={qty <= 0}
                              className="w-8 h-8 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 disabled:opacity-30 flex items-center justify-center font-bold text-base transition active:scale-95 shadow-xs"
                              title="Decrease stock"
                            >
                              -
                            </button>
                            <span className="font-black text-sm tabular-nums px-2.5 text-center min-w-[32px] text-slate-900 dark:text-white">
                              {ver ? qty : "?"}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleStepStock(box, 1)}
                              className="w-8 h-8 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-base transition active:scale-95 shadow-xs"
                              title="Increase stock"
                            >
                              +
                            </button>
                          </div>

                          {/* Quick Action Buttons: [ ✏️ Edit ], [ 🖨️ Print ], [ 🗑️ Delete ] */}
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(box)}
                              className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs flex items-center gap-1.5 transition active:scale-95"
                              title="Edit Group"
                            >
                              <Edit3 className="w-3.5 h-3.5 text-blue-500" />
                              <span>Edit</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setA4InitialBox(box);
                                setIsA4ModalOpen(true);
                              }}
                              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition active:scale-95"
                              title="Print A4 Label Sheet"
                            >
                              <Printer className="w-4 h-4 text-purple-500" />
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setSelectedThermalBox(box);
                                setIsThermalStudioOpen(true);
                              }}
                              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition active:scale-95"
                              title="Print Thermal Label (50x30)"
                            >
                              <Receipt className="w-4 h-4 text-amber-500" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteBox(box.id)}
                              className="p-2 rounded-xl bg-slate-100 hover:bg-rose-100 text-slate-400 hover:text-rose-600 dark:bg-slate-800 dark:hover:bg-rose-950/40 transition active:scale-95"
                              title="Delete Group"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* Database & Storage Management Footer */}
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 flex items-center justify-between gap-4 flex-wrap text-xs shadow-sm">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
              <span className="font-bold text-slate-700 dark:text-slate-300">Database &amp; Storage Management:</span>
              <span className="text-slate-500">148 Consolidated Clean Dataset</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsSnapshotViewerOpen(true)}
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold transition flex items-center gap-1.5"
              >
                <FolderArchive className="w-3.5 h-3.5 text-blue-500" />
                <span>Snapshots</span>
              </button>
              <button
                type="button"
                onClick={() => setIsMigrationModalOpen(true)}
                className="px-3.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-600/20 dark:hover:bg-rose-600/30 border border-rose-200 dark:border-rose-500/40 text-rose-600 dark:text-rose-300 font-black transition flex items-center gap-1.5"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Reset &amp; Migrate</span>
              </button>
            </div>
          </div>
        </main>
      </div>

      {/* ── Modals & Drawers ──────────────────────────────────────────────── */}
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

      <A4LabelPrintModal
        isOpen={isA4ModalOpen}
        onClose={() => {
          setIsA4ModalOpen(false);
          setA4InitialBox(null);
        }}
        allBoxes={boxes}
        initialBox={a4InitialBox}
      />

      <ThermalLabelModal
        isOpen={isThermalStudioOpen || !!selectedThermalBox}
        onClose={() => {
          setIsThermalStudioOpen(false);
          setSelectedThermalBox(null);
        }}
        box={selectedThermalBox || (boxes.length > 0 ? boxes[0] : null)}
        allBoxes={boxes}
      />

      <WhatsAppOrderModal
        isOpen={isWhatsAppModalOpen}
        onClose={() => setIsWhatsAppModalOpen(false)}
        initialModel={whatsAppTargetModel}
        catalogModels={Array.from(new Set(boxes.flatMap((b) => b.compatibleModels || [])))}
      />

      <FastPasteManifestModal
        isOpen={isFastPasteModalOpen}
        onClose={() => setIsFastPasteModalOpen(false)}
        allBoxes={boxes}
        onCommitManifest={handleCommitManifest}
      />

      <WasteTrackerModal
        isOpen={isWasteModalOpen}
        onClose={() => {
          setIsWasteModalOpen(false);
          setWasteTargetBox(null);
        }}
        box={wasteTargetBox}
        onWasteRecorded={handleWasteRecorded}
      />

      <DatabaseMigrationModal
        isOpen={isMigrationModalOpen}
        onClose={() => setIsMigrationModalOpen(false)}
        onSuccess={fetchData}
      />

      <SnapshotViewerModal
        isOpen={isSnapshotViewerOpen}
        onClose={() => setIsSnapshotViewerOpen(false)}
      />

      <UndoToast
        toast={undoToast}
        onDismiss={() => setUndoToast(null)}
      />

      <SessionAuditDrawer
        isOpen={isHistoryDrawerOpen}
        onClose={() => setIsHistoryDrawerOpen(false)}
        logs={sessionLogs}
        onClearHistory={() => setSessionLogs([])}
      />
    </div>
  );
}
