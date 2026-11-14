"use client";
import { useEffect, useId, useState } from "react";
import { Search, ArrowUpRight } from "lucide-react";
import { Dialog } from "../ui/dialog";
export type CommandItem = {
  id: string;
  label: string;
  detail: string;
  group: string;
  onSelect: () => void;
};
export function CommandPalette({
  items,
  onClose,
}: {
  items: CommandItem[];
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const id = useId();
  const results = items
    .filter((item) =>
      `${item.label} ${item.detail} ${item.group}`
        .toLowerCase()
        .includes(query.toLowerCase()),
    )
    .slice(0, 12);
  useEffect(() => {
    document
      .getElementById(`${id}-${active}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [id, active, query]);
  function choose(item: CommandItem) {
    onClose();
    item.onSelect();
  }
  return (
    <Dialog title="Search workspace" onClose={onClose} wide>
      <div className="command-input">
        <Search size={20} />
        <input
          autoFocus
          role="combobox"
          aria-label="Search invoices, customers, agents and pages"
          aria-expanded={true}
          aria-controls={id}
          aria-autocomplete="list"
          aria-activedescendant={results.length ? `${id}-${active}` : undefined}
          placeholder="Search invoices, people, or pages…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive(results.length ? (active + 1) % results.length : 0);
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive(
                results.length
                  ? (active - 1 + results.length) % results.length
                  : 0,
              );
            }
            if (e.key === "Enter" && results[active]) {
              e.preventDefault();
              choose(results[active]);
            }
          }}
        />
        <kbd>esc</kbd>
      </div>
      <div
        className="command-results"
        id={id}
        role="listbox"
        aria-label="Search results"
      >
        {results.map((item, index) => (
          <button
            key={item.id}
            id={`${id}-${index}`}
            role="option"
            aria-selected={active === index}
            onClick={() => choose(item)}
            className={active === index ? "command-active" : ""}
            onMouseEnter={() => setActive(index)}
          >
            <span>
              <small>{item.group}</small>
              <strong>{item.label}</strong>
              <span>{item.detail}</span>
            </span>
            <ArrowUpRight size={18} />
          </button>
        ))}
        {!results.length && (
          <div className="empty">No matching invoices, people or pages.</div>
        )}
      </div>
      <div className="command-hint">
        <span>↑ ↓ Navigate</span>
        <span>Enter Open</span>
        <span>Esc Close</span>
      </div>
    </Dialog>
  );
}
