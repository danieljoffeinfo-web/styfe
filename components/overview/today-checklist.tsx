"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { addTask, carryOverTasks, deleteTask, toggleTask } from "@/lib/actions/misc";
import { useToast } from "@/components/ui/toast";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { DailyTask } from "@/lib/types";

export function TodayChecklist({
  tasks,
  date,
  limit,
}: {
  tasks: DailyTask[];
  date: string;
  /** Show at most this many. The rest stay on the list, just not on screen. */
  limit?: number;
}) {
  const toast = useToast();
  const router = useRouter();
  const [items, setItems] = React.useState(tasks);
  const [label, setLabel] = React.useState("");
  const [pending, startTransition] = React.useTransition();
  const carried = React.useRef(false);

  React.useEffect(() => setItems(tasks), [tasks]);

  // Anything left unticked on an earlier day lands on today's list on first load.
  React.useEffect(() => {
    if (carried.current) return;
    carried.current = true;
    carryOverTasks().then((result) => {
      if (!result.ok || !result.message) return;
      toast(result.message);
      // The carried tasks are new rows; pull them in.
      router.refresh();
    });
  }, [toast, router]);

  function onToggle(task: DailyTask) {
    const next = !task.done;
    setItems((current) => current.map((t) => (t.id === task.id ? { ...t, done: next } : t)));
    startTransition(async () => {
      const result = await toggleTask(task.id, next);
      if (!result.ok) {
        setItems((current) => current.map((t) => (t.id === task.id ? { ...t, done: !next } : t)));
        toast(result.error, "error");
      }
    });
  }

  function onAdd(event: React.FormEvent) {
    event.preventDefault();
    const text = label.trim();
    if (!text) return;
    const formData = new FormData();
    formData.set("label", text);
    formData.set("date", date);
    setLabel("");
    startTransition(async () => {
      const result = await addTask(null, formData);
      if (!result.ok) toast(result.error, "error");
    });
  }

  function onDelete(id: string) {
    setItems((current) => current.filter((t) => t.id !== id));
    startTransition(async () => {
      const result = await deleteTask(id);
      if (!result.ok) toast(result.error, "error");
    });
  }

  // Unticked work first, so the five on screen are the five that still matter.
  const ordered = [...items].sort((a, b) => Number(a.done) - Number(b.done));
  const shown = limit ? ordered.slice(0, limit) : ordered;
  const hidden = ordered.length - shown.length;

  return (
    <div className="flex flex-col gap-1" aria-busy={pending}>
      {items.length === 0 ? (
        <p className="py-2 text-[13px] text-muted">Nothing on the list. Add the first thing.</p>
      ) : null}

      {shown.map((task) => (
        <div key={task.id} className="group flex items-center gap-2">
          <button
            type="button"
            onClick={() => onToggle(task)}
            aria-pressed={task.done}
            className="flex min-h-11 flex-1 items-center gap-3 text-left text-sm"
          >
            <span
              aria-hidden
              className={cn(
                "flex size-5 shrink-0 items-center justify-center rounded-md border text-[13px] text-white",
                task.done ? "border-green bg-green" : "border-muted-dark bg-white",
              )}
            >
              {task.done ? "✓" : ""}
            </span>
            <span className={cn(task.done ? "text-muted line-through" : "text-ink")}>{task.label}</span>
          </button>
          <button
            type="button"
            onClick={() => onDelete(task.id)}
            aria-label={`Remove ${task.label}`}
            className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-dark opacity-0 transition-opacity hover:bg-well hover:text-alert focus-visible:opacity-100 group-hover:opacity-100"
          >
            <X className="size-4" />
          </button>
        </div>
      ))}

      {hidden > 0 ? (
        <p className="pt-1 text-xs text-muted">
          {hidden} more on the list.{" "}
          <Link href="/admin#today" className="text-green underline underline-offset-4">
            See all
          </Link>
        </p>
      ) : null}

      <form onSubmit={onAdd} className="mt-2 flex items-center gap-2">
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Add to today"
          aria-label="Add a task to today"
          className="h-10"
        />
        <button
          type="submit"
          aria-label="Add task"
          className="flex size-10 shrink-0 items-center justify-center rounded-[10px] border border-control bg-card hover:bg-well"
        >
          <Plus className="size-4" />
        </button>
      </form>
    </div>
  );
}
