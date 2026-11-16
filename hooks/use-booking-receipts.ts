"use client";
import { useEffect, useRef } from "react";
import type { Invoice, State } from "@/lib/model";
export function useBookingReceipts(
  enabled: boolean,
  scope: string,
  onReceipts: (invoices: Invoice[]) => void,
  onBranding: (branding: NonNullable<State["bookingBranding"]>) => void,
) {
  const brandingCallback = useRef(onBranding),
    brandingAt = useRef(0);
  brandingCallback.current = onBranding;
  const callback = useRef(onReceipts),
    last = useRef(0);
  callback.current = onReceipts;
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    let working = false;
    const sync = async () => {
      if (working || document.visibilityState !== "visible") return;
      working = true;
      try {
        const session = await fetch("/api/booking-staff/session", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!session.ok || !(await session.json()).authenticated) return;
        if (Date.now() - brandingAt.current > 300000) {
          const r = await fetch("/api/booking-staff/site", {
            cache: "no-store",
            signal: controller.signal,
          });
          if (r.ok) {
            const data = await r.json();
            if (data.site && !controller.signal.aborted) {
              brandingCallback.current({
                template: data.site.template,
                services: data.site.services,
              });
              brandingAt.current = Date.now();
            }
          }
        }
        let after = "",
          checkpoint = 0;
        const invoices: Invoice[] = [];
        do {
          const r = await fetch(
            `/api/booking-staff/receipts?since=${last.current}&after=${encodeURIComponent(after)}`,
            { cache: "no-store", signal: controller.signal },
          );
          if (!r.ok) return;
          const data = await r.json();
          if (!checkpoint) checkpoint = data.checkpoint;
          invoices.push(...data.receipts);
          after = data.nextId || "";
        } while (after && !controller.signal.aborted);
        if (!controller.signal.aborted) {
          if (invoices.length) callback.current(invoices);
          last.current = checkpoint;
        }
      } catch {
        /* The staff queue shows connection errors; retain the last saved ledger here. */
      } finally {
        working = false;
      }
    };
    void sync();
    const timer = setInterval(() => void sync(), 30000),
      focus = () => void sync();
    addEventListener("focus", focus);
    return () => {
      controller.abort();
      clearInterval(timer);
      removeEventListener("focus", focus);
    };
  }, [enabled, scope]);
}
