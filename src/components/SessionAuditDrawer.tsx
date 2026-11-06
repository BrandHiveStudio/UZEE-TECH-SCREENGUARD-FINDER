"use client";

import React, { useState } from "react";
import {
  History,
  X,
  RotateCcw,
  CheckCircle2,
  Package,
  Sparkles,
  ArrowRight,
  Trash2,
} from "lucide-react";

export interface SessionAuditLog {
  id: string;
  type: "STOCK_STEP" | "SCAN_MERGE" | "NEW_BOX_STAGED" | "UNDO" | "INWARD_MANIFEST" | "WASTE_DISPOSAL";
  timestamp: number;
  boxNumber: string;
  description: string;
  previousValue: any;
  newValue: any;
  canRevert?: boolean;
  onRevert?: () => Promise<void> | void;
}

interface SessionAuditDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  logs: SessionAuditLog[];
  onClearHistory?: () => void;
}

function formatRelativeTime(timestamp: number): string {
  const diffSec = Math.floor((Date.now() - timestamp) / 1000);
  if (diffSec < 10) return "Just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  return new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function SessionAuditDrawer({
  isOpen,
  onClose,
  logs,
  onClearHistory,
}: SessionAuditDrawerProps) {
  const [revertingId, setRevertingId] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleRevert = async (log: SessionAuditLog) => {
    if (!log.onRevert) return;
    setRevertingId(log.id);
    try {
      await log.onRevert();
    } finally {
      setRevertingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden animate-in fade-in duration-200">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white dark:bg-slate-900 shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col">
          {/* Header */}
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <History className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                  Session Audit Log
                  <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-black text-slate-600 dark:text-slate-300">
                    {logs.length}
                  </span>
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Last 25 in-memory operations &amp; rollbacks
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {logs.length > 0 && onClearHistory && (
                <button
                  onClick={onClearHistory}
                  title="Clear log history"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {logs.length === 0 ? (
              <div className="py-16 text-center text-slate-400 dark:text-slate-500 space-y-2">
                <History className="w-10 h-10 mx-auto opacity-40" />
                <p className="font-semibold text-sm">No actions recorded in this session</p>
                <p className="text-xs">
                  Stock stepping, AI scan merges, and staged boxes will appear here.
                </p>
              </div>
            ) : (
              logs.map((log) => {
                const isReverting = revertingId === log.id;
                return (
                  <div
                    key={log.id}
                    className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-2 hover:border-slate-300 dark:hover:border-slate-600 transition"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {/* Type badge */}
                        <span
                          className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${
                            log.type === "STOCK_STEP"
                              ? "bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
                              : log.type === "SCAN_MERGE"
                              ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                              : log.type === "NEW_BOX_STAGED"
                              ? "bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800"
                              : log.type === "INWARD_MANIFEST"
                              ? "bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800"
                              : log.type === "WASTE_DISPOSAL"
                              ? "bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800"
                              : "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
                          }`}
                        >
                          {log.type.replace(/_/g, " ")}
                        </span>
                        <span className="font-black text-xs text-slate-900 dark:text-white">
                          {log.boxNumber}
                        </span>
                      </div>

                      <span className="text-[10px] text-slate-400 font-semibold">
                        {formatRelativeTime(log.timestamp)}
                      </span>
                    </div>

                    <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                      {log.description}
                    </p>

                    {/* Diff visualization */}
                    {(log.previousValue !== undefined || log.newValue !== undefined) && (
                      <div className="flex items-center gap-1.5 text-[11px] font-mono bg-white dark:bg-slate-900/80 px-2.5 py-1.5 rounded-xl border border-slate-200/60 dark:border-slate-800">
                        <span className="text-rose-600 dark:text-rose-400 line-through">
                          {typeof log.previousValue === "object"
                            ? JSON.stringify(log.previousValue)
                            : String(log.previousValue ?? "none")}
                        </span>
                        <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                          {typeof log.newValue === "object"
                            ? JSON.stringify(log.newValue)
                            : String(log.newValue ?? "none")}
                        </span>
                      </div>
                    )}

                    {/* Revert Button */}
                    {log.canRevert && log.onRevert && (
                      <div className="pt-1 flex justify-end">
                        <button
                          type="button"
                          disabled={isReverting}
                          onClick={() => handleRevert(log)}
                          className="px-2.5 py-1 rounded-lg bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-50 active:scale-95"
                        >
                          <RotateCcw
                            className={`w-3 h-3 ${isReverting ? "animate-spin" : ""}`}
                          />
                          <span>{isReverting ? "Reverting…" : "Revert"}</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

