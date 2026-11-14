# Service images for Billing POS

Services use the existing browser-local catalog. `Service` now has optional `imageUrl` and `thumbnailUrl` fields; missing fields remain valid. An explicit `null` means an image was removed. The default invoice template has `includeServiceImages: false`, and older templates with no field behave the same way.

## Upload and storage

Settings → Service catalog supports adding an image while creating a service, as well as previewing, replacing and removing an existing service image. Existing Settings create/edit permissions protect these operations.

Uploads accept JPEG/JPG, PNG or WebP files up to 2 MiB. Both MIME/extension and file signatures are checked; the browser must also successfully decode the image. Native Canvas processing preserves the aspect ratio, never upscales, and produces:

- A full image with a longest side of at most 600px, capped at 24 KiB encoded image data.
- A separate thumbnail with a longest side of at most 160px, capped at 8 KiB encoded image data, comfortably below the requested 50 KB limit.

Complex images may be reduced further to stay within the byte budget. WebP is preferred, with a JPEG fallback for browsers without WebP canvas encoding. No image library or external image host was added.

Processed images are stored as data URLs in the catalog and are included in the existing JSON backup. Catalog image writes check browser storage before applying the update: a quota/storage failure preserves the existing image and reports an error. Browser-local data is still subject to the prototype's storage limits; it is not cloud image storage.

## Demo and display

Ten pairs of local gradient SVG illustrations live in `public/images/services/`, at 600px and 160px intrinsic sizes. Existing known demo entries receive their local defaults once when image fields are absent. Explicit removals and custom services are preserved.

`ServiceThumbnail` reserves its width and height before loading, shows a skeleton, and fades in a lazy-loaded image. Failed or missing images render a category icon, with blue Water, amber Air, green Trek and teal default tints. The failed `<img>` is removed, and it remains invisible until loaded, avoiding a broken-image icon.

- Picker cards use 64px square thumbnails with a 12px radius. Selected images remain visible beneath a corner quantity badge.
- Booking rows and the summary use 36px thumbnails beside the service name.
- “Show service images” is enabled by default in Billing POS. Turning it off produces compact text-only cards/rows; the browser remembers the choice independently of billing drafts.
- Decorative images beside a visible service name have empty alt text. Management previews use the service name.

## Invoice printing

Service images are excluded from invoices by default. Invoice Designer → Properties → “Include service images on invoices” enables them for that saved template. It is independent of the POS display preference. Opted-in invoice images load eagerly for reliable printing, and PDF generation waits for invoice image decoding before capture. Billing lists retain native lazy loading.

Invoice images use the current service catalog image. Images are not copied into immutable financial line snapshots, and financial calculations are unchanged.

## Files

| Files | Changes |
| --- | --- |
| `lib/model.ts`, `lib/service-catalog.ts` | Optional image fields, local demo defaults and removal-aware additive migration; optional invoice-template flag. |
| `lib/service-images.ts` | File validation, aspect-ratio resizing, compression, thumbnail creation and safe image-source handling. |
| `components/services/service-thumbnail.tsx` | Shared memoized thumbnail, fixed layout, loading skeleton and error/category fallback. |
| `components/services/service-image-upload.tsx` | Accessible upload, preview, replace/remove and inline errors; cancels updates after unmount. |
| `components/billing/adventure-picker.tsx`, `booking-rows.tsx`, `billing-pos.tsx` | Picker, row and summary images, selected badges and remembered text-only preference. |
| `app/page.tsx`, `app/globals.css` | Service-management integration, quota-safe image updates, Invoice Designer switch and responsive styling. |
| `lib/documents.ts` | Waits for opt-in images before PDF capture. |
| `public/images/services/*.svg` | Twenty small local full/thumbnail demo assets; no hotlinked photos. |
| `tests/service-images.test.ts`, `scripts/service-images-check.cjs` | Validation/migration/asset tests and browser upload, persistence, printing, fallback, layout and performance checks. |
| `package.json`, `README.md` | Adds `test:images` and current validation instructions. |

## Verify

```sh
npm run lint
npm run typecheck
npm run build
npm test
# With the production server running:
npm run test:images
npm run test:pos
```

The image browser suite checks upload validation, processed dimensions/bytes, replacement and removal persistence, new-service creation, display preferences, default-off/opt-in invoice images, PDF generation, missing/failed image fallbacks, a delayed image's stable geometry, and a 60-service catalog at 1440px, 1024px, 768px and 390px. Screenshots and the sample PDF are stored under `/tmp/adventure-image-review`.

Production is published through Vercel at https://adventure-business-suite.vercel.app; source code is published to GitHub main.
