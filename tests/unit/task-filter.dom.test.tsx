import { describe, it, expect } from "vitest";
import { useState } from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { TaskFilter, type FilterableTask } from "@/components/task-filter-sheet";

const tasks: FilterableTask[] = [
  { id: "walk", name: "Walking", category: "movement" },
  { id: "pushups", name: "push-ups", category: "movement" },
  { id: "pullups", name: "pull-ups", category: "movement" },
  { id: "run", name: "Running", category: "movement" },
  { id: "steps", name: "Total steps", category: "movement" },
  { id: "situps", name: "Situps", category: "movement" },
  { id: "protein", name: "1.5x body weight Protein intake", category: "food" },
  { id: "sugar", name: "No sugar", category: "food" },
  { id: "water", name: "2L water", category: "food" },
  { id: "read", name: "Read book for 30 mins", category: "mind" },
  { id: "meditation", name: "Meditation for 30 minutes", category: "mind" },
  { id: "phone", name: "No phone while eating", category: "mind" },
  { id: "gym", name: "Gym", category: "weekly" },
  { id: "sport", name: "Sport", category: "weekly" },
  // Negative-point tasks must never be offered as filter options.
  { id: "alcohol", name: "Drank Alcohol", category: "penalty" },
  { id: "screen", name: "Screen time", category: "penalty" },
];

function Harness({ initial = null }: { initial?: string | null }) {
  const [id, setId] = useState<string | null>(initial);
  return <TaskFilter tasks={tasks} selectedTaskId={id} onChange={setId} />;
}

function trigger(): HTMLButtonElement {
  const el = document.querySelector('[aria-haspopup="dialog"]');
  expect(el).not.toBeNull();
  return el as HTMLButtonElement;
}

function openTrigger() {
  fireEvent.click(trigger());
  return screen.getByRole("dialog", { name: "Filter by task" });
}

describe("TaskFilter", () => {
  it("renders a pill trigger defaulting to All tasks with dialog semantics", () => {
    render(<Harness />);
    const btn = trigger();
    expect(btn.tagName).toBe("BUTTON");
    expect(btn.getAttribute("aria-haspopup")).toBe("dialog");
    expect(btn.textContent).toContain("Task ·");
    expect(btn.textContent).toContain("All tasks");
    expect(btn.textContent).toContain("▾");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens a modal dialog with handle, title, Done, search and grouped list", () => {
    render(<Harness />);
    const dialog = openTrigger();

    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByRole("heading", { name: "Filter by task" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Done" })).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "Search tasks" })).toBeInTheDocument();
    // No autofocus on open — the search field must not steal focus.
    expect(document.activeElement).toBe(dialog);

    // Group headings appear in spec order; no PENALTIES group.
    const headings = screen
      .getAllByRole("heading", { level: 3 })
      .map((h) => h.textContent);
    expect(headings).toEqual(["MOVEMENT", "FOOD", "MIND & HABITS", "WEEKLY"]);

    // "All tasks" row sits at the top with no heading above it.
    const allTasks = within(dialog).getByRole("button", { name: "All tasks" });
    expect(allTasks).toHaveAttribute("aria-pressed", "true");
    expect(allTasks.previousElementSibling).toBeNull();

    // Negative-point tasks are not options.
    expect(within(dialog).queryByRole("button", { name: "Drank Alcohol" })).toBeNull();
    expect(within(dialog).queryByRole("button", { name: "Screen time" })).toBeNull();
  });

  it("keeps the selection across re-opens and marks the row as pressed", () => {
    render(<Harness initial="walk" />);
    expect(trigger().textContent).toContain("Walking");

    let dialog = openTrigger();
    const walking = within(dialog).getByRole("button", { name: "Walking" });
    expect(walking).toHaveAttribute("aria-pressed", "true");
    expect(walking.querySelector("svg")).not.toBeNull();

    const allTasks = within(dialog).getByRole("button", { name: "All tasks" });
    expect(allTasks).toHaveAttribute("aria-pressed", "false");
    expect(allTasks.querySelector("svg")).toBeNull();

    // Switching tabs keeps the selection (state lives outside the sheet) —
    // closing without picking anything must preserve it.
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger().textContent).toContain("Walking");

    dialog = openTrigger();
    expect(
      within(dialog).getByRole("button", { name: "Walking" })
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("selecting a row applies the filter and closes the sheet", () => {
    render(<Harness />);
    const dialog = openTrigger();
    fireEvent.click(within(dialog).getByRole("button", { name: "Running" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger().textContent).toContain("Running");

    const reopened = openTrigger();
    expect(
      within(reopened).getByRole("button", { name: "Running" })
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("filters across groups as the user types and hides All tasks", () => {
    render(<Harness />);
    const dialog = openTrigger();
    const search = screen.getByRole("searchbox", { name: "Search tasks" });

    fireEvent.change(search, { target: { value: "walk" } });

    expect(
      within(dialog).queryByRole("button", { name: "All tasks" })
    ).toBeNull();
    expect(within(dialog).getByRole("button", { name: "Walking" })).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Running" })).toBeNull();
    expect(within(dialog).queryByRole("button", { name: "2L water" })).toBeNull();

    const headings = screen.getAllByRole("heading", { level: 3 });
    expect(headings.map((h) => h.textContent)).toEqual(["MOVEMENT"]);

    // Cross-group match.
    fireEvent.change(search, { target: { value: "phone" } });
    expect(
      within(dialog).getByRole("button", { name: "No phone while eating" })
    ).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual([
      "MIND & HABITS",
    ]);
  });

  it("shows a quoted empty state when nothing matches", () => {
    render(<Harness />);
    const dialog = openTrigger();
    const search = screen.getByRole("searchbox", { name: "Search tasks" });

    fireEvent.change(search, { target: { value: "zzz" } });

    expect(within(dialog).getByText("No tasks match “zzz”")).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "All tasks" })).toBeNull();
    expect(screen.queryByRole("heading", { level: 3 })).not.toBeInTheDocument();
  });

  it("clearing the query restores All tasks and the groups", () => {
    render(<Harness />);
    const dialog = openTrigger();
    const search = screen.getByRole("searchbox", { name: "Search tasks" });

    fireEvent.change(search, { target: { value: "gym" } });
    expect(within(dialog).queryByRole("button", { name: "All tasks" })).toBeNull();

    fireEvent.change(search, { target: { value: "" } });
    expect(within(dialog).getByRole("button", { name: "All tasks" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Gym" })).toBeInTheDocument();
  });

  it("closes on Escape, returns focus to the trigger, and restores scrolling", () => {
    render(<Harness />);
    const btn = trigger();
    openTrigger();
    expect(document.body.style.overflow).toBe("hidden");

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.body.style.overflow).not.toBe("hidden");
    expect(document.activeElement).toBe(btn);
  });

  it("closes when the overlay is tapped", () => {
    render(<Harness />);
    openTrigger();
    const overlay = document.querySelector('[class*="z-[90]"]') as HTMLElement;
    expect(overlay).not.toBeNull();
    fireEvent.click(overlay);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps focus inside the dialog while open", () => {
    render(<Harness />);
    const dialog = openTrigger();
    const buttons = within(dialog).getAllByRole("button");
    const first = buttons[0];
    const last = buttons[buttons.length - 1];

    last.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(first);

    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);
  });
});
