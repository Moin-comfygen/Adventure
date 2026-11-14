"use client";
import { Check, Printer } from "lucide-react";
import { money } from "@/lib/model";
export function SaveActions({
  total,
  reason,
  saving,
  onSave,
  modifier = "Ctrl",
  canPrint = true,
}: {
  total: number;
  reason: string;
  saving: boolean;
  onSave: (print: boolean) => void;
  modifier?: string;
  canPrint?: boolean;
}) {
  const saveReason = saving ? "Saving invoice…" : reason;
  const printReason =
    saveReason || (!canPrint ? "Your role cannot print invoices." : "");
  const buttons = (mobile = false) => (
    <>
      <span
        className="save-button-wrap"
        title={
          printReason || "Save this bill and open the invoice print preview"
        }
      >
        <button
          type="button"
          className="btn pos-save-print"
          disabled={!!printReason}
          onClick={() => onSave(true)}
          aria-describedby={
            mobile ? "pos-mobile-save-reason" : "pos-save-reason"
          }
        >
          <Printer size={16} />
          {saving ? "Saving…" : "Save & print"}
          <kbd>{modifier}+P</kbd>
        </button>
      </span>
      <span
        className="save-button-wrap"
        title={saveReason || "Save this bill without printing"}
      >
        <button
          type="button"
          className="btn secondary pos-save-only"
          disabled={!!saveReason}
          onClick={() => onSave(false)}
          aria-describedby={
            mobile ? "pos-mobile-save-reason" : "pos-save-reason"
          }
        >
          <Check size={16} />
          Save bill<kbd>{modifier}+S</kbd>
        </button>
      </span>
    </>
  );
  return (
    <>
      <div className="pos-save-actions">
        {buttons()}
        <p id="pos-save-reason" className="pos-save-reason">
          {saveReason ||
            "Ready to save. Customer and booking details are valid."}
        </p>
      </div>
      <div className="pos-mobile-bar">
        <div className="mobile-bill-total">
          <span>Grand total</span>
          <strong>{money(total)}</strong>
        </div>
        <div className="mobile-save-buttons">{buttons(true)}</div>
        <p id="pos-mobile-save-reason">{saveReason || "Ready to save"}</p>
      </div>
    </>
  );
}
