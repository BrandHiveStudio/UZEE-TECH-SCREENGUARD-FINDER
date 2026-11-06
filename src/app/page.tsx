"use client";

import React, { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { SearchBar } from "@/components/SearchBar";
import { ResultCard } from "@/components/ResultCard";
import { WhatsAppOrderModal } from "@/components/WhatsAppOrderModal";
import { WasteTrackerModal } from "@/components/WasteTrackerModal";
import { A4LabelPrintModal } from "@/components/A4LabelPrintModal";
import { ThemeToggle } from "@/components/ThemeToggle";
import { createSearchEngine, searchBoxes } from "@/lib/search";
import { matchesBox } from "@/lib/searchNormalizer";
import type { Box, SearchResultItem } from "@/types/screenguard";
import {
  Sparkles,
  Zap,
  Lock,
  RefreshCw,
  AlertCircle,
  SlidersHorizontal,
  Package,
  ArrowRight,
  User,
  LogOut,
  Layers,
  Shield,
  Droplet,
  Smartphone,
  CheckCircle2,
} from "lucide-react";

const BRAND_FILTERS = [
  "All",
  "Samsung",
  "Apple",
  "Xiaomi / Redmi",
  "Tecno / Infinix",
  "Vivo",
  "Realme",
  "Honor",
  "Motorola",
];

const QUICK_SEARCH_CHIPS = [
  "Samsung A15",
  "iPhone 15",
  "Redmi 13C",
  "Samsung A06",
  "Vivo Y17s",
  "Realme C53",
  "Tecno Spark 20",
  "Infinix Hot 40",
];

type NavMode = "search" | "all";

export default function HomePage() {
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [selectedBrand, setSelectedBrand] = useState<string>("All");
  const [navMode, setNavMode] = useState<NavMode>("search");
  const [currentUser, setCurrentUser] = useState<{ email?: string; role?: string } | null>(null);

  // Feature Modals
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);
  const [whatsAppModel, setWhatsAppModel] = useState("");
  const [wasteTargetBox, setWasteTargetBox] = useState<Box | null>(null);
  const [a4TargetBox, setA4TargetBox] = useState<Box | null>(null);
  const [isA4ModalOpen, setIsA4ModalOpen] = useState(false);

  const allCatalogModels = useMemo(() => {
    const set = new Set<string>();
    boxes.forEach((b) => b.compatibleModels?.forEach((m) => set.add(m)));
    return Array.from(set);
  }, [boxes]);

  async function loadData() {
    try {
      const res = await fetch("/api/screenguards?t=" + Date.now(), {
        cache: "no-store",
      });
      if (res.ok) {
        const json = await res.json();
        setBoxes(Array.isArray(json.boxes) ? json.boxes : []);
      }
    } catch (e) {
      console.error("Failed to fetch screenguards data", e);
    } finally {
      setLoading(false);
    }
  }

  // Fetch current user session
  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.user) setCurrentUser(data.user);
      })
      .catch(() => {});
  }, []);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      setCurrentUser(null);
    }
  };

  useEffect(() => {
    loadData();

    const onFocus = () => loadData();
    window.addEventListener("focus", onFocus);

    try {
      const saved = localStorage.getItem("uzee_recent_searches");
      if (saved) setRecentSearches(JSON.parse(saved));
    } catch {}

    return () => window.removeEventListener("focus", onFocus);
  }, []);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleGlobalShortcuts = (e: KeyboardEvent) => {
      // Alt + B -> view all boxes
      if (e.altKey && (e.key === "b" || e.key === "B")) {
        e.preventDefault();
        setNavMode("all");
        setQuery("");
      }
      // Escape -> dismiss query or reset to search
      else if (e.key === "Escape") {
        if (query) {
          setQuery("");
        } else if (navMode !== "search") {
          setNavMode("search");
        }
      }
    };

    window.addEventListener("keydown", handleGlobalShortcuts);
    return () => window.removeEventListener("keydown", handleGlobalShortcuts);
  }, [query, navMode]);

  useEffect(() => {
    if (!query.trim() || query.length < 3) return;
    const timer = setTimeout(() => {
      setRecentSearches((prev) => {
        const trimmed = query.trim();
        const filtered = prev.filter(
          (s) => s.toLowerCase() !== trimmed.toLowerCase()
        );
        const updated = [trimmed, ...filtered].slice(0, 6);
        try {
          localStorage.setItem("uzee_recent_searches", JSON.stringify(updated));
        } catch {}
        return updated;
      });
    }, 1200);
    return () => clearTimeout(timer);
  }, [query]);

  const fuseInstance = useMemo(() => {
    if (!boxes.length) return null;
    return createSearchEngine(boxes);
  }, [boxes]);

  const results: SearchResultItem[] = useMemo(() => {
    if (!boxes.length) return [];

    const brandFiltered = boxes.filter((b) => matchesBox(b, "", selectedBrand));

    // When in "all" boxes mode and query is empty, return all brand filtered boxes
    if (!query.trim()) {
      return brandFiltered.map((b) => ({ item: b }));
    }

    // Direct matches with intelligent normalizer (supports "SM A05", "Apple 7+", "ip 13 pro", "box 48", etc.)
    const directMatches = brandFiltered.filter((b) => matchesBox(b, query, selectedBrand));

    let searchRes: SearchResultItem[] = [];
    if (fuseInstance) {
      searchRes = searchBoxes(fuseInstance, query).filter((r) =>
        matchesBox(r.item, "", selectedBrand)
      );
    }

    // Merge: Preserves search ranking while ensuring direct normalized matches are present
    const seenIds = new Set<string>();
    const merged: SearchResultItem[] = [];

    for (const r of searchRes) {
      merged.push(r);
      seenIds.add(r.item.id);
    }

    for (const dm of directMatches) {
      if (!seenIds.has(dm.id)) {
        merged.push({
          item: dm,
          score: 0.05,
          matchedModel: dm.compatibleModels[0] || dm.title,
        });
        seenIds.add(dm.id);
      }
    }

    return merged.length > 0 ? merged : directMatches.map((b) => ({ item: b }));
  }, [boxes, query, fuseInstance, selectedBrand]);

  const handleClearRecent = () => {
    setRecentSearches([]);
    try {
      localStorage.removeItem("uzee_recent_searches");
    } catch {}
  };

  const handleChipClick = (chip: string) => {
    setQuery(chip);
    setNavMode("search");
  };

  const activeBoxCount = boxes.length || 163;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-[#0B0F19] text-zinc-900 dark:text-slate-100 antialiased selection:bg-rose-600 selection:text-white">
      
      {/* 1. Top Header */}
      <header className="sticky top-0 z-40 w-full border-b border-zinc-200/80 dark:border-slate-800/80 bg-white/90 dark:bg-[#0B0F19]/90 backdrop-blur-xl shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 sm:h-18 flex items-center justify-between gap-4">
          {/* Left: UZEE TECH Logo + ScreenGuard Finder */}
          <Link
            href="/"
            onClick={() => {
              setNavMode("search");
              setQuery("");
            }}
            className="flex items-center gap-3 group transition active:scale-95 shrink-0"
          >
            <div className="relative h-10 w-auto rounded-xl overflow-hidden px-2 py-1 bg-white border border-zinc-200 dark:border-slate-700 shadow-sm flex items-center justify-center">
              <Image
                src="/uzee_tech_official_logo.png"
                alt="UZEE TECH Official Logo"
                width={140}
                height={40}
                className="object-contain h-8 w-auto"
                priority
              />
            </div>
            <div className="flex flex-col">
              <span className="font-black text-base sm:text-lg tracking-tight text-zinc-900 dark:text-white leading-tight">
                <span className="text-rose-600 dark:text-rose-500">UZEE</span> TECH
              </span>
              <span className="text-[10px] sm:text-[11px] font-bold text-zinc-500 dark:text-slate-400 tracking-wider uppercase leading-none">
                ScreenGuard Finder
              </span>
            </div>
          </Link>

          {/* Right Header Action Group */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Active Boxes pill badge */}
            <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 text-xs font-bold">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
              <span>{activeBoxCount} Active Boxes</span>
            </div>

            {/* WhatsApp Dispatch Button */}
            <button
              type="button"
              onClick={() => {
                setWhatsAppModel("");
                setIsWhatsAppModalOpen(true);
              }}
              className="flex items-center gap-2 bg-[#25D366] hover:bg-[#20bd5a] text-white px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold shadow-sm transition-all active:scale-95"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.007c.106.005.249-.04.39.298.144.347.491 1.2.534 1.287.043.087.072.188.014.303-.058.116-.087.188-.173.289l-.26.303c-.087.087-.177.182-.076.356.101.174.449.741.964 1.201.662.591 1.221.774 1.394.86.173.086.275.072.376-.044.101-.116.433-.506.549-.68.116-.173.231-.144.39-.086s1.011.477 1.184.564.289.13.332.202c.043.073.043.419-.101.824z"/>
              </svg>
              <span>WhatsApp Order</span>
            </button>

            {/* Sun / Moon Theme Toggle */}
            <ThemeToggle />

            {/* ⚙️ Staff Admin Link */}
            <Link
              href="/admin"
              className="px-3.5 py-2 text-rose-600 dark:text-rose-400 border border-rose-500/30 hover:bg-rose-500/10 font-bold rounded-xl text-xs flex items-center gap-1.5 transition active:scale-95"
              title="Open Staff Admin Inventory Manager"
            >
              <Lock className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Admin</span>
            </Link>

            {/* User Session Info / Sign Out */}
            {currentUser ? (
              <div className="flex items-center gap-1.5 pl-1 border-l border-zinc-200 dark:border-slate-800">
                <span className="text-xs font-semibold text-zinc-700 dark:text-slate-300 hidden md:inline truncate max-w-[100px]">
                  {currentUser.email?.split("@")[0]}
                </span>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="p-1.5 text-zinc-400 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 transition"
                  title="Sign Out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        
        {/* 2. Hero Search Section */}
        <section className="text-center space-y-5 max-w-4xl mx-auto pt-2">
          {/* Centered Badge */}
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-white dark:bg-slate-900 border border-zinc-200 dark:border-slate-800 text-xs font-bold text-zinc-600 dark:text-slate-300 shadow-sm">
            <span className="text-rose-500">📋</span>
            <span>Internal Inventory Search Tool</span>
          </div>

          {/* Title */}
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight leading-tight">
            <span className="text-zinc-950 dark:text-white">Find </span>
            <span className="text-[#E11D48]">ScreenGuard </span>
            <span className="text-[#0F172A] dark:text-slate-200">Box</span>
          </h1>

          {/* Subtitle */}
          <p className="text-xs sm:text-sm md:text-base text-zinc-500 dark:text-slate-400 max-w-2xl mx-auto font-medium">
            Search any phone model to instantly find its BOX NUMBER and all compatible models inside.
          </p>

          {/* Nav Mode Tabs */}
          <div className="flex items-center justify-center gap-2 p-1 rounded-2xl bg-zinc-200/60 dark:bg-slate-900/80 border border-zinc-200 dark:border-slate-800 max-w-sm mx-auto shadow-inner">
            <button
              type="button"
              onClick={() => setNavMode("search")}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                navMode === "search"
                  ? "bg-white dark:bg-slate-800 text-zinc-900 dark:text-white shadow-sm"
                  : "text-zinc-600 dark:text-slate-400 hover:text-zinc-900 dark:hover:text-white"
              }`}
            >
              <span>🎯</span>
              <span>Targeted Search</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setNavMode("all");
                setQuery("");
              }}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                navMode === "all"
                  ? "bg-white dark:bg-slate-800 text-zinc-900 dark:text-white shadow-sm"
                  : "text-zinc-600 dark:text-slate-400 hover:text-zinc-900 dark:hover:text-white"
              }`}
            >
              <span>🗂️</span>
              <span>All Boxes ({activeBoxCount})</span>
            </button>
          </div>

          {/* Centered Large Search Bar */}
          <div className="space-y-3 pt-1">
              <SearchBar
                value={query}
                onChange={(val) => {
                  setQuery(val);
                  if (navMode !== "search") setNavMode("search");
                }}
                recentSearches={recentSearches}
                onSelectRecent={(val) => {
                  setQuery(val);
                  setNavMode("search");
                }}
                onClearRecent={handleClearRecent}
              />

              {/* Quick Search Chips */}
              <div className="flex items-center justify-center gap-1.5 flex-wrap pt-1 text-xs">
                <span className="text-zinc-400 dark:text-slate-500 font-semibold text-[11px] mr-1">
                  Popular:
                </span>
                {QUICK_SEARCH_CHIPS.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => handleChipClick(chip)}
                    className="px-2.5 py-1 rounded-xl bg-white hover:bg-zinc-100 text-zinc-700 dark:bg-slate-900 dark:hover:bg-slate-800 dark:text-slate-300 border border-zinc-200 dark:border-slate-800 font-medium text-[11px] transition shadow-sm active:scale-95"
                  >
                    {chip}
                  </button>
                ))}
              </div>

              {/* Brand Filter Pill Strip below Search */}
              <div className="flex items-center justify-center gap-1.5 flex-wrap pt-1">
                {BRAND_FILTERS.map((brand) => {
                  const isSelected = selectedBrand === brand;
                  return (
                    <button
                      key={brand}
                      type="button"
                      onClick={() => setSelectedBrand(brand)}
                      className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                        isSelected
                          ? "bg-rose-600 text-white shadow-md shadow-rose-600/20 ring-2 ring-rose-500/30"
                          : "bg-white hover:bg-zinc-100 text-zinc-600 hover:text-zinc-900 border border-zinc-200 shadow-sm dark:bg-[#111827] dark:hover:bg-slate-800 dark:text-slate-400 dark:hover:text-white dark:border-slate-800"
                      }`}
                    >
                      {brand}
                    </button>
                  );
                })}
              </div>
            </div>
        </section>

        {/* 3. Hero Shortcut Card (Rendered when navMode === "search" and query is empty) */}
        {navMode === "search" && !query.trim() && (
          <div className="space-y-6 pt-2">
            <div className="max-w-md mx-auto">
              {/* Single Card: View All 163 Boxes */}
              <div
                onClick={() => {
                  setNavMode("all");
                  setQuery("");
                }}
                className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-zinc-200 dark:border-slate-800 hover:border-rose-400 dark:hover:border-rose-500 shadow-sm hover:shadow-md transition cursor-pointer group flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Package className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-zinc-900 dark:text-white flex items-center justify-between">
                      <span>View All {activeBoxCount} Boxes</span>
                      <ArrowRight className="w-4 h-4 text-zinc-400 group-hover:text-rose-600 group-hover:translate-x-1 transition" />
                    </h3>
                    <p className="text-xs text-zinc-500 dark:text-slate-400 mt-1">
                      Browse complete catalog with live variant stock counts.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Keyboard Shortcut Hint */}
            <div className="text-center pt-2">
              <span className="text-[11px] font-mono text-zinc-400 dark:text-slate-500 px-3 py-1 rounded-full bg-zinc-100 dark:bg-slate-900 border border-zinc-200 dark:border-slate-800 inline-block">
                Press <kbd className="font-bold text-zinc-700 dark:text-slate-300">/</kbd> to search • <kbd className="font-bold text-zinc-700 dark:text-slate-300">Alt+B</kbd> all boxes • <kbd className="font-bold text-zinc-700 dark:text-slate-300">Esc</kbd> to dismiss
              </span>
            </div>
          </div>
        )}

        {/* 4. Search Results Header & Card Grid */}
        <div className="space-y-4 pt-1">
            {/* Results Metrics Subheader */}
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-slate-800/80 pb-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-extrabold uppercase tracking-wider text-zinc-500 dark:text-slate-400 flex items-center gap-1.5">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-rose-500" />
                  {query
                    ? `Results for "${query}"`
                    : navMode === "all"
                    ? `All Master Boxes (${results.length})`
                    : "Master Box Inventory"}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-slate-800 text-rose-600 dark:text-rose-400 font-black text-xs border border-zinc-200 dark:border-slate-700">
                  {results.length} boxes
                </span>
              </div>

              {(query || selectedBrand !== "All") && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setSelectedBrand("All");
                  }}
                  className="text-xs font-bold text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 hover:underline flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" /> Reset
                </button>
              )}
            </div>

            {/* High-Density 2-Column Result Cards Grid */}
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[1, 2, 3, 4].map((n) => (
                  <div
                    key={n}
                    className="w-full h-48 rounded-2xl bg-white dark:bg-slate-900 border border-zinc-200 dark:border-slate-800 animate-pulse p-5 shadow-sm"
                  />
                ))}
              </div>
            ) : results.length === 0 ? (
              <div className="text-center py-16 px-4 bg-white dark:bg-slate-900/60 rounded-3xl border border-zinc-200 dark:border-slate-800 space-y-4 max-w-lg mx-auto shadow-sm">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 dark:text-amber-400 flex items-center justify-center mx-auto border border-amber-500/20">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                    No matching screen guard box found
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-slate-400 mt-1">
                    Try searching a partial model like &quot;A05&quot;, &quot;Note 13&quot;, or tap WhatsApp Order.
                  </p>
                </div>
                <div className="flex items-center justify-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setQuery("");
                      setSelectedBrand("All");
                    }}
                    className="px-4 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-zinc-700 dark:text-slate-300 text-xs font-bold transition"
                  >
                    Clear Filters
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setWhatsAppModel(query.trim());
                      setIsWhatsAppModalOpen(true);
                    }}
                    className="px-4 py-2 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-white text-xs font-bold transition flex items-center gap-1 shadow-sm"
                  >
                    <Zap className="w-3.5 h-3.5" /> Order via WhatsApp
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {results.map((res) => (
                  <ResultCard
                    key={res.item.id}
                    result={res}
                    searchQuery={query}
                    allBoxes={boxes}
                    onStockUpdate={loadData}
                    onSelectBox={(boxNo) => setQuery(boxNo)}
                    onRequestDeadStockOrder={(model) => {
                      setWhatsAppModel(model);
                      setIsWhatsAppModalOpen(true);
                    }}
                    onRequestWasteLog={(b) => setWasteTargetBox(b)}
                    onQueueA4Label={(b) => {
                      setA4TargetBox(b);
                      setIsA4ModalOpen(true);
                    }}
                  />
                ))}
              </div>
            )}
          </div>
      </main>

      {/* Immediate WhatsApp Supplier Dispatcher Modal */}
      <WhatsAppOrderModal
        isOpen={isWhatsAppModalOpen}
        onClose={() => setIsWhatsAppModalOpen(false)}
        initialModel={whatsAppModel}
        catalogModels={allCatalogModels}
      />

      {/* Waste Tracker Modal */}
      <WasteTrackerModal
        isOpen={!!wasteTargetBox}
        onClose={() => setWasteTargetBox(null)}
        box={wasteTargetBox}
        onWasteRecorded={async () => {
          await loadData();
        }}
      />

      {/* A4 Label Print Studio Modal */}
      <A4LabelPrintModal
        isOpen={isA4ModalOpen}
        onClose={() => {
          setIsA4ModalOpen(false);
          setA4TargetBox(null);
        }}
        allBoxes={boxes}
        initialBox={a4TargetBox}
      />

      {/* Footer */}
      <footer className="border-t border-zinc-200 dark:border-slate-800/80 py-6 text-center text-xs text-zinc-500 dark:text-slate-400 bg-white dark:bg-slate-950">
        <p>© 2026 UZEE TECH ScreenGuard Finder • High-Density Retail Counter Terminal</p>
      </footer>
    </div>
  );
}
