"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  Package,
  FileText,
  ClipboardCheck,
  ShieldCheck,
  UploadCloud,
  Download,
  FileSpreadsheet,
  Trash2,
  KeyRound,
  Users,
  ArrowUpRight,
  Plus,
  Printer,
  Receipt,
} from "lucide-react";

export type AdminView =
  | "inventory"
  | "waste"
  | "security"
  | "purchase"
  | "a4-labels"
  | "thermal-labels";

interface AdminSidebarProps {
  activeView: AdminView;
  onSelectView?: (view: AdminView) => void;
  onOpenAddGroup: () => void;
  onOpenBulkIntake?: () => void;
  onOpenIntelligenceHub?: () => void;
  onOpenStockCount: () => void;
  onOpenDataQuality: () => void;
  onOpenImportCSV: () => void;
  onDownloadCSV: () => void;
  onDownloadTemplate: () => void;
  onOpenBulkDelete: () => void;
  onOpenUserModal: () => void;
  setIsA4StudioOpen?: (open: boolean) => void;
  setIsThermalStudioOpen?: (open: boolean) => void;
  onOpenA4Studio?: () => void;
  onOpenThermalStudio?: () => void;
  totalBoxes?: number;
  restockCount?: number;
  uncountedCount?: number;
}

export function AdminSidebar({
  activeView,
  onSelectView,
  onOpenAddGroup,
  onOpenBulkIntake,
  onOpenIntelligenceHub,
  onOpenStockCount,
  onOpenDataQuality,
  onOpenImportCSV,
  onDownloadCSV,
  onDownloadTemplate,
  onOpenBulkDelete,
  onOpenUserModal,
  setIsA4StudioOpen,
  setIsThermalStudioOpen,
  onOpenA4Studio,
  onOpenThermalStudio,
  totalBoxes = 163,
  restockCount = 162,
  uncountedCount = 162,
}: AdminSidebarProps) {
  return (
    <aside className="w-64 min-h-screen bg-white dark:bg-[#0F172A] border-r border-slate-200/80 dark:border-slate-800 p-5 flex flex-col justify-between select-none shrink-0 h-screen sticky top-0 overflow-y-auto">
      {/* Top Section */}
      <div className="space-y-4">
        {/* Branding */}
        <div className="flex items-center justify-between pb-1">
          <Link href="/admin" className="flex items-center gap-2.5 group">
            <div className="relative h-9 w-auto rounded-xl overflow-hidden px-1.5 py-1 bg-white border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-center">
              <Image
                src="/uzee_tech_official_logo.png"
                alt="UZEE TECH Logo"
                width={120}
                height={32}
                className="object-contain h-6 w-auto"
                priority
              />
            </div>
            <div>
              <div className="font-black text-sm tracking-tight text-slate-900 dark:text-white leading-tight">
                <span className="text-[#BE123C]">UZEE</span> TECH
              </div>
              <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 tracking-wider uppercase">
                ADMIN WORKSPACE
              </div>
            </div>
          </Link>
          <ThemeToggle />
        </div>

        {/* Primary Action Button */}
        <button
          type="button"
          onClick={onOpenAddGroup}
          className="w-full bg-[#BE123C] hover:bg-[#9F1239] text-white font-semibold py-2.5 px-4 rounded-xl shadow-sm text-sm flex items-center justify-center gap-2 mb-6 transition active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>+ Add Compatibility Group</span>
        </button>

        {/* Navigation Categories */}
        <nav className="space-y-4">
          {/* GROUP 1: INVENTORY VIEWS */}
          <div>
            <div className="text-slate-400 font-bold text-[11px] uppercase tracking-wider mb-2">
              INVENTORY VIEWS
            </div>
            <div className="space-y-1">
              {/* All Active Boxes */}
              <button
                type="button"
                onClick={() => onSelectView?.("inventory")}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition ${
                  activeView === "inventory"
                    ? "bg-[#0F172A] text-white dark:bg-slate-800 rounded-xl shadow-sm font-semibold"
                    : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800/60"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Package className={`w-4 h-4 ${activeView === "inventory" ? "text-rose-400" : "text-slate-500"}`} />
                  <span>All Active Boxes</span>
                </div>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                    activeView === "inventory"
                      ? "bg-rose-600 text-white"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                  }`}
                >
                  {totalBoxes}
                </span>
              </button>

              {/* Purchase Order List */}
              <button
                type="button"
                onClick={() => onSelectView?.("purchase")}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition ${
                  activeView === "purchase"
                    ? "bg-[#0F172A] text-white dark:bg-slate-800 rounded-xl shadow-sm font-semibold"
                    : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800/60"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <FileText className={`w-4 h-4 ${activeView === "purchase" ? "text-amber-400" : "text-amber-500"}`} />
                  <span>Purchase Order List</span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  {restockCount}
                </span>
              </button>
            </div>
          </div>

          {/* GROUP 2: INTELLIGENCE & AUDITING */}
          <div>
            <div className="text-slate-400 font-bold text-[11px] uppercase tracking-wider mb-2">
              INTELLIGENCE &amp; AUDITING
            </div>
            <div className="space-y-1">
              {/* Stock Count Mode */}
              <button
                type="button"
                onClick={onOpenStockCount}
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800/60 transition"
              >
                <div className="flex items-center gap-2.5">
                  <ClipboardCheck className="w-4 h-4 text-teal-500" />
                  <span>Stock Count Mode</span>
                </div>
                {uncountedCount > 0 && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-teal-500/15 text-teal-600 dark:text-teal-400 border border-teal-500/20">
                    {uncountedCount} left
                  </span>
                )}
              </button>

              {/* Data Quality & Duplicates */}
              <button
                type="button"
                onClick={onOpenDataQuality}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800/60 transition text-left"
              >
                <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                <div className="truncate">
                  <div className="truncate">Data Quality &amp; Duplicates</div>
                  <div className="text-[10px] text-slate-400 font-normal truncate">
                    Audit integrity &amp; conflicts
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* PRINT & DISPATCH */}
          <div className="space-y-1">
            <div className="px-3 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              PRINT &amp; DISPATCH
            </div>
            <button
              type="button"
              onClick={() => {
                onSelectView?.("a4-labels");
                setIsA4StudioOpen?.(true);
                onOpenA4Studio?.();
              }}
              className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-xl text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <Printer className="w-4 h-4 text-slate-500" />
                <span>A4 Label Studio</span>
              </div>
              <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono font-bold">
                3×4 Sheet
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                onSelectView?.("thermal-labels");
                setIsThermalStudioOpen?.(true);
                onOpenThermalStudio?.();
              }}
              className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-xl text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <Receipt className="w-4 h-4 text-slate-500" />
                <span>Thermal Label Studio</span>
              </div>
              <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono font-bold">
                50×30mm
              </span>
            </button>
          </div>

          {/* GROUP 3: IMPORT & EXPORT */}
          <div>
            <div className="text-slate-400 font-bold text-[11px] uppercase tracking-wider mb-2">
              IMPORT &amp; EXPORT
            </div>
            <div className="space-y-1">
              {/* Import Boxes (CSV) */}
              <button
                type="button"
                onClick={onOpenImportCSV}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800/60 transition"
              >
                <UploadCloud className="w-4 h-4 text-blue-500" />
                <span>Import Boxes (CSV)</span>
              </button>

              {/* Download Stock CSV */}
              <button
                type="button"
                onClick={onDownloadCSV}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800/60 transition"
              >
                <Download className="w-4 h-4 text-emerald-500" />
                <span>Download Stock CSV</span>
              </button>

              {/* CSV Import Template */}
              <button
                type="button"
                onClick={onDownloadTemplate}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800/60 transition"
              >
                <FileSpreadsheet className="w-4 h-4 text-amber-500" />
                <span>CSV Import Template</span>
              </button>

              {/* Bulk Delete Boxes */}
              <button
                type="button"
                onClick={onOpenBulkDelete}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/30 transition"
              >
                <Trash2 className="w-4 h-4 text-rose-500" />
                <span>Bulk Delete Boxes</span>
              </button>
            </div>
          </div>

          {/* GROUP 4: ADMINISTRATION */}
          <div>
            <div className="text-slate-400 font-bold text-[11px] uppercase tracking-wider mb-2">
              ADMINISTRATION
            </div>
            <div className="space-y-1">
              {/* Settings & Passcode */}
              <button
                type="button"
                onClick={() => onSelectView?.("security")}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition ${
                  activeView === "security"
                    ? "bg-[#0F172A] text-white dark:bg-slate-800 rounded-xl shadow-sm font-semibold"
                    : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800/60"
                }`}
              >
                <KeyRound className="w-4 h-4 text-purple-500" />
                <span>Settings &amp; Passcode</span>
              </button>

              {/* Manage Users */}
              <button
                type="button"
                onClick={onOpenUserModal}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800/60 transition"
              >
                <Users className="w-4 h-4 text-slate-500" />
                <span>Manage Users</span>
              </button>
            </div>
          </div>
        </nav>
      </div>

      {/* Sidebar Footer */}
      <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
        <Link
          href="/"
          className="w-full flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs transition"
        >
          <span>↗ Public Finder</span>
        </Link>
      </div>
    </aside>
  );
}
