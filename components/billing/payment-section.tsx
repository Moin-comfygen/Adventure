"use client";
import { useState } from "react";
import {
  Banknote,
  Check,
  CreditCard,
  Landmark,
  Plus,
  Smartphone,
  X,
} from "lucide-react";
import { money, round } from "@/lib/model";
import {
  paymentMethods,
  resolvedPayments,
  paymentError,
  percentagePayments,
  type PaymentMode,
  type PaymentRow,
} from "@/lib/billing-ui";
export function PaymentSection({
  mode,
  onMode,
  rows,
  onRows,
  total,
}: {
  mode: PaymentMode;
  onMode: (mode: PaymentMode) => void;
  rows: PaymentRow[];
  onRows: (rows: PaymentRow[]) => void;
  total: number;
}) {
  const [touched, setTouched] = useState(false);
  const resolved = resolvedPayments(mode, rows, total);
  const collected = round(resolved.reduce((n, row) => n + row.amount, 0));
  const error = paymentError(mode, rows, total);
  const icons = [Banknote, Smartphone, CreditCard, Landmark];
  const status =
    collected === 0 ? "Unpaid" : collected >= total ? "Paid" : "Partial";
  function selectMode(next: PaymentMode) {
    if (next === "partial" && mode !== "partial")
      onRows([{ method: rows[0]?.method || "UPI", amount: 0 }]);
    onMode(next);
    setTouched(false);
  }
  function addMode() {
    const current = resolved.length
      ? resolved
      : [{ method: rows[0]?.method || "UPI", amount: 0 }];
    const next =
      paymentMethods.find(
        (method) => !current.some((row) => row.method === method),
      ) || "Cash";
    const copy = current.map((row) => ({ ...row }));
    if (mode === "full") {
      const last = copy.length - 1;
      copy[last].amount = round(copy[last].amount / 2);
    }
    onRows([...copy, { method: next, amount: 0 }]);
  }
  return (
    <section className="pos-payment" aria-labelledby="pos-payment-heading">
      <div className="spread">
        <h4 id="pos-payment-heading">Payment</h4>
        <span
          className={`badge ${status === "Paid" ? "green" : status === "Partial" ? "amber" : "red"}`}
          aria-live="polite"
        >
          {status}
        </span>
      </div>
      <div
        className="payment-segments"
        role="group"
        aria-label="Payment amount"
      >
        <button
          type="button"
          aria-pressed={mode === "full"}
          onClick={() => selectMode("full")}
        >
          Full payment
        </button>
        <button
          type="button"
          aria-pressed={mode === "partial"}
          onClick={() => selectMode("partial")}
        >
          Partial payment
        </button>
      </div>
      <div
        className="payment-mode-chips"
        role="group"
        aria-label="Payment method"
      >
        {paymentMethods.map((method, index) => {
          const Icon = icons[index];
          return (
            <button
              type="button"
              key={method}
              aria-pressed={rows[0]?.method === method}
              onClick={() =>
                onRows(
                  rows.length
                    ? rows.map((row, i) => (i === 0 ? { ...row, method } : row))
                    : [{ method, amount: 0 }],
                )
              }
            >
              <Icon size={17} />
              <span>{method}</span>
            </button>
          );
        })}
      </div>
      {mode === "unpaid" ? (
        <div className="collect-later-note">
          No payment collected. This bill will be saved as Unpaid.
        </div>
      ) : mode === "full" && rows.length === 1 ? (
        <div className="full-payment-amount">
          <Check size={16} />
          <div>
            <b>{money(total)}</b>
            <small>Full amount · stays in sync with your bill</small>
          </div>
        </div>
      ) : (
        <div className="payment-allocations">
          {resolved.map((row, index) => (
            <div className="payment-allocation" key={index}>
              {rows.length > 1 ? (
                <label>
                  Mode {index + 1}
                  <select
                    aria-label={`Payment method ${index + 1}`}
                    value={row.method}
                    onChange={(e) =>
                      onRows(
                        rows.map((r, i) =>
                          i === index ? { ...r, method: e.target.value } : r,
                        ),
                      )
                    }
                  >
                    {paymentMethods.map((method) => (
                      <option key={method}>{method}</option>
                    ))}
                  </select>
                </label>
              ) : null}
              <label>
                {rows.length > 1 ? "Amount" : "Amount collected"}
                <input
                  aria-label={
                    rows.length > 1
                      ? `Amount for payment ${index + 1}`
                      : "Amount collected"
                  }
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  readOnly={mode === "full" && index === rows.length - 1}
                  value={row.amount}
                  onBlur={() => setTouched(true)}
                  aria-invalid={touched && !!error}
                  aria-describedby={
                    touched && error ? "pos-payment-error" : undefined
                  }
                  onChange={(e) => {
                    if (mode === "full" && index === rows.length - 1) return;
                    onRows(
                      rows.map((r, i) =>
                        i === index
                          ? { ...r, amount: Number(e.target.value) }
                          : r,
                      ),
                    );
                  }}
                />
                {mode === "full" && index === rows.length - 1 && (
                  <small>Auto-balanced remainder</small>
                )}
              </label>
              {rows.length > 1 && (
                <button
                  type="button"
                  className="icon-button"
                  title="Remove payment mode"
                  aria-label={`Remove payment mode ${index + 1}`}
                  onClick={() => onRows(rows.filter((_, i) => i !== index))}
                >
                  <X size={16} />
                </button>
              )}
            </div>
          ))}
          {mode === "partial" && (
            <div className="partial-quick">
              <span>Quick amount</span>
              {[25, 50].map((percent) => (
                <button
                  type="button"
                  key={percent}
                  onClick={() => {
                    onRows(
                      percentagePayments(rows, round((total * percent) / 100)),
                    );
                    setTouched(true);
                  }}
                >
                  {percent}%
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {touched && error && (
        <p className="field-error" id="pos-payment-error" role="alert">
          {error}
        </p>
      )}
      <div className="payment-secondary-actions">
        {mode !== "unpaid" && (
          <button
            type="button"
            className="link"
            disabled={rows.length >= 4}
            onClick={addMode}
          >
            <Plus size={13} /> Add another payment mode
          </button>
        )}
        <button
          type="button"
          className="link"
          aria-pressed={mode === "unpaid"}
          onClick={() => selectMode(mode === "unpaid" ? "full" : "unpaid")}
        >
          {mode === "unpaid" ? "Collect payment now" : "Collect later (unpaid)"}
        </button>
      </div>
      <div className="pos-balance" aria-live="polite">
        <div>
          <span>Collected</span>
          <b>{money(collected)}</b>
        </div>
        <div>
          <span>Balance due</span>
          <strong>{money(total - collected)}</strong>
        </div>
      </div>
    </section>
  );
}
