"use client";
import { useEffect, useRef, useState } from "react";
import { billingDraftSchema, type BillingDraft } from "@/lib/billing-ui";
export function useBillingDraft({
  storageKey,
  value,
  dirty,
  restore,
  notify,
}: {
  storageKey: string;
  value: BillingDraft;
  dirty: boolean;
  restore: (draft: BillingDraft) => void;
  notify: (message: string) => void;
}) {
  const latest = useRef({ value, dirty, restore, notify });
  latest.current = { value, dirty, restore, notify };
  const [ready, setReady] = useState(false);
  const [restored, setRestored] = useState(false);
  const [savedAt, setSavedAt] = useState("");
  const [error, setError] = useState("");
  const serialized = JSON.stringify(value);
  function persist() {
    if (!latest.current.dirty) return;
    try {
      const date = new Date().toISOString();
      localStorage.setItem(
        storageKey,
        JSON.stringify({ ...latest.current.value, updatedAt: date }),
      );
      return date;
    } catch {
      return null;
    }
  }
  useEffect(() => {
    setReady(false);
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const draft = billingDraftSchema.parse(JSON.parse(saved));
        latest.current.restore(draft);
        setRestored(true);
        setSavedAt(draft.updatedAt || "");
      }
    } catch {
      setError(
        "This draft could not be restored. Discard it to start a new bill.",
      );
    }
    setReady(true);
    function beforeUnload(event: BeforeUnloadEvent) {
      if (!latest.current.dirty) return;
      persist();
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      persist();
      window.removeEventListener("beforeunload", beforeUnload);
    };
  }, [storageKey]);
  useEffect(() => {
    if (!ready) return;
    if (!dirty) {
      if (!error) {
        try {
          localStorage.removeItem(storageKey);
        } catch {
          setError("Browser storage is unavailable. Draft saving is disabled.");
        }
      }
      setSavedAt("");
      return;
    }
    const timer = setTimeout(() => {
      const result = persist();
      if (result) {
        setSavedAt(result);
        setError("");
      } else {
        setError(
          "Draft could not be saved. Keep this tab open or finish the bill.",
        );
        latest.current.notify(
          "Browser storage is unavailable. Your draft is not saved.",
        );
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [serialized, dirty, ready, storageKey]);
  function clear() {
    try {
      localStorage.removeItem(storageKey);
    } catch {
      setError("The draft could not be removed from browser storage.");
      return;
    }
    setRestored(false);
    setSavedAt("");
    setError("");
  }
  return { ready, restored, savedAt, error, clear };
}
