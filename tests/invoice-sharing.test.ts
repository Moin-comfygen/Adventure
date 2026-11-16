import test from "node:test";
import assert from "node:assert/strict";
import { seed } from "../lib/model";
import {
  whatsappNumber,
  whatsappInvoiceUrl,
  invoiceShareMessage,
} from "../lib/invoice-sharing";
test("WhatsApp numbers normalize Indian mobile and country prefix; invalid numbers are rejected", () => {
  assert.equal(whatsappNumber("98765 43210"), "919876543210");
  assert.equal(whatsappNumber("+91-98765-43210"), "919876543210");
  assert.throws(() => whatsappNumber("123"), /10-digit/);
});
test("invoice messages use the business greeting and invoice attachment reference", () => {
  const s = seed(),
    i = s.invoices[0],
    message = invoiceShareMessage(i, s.business.name);
  assert(message.includes(i.id));
  assert(message.includes(`greetings from ${s.business.name}`));
  assert(message.includes("Thank you for visiting"));
  assert(message.includes("attached"));
  const url = new URL(whatsappInvoiceUrl("+91 9876543210", message));
  assert.equal(url.host, "wa.me");
  assert.equal(url.pathname, "/919876543210");
  assert.equal(url.searchParams.get("text"), message);
});
