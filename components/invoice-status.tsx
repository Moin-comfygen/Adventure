import { Invoice, money } from "@/lib/model";
import { invoiceStatus } from "@/lib/presentation";
export function InvoiceStatus({ invoice }: { invoice: Invoice }) {
  const status = invoiceStatus(invoice);
  return (
    <span className="invoice-status">
      <span className={`badge ${status.tone}`}>{status.label}</span>
      {status.due > 0 && <small>{money(status.due)} due</small>}
    </span>
  );
}
