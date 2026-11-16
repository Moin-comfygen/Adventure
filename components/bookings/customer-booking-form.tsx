"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, MapPin, Phone, Users } from "lucide-react";
import { calculate, money } from "@/lib/model";
import { indiaDay, dateIN } from "@/lib/sales-ledger";
import { ServiceThumbnail } from "@/components/services/service-thumbnail";
import type { PublicBookingSite } from "@/lib/bookings/types";
type Confirmation = {
  reference: string;
  name: string;
  phone: string;
  persons: number;
  date: string;
  total: number;
  lines: { name: string; qty: number }[];
};
export function CustomerBookingForm({ slug }: { slug: string }) {
  const [site, setSite] = useState<PublicBookingSite | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [name, setName] = useState(""),
    [phone, setPhone] = useState(""),
    [persons, setPersons] = useState(1),
    [date, setDate] = useState(indiaDay),
    [ids, setIds] = useState<string[]>([]),
    [notes, setNotes] = useState(""),
    [website, setWebsite] = useState(""),
    [saving, setSaving] = useState(false),
    [confirmation, setConfirmation] = useState<Confirmation | null>(null),
    [reload, setReload] = useState(0);
  const requestId = useRef(""),
    savingRef = useRef(false);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    fetch("/api/customer-booking/" + encodeURIComponent(slug), {
      cache: "no-store",
    })
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok)
          throw Error(body.error || "This booking link is unavailable.");
        if (!cancelled) setSite(body.site);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug, reload]);
  const totals = useMemo(() => {
    const services = site?.services.filter((s) => ids.includes(s.id)) || [];
    return services.length
      ? calculate(
          services.map((s) => ({
            serviceId: s.id,
            name: s.name,
            price: s.price,
            qty: Number.isInteger(persons) && persons > 0 ? persons : 1,
            gst: s.gst,
            date,
            slot: "",
          })),
          0,
          0,
        )
      : { subtotal: 0, tax: 0, total: 0 };
  }, [site, ids, persons, date]);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError("");
    if (!requestId.current) requestId.current = crypto.randomUUID();
    try {
      const response = await fetch(
        "/api/customer-booking/" + encodeURIComponent(slug),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            requestId: requestId.current,
            siteVersion: site?.publishedAt,
            name,
            phone,
            persons,
            serviceIds: ids,
            date,
            notes,
            website,
          }),
        },
      );
      const body = await response.json();
      if (!response.ok)
        throw Error(
          body.error || "Could not place your booking. Please try again.",
        );
      setConfirmation(body.booking);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }
  return (
    <main className="public-booking">
      <div className="public-booking-shell">
        <header className="public-booking-header">
          <span className="booking-wordmark">
            {site?.business.name || "Adventure bookings"}
          </span>
          <span>Customer booking</span>
        </header>
        {loading ? (
          <section className="card booking-loading" role="status">
            <div className="skeleton" />
            Loading activities…
          </section>
        ) : !site ? (
          <section className="card booking-empty">
            <h1>Booking link unavailable</h1>
            <p role="alert">
              {error || "Please contact the business for a new booking link."}
            </p>
            <button
              className="btn secondary"
              onClick={() => setReload(reload + 1)}
            >
              Try again
            </button>
          </section>
        ) : confirmation ? (
          <section className="card booking-confirmation">
            <Check size={32} />
            <h1>Your booking is received</h1>
            <p>
              Thank you, {confirmation.name}! Show this reference at reception.
            </p>
            <strong className="booking-reference">
              {confirmation.reference}
            </strong>
            <dl>
              <div>
                <dt>Booking</dt>
                <dd>Booked by customer</dd>
              </div>
              <div>
                <dt>Activities</dt>
                <dd>{confirmation.lines.map((l) => l.name).join(", ")}</dd>
              </div>
              <div>
                <dt>Date</dt>
                <dd>{dateIN(confirmation.date)}</dd>
              </div>
              <div>
                <dt>Persons</dt>
                <dd>{confirmation.persons}</dd>
              </div>
              <div>
                <dt>Amount to pay at reception</dt>
                <dd>{money(confirmation.total)}</dd>
              </div>
              <div>
                <dt>Payment</dt>
                <dd>Not paid · Pay at reception</dd>
              </div>
            </dl>
            <p>
              No online payment has been taken. Reception will collect payment
              when you arrive.
            </p>
            <button
              className="btn secondary"
              onClick={() => {
                requestId.current = "";
                setConfirmation(null);
                setIds([]);
              }}
            >
              Make another booking
            </button>
          </section>
        ) : (
          <>
            <section className="booking-intro">
              <p className="eyebrow">Your next adventure</p>
              <h1>Book with {site.business.name}</h1>
              <p>
                Choose your activities and number of persons. Pay at reception
                when you arrive.
              </p>
              <div className="booking-business-details">
                {site.business.address && (
                  <span>
                    <MapPin size={16} />
                    {site.business.address}
                  </span>
                )}
                {site.business.phone && (
                  <a href={`tel:${site.business.phone.replace(/[^+\d]/g, "")}`}>
                    <Phone size={16} />
                    {site.business.phone}
                  </a>
                )}
              </div>
            </section>
            <form className="customer-booking-grid" onSubmit={submit}>
              <div>
                <section className="card">
                  <h2>Your details</h2>
                  <div className="booking-form-fields">
                    <label htmlFor="booking-name">
                      Your name
                      <input
                        id="booking-name"
                        autoComplete="name"
                        required
                        minLength={2}
                        maxLength={100}
                        value={name}
                        onChange={(e) => {
                          setName(e.target.value);
                          requestId.current = "";
                        }}
                      />
                    </label>
                    <label htmlFor="booking-phone">
                      WhatsApp / mobile number
                      <input
                        id="booking-phone"
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        placeholder="10-digit mobile number"
                        required
                        maxLength={20}
                        value={phone}
                        onChange={(e) => {
                          setPhone(e.target.value);
                          requestId.current = "";
                        }}
                      />
                    </label>
                    <label htmlFor="booking-persons">
                      <span>
                        <Users size={16} />
                        Number of persons
                      </span>
                      <input
                        id="booking-persons"
                        type="number"
                        min={1}
                        max={100}
                        step={1}
                        required
                        value={persons || ""}
                        onChange={(e) => {
                          setPersons(Number(e.target.value));
                          requestId.current = "";
                        }}
                      />
                    </label>
                    <label htmlFor="booking-date">
                      Activity date
                      <input
                        id="booking-date"
                        type="date"
                        min={indiaDay()}
                        required
                        value={date}
                        onChange={(e) => {
                          setDate(e.target.value);
                          requestId.current = "";
                        }}
                      />
                    </label>
                  </div>
                  <div className="booking-honeypot" aria-hidden="true">
                    <label>
                      Website
                      <input
                        tabIndex={-1}
                        autoComplete="off"
                        value={website}
                        onChange={(e) => setWebsite(e.target.value)}
                      />
                    </label>
                  </div>
                </section>
                <section className="card">
                  <h2>Choose activities</h2>
                  <p>
                    Prices are per person. GST is included in your booking total
                    below.
                  </p>
                  <div className="public-activity-grid">
                    {site.services.map((service) => (
                      <label
                        key={service.id}
                        className={`public-activity ${ids.includes(service.id) ? "selected" : ""}`}
                      >
                        <input
                          type="checkbox"
                          checked={ids.includes(service.id)}
                          onChange={(e) => {
                            setIds(
                              e.target.checked
                                ? [...ids, service.id]
                                : ids.filter((id) => id !== service.id),
                            );
                            requestId.current = "";
                          }}
                        />
                        <ServiceThumbnail service={service} size={48} />
                        <span>
                          <b>{service.name}</b>
                          <small>
                            {service.category} · {service.gst}% GST
                          </small>
                          <strong>{money(service.price)}</strong>
                        </span>
                      </label>
                    ))}
                  </div>
                </section>
                <section className="card">
                  <label htmlFor="booking-notes">
                    Anything we should know? (optional)
                    <textarea
                      id="booking-notes"
                      maxLength={500}
                      rows={3}
                      value={notes}
                      onChange={(e) => {
                        setNotes(e.target.value);
                        requestId.current = "";
                      }}
                    />
                  </label>
                </section>
              </div>
              <aside className="card public-booking-summary">
                <h2>Booking summary</h2>
                {!ids.length ? (
                  <p>Select at least one activity.</p>
                ) : (
                  <ul>
                    {site.services
                      .filter((s) => ids.includes(s.id))
                      .map((s) => (
                        <li key={s.id}>
                          <span>
                            {s.name}
                            <small>
                              {persons} {persons === 1 ? "person" : "persons"} ×{" "}
                              {money(s.price)}
                            </small>
                          </span>
                          <b>{money(s.price * persons)}</b>
                        </li>
                      ))}
                  </ul>
                )}
                <dl>
                  <div>
                    <dt>Activities subtotal</dt>
                    <dd>{money(totals.subtotal)}</dd>
                  </div>
                  <div>
                    <dt>GST</dt>
                    <dd>{money(totals.tax)}</dd>
                  </div>
                  <div className="booking-grand">
                    <dt>Total to pay</dt>
                    <dd>{money(totals.total)}</dd>
                  </div>
                </dl>
                <div className="booking-payment-choice">
                  <Check size={18} />
                  <div>
                    <strong>Pay at reception</strong>
                    <p>
                      No payment needed online. Reception will collect your
                      payment.
                    </p>
                  </div>
                </div>
                {error && (
                  <div role="alert" className="error">
                    <p>{error}</p>
                    <button
                      type="button"
                      className="link"
                      onClick={() => {
                        requestId.current = "";
                        setReload(reload + 1);
                      }}
                    >
                      Refresh activities
                    </button>
                  </div>
                )}
                <button
                  className="btn"
                  type="submit"
                  disabled={saving || !ids.length}
                >
                  {saving ? "Booking…" : "Book · pay at reception"}
                </button>
                <small>
                  By booking, you agree to pay at reception. Your name and phone
                  are shared with the business to manage your booking.
                </small>
              </aside>
            </form>
          </>
        )}
        <footer className="public-booking-footer">
          {site?.business.name || "Adventure bookings"} · Thank you for
          visiting.
        </footer>
      </div>
    </main>
  );
}
