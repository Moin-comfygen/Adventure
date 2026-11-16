"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Copy, RefreshCw, Link as LinkIcon, Check, Wallet } from "lucide-react";
import {
  money,
  allowed,
  type Invoice,
  type Role,
  type State,
} from "@/lib/model";
import { dateIN } from "@/lib/sales-ledger";
import { Dialog } from "@/components/ui/dialog";
import type {
  BookingSite,
  BookingStaffRole,
  CustomerBooking,
} from "@/lib/bookings/types";
async function api(path: string, options?: RequestInit) {
  const response = await fetch("/api/booking-staff/" + path, {
    cache: "no-store",
    ...options,
  });
  const body = await response.json();
  if (!response.ok)
    throw Error(body.error || "Could not load customer bookings.");
  return body;
}
export function BookingManager({
  state,
  role,
  onReceipts,
  onBranding,
  onView,
  focusBookingId,
}: {
  state: State;
  role: Role;
  onReceipts: (invoices: Invoice[]) => void;
  onBranding: (branding: NonNullable<State["bookingBranding"]>) => void;
  onView: (invoice: Invoice) => void;
  focusBookingId?: string;
}) {
  const [ready, setReady] = useState(false),
    [configured, setConfigured] = useState(true),
    [staff, setStaff] = useState<BookingStaffRole | null>(null),
    [code, setCode] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [site, setSite] = useState<BookingSite | null>(null),
    [bookings, setBookings] = useState<CustomerBooking[]>([]),
    [total, setTotal] = useState(0),
    [page, setPage] = useState(1),
    [filter, setFilter] = useState(""),
    [selected, setSelected] = useState<CustomerBooking | null>(null),
    [amount, setAmount] = useState(""),
    [method, setMethod] = useState("Cash"),
    [saving, setSaving] = useState(false),
    [copied, setCopied] = useState(false),
    [origin, setOrigin] = useState("");
  const brandingRef = useRef(onBranding),
    siteLoadedAt = useRef(0);
  brandingRef.current = onBranding;
  const receiptsRef = useRef(onReceipts),
    stateRef = useRef(state),
    paymentRequest = useRef(""),
    paymentBusy = useRef(false),
    focused = useRef("");
  receiptsRef.current = onReceipts;
  stateRef.current = state;
  useEffect(() => {
    setOrigin(location.origin);
    let cancelled = false;
    api("session")
      .then((body) => {
        if (cancelled) return;
        setConfigured(body.configured);
        setStaff(body.role || null);
      })
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setReady(true));
    return () => {
      cancelled = true;
    };
  }, []);
  const refresh = useCallback(async () => {
    if (!staff) return;
    try {
      const queue = await api(
        `requests?page=${page}&status=${encodeURIComponent(filter)}`,
      );
      setBookings(queue.bookings);
      setTotal(queue.total);
      if (Date.now() - siteLoadedAt.current > 300000) {
        const config = await api("site");
        setSite(config.site);
        if (config.site)
          brandingRef.current({
            template: config.site.template,
            services: config.site.services,
          });
        siteLoadedAt.current = Date.now();
      }
      const receipts = queue.bookings.flatMap((b: CustomerBooking) =>
        b.invoice ? [b.invoice] : [],
      );
      if (receipts.length) receiptsRef.current(receipts);
      setError("");
      if (focusBookingId && focused.current !== focusBookingId) {
        const booking = queue.bookings.find(
          (b: CustomerBooking) => b.id === focusBookingId,
        );
        if (booking) {
          focused.current = focusBookingId;
          if (booking.balance > 0) {
            setSelected(booking);
            setAmount(String(booking.balance));
            paymentRequest.current = crypto.randomUUID();
          }
        }
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }, [staff, page, filter, focusBookingId]);
  useEffect(() => {
    if (!staff) return;
    void refresh();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible" && !paymentBusy.current)
        void refresh();
    }, 15000);
    const focus = () => void refresh();
    addEventListener("focus", focus);
    return () => {
      clearInterval(timer);
      removeEventListener("focus", focus);
    };
  }, [staff, refresh]);
  async function login(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const data = await api("session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      setStaff(data.role);
      setCode("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function publish() {
    setBusy(true);
    setError("");
    try {
      const s = stateRef.current;
      const body = await api("site", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          business: s.business,
          services: s.services.map((service) => ({
            ...service,
            imageUrl: service.thumbnailUrl ? null : service.imageUrl,
          })),
          template: s.templates[s.defaultTemplate],
        }),
      });
      setSite(body.site);
      brandingRef.current({
        template: body.site.template,
        services: body.site.services,
      });
      siteLoadedAt.current = Date.now();
      setCopied(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function collect(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || paymentBusy.current) return;
    paymentBusy.current = true;
    setSaving(true);
    setError("");
    try {
      const body = await api(`requests/${selected.id}/collect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: paymentRequest.current,
          amount: Number(amount),
          method,
        }),
      });
      const booking: CustomerBooking = body.booking;
      if (booking.invoice) receiptsRef.current([booking.invoice]);
      setSelected(null);
      paymentRequest.current = "";
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      paymentBusy.current = false;
      setSaving(false);
    }
  }
  const canCollect =
      allowed(state, role, "Customer Bookings", "create") &&
      allowed(state, role, "Billing POS", "create"),
    canPrint = allowed(state, role, "Sales Management", "print");
  const link = site ? origin + "/book/" + site.slug : "";
  if (!ready)
    return (
      <section className="card booking-loading" role="status">
        <div className="skeleton" />
        Loading customer bookings…
      </section>
    );
  if (!staff)
    return (
      <section className="card booking-staff-login">
        <h2>Customer bookings</h2>
        <p>
          Customer requests and payments are shared between admin and reception.
          Sign in with the booking staff access code provided by your
          administrator.
        </p>
        {!configured && (
          <p className="info-note">
            Customer booking links are not activated yet. Shared booking storage
            and staff access must be connected by the administrator before links
            can be published.
          </p>
        )}
        <form onSubmit={login}>
          <label>
            Booking staff access code
            <input
              type="password"
              autoComplete="current-password"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </label>
          <button className="btn" disabled={busy || !configured}>
            {busy ? "Signing in…" : "Open booking queue"}
          </button>
        </form>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </section>
    );
  return (
    <div className="booking-manager">
      <div className="ledger-toolbar">
        <p>
          Customer bookings ·{" "}
          {staff === "Admin" ? "Booking administrator" : "Reception"}
        </p>
        <div className="heading-actions">
          <button
            className="btn secondary"
            onClick={() => {
              siteLoadedAt.current = 0;
              void refresh();
            }}
          >
            <RefreshCw size={16} />
            Refresh
          </button>
          <button
            className="btn secondary"
            onClick={async () => {
              try {
                await api("session", { method: "DELETE" });
                setStaff(null);
                setBookings([]);
                setSite(null);
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            Lock booking queue
          </button>
        </div>
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <section className="card booking-link-card">
        <h2>
          <LinkIcon size={18} />
          Customer booking link
        </h2>
        {link ? (
          <>
            <label>
              Share this link with customers
              <input readOnly value={link} onFocus={(e) => e.target.select()} />
            </label>
            <div className="heading-actions">
              <button
                className="btn secondary"
                onClick={() =>
                  navigator.clipboard
                    .writeText(link)
                    .then(() => setCopied(true))
                    .catch(() =>
                      setError("Select and copy the booking link above."),
                    )
                }
              >
                <Copy size={16} />
                {copied ? "Copied" : "Copy booking link"}
              </button>
              <a
                className="btn secondary"
                href={link}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open customer page
              </a>
            </div>
            <p>
              Customers enter their name, WhatsApp number, persons and
              activities. All bookings are pay at reception.
            </p>
          </>
        ) : (
          <p>No customer booking link has been published yet.</p>
        )}
        {staff === "Admin" &&
          role !== "Receptionist" &&
          allowed(state, role, "Customer Bookings", "edit") && (
            <button className="btn" disabled={busy} onClick={publish}>
              {busy
                ? "Publishing…"
                : site
                  ? "Update booking page from current settings"
                  : "Publish booking link"}
            </button>
          )}
      </section>
      <section className="card booking-queue">
        <div className="ledger-toolbar">
          <h2>
            {total} customer {total === 1 ? "booking" : "bookings"}
          </h2>
          <label>
            Payment status
            <select
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All bookings</option>
              {["Awaiting payment", "Partial", "Paid"].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
        </div>
        <p className="muted">
          New customer bookings appear here automatically. Payment is not
          collected until reception records it.
        </p>
        {!bookings.length ? (
          <div className="booking-empty">
            <h3>No customer bookings yet</h3>
            <p>Share the booking link to receive your first request.</p>
          </div>
        ) : (
          <div className="booking-queue-grid">
            {bookings.map((b) => (
              <article key={b.id} className="booking-queue-item">
                <div className="spread">
                  <b>{b.reference}</b>
                  <span className="booking-source">
                    <Check size={14} />
                    Booked by customer
                  </span>
                </div>
                <h3>{b.name}</h3>
                <p>
                  {b.phone} · {b.persons}{" "}
                  {b.persons === 1 ? "person" : "persons"} · {dateIN(b.date)}
                </p>
                <p>{b.lines.map((l) => l.name).join(", ")}</p>
                {b.notes && <p>Note: {b.notes}</p>}
                <dl>
                  <div>
                    <dt>Total</dt>
                    <dd>{money(b.total)}</dd>
                  </div>
                  <div>
                    <dt>Collected</dt>
                    <dd>{money(b.collected)}</dd>
                  </div>
                  <div>
                    <dt>To collect at reception</dt>
                    <dd>{money(b.balance)}</dd>
                  </div>
                </dl>
                <span
                  className={`ledger-status ledger-status-${b.status === "Paid" ? "paid" : b.status === "Partial" ? "partial" : "unpaid"}`}
                >
                  {b.status} · Pay at reception
                </span>
                <div className="heading-actions">
                  {b.balance > 0 && canCollect && (
                    <button
                      className="btn"
                      onClick={() => {
                        setSelected(b);
                        setAmount(String(b.balance));
                        setMethod("Cash");
                        paymentRequest.current = crypto.randomUUID();
                      }}
                    >
                      <Wallet size={16} />
                      Collect payment
                    </button>
                  )}
                  {b.invoice && canPrint && (
                    <button
                      className="btn secondary"
                      onClick={() => onView(b.invoice!)}
                    >
                      View invoice
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
        <div className="ledger-pagination">
          <span>
            Page {page} of {Math.max(1, Math.ceil(total / 25))}
          </span>
          <button
            className="btn secondary"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            Previous
          </button>
          <button
            className="btn secondary"
            disabled={page * 25 >= total}
            onClick={() => setPage(page + 1)}
          >
            Next
          </button>
        </div>
      </section>
      {selected && (
        <Dialog
          title="Collect booking payment"
          onClose={() => {
            if (!saving) setSelected(null);
          }}
        >
          <p>
            {selected.reference} · {selected.name} · {selected.phone}
          </p>
          <p>
            Balance due: <strong>{money(selected.balance)}</strong>
          </p>
          <form onSubmit={collect}>
            <label>
              Amount to collect (₹)
              <input
                type="number"
                min="0.01"
                step="0.01"
                max={selected.balance}
                required
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  paymentRequest.current = crypto.randomUUID();
                }}
              />
            </label>
            <label>
              Payment method
              <select
                value={method}
                onChange={(e) => {
                  setMethod(e.target.value);
                  paymentRequest.current = crypto.randomUUID();
                }}
              >
                {["Cash", "UPI", "Card", "Bank Transfer"].map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </label>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <button className="btn" disabled={saving}>
              {saving ? "Recording…" : "Collect payment"}
            </button>
          </form>
          <p className="muted">
            A receipt is created only after payment is recorded. The same
            receipt is updated for later partial payments.
          </p>
        </Dialog>
      )}
    </div>
  );
}
