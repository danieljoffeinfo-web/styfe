"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";

/**
 * Add / remove / reorder lines. Posts one `name` field per line, so the server
 * action reads them with formData.getAll(name).
 */
export function ListEditor({
  name,
  label,
  initial = [],
  placeholder = "Add a line",
}: {
  name: string;
  label: string;
  initial?: string[];
  placeholder?: string;
}) {
  const [items, setItems] = React.useState<string[]>(initial);
  const [draft, setDraft] = React.useState("");

  function add() {
    const value = draft.trim();
    if (!value) return;
    setItems((current) => [...current, value]);
    setDraft("");
  }

  function move(index: number, delta: number) {
    setItems((current) => {
      const next = [...current];
      const target = index + delta;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-[13px] font-medium text-ink">{label}</span>

      {items.length === 0 ? (
        <p className="text-xs text-muted">Nothing yet.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {items.map((item, index) => (
            <li key={`${item}-${index}`} className="flex items-center gap-1.5">
              <input type="hidden" name={name} value={item} />
              <span className="flex-1 rounded-lg border border-line bg-card px-3 py-2 text-[13px]">
                {item}
              </span>
              <button
                type="button"
                onClick={() => move(index, -1)}
                disabled={index === 0}
                aria-label={`Move "${item}" up`}
                className="flex size-8 items-center justify-center rounded-md text-muted hover:bg-well disabled:opacity-30"
              >
                <ArrowUp className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => move(index, 1)}
                disabled={index === items.length - 1}
                aria-label={`Move "${item}" down`}
                className="flex size-8 items-center justify-center rounded-md text-muted hover:bg-well disabled:opacity-30"
              >
                <ArrowDown className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => setItems((current) => current.filter((_, i) => i !== index))}
                aria-label={`Remove "${item}"`}
                className="flex size-8 items-center justify-center rounded-md text-muted hover:bg-well hover:text-alert"
              >
                <X className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder={placeholder}
          aria-label={label}
          className="h-10"
        />
        <button
          type="button"
          onClick={add}
          aria-label={`Add to ${label}`}
          className="flex size-10 shrink-0 items-center justify-center rounded-[10px] border border-control bg-card hover:bg-well"
        >
          <Plus className="size-4" />
        </button>
      </div>
    </div>
  );
}
