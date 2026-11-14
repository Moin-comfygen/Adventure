const { chromium } = require("playwright");
const AxeBuilder = require("@axe-core/playwright").default;
const assert = require("node:assert/strict");
const fs = require("node:fs");
(async () => {
  fs.mkdirSync("/tmp/adventure-dashboard-review", { recursive: true });
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
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(process.env.BASE_URL || "http://127.0.0.1:3000");
  await page.getByRole("button", { name: "Enter workspace" }).click();
  await page.getByRole("heading", { name: "Business overview" }).waitFor();
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("adventure-suite-v1"));
    s.invoices[0].payments = [];
    s.invoices[0].date = new Date().toISOString();
    s.invoices[0].customer.name = "moin";
    localStorage.setItem("adventure-suite-v1", JSON.stringify(s));
  });
  await page.reload();
  await page.getByRole("heading", { name: "Business overview" }).waitFor();
  await page
    .locator(".recent .invoice-row")
    .first()
    .getByText("Unpaid", { exact: true })
    .last()
    .waitFor();
  assert.equal(
    await page
      .locator(".recent .invoice-row")
      .first()
      .locator(".avatar")
      .innerText(),
    "M",
  );
  assert.equal(
    await page
      .locator(".recent .invoice-row")
      .first()
      .locator(".badge")
      .innerText(),
    "Unpaid",
  );
  assert.equal(
    await page
      .locator(".recent .invoice-row")
      .first()
      .locator(".badge")
      .getAttribute("class"),
    "badge red",
  );
  assert(
    !/\b1 bookings\b|\b1 participants\b/.test(
      await page.locator("body").innerText(),
    ),
  );
  assert.equal(
    await page.locator(".dashboard-period input[type=date]").count(),
    0,
  );
  assert.equal(
    await page.getByText("Demo workspace", { exact: true }).count(),
    0,
  );
  assert.equal(
    await page.getByText("Local data saved", { exact: true }).count(),
    0,
  );
  const viewports = [];
  for (const width of [1440, 1024, 768, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.waitForTimeout(200);
    await page.screenshot({
      path: `/tmp/adventure-dashboard-review/dashboard-${width}.png`,
      fullPage: true,
    });
    const geometry = await page.evaluate(() => {
      const cards = [
        ...document.querySelectorAll(".dashboard-kpis .kpi-card"),
      ].map((el) => el.getBoundingClientRect());
      return {
        overflow: document.documentElement.scrollWidth > innerWidth,
        columns: cards.filter((r) => Math.abs(r.top - cards[0].top) < 2).length,
        kpiBottom: Math.max(...cards.map((r) => r.bottom)),
        fonts: [
          ...document.querySelectorAll(
            ".dashboard-overview *,.dashboard-heading *",
          ),
        ]
          .filter(
            (el) =>
              el.children.length === 0 &&
              el.textContent.trim() &&
              el.getClientRects().length,
          )
          .filter((el) => parseFloat(getComputedStyle(el).fontSize) < 12)
          .map((el) => ({
            text: el.textContent,
            font: getComputedStyle(el).fontSize,
          })),
      };
    });
    assert(!geometry.overflow, `Document overflow at ${width}px`);
    assert.equal(geometry.columns, width >= 1200 ? 4 : width >= 570 ? 2 : 1);
    assert.deepEqual(geometry.fonts, [], `Small fonts at ${width}px`);
    if (width === 1440)
      assert(geometry.kpiBottom < 1000, "KPI row must be above fold");
    const audit = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    fs.writeFileSync(
      `/tmp/adventure-dashboard-review/accessibility-${width}.json`,
      JSON.stringify(audit.violations, null, 2),
    );
    viewports.push({
      width,
      ...geometry,
      violations: audit.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => ({
          target: n.target,
          summary: n.failureSummary,
        })),
      })),
    });
  }
  console.log("VIEWPORTS", JSON.stringify(viewports));
  assert(
    viewports.every((v) => v.violations.length === 0),
    "Accessibility violations found",
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page
    .getByRole("button", { name: "Collapse sidebar", exact: true })
    .click();
  assert(
    await page
      .locator(".app")
      .evaluate((el) => el.classList.contains("sidebar-collapsed")),
  );
  await page
    .getByRole("button", { name: "Expand sidebar", exact: true })
    .click();
  await page.keyboard.press("Control+k");
  await page
    .getByRole("combobox", {
      name: "Search invoices, customers, agents and pages",
    })
    .fill("Rajeev");
  await page.keyboard.press("Enter");
  await page
    .getByRole("heading", { name: "Rajeev Sharma", exact: true })
    .waitFor();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page
    .locator("nav")
    .getByRole("button", { name: "Dashboard", exact: true })
    .click();
  await page.getByRole("button", { name: /Outstanding payments:/ }).click();
  assert((await page.locator(".active-filter").innerText()).includes("Unpaid"));
  assert.equal(await page.locator(".sales-invoices .badge.green").count(), 0);
  await page
    .locator("nav")
    .getByRole("button", { name: "Dashboard", exact: true })
    .click();
  await page.locator(".recent .invoice-row").first().focus();
  await page.keyboard.press("Enter");
  await page.getByRole("dialog", { name: "Invoice preview" }).waitFor();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  const row = page.locator(".recent .invoice-row").first();
  await row.hover();
  await row.getByRole("button", { name: /Send reminder/ }).click();
  await page.getByRole("dialog", { name: "Payment reminder draft" }).waitFor();
  await page.keyboard.press("Escape");
  await row.hover();
  await row.getByRole("button", { name: /Record payment/ }).click();
  await page.getByRole("dialog", { name: "Invoice preview" }).waitFor();
  await page.waitForTimeout(150);
  assert.equal(
    await page
      .locator(".invoice-operations input[name=amount]")
      .evaluate((el) => el === document.activeElement),
    true,
  );
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await row.hover();
  const [quickPdf] = await Promise.all([
    page.waitForEvent("download"),
    row.getByRole("button", { name: /Download PDF/ }).click(),
  ]);
  await quickPdf.saveAs("/tmp/adventure-dashboard-review/quick-invoice.pdf");
  assert(
    fs.statSync("/tmp/adventure-dashboard-review/quick-invoice.pdf").size >
      1000,
  );
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.locator(".agent-rank").first().click();
  await page
    .getByRole("heading", { name: "Vikram Negi", exact: true })
    .waitFor();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page
    .locator("nav")
    .getByRole("button", { name: "Dashboard", exact: true })
    .click();
  await page.getByRole("button", { name: "Custom range", exact: true }).click();
  await page.getByLabel("From (DD/MM/YYYY)").fill("31/02/2099");
  await page.getByLabel("To (DD/MM/YYYY)").fill("07/03/2099");
  await page.getByRole("button", { name: "Apply range", exact: true }).click();
  await page.locator(".range-popover").getByRole("alert").waitFor();
  await page.getByLabel("From (DD/MM/YYYY)").fill("01/03/2099");
  await page.getByRole("button", { name: "Apply range", exact: true }).click();
  assert.equal(
    await page.getByText("No data for this period", { exact: true }).count(),
    3,
  );
  assert.equal(await page.locator(".recent .invoice-row").count(), 0);
  await page
    .getByRole("button", { name: "01/03/2099 – 07/03/2099", exact: true })
    .click();
  await page.getByRole("button", { name: "Clear range", exact: true }).click();
  await page.getByRole("button", { name: /Notifications, \d+ unread/ }).click();
  await page.getByRole("button", { name: "Mark all read" }).click();
  await page.keyboard.press("Escape");
  assert.equal(
    await page.getByRole("button", { name: "Notifications, 0 unread" }).count(),
    1,
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("button", { name: "Toggle navigation", exact: true })
    .click();
  await page.getByRole("dialog", { name: "Workspace navigation" }).waitFor();
  await page.keyboard.press("Escape");
  assert.equal(await page.locator(".mobile-open").count(), 0);
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      status: "passed",
      viewports: [1440, 1024, 768, 390],
      statusCorrect: true,
      keyboardRows: true,
      kpiFilters: true,
      search: true,
      reminders: true,
      dateValidation: true,
      emptyStates: true,
      notifications: true,
      mobileDrawer: true,
      consoleErrors: errors,
    }),
  );
  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
