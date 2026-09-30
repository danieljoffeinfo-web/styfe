"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatZar, formatZarCompact } from "@/lib/money";
import { monthLabel, monthLabelLong } from "@/lib/dates";

export interface IncomePoint {
  month: string;
  recurringCents: number;
  onceOffCents: number;
  totalCents: number;
}

export function IncomeChart({ data, height = 240 }: { data: IncomePoint[]; height?: number }) {
  const rows = data.map((d) => ({
    month: d.month,
    label: monthLabel(d.month),
    recurring: d.recurringCents / 100,
    onceOff: d.onceOffCents / 100,
    total: d.totalCents / 100,
  }));

  if (rows.every((r) => r.total === 0)) {
    return (
      <p className="rounded-xl border border-dashed border-line bg-well/35 px-4 py-10 text-center text-[13px] text-muted">
        No revenue recorded yet. Add revenue to see the monthly trend.
      </p>
    );
  }

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <BarChart data={rows} margin={{ top: 22, right: 8, bottom: 4, left: 4 }} barCategoryGap="28%">
          <CartesianGrid vertical={false} stroke="#E5E5E7" strokeDasharray="3 4" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={{ stroke: "#D2D2D7" }}
            tick={{ fill: "#5F5F65", fontSize: 12 }}
          />
          <YAxis
            width={46}
            tickLine={false}
            axisLine={false}
            tick={{ fill: "#5F5F65", fontSize: 11, fontFamily: "JetBrains Mono" }}
            tickFormatter={(v: number) => (v === 0 ? "0" : formatZarCompact(v))}
          />
          <Tooltip
            cursor={{ fill: "#F0F0F2" }}
            contentStyle={{
              borderRadius: 10,
              border: "1px solid #E5E5E7",
              fontSize: 13,
              fontFamily: "Archivo",
            }}
            labelFormatter={(_, payload) =>
              payload?.[0] ? monthLabelLong(String(payload[0].payload.month)) : ""
            }
            formatter={(value, name) => [
              formatZar(Number(value ?? 0)),
              name === "recurring" ? "Recurring" : "Once-off",
            ]}
          />
          <Bar dataKey="recurring" stackId="income" fill="#197A30" radius={[0, 0, 4, 4]} />
          <Bar dataKey="onceOff" stackId="income" fill="#D7C29E" radius={[4, 4, 0, 0]}>
            <LabelList
              dataKey="total"
              position="top"
              offset={8}
              fill="#1D1D1F"
              fontSize={12}
              fontFamily="IBM Plex Mono"
              formatter={(v) => (Number(v) ? formatZarCompact(Number(v)) : "")}
            />
            {rows.map((row) => (
              <Cell key={row.month} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ChartLegend({ items }: { items: { color: string; label: string }[] }) {
  return (
    <div className="flex flex-wrap gap-4 text-xs text-muted">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-[2px]" style={{ background: item.color }} />
          {item.label}
        </div>
      ))}
    </div>
  );
}
