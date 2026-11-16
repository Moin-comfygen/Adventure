import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { ensureSameOrigin } from "../lib/bookings/security";
test("booking POST origin checks use the public host behind Next reverse proxies", () => {
  assert.doesNotThrow(() =>
    ensureSameOrigin(
      new NextRequest("http://0.0.0.0:3014/api/booking-staff/session", {
        headers: { host: "localhost:3014", origin: "http://localhost:3014" },
      }),
    ),
  );
  assert.doesNotThrow(() =>
    ensureSameOrigin(
      new NextRequest("http://internal:3000/api/customer-booking/site", {
        headers: {
          host: "adventure-business-suite.vercel.app",
          "x-forwarded-proto": "https",
          origin: "https://adventure-business-suite.vercel.app",
        },
      }),
    ),
  );
  assert.throws(
    () =>
      ensureSameOrigin(
        new NextRequest("http://internal:3000/api/customer-booking/site", {
          headers: {
            host: "adventure-business-suite.vercel.app",
            "x-forwarded-proto": "https",
            origin: "https://untrusted.example",
          },
        }),
      ),
    /this booking site/,
  );
});
