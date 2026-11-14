"use client";
import { useState } from "react";
import {
  ArrowRight,
  Mountain,
  Plus,
  Receipt,
  FileText,
  TrendingUp,
  Wallet,
  X,
  Compass,
} from "lucide-react";

import {
  State,
  Invoice,
  Module,
  Role,
  money,
  round,
  paid,
  earned,
  settled,
  allowed,
} from "@/lib/model";
import { inPeriod, collectionTotal } from "@/lib/analytics";
import { avatarStyle, initials, pluralize } from "@/lib/presentation";
import { KpiCard, Trend } from "./kpi-card";
import {
  dashboardSeries,
  previousMetrics,
  previousBounds,
} from "@/lib/dashboard-presentation";
import { RevenueChart, PaymentChart, ChartEmpty } from "./charts";
export const periodLabels: Record<string, string> = {
  today: "Today",
  week: "This week",
  month: "This month",
  year: "This year",
  all: "All time",
};
export function PeriodTabs({
  range,
  custom,
  onSelect,
}: {
  range: string;
  custom: boolean;
  onSelect: (range: string) => void;
}) {
  return (
    <div
      className="tabs period-tabs"
      role="group"
      aria-label="Dashboard period"
    >
      {Object.entries(periodLabels).map(([value, label]) => (
        <button
          key={value}
          aria-pressed={!custom && range === value}
          className={!custom && range === value ? "selected" : ""}
          onClick={() => onSelect(value)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
export type OverviewProps = {
  state: State;
  role: Role;
  invoices: Invoice[];
  range: string;
  from: string;
  to: string;
  onNavigate: (module: Module, filter?: string) => void;
  onAddAgent: () => void;
  onAgent: (id: string) => void;
  table: (list: Invoice[], compact?: boolean) => React.ReactNode;
};
const palette = ["#3b82f6", "#0e3b4a", "#f59e0b", "#0f9d8a"];
export function Overview({
  state,
  role,
  invoices,
  range,
  from,
  to,
  onNavigate,
  onAddAgent,
  onAgent,
  table,
}: OverviewProps) {
  const [dismissed, setDismissed] = useState(false);
  const active = invoices.filter((i) => i.status === "Active");
  const match = (date: string) => inPeriod(date, range, from, to);
  const scoped = active.filter((i) => match(i.date));
  const revenue = (list: Invoice[]) =>
    round(list.reduce((a, i) => a + i.base + i.charges, 0));
  const totalRevenue = revenue(scoped),
    totalPaid = collectionTotal(active, match),
    balance = round(scoped.reduce((a, i) => a + i.total - paid(i), 0));
  const chart = dashboardSeries(active, range, from, to);
  const previous = previousMetrics(active, range, from, to);
  const methods = ["UPI", "Cash", "Card", "Bank Transfer"].map(
    (name, index) => ({
      name,
      value: collectionTotal(active, match, name),
      color: palette[index],
    }),
  );
  const activities = state.services
    .map((service) => ({
      name: service.name,
      value: round(
        scoped.reduce(
          (a, i) =>
            a +
            i.lines
              .filter((l) => l.serviceId === service.id)
              .reduce(
                (b, l) =>
                  b +
                  l.qty *
                    l.price *
                    (1 - (i.subtotal ? i.discount / i.subtotal : 0)),
                0,
              ),
          0,
        ),
      ),
    }))
    .sort((a, b) => b.value - a.value);
  const agents = state.agents
    .map((agent) => ({
      ...agent,
      value: revenue(scoped.filter((i) => i.agentId === agent.id)),
      bookings: scoped.filter((i) => i.agentId === agent.id).length,
    }))
    .sort((a, b) => b.value - a.value);
  const pending = active.filter(
    (i) =>
      i.date.slice(0, 10) === new Date().toISOString().slice(0, 10) &&
      paid(i) < i.total,
  ).length;
  const hour = Number(
    new Intl.DateTimeFormat("en-IN", {
      hour: "numeric",
      hourCycle: "h23",
      timeZone: "Asia/Kolkata",
    }).format(new Date()),
  );
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="dashboard-overview">
      {!dismissed && (
        <section className="greeting-strip" aria-label="Welcome">
          <div>
            <h2>
              {greeting}, {role === "Super Admin" ? "Admin" : role}.
            </h2>
            <p>
              {pluralize(pending, "payment")} pending from today’s invoices.
            </p>
          </div>
          <button
            className="greeting-cta"
            onClick={() => onNavigate("Billing POS")}
          >
            Start a new booking <ArrowRight size={16} />
          </button>
          <Mountain
            className="greeting-mountain"
            size={128}
            strokeWidth={1.5}
            aria-hidden="true"
          />
          <button
            className="dismiss-greeting"
            aria-label="Dismiss greeting"
            onClick={() => setDismissed(true)}
          >
            <X size={16} />
          </button>
        </section>
      )}
      <div className="stats-grid dashboard-kpis">
        <KpiCard
          label="Invoiced revenue"
          value={money(totalRevenue)}
          rawValue={totalRevenue}
          previous={previous?.revenue}
          detail="Excludes GST · includes additional charges"
          icon={TrendingUp}
          series={chart.map((p) => p.revenue)}
          onClick={() => onNavigate("Sales Management", "period")}
        />
        <KpiCard
          label="Total collections"
          value={money(totalPaid)}
          rawValue={totalPaid}
          previous={previous?.collections}
          detail="Actual customer payments received"
          icon={Wallet}
          series={chart.map((p) => p.collections)}
          onClick={() => onNavigate("Reports", "collections")}
        />
        <KpiCard
          label="Outstanding payments"
          value={money(balance)}
          rawValue={balance}
          previous={previous?.balance}
          detail="Customer balances to collect"
          icon={Receipt}
          series={chart.map((p) => p.balance)}
          onClick={() => onNavigate("Sales Management", "outstanding")}
          attention={balance > 0}
          lowerIsBetter
          action="Collect payments"
        />
        <KpiCard
          label="Total invoices"
          value={String(scoped.length)}
          rawValue={scoped.length}
          previous={previous?.count}
          detail={pluralize(
            scoped.reduce(
              (a, i) => a + i.lines.reduce((b, l) => b + l.qty, 0),
              0,
            ),
            "adventure participant",
          )}
          icon={FileText}
          series={chart.map((p) => p.count)}
          onClick={() => onNavigate("Sales Management", "period")}
        />
      </div>
      <div className="dashboard-grid">
        <RevenueChart data={chart} total={totalRevenue} />
        <PaymentChart methods={methods} total={totalPaid} />
      </div>
      <div className="dashboard-grid lower">
        <section className="card">
          <div className="card-heading">
            <div>
              <h3>Top adventures</h3>
              <p>Experiences your customers love</p>
            </div>
            <span className="subtle-tag">By net revenue</span>
          </div>
          {activities.some((a) => a.value > 0) ? (
            activities
              .filter((a) => a.value > 0)
              .slice(0, 4)
              .map((a) => (
                <div className="activity-row" key={a.name}>
                  <span className="activity-icon">
                    <Compass size={20} />
                  </span>
                  <div>
                    <b>{a.name}</b>
                    <div
                      className="progress"
                      role="progressbar"
                      aria-label={`${a.name} share of activity revenue`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.round(
                        (a.value /
                          activities.reduce((n, item) => n + item.value, 0)) *
                          100,
                      )}
                    >
                      <span
                        style={{
                          width: `${activities.reduce((n, item) => n + item.value, 0) ? (a.value / activities.reduce((n, item) => n + item.value, 0)) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                  <strong>
                    {money(a.value)}
                    <small>
                      {(
                        (a.value /
                          activities.reduce((n, item) => n + item.value, 0)) *
                        100
                      ).toFixed(1)}
                      % share
                    </small>
                  </strong>
                </div>
              ))
          ) : (
            <ChartEmpty />
          )}
        </section>
        <section className="card">
          <div className="card-heading">
            <div>
              <h3>Agent performance</h3>
              <p>Your partners in every adventure</p>
            </div>
            {allowed(state, role, "Agents & Commissions", "create") && (
              <button
                className="btn secondary small-button"
                onClick={onAddAgent}
              >
                <Plus size={14} /> Add agent
              </button>
            )}
          </div>
          {agents.some((a) => a.bookings > 0) ? (
            agents
              .filter((a) => a.bookings > 0)
              .slice(0, 3)
              .map((a, i) => (
                <button
                  className="agent-rank"
                  key={a.id}
                  onClick={() => onAgent(a.id)}
                  disabled={!allowed(state, role, "Agents & Commissions")}
                  aria-label={`Open ${a.name} ledger, ${pluralize(a.bookings, "booking")}, ${money(a.value)} revenue`}
                >
                  <span className={`rank ${i === 0 ? "rank-first" : ""}`}>
                    {i + 1}
                  </span>
                  <span className="avatar" style={avatarStyle(a.name)}>
                    {initials(a.name)}
                  </span>
                  <span className="agent-name">
                    <b>{a.name}</b>
                    <small>{pluralize(a.bookings, "booking")}</small>
                  </span>
                  <strong>
                    {money(a.value)}
                    <ArrowRight size={14} />
                  </strong>
                </button>
              ))
          ) : (
            <ChartEmpty message="No agent bookings for this period" />
          )}
          <button
            className="full-link"
            onClick={() => onNavigate("Agents & Commissions")}
          >
            View all agents <ArrowRight size={14} />
          </button>
        </section>
      </div>
      <section className="card recent">
        <div className="card-heading">
          <div>
            <h3>Recent invoices</h3>
            <p>A quick look at your latest bookings</p>
          </div>
          <button
            className="link"
            onClick={() => onNavigate("Sales Management")}
          >
            View all invoices <ArrowRight size={15} />
          </button>
        </div>
        {table(
          [...scoped].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5),
          true,
        )}
      </section>
      <section className="card period-summary">
        <div className="card-heading">
          <div>
            <h3>Revenue snapshots</h3>
            <p>Net revenue across your calendar periods</p>
          </div>
          <span className="subtle-tag">Across all dates</span>
        </div>
        <div className="snapshot-tiles">
          {["Today", "Yesterday", "This week", "This month", "This year"].map(
            (label, index) => {
              const day = new Date();
              if (index === 1) day.setDate(day.getDate() - 1);
              const list = active.filter((i) =>
                index < 2
                  ? i.date.slice(0, 10) === day.toISOString().slice(0, 10)
                  : inPeriod(i.date, ["", "", "week", "month", "year"][index]),
              );
              return (
                <div key={label}>
                  <span>{label}</span>
                  <b>{money(revenue(list))}</b>
                  {(() => {
                    const ref = new Date();
                    if (index === 1) ref.setDate(ref.getDate() - 1);
                    const bounds = previousBounds(
                      index < 2
                        ? "today"
                        : ["", "", "week", "month", "year"][index],
                      "",
                      "",
                      ref,
                    );
                    const prior = bounds
                      ? active.filter((i) =>
                          inPeriod(i.date, "all", bounds.start, bounds.end),
                        )
                      : [];
                    return (
                      <Trend
                        value={revenue(list)}
                        previous={prior.length ? revenue(prior) : undefined}
                      />
                    );
                  })()}
                </div>
              );
            },
          )}
        </div>
      </section>
      <section className="card commission-summary">
        <div className="card-heading">
          <div>
            <h3>Agents & commissions</h3>
            <p>Selected-period referred sales · all-time commission balances</p>
          </div>
          <button
            className="link"
            onClick={() => onNavigate("Agents & Commissions")}
          >
            Open ledger <ArrowRight size={15} />
          </button>
        </div>
        <div className="snapshot-tiles">
          <div>
            <span>Active agents</span>
            <b>{state.agents.filter((a) => a.active).length}</b>
          </div>
          <div>
            <span>Agent-generated sales</span>
            <b>{money(revenue(scoped.filter((i) => i.agentId)))}</b>
          </div>
          <div>
            <span>Commission earned</span>
            <b>
              {money(state.agents.reduce((n, a) => n + earned(state, a.id), 0))}
            </b>
          </div>
          <div>
            <span>Commission paid / adjusted</span>
            <b>{money(state.payouts.reduce((a, p) => a + p.amount, 0))}</b>
          </div>
          <div>
            <span>Outstanding commission</span>
            <b>
              {money(
                state.agents.reduce(
                  (n, a) => n + earned(state, a.id) - settled(state, a.id),
                  0,
                ),
              )}
            </b>
          </div>
        </div>
      </section>
    </div>
  );
}
