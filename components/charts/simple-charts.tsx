"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatZar, formatZarCompact } from "@/lib/money";

const AXIS = { fill: "#5E5B55", fontSize: 11, fontFamily: "JetBrains Mono" } as const;
const TOOLTIP = {
  borderRadius: 10,
  border: "1px solid #E2DED5",
  fontSize: 13,
  fontFamily: "Inter",
} as const;

export function MoneyBarChart({
  data,
  color = "#1D6B4F",
  height = 220,
  horizontal = false,
}: {
  data: { label: string; cents: number }[];
  color?: string;
  height?: number;
  horizontal?: boolean;
}) {
  if (!data.length) {
    return <p className="py-6 text-center text-[13px] text-muted">Nothing to show yet.</p>;
  }
  const rows = data.map((d) => ({ label: d.label, value: d.cents / 100 }));

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <BarChart
          data={rows}
          layout={horizontal ? "vertical" : "horizontal"}
          margin={{ top: 8, right: 12, bottom: 4, left: horizontal ? 8 : 4 }}
        >
          <CartesianGrid stroke="#ECE8E0" strokeDasharray="3 4" vertical={horizontal} horizontal={!horizontal} />
          {horizontal ? (
            <>
              <XAxis type="number" tickLine={false} axisLine={false} tick={AXIS} tickFormatter={(v) => formatZarCompact(Number(v ?? 0))} />
              <YAxis
                type="category"
                dataKey="label"
                width={130}
                tickLine={false}
                axisLine={false}
                tick={{ fill: "#17171B", fontSize: 12 }}
              />
            </>
          ) : (
            <>
              <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: "#CFCAC0" }} tick={{ fill: "#5E5B55", fontSize: 12 }} />
              <YAxis width={46} tickLine={false} axisLine={false} tick={AXIS} tickFormatter={(v) => formatZarCompact(Number(v ?? 0))} />
            </>
          )}
          <Tooltip cursor={{ fill: "#F7F5F0" }} contentStyle={TOOLTIP} formatter={(v) => formatZar(Number(v ?? 0))} />
          <Bar dataKey="value" fill={color} radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CountLineChart({
  data,
  height = 200,
  color = "#1D6B4F",
}: {
  data: { label: string; value: number }[];
  height?: number;
  color?: string;
}) {
  if (!data.length) {
    return <p className="py-6 text-center text-[13px] text-muted">Nothing to show yet.</p>;
  }
  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
          <CartesianGrid stroke="#ECE8E0" strokeDasharray="3 4" vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: "#CFCAC0" }} tick={{ fill: "#5E5B55", fontSize: 12 }} />
          <YAxis width={32} allowDecimals={false} tickLine={false} axisLine={false} tick={AXIS} />
          <Tooltip contentStyle={TOOLTIP} />
          <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SplitDonut({
  data,
  height = 220,
}: {
  data: { label: string; cents: number; color: string }[];
  height?: number;
}) {
  const rows = data.filter((d) => d.cents > 0).map((d) => ({ ...d, value: d.cents / 100 }));
  if (!rows.length) {
    return <p className="py-6 text-center text-[13px] text-muted">Nothing to show yet.</p>;
  }
  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <PieChart>
          <Pie data={rows} dataKey="value" nameKey="label" innerRadius="55%" outerRadius="82%" paddingAngle={2}>
            {rows.map((row) => (
              <Cell key={row.label} fill={row.color} stroke="#FFFFFF" strokeWidth={2} />
            ))}
          </Pie>
          <Tooltip contentStyle={TOOLTIP} formatter={(v) => formatZar(Number(v ?? 0))} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
