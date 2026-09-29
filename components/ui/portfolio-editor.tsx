"use client";

import * as React from "react";
import { Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { PortfolioLink } from "@/lib/types";

/**
 * Showcase links on an offering. Posts `portfolio_label` and `portfolio_url`
 * in matching order so the action can zip them back into pairs — the same
 * shape-by-convention the ListEditor uses, rather than a JSON blob in a
 * hidden field that nothing can validate.
 */
export function PortfolioEditor({ initial = [] }: { initial?: PortfolioLink[] }) {
  const [items, setItems] = React.useState<PortfolioLink[]>(initial);
  const [label, setLabel] = React.useState("");
  const [url, setUrl] = React.useState("");

  function add() {
    const trimmedUrl = url.trim();
    if (!trimmedUrl) return;
    const withScheme = /^https?:\/\//i.test(trimmedUrl) ? trimmedUrl : `https://${trimmedUrl}`;
    setItems((current) => [...current, { label: label.trim() || withScheme, url: withScheme }]);
    setLabel("");
    setUrl("");
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-[13px] font-medium text-ink">Portfolio</span>

      {items.length === 0 ? (
        <p className="text-xs text-muted">No links yet.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {items.map((item, index) => (
            <li key={`${item.url}-${index}`} className="flex items-center gap-1.5">
              <input type="hidden" name="portfolio_label" value={item.label} />
              <input type="hidden" name="portfolio_url" value={item.url} />
              <span className="flex-1 truncate rounded-lg border border-line bg-card px-3 py-2 text-[13px]">
                {item.label}
                <span className="ml-2 text-muted">{item.url}</span>
              </span>
              <button
                type="button"
                onClick={() => setItems((c) => c.filter((_, i) => i !== index))}
                aria-label={`Remove ${item.label}`}
                className="flex size-9 items-center justify-center rounded-md text-muted-dark hover:bg-well hover:text-ink"
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-1.5">
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Wulf Golf Carts"
          aria-label="Portfolio label"
        />
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="wulfgolfcarts.co.za"
          aria-label="Portfolio URL"
        />
        <button
          type="button"
          onClick={add}
          aria-label="Add portfolio link"
          className="flex size-9 shrink-0 items-center justify-center rounded-md border border-line text-muted hover:bg-well hover:text-ink"
        >
          <Plus className="size-4" />
        </button>
      </div>
    </div>
  );
}
