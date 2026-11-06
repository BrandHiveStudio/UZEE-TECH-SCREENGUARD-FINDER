"use client";

import Image from "next/image";
import Link from "next/link";
import { Settings, Sparkles, LogOut, User } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { WhatsAppOrderModal } from "@/components/WhatsAppOrderModal";
import { useEffect, useState } from "react";

export function Header({ totalBoxes }: { totalBoxes?: number }) {
  const [currentUser, setCurrentUser] = useState<{ id: string; email: string } | null>(null);
  const [isWhatsAppOpen, setIsWhatsAppOpen] = useState(false);

  useEffect(() => {
    // Fetch current user session
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
      window.location.href = "/login";
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 dark:border-slate-800/80 glass-panel shadow-sm">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between">
        {/* Logo & Branding */}
        <Link
          href="/"
          className="flex items-center gap-3.5 group transition-transform duration-200 active:scale-95"
        >
          {/* Official Logo — white card container */}
          <div className="relative h-12 sm:h-14 w-auto rounded-2xl overflow-hidden px-2.5 py-1.5 bg-white border border-slate-200/90 shadow-md group-hover:shadow-lg transition-all shrink-0 flex items-center justify-center">
            <Image
              src="/uzee_tech_official_logo.png"
              alt="UZEE TECH Official Logo"
              width={200}
              height={56}
              className="object-contain h-9 sm:h-10 w-auto"
              priority
            />
          </div>

          {/* Company Name & Subtitle */}
          <div className="flex flex-col justify-center">
            <span className="font-black text-lg sm:text-xl tracking-tight leading-tight">
              <span className="text-brand-700 dark:text-brand-400">UZEE</span>
              <span className="text-slate-900 dark:text-white"> TECH</span>
            </span>
            <span className="text-[11px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400 leading-tight tracking-wide">
              ScreenGuard Finder
            </span>
          </div>
        </Link>

        {/* Right Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {totalBoxes !== undefined && (
            <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800/70 border border-slate-200/60 dark:border-slate-700/60 text-xs font-semibold text-slate-600 dark:text-slate-300">
              <Sparkles className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
              <span>{totalBoxes} Active Boxes</span>
            </div>
          )}

          {/* WhatsApp Order Button */}
          <button
            type="button"
            onClick={() => setIsWhatsAppOpen(true)}
            className="flex items-center gap-2 bg-[#25D366] hover:bg-[#20bd5a] text-white px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold shadow-sm transition-all active:scale-95"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.007c.106.005.249-.04.39.298.144.347.491 1.2.534 1.287.043.087.072.188.014.303-.058.116-.087.188-.173.289l-.26.303c-.087.087-.177.182-.076.356.101.174.449.741.964 1.201.662.591 1.221.774 1.394.86.173.086.275.072.376-.044.101-.116.433-.506.549-.68.116-.173.231-.144.39-.086s1.011.477 1.184.564.289.13.332.202c.043.073.043.419-.101.824z"/>
            </svg>
            <span className="hidden sm:inline">WhatsApp Order</span>
          </button>

          {/* Reorder PO Link */}
          <Link
            href="/admin/restock"
            className="hidden md:flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-zinc-100 text-zinc-800 border border-zinc-300 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 dark:border-slate-700 font-bold text-xs transition-all shadow-sm"
            title="Low-Stock Reorder Hub & PO Generator"
          >
            <span>📋</span>
            <span>Reorder PO</span>
          </Link>

          {/* Admin Button: Red outline matching UZEE TECH logo red */}
          <Link
            href="/admin"
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-red-600 dark:text-red-400 border border-red-500/30 hover:bg-red-500/10 font-bold text-xs sm:text-sm transition-all duration-200 group shadow-sm"
            title="Open Admin Dashboard"
            aria-label="Admin Dashboard"
          >
            <Settings className="w-4 h-4 transition-transform duration-300 group-hover:rotate-45 text-red-600 dark:text-red-400" />
            <span>Admin</span>
          </Link>

          {/* Theme Toggle */}
          <ThemeToggle />

          {/* User / Sign Out */}
          {currentUser && (
            <div className="flex items-center gap-1.5 pl-1">
              <div
                className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 text-xs font-semibold max-w-[160px] truncate"
                title={currentUser.email}
              >
                <User className="w-3.5 h-3.5 shrink-0 text-brand-600 dark:text-brand-400" />
                <span className="truncate">{currentUser.email.split("@")[0]}</span>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 sm:px-3 sm:py-2 rounded-xl bg-slate-100 dark:bg-slate-800/80 hover:bg-red-50 dark:hover:bg-red-950/40 text-slate-600 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-400 border border-slate-200/60 dark:border-slate-700/60 font-bold text-xs transition-colors flex items-center gap-1.5 shadow-sm"
                title="Sign Out"
                aria-label="Sign Out"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>

      <WhatsAppOrderModal
        isOpen={isWhatsAppOpen}
        onClose={() => setIsWhatsAppOpen(false)}
        initialModel=""
      />
    </header>
  );
}
