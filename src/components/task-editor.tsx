"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateChallengeTasks, type ChallengeTaskInput } from "@/app/actions";
import { UnitPresetSelect } from "@/components/unit-picker";

interface ChallengeTaskWithTiers {
  id: string;
  name: string;
  type: string;
  inputType: string;
  isRuleBreaker: boolean;
  isAlcoholTask: boolean;
  points: number;
  unit: string | null;
  unitCount: number | null;
  target: number | null;
  bonusThreshold: number | null;
  bonusPoints: number | null;
  tiers: { threshold: number; points: number }[];
}

export function EditTasksSection({
  challengeId,
  tasks,
}: {
  challengeId: string;
  tasks: ChallengeTaskWithTiers[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl bg-card border border-card-border p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">Challenges / Tasks</p>
          <p className="text-xs text-muted">
            Edit, add, or remove tasks and their points.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="rounded-xl bg-accent text-white px-4 py-2 text-sm font-semibold hover:brightness-110 transition"
        >
          {open ? "Close" : "Edit tasks"}
        </button>
      </div>
      {open && (
        <div className="mt-4">
          <TaskEditor challengeId={challengeId} initialTasks={tasks} />
        </div>
      )}
    </div>
  );
}

interface TaskDraft {
  id: string | null; // null = not yet in DB
  name: string;
  type: "DAILY" | "WEEKLY";
  control: "CHECKBOX" | "NUMBER";
  points: string;
  unit: string;
  unitCount: string; // number of individual units per points block (numbers only)
  bonusThreshold: string;
  bonusPoints: string;
  target: string;
}

let taskIdCounter = 0;
function newTaskId() {
  taskIdCounter += 1;
  return `draft-${taskIdCounter}-${Date.now()}`;
}

export function TaskEditor({
  challengeId,
  initialTasks,
}: {
  challengeId: string;
  initialTasks: ChallengeTaskWithTiers[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);

  const [tasks, setTasks] = useState<TaskDraft[]>(() =>
    initialTasks.map((t) => ({
      id: t.id,
      name: t.name,
      type: t.type as "DAILY" | "WEEKLY",
      control: t.inputType === "NUMBER" ? "NUMBER" : "CHECKBOX",
      points: String(t.points),
      unit: t.unit ?? "",
      unitCount: t.unitCount != null ? String(t.unitCount) : "1",
      bonusThreshold: t.bonusThreshold != null ? String(t.bonusThreshold) : "",
      bonusPoints: t.bonusPoints != null ? String(t.bonusPoints) : "",
      target: t.target != null ? String(t.target) : "",
    }))
  );

  function addTask() {
    setDirty(true);
    setSaved(false);
    setTasks((prev) => [
      {
        id: newTaskId(),
        name: "",
        type: "DAILY",
        control: "CHECKBOX",
        points: "",
        unit: "",
        unitCount: "1",
        bonusThreshold: "",
        bonusPoints: "",
        target: "",
      },
      ...prev,
    ]);
  }

  function updateTask(id: string, patch: Partial<TaskDraft>) {
    setDirty(true);
    setSaved(false);
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }

  function removeTask(draftId: string) {
    setDirty(true);
    setSaved(false);
    setTasks((prev) => prev.filter((t) => t.id !== draftId));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const validTasks = tasks.filter((t) => t.name.trim() !== "");
    if (validTasks.length === 0) {
      setError("Keep at least one task with a name.");
      return;
    }

    const taskInputs: ChallengeTaskInput[] = validTasks.map((t) => {
      const points = Number(t.points) || 0;
      const isWeekly = t.type === "WEEKLY";
      const isNumber = t.control === "NUMBER";
      const target =
        !isNumber && isWeekly && t.target.trim() !== ""
          ? Number(t.target)
          : isWeekly && !isNumber
          ? 1
          : null;
      return {
        id: t.id ?? undefined,
        name: t.name.trim(),
        type: t.type,
        inputType: t.control,
        isRuleBreaker: false,
        isAlcoholTask: false,
        points,
        unit: isNumber && t.unit.trim() !== "" ? t.unit.trim() : null,
        unitCount:
          isNumber && t.unitCount.trim() !== "" && Number(t.unitCount) > 0
            ? Number(t.unitCount)
            : 1,
        target,
        bonusThreshold:
          isNumber && t.bonusThreshold.trim() !== ""
            ? Number(t.bonusThreshold)
            : null,
        bonusPoints:
          isNumber && t.bonusPoints.trim() !== "" ? Number(t.bonusPoints) : null,
      };
    });

    startTransition(() => {
      updateChallengeTasks(challengeId, taskInputs).then((res) => {
        if (!res.ok) {
          setError(res.error ?? "Something went wrong.");
          return;
        }
        setDirty(false);
        setSaved(true);
        router.refresh();
      });
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      {error && (
        <div className="rounded-lg bg-danger/10 text-danger text-sm px-3 py-2">
          {error}
        </div>
      )}
      {dirty ? (
        <div className="rounded-lg bg-warning/10 text-warning text-sm px-3 py-2">
          Unsaved changes
        </div>
      ) : saved ? (
        <div className="rounded-lg bg-accent/10 text-accent text-sm px-3 py-2">
          Tasks saved ✓
        </div>
      ) : null}

      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">Edit Challenges / Tasks</p>
          <p className="text-xs text-muted">
            Edit names and points, add new ones, or remove tasks. Removing a task
            also clears its logged entries.
          </p>
        </div>
        <button
          type="button"
          onClick={addTask}
          className="rounded-xl bg-accent text-white px-4 py-2 text-sm font-semibold hover:brightness-110 transition"
        >
          + Add
        </button>
      </div>

      {tasks.length === 0 ? (
        <div className="rounded-xl bg-background border border-dashed border-card-border p-6 text-center text-muted text-sm">
          No tasks. Tap{" "}
          <span className="text-accent font-semibold">+ Add</span> to create one.
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map((task, idx) => (
            <div
              key={task.id}
              className="rounded-xl bg-background border border-card-border p-3 space-y-2"
            >
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted font-semibold w-6">
                  {idx + 1}.
                </span>
                <input
                  value={task.name}
                  onChange={(e) => updateTask(task.id!, { name: e.target.value })}
                  placeholder="Challenge name (e.g. Gym, No Sugar)"
                  className="input flex-1"
                />
                <button
                  type="button"
                  onClick={() => removeTask(task.id!)}
                  className="text-muted hover:text-danger text-sm px-2"
                  aria-label="Remove task"
                >
                  ✕
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pl-8">
                <label className="block">
                  <span className="text-[11px] text-muted">Type</span>
                  <select
                    value={task.type}
                    onChange={(e) =>
                      updateTask(task.id!, {
                        type: e.target.value as "DAILY" | "WEEKLY",
                      })
                    }
                    className="input"
                  >
                    <option value="DAILY">Daily</option>
                    <option value="WEEKLY">Weekly</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-[11px] text-muted">Control</span>
                  <select
                    value={task.control}
                    onChange={(e) =>
                      updateTask(task.id!, {
                        control: e.target.value as "CHECKBOX" | "NUMBER",
                      })
                    }
                    className="input"
                  >
                    <option value="CHECKBOX">Check box (toggle)</option>
                    <option value="NUMBER">Number input (value)</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-[11px] text-muted">
                    {task.control === "NUMBER"
                      ? "Points / block"
                      : task.type === "DAILY"
                      ? "Points / day"
                      : "Points"}
                  </span>
                  <input
                    type="number"
                    value={task.points}
                    onChange={(e) =>
                      updateTask(task.id!, { points: e.target.value })
                    }
                    placeholder="0"
                    className="input"
                  />
                </label>
                {task.control === "NUMBER" && (
                  <label className="block sm:col-span-2">
                    <span className="text-[11px] text-muted">
                      Units (per points block)
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={task.unitCount}
                      onChange={(e) =>
                        updateTask(task.id!, { unitCount: e.target.value })
                      }
                      placeholder="1"
                      className="input"
                    />
                    <UnitPresetSelect
                      value={task.unit}
                      onSelect={(u) => updateTask(task.id!, { unit: u })}
                    />
                  </label>
                )}
                {task.control === "NUMBER" && (
                  <label className="block">
                    <span className="text-[11px] text-muted">
                      Bonus every (units)
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={task.bonusThreshold}
                      onChange={(e) =>
                        updateTask(task.id!, { bonusThreshold: e.target.value })
                      }
                      placeholder="e.g. 10"
                      className="input"
                    />
                  </label>
                )}
                {task.control === "NUMBER" && (
                  <label className="block">
                    <span className="text-[11px] text-muted">Bonus pts</span>
                    <input
                      type="number"
                      value={task.bonusPoints}
                      onChange={(e) =>
                        updateTask(task.id!, { bonusPoints: e.target.value })
                      }
                      placeholder="e.g. 20"
                      className="input"
                    />
                  </label>
                )}
                {task.type === "WEEKLY" && task.control !== "NUMBER" && (
                  <label className="block">
                    <span className="text-[11px] text-muted">
                      Times a week
                    </span>
                    <input
                      type="number"
                      min="1"
                      max="7"
                      value={task.target}
                      onChange={(e) =>
                        updateTask(task.id!, { target: e.target.value })
                      }
                      placeholder="e.g. 4"
                      className="input"
                    />
                  </label>
                )}
              </div>
              {task.control === "NUMBER" && (
                <p className="text-[11px] text-muted pl-8">
                  {(() => {
                    const count =
                      Number(task.unitCount) > 0 ? Number(task.unitCount) : 1;
                    const perBlock = task.unit
                      ? count === 1
                        ? task.unit
                        : `${count} ${task.unit}`
                      : count === 1
                      ? "unit"
                      : `${count} units`;
                    const bonus =
                      task.bonusThreshold.trim() !== "" &&
                      task.bonusPoints.trim() !== "" &&
                      Number(task.bonusThreshold) > 0
                        ? `, plus ${Number(task.bonusPoints) || 0} pts bonus every ${Number(
                            task.bonusThreshold
                          )} ${task.unit || "units"}`
                        : "";
                    return (
                      `Value input — members enter an amount and earn ` +
                      `${Number(task.points) || 0} pts per ${perBlock}${bonus}`
                    );
                  })()}
                  {Number(task.points) < 0 ? (
                    <span className="text-danger font-medium"> (deducted).</span>
                  ) : (
                    "."
                  )}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-xl bg-accent text-white py-3 text-sm font-semibold hover:brightness-110 transition disabled:opacity-50"
      >
        {isPending ? "Saving…" : "Save Tasks"}
      </button>
    </form>
  );
}
