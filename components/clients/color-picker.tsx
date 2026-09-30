"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { CLIENT_COLORS } from "@/lib/clients";
import { cn } from "@/lib/utils";

/**
 * Radios rather than buttons, so the arrow keys move through the swatches and
 * the value posts with the rest of the form. "Auto" clears the column, which
 * is what lets the relationship fallback keep working.
 */
export function ColorPicker({ name = "color", defaultValue }: { name?: string; defaultValue?: string | null }) {
  const [value, setValue] = React.useState(defaultValue ?? "");

  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="text-[13px] font-medium text-ink">Colour</legend>
      <div className="flex flex-wrap gap-2 pt-1">
        <Swatch
          name={name}
          value=""
          label="Auto — follows the relationship"
          checked={value === ""}
          onSelect={setValue}
        />
        {CLIENT_COLORS.map((color) => (
          <Swatch
            key={color.value}
            name={name}
            value={color.value}
            label={color.label}
            checked={value === color.value}
            onSelect={setValue}
          />
        ))}
      </div>
    </fieldset>
  );
}

function Swatch({
  name,
  value,
  label,
  checked,
  onSelect,
}: {
  name: string;
  value: string;
  label: string;
  checked: boolean;
  onSelect: (value: string) => void;
}) {
  return (
    <label
      title={label}
      className={cn(
        // 44px target at 390px, as the responsive rules require.
        "relative flex h-11 w-11 cursor-pointer items-center justify-center rounded-[10px] border transition-colors",
        checked ? "border-ink" : "border-line hover:border-control",
      )}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={() => onSelect(value)}
        className="sr-only"
      />
      <span className="sr-only">{label}</span>
      <span
        aria-hidden
        className={cn(
          "flex h-7 w-7 items-center justify-center rounded-full",
          value ? "" : "border border-dashed border-control",
        )}
        style={value ? { background: value } : undefined}
      >
        {checked && value ? <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} /> : null}
        {checked && !value ? <Check className="h-3.5 w-3.5 text-ink" strokeWidth={3} /> : null}
      </span>
    </label>
  );
}
