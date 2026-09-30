"use client";

import * as React from "react";
import { CalendarDays } from "lucide-react";
import { Input } from "./input";
import { describeDate, parseLooseDate } from "@/lib/parse-date";
import { todayIso } from "@/lib/dates";
import { cn } from "@/lib/utils";

/**
 * Type a date however you say it — "8 oct", "8th October", "8/10", "tomorrow",
 * "next fri", "+30" — and it resolves to a real date. The form still posts an
 * ISO string through a hidden field, so nothing downstream changes.
 *
 * The native picker is still there behind the calendar button, because
 * sometimes you want to look at a month rather than name a day.
 */
export function DateInput({
  name,
  defaultValue,
  required,
  id,
  className,
  onResolve,
}: {
  name: string;
  defaultValue?: string | null;
  required?: boolean;
  id?: string;
  className?: string;
  /** Fires with the ISO value whenever it changes, or "" when cleared. */
  onResolve?: (iso: string) => void;
}) {
  // Read once: a form that stays open past midnight should not quietly shift
  // what "tomorrow" means under the person typing.
  const today = React.useMemo(() => todayIso(), []);

  const [value, setValue] = React.useState(defaultValue ?? "");
  const [text, setText] = React.useState(defaultValue ? describeDate(defaultValue) : "");
  const pickerRef = React.useRef<HTMLInputElement>(null);

  function commit(next: string) {
    setValue(next);
    onResolve?.(next);
  }

  function onType(raw: string) {
    setText(raw);
    if (!raw.trim()) {
      commit("");
      return;
    }
    const parsed = parseLooseDate(raw, today);
    // Only commit what parses. Half-typed text leaves the last good value
    // alone rather than blanking the field on every keystroke.
    if (parsed) commit(parsed);
  }

  // On blur the text snaps to how the date reads back, so what is on screen
  // and what will be saved cannot disagree.
  function onBlur() {
    if (!text.trim()) {
      setText("");
      commit("");
      return;
    }
    const parsed = parseLooseDate(text, today);
    if (parsed) {
      setText(describeDate(parsed));
      commit(parsed);
    }
  }

  const unparsed = text.trim().length > 0 && !parseLooseDate(text, today);

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <input type="hidden" name={name} value={value} />
      <div className="relative">
        <Input
          id={id}
          value={text}
          required={required}
          onChange={(e) => onType(e.target.value)}
          onBlur={onBlur}
          placeholder="8 oct, tomorrow, 8/10…"
          inputMode="text"
          autoComplete="off"
          aria-invalid={unparsed || undefined}
          className={cn("pr-11", unparsed && "border-alert focus-visible:ring-alert")}
        />
        <button
          type="button"
          // showPicker is the only way to open the native calendar from a
          // button; clicking the hidden field itself does nothing on desktop.
          onClick={() => pickerRef.current?.showPicker?.()}
          aria-label="Pick from a calendar"
          className="absolute right-1 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-md text-muted hover:bg-well hover:text-ink"
        >
          <CalendarDays className="size-4" />
        </button>
        <input
          ref={pickerRef}
          type="date"
          tabIndex={-1}
          aria-hidden
          value={value}
          onChange={(e) => {
            const next = e.target.value;
            commit(next);
            setText(next ? describeDate(next) : "");
          }}
          className="pointer-events-none absolute right-3 bottom-0 size-0 opacity-0"
        />
      </div>

      {unparsed ? (
        <span className="text-xs text-alert">Not a date I recognise — try “8 oct” or “8/10”.</span>
      ) : value && text !== describeDate(value) ? (
        <span className="text-xs text-muted">{describeDate(value)}</span>
      ) : null}
    </div>
  );
}
