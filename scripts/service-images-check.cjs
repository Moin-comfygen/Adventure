const { chromium } = require("playwright");
const AxeBuilder = require("@axe-core/playwright").default;
const assert = require("node:assert/strict");
const fs = require("node:fs");
(async () => {
  fs.mkdirSync("/tmp/adventure-image-review", { recursive: true });
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
  const base = process.env.BASE_URL || "http://127.0.0.1:3000";
  await page.goto(base);
  await page.getByRole("button", { name: "Enter workspace" }).click();
  await page
    .locator("nav")
    .getByRole("button", { name: "Settings", exact: true })
    .click();
  const png = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1800;
    canvas.height = 900;
    const ctx = canvas.getContext("2d");
    const g = ctx.createLinearGradient(0, 0, 1800, 900);
    g.addColorStop(0, "#e6b35b");
    g.addColorStop(1, "#146b78");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 1800, 900);
    ctx.fillStyle = "#fff";
    ctx.fillRect(100, 100, 600, 250);
    return canvas.toDataURL("image/png").split(",")[1];
  });
  const input = page.locator(
    'input[type="file"][aria-label="Upload image for River Rafting · 16 km"]',
  );
  await input.setInputFiles({
    name: "rafting.png",
    mimeType: "image/png",
    buffer: Buffer.from(png, "base64"),
  });
  await page.waitForFunction(() =>
    JSON.parse(
      localStorage.getItem("adventure-suite-v1"),
    ).services[0].imageUrl.startsWith("data:"),
  );
  const metadata = await page.evaluate(async () => {
    const service = JSON.parse(localStorage.getItem("adventure-suite-v1"))
      .services[0];
    async function dimensions(src) {
      const img = new Image();
      img.src = src;
      await img.decode();
      return {
        width: img.naturalWidth,
        height: img.naturalHeight,
        bytes: atob(src.split(",")[1]).length,
      };
    }
    return {
      full: await dimensions(service.imageUrl),
      thumbnail: await dimensions(service.thumbnailUrl),
    };
  });
  assert(Math.max(metadata.full.width, metadata.full.height) <= 600);
  assert.equal(
    Math.max(metadata.thumbnail.width, metadata.thumbnail.height),
    160,
  );
  assert(metadata.thumbnail.bytes < 50000);
  const original = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("adventure-suite-v1")).services[0]
        .imageUrl,
  );
  await input.setInputFiles({
    name: "bad.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from("<svg/>"),
  });
  await page
    .getByRole("alert")
    .filter({ hasText: "Choose a JPG, PNG or WebP image." })
    .waitFor();
  assert.equal(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("adventure-suite-v1")).services[0]
          .imageUrl,
    ),
    original,
  );
  await input.setInputFiles({
    name: "oversize.png",
    mimeType: "image/png",
    buffer: Buffer.alloc(2 * 1024 * 1024 + 1),
  });
  await page
    .getByRole("alert")
    .filter({ hasText: "Image must be 2 MB or smaller." })
    .waitFor();
  await input.setInputFiles({
    name: "fake.png",
    mimeType: "image/png",
    buffer: Buffer.from("not a png"),
  });
  await page
    .getByRole("alert")
    .filter({ hasText: "file contents do not match" })
    .waitFor();
  const jpeg = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 900;
    canvas.height = 1400;
    const c = canvas.getContext("2d");
    c.fillStyle = "#345b80";
    c.fillRect(0, 0, 900, 1400);
    return canvas.toDataURL("image/jpeg", 0.8).split(",")[1];
  });
  await input.setInputFiles({
    name: "replacement.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.from(jpeg, "base64"),
  });
  await page.waitForFunction(
    (previous) =>
      JSON.parse(localStorage.getItem("adventure-suite-v1")).services[0]
        .imageUrl !== previous,
    original,
  );
  await page
    .getByRole("button", {
      name: "Remove image for River Rafting · 16 km",
      exact: true,
    })
    .click();
  await page.waitForFunction(
    () =>
      JSON.parse(localStorage.getItem("adventure-suite-v1")).services[0]
        .imageUrl === null,
  );
  await page.reload();
  await page.getByRole("heading", { name: "Settings", exact: true }).waitFor();
  assert.equal(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("adventure-suite-v1")).services[0]
          .imageUrl,
    ),
    null,
  );
  await page
    .locator(
      'input[type="file"][aria-label="Upload image for River Rafting · 16 km"]',
    )
    .setInputFiles({
      name: "rafting.png",
      mimeType: "image/png",
      buffer: Buffer.from(png, "base64"),
    });
  await page.waitForFunction(() =>
    JSON.parse(
      localStorage.getItem("adventure-suite-v1"),
    ).services[0].imageUrl?.startsWith("data:"),
  );
  await page
    .locator("nav")
    .getByRole("button", { name: "Billing POS", exact: true })
    .click();
  const card = page.getByRole("button", { name: /^River Rafting · 16 km,/ });
  await card.scrollIntoViewIfNeeded();
  await card.locator(".service-thumbnail[data-image-state=loaded]").waitFor();
  assert.equal(await card.locator("img").getAttribute("loading"), "lazy");
  assert.equal(await card.locator("img").getAttribute("width"), "64");
  await card.click();
  assert.equal(await card.locator("img").count(), 1);
  assert.equal(await card.locator(".selection-quantity").innerText(), "1");
  assert.equal(await page.locator(".booking-service-name img").count(), 1);
  assert.equal(await page.locator(".pos-summary-activities img").count(), 1);
  await page
    .getByRole("checkbox", { name: "Show service images", exact: true })
    .uncheck();
  assert.equal(await page.locator(".adventure-grid img").count(), 0);
  assert.equal(await page.locator(".booking-service-name img").count(), 0);
  page.once("dialog", (dialog) => dialog.accept());
  await page.reload();
  await page
    .getByRole("heading", { name: "Billing POS", exact: true })
    .waitFor();
  assert.equal(
    await page
      .getByRole("checkbox", { name: "Show service images", exact: true })
      .isChecked(),
    false,
  );
  await page
    .getByRole("checkbox", { name: "Show service images", exact: true })
    .check();
  await page.getByRole("textbox", { name: /Mobile number/ }).fill("9876543219");
  await page
    .getByRole("textbox", { name: /Customer name/ })
    .fill("Image Guest");
  await page.keyboard.press("Control+p");
  await page.getByRole("dialog", { name: "Invoice preview" }).waitFor();
  assert.equal(
    await page.locator("#print-invoice .invoice-service-name img").count(),
    0,
  );
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page
    .locator("nav")
    .getByRole("button", { name: "Invoice Designer", exact: true })
    .click();
  await page
    .getByRole("checkbox", {
      name: "Include service images on invoices",
      exact: true,
    })
    .check();
  await page
    .getByRole("button", { name: "Save template", exact: true })
    .click();
  await page
    .locator("nav")
    .getByRole("button", { name: "Sales Management", exact: true })
    .click();
  await page.getByRole("button", { name: "View ADV-00076", exact: true }).click();
  await page
    .locator("#print-invoice .service-thumbnail[data-image-state=loaded]")
    .waitFor();
  assert.equal(
    await page.locator("#print-invoice .invoice-service-name img").count(),
    1,
  );
  const [pdf] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "PDF", exact: true }).click(),
  ]);
  await pdf.saveAs("/tmp/adventure-image-review/invoice-with-image.pdf");
  assert(
    fs.statSync("/tmp/adventure-image-review/invoice-with-image.pdf").size >
      1000,
  );
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page
    .locator("nav")
    .getByRole("button", { name: "Settings", exact: true })
    .click();
  await page.evaluate(() => {
    window.__originalImageDecode = HTMLImageElement.prototype.decode;
    const gate = new Promise((resolve) => {
      window.__releaseUploadDecode = resolve;
    });
    HTMLImageElement.prototype.decode = async function () {
      await gate;
      return window.__originalImageDecode.call(this);
    };
  });
  await page
    .getByPlaceholder("Activity name", { exact: true })
    .fill("Cancelled upload");
  await page
    .locator('input[type=file][aria-label="Upload image for Cancelled upload"]')
    .setInputFiles({
      name: "cancel.png",
      mimeType: "image/png",
      buffer: Buffer.from(png, "base64"),
    });
  await page.waitForFunction(
    () =>
      [...document.querySelectorAll("button")].find(
        (button) => button.textContent === "Add service",
      )?.disabled,
  );
  await page
    .locator("nav")
    .getByRole("button", { name: "Billing POS", exact: true })
    .click();
  await page
    .locator("nav")
    .getByRole("button", { name: "Settings", exact: true })
    .click();
  assert.equal(
    await page
      .getByRole("button", { name: "Add service", exact: true })
      .isDisabled(),
    false,
  );
  await page.evaluate(() => {
    HTMLImageElement.prototype.decode = window.__originalImageDecode;
    window.__releaseUploadDecode();
  });
  await page
    .getByPlaceholder("Activity name", { exact: true })
    .fill("Photo upload trek");
  await page
    .getByPlaceholder("Category", { exact: true })
    .fill("Mountain trek");
  await page.getByPlaceholder("Price", { exact: true }).fill("1500");
  await page.getByPlaceholder("GST %", { exact: true }).fill("5");
  await page
    .locator(
      'input[type=file][aria-label="Upload image for Photo upload trek"]',
    )
    .setInputFiles({
      name: "new-trek.png",
      mimeType: "image/png",
      buffer: Buffer.from(png, "base64"),
    });
  await page
    .getByRole("button", {
      name: "Replace image for Photo upload trek",
      exact: true,
    })
    .waitFor();
  await page.getByRole("button", { name: "Add service", exact: true }).click();
  await page.waitForFunction(() =>
    JSON.parse(localStorage.getItem("adventure-suite-v1")).services.some(
      (service) =>
        service.name === "Photo upload trek" &&
        service.imageUrl?.startsWith("data:"),
    ),
  );
  await page
    .locator("nav")
    .getByRole("button", { name: "Sales Management", exact: true })
    .click();
  let releaseDelayed;
  const gate = new Promise((resolve) => {
    releaseDelayed = resolve;
  });
  await page.route("**/delayed-service-image.svg", async (route) => {
    await gate;
    await route.fulfill({
      status: 200,
      contentType: "image/svg+xml",
      body: fs.readFileSync("public/images/services/s2-thumb.svg"),
    });
  });
  await page.route("**/missing-service-image.webp", (route) =>
    route.fulfill({ status: 404, body: "Missing" }),
  );
  await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem("adventure-suite-v1"));
    const source = state.services;
    state.services = Array.from({ length: 60 }, (_, index) => ({
      ...source[index % source.length],
      id: `perf-${index}`,
      name: `Adventure ${index + 1}`,
    }));
    state.services[0].imageUrl = null;
    state.services[0].thumbnailUrl = null;
    state.services[1].imageUrl = "/missing-service-image.webp";
    state.services[1].thumbnailUrl = "/missing-service-image.webp";
    state.services[2].imageUrl = "/delayed-service-image.svg";
    state.services[2].thumbnailUrl = "/delayed-service-image.svg";
    localStorage.setItem("adventure-suite-v1", JSON.stringify(state));
  });
  await page.reload();
  await page
    .locator("nav")
    .getByRole("button", { name: "Billing POS", exact: true })
    .click();
  assert.equal(await page.locator(".adventure-option").count(), 60);
  await page
    .getByRole("button", { name: /^Adventure 2,/ })
    .scrollIntoViewIfNeeded();
  await page
    .getByRole("button", { name: /^Adventure 2,/ })
    .locator("[data-image-state=fallback]")
    .waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: /^Adventure 2,/ })
      .locator("img")
      .count(),
    0,
  );
  assert.equal(
    await page
      .getByRole("button", { name: /^Adventure 1,/ })
      .locator("[data-image-state=fallback]")
      .count(),
    1,
  );
  const delayedCard = page.getByRole("button", { name: /^Adventure 3,/ });
  await delayedCard.scrollIntoViewIfNeeded();
  await delayedCard.locator("[data-image-state=loading]").waitFor();
  const beforeLoad = await delayedCard.boundingBox();
  const thumbBefore = await delayedCard
    .locator(".service-thumbnail")
    .boundingBox();
  releaseDelayed();
  await delayedCard.locator("[data-image-state=loaded]").waitFor();
  assert.deepEqual(
    await delayedCard.boundingBox(),
    beforeLoad,
    "Image loading must not move or resize the card",
  );
  assert.deepEqual(
    await delayedCard.locator(".service-thumbnail").boundingBox(),
    thumbBefore,
  );
  const responsive = [];
  for (const width of [1440, 1024, 768, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.evaluate(() => scrollTo(0, 0));
    await page.waitForTimeout(200);
    await page.screenshot({
      path: `/tmp/adventure-image-review/images-${width}.png`,
      fullPage: true,
    });
    const layout = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth > innerWidth,
      dimensions: [...document.querySelectorAll(".adventure-media")].map(
        (el) => ({
          width: el.getBoundingClientRect().width,
          height: el.getBoundingClientRect().height,
        }),
      ),
      broken: [...document.querySelectorAll(".service-thumbnail img")].filter(
        (img) => img.complete && img.naturalWidth === 0,
      ).length,
    }));
    assert(!layout.overflow, `Overflow at ${width}px`);
    assert(layout.dimensions.every((d) => d.width === 64 && d.height === 64));
    assert.equal(layout.broken, 0);
    const audit = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    responsive.push({
      width,
      violations: audit.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => ({
          target: n.target,
          summary: n.failureSummary,
        })),
      })),
    });
  }
  console.log("RESPONSIVE", JSON.stringify(responsive));
  assert(responsive.every((r) => !r.violations.length));
  const start = Date.now();
  await page
    .getByRole("textbox", { name: "Search activities", exact: true })
    .fill("Adventure 60");
  await page.getByRole("button", { name: /^Adventure 60,/ }).waitFor();
  const searchMs = Date.now() - start;
  assert(searchMs < 2000, `Filtering too slow: ${searchMs}ms`);
  assert.equal(await page.locator(".adventure-option").count(), 1);
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      status: "passed",
      upload: metadata,
      validation: true,
      replacement: true,
      removalPersists: true,
      pickerAndRows: true,
      summary: true,
      newServiceCreation: true,
      cancelledUploadCleanup: true,
      layoutStable: true,
      preferencePersists: true,
      printOptIn: true,
      pdf: true,
      fallbacks: true,
      services: 60,
      searchMs,
      viewports: responsive.map((r) => r.width),
    }),
  );
  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
