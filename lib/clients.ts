import type { Client, ClientRelationship } from "@/lib/types";

/**
 * Clients carry a colour so the list reads at a glance. `color` is null until
 * one is picked, so the relationship supplies a sensible starting point rather
 * than every client rendering the same grey.
 */
const BY_RELATIONSHIP: Record<ClientRelationship, string> = {
  retainer: "#1D6B4F",
  employer: "#2F5D8A",
  project: "#C9A77A",
};

/**
 * Nine swatches, all drawn from or sitting beside the design tokens, so a
 * coloured client never fights the page. Muted on purpose — CLAUDE.md rules
 * out anything that reads as a highlighter.
 */
export const CLIENT_COLORS = [
  { value: "#1D6B4F", label: "Green" },
  { value: "#2C6E6B", label: "Teal" },
  { value: "#2F5D8A", label: "Blue" },
  { value: "#6B3F63", label: "Plum" },
  { value: "#8A3E12", label: "Rust" },
  { value: "#C9A77A", label: "Sand" },
  { value: "#6B6B31", label: "Olive" },
  { value: "#5E5B55", label: "Stone" },
  { value: "#17171B", label: "Ink" },
];

export function clientColor(client: Pick<Client, "color" | "relationship">): string {
  return client.color ?? BY_RELATIONSHIP[client.relationship] ?? "#C9A77A";
}

/**
 * The same colour at wash strength, for a card background or a chip. Eight-digit
 * hex keeps it one value rather than a second token per client.
 */
export function clientWash(client: Pick<Client, "color" | "relationship">): string {
  return `${clientColor(client)}14`;
}
