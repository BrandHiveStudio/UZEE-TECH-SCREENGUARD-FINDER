"use client";

import Image from "next/image";
import Link from "next/link";
import { Settings, Sun, Moon, Sparkles, LogOut, User } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function Header({ totalBoxes }: { totalBoxes?: number }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ id: string; email: string } | null>(null);

  useEffect(() => {
    setMounted(true);
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

          {/* Theme Toggle */}
          {mounted && (
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="p-2.5 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Toggle theme"
              title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              {theme === "dark" ? (
                <Sun className="w-5 h-5 text-amber-400" />
              ) : (
                <Moon className="w-5 h-5 text-slate-600" />
              )}
            </button>
          )}

          {/* Admin Gear Button with Label */}
          <Link
            href="/admin"
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800/80 hover:bg-brand-50 dark:hover:bg-brand-950/50 text-slate-700 dark:text-slate-200 hover:text-brand-700 dark:hover:text-brand-400 border border-slate-200/60 dark:border-slate-700/60 font-bold text-xs sm:text-sm transition-all duration-200 group shadow-sm"
            title="Open Admin Dashboard"
            aria-label="Admin Dashboard"
          >
            <Settings className="w-4 h-4 transition-transform duration-300 group-hover:rotate-45 text-brand-700 dark:text-brand-400" />
            <span>Admin</span>
          </Link>

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
    </header>
  );
}
