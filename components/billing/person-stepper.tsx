"use client";
import { Minus, Plus } from "lucide-react";
import { useId } from "react";
export function PersonStepper({
  value,
  onChange,
  label = "Number of persons",
  ariaLabel = label,
}: {
  value: number;
  onChange: (value: number) => void;
  label?: string;
  ariaLabel?: string;
}) {
  const id = useId();
  return (
    <div className="person-stepper-field">
      <label htmlFor={id}>{label}</label>
      <div className="person-stepper">
        <button
          type="button"
          aria-label={`Decrease ${ariaLabel.toLowerCase()}`}
          disabled={value <= 1}
          onClick={() => onChange(Math.max(1, value - 1))}
        >
          <Minus size={16} />
        </button>
        <input
          id={id}
          aria-label={ariaLabel}
          type="number"
          inputMode="numeric"
          min={1}
          step={1}
          value={value}
          onChange={(e) =>
            onChange(Math.max(1, Math.floor(Number(e.target.value) || 1)))
          }
        />
        <button
          type="button"
          aria-label={`Increase ${ariaLabel.toLowerCase()}`}
          onClick={() => onChange(value + 1)}
        >
          <Plus size={16} />
        </button>
      </div>
    </div>
  );
}
