"use client";
import { Check, ChevronDown, Users } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";
import { mobileDigits, type CustomerFields } from "@/lib/billing-ui";
import { PersonStepper } from "./person-stepper";
export function CustomerDetails({
  form,
  persons,
  onPersons,
  returning,
  moreOpen,
  onMoreOpen,
}: {
  form: UseFormReturn<CustomerFields>;
  persons: number;
  onPersons: (value: number) => void;
  returning: boolean;
  moreOpen: boolean;
  onMoreOpen: (value: boolean) => void;
}) {
  const { errors, touchedFields } = form.formState;
  const error = (name: keyof CustomerFields) =>
    touchedFields[name] && errors[name]?.message ? (
      <span id={`customer-${name}-error`} className="field-error">
        {errors[name]?.message}
      </span>
    ) : null;
  return (
    <section className="card pos-customer">
      <div className="card-heading">
        <div>
          <h3>01 · Customer details</h3>
          <p>Start with a mobile number. We’ll find returning customers.</p>
        </div>
        {returning && (
          <span className="returning-chip">
            <Check size={14} /> Returning customer
          </span>
        )}
      </div>
      <div className="pos-customer-grid">
        <label htmlFor="customer-phone">
          Mobile number <span className="sr-only">required</span>
          <span className="phone-input">
            <span aria-hidden="true">+91</span>
            <input
              id="customer-phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              maxLength={10}
              onPaste={(event) => {
                const digits = mobileDigits(
                  event.clipboardData.getData("text"),
                );
                if (digits.length === 10) {
                  event.preventDefault();
                  form.setValue("phone", digits, {
                    shouldDirty: true,
                    shouldValidate: !!touchedFields.phone,
                  });
                }
              }}
              placeholder="10-digit mobile"
              {...form.register("phone", {
                onChange: (e) => {
                  const value = String(e.target.value);
                  form.setValue(
                    "phone",
                    value
                      .replace(/\D/g, "")
                      .replace(/^91(?=\d{10}$)/, "")
                      .slice(0, 10),
                    {
                      shouldValidate: !!touchedFields.phone,
                      shouldDirty: true,
                    },
                  );
                },
              })}
              aria-invalid={!!(touchedFields.phone && errors.phone)}
              aria-describedby={
                touchedFields.phone && errors.phone
                  ? "customer-phone-error"
                  : undefined
              }
            />
          </span>
          {error("phone")}
        </label>
        <label htmlFor="customer-name">
          Customer name <span className="sr-only">required</span>
          <input
            id="customer-name"
            placeholder="Full name"
            autoComplete="name"
            {...form.register("name")}
            aria-invalid={!!(touchedFields.name && errors.name)}
            aria-describedby={
              touchedFields.name && errors.name
                ? "customer-name-error"
                : undefined
            }
          />
          {error("name")}
        </label>
        <PersonStepper value={persons} onChange={onPersons} />
      </div>
      <p className="persons-hint">
        <Users size={14} /> Persons applies to newly added activities. You can
        change each booking row.
      </p>
      <details
        className="pos-more-details"
        open={moreOpen}
        onToggle={(e) => onMoreOpen(e.currentTarget.open)}
      >
        <summary>
          More details (optional) <ChevronDown size={16} />
        </summary>
        <div className="form-grid">
          <label>
            Email
            <input
              type="email"
              autoComplete="email"
              {...form.register("email")}
            />
            {error("email")}
          </label>
          <label>
            Customer GSTIN
            <input
              placeholder="For B2B tax invoices"
              maxLength={15}
              {...form.register("gstin", {
                setValueAs: (value: string) => value.trim().toUpperCase(),
              })}
            />
            {error("gstin")}
          </label>
          <label>
            Customer notes
            <textarea rows={2} {...form.register("notes")} />
          </label>
          <label>
            Billing address
            <textarea
              rows={2}
              autoComplete="street-address"
              {...form.register("address")}
            />
          </label>
        </div>
      </details>
    </section>
  );
}
