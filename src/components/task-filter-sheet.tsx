"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import type { TaskCategory } from "@/lib/leaderboard-tasks";

export interface FilterableTask {
  id: string;
  name: string;
  category: TaskCategory;
}

/** Group order as shown in the sheet. Penalty (negative-point) tasks are
 *  never options, so PENALTIES deliberately has no entry. */
const GROUPS: { key: TaskCategory; label: string }[] = [
  { key: "movement", label: "MOVEMENT" },
  { key: "food", label: "FOOD" },
  { key: "mind", label: "MIND & HABITS" },
  { key: "weekly", label: "WEEKLY" },
];

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

const SHEET_HEIGHT = 640;

export function TaskFilter({
  tasks,
  selectedTaskId,
  onChange,
}: {
  tasks: FilterableTask[];
  selectedTaskId: string | null;
  onChange: (id: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [isWide, setIsWide] = useState(false);
  const [viewport, setViewport] = useState<{
    height: number | null;
    bottom: number;
  }>({ height: null, bottom: 0 });
  const [dragY, setDragY] = useState(0);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const dragStartY = useRef(0);
  const dragDy = useRef(0);

  // Negative-point tasks are never filter options, even if one slips through.
  const options = tasks.filter((t) => t.category !== "penalty");

  const selected = selectedTaskId
    ? (options.find((t) => t.id === selectedTaskId) ?? null)
    : null;
  const selectedLabel = selected?.name ?? "All tasks";

  const openSheet = useCallback(() => {
    setQuery("");
    setDragY(0);
    dragDy.current = 0;
    setOpen(true);
  }, []);

  const closeSheet = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  // Widths above 600px render as a centered modal instead of a bottom sheet.
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(min-width: 601px)");
    const update = () => setIsWide(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // Focus the dialog container on open — never the search field, so the
  // mobile keyboard does not pop up.
  useEffect(() => {
    if (open) dialogRef.current?.focus();
  }, [open]);

  // Lock background scroll while open.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  // Keep the sheet inside the visible viewport (keyboard, browser chrome).
  // Without visualViewport, sizing falls back to the `min(640px, 80dvh)` CSS.
  useEffect(() => {
    if (!open) return;
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () =>
      setViewport({
        height: vv.height,
        bottom: Math.max(0, window.innerHeight - vv.height - vv.offsetTop),
      });
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, [open]);

  // Escape closes; Tab is trapped inside the dialog.
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        closeSheet();
        return;
      }
      if (e.key !== "Tab") return;
      const root = dialogRef.current;
      if (!root) return;
      const focusables = Array.from(
        root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (!active || !root.contains(active)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, closeSheet]);

  // Bring the selected row into view when the sheet opens.
  useEffect(() => {
    if (!open) return;
    const scrollSelected = () => {
      const el = listRef.current?.querySelector<HTMLElement>(
        '[data-selected="true"]'
      );
      el?.scrollIntoView?.({ block: "center" });
    };
    const frame =
      typeof requestAnimationFrame === "function"
        ? requestAnimationFrame(scrollSelected)
        : null;
    return () => {
      if (frame != null) cancelAnimationFrame(frame);
    };
  }, [open]);

  const q = query.trim().toLowerCase();
  const showAllRow = q.length === 0;
  const groups = GROUPS.map((g) => ({
    ...g,
    tasks: options.filter(
      (t) => t.category === g.key && t.name.toLowerCase().includes(q)
    ),
  })).filter((g) => g.tasks.length > 0);
  const matchCount = groups.reduce((sum, g) => sum + g.tasks.length, 0);

  function selectTask(id: string | null) {
    onChange(id);
    closeSheet();
  }

  function onHandlePointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (isWide) return;
    dragging.current = true;
    dragStartY.current = e.clientY;
    dragDy.current = 0;
    setDragY(0);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }

  function onHandlePointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (isWide || !dragging.current) return;
    const dy = e.clientY - dragStartY.current;
    dragDy.current = dy;
    setDragY(Math.max(0, dy));
  }

  function onHandlePointerEnd(e: ReactPointerEvent<HTMLDivElement>) {
    if (isWide || !dragging.current) return;
    dragging.current = false;
    const released = dragDy.current;
    dragDy.current = 0;
    setDragY(0);
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    if (released > 60) closeSheet();
  }

  // Height: 640px design, capped to 80% of the visible viewport so the sheet
  // shrinks with the on-screen keyboard.
  const height =
    viewport.height != null
      ? Math.min(SHEET_HEIGHT, Math.round(viewport.height * 0.8))
      : `min(${SHEET_HEIGHT}px, 80dvh)`;

  const dialogStyle: CSSProperties = isWide
    ? { height }
    : {
        height,
        bottom: viewport.bottom,
        transform: dragY > 0 ? `translateY(${dragY}px)` : undefined,
      };

  if (typeof document === "undefined") return null;

  return (
    <>
      <div className="flex justify-start">
        <button
          ref={triggerRef}
          type="button"
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => (open ? closeSheet() : openSheet())}
          className="inline-flex min-h-[44px] max-w-full cursor-pointer items-center gap-1.5 rounded-full border border-[#38bdf8] bg-[#0c2a3d] px-[14px] text-[14px] font-semibold text-[#7dd3fc] transition-colors hover:bg-[#103549] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#38bdf8]"
        >
          <span className="shrink-0">Task ·</span>
          <span className="min-w-0 truncate">{selectedLabel}</span>
          <span className="shrink-0" aria-hidden="true">
            ▾
          </span>
        </button>
      </div>

      {open &&
        createPortal(
          <div
            onClick={closeSheet}
            className={`fixed inset-0 z-[90] bg-[rgba(4,8,16,0.72)] animate-overlay-in ${
              isWide ? "flex items-center justify-center p-4" : ""
            }`}
          >
            <div
              ref={dialogRef}
              role="dialog"
              aria-modal="true"
              aria-label="Filter by task"
              tabIndex={-1}
              onClick={(e) => e.stopPropagation()}
              style={dialogStyle}
              className={`flex min-h-0 w-full flex-col gap-[10px] bg-[#111a30] px-4 pt-3 outline-none ${
                isWide
                  ? "relative max-w-[420px] rounded-[22px] border border-[#1d2a47] pb-4 animate-overlay-in"
                  : "absolute inset-x-0 bottom-0 mx-auto max-w-full rounded-t-[22px] border-t border-[#1d2a47] pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-2xl animate-task-sheet-up transition-transform duration-150 ease-out"
              }`}
            >
              {/* 1. Drag handle */}
              <div
                onPointerDown={onHandlePointerDown}
                onPointerMove={onHandlePointerMove}
                onPointerUp={onHandlePointerEnd}
                onPointerCancel={onHandlePointerEnd}
                aria-hidden="true"
                className="flex shrink-0 cursor-grab touch-none select-none justify-center active:cursor-grabbing"
              >
                <div className="h-1 w-10 rounded-[2px] bg-[#3a4a6b]" />
              </div>

              {/* 2. Header */}
              <div className="flex shrink-0 items-center justify-between">
                <h2 className="text-[20px] font-bold text-[#e8eefc]">
                  Filter by task
                </h2>
                <button
                  type="button"
                  onClick={closeSheet}
                  className="min-h-[44px] cursor-pointer border-0 bg-transparent px-2 text-[15px] font-semibold text-[#38bdf8]"
                >
                  Done
                </button>
              </div>

              {/* 3. Search */}
              <input
                type="search"
                aria-label="Search tasks"
                placeholder="Search tasks"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="min-h-[46px] w-full shrink-0 appearance-none rounded-[12px] border border-[#1d2a47] bg-[#0a1020] px-[14px] text-[15px] text-[#e8eefc] outline-none transition placeholder:text-[#8fa1c3] focus:border-[#38bdf8]"
              />

              {/* 4. Scrollable list */}
              <div
                ref={listRef}
                className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
              >
                {showAllRow && (
                  <TaskRow
                    label="All tasks"
                    selected={selectedTaskId === null}
                    onSelect={() => selectTask(null)}
                  />
                )}
                {groups.map((g) => (
                  <div key={g.key}>
                    <h3 className="px-3 pt-2.5 pb-0.5 text-[12px] font-semibold uppercase tracking-[0.08em] text-[#8fa1c3]">
                      {g.label}
                    </h3>
                    {g.tasks.map((t) => (
                      <TaskRow
                        key={t.id}
                        label={t.name}
                        selected={t.id === selectedTaskId}
                        onSelect={() => selectTask(t.id)}
                      />
                    ))}
                  </div>
                ))}
                {matchCount === 0 && (
                  <div className="py-10 text-center text-[14px] text-[#8fa1c3]">
                    No tasks match “{query.trim()}”
                  </div>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

function TaskRow({
  label,
  selected,
  onSelect,
}: {
  label: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      data-selected={selected ? "true" : undefined}
      className={`flex min-h-[44px] w-full items-center justify-between gap-3 rounded-[10px] border-0 px-3 py-2 text-left text-[15px] cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#38bdf8] ${
        selected
          ? "bg-[#0c2a3d] font-semibold text-[#7dd3fc]"
          : "bg-transparent text-[#e8eefc] hover:bg-white/[0.04]"
      }`}
    >
      <span className="min-w-0 truncate">{label}</span>
      {selected && <CheckIcon />}
    </button>
  );
}

function CheckIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className="shrink-0"
    >
      <path
        d="M3 8.5l3.4 3.4L13 5.2"
        stroke="#7dd3fc"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
