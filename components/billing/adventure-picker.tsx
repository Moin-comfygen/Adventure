"use client";
import { useState, type RefObject } from "react";
import { Check, Plus, Search } from "lucide-react";
import { Line, Service, money } from "@/lib/model";
import { categoryLabel } from "@/lib/service-catalog";
import { ServiceThumbnail } from "@/components/services/service-thumbnail";
export function AdventurePicker({
  services,
  lines,
  onAdd,
  searchRef,
  showImages = true,
}: {
  services: Service[];
  lines: Line[];
  onAdd: (service: Service) => void;
  searchRef: RefObject<HTMLInputElement | null>;
  showImages?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const categories = [
    "All",
    ...Array.from(
      new Set(services.map((service) => categoryLabel(service.category))),
    ),
  ];
  const filtered = services.filter(
    (service) =>
      (category === "All" || categoryLabel(service.category) === category) &&
      `${service.name} ${service.category}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <section className="card pos-picker">
      <div className="card-heading">
        <div>
          <h3>02 · Choose an adventure</h3>
          <p>Select an activity. Tap it again to add one participant.</p>
        </div>
        <span className="subtle-tag">Prices per person</span>
      </div>
      <div className="search-box">
        <Search size={17} />
        <input
          ref={searchRef}
          aria-label="Search activities"
          placeholder="Search activities…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <kbd aria-hidden="true">/</kbd>
      </div>
      <div
        className="category-filters"
        role="group"
        aria-label="Adventure categories"
      >
        {categories.map((label) => (
          <button
            type="button"
            key={label}
            aria-pressed={category === label}
            className={category === label ? "selected" : ""}
            onClick={() => setCategory(label)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="service-grid adventure-grid">
        {filtered.map((service) => {
          const qty = lines
            .filter((line) => line.serviceId === service.id)
            .reduce((sum, line) => sum + line.qty, 0);

          return (
            <button
              type="button"
              className={`adventure-option ${qty ? "is-selected" : ""} ${showImages ? "" : "images-hidden"}`}
              key={service.id}
              aria-pressed={qty > 0}
              aria-label={`${service.name}, ${money(service.price)} per person, ${service.gst}% GST${qty ? `, ${qty} selected` : ""}`}
              onClick={() => onAdd(service)}
            >
              {showImages ? (
                <span className="adventure-media">
                  <ServiceThumbnail service={service} size={64} />
                  {qty > 0 && (
                    <span className="selection-quantity" aria-hidden="true">
                      <Check size={12} />
                      {qty}
                    </span>
                  )}
                </span>
              ) : qty > 0 ? (
                <span
                  className="selection-quantity text-selection"
                  aria-hidden="true"
                >
                  <Check size={12} />
                  {qty}
                </span>
              ) : null}
              {!qty && <Plus size={16} className="service-plus" />}
              <b>{service.name}</b>
              <small>{service.category}</small>
              <strong>{money(service.price)}</strong>
              <span className="service-tax">+ {service.gst}% GST</span>
            </button>
          );
        })}
      </div>
      {!filtered.length && (
        <div className="empty">
          No activities match this search. Try another category or search term.
        </div>
      )}
    </section>
  );
}
