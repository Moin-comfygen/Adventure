"use client";
import {
  ArrowDownRight,
  ArrowUpRight,
  Minus,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { LineChart, Line, ResponsiveContainer } from "recharts";
import { percentChange } from "@/lib/dashboard-presentation";
export function Trend({
  value,
  previous,
  lowerIsBetter = false,
}: {
  value: number;
  previous?: number;
  lowerIsBetter?: boolean;
}) {
  const delta = percentChange(value, previous);
  if (delta === undefined) return null;
  const good = lowerIsBetter ? delta < 0 : delta > 0;
  const Icon = delta === 0 ? Minus : delta > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={`trend ${delta === 0 ? "neutral" : good ? "positive" : "negative"}`}
    >
      <Icon size={14} aria-hidden="true" />
      {Math.abs(delta)}% <span>vs last period</span>
    </span>
  );
}
export function KpiCard({
  label,
  value,
  rawValue,
  previous,
  detail,
  icon: Icon,
  series,
  onClick,
  attention = false,
  lowerIsBetter = false,
  action,
}: {
  label: string;
  value: string;
  rawValue: number;
  previous?: number;
  detail: string;
  icon: LucideIcon;
  series: number[];
  onClick: () => void;
  attention?: boolean;
  lowerIsBetter?: boolean;
  action?: string;
}) {
  return (
    <button
      className={`stat kpi-card ${attention ? "attention" : ""}`}
      onClick={onClick}
      aria-label={`${label}: ${value}. ${action || "View details"}`}
    >
      <span className="stat-top">
        <span>{label}</span>
        <span className="kpi-icon">
          <Icon size={18} />
        </span>
      </span>
      <strong>{value}</strong>
      <span className="kpi-trend">
        <Trend
          value={rawValue}
          previous={previous}
          lowerIsBetter={lowerIsBetter}
        />
      </span>
      <span className="kpi-footer">
        <small>{detail}</small>
        <span className="sparkline" aria-hidden="true">
          <ResponsiveContainer width="100%" height={32}>
            <LineChart data={series.map((value) => ({ value }))}>
              <Line
                isAnimationActive={false}
                dataKey="value"
                type="monotone"
                dot={false}
                stroke={attention ? "#a66c0a" : "#087869"}
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </span>
      </span>
      {action && (
        <span className="kpi-action">
          {action}
          <ChevronRight size={14} />
        </span>
      )}
    </button>
  );
}
