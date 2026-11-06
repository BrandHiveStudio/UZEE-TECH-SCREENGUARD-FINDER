"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import { Search, X, Mic, MicOff, Clock } from "lucide-react";

interface SearchBarProps {
  value: string;
  onChange: (val: string) => void;
  recentSearches: string[];
  onSelectRecent: (query: string) => void;
  onClearRecent: () => void;
}

export function SearchBar({
  value,
  onChange,
  recentSearches,
  onSelectRecent,
  onClearRecent,
}: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Keyboard shortcut: Press "/" to focus
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement !== inputRef.current) {
        e.preventDefault();
        inputRef.current?.focus();
      } else if (e.key === "Escape" && document.activeElement === inputRef.current) {
        onChange("");
        inputRef.current?.blur();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onChange]);

  // Voice Search Handler
  const toggleVoiceSearch = useCallback(() => {
    const SpeechRecognition =
      (window as unknown as { SpeechRecognition?: any; webkitSpeechRecognition?: any })
        .SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: any }).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Voice Search is not supported on this browser. Try Google Chrome.");
      return;
    }

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = "en-US";
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0]?.[0]?.transcript;
        if (transcript) {
          onChange(transcript);
        }
        setIsListening(false);
      };

      recognition.onerror = () => {
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      setIsListening(false);
    }
  }, [isListening, onChange]);

  return (
    <div className="w-full max-w-4xl mx-auto space-y-2.5">
      {/* Modern High-Density Glassmorphic Search Bar */}
      <div className="relative group">
        <div className="absolute inset-y-0 left-0 pl-4 sm:pl-5 flex items-center pointer-events-none text-zinc-400 dark:text-slate-400 group-focus-within:text-brand-600 dark:group-focus-within:text-brand-500 transition-colors">
          <Search className="w-5 h-5 sm:w-6 sm:h-6" />
        </div>

        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Search model, series, or box number... (e.g. Samsung A05, BOX 048, Redmi 13C)"
          className="w-full pl-12 sm:pl-14 pr-24 py-4 sm:py-4.5 rounded-2xl bg-white dark:bg-[#1E293B] border border-zinc-300 dark:border-slate-700 text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-slate-500 font-medium text-base sm:text-lg shadow-sm dark:shadow-xl focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-red-500 transition-all duration-200"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck="false"
        />

        {/* Right Action Icons: Microphone + Clear + Shortcut */}
        <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center gap-1.5">
          {/* Voice Search Button */}
          <button
            type="button"
            onClick={toggleVoiceSearch}
            className={`p-2 rounded-xl transition ${
              isListening
                ? "bg-rose-600 text-white animate-pulse"
                : "text-zinc-400 hover:text-zinc-800 hover:bg-zinc-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800"
            }`}
            title={isListening ? "Listening... Speak model name" : "Voice search microphone"}
          >
            {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          {/* Clear or Keyboard Shortcut Pill */}
          {value ? (
            <button
              type="button"
              onClick={() => {
                onChange("");
                inputRef.current?.focus();
              }}
              className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-800 hover:bg-zinc-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800 transition"
              title="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          ) : (
            <div className="hidden sm:flex items-center pointer-events-none">
              <kbd className="px-2 py-0.5 text-[11px] font-black text-zinc-500 dark:text-slate-400 bg-zinc-100 dark:bg-slate-800/80 border border-zinc-200 dark:border-slate-700/80 rounded-md">
                /
              </kbd>
            </div>
          )}
        </div>
      </div>

      {/* Recent Searches Tags Strip */}
      {recentSearches.length > 0 && !value && (
        <div className="flex items-center justify-between gap-2 px-1 text-xs text-zinc-500 dark:text-slate-400 animate-in fade-in">
          <div className="flex items-center gap-2 overflow-x-auto py-1 scrollbar-none">
            <span className="flex items-center gap-1 font-semibold text-zinc-400 dark:text-slate-500 shrink-0 text-[11px]">
              <Clock className="w-3.5 h-3.5" /> Recent:
            </span>
            {recentSearches.map((item, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => onSelectRecent(item)}
                className="shrink-0 px-2.5 py-0.5 rounded-lg bg-white dark:bg-slate-900 border border-zinc-200 dark:border-slate-800 hover:border-zinc-300 dark:hover:border-slate-700 text-zinc-700 dark:text-slate-300 font-medium text-xs transition shadow-sm"
              >
                {item}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={onClearRecent}
            className="shrink-0 text-[11px] text-zinc-400 hover:text-rose-500 dark:text-slate-500 dark:hover:text-rose-400 transition"
          >
            Clear
          </button>
        </div>
      )}
    </div>
  );
}
