"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock, AlertCircle, Loader2, KeyRound, Mail, ArrowRight, ShieldCheck } from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = searchParams.get("redirect") || "/";

  // Passcode Settings
  const [passcodeLength, setPasscodeLength] = useState<4 | 6>(6);
  const [digits, setDigits] = useState<string[]>(Array(6).fill(""));
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recoveryEmail, setRecoveryEmail] = useState("uzeetechcare@gmail.com");

  // Mode toggle: PIN (default) vs Email/Password fallback
  const [loginMode, setLoginMode] = useState<"PIN" | "PASSWORD">("PIN");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  // Fetch active terminal passcode configuration
  useEffect(() => {
    fetch("/api/admin/auth-settings")
      .then((res) => res.json())
      .then((data) => {
        if (data.passcodeLength === 4 || data.passcodeLength === 6) {
          setPasscodeLength(data.passcodeLength);
          setDigits(Array(data.passcodeLength).fill(""));
        }
        if (data.recoveryEmail) {
          setRecoveryEmail(data.recoveryEmail);
        }
      })
      .catch(() => {});
  }, []);

  // Auto-focus slot 0 on load
  useEffect(() => {
    if (loginMode === "PIN") {
      const timer = setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [loginMode, passcodeLength]);

  // Submit PIN login
  const submitPin = async (pinValue: string) => {
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pin: pinValue,
          rememberMe,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Incorrect terminal passcode.");
        setDigits(Array(passcodeLength).fill(""));
        inputRefs.current[0]?.focus();
        return;
      }

      router.push(redirectPath);
      router.refresh();
    } catch {
      setError("Unable to connect to the terminal authentication server.");
    } finally {
      setLoading(false);
    }
  };

  // Handle code paste or multi-character autofill
  const handlePastedCode = (rawText: string) => {
    const pasted = rawText.replace(/\D/g, "").slice(0, passcodeLength);
    if (!pasted) return;

    const newDigits = Array(passcodeLength).fill("");
    for (let i = 0; i < pasted.length; i++) {
      newDigits[i] = pasted[i];
    }
    setDigits(newDigits);

    if (pasted.length === passcodeLength) {
      inputRefs.current[passcodeLength - 1]?.focus();
      submitPin(pasted);
    } else {
      inputRefs.current[pasted.length]?.focus();
    }
  };

  // Handle single digit input
  const handleDigitChange = (index: number, val: string) => {
    if (!val) {
      const newDigits = [...digits];
      newDigits[index] = "";
      setDigits(newDigits);
      return;
    }

    // Only accept numeric characters
    const cleanChars = val.replace(/\D/g, "");
    if (!cleanChars) return;

    // Handle multi-character entry (paste or autocomplete)
    if (cleanChars.length > 1) {
      handlePastedCode(cleanChars);
      return;
    }

    const cleanChar = cleanChars.slice(-1);
    const newDigits = [...digits];
    newDigits[index] = cleanChar;
    setDigits(newDigits);

    if (cleanChar) {
      // Advance focus to next input
      if (index < passcodeLength - 1) {
        inputRefs.current[index + 1]?.focus();
      } else {
        // Final digit entered -> Auto submit
        const fullPin = newDigits.join("");
        if (fullPin.length === passcodeLength) {
          submitPin(fullPin);
        }
      }
    }
  };

  // Handle keyboard events (backspace navigation)
  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (!digits[index]) {
        // If Backspace is pressed on an empty slot, focus previous slot and clear it
        if (index > 0) {
          e.preventDefault();
          const newDigits = [...digits];
          newDigits[index - 1] = "";
          setDigits(newDigits);
          inputRefs.current[index - 1]?.focus();
        }
      } else {
        // If slot currently has a digit, clear it
        const newDigits = [...digits];
        newDigits[index] = "";
        setDigits(newDigits);
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      e.preventDefault();
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < passcodeLength - 1) {
      e.preventDefault();
      inputRefs.current[index + 1]?.focus();
    }
  };

  // Handle paste of complete 4/6 digit code into any slot
  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text");
    handlePastedCode(pasted);
  };

  // Handle fallback email/password submit
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
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
        setError(data.error || "Login failed.");
        return;
      }

      router.push(redirectPath);
      router.refresh();
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs sm:text-sm animate-fade-in">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {loginMode === "PIN" ? (
        <div className="space-y-5">
          <div className="text-center">
            <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Enter {passcodeLength}-Digit Terminal Passcode
            </label>
          </div>

          {/* Discrete 4 or 6 PIN boxes */}
          <div
            className={`flex items-center justify-center gap-2 sm:gap-3 ${
              passcodeLength === 4 ? "max-w-xs mx-auto" : "max-w-sm mx-auto"
            }`}
          >
            {Array.from({ length: passcodeLength }).map((_, idx) => (
              <input
                key={idx}
                ref={(el) => {
                  inputRefs.current[idx] = el;
                }}
                type="password"
                inputMode="numeric"
                maxLength={1}
                pattern="[0-9]*"
                autoComplete="one-time-code"
                value={digits[idx] || ""}
                onChange={(e) => handleDigitChange(idx, e.target.value)}
                onKeyDown={(e) => handleKeyDown(idx, e)}
                onPaste={handlePaste}
                onFocus={(e) => e.target.select()}
                disabled={loading}
                className={`w-11 sm:w-13 h-14 sm:h-16 text-center text-2xl sm:text-3xl font-mono font-black rounded-2xl border-2 transition-all shadow-sm focus:outline-none ${
                  digits[idx]
                    ? "border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-2 ring-emerald-500/20"
                    : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/90 text-slate-900 dark:text-white focus:border-brand-500 focus:ring-4 focus:ring-brand-500/20"
                }`}
              />
            ))}
          </div>

          {/* Quick Clear / Numeric keypad prompt */}
          <div className="flex items-center justify-between text-xs pt-1">
            <button
              type="button"
              onClick={() => {
                setDigits(Array(passcodeLength).fill(""));
                inputRefs.current[0]?.focus();
              }}
              className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-semibold"
            >
              Clear Digits
            </button>

            <a
              href={`mailto:${recoveryEmail}?subject=UZEE%20TECH%20Passcode%20Reset%20Request`}
              className="text-brand-600 dark:text-brand-400 font-bold hover:underline"
            >
              Forgot Passcode?
            </a>
          </div>

          {/* Remember terminal checkbox */}
          <div className="pt-2">
            <label className="flex items-center gap-2.5 cursor-pointer text-xs font-medium text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 accent-brand-600"
              />
              <span>Remember this counter terminal (30 days)</span>
            </label>
          </div>

          {/* Manual Submit Button if user pastes or prefers clicking */}
          <button
            type="button"
            onClick={() => submitPin(digits.join(""))}
            disabled={digits.join("").length !== passcodeLength || loading}
            className="w-full py-3.5 rounded-2xl bg-slate-900 hover:bg-black dark:bg-brand-600 dark:hover:bg-brand-500 text-white font-black text-xs sm:text-sm shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-40"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Verifying Passcode...</span>
              </>
            ) : (
              <>
                <KeyRound className="w-4 h-4 text-amber-400" />
                <span>Unlock Terminal</span>
              </>
            )}
          </button>
        </div>
      ) : (
        /* Fallback Email/Password Form */
        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-medium"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-brand-700 text-white font-bold text-xs shadow-md"
          >
            {loading ? "Authenticating..." : "Sign In with Password"}
          </button>
        </form>
      )}

      {/* Switch between PIN and Password Mode */}
      <div className="pt-2 text-center border-t border-slate-200/60 dark:border-slate-800/80">
        <button
          type="button"
          onClick={() => {
            setError(null);
            setLoginMode(loginMode === "PIN" ? "PASSWORD" : "PIN");
          }}
          className="text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
        >
          {loginMode === "PIN" ? "Switch to Email & Password Login" : "Switch to Fast Numerical PIN"}
        </button>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4 relative overflow-hidden">
      {/* Decorative background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800/80 rounded-3xl shadow-2xl p-6 sm:p-8 space-y-6 relative backdrop-blur-xl">
        {/* Brand Header */}
        <div className="text-center space-y-3">
          <div className="relative h-14 w-auto inline-block rounded-2xl overflow-hidden px-3 py-1.5 bg-white border border-slate-200/90 shadow-md">
            <Image
              src="/uzee_tech_official_logo.png"
              alt="UZEE TECH"
              width={180}
              height={50}
              className="object-contain h-10 w-auto mx-auto"
              priority
            />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Terminal Passcode Authentication
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">
              ScreenGuard Finder • Internal Retail Counter Access
            </p>
          </div>
        </div>

        <Suspense
          fallback={
            <div className="py-12 flex justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
            </div>
          }
        >
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
