"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createChallenge } from "@/app/actions";
import { UnitPresetSelect } from "@/components/unit-picker";

interface TaskDraft {
  id: string;
  name: string;
  type: "DAILY" | "WEEKLY";
  control: "CHECKBOX" | "NUMBER";
  points: string;
  unit: string; // unit type for number inputs (e.g. "km", "reps") from the preset dropdown
  unitCount: string; // number of individual units per points block (numbers only)
  bonusThreshold: string; // number of units per bonus (e.g. "10")
  bonusPoints: string;    // bonus pts awarded per bonusThreshold reached
  target: string; // optional, for weekly tasks
}

let taskIdCounter = 0;
function newTaskId() {
  taskIdCounter += 1;
  return `task-${taskIdCounter}-${Date.now()}`;
}

export function CreateChallengeForm({ adminName }: { adminName: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    description: "",
    startDate: todayOffset(0),
    endDate: todayOffset(60),
    isPublic: true,
    maxMembers: "",
  });

  // Starts empty — challenges are added by the user.
  const [tasks, setTasks] = useState<TaskDraft[]>([]);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function addTask() {
    setTasks((prev) => [
      { id: newTaskId(), name: "", type: "DAILY", control: "CHECKBOX", points: "", unit: "", unitCount: "1", bonusThreshold: "", bonusPoints: "", target: "" },
      ...prev,
    ]);
  }

  function updateTask(id: string, patch: Partial<TaskDraft>) {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }

  function removeTask(id: string) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.name.trim()) {
      setError("Give your challenge a name.");
      return;
    }
    if (new Date(form.endDate) <= new Date(form.startDate)) {
      setError("End date must be after start date.");
      return;
    }

    const validTasks = tasks.filter((t) => t.name.trim() !== "");
    if (validTasks.length === 0) {
      setError("Add at least one challenge with a name.");
      return;
    }

    const taskInputs = validTasks.map((t) => {
      const points = Number(t.points) || 0;
      const isWeekly = t.type === "WEEKLY";
      const isNumber = t.control === "NUMBER";
      const target = isWeekly && t.target.trim() !== "" ? Number(t.target) : isWeekly ? 1 : null;
      return {
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
        target: isNumber ? null : target,
        bonusThreshold:
          isNumber && t.bonusThreshold.trim() !== "" ? Number(t.bonusThreshold) : null,
        bonusPoints:
          isNumber && t.bonusPoints.trim() !== "" ? Number(t.bonusPoints) : null,
      };
    });

    startTransition(() => {
      createChallenge({
        name: form.name.trim(),
        description: form.description.trim(),
        startDate: form.startDate,
        endDate: form.endDate,
        isPublic: form.isPublic,
        maxMembers: form.maxMembers ? Number(form.maxMembers) : null,
        tasks: taskInputs,
      }).then((res) => {
        if (!res.ok) {
          setError(res.error ?? "Something went wrong.");
          return;
        }
        router.push("/dashboard");
        router.refresh();
      });
    });
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      {error && (
        <div className="rounded-lg bg-danger/10 text-danger text-sm px-3 py-2">
          {error}
        </div>
      )}

      <div className="rounded-2xl bg-card border border-card-border p-4 space-y-4">
        <p className="text-sm font-semibold">General Information</p>
        <Field label="Challenge name">
          <input
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="Winter Arc 2026"
            className="input"
          />
        </Field>

        <Field label="Description">
          <textarea
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="What's the goal of this challenge?"
            rows={2}
            className="input resize-none"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Start date">
            <input
              type="date"
              value={form.startDate}
              onChange={(e) => set("startDate", e.target.value)}
              className="input"
            />
          </Field>
          <Field label="End date">
            <input
              type="date"
              value={form.endDate}
              onChange={(e) => set("endDate", e.target.value)}
              className="input"
            />
          </Field>
        </div>

        <Field label="Max members (optional)">
          <input
            type="number"
            value={form.maxMembers}
            onChange={(e) => set("maxMembers", e.target.value)}
            placeholder="Unlimited"
            className="input"
          />
        </Field>

        <div>
          <p className="text-xs text-muted mb-2">Visibility</p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => set("isPublic", true)}
              className={`flex-1 rounded-xl border px-4 py-2 text-xs font-semibold transition ${
                form.isPublic
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-card-border bg-card text-muted"
              }`}
            >
              Public
            </button>
            <button
              type="button"
              onClick={() => set("isPublic", false)}
              className={`flex-1 rounded-xl border px-4 py-2 text-xs font-semibold transition ${
                !form.isPublic
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-card-border bg-card text-muted"
              }`}
            >
              Private
            </button>
          </div>
        </div>
      </div>

      {/* Dynamic tasks */}
      <div className="rounded-2xl bg-card border border-card-border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">Challenges / Tasks</p>
            <p className="text-xs text-muted">
              Add the challenges members must log. Start empty and add your own.
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
            No challenges added yet. Tap{" "}
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
                    onChange={(e) => updateTask(task.id, { name: e.target.value })}
                    placeholder="Challenge name (e.g. Gym, No Sugar, Water)"
                    className="input flex-1"
                  />
                  <button
                    type="button"
                    onClick={() => removeTask(task.id)}
                    className="text-muted hover:text-danger text-sm px-2"
                    aria-label="Remove challenge"
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
                        updateTask(task.id, {
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
                        updateTask(task.id, {
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
                        updateTask(task.id, { points: e.target.value })
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
                          updateTask(task.id, { unitCount: e.target.value })
                        }
                        placeholder="1"
                        className="input"
                      />
                      <UnitPresetSelect
                        value={task.unit}
                        onSelect={(u) => updateTask(task.id, { unit: u })}
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
                          updateTask(task.id, { bonusThreshold: e.target.value })
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
                          updateTask(task.id, { bonusPoints: e.target.value })
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
                          updateTask(task.id, { target: e.target.value })
                        }
                        placeholder="e.g. 4"
                        className="input"
                      />
                    </label>
                  )}
                </div>
                <p className="text-[11px] text-muted pl-8">
                  {task.control === "NUMBER" ? (
                    (() => {
                      const count =
                        Number(task.unitCount) > 0 ? Number(task.unitCount) : 1;
                      const perBlock = task.unit
                        ? count === 1
                          ? task.unit
                          : `${count} ${task.unit}`
                        : count === 1
                        ? "unit"
                        : `${count} units`;
                      return (
                        `Value input — members enter an amount and earn ` +
                        `${Number(task.points) || 0} pts per ${perBlock}.` +
                        (task.bonusThreshold.trim() !== "" &&
                        task.bonusPoints.trim() !== "" &&
                        Number(task.bonusThreshold) > 0
                          ? ` Bonus: +${Number(task.bonusPoints) || 0} pts every ${Number(
                              task.bonusThreshold
                            )} ${task.unit || "units"}.`
                          : "")
                      );
                    })()
                  ) : task.type === "DAILY" ? (
                    `Daily habit — members check it off daily for ${Number(task.points) || 0} pts/day.`
                  ) : (
                    `Weekly challenge — log daily in Today's log. Evaluated & credited on Sunday if done ${task.target || "N"} days/week (${Number(task.points) || 0} pts).`
                  )}
                  {Number(task.points) < 0 && (
                    <span className="text-danger font-medium"> Negative points are deducted.</span>
                  )}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-xl bg-accent text-white py-3.5 text-sm font-semibold hover:brightness-110 transition disabled:opacity-50"
      >
        {isPending ? "Creating…" : "Create Challenge"}
      </button>
      <p className="text-center text-xs text-muted">Created by {adminName}</p>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs text-muted">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function todayOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
