"use client";
import { Trash2, LockKeyhole, Ticket } from "lucide-react";
import { Line, Service, money } from "@/lib/model";
import { pluralize } from "@/lib/presentation";
import { DateField, validActivityDate } from "./date-field";
import { TimeSlotPicker } from "./time-slot-picker";
import { PersonStepper } from "./person-stepper";
import { ServiceThumbnail } from "@/components/services/service-thumbnail";
export function BookingRows({
  lines,
  onLines,
  canEditPrices,
  onNotify,
  services,
  showImages = true,
}: {
  lines: Line[];
  services: Service[];
  showImages?: boolean;
  onLines: (lines: Line[]) => void;
  canEditPrices: boolean;
  onNotify: (message: string) => void;
}) {
  function change(index: number, patch: Partial<Line>) {
    if (patch.price !== undefined && !canEditPrices) return;
    onLines(
      lines.map((line, i) => (i === index ? { ...line, ...patch } : line)),
    );
  }
  return (
    <section className="card pos-bookings">
      <div className="card-heading">
        <div>
          <h3>03 · Booking details</h3>
          <p>Confirm participants, schedule and activity prices.</p>
        </div>
        <span className="subtle-tag">
          {pluralize(lines.length, "activity", "activities")} ·{" "}
          {pluralize(
            lines.reduce((n, l) => n + l.qty, 0),
            "participant",
          )}
        </span>
      </div>
      {!lines.length ? (
        <div className="booking-empty">
          <Ticket size={28} />
          <b>No activities added yet</b>
          <p>Choose an adventure above to start this booking.</p>
        </div>
      ) : (
        <div className="booking-rows">
          {lines.map((line, index) => (
            <div
              className="compact-booking-row"
              key={`${line.serviceId}-${index}`}
            >
              <div className="booking-activity">
                <span className="booking-field-label">Activity</span>
                <div className="booking-service-name">
                  {showImages && (
                    <ServiceThumbnail
                      service={
                        services.find(
                          (service) => service.id === line.serviceId,
                        ) || { name: line.name, category: "" }
                      }
                      size={36}
                    />
                  )}
                  <div>
                    <b>{line.name}</b>
                    <small>{line.gst}% GST</small>
                  </div>
                </div>
              </div>
              <PersonStepper
                value={line.qty}
                onChange={(qty) => change(index, { qty })}
                label="Persons"
                ariaLabel={`Persons for ${line.name}`}
              />
              <div className="booking-date">
                <DateField
                  label="Date"
                  value={line.date}
                  onChange={(date) => change(index, { date })}
                />
                {lines.length > 1 && (
                  <button
                    className="apply-all"
                    type="button"
                    title="Apply date to all activities"
                    aria-label={`Apply date to all from ${line.name}`}
                    onClick={() => {
                      if (!validActivityDate(line.date))
                        return onNotify(
                          "Enter a valid date before applying it to all activities.",
                        );
                      onLines(lines.map((l) => ({ ...l, date: line.date })));
                    }}
                  >
                    Apply date to all
                  </button>
                )}
              </div>
              <div className="booking-time">
                <TimeSlotPicker
                  value={line.slot}
                  onChange={(slot) => change(index, { slot })}
                  activity={line.name}
                />
                {lines.length > 1 && (
                  <button
                    className="apply-all"
                    type="button"
                    title="Apply time to all activities"
                    aria-label={`Apply time to all from ${line.name}`}
                    onClick={() =>
                      onLines(lines.map((l) => ({ ...l, slot: line.slot })))
                    }
                  >
                    Apply time to all
                  </button>
                )}
              </div>
              <label className="booking-unit">
                Unit price
                {canEditPrices ? (
                  <input
                    aria-label={`Unit price for ${line.name}`}
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    value={line.price}
                    onChange={(e) =>
                      change(index, { price: Number(e.target.value) })
                    }
                  />
                ) : (
                  <span
                    className="readonly-price"
                    aria-label={`Unit price for ${line.name}, read only`}
                  >
                    {money(line.price)}
                    <LockKeyhole size={12} />
                  </span>
                )}
              </label>
              <div className="booking-total">
                <span className="booking-field-label">Line total</span>
                <output
                  aria-label={`${line.name} line total before discount and GST`}
                >
                  {money(line.qty * line.price)}
                </output>
                <small>Before discount & GST</small>
              </div>
              <button
                type="button"
                className="remove-activity icon-button"
                aria-label={`Remove ${line.name}`}
                title="Remove activity"
                onClick={() => onLines(lines.filter((_, i) => i !== index))}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
