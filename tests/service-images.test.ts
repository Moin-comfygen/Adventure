import { test } from "node:test";
import assert from "node:assert/strict";
import {
  fitImage,
  validateServiceImage,
  MAX_UPLOAD_BYTES,
  safeServiceImage,
} from "../lib/service-images";
import { addDemoServiceImages } from "../lib/service-catalog";
import { seed } from "../lib/model";
import { statSync, readFileSync } from "node:fs";
test("image validation allows JPEG, PNG and WebP and enforces size and actual contents", () => {
  const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  assert.doesNotThrow(() =>
    validateServiceImage(
      { name: "test.PNG", type: "image/png", size: 100 },
      png,
    ),
  );
  assert.doesNotThrow(() =>
    validateServiceImage(
      { name: "photo.jpeg", type: "image/jpeg", size: MAX_UPLOAD_BYTES },
      new Uint8Array([255, 216, 255]),
    ),
  );
  assert.doesNotThrow(() =>
    validateServiceImage(
      { name: "photo.webp", type: "image/webp", size: 100 },
      new TextEncoder().encode("RIFF0000WEBP"),
    ),
  );
  assert.throws(
    () =>
      validateServiceImage({
        name: "large.png",
        type: "image/png",
        size: MAX_UPLOAD_BYTES + 1,
      }),
    /2 MB/,
  );
  assert.throws(
    () =>
      validateServiceImage({
        name: "photo.svg",
        type: "image/svg+xml",
        size: 100,
      }),
    /JPG, PNG or WebP/,
  );
  assert.throws(
    () =>
      validateServiceImage(
        { name: "fake.png", type: "image/png", size: 100 },
        new Uint8Array([255, 216, 255]),
      ),
    /contents/,
  );
  assert.throws(
    () =>
      validateServiceImage({ name: "empty.png", type: "image/png", size: 0 }),
    /empty/,
  );
});
test("resize keeps aspect ratio, caps long side and never upscales", () => {
  assert.deepEqual(fitImage(2400, 1200, 600), { width: 600, height: 300 });
  assert.deepEqual(fitImage(1200, 2400, 160), { width: 80, height: 160 });
  assert.deepEqual(fitImage(40, 30, 160), { width: 40, height: 30 });
  assert.throws(() => fitImage(0, 10, 600));
});
test("migration seeds only known demo services and respects an explicit image removal", () => {
  const s = seed();
  const { imageUrl: _full, thumbnailUrl: _thumb, ...legacy } = s.services[0];
  assert(
    addDemoServiceImages([legacy])[0].thumbnailUrl?.endsWith("-thumb.svg"),
  );
  const removed = { ...legacy, imageUrl: null, thumbnailUrl: null };
  assert.equal(addDemoServiceImages([removed])[0].imageUrl, null);
  assert.equal(
    addDemoServiceImages([{ ...legacy, id: "custom" }])[0].imageUrl,
    undefined,
  );
});
test("demo assets are local and thumbnail files are tiny with explicit dimensions", () => {
  for (const service of seed().services) {
    assert(service.imageUrl?.startsWith("/images/services/"));
    assert(service.thumbnailUrl?.startsWith("/images/services/"));
    const path = `public${service.thumbnailUrl}`;
    assert(statSync(path).size < 50000);
    assert(readFileSync(path, "utf8").includes('width="160"'));
  }
  assert.equal(seed().templates[0].includeServiceImages, false);
});
test("unsupported image URI schemes never reach an img element", () => {
  assert.equal(safeServiceImage("javascript:alert(1)"), undefined);
  assert.equal(safeServiceImage("data:image/svg+xml;base64,xxx"), undefined);
  assert.equal(
    safeServiceImage("/images/services/s0.svg"),
    "/images/services/s0.svg",
  );
  assert.equal(safeServiceImage(null), undefined);
});
