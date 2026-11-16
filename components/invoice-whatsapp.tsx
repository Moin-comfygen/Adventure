"use client";
import { useEffect, useState } from "react";
import { Download, MessageCircle, X } from "lucide-react";
import { Invoice } from "@/lib/model";
import { invoicePdfFile } from "@/lib/documents";
import {
  downloadInvoiceFile,
  invoiceShareMessage,
  whatsappInvoiceUrl,
} from "@/lib/invoice-sharing";
export function InvoiceWhatsApp({
  invoice,
  business,
  message: customMessage,
  onClose,
}: {
  invoice: Invoice;
  business: string;
  message?: string;
  onClose: () => void;
}) {
  const [file, setFile] = useState<File | null>(null),
    [error, setError] = useState(""),
    [status, setStatus] = useState(""),
    [retry, setRetry] = useState(0);
  const message = customMessage || invoiceShareMessage(invoice, business);
  let url = "";
  try {
    url = whatsappInvoiceUrl(invoice.customer.phone, message);
  } catch {
    /* Native file sharing still allows choosing a recipient. */
  }
  useEffect(() => {
    let cancelled = false;
    setFile(null);
    setError("");
    setStatus("");
    const element = document.getElementById("print-invoice");
    if (!element) {
      setError("Invoice preview is not ready. Please try again.");
      return;
    }
    invoicePdfFile(element, invoice.id)
      .then((file) => {
        if (!cancelled) setFile(file);
      })
      .catch(() => {
        if (!cancelled)
          setError("Could not prepare the invoice PDF. Please try again.");
      });
    return () => {
      cancelled = true;
    };
  }, [invoice, business, retry]);
  function download() {
    if (!file) return;
    downloadInvoiceFile(file);
    setStatus(
      `Downloaded ${file.name}. Attach this file in WhatsApp before sending.`,
    );
  }
  return (
    <section
      className="invoice-whatsapp"
      aria-label="Share invoice PDF on WhatsApp"
    >
      <div className="card-heading">
        <h3>
          <MessageCircle size={18} /> Share invoice PDF
        </h3>
        <button
          type="button"
          className="icon-button"
          aria-label="Close WhatsApp sharing"
          onClick={onClose}
        >
          <X size={18} />
        </button>
      </div>
      {!file && !error && <p role="status">Preparing {invoice.id}.pdf…</p>}
      {file && (
        <>
          <p className="invoice-share-filename">
            {file.name} · {Math.max(1, Math.ceil(file.size / 1024))} KB
          </p>
          <p>
            WhatsApp opens directly for{" "}
            <strong>
              {invoice.customer.name} · {invoice.customer.phone}
            </strong>
            , using the billing number. Attach the downloaded PDF using Attach →
            Document before sending.
          </p>
          <div className="heading-actions">
            {url ? (
              <a
                className="btn"
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={download}
              >
                <MessageCircle size={16} />
                Download PDF & open WhatsApp
              </a>
            ) : (
              <p className="error">
                The customer needs a valid 10-digit mobile number to open a
                WhatsApp chat.
              </p>
            )}
            <button type="button" className="btn secondary" onClick={download}>
              <Download size={16} />
              Download PDF
            </button>
          </div>
        </>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
          {!file && (
            <button
              type="button"
              className="link"
              onClick={() => setRetry(retry + 1)}
            >
              {" "}
              Retry PDF
            </button>
          )}
        </p>
      )}
      {status && <p role="status">{status}</p>}
    </section>
  );
}
