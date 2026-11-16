"use client";
import { useEffect, useRef, useState } from "react";
import { Download, MessageCircle, X } from "lucide-react";
import { Invoice } from "@/lib/model";
import { invoicePdfFile } from "@/lib/documents";
import {
  canShareInvoiceFile,
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
    [sharing, setSharing] = useState(false),
    [fallback, setFallback] = useState(false),
    [retry, setRetry] = useState(0);
  const sharingRef = useRef(false);
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
    setFallback(false);
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
  const native = file && !fallback && canShareInvoiceFile(file);
  async function share() {
    if (!file || sharingRef.current) return;
    sharingRef.current = true;
    setSharing(true);
    setError("");
    setStatus("");
    try {
      await navigator.share({
        files: [file],
        title: `Invoice ${invoice.id}`,
        text: message,
      });
      setStatus("Share sheet completed. Check WhatsApp to confirm delivery.");
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError")
        setStatus("Sharing cancelled. You can try again.");
      else {
        setFallback(true);
        setError(
          "File sharing was unavailable. Download the PDF and attach it in WhatsApp instead.",
        );
      }
    } finally {
      sharingRef.current = false;
      setSharing(false);
    }
  }
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
            {native
              ? `Choose WhatsApp in the share sheet, then select ${invoice.customer.name} (${invoice.customer.phone}).`
              : "WhatsApp Web cannot attach a PDF automatically. Download the invoice, then attach it using the paperclip → Document in the customer’s chat."}
          </p>
          <div className="heading-actions">
            {native ? (
              <button
                type="button"
                className="btn"
                disabled={sharing}
                onClick={share}
              >
                <MessageCircle size={16} />
                {sharing ? "Sharing…" : "Share PDF"}
              </button>
            ) : url ? (
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
            <button
              type="button"
              className="btn secondary"
              onClick={download}
              disabled={sharing}
            >
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
