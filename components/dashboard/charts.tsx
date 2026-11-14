"use client";
import { useState } from "react";
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from "recharts";
import { ChartNoAxesCombined, Wallet } from "lucide-react";
import { money, round } from "@/lib/model";
import { compactMoney, indianDate } from "@/lib/presentation";
export type ChartPoint = {
  key: string;
  day: string;
  revenue: number;
  collections: number;
  gap: number;
  balance: number;
  count: number;
};
export function ChartEmpty({
  message = "No data for this period",
}: {
  message?: string;
}) {
  return (
    <div className="chart-empty">
      <ChartNoAxesCombined size={28} aria-hidden="true" />
      <strong>{message}</strong>
      <span>Try a different period or create a new invoice.</span>
    </div>
  );
}
function SalesTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload as ChartPoint & { cumulative: number };
  return (
    <div className="sales-tooltip">
      <b>
        {point.key.length === 7
          ? new Date(point.key + "-01T12:00:00Z").toLocaleDateString("en-IN", {
              month: "long",
              year: "numeric",
            })
          : indianDate(point.key)}
      </b>
      <div>
        Revenue <strong>{money(point.revenue)}</strong>
      </div>
      <div>
        Collections <strong>{money(point.collections)}</strong>
      </div>
      <div>
        Uncollected gap <strong>{money(point.gap)}</strong>
      </div>
      <small>Gap = net revenue − collections, minimum ₹0.</small>
    </div>
  );
}
export function RevenueChart({
  data,
  total,
}: {
  data: ChartPoint[];
  total: number;
}) {
  let running = 0;
  const series = data.map((point) => ({
    ...point,
    cumulative: round((running += point.revenue)),
  }));
  const hasData = data.some((p) => p.revenue > 0 || p.collections > 0);
  return (
    <section className="card revenue-chart">
      <div className="card-heading">
        <div>
          <h3>Revenue & collections</h3>
          <p>Revenue progress and payments received</p>
        </div>
        <div className="legend">
          <span>
            <i className="legend-line" /> Revenue (cumulative)
          </span>
          <span>
            <i className="legend-bar" /> Collections
          </span>
        </div>
      </div>
      <div className="chart-summary">
        {money(total)}
        <span>net revenue in selected period</span>
      </div>
      {hasData ? (
        <>
          <div
            className="chart"
            role="img"
            aria-label="Collections as bars and cumulative revenue as a line. Use arrow keys to explore values."
          >
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={series}
                accessibilityLayer
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 4"
                  vertical={false}
                  stroke="#e6ebef"
                />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 12, fill: "#64748b" }}
                  axisLine={false}
                  tickLine={false}
                  minTickGap={24}
                />
                <YAxis
                  tickFormatter={compactMoney}
                  tick={{ fontSize: 12, fill: "#64748b" }}
                  width={64}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  content={<SalesTooltip />}
                  cursor={{ fill: "#0f9d8a0d" }}
                />
                <Bar
                  isAnimationActive={false}
                  name="Collections"
                  dataKey="collections"
                  fill="#0f9d8a"
                  radius={[3, 3, 0, 0]}
                  maxBarSize={28}
                />
                <Line
                  isAnimationActive={false}
                  name="Revenue (cumulative)"
                  type="monotone"
                  dataKey="cumulative"
                  stroke="#0e3b4a"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 5, stroke: "#fff", strokeWidth: 2 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <details className="chart-data">
            <summary>View chart data</summary>
            <div className="table-wrap">
              <table>
                <caption className="sr-only">
                  Revenue and collections for the selected period
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Date</th>
                    <th scope="col">Revenue</th>
                    <th scope="col">Collections</th>
                    <th scope="col">Uncollected gap</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((p) => (
                    <tr key={p.key}>
                      <td>{p.key.length === 7 ? p.day : indianDate(p.key)}</td>
                      <td>{money(p.revenue)}</td>
                      <td>{money(p.collections)}</td>
                      <td>{money(p.gap)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      ) : (
        <ChartEmpty />
      )}
    </section>
  );
}
export function PaymentChart({
  methods,
  total,
}: {
  methods: { name: string; value: number; color: string }[];
  total: number;
}) {
  const [highlight, setHighlight] = useState<string | null>(null);
  return (
    <section className="card payment-chart">
      <div className="card-heading">
        <div>
          <h3>Payment breakdown</h3>
          <p>How your customers pay</p>
        </div>
        <Wallet size={18} />
      </div>
      {total > 0 ? (
        <>
          <div className="donut">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart accessibilityLayer>
                <Pie
                  isAnimationActive={false}
                  data={methods}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={62}
                  outerRadius={84}
                  paddingAngle={4}
                  stroke="none"
                  onMouseEnter={(_, index) => setHighlight(methods[index].name)}
                  onMouseLeave={() => setHighlight(null)}
                >
                  {methods.map((m) => (
                    <Cell
                      key={m.name}
                      aria-label={`${m.name}: ${money(m.value)}, ${((m.value / total) * 100).toFixed(1)} percent`}
                      fill={m.color}
                      opacity={
                        highlight && highlight !== m.name?.toString() ? 0.35 : 1
                      }
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value, name) => [
                    `${money(Number(value))} · ${((Number(value) / total) * 100).toFixed(1)}%`,
                    name,
                  ]}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="donut-label">
              <small>{highlight || "COLLECTED"}</small>
              <b>
                {money(
                  highlight
                    ? methods.find((m) => m.name === highlight)?.value || 0
                    : total,
                )}
              </b>
            </div>
          </div>
          <div className="payment-legend">
            {methods.map((m) => (
              <button
                key={m.name}
                onMouseEnter={() => setHighlight(m.name)}
                onMouseLeave={() => setHighlight(null)}
                onFocus={() => setHighlight(m.name)}
                onBlur={() => setHighlight(null)}
                aria-label={`${m.name}: ${money(m.value)}, ${((m.value / total) * 100).toFixed(1)} percent of collections`}
              >
                <span>
                  <i style={{ background: m.color }} />
                  {m.name} <em>{((m.value / total) * 100).toFixed(1)}%</em>
                </span>
                <b>{money(m.value)}</b>
              </button>
            ))}
          </div>
        </>
      ) : (
        <ChartEmpty />
      )}
    </section>
  );
}
