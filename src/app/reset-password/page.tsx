"use client";

import { useState, Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Lock, Eye, EyeOff, CheckCircle2, AlertCircle, Loader2, ArrowLeft } from "lucide-react";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!token) {
    return (
      <div className="text-center py-4 space-y-4">
        <div className="inline-flex p-3 rounded-full bg-red-500/10 text-red-500">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
          Missing Reset Token
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          The link you followed is invalid or incomplete. Please request a new password reset link.
        </p>
        <div className="pt-2">
          <Link
            href="/forgot-password"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm text-white bg-brand-700 hover:bg-brand-800 transition-all"
          >
            Request New Link
          </Link>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          newPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to reset password.");
        return;
      }

      setSuccess(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="text-center py-4 space-y-4 animate-fade-in">
        <div className="inline-flex p-3 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="w-8 h-8" />
        </div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
          Password Reset Complete
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Your password has been successfully updated. You can now sign in with your new credentials.
        </p>
        <div className="pt-4">
          <Link
            href="/login"
            className="inline-flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-brand-700 to-brand-600 hover:from-brand-800 shadow-md"
          >
            <span>Proceed to Sign In</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* New Password */}
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
          New Password (min. 6 chars)
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Lock className="w-4 h-4" />
          </div>
          <input
            type={showPassword ? "text" : "password"}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={6}
            placeholder="••••••••"
            className="w-full pl-10 pr-11 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm font-medium transition-all"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            tabIndex={-1}
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Confirm Password */}
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
          Confirm New Password
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Lock className="w-4 h-4" />
          </div>
          <input
            type={showPassword ? "text" : "password"}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={6}
            placeholder="••••••••"
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm font-medium transition-all"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 px-4 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-brand-700 to-brand-600 hover:from-brand-800 hover:to-brand-700 shadow-md hover:shadow-lg disabled:opacity-60 transition-all flex items-center justify-center gap-2 active:scale-[0.99]"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Updating password...</span>
          </>
        ) : (
          <span>Set New Password</span>
        )}
      </button>

      <div className="text-center pt-2">
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Sign In</span>
        </Link>
      </div>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex flex-col justify-center items-center px-4 py-12 bg-slate-50 dark:bg-slate-950">
      <div className="w-full max-w-md">
        {/* Branding Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-3 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-lg mb-4">
            <Image
              src="/uzee_tech_official_logo.png"
              alt="UZEE TECH Official Logo"
              width={160}
              height={50}
              className="h-10 w-auto object-contain"
              priority
            />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            <span className="text-brand-700 dark:text-brand-400">Set New</span> Password
          </h1>
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 mt-1">
            UZEE TECH ScreenGuard Finder
          </p>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl">
          <Suspense
            fallback={
              <div className="py-12 flex justify-center text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            }
          >
            <ResetPasswordForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
