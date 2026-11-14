import { Dialog } from "@/components/ui/dialog";
export function ShortcutsHelp({
  modifier,
  onClose,
}: {
  modifier: string;
  onClose: () => void;
}) {
  const shortcuts = [
    [`${modifier}+P`, "Save & open print preview"],
    [`${modifier}+S`, "Save bill"],
    [`${modifier}+Enter`, "Save bill"],
    [`${modifier}+K`, "Search the workspace"],
    ["/", "Focus adventure search"],
    ["Alt+N", "Start a new bill (confirm unsaved changes)"],
    ["Alt+F", "Mark fully paid"],
    ["Alt+1 / 2 / 3 / 4", "Cash / UPI / Card / Bank Transfer"],
    ["?", "Show shortcuts"],
    ["Esc", "Close a dialog or popover"],
  ];
  return (
    <Dialog title="Billing keyboard shortcuts" onClose={onClose} wide>
      <p>
        Letter shortcuts are paused while typing in a field. {modifier}{" "}
        combinations stay available.
      </p>
      <dl className="pos-shortcut-list">
        {shortcuts.map(([key, description]) => (
          <div key={key}>
            <dt>
              <kbd>{key}</kbd>
            </dt>
            <dd>{description}</dd>
          </div>
        ))}
      </dl>
    </Dialog>
  );
}
