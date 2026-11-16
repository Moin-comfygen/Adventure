import { Invoice } from "./model";
export function whatsappNumber(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return "91" + digits;
  if (digits.length === 12 && digits.startsWith("91")) return digits;
  throw Error(
    "A valid 10-digit Indian mobile number is needed to open WhatsApp.",
  );
}
export function invoiceShareMessage(invoice: Invoice, business: string) {
  return `Hello ${invoice.customer.name}, greetings from ${business}!\nThank you for visiting us.\nPlease find your invoice ${invoice.id} attached.`;
}
export function whatsappInvoiceUrl(phone: string, message: string) {
  return `https://wa.me/${whatsappNumber(phone)}?text=${encodeURIComponent(message)}`;
}
export function canShareInvoiceFile(file: File) {
  try {
    return (
      typeof navigator.share === "function" &&
      typeof navigator.canShare === "function" &&
      navigator.canShare({ files: [file] })
    );
  } catch {
    return false;
  }
}
export function downloadInvoiceFile(file: File) {
  const url = URL.createObjectURL(file),
    a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
