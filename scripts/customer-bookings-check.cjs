const { chromium } = require("playwright");
const AxeBuilder = require("@axe-core/playwright").default;
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const base = process.env.BASE_URL || "http://localhost:3014";
const adminCode =
  process.env.BOOKING_TEST_ADMIN_CODE || "local-test-admin-booking-code-2026";
const receptionCode =
  process.env.BOOKING_TEST_RECEPTION_CODE ||
  "local-test-reception-booking-code-2026";
(async () => {
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  const errors = [];
  async function staff(role, code) {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    });
    const page = await context.newPage();
    page.setDefaultTimeout(20000);
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(base);
    await page.getByRole("button", { name: "Enter workspace" }).click();
    if (role === "Receptionist") {
      await page.getByLabel("Switch demo role").selectOption(role);
      await page
        .getByRole("heading", { name: "Billing POS", exact: true })
        .waitFor();
    }
    await page
      .locator("nav")
      .getByRole("button", { name: "Customer Bookings", exact: true })
      .click();
    await page.getByLabel("Booking staff access code").fill(code);
    await page
      .getByRole("button", { name: "Open booking queue", exact: true })
      .click();
    await page.getByRole("button", { name: "Lock booking queue" }).waitFor();
    return { context, page };
  }
  const admin = await staff("Super Admin", adminCode);
  const publish = admin.page.getByRole("button", {
    name: /Publish booking link|Update booking page from current settings/,
  });
  await publish.click();
  await admin.page.getByRole("button", { name: "Copy booking link" }).waitFor();
  const link = await admin.page
    .getByLabel("Share this link with customers")
    .inputValue();
  assert(link.startsWith(base + "/book/"));
  const publicContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const customer = await publicContext.newPage();
  customer.on("pageerror", (e) => errors.push(e.message));
  await customer.goto(link);
  await customer.getByRole("heading", { name: /Book with/ }).waitFor();
  const publicSite = await (
    await publicContext.request.get(
      base +
        "/api/customer-booking/" +
        new URL(link).pathname.split("/").at(-1),
    )
  ).json();
  assert.equal(publicSite.site.template, undefined);
  assert.equal(
    (
      await publicContext.request.get(base + "/api/booking-staff/requests")
    ).status(),
    401,
  );
  const name = "Booking Guest " + Date.now();
  await customer.getByLabel("Your name", { exact: true }).fill(name);
  await customer.getByLabel("WhatsApp / mobile number").fill("+91 91234 56789");
  await customer.getByLabel("Number of persons").fill("2");
  await customer
    .getByRole("checkbox", { name: /River Rafting · 16 km/ })
    .check();
  const responsive = [];
  for (const width of [1440, 1024, 768, 390]) {
    await customer.setViewportSize({ width, height: 900 });
    const overflow = await customer.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    );
    const a = await new AxeBuilder({ page: customer })
      .include(".public-booking")
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    responsive.push({
      width,
      overflow,
      violations: a.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => n.html),
      })),
    });
    await customer.screenshot({
      path: `/tmp/customer-booking-${width}.png`,
      fullPage: true,
    });
  }
  console.log("PUBLIC_RESPONSIVE", JSON.stringify(responsive));
  assert(responsive.every((r) => !r.overflow && !r.violations.length));
  await customer
    .getByRole("button", { name: "Book · pay at reception", exact: true })
    .click();
  await customer
    .getByRole("heading", { name: "Your booking is received" })
    .waitFor();
  const reference = await customer.locator(".booking-reference").innerText();
  assert.match(reference, /^BKG-/);
  await admin.page
    .getByRole("button", { name: "Refresh", exact: true })
    .click();
  await admin.page.getByRole("heading", { name, exact: true }).waitFor();
  assert(
    (await admin.page
      .getByText("Booked by customer", { exact: true })
      .count()) > 0,
  );
  const reception = await staff("Receptionist", receptionCode);
  await reception.page.getByRole("heading", { name, exact: true }).waitFor();
  const row = reception.page
    .locator(".booking-queue-item")
    .filter({
      has: reception.page.getByRole("heading", { name, exact: true }),
    });
  await row
    .getByRole("button", { name: "Collect payment", exact: true })
    .click();
  await reception.page.getByLabel("Amount to collect (₹)").fill("1000");
  const paymentRequest = reception.page.waitForRequest(
    (r) => r.method() === "POST" && r.url().endsWith("/collect"),
  );
  await reception.page
    .getByRole("dialog")
    .getByRole("button", { name: "Collect payment", exact: true })
    .click();
  const originalRequest = await paymentRequest;
  await reception.page.getByRole("dialog").waitFor({ state: "detached" });
  let list = await (
    await reception.context.request.get(base + "/api/booking-staff/requests")
  ).json();
  let booking = list.bookings.find((b) => b.reference === reference);
  assert.equal(booking.collected, 1000);
  assert.equal(booking.balance, 2150);
  assert.equal(booking.invoice.payments.length, 1);
  assert.equal(booking.invoice.customerBookingVersion, 1);
  const originalReceipt = booking.invoice.id;
  const duplicate = await reception.context.request.post(
    originalRequest.url(),
    { data: originalRequest.postDataJSON() },
  );
  assert.equal(duplicate.status(), 200);
  assert.equal((await duplicate.json()).booking.collected, 1000);
  const tooMuch = await reception.context.request.post(originalRequest.url(), {
    data: { requestId: randomUUID(), amount: 2151, method: "Cash" },
  });
  assert.equal(tooMuch.status(), 400);
  assert.equal(
    (
      await reception.context.request.post(base + "/api/booking-staff/site", {
        data: { business: { name: "Forbidden" } },
      })
    ).status(),
    403,
  );
  const csrf = await reception.context.request.post(originalRequest.url(), {
    headers: { Origin: "https://untrusted.example" },
    data: { requestId: randomUUID(), amount: 1, method: "Cash" },
  });
  assert.equal(csrf.status(), 403);
  await admin.page
    .getByRole("button", { name: "Refresh", exact: true })
    .click();
  await admin.page
    .locator(".booking-queue-item")
    .filter({ has: admin.page.getByRole("heading", { name, exact: true }) })
    .getByText("Partial · Pay at reception")
    .waitFor();
  const results = await Promise.all([
    admin.context.request.post(originalRequest.url(), {
      data: { requestId: randomUUID(), amount: 2150, method: "UPI" },
    }),
    reception.context.request.post(originalRequest.url(), {
      data: { requestId: randomUUID(), amount: 2150, method: "UPI" },
    }),
  ]);
  assert.deepEqual(results.map((r) => r.status()).sort(), [200, 400]);
  list = await (
    await reception.context.request.get(base + "/api/booking-staff/requests")
  ).json();
  booking = list.bookings.find((b) => b.reference === reference);
  assert.equal(booking.collected, 3150);
  assert.equal(booking.balance, 0);
  assert.equal(booking.invoice.id, originalReceipt);
  assert.equal(booking.invoice.payments.length, 2);
  assert.equal(booking.invoice.customerBookingVersion, 2);
  await admin.page
    .getByRole("button", { name: "Refresh", exact: true })
    .click();
  await admin.page
    .locator(".booking-queue-item")
    .filter({ has: admin.page.getByRole("heading", { name, exact: true }) })
    .getByText("Paid · Pay at reception")
    .waitFor();
  await admin.page
    .locator("nav")
    .getByRole("button", { name: "Sales Management", exact: true })
    .click();
  await admin.page
    .getByRole("button", { name: "Clear all", exact: true })
    .click();
  await admin.page
    .getByRole("searchbox", { name: "Search invoices" })
    .fill(originalReceipt);
  await admin.page
    .getByRole("button", { name: `View ${originalReceipt}`, exact: true })
    .click();
  await admin.page.getByText("Paid in full", { exact: true }).waitFor();
  assert.equal(
    await admin.page
      .getByRole("button", { name: "Record payment", exact: true })
      .count(),
    0,
  );
  await admin.page.getByRole("button", { name: "Close", exact: true }).click();
  await reception.page
    .getByRole("button", { name: "Refresh", exact: true })
    .click();
  await reception.page
    .locator(".booking-queue-item")
    .filter({ has: reception.page.getByRole("heading", { name, exact: true }) })
    .getByText("Paid · Pay at reception")
    .waitFor();
  await reception.page.setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await reception.page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  const axe = await new AxeBuilder({ page: reception.page })
    .include(".booking-manager")
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  assert.deepEqual(
    axe.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.html),
    })),
    [],
  );
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      passed: true,
      separateCustomerAdminReception: true,
      serverSidePrices: true,
      payAtReception: true,
      duplicatePaymentSafe: true,
      concurrentPaymentSafe: true,
      receiptSyncedToSales: true,
      staffPrivacy: true,
      receptionCannotPublish: true,
      csrf: true,
      responsive: [1440, 1024, 768, 390],
      reference,
    }),
  );
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
