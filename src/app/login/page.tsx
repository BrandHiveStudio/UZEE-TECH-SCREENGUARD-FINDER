"use client";

import { useState, Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Mail, Lock, Eye, EyeOff, LogIn, AlertCircle, Loader2 } from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = searchParams.get("redirect") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError("Please fill in both email and password.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
          rememberMe,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Login failed. Please check your credentials.");
        return;
      }

      // Successful login -> redirect to original destination
      router.push(redirectPath);
      router.refresh();
    } catch {
      setError("Unable to connect to the server. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-sm animate-fade-in">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Email Input */}
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
          Email Address
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Mail className="w-4 h-4" />
          </div>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            placeholder="uzeetechcare@gmail.com"
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm font-medium transition-all"
          />
        </div>
      </div>

      {/* Password Input */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Password
          </label>
          <Link
            href="/forgot-password"
            className="text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline"
          >
            Forgot Password?
          </Link>
        </div>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Lock className="w-4 h-4" />
          </div>
          <input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
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

      {/* Remember Me */}
      <div className="flex items-center">
        <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-600 dark:text-slate-400 select-none">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            className="rounded border-slate-300 dark:border-slate-700 text-brand-600 focus:ring-brand-500 h-4 w-4"
          />
          <span>Remember me (30 days)</span>
        </label>
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 px-4 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-brand-700 to-brand-600 hover:from-brand-800 hover:to-brand-700 shadow-md hover:shadow-lg disabled:opacity-60 transition-all flex items-center justify-center gap-2 active:scale-[0.99]"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Signing in...</span>
          </>
        ) : (
          <>
            <LogIn className="w-4 h-4" />
            <span>Sign In to ScreenGuard Finder</span>
          </>
        )}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col justify-center items-center px-4 py-12 bg-slate-50 dark:bg-slate-950">
      <div className="w-full max-w-md">
        {/* Branding Card */}
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
            <span className="text-brand-700 dark:text-brand-400">UZEE</span> TECH
          </h1>
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 mt-1">
            Internal Compatibility &amp; Stock Portal
          </p>
        </div>

        {/* Auth Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Employee Sign In
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Enter your authorized credentials to access box matching &amp; inventory.
            </p>
          </div>

          <Suspense
            fallback={
              <div className="py-12 flex justify-center text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            }
          >
            <LoginForm />
          </Suspense>
        </div>

        <div className="text-center mt-6 text-xs text-slate-400">
          UZEE TECH &bull; Internal Company System &bull; Authorized Personnel Only
        </div>
      </div>
    </div>
  );
}
