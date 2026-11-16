const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
(async () => {
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  async function setup(mode) {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      acceptDownloads: true,
    });
    await context.addInitScript((mode) => {
      window.__shares = [];
      Object.defineProperty(navigator, "canShare", {
        configurable: true,
        value: () => mode !== "desktop",
      });
      Object.defineProperty(navigator, "share", {
        configurable: true,
        value: async (data) => {
          if (mode === "cancel")
            throw new DOMException("Cancelled", "AbortError");
          if (mode === "denied")
            throw new DOMException("Denied", "NotAllowedError");
          const file = data.files[0];
          window.__shares.push({
            name: file.name,
            type: file.type,
            size: file.size,
            header: (await file.text()).slice(0, 5),
            text: data.text,
            active: navigator.userActivation.isActive,
          });
        },
      });
    }, mode);
    await context.route("https://wa.me/**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "text/html",
        body: "WhatsApp test destination",
      }),
    );
    const page = await context.newPage();
    page.setDefaultTimeout(20000);
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(process.env.BASE_URL || "http://localhost:3011");
    await page.getByRole("button", { name: "Enter workspace" }).click();
    return { context, page, errors };
  }
  async function openInvoice(page) {
    await page
      .locator("nav")
      .getByRole("button", { name: "Sales Management", exact: true })
      .click();
    await page.getByRole("button", { name: "Clear all", exact: true }).click();
    await page
      .getByRole("button", { name: /^View ADV-/ })
      .first()
      .click();
    await page
      .getByRole("button", { name: "WhatsApp PDF", exact: true })
      .click();
    return page.getByRole("region", { name: "Share invoice PDF on WhatsApp" });
  }
  // Desktop: the customer chat opens AND a real invoice PDF is downloaded.
  let { context, page, errors } = await setup("desktop");
  let panel = await openInvoice(page);
  const fallback = panel.getByRole("link", {
    name: "Download PDF & open WhatsApp",
  });
  await fallback.waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "Thermal 80mm", exact: true })
      .isDisabled(),
    true,
  );
  let [download, popup] = await Promise.all([
    page.waitForEvent("download"),
    context.waitForEvent("page"),
    fallback.click(),
  ]);
  await download.saveAs("/tmp/whatsapp-invoice.pdf");
  const bytes = fs.readFileSync("/tmp/whatsapp-invoice.pdf");
  assert.equal(bytes.subarray(0, 5).toString(), "%PDF-");
  assert(bytes.length > 1000);
  assert.match(download.suggestedFilename(), /^ADV-\d+\.pdf$/);
  await popup.waitForLoadState();
  const url = new URL(popup.url());
  assert.equal(url.host, "wa.me");
  assert.match(url.pathname, /^\/91\d{10}$/);
  assert.match(url.searchParams.get("text"), /attached as a PDF/);
  await popup.close();
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
  }
  assert.deepEqual(errors, []);
  await context.close();
  // Native: a file (not a URL or text-only message) is passed directly under a user gesture.
  ({ context, page, errors } = await setup("native"));
  panel = await openInvoice(page);
  await panel.getByRole("button", { name: "Share PDF", exact: true }).click();
  await panel.getByText(/Share sheet completed/).waitFor();
  const shares = await page.evaluate(() => window.__shares);
  assert.equal(shares.length, 1);
  assert.equal(shares[0].type, "application/pdf");
  assert.equal(shares[0].header, "%PDF-");
  assert(shares[0].size > 1000);
  assert.equal(shares[0].active, true);
  assert.deepEqual(errors, []);
  await context.close();
  // Cancellation remains retryable; blocked native sharing offers desktop fallback.
  for (const mode of ["cancel", "denied"]) {
    ({ context, page, errors } = await setup(mode));
    panel = await openInvoice(page);
    await panel.getByRole("button", { name: "Share PDF", exact: true }).click();
    if (mode === "cancel") {
      await panel.getByText(/Sharing cancelled/).waitFor();
      assert.equal(
        await panel
          .getByRole("button", { name: "Share PDF", exact: true })
          .isEnabled(),
        true,
      );
    } else {
      await panel
        .getByRole("link", { name: "Download PDF & open WhatsApp" })
        .waitFor();
      await panel.getByRole("alert").waitFor();
    }
    assert.deepEqual(errors, []);
    await context.close();
  }
  // The success-toast WhatsApp action routes through PDF sharing for the invoice just saved.
  ({ context, page, errors } = await setup("desktop"));
  await page
    .locator("nav")
    .getByRole("button", { name: "Billing POS", exact: true })
    .click();
  await page.getByRole("textbox", { name: /Mobile number/ }).fill("9123456789");
  await page
    .getByRole("textbox", { name: /Customer name/ })
    .fill("PDF Share Guest");
  await page.getByRole("button", { name: /^River Rafting · 16 km,/ }).click();
  await page
    .getByRole("button", { name: /^Save bill/ })
    .first()
    .click();
  await page
    .locator(".pos-success-toast")
    .getByRole("button", { name: "WhatsApp", exact: true })
    .click();
  await page
    .getByRole("region", { name: "Share invoice PDF on WhatsApp" })
    .getByRole("link", { name: "Download PDF & open WhatsApp" })
    .waitFor();
  assert.match(
    await page.getByRole("heading", { name: /^Invoice ADV-/ }).innerText(),
    /ADV-00076/,
  );
  await page.getByRole("button", { name: "Close", exact: true }).click();
  assert.equal(
    await page
      .getByRole("region", { name: "Share invoice PDF on WhatsApp" })
      .count(),
    0,
  );
  assert.deepEqual(errors, []);
  await context.close();
  // Reminders carry their edited message into the same PDF flow.
  ({ context, page, errors } = await setup("desktop"));
  await page
    .locator("nav")
    .getByRole("button", { name: "Sales Management", exact: true })
    .click();
  await page.getByRole("button", { name: "Clear all", exact: true }).click();
  await page
    .getByRole("button", { name: /^Send reminder for ADV-/ })
    .first()
    .click();
  await page
    .getByLabel("Reminder message")
    .fill("Your updated reminder with invoice attached.");
  await page.getByRole("button", { name: "WhatsApp with invoice PDF" }).click();
  panel = page.getByRole("region", { name: "Share invoice PDF on WhatsApp" });
  assert.equal(
    new URL(
      await panel
        .getByRole("link", { name: "Download PDF & open WhatsApp" })
        .getAttribute("href"),
    ).searchParams.get("text"),
    "Your updated reminder with invoice attached.",
  );
  assert.deepEqual(errors, []);
  await context.close();
  console.log(
    JSON.stringify({
      passed: true,
      desktopPdfDownload: true,
      customerChat: true,
      nativePdfFile: true,
      userGesture: true,
      cancelRetry: true,
      nativeDeniedFallback: true,
      savedBillAction: true,
      editedReminder: true,
      viewports: [1440, 390],
    }),
  );
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
