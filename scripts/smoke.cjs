const { chromium } = require("playwright");
const fs = require("fs");
(async () => {
  const b = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  const p = await b.newPage({
    viewport: { width: 1440, height: 1000 },
    acceptDownloads: true,
  });
  p.setDefaultTimeout(15000);
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto(process.env.BASE_URL || "http://127.0.0.1:3000");
  await p.getByRole("button", { name: "Enter workspace" }).click();
  await p.getByRole("heading", { name: "Business overview" }).waitFor();
  await p.waitForTimeout(500);
  await p.screenshot({ path: "/tmp/adventure-dashboard.png", fullPage: true });
  await p
    .locator("nav")
    .getByRole("button", { name: "Sales Management", exact: true })
    .click();
  await p.getByRole("button", { name: "Import sales", exact: true }).click();
  fs.writeFileSync(
    "/tmp/adventure-import.csv",
    "Invoice Ref,Invoice Date,Customer Name,Mobile,Activity,Participants,Discount (INR),Amount Paid,Payment Mode,Referral Agent\nBROWSER-IMPORT,14/11/2026,Import Guest,9876543212,River Rafting · 16 km,2,200,1000,UPI,Rajeev Sharma\nBROWSER-BAD-001,14/11/2026,Invalid Guest,9876543212,River Rafting · 16 km,0,0,0,Cash,\nBAD,14/11/2026,Unknown Guest,9876543213,Unknown,1,0,0,Cash,",
  );
  await p.getByRole("button", { name: "Continue to upload" }).click();
  await p
    .getByLabel("Sales spreadsheet")
    .setInputFiles("/tmp/adventure-import.csv");
  await p.waitForTimeout(1000);
  await p.getByRole("checkbox", { name: /Import valid rows only/ }).check();
  await p
    .getByRole("button", { name: "Confirm import · 1 valid invoice" })
    .click();
  await p
    .getByRole("button", { name: "View ADV-00076", exact: true })
    .waitFor();
  let saved = await p.evaluate(() =>
    JSON.parse(localStorage.getItem("adventure-suite-v1")),
  );
  if (saved.invoices.length !== 76 || saved.imports[0].errors.length !== 2)
    throw Error("Import mismatch");
  const invoice = saved.invoices.at(-1);
  if (
    invoice.commission !== 280 ||
    invoice.tax !== 140 ||
    invoice.total !== 2940
  )
    throw Error("Import calculation mismatch");
  await p
    .locator("nav")
    .getByRole("button", { name: "Agents & Commissions", exact: true })
    .click();
  await p
    .getByRole("row")
    .filter({ hasText: "Rajeev Sharma" })
    .getByRole("button", { name: "Ledger", exact: true })
    .click();
  await p.getByLabel("Amount", { exact: true }).fill("100");
  await p.getByLabel("Reference / reason").fill("Browser partial payout");
  await p.getByRole("button", { name: "Record partial / full payout" }).click();
  saved = await p.evaluate(() =>
    JSON.parse(localStorage.getItem("adventure-suite-v1")),
  );
  if (saved.payouts.at(-1).amount !== 100) throw Error("Payout missing");
  await p.getByRole("button", { name: "Close", exact: true }).click();
  await p
    .locator("nav")
    .getByRole("button", { name: "Invoice Designer", exact: true })
    .click();
  const handle = p.getByRole("button", {
    name: "Move Business Name",
    exact: true,
  });
  const target = p.getByRole("button", {
    name: "Move Invoice Date",
    exact: true,
  });
  const box = await handle.boundingBox(),
    end = await target.boundingBox();
  await p.mouse.move(box.x + 7, box.y + 7);
  await p.mouse.down();
  await p.mouse.move(end.x + 7, end.y + 7, { steps: 15 });
  await p.mouse.up();
  await p.getByRole("button", { name: "Save template", exact: true }).click();
  await p.screenshot({ path: "/tmp/designer.png", fullPage: true });
  await p
    .locator(".properties textarea")
    .nth(1)
    .fill("Your adventure, beautifully organized.");
  await p.getByRole("button", { name: "Save template", exact: true }).click();
  await p.reload();
  await p
    .locator("nav")
    .getByRole("button", { name: "Sales Management", exact: true })
    .click();
  await p.getByRole("button", { name: "View ADV-00076", exact: true }).click();
  const pdf = await Promise.all([
    p.waitForEvent("download"),
    p.getByRole("button", { name: "PDF", exact: true }).click(),
  ]);
  await pdf[0].saveAs("/tmp/adventure-a4.pdf");
  await p.getByRole("button", { name: "Thermal 80mm", exact: true }).click();
  const thermal = await Promise.all([
    p.waitForEvent("download"),
    p.getByRole("button", { name: "PDF", exact: true }).click(),
  ]);
  await thermal[0].saveAs("/tmp/adventure-thermal.pdf");
  await p.evaluate(() => {
    window.print = () => {
      window.__printed = true;
    };
  });
  await p.getByRole("button", { name: "Print Thermal", exact: true }).click();
  if (!(await p.evaluate(() => window.__printed)))
    throw Error("Print not invoked");
  await p.getByRole("button", { name: "A4", exact: true }).click();
  await p.getByRole("button", { name: "Print A4", exact: true }).click();
  await p.screenshot({ path: "/tmp/adventure-invoice.png", fullPage: true });
  await p.getByRole("button", { name: "Close", exact: true }).click();
  await p.setViewportSize({ width: 390, height: 844 });
  await p.waitForTimeout(350);
  await p.screenshot({ path: "/tmp/adventure-mobile.png", fullPage: true });
  if (await p.evaluate(() => document.documentElement.scrollWidth > innerWidth))
    throw Error("Mobile overflow");
  console.log(
    JSON.stringify({
      errors,
      imported: 1,
      rejected: 2,
      commission: 280,
      tax: 140,
      partialPayout: 100,
      pdfA4: fs.statSync("/tmp/adventure-a4.pdf").size,
      pdfThermal: fs.statSync("/tmp/adventure-thermal.pdf").size,
      printInvoked: true,
      persistence: true,
      mobileNoOverflow: true,
    }),
  );
  if (errors.length) throw Error(errors.join("; "));
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
