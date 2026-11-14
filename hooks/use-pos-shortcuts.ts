"use client";
import { useEffect, useRef, useState } from "react";
import { matchPosShortcut, shortcutModifier } from "@/lib/pos-shortcuts";
import { paymentMethods } from "@/lib/billing-ui";
export type PosShortcutActions = {
  blocked: boolean;
  save: (print: boolean) => void;
  newBill: () => void;
  fullPayment: () => void;
  paymentMethod: (method: string) => void;
  search: () => void;
  focusActivities: () => void;
  help: () => void;
  closeOverlays: () => void;
};
export function usePosShortcuts(actions: PosShortcutActions) {
  const current = useRef(actions);
  current.current = actions;
  const [modifier, setModifier] = useState("Ctrl");
  useEffect(() => {
    setModifier(shortcutModifier(navigator.platform));
    function keyboard(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing = !!target?.closest(
        'input,textarea,select,[contenteditable="true"],[role="textbox"]',
      );
      const action = matchPosShortcut(event, typing);
      if (!action) return;
      if (action === "escape") {
        const popovers =
          document.querySelectorAll<HTMLElement>(":popover-open");
        if (popovers.length) {
          popovers.forEach((popover) => popover.hidePopover());
          event.preventDefault();
        }
        current.current.closeOverlays();
        return;
      }
      if (action === "search") {
        event.preventDefault();
        current.current.search();
        return;
      }
      const blocked =
        current.current.blocked ||
        !!document.querySelector("dialog[open],.overlay,.mobile-open");
      if (blocked) {
        if (action === "save" || action === "save-print")
          event.preventDefault();
        return;
      }
      event.preventDefault();
      switch (action) {
        case "save":
          current.current.save(false);
          break;
        case "save-print":
          current.current.save(true);
          break;
        case "new":
          current.current.newBill();
          break;
        case "full":
          current.current.fullPayment();
          break;
        case "focus-activities":
          current.current.focusActivities();
          break;
        case "help":
          current.current.help();
          break;
        default: {
          const index = ["cash", "upi", "card", "bank"].indexOf(action);
          if (index >= 0) current.current.paymentMethod(paymentMethods[index]);
        }
      }
    }
    document.addEventListener("keydown", keyboard);
    return () => document.removeEventListener("keydown", keyboard);
  }, []);
  return modifier;
}
