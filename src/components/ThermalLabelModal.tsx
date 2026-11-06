"use client";

import { useState, useEffect } from "react";
import { X, Printer, QrCode, Tag, Check, Sliders } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import type { Box } from "@/types/screenguard";

interface ThermalLabelModalProps {
  isOpen: boolean;
  onClose: () => void;
  box: Box | null;
  allBoxes?: Box[];
}

export function ThermalLabelModal({ isOpen, onClose, box, allBoxes = [] }: ThermalLabelModalProps) {
  const [labelSize, setLabelSize] = useState<"50x30" | "80mm">("50x30");
  const [copies, setCopies] = useState<number>(1);
  const [originUrl, setOriginUrl] = useState("");
  const [selectedBoxId, setSelectedBoxId] = useState<string>("");

  useEffect(() => {
    if (box) {
      setSelectedBoxId(box.id);
    } else if (allBoxes && allBoxes.length > 0) {
      setSelectedBoxId(allBoxes[0].id);
    }
  }, [box, allBoxes]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOriginUrl(window.location.origin);
    }
  }, []);

  const currentBox =
    (allBoxes && allBoxes.find((b) => b.id === selectedBoxId)) ||
    box ||
    (allBoxes && allBoxes[0]) ||
    null;

  if (!isOpen || !currentBox) return null;

  const qrUrl = `${originUrl || "https://finder.uzeetech.com.lk"}/?q=${encodeURIComponent(
    currentBox.boxNumber
  )}`;

  const topAliases = (currentBox.compatibleModels || [])
    .slice(0, labelSize === "50x30" ? 5 : 8)
    .join(", ");

  const handlePrint = () => {
    window.print();
  };

  return (
    <>
      {/* Print-specific CSS styles */}
      <style jsx global>{`
        @media print {
          /* Hide everything except the thermal print area */
          body * {
            visibility: hidden !important;
          }
          #thermal-print-area,
          #thermal-print-area * {
            visibility: visible !important;
          }
          #thermal-print-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: ${labelSize === "50x30" ? "50mm" : "80mm"} !important;
            margin: 0 !important;
            padding: ${labelSize === "50x30" ? "2mm" : "4mm"} !important;
            background: #ffffff !important;
            color: #000000 !important;
            box-shadow: none !important;
            border: none !important;
          }
          @page {
            size: ${labelSize === "50x30" ? "50mm 30mm" : "80mm auto"};
            margin: 0mm;
          }
        }
      `}</style>

      {/* Screen Modal Overlay */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-md animate-fade-in print:hidden">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-scale-in">
          {/* Header */}
          <div className="px-5 py-4 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-between border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
                <Printer className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-base tracking-tight leading-tight flex items-center gap-2">
                  Thermal Box Label
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full">
                    POS / Xprinter
                  </span>
                </h3>
                <p className="text-xs text-slate-400 font-medium">
                  High-contrast black & white format for 50mm / 80mm printers
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Options Bar */}
          <div className="px-5 py-3 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
            {allBoxes && allBoxes.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-500 dark:text-slate-400">Target Box:</span>
                <select
                  value={currentBox.id}
                  onChange={(e) => setSelectedBoxId(e.target.value)}
                  className="max-w-[170px] truncate px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-bold text-xs text-slate-800 dark:text-slate-200 outline-none focus:ring-1 focus:ring-amber-500"
                >
                  {allBoxes.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.boxNumber} - {b.title}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-500 dark:text-slate-400">Format:</span>
              <div className="flex rounded-xl bg-slate-200/80 dark:bg-slate-700/80 p-0.5 font-bold">
                <button
                  type="button"
                  onClick={() => setLabelSize("50x30")}
                  className={`px-3 py-1 rounded-lg transition-all ${
                    labelSize === "50x30"
                      ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm"
                      : "text-slate-600 dark:text-slate-300"
                  }`}
                >
                  50mm x 30mm
                </button>
                <button
                  type="button"
                  onClick={() => setLabelSize("80mm")}
                  className={`px-3 py-1 rounded-lg transition-all ${
                    labelSize === "80mm"
                      ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm"
                      : "text-slate-600 dark:text-slate-300"
                  }`}
                >
                  80mm Receipt
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-500 dark:text-slate-400">Copies:</span>
              <input
                type="number"
                min="1"
                max="20"
                value={copies}
                onChange={(e) => setCopies(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-14 px-2 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-center font-bold text-xs"
              />
            </div>
          </div>

          {/* Label Preview Container */}
          <div className="p-6 bg-slate-200/50 dark:bg-slate-950 flex flex-col items-center justify-center overflow-y-auto flex-1">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
              Label Live Preview
            </p>

            {/* The Print Artifact (Rendered on screen and printable directly) */}
            <div
              id="thermal-print-area"
              className={`bg-white text-black border-2 border-dashed border-slate-400 rounded-lg p-3 font-mono select-none shadow-md ${
                labelSize === "50x30"
                  ? "w-[320px] min-h-[190px]"
                  : "w-[360px] min-h-[260px]"
              }`}
              style={{
                fontFamily: "Courier, 'Courier New', monospace",
              }}
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-black pb-1 mb-1">
                <span className="font-black text-[11px] tracking-wider uppercase">
                  UZEE TECH SCREENGUARD
                </span>
                <span className="text-[10px] font-bold">
                  {currentBox.displaySize ? `[${currentBox.displaySize}]` : ""}
                </span>
              </div>

              {/* Big Box Number and QR Code */}
              <div className="flex items-center justify-between gap-2 py-1">
                <div className="flex-1">
                  <div className="text-3xl font-black tracking-tight leading-none text-black">
                    {currentBox.boxNumber}
                  </div>
                  <div className="text-xs font-bold mt-1 text-black line-clamp-1">
                    {currentBox.title}
                  </div>
                </div>

                <div className="shrink-0 bg-white p-1 border border-black rounded">
                  <QRCodeSVG
                    value={qrUrl}
                    size={labelSize === "50x30" ? 52 : 64}
                    level="M"
                    fgColor="#000000"
                    bgColor="#ffffff"
                  />
                </div>
              </div>

              {/* Finish Checkbox Indicators */}
              <div className="border-t border-b border-black py-1 my-1 text-[9px] font-bold flex flex-wrap justify-between gap-1">
                <span>[ ] CLEAR</span>
                <span>[ ] PRIVACY</span>
                <span>[ ] MATTE</span>
                <span>[ ] BORDERLESS</span>
              </div>

              {/* Models list */}
              <div className="text-[9px] leading-tight text-black py-0.5">
                <span className="font-bold uppercase">Models: </span>
                <span>{topAliases || "Universal Fit"}</span>
              </div>

              {/* Footer */}
              <div className="mt-1 pt-0.5 border-t border-dotted border-black text-[8px] flex justify-between text-black">
                <span>Scan QR to verify live stock</span>
                <span>{new Date().toISOString().split("T")[0]}</span>
              </div>
            </div>

            <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center mt-3 max-w-xs">
              Direct ESC/POS raster output. Make sure Margins are set to &apos;None&apos; in browser print settings.
            </p>
          </div>

          {/* Action Footer */}
          <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold transition-colors"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="flex-1 px-4 py-2.5 rounded-2xl bg-slate-900 hover:bg-black dark:bg-amber-500 dark:hover:bg-amber-400 text-white dark:text-slate-950 font-black text-xs shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <Printer className="w-4 h-4" />
              <span>Print {copies > 1 ? `${copies} Labels` : "Label"} Now</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

