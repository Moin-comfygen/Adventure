"use client";
import { useId, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import { displayDate, parseDisplayDate, indianDate } from "@/lib/presentation";
export function DateRangePicker({
  from,
  to,
  onChange,
}: {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
}) {
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [error, setError] = useState("");
  const [month, setMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );
  const startIso = parseDisplayDate(start) || "",
    endIso = parseDisplayDate(end) || "";
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const prefix = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
  function selectDay(day: number) {
    const iso = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    if (!startIso || endIso || iso < startIso) {
      setStart(displayDate(iso));
      setEnd("");
    } else setEnd(displayDate(iso));
  }
  function close() {
    ref.current?.hidePopover();
  }
  return (
    <div className="date-range-control">
      <button
        className={`range-trigger ${from || to ? "is-custom" : ""}`}
        popoverTarget={id}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          setStart(displayDate(from));
          setEnd(displayDate(to));
          setError("");
          if (from) setMonth(new Date(from.slice(0, 7) + "-01T12:00:00"));
        }}
      >
        <CalendarDays size={16} />
        {from && to
          ? `${displayDate(from)} – ${displayDate(to)}`
          : "Custom range"}
      </button>
      <div
        ref={ref}
        id={id}
        popover="auto"
        role="dialog"
        aria-label="Choose date range"
        className="range-popover"
        onToggle={(e) => setOpen(e.newState === "open")}
      >
        <div className="card-heading">
          <h3>Custom date range</h3>
          <button
            className="icon-button"
            aria-label="Close date range"
            onClick={close}
          >
            <X size={18} />
          </button>
        </div>
        <p>Select a start date, then an end date.</p>
        <div className="calendar-month">
          <button
            aria-label="Previous month"
            onClick={() =>
              setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))
            }
          >
            <ChevronLeft size={18} />
          </button>
          <b aria-live="polite">
            {month.toLocaleDateString("en-IN", {
              month: "long",
              year: "numeric",
            })}
          </b>
          <button
            aria-label="Next month"
            onClick={() =>
              setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))
            }
          >
            <ChevronRight size={18} />
          </button>
        </div>
        <div className="range-calendar">
          {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
            <span key={day}>{day}</span>
          ))}
          {Array.from({ length: prefix }, (_, i) => (
            <span key={`empty${i}`} />
          ))}
          {Array.from({ length: days }, (_, i) => {
            const iso = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`;
            return (
              <button
                key={iso}
                aria-label={indianDate(iso)}
                aria-pressed={iso === startIso || iso === endIso}
                className={`${iso === startIso || iso === endIso ? "chosen" : ""} ${startIso && endIso && iso > startIso && iso < endIso ? "between" : ""}`}
                onClick={() => selectDay(i + 1)}
              >
                {i + 1}
              </button>
            );
          })}
        </div>
        <div className="form-grid">
          <label>
            From (DD/MM/YYYY)
            <input
              placeholder="DD/MM/YYYY"
              inputMode="numeric"
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </label>
          <label>
            To (DD/MM/YYYY)
            <input
              placeholder="DD/MM/YYYY"
              inputMode="numeric"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </label>
        </div>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <div className="spread">
          <button
            className="link"
            onClick={() => {
              onChange("", "");
              close();
            }}
          >
            Clear range
          </button>
          <button
            className="btn"
            onClick={() => {
              if (!startIso || !endIso || startIso > endIso) {
                setError(
                  "Enter a valid start and end date in DD/MM/YYYY order.",
                );
                return;
              }
              onChange(startIso, endIso);
              close();
            }}
          >
            Apply range
          </button>
        </div>
      </div>
    </div>
  );
}
