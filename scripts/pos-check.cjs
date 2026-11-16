const { chromium } = require("playwright");
const AxeBuilder = require("@axe-core/playwright").default;
const assert = require("node:assert/strict");
const fs = require("node:fs");
(async () => {
  fs.mkdirSync("/tmp/adventure-pos-review", { recursive: true });
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(process.env.BASE_URL || "http://127.0.0.1:3000");
  await page.getByRole("button", { name: "Enter workspace" }).click();
  await page.keyboard.press("Control+k");
  await page
    .getByRole("combobox", {
      name: "Search invoices, customers, agents and pages",
    })
    .fill("Billing POS");
  await page.keyboard.press("Enter");
  await page
    .getByRole("heading", { name: "Billing POS", exact: true })
    .waitFor();
  assert.equal(await page.locator(".eyebrow").innerText(), "New bill");
  assert.equal(await page.locator(".pos-customer .field-error").count(), 0);
  assert(
    await page
      .locator(".pos-save-actions")
      .getByRole("button", { name: /Save & print/ })
      .isDisabled(),
  );
  assert(!(await page.locator(".pos-more-details").evaluate((el) => el.open)));
  await page.getByRole("textbox", { name: /Mobile number/ }).fill("123");
  await page.getByRole("textbox", { name: /Customer name/ }).focus();
  await page
    .getByText("Enter a 10-digit mobile number.", { exact: true })
    .first()
    .waitFor();
  await page.getByRole("textbox", { name: /Mobile number/ }).fill("9810000000");
  await page.getByText("Returning customer", { exact: true }).waitFor();
  assert.equal(
    await page.getByRole("textbox", { name: /Customer name/ }).inputValue(),
    "Amit Sharma",
  );
  await page
    .getByRole("textbox", { name: /Customer name/ })
    .fill("Returning Guest Test");
  await page
    .getByRole("spinbutton", { name: "Number of persons", exact: true })
    .fill("3");
  await page.locator(".pos-more-details summary").click();
  await page.getByLabel("Email", { exact: true }).fill("guest@example.com");
  await page
    .getByLabel("Customer GSTIN", { exact: true })
    .fill("05ABCDE1234F1Z5");
  await page
    .getByLabel("Billing address", { exact: true })
    .fill("Tapovan, Rishikesh");
  await page
    .getByLabel("Customer notes", { exact: true })
    .fill("Quiet morning booking");
  await page.locator(".pos-more-details summary").click();
  const rafting = page.getByRole("button", { name: /^River Rafting · 16 km,/ });
  await rafting.click();
  await rafting.click();
  await page.getByRole("button", { name: /^Bungee Jumping,/ }).click();
  assert.equal(
    await page
      .getByRole("spinbutton", {
        name: "Persons for River Rafting · 16 km",
        exact: true,
      })
      .inputValue(),
    "4",
  );
  assert.equal(
    await page
      .getByRole("spinbutton", {
        name: "Persons for Bungee Jumping",
        exact: true,
      })
      .inputValue(),
    "3",
  );
  const rows = page.locator(".compact-booking-row");
  const firstDate = rows
    .nth(0)
    .getByRole("textbox", { name: "Date", exact: true });
  await firstDate.fill("15/11/2026");
  await rows
    .nth(0)
    .getByRole("button", { name: /Apply date to all/ })
    .click();
  assert.equal(
    await rows
      .nth(1)
      .getByRole("textbox", { name: "Date", exact: true })
      .inputValue(),
    "15/11/2026",
  );
  await rows
    .nth(0)
    .getByRole("button", { name: /Time slot for/ })
    .click();
  await page.getByRole("button", { name: /Morning/ }).click();
  await rows
    .nth(0)
    .getByRole("button", { name: /Apply time to all/ })
    .click();
  assert(
    (
      await rows
        .nth(1)
        .getByRole("button", { name: /Time slot for/ })
        .innerText()
    ).includes("Morning"),
  );
  assert(
    await page
      .getByRole("spinbutton", {
        name: "Unit price for River Rafting · 16 km",
        exact: true,
      })
      .isEditable(),
  );
  await page.getByPlaceholder("Search existing agents").fill("Rajeev Sharma");
  await page.locator(".pos-adjustments summary").click();
  await page.getByRole("button", { name: "%", exact: true }).click();
  await page
    .getByRole("spinbutton", { name: "Discount (%)", exact: true })
    .fill("10");
  await page
    .getByLabel("Additional non-taxable charges (₹)", { exact: true })
    .fill("100");
  await page
    .getByRole("button", { name: "Partial payment", exact: true })
    .click();
  await page
    .getByRole("spinbutton", { name: "Amount collected", exact: true })
    .fill("0");
  await page
    .getByRole("spinbutton", { name: "Amount collected", exact: true })
    .blur();
  assert(
    await page
      .locator(".pos-save-actions")
      .getByRole("button", { name: /Save bill/ })
      .isDisabled(),
  );
  await page.getByRole("button", { name: "50%", exact: true }).click();
  assert.equal(
    await page
      .getByRole("spinbutton", { name: "Amount collected", exact: true })
      .inputValue(),
    "8540.15",
  );
  assert.equal(
    await page.locator(".pos-payment .badge").innerText(),
    "Partial",
  );
  await page.getByRole("button", { name: /Add another payment mode/ }).click();
  await page
    .getByRole("spinbutton", { name: "Amount for payment 1", exact: true })
    .fill("5000");
  await page
    .getByRole("spinbutton", { name: "Amount for payment 2", exact: true })
    .fill("3540.15");
  await page.waitForTimeout(350);
  const snapshots = [];
  for (const [width, height] of [
    [1440, 1000],
    [1024, 900],
    [768, 1024],
    [390, 844],
  ]) {
    await page.setViewportSize({ width, height });
    await page.evaluate(() => scrollTo(0, 0));
    await page.waitForTimeout(200);
    await page.screenshot({
      path: `/tmp/adventure-pos-review/pos-${width}.png`,
      fullPage: true,
    });
    const geometry = await page.evaluate(() => {
      const mobile = innerWidth <= 900;
      const panel = document.querySelector(
        mobile ? ".pos-mobile-bar" : ".pos-summary",
      );
      const save = document.querySelector(
        mobile
          ? ".pos-mobile-bar .pos-save-print"
          : ".pos-save-actions .pos-save-print",
      );
      const total = document.querySelector(
        mobile ? ".mobile-bill-total" : ".pos-summary-heading",
      );
      return {
        overflow: document.documentElement.scrollWidth > innerWidth,
        panel: panel.getBoundingClientRect().toJSON(),
        save: save.getBoundingClientRect().toJSON(),
        total: total.getBoundingClientRect().toJSON(),
        fonts: [...document.querySelectorAll(".pos-workspace *")]
          .filter(
            (el) =>
              el.children.length === 0 &&
              el.textContent.trim() &&
              el.getClientRects().length,
          )
          .filter((el) => parseFloat(getComputedStyle(el).fontSize) < 12)
          .map((el) => ({
            text: el.textContent,
            size: getComputedStyle(el).fontSize,
          })),
      };
    });
    assert(!geometry.overflow, `Page overflow at ${width}`);
    assert(
      geometry.save.bottom <= height && geometry.save.top >= 0,
      `Save is outside viewport at ${width}: ${JSON.stringify(geometry.save)}`,
    );
    assert(
      geometry.total.bottom <= height,
      `Grand total outside viewport at ${width}`,
    );
    assert.deepEqual(geometry.fonts, []);
    const audit = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    fs.writeFileSync(
      `/tmp/adventure-pos-review/axe-${width}.json`,
      JSON.stringify(audit.violations, null, 2),
    );
    snapshots.push({
      width,
      height,
      overflow: geometry.overflow,
      saveVisible: true,
      violations: audit.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => ({
          target: n.target,
          summary: n.failureSummary,
        })),
      })),
    });
  }
  console.log("RESPONSIVE", JSON.stringify(snapshots));
  assert(
    snapshots.every((item) => !item.violations.length),
    "Accessibility violations",
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.waitForTimeout(350);
  page.once("dialog", (dialog) => dialog.accept());
  await page.reload();
  await page
    .getByRole("heading", { name: "Billing POS", exact: true })
    .waitFor();
  await page
    .getByText("Draft restored from this browser", { exact: true })
    .waitFor();
  assert.equal(
    await page.getByRole("textbox", { name: /Customer name/ }).inputValue(),
    "Returning Guest Test",
  );
  assert.equal(await page.locator(".compact-booking-row").count(), 2);
  assert.equal(
    await page
      .getByRole("spinbutton", { name: "Amount for payment 1", exact: true })
      .inputValue(),
    "5000",
  );
  page.once("dialog", (dialog) => dialog.dismiss());
  await page
    .locator("nav")
    .getByRole("button", { name: "Dashboard", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Billing POS", exact: true })
    .waitFor();
  await page.evaluate(() => {
    window.__nativePrints = 0;
    window.addEventListener("beforeprint", () => window.__nativePrints++);
    document.addEventListener("keydown", (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "p")
        window.__posPrintPrevented = event.defaultPrevented;
    });
  });
  await page.keyboard.press("Control+p");
  await page
    .getByRole("heading", { name: "Invoice ADV-00076", exact: true })
    .waitFor();
  assert.equal(await page.evaluate(() => window.__posPrintPrevented), true);
  assert.equal(await page.evaluate(() => window.__nativePrints), 0);
  let saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("adventure-suite-v1")),
  );
  const invoice = saved.invoices.at(-1);
  assert.equal(invoice.discount, 1665);
  assert.equal(invoice.base, 14985);
  assert.equal(invoice.tax, 1995.3);
  assert.equal(invoice.charges, 100);
  assert.equal(invoice.total, 17080.3);
  assert.equal(invoice.commission, 1498.5);
  assert.equal(
    invoice.payments.reduce((n, p) => n + p.amount, 0),
    8540.15,
  );
  assert.equal(invoice.customer.gstin, "05ABCDE1234F1Z5");
  await page.getByRole("button", { name: "Close", exact: true }).click();
  assert.equal(
    await page.getByRole("textbox", { name: /Mobile number/ }).inputValue(),
    "",
  );
  assert.equal(await page.locator(".compact-booking-row").count(), 0);
  assert.equal(
    await page.evaluate(() =>
      localStorage.getItem("adventure-pos-draft-v1:Super Admin"),
    ),
    null,
  );
  assert(
    await page
      .getByRole("status", { name: "Invoice saved" })
      .getByRole("button", { name: "WhatsApp", exact: true })
      .isEnabled(),
  );
  assert.equal(
    await page
      .getByRole("textbox", { name: /Mobile number/ })
      .evaluate((el) => el === document.activeElement),
    true,
    "New-bill focus must return to mobile after preview closes",
  );
  await page.keyboard.type("9876543222");
  await page.keyboard.press("Tab");
  await page.keyboard.type("Keyboard Guest");
  await page.keyboard.press("Tab");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("Tab");
  await page.keyboard.press("/");
  assert.equal(
    await page
      .getByRole("textbox", { name: "Search activities", exact: true })
      .evaluate((el) => el === document.activeElement),
    true,
  );
  await page.keyboard.type("Kayaking");
  const categories = await page.locator(".category-filters button").count();
  for (let i = 0; i < categories + 1; i++) await page.keyboard.press("Tab");
  assert(
    (
      await page.evaluate(() =>
        document.activeElement.getAttribute("aria-label"),
      )
    ).startsWith("Kayaking,"),
  );
  await page.keyboard.press("Enter");
  await page.keyboard.press("Alt+1");
  await page.keyboard.press("Alt+f");
  await page.keyboard.press("?");
  await page
    .getByRole("dialog", { name: "Billing keyboard shortcuts" })
    .waitFor();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Control+Enter");
  await page
    .getByRole("status", { name: "Invoice saved" })
    .getByText(/ADV-00077/)
    .waitFor();
  saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("adventure-suite-v1")),
  );
  assert.equal(saved.invoices.at(-1).payments[0].method, "Cash");
  assert.equal(
    saved.invoices.at(-1).payments[0].amount,
    saved.invoices.at(-1).total,
  );
  await page
    .locator("nav")
    .getByRole("button", { name: "Dashboard", exact: true })
    .click();
  assert.equal(
    await page.evaluate(() => {
      const event = new KeyboardEvent("keydown", {
        key: "s",
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      });
      document.dispatchEvent(event);
      return event.defaultPrevented;
    }),
    false,
  );
  await page.getByLabel("Switch demo role").selectOption("Receptionist");
  await page.getByRole("textbox", { name: /Mobile number/ }).fill("9876543233");
  await page.getByRole("textbox", { name: /Customer name/ }).fill("Desk Guest");
  await page.getByRole("button", { name: /^River Rafting · 16 km,/ }).click();
  await page.getByPlaceholder("Search existing agents").fill("Rajeev Sharma");
  assert.equal(
    await page.getByRole("spinbutton", { name: /Unit price for/ }).count(),
    0,
  );
  assert.equal(await page.locator(".readonly-price").count(), 1);
  assert.equal(await page.getByText(/Agent commission:/).count(), 0);
  await page.waitForTimeout(350);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByLabel("Switch demo role").selectOption("Manager");
  await page
    .locator("nav")
    .getByRole("button", { name: "Billing POS", exact: true })
    .click();
  assert.equal(
    await page.getByRole("textbox", { name: /Mobile number/ }).inputValue(),
    "",
  );
  await page.getByLabel("Switch demo role").selectOption("Receptionist");
  await page
    .getByText("Draft restored from this browser", { exact: true })
    .waitFor();
  assert.equal(
    await page.getByRole("textbox", { name: /Customer name/ }).inputValue(),
    "Desk Guest",
  );
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      status: "passed",
      keyboardSaveAndPrint: true,
      nativePrintPrevented: true,
      keyboardOnlyBill: true,
      draftRestored: true,
      leavingWarning: true,
      roleDraftIsolation: true,
      restrictedPrices: true,
      commissionHidden: true,
      partialSplitCorrect: true,
      financialEngineUnchanged: true,
      viewports: snapshots.map((v) => v.width),
      consoleErrors: errors,
    }),
  );
  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
