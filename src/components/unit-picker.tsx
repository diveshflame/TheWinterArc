"use client";

export const UNIT_PRESETS = [
  "km",
  "mile",
  "m",
  "steps",
  "reps",
  "sets",
  "min",
  "hours",
  "glasses",
  "liters",
  "kg",
  "lbs",
  "pages",
  "laps",
  "sessions",
  "push-ups",
] as const;

export function UnitPresetSelect({
  value,
  onSelect,
}: {
  value: string;
  onSelect: (unit: string) => void;
}) {
  const selected = (UNIT_PRESETS as readonly string[]).includes(value)
    ? value
    : "";
  return (
    <select
      value={selected}
      onChange={(e) => {
        if (e.target.value) onSelect(e.target.value);
      }}
      className="w-full rounded-xl bg-card border border-card-border px-3 py-2.5 text-sm outline-none focus:border-accent"
      aria-label="Pick a unit type"
    >
      <option value="" disabled>
        Unit type ▾
      </option>
      {UNIT_PRESETS.map((u) => (
        <option key={u} value={u}>
          {u}
        </option>
      ))}
    </select>
  );
}