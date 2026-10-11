"use client";

import type { ShareCardProps } from "@/lib/share/card-props";
import { ShareCardFrame, panelStyle } from "@/components/share/share-card-frame";
import { formatValue } from "@/lib/share/format";
import { percentChip, selectMetricRows } from "@/lib/share/then-now";
import type { ShareDayHistory } from "@/lib/share/types";

/**
 * Card 4 — Then → Now.
 * Bottom translucent panel: amber "Day {then}" chip → blue "Day {now}" chip,
 * three "label  then → now" rows (daily points first, then the two metrics
 * with the largest relative gain) and a green "+X% daily pts" chip.
 *
 * When Now is lower than Then the numbers are shown neutrally — no red, no
 * negative styling — and the percentage chip is hidden.
 */
export function ThenNowCard({ data, background, thenNow, panelAlpha, safeZones }: ShareCardProps) {
  const history = data.dayHistory ?? [];
  const thenDay = Math.max(1, thenNow?.thenDay ?? 1);
  const nowDay = Math.max(1, Math.min(thenNow?.nowDay ?? data.challenge.dayNumber, data.challenge.dayNumber));

  const findDay = (day: number): ShareDayHistory | undefined => history.find((h) => h.dayNumber === day);
  const thenEntry = findDay(thenDay);
  const nowEntry = findDay(nowDay);
  const thenPts = thenEntry?.points ?? 0;
  const nowPts = nowEntry?.points ?? 0;

  const zeroDay: ShareDayHistory = {
    dayNumber: 0,
    date: "",
    points: 0,
    pushups: 0,
    pullups: 0,
    runKm: 0,
    walkKm: 0,
  };

  const metricRows = selectMetricRows(thenEntry ?? zeroDay, nowEntry ?? zeroDay);
  const pct = percentChip(thenPts, nowPts);

  const rows: { label: string; then: string; now: string }[] = [
    { label: "Daily pts", then: String(thenPts), now: String(nowPts) },
    ...metricRows.map((row) => ({
      label: row.label,
      then: formatValue(row.thenValue) ?? "0",
      now: formatValue(row.nowValue) ?? "0",
    })),
  ];

  return (
    <ShareCardFrame background={background} panelAlpha={panelAlpha} safeZones={safeZones}>
      <div
        className="absolute inset-x-3 rounded-2xl p-4"
        style={{ ...panelStyle(), bottom: "14%" }}
      >
        {/* Header chips */}
        <div className="flex items-center gap-2">
          <span
            className="rounded-full border px-2.5 py-1 text-[11px] font-bold"
            style={{ color: "#e8b73a", borderColor: "rgba(232,183,58,0.45)", backgroundColor: "rgba(232,183,58,0.16)" }}
          >
            Day {thenDay}
          </span>
          <span className="text-[13px] text-white/55">→</span>
          <span
            className="rounded-full border px-2.5 py-1 text-[11px] font-bold"
            style={{ color: "#38bdf8", borderColor: "rgba(56,189,248,0.45)", backgroundColor: "rgba(56,189,248,0.16)" }}
          >
            Day {nowDay}
          </span>
        </div>

        {/* Comparison rows */}
        <div className="mt-3 space-y-2">
          {rows.map((row) => (
            <div key={row.label} className="flex items-baseline justify-between gap-3">
              <span className="text-[12px] text-white/70">{row.label}</span>
              <span className="text-[13px] font-medium tabular-nums text-white">
                {row.then} <span className="text-white/45">→</span> {row.now}
              </span>
            </div>
          ))}
        </div>

        {/* Percentage chip */}
        {pct !== null && (
          <p
            className="mt-3 inline-block rounded-full px-2.5 py-1 text-[11px] font-bold"
            style={{ color: "#34d399", backgroundColor: "rgba(52,211,153,0.16)" }}
          >
            +{pct}% daily pts
          </p>
        )}
      </div>
    </ShareCardFrame>
  );
}
