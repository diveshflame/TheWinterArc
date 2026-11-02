"use client";

import { useEffect, useRef } from "react";
import type { WeeklyWinner } from "@/lib/weekly-winners";

export type { WeeklyWinner };

interface WeeklyWinnersModalProps {
  open: boolean;
  onClose: () => void;
  winners: WeeklyWinner[];
}

function formatWeekRange(winner: WeeklyWinner): string {
  const start = new Date(winner.weekStart);
  const end = winner.weekEnd ? new Date(winner.weekEnd) : start;
  const opts: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: "numeric",
  };
  const startLabel = start.toLocaleDateString("en-US", opts);
  const endLabel = end.toLocaleDateString("en-US", opts);
  return endLabel !== startLabel
    ? `${startLabel} – ${endLabel}`
    : startLabel;
}

export function WeeklyWinnersModal({
  open,
  onClose,
  winners,
}: WeeklyWinnersModalProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);

  // Lock body scroll and handle Escape key (mirrors TaskPointsModal)
  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="weekly-winners-title"
    >
      <div
        ref={dialogRef}
        onClick={(e) => e.stopPropagation()}
        className="bg-[#111a2e] border border-[#1f2a44] rounded-[22px] max-w-lg w-full flex flex-col h-[80vh] shadow-2xl relative overflow-hidden"
      >
        {/* Modal header */}
        <div className="p-4 sm:p-5 border-b border-[#1f2a44] flex items-center justify-between shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold tracking-widest uppercase text-[#e8b73a] font-mono">
                Hall of Fame
              </span>
              <span className="text-[10px] text-[#8a97b2] font-mono">•</span>
              <span className="text-[10px] text-[#8a97b2] font-mono">
                Season board
              </span>
            </div>
            <h2
              id="weekly-winners-title"
              className="font-display font-bold text-lg sm:text-xl text-[#e8ecf7] tracking-tight mt-0.5"
            >
              Weekly Winners
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#162038] hover:bg-[#1f2a44] text-[#8a97b2] hover:text-[#e8ecf7] flex items-center justify-center transition cursor-pointer"
            aria-label="Close dialog"
            title="Close"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Scrollable winners list — fixed height (80vh) with internal scroll */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5">
          {winners.length === 0 ? (
            <div className="bg-[#162038]/50 border border-[#1f2a44] rounded-2xl p-8 text-center space-y-2">
              <span className="text-2xl block">🏆</span>
              <p className="text-sm font-semibold text-[#e8ecf7]">
                No completed weeks yet.
              </p>
              <p className="text-xs text-[#8a97b2]">
                Winners will appear here once the first week of the challenge
                wraps up.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {winners.map((w) => (
                <div
                  key={`${w.userId}-${w.weekStart.getTime()}`}
                  className="bg-[#162038] border border-[#1f2a44] hover:border-[#e8b73a]/40 rounded-2xl p-3.5 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-xl shrink-0">🏆</span>
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold tracking-widest uppercase text-[#8a97b2] font-mono">
                        Week #{w.weekNumber ?? "—"}
                      </p>
                      <p className="text-sm font-bold text-[#e8ecf7] leading-tight truncate">
                        {w.name}
                      </p>
                      <p className="text-[11px] text-[#8a97b2] font-medium">
                        {formatWeekRange(w)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-display font-bold text-lg leading-none text-[#e8b73a]">
                      {w.points.toLocaleString()}
                      <span className="text-[10px] text-[#8a97b2] font-sans font-normal ml-0.5">
                        {" "}
                        pts
                      </span>
                    </p>
                    <p className="text-[10px] text-[#8a97b2] font-mono mt-0.5">
                      win
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal footer */}
        <div className="p-4 sm:p-5 border-t border-[#1f2a44] bg-[#0e1628]/80 flex items-center justify-between shrink-0">
          <p className="text-xs text-[#8a97b2] font-mono">
            {winners.length} week{winners.length === 1 ? "" : "s"} with a winner
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-bold bg-[#e8ecf7] text-[#0b1020] hover:brightness-110 active:scale-95 transition cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
