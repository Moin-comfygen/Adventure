"use client";
import { useState } from "react";
import { Copy, MessageCircle } from "lucide-react";
import { Invoice, money, paid } from "@/lib/model";
import { Dialog } from "./ui/dialog";
export function InvoiceReminder({
  invoice,
  business,
  onClose,
  onWhatsApp,
}: {
  invoice: Invoice;
  business: string;
  onClose: () => void;
  onWhatsApp?: (message: string) => void;
}) {
  const [message, setMessage] = useState(
    `Hello ${invoice.customer.name}, a friendly reminder that ${money(invoice.total - paid(invoice))} is pending for invoice ${invoice.id} with ${business}. Please contact us to arrange payment. Thank you!`,
  );
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  return (
    <Dialog title="Payment reminder draft" onClose={onClose}>
      <p>
        Review the reminder for {invoice.customer.name}. Copy it or open your
        SMS app to send it yourself.
      </p>
      <label>
        Reminder message
        <textarea
          value={message}
          onChange={(e) => {
            setMessage(e.target.value);
            setCopied(false);
          }}
          rows={5}
        />
      </label>
      <div className="heading-actions">
        {onWhatsApp && (
          <button
            type="button"
            className="btn secondary"
            onClick={() => onWhatsApp(message)}
          >
            <MessageCircle size={16} />
            WhatsApp with invoice PDF
          </button>
        )}
        <button
          className="btn secondary"
          onClick={() =>
            navigator.clipboard
              .writeText(message)
              .then(() => setCopied(true))
              .catch(() =>
                setError("Select the message above and copy it manually."),
              )
          }
        >
          <Copy size={16} />
          {copied ? "Copied" : "Copy message"}
        </button>
        <a
          className="btn"
          href={`sms:${invoice.customer.phone.replace(/[^+\d]/g, "")}?body=${encodeURIComponent(message)}`}
        >
          <MessageCircle size={16} /> Open SMS app
        </a>
      </div>
      <p role="status" className="muted">
        {error || "No reminder has been sent automatically."}
      </p>
    </Dialog>
  );
}
