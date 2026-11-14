export type PosShortcut =
  | "save"
  | "save-print"
  | "search"
  | "new"
  | "full"
  | "cash"
  | "upi"
  | "card"
  | "bank"
  | "focus-activities"
  | "help"
  | "escape";
export function shortcutModifier(platform: string) {
  return /Mac|iPhone|iPad|iPod/i.test(platform) ? "⌘" : "Ctrl";
}
export function matchPosShortcut(
  event: {
    key: string;
    ctrlKey: boolean;
    metaKey: boolean;
    altKey: boolean;
    repeat?: boolean;
  },
  typing = false,
): PosShortcut | null {
  if (event.key === "Escape") return "escape";
  if (event.repeat) return null;
  const key = event.key.toLowerCase();
  if (event.ctrlKey || event.metaKey) {
    if (key === "p") return "save-print";
    if (key === "s" || key === "enter") return "save";
    if (key === "k") return "search";
    return null;
  }
  if (typing) return null;
  if (event.altKey) {
    return (
      (
        {
          n: "new",
          f: "full",
          "1": "cash",
          "2": "upi",
          "3": "card",
          "4": "bank",
        } as Record<string, PosShortcut>
      )[key] || null
    );
  }
  if (key === "/") return "focus-activities";
  if (key === "?") return "help";
  return null;
}
