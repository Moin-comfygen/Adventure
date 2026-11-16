const { chromium } = require("playwright");
const assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(process.env.BASE_URL || "http://localhost:3010");
  await page.getByRole("button", { name: "Enter workspace" }).click();
  const target = await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("adventure-suite-v1"));
    const i = s.invoices.find(
      (i) =>
        i.status === "Active" &&
        i.payments.reduce((a, p) => a + p.amount, 0) < i.total,
    );
    return {
      id: i.id,
      due:
        Math.round(
          (i.total - i.payments.reduce((a, p) => a + p.amount, 0)) * 100,
        ) / 100,
      count: s.invoices.length,
    };
  });
  await page
    .locator("nav")
    .getByRole("button", { name: "Sales Management", exact: true })
    .click();
  await page.getByRole("button", { name: "Clear all", exact: true }).click();
  await page
    .getByRole("searchbox", { name: "Search invoices" })
    .fill(target.id);
  await page
    .getByRole("button", {
      name: `Record payment for ${target.id}`,
      exact: true,
    })
    .click();
  await page
    .getByLabel("Payment amount", { exact: true })
    .fill(String(target.due));
  assert.equal(
    await page
      .getByLabel("Payment amount", { exact: true })
      .getAttribute("max"),
    String(target.due),
  );
  await page
    .getByRole("button", { name: "Record payment", exact: true })
    .click();
  await page.getByText("Paid in full", { exact: true }).waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "Record payment", exact: true })
      .count(),
    0,
  );
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await page
      .locator(".print-overlay")
      .evaluate((e) => (e.scrollTop = e.scrollHeight));
    const rect = await page
      .getByRole("button", { name: "Close", exact: true })
      .boundingBox();
    assert(rect.y >= 0 && rect.y + rect.height <= 844);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
  }
  await page
    .getByRole("button", { name: "Continue billing", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Billing POS", exact: true })
    .waitFor();
  assert.equal(
    await page.getByRole("dialog", { name: "Invoice preview" }).count(),
    0,
  );
  assert.equal(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("adventure-suite-v1")).invoices.length,
    ),
    target.count,
  );
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      passed: true,
      paidFormHidden: true,
      paymentBalanceBounded: true,
      stickyClose: true,
      continueBilling: true,
      noDuplicateInvoice: true,
      viewports: [1440, 390],
      errors,
    }),
  );
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
