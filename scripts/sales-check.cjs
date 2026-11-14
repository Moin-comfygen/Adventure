const { chromium } = require("playwright");
const AxeBuilder = require("@axe-core/playwright").default;
const assert = require("node:assert/strict");
const ExcelJS = require("exceljs");
(async () => {
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    acceptDownloads: true,
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(process.env.BASE_URL || "http://localhost:3002");
  await page.getByRole("button", { name: "Enter workspace" }).click();
  await page
    .locator("nav")
    .getByRole("button", { name: "Sales Management", exact: true })
    .click();
  await page.getByRole("button", { name: "Clear all", exact: true }).click();
  const table = page.locator(".ledger-table-scroll");
  assert.equal(await table.locator("tbody tr").count(), 25);
  assert.equal(await page.locator(".ledger-kpi").count(), 7);
  await page.keyboard.press("/");
  assert(
    await page
      .getByRole("searchbox", { name: "Search invoices" })
      .evaluate((e) => e === document.activeElement),
  );
  await page
    .getByRole("searchbox", { name: "Search invoices" })
    .fill("no-such-invoice");
  await page
    .getByRole("heading", { name: "No invoices match these filters" })
    .waitFor();
  await page.getByRole("searchbox").fill("");
  await page.getByLabel("Rows per page").selectOption("50");
  assert.equal(await table.locator("tbody tr").count(), 50);
  await page.reload();
  await page.getByLabel("Rows per page").waitFor();
  assert.equal(await page.getByLabel("Rows per page").inputValue(), "50");
  await page.getByLabel("Select this page").check();
  await page
    .getByRole("button", { name: "Clear selection", exact: true })
    .click();
  await page.getByRole("button", { name: "Import sales", exact: true }).click();
  let download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download template (.xlsx)" }).click();
  const template = await download;
  await template.saveAs("/tmp/sales-template.xlsx");
  const book = new ExcelJS.Workbook();
  await book.xlsx.readFile("/tmp/sales-template.xlsx");
  assert.equal(book.worksheets.length, 3);
  await page.getByRole("button", { name: "Continue to upload" }).click();
  await page
    .getByLabel("Sales spreadsheet")
    .setInputFiles("/tmp/sales-template.xlsx");
  await page
    .getByRole("button", { name: /Confirm import · 1 valid invoice/ })
    .click();
  await page.getByRole("heading", { name: "Import history" }).waitFor();
  console.log(
    "IMPORT",
    await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem("adventure-suite-v1"));
      return {
        history: s.imports.slice(0, 1).map((i) => ({ ...i, undo: !!i.undo })),
        errors: [...document.querySelectorAll("[role=alert]")].map(
          (e) => e.textContent,
        ),
      };
    }),
  );
  await page.screenshot({
    path: "/tmp/sales-import-state.png",
    fullPage: true,
  });
  await page.locator(".ledger-import-history details summary").first().click();
  await page.getByRole("button", { name: "Undo most recent import" }).click();
  await page
    .getByText(/Undone/)
    .first()
    .waitFor();
  const results = [];
  for (const width of [1440, 1024, 768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    );
    const axe = await new AxeBuilder({ page })
      .include(".sales-ledger")
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    results.push({
      width,
      overflow,
      violations: axe.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => n.html).slice(0, 3),
      })),
    });
    await page.screenshot({ path: `/tmp/sales-${width}.png`, fullPage: true });
    assert(!overflow);
  }
  console.log(JSON.stringify(results));
  assert(results.every((r) => !r.violations.length));
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  await page.getByRole("dialog", { name: "Sales filters" }).waitFor();
  await page.keyboard.press("Escape");
  assert.equal(await page.getByRole("dialog").count(), 0);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page
    .locator("nav")
    .getByRole("button", { name: "Reports", exact: true })
    .click();
  await page.getByRole("heading", { name: "Sales vs collections" }).waitFor();
  for (const width of [1440, 1024, 768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    const reportAxe = await new AxeBuilder({ page })
      .include(".sales-ledger")
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    assert.deepEqual(
      reportAxe.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => n.html),
      })),
      [],
    );
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.locator(".ledger-export summary").click();
  download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Excel (.xlsx)", exact: true })
    .click();
  const exported = await download;
  await exported.saveAs("/tmp/sales-report.xlsx");
  await book.xlsx.readFile("/tmp/sales-report.xlsx");
  assert.deepEqual(
    book.worksheets.map((s) => s.name),
    ["Summary", "Sales", "Payments", "Agents", "GST"],
  );
  await page.getByLabel("Switch demo role").selectOption("Receptionist");
  await page
    .locator("nav")
    .getByRole("button", { name: "Sales Management", exact: true })
    .click();
  assert.equal(
    await page
      .getByRole("button", { name: "Import sales", exact: true })
      .count(),
    0,
  );
  assert.equal(await page.locator(".ledger-export").count(), 0);
  assert.equal(await page.getByText(/Commission ₹/).count(), 0);
  await page.getByLabel("Switch demo role").selectOption("Super Admin");
  await page
    .locator("nav")
    .getByRole("button", { name: "Sales Management", exact: true })
    .click();
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("adventure-suite-v1"));
    const original = s.invoices[0];
    s.invoices = Array.from({ length: 5000 }, (_, index) => ({
      ...original,
      id: `PERF-${String(index).padStart(5, "0")}`,
      externalId: undefined,
      createdBy: "Super Admin",
      lines: [original.lines[0]],
    }));
    localStorage.setItem("adventure-suite-v1", JSON.stringify(s));
    localStorage.setItem("adventure-sales-page-size", "25");
  });
  const started = Date.now();
  await page.reload();
  await page.getByRole("button", { name: "Clear all", exact: true }).click();
  await page.waitForFunction(
    () =>
      document.querySelectorAll(".ledger-table-scroll tbody tr").length === 25,
  );
  assert.equal(await page.locator(".ledger-table-scroll tbody tr").count(), 25);
  const filterStart = Date.now();
  await page
    .getByRole("searchbox", { name: "Search invoices" })
    .fill("PERF-04999");
  await page.waitForFunction(
    () =>
      document.querySelectorAll(".ledger-table-scroll tbody tr").length === 1,
  );
  console.log(
    JSON.stringify({
      invoices: 5000,
      renderedRows: 25,
      loadMs: filterStart - started,
      searchMs: Date.now() - filterStart,
    }),
  );
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      passed: true,
      templateRoundTrip: true,
      undo: true,
      pagination: true,
      url: true,
      roles: true,
      exports: true,
      errors,
    }),
  );
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
