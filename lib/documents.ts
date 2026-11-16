import { jsPDF } from "jspdf";
import { writeWorkbook } from "./workbook";
import { Invoice, State, money, paid } from "./model";
export function spreadsheet(rows: Record<string, unknown>[], name: string) {
  return writeWorkbook(rows, name);
}
export function pdf(
  title: string,
  lines: string[],
  thermal = false,
  width = 80,
) {
  const doc = new jsPDF({
    unit: "mm",
    format: thermal ? [width, Math.max(180, lines.length * 7 + 30)] : "a4",
  });
  const w = thermal ? width : 210;
  let y = 15;
  doc.setFontSize(thermal ? 12 : 20);
  doc.text(title, 8, y);
  y += 12;
  doc.setFontSize(thermal ? 8 : 10);
  for (const line of lines) {
    const parts = doc.splitTextToSize(line.replace(/₹/g, "INR "), w - 16);
    if (y + parts.length * 5 > 280 && !thermal) {
      doc.addPage();
      y = 15;
    }
    doc.text(parts, 8, y);
    y += parts.length * 5 + 2;
  }
  doc.save(`${title.replaceAll(" ", "-")}.pdf`);
}
export function invoiceLines(s: State, i: Invoice) {
  return [
    s.business.name,
    s.business.address,
    `Phone: ${s.business.phone} | GSTIN: ${s.business.gstin}`,
    `${i.id} | ${new Date(i.date).toLocaleDateString("en-IN")} | ${i.status}`,
    `Customer: ${i.customer.name} | ${i.customer.phone}`,
    ...i.lines.map(
      (l) =>
        `${l.name} | ${l.qty} x ${money(l.price)} | GST ${l.gst}% | ${l.date} ${l.slot}`,
    ),
    `Subtotal: ${money(i.subtotal)} | Discount: ${money(i.discount)}`,
    i.interstate
      ? `IGST: ${money(i.tax)}`
      : `CGST: ${money(i.tax / 2)} | SGST: ${money(i.tax / 2)}`,
    `Additional charges (non-taxable): ${money(i.charges)}`,
    `Grand total: ${money(i.total)}`,
    `Paid: ${money(paid(i))} | Balance: ${money(i.total - paid(i))}`,
    ...i.payments.map((p) => `${p.method}: ${money(p.amount)}`),
    s.templates[s.defaultTemplate].terms,
    s.templates[s.defaultTemplate].footer,
  ];
}
export async function buildInvoicePdf(
  element: HTMLElement,
  name: string,
  thermal = false,
  width = 80,
) {
  await document.fonts.ready;
  const images = Array.from(element.querySelectorAll("img"));
  await Promise.all(
    images.map((image) => {
      image.loading = "eager";
      return image.decode().catch(() => undefined);
    }),
  );
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  const { default: html2canvas } = await import("html2canvas");
  const canvas = await html2canvas(element, {
    scale: 2,
    backgroundColor: "#ffffff",
  });
  const pageWidth = thermal ? width : 210;
  const margin = thermal ? 3 : 8;
  const imageWidth = pageWidth - margin * 2;
  const fullHeight = (canvas.height * imageWidth) / canvas.width;
  const pageHeight = thermal ? fullHeight + margin * 2 : 297;
  const doc = new jsPDF({
    unit: "mm",
    format: thermal ? [pageWidth, pageHeight] : "a4",
  });
  const sliceHeight = Math.floor(
    ((pageHeight - margin * 2) * canvas.width) / imageWidth,
  );
  for (
    let offset = 0, index = 0;
    offset < canvas.height;
    offset += sliceHeight, index++
  ) {
    if (index) doc.addPage();
    const slice = document.createElement("canvas");
    slice.width = canvas.width;
    slice.height = Math.min(sliceHeight, canvas.height - offset);
    slice
      .getContext("2d")!
      .drawImage(
        canvas,
        0,
        offset,
        canvas.width,
        slice.height,
        0,
        0,
        canvas.width,
        slice.height,
      );
    doc.addImage(
      slice.toDataURL("image/jpeg", 0.9),
      "JPEG",
      margin,
      margin,
      imageWidth,
      (slice.height * imageWidth) / canvas.width,
    );
  }
  doc.setProperties({ title: name });
  return doc;
}
export async function invoicePdf(
  element: HTMLElement,
  name: string,
  thermal = false,
  width = 80,
) {
  const doc = await buildInvoicePdf(element, name, thermal, width);
  doc.save(`${name}.pdf`);
}
export async function invoicePdfFile(element: HTMLElement, name: string) {
  const doc = await buildInvoicePdf(element, name);
  return new File([doc.output("blob")], `${name}.pdf`, {
    type: "application/pdf",
  });
}
