"use client";

import type { ShareCardProps } from "@/lib/share/card-props";
import { ShareCardFrame } from "@/components/share/share-card-frame";
import { CheckMark, XMark } from "@/components/share/share-icons";
import { defaultReceiptSelection, receiptRows, receiptTotals } from "@/lib/share/receipt";

/** System monospace stack — no web font, so the export is deterministic. */
const MONO =
  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';

/**
 * Card 5 — Paper receipt.
 * A cream receipt rotated ~2.5° in the bottom-right with today's selected
 * habits. The footer always totals ALL completed habits, even when fewer rows
 * are displayed, so the receipt stays honest.
 */
export function ReceiptCard({ data, background, toggles, receipt, panelAlpha, safeZones }: ShareCardProps) {
  const habits = data.today.habits ?? [];
  const selected = receipt?.selected ?? defaultReceiptSelection(habits);
  const showMissed = receipt?.showMissed ?? false;

  const { rows } = receiptRows(habits, selected, showMissed);
  const totals = receiptTotals(habits, rows);

  return (
    <ShareCardFrame background={background} panelAlpha={panelAlpha} safeZones={safeZones}>
      <div
        className="absolute flex flex-col rounded-sm bg-[#f8f4e8] px-2.5 py-2.5 text-[#2b2620]"
        style={{
          right: 26,
          bottom: "16%",
          width: 118,
          transform: "rotate(2.5deg)",
          boxShadow: "0 8px 20px rgba(0,0,0,0.45)",
          fontFamily: MONO,
        }}
      >
        <p className="text-center text-[11px] font-bold uppercase leading-none tracking-[0.08em]">
          Today&apos;s habits
        </p>

        <div className="my-2 border-t border-dashed border-[#2b2620]/40" />

        <div className="space-y-1.5">
          {rows.map((row) => (
            <div key={row.id} className="flex items-start gap-1.5">
              {row.missed ? (
                <XMark className="mt-[1px] h-3 w-3 shrink-0 text-[#8a8578]" />
              ) : (
                <CheckMark className="mt-[1px] h-3 w-3 shrink-0 text-[#1f7a4d]" />
              )}
              <span
                className={`min-w-0 flex-1 break-words text-[11px] leading-[1.25] ${
                  row.missed ? "text-[#8a8578] line-through" : "text-[#2b2620]"
                }`}
              >
                {row.label}
              </span>
            </div>
          ))}
          {totals.hiddenDone > 0 && (
            <p className="text-[11px] leading-none text-[#2b2620]/55">+ {totals.hiddenDone} more done</p>
          )}
          {rows.length === 0 && (
            <p className="text-[11px] leading-none text-[#2b2620]/55">Nothing completed yet</p>
          )}
        </div>

        <div className="my-2 border-t border-dashed border-[#2b2620]/40" />

        <div className="flex items-baseline justify-between text-[11px] font-bold">
          <span>
            {totals.done} / {totals.total}
          </span>
          {toggles.points && <span>+{totals.habitPoints} pts</span>}
        </div>
      </div>
    </ShareCardFrame>
  );
}
