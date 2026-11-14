"use client";
import { useId, useRef, useState } from "react";
import { ChevronDown, Clock, X } from "lucide-react";
export const timeSlots = [
  { label: "Morning", time: "09:00" },
  { label: "Afternoon", time: "13:00" },
  { label: "Evening", time: "17:00" },
];
export function TimeSlotPicker({
  value,
  onChange,
  activity,
}: {
  value: string;
  onChange: (time: string) => void;
  activity: string;
}) {
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState(false);
  const [position, setPosition] = useState({ top: 200, left: 16 });
  const selected = timeSlots.find((slot) => slot.time === value);
  const close = () => ref.current?.hidePopover();
  return (
    <div className="time-slot-control">
      <span className="booking-field-label">Time slot</span>
      <button
        className="slot-trigger"
        type="button"
        popoverTarget={id}
        aria-label={`Time slot for ${activity}: ${selected?.label || value || "Not set"}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          setPosition({
            top: Math.max(
              16,
              Math.min(rect.bottom + 8, window.innerHeight - 290),
            ),
            left: Math.max(16, Math.min(rect.left, window.innerWidth - 296)),
          });
          setCustom(!!value && !selected);
        }}
      >
        <Clock size={14} />
        <span>{selected?.label || value || "No time"}</span>
        <ChevronDown size={12} />
      </button>
      <div
        id={id}
        ref={ref}
        popover="auto"
        role="dialog"
        aria-label={`Choose time for ${activity}`}
        className="time-slot-popover"
        style={{ top: position.top, left: position.left }}
        onToggle={(e) => setOpen(e.newState === "open")}
      >
        <div className="card-heading">
          <h3>Activity time</h3>
          <button
            type="button"
            className="icon-button"
            aria-label="Close time selection"
            onClick={close}
          >
            <X size={16} />
          </button>
        </div>
        <div className="slot-chips">
          {timeSlots.map((slot) => (
            <button
              key={slot.time}
              type="button"
              aria-pressed={value === slot.time}
              onClick={() => {
                onChange(slot.time);
                close();
              }}
            >
              <b>{slot.label}</b>
              <small>{slot.time}</small>
            </button>
          ))}
        </div>
        <button className="link" type="button" onClick={() => setCustom(true)}>
          Choose a custom time
        </button>
        {custom && (
          <label>
            Custom time
            <input
              aria-label={`Custom time for ${activity}`}
              type="time"
              value={value}
              onChange={(e) => onChange(e.target.value)}
            />
          </label>
        )}
        <div className="spread">
          <button
            className="link"
            type="button"
            onClick={() => {
              onChange("");
              close();
            }}
          >
            No time slot
          </button>
          {custom && (
            <button className="btn" type="button" onClick={close}>
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
