# WhatsApp invoice PDFs

The saved-bill WhatsApp action, invoice preview’s “WhatsApp PDF”, and payment reminder’s “WhatsApp with invoice PDF” use one PDF-sharing flow. Existing invoice print permissions and receptionist history restrictions still apply.

The app prepares the selected invoice’s A4 PDF using the existing template, business details, GST/discount/commission calculation snapshots, payments and optional invoice image setting. `buildInvoicePdf` returns the existing jsPDF document; ordinary downloads still call `invoicePdf`, while sharing gets an `application/pdf` File through `invoicePdfFile`. No invoice is created again, and no financial calculation changed.

On browsers with Web Share file support, a second user click on “Share PDF” calls `navigator.share` with the actual PDF File, invoice title and message. Users choose WhatsApp and the recipient in the system share sheet. PDF generation happens before this click, preserving the browser’s required user activation. The app cannot select WhatsApp or a recipient inside the operating system’s share sheet, or confirm message delivery.

Without file-sharing support (including many desktop WhatsApp Web setups), “Download PDF & open WhatsApp” downloads `ADV-xxxxx.pdf` and opens the selected customer’s chat with a draft message. The user must attach the downloaded file using paperclip → Document before sending. A wa.me link cannot automatically attach a local file. “Download PDF” is also available separately. No invoice is uploaded publicly, and the app sends no message automatically.

Numbers normalize ten Indian digits to country prefix 91. Invalid chat numbers show an explanation; native sharing can still choose a recipient. User cancellation allows retry without a download or popup. Native sharing errors switch to the download fallback. PDF generation errors offer Retry. Closing the preview cancels pending UI updates; changing payments/status regenerates the file. Closing sharing re-enables A4/thermal format controls.

Changed files:
- `lib/documents.ts`: reusable PDF document/File creation, while preserving existing PDF downloads.
- `lib/invoice-sharing.ts`: numbers, messages, URLs, support detection and PDF download helper.
- `components/invoice-whatsapp.tsx`: PDF preparation, native sharing, errors/cancellation and desktop fallback.
- `components/billing/billing-pos.tsx`: saved-invoice WhatsApp callback.
- `components/invoice-reminder.tsx`: optional WhatsApp action preserving edited reminders.
- `app/page.tsx`: permissions and shared preview integration.
- `app/globals.css`: responsive sharing panel.
- `tests/invoice-sharing.test.ts`, `scripts/whatsapp-check.cjs`: number/message tests and browser integration coverage.
- `scripts/pos-check.cjs`: updated expectation for the PDF-sharing button replacing the text-only WhatsApp link.

Browser integration tests mock the system share API and WhatsApp destination so tests never send real messages. They verify the actual PDF bytes/MIME/filename, active user gesture, customer URL, cancellation/retry, blocked native sharing fallback, saved-bill action, edited reminders and responsive layout. Native OS app selection and final WhatsApp sending remain user actions.
