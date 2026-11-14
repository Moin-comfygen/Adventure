"use client";
import { useId, useState } from "react";
import { displayDate, parseDisplayDate } from "@/lib/presentation";
export function validActivityDate(value: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    parseDisplayDate(displayDate(value)) === value
  );
}
export function DateField({
  value,
  onChange,
  label = "Activity date",
  id: providedId,
}: {
  value: string;
  onChange: (date: string) => void;
  label?: string;
  id?: string;
}) {
  const generatedId = useId();
  const id = providedId || generatedId;
  const [touched, setTouched] = useState(false);
  const valid = validActivityDate(value);
  return (
    <label htmlFor={id}>
      {label}
      <input
        id={id}
        placeholder="DD/MM/YYYY"
        inputMode="numeric"
        autoComplete="off"
        value={/^\d{4}-\d{2}-\d{2}$/.test(value) ? displayDate(value) : value}
        onChange={(e) =>
          onChange(parseDisplayDate(e.target.value) ?? e.target.value)
        }
        onBlur={() => setTouched(true)}
        aria-invalid={touched && !valid}
        aria-describedby={touched && !valid ? `${id}-error` : undefined}
      />
      {touched && !valid && (
        <span id={`${id}-error`} className="field-error">
          Enter a valid date as DD/MM/YYYY.
        </span>
      )}
    </label>
  );
}
