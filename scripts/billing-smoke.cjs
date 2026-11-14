const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1080 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(process.env.BASE_URL || "http://127.0.0.1:3000");
  await page.getByRole("button", { name: "Enter workspace" }).click();
  await page.getByRole("heading", { name: "Business overview" }).waitFor();
  await page.screenshot({
    path: "/tmp/adventure-dashboard.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Billing POS", exact: false })
    .first()
    .click();
  await page
    .getByRole("textbox", { name: "Customer name" })
    .fill("Browser Test");
  await page.getByRole("textbox", { name: "Mobile number" }).fill("9876543211");
  await page
    .getByRole("button", { name: "River Rafting · 16 km", exact: false })
    .click();
  await page.locator(".pos-adjustments summary").click();
  await page.getByLabel("Discount (₹)").fill("200");
  await page.getByPlaceholder("Search existing agents").fill("Rajeev Sharma");
  await page.getByRole("button", { name: "Full payment", exact: true }).click();
  await page.getByRole("button", { name: "Save & print" }).click();
  await page.getByRole("heading", { name: "Invoice ADV-00076" }).waitFor();
  await page.screenshot({ path: "/tmp/adventure-invoice.png", fullPage: true });
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.reload();
  await page
    .getByRole("button", { name: "Sales Management", exact: true })
    .click();
  await page.getByRole("button", { name: "ADV-00076", exact: true }).waitFor();
  await page.getByLabel("Switch demo role").selectOption("Receptionist");
  await page
    .getByRole("heading", { name: "Billing POS", exact: true })
    .waitFor();
  if (
    await page
      .locator("nav")
      .getByRole("button", { name: "Dashboard", exact: true })
      .count()
  )
    throw Error("Receptionist dashboard visible");
  await page.getByLabel("Switch demo role").selectOption("Manager");
  await page.getByRole("heading", { name: "Business overview" }).waitFor();
  if (
    await page
      .locator("nav")
      .getByRole("button", { name: "Settings", exact: true })
      .count()
  )
    throw Error("Manager settings visible");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(350);
  await page.screenshot({ path: "/tmp/adventure-mobile.png", fullPage: true });
  console.log(
    JSON.stringify({
      errors,
      invoiceCreated: true,
      persisted: true,
      receptionistRestricted: true,
      managerRestricted: true,
    }),
  );
  if (errors.length) throw Error(errors.join("; "));
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
