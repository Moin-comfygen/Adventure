"use client";
import { useEffect, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Check,
  Clock3,
  FileText,
  Printer,
  MessageCircle,
  Keyboard,
  Plus,
  X,
} from "lucide-react";
import {
  State,
  Role,
  Line,
  Invoice,
  Customer,
  Service,
  allowed,
  calculate,
  money,
  round,
  paid,
  type createInvoice,
} from "@/lib/model";
import {
  customerSchema,
  emptyCustomer,
  mobileDigits,
  activityToday,
  resolvedPayments,
  paymentError,
  type PaymentMode,
  type CustomerFields,
  type BillingDraft,
} from "@/lib/billing-ui";
import { CustomerDetails } from "./customer-details";
import { AdventurePicker } from "./adventure-picker";
import { BookingRows } from "./booking-rows";
import { PaymentSection } from "./payment-section";
import { useBillingDraft } from "@/hooks/use-billing-draft";
import { validActivityDate } from "./date-field";
import { SaveActions } from "./save-actions";
import { usePosShortcuts } from "@/hooks/use-pos-shortcuts";
import { ShortcutsHelp } from "./shortcuts-help";
import { ServiceThumbnail } from "@/components/services/service-thumbnail";
export type BillingInput = Parameters<typeof createInvoice>[2];
export type BillingProps = {
  state: State;
  role: Role;
  onSave: (input: BillingInput, print: boolean) => Invoice;
  onNotify: (message: string) => void;
  customerRequest: Customer | null;
  onCustomerConsumed: () => void;
  onDirtyChange: (dirty: boolean) => void;
  onPreview: (invoice: Invoice) => void;
  onGlobalSearch: () => void;
  blocked: boolean;
};
export function BillingPos({
  state,
  role,
  onSave,
  onNotify,
  customerRequest,
  onCustomerConsumed,
  onDirtyChange,
  onPreview,
  onGlobalSearch,
  blocked,
}: BillingProps) {
  const [showServiceImages, setShowServiceImages] = useState(() => {
    try {
      return (
        typeof window === "undefined" ||
        localStorage.getItem("adventure-show-service-images") !== "false"
      );
    } catch {
      return true;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(
        "adventure-show-service-images",
        String(showServiceImages),
      );
    } catch {
      /* Keep the preference for this session when storage is unavailable. */
    }
  }, [showServiceImages]);
  const [shortcutHelp, setShortcutHelp] = useState(false);
  const [lastSaved, setLastSaved] = useState<Invoice | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [persons, setPersons] = useState(1);
  const [moreOpen, setMoreOpen] = useState(false);
  const adventureSearchRef = useRef<HTMLInputElement>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [discountValue, setDiscountValue] = useState(0);
  const [discountType, setDiscountType] = useState<"amount" | "percent">(
    "amount",
  );
  const [charges, setCharges] = useState(0);
  const [agentId, setAgentId] = useState("");
  const [interstate, setInterstate] = useState(false);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("full");
  const [paymentRows, setPaymentRows] = useState([
    { method: "UPI", amount: 0 },
  ]);
  const customerLookupRef = useRef("");
  const form = useForm<CustomerFields>({
    resolver: zodResolver(customerSchema),
    defaultValues: emptyCustomer,
    mode: "onTouched",
  });
  const customerValues = useWatch({ control: form.control }) as CustomerFields;
  const phone = customerValues.phone || "";
  const returningCustomer =
    phone.length === 10
      ? state.customers.find(
          (customer) => mobileDigits(customer.phone) === phone,
        )
      : undefined;
  useEffect(() => {
    if (phone === customerLookupRef.current) return;
    customerLookupRef.current = phone;
    if (!returningCustomer) return;
    for (const key of ["name", "email", "notes", "gstin", "address"] as const)
      form.setValue(key, returningCustomer[key] || "", {
        shouldValidate: false,
      });
  }, [phone, returningCustomer, form]);
  useEffect(() => {
    if (!customerRequest) return;
    customerLookupRef.current = mobileDigits(customerRequest.phone);
    form.reset({
      ...emptyCustomer,
      ...customerRequest,
      phone: mobileDigits(customerRequest.phone),
    });
    onCustomerConsumed();
  }, [customerRequest, onCustomerConsumed, form]);
  const today = activityToday;
  const can = (action: "create" | "edit" | "print" = "create") =>
    allowed(state, role, "Billing POS", action);
  const serviceSubtotal = round(
    lines.reduce((sum, line) => sum + line.price * line.qty, 0),
  );
  const discount =
    discountType === "percent"
      ? round((serviceSubtotal * discountValue) / 100)
      : discountValue;
  let calculationIssue = "";
  const billTotals = (() => {
    try {
      return calculate(
        lines,
        discount,
        charges,
        state.agents.find((agent) => agent.id === agentId),
      );
    } catch (error) {
      calculationIssue =
        error instanceof Error ? error.message : "Check the booking amounts.";
      return {
        subtotal: 0,
        base: 0,
        tax: 0,
        total: 0,
        commission: 0,
        taxes: [],
      };
    }
  })();
  function addActivity(service: Service) {
    setLines((current) => {
      const index = current.findIndex((line) => line.serviceId === service.id);
      return index >= 0
        ? current.map((line, i) =>
            i === index ? { ...line, qty: line.qty + 1 } : line,
          )
        : [
            ...current,
            {
              serviceId: service.id,
              name: service.name,
              price: service.price,
              gst: service.gst,
              qty: persons,
              date: today(),
              slot: "",
            },
          ];
    });
  }
  const dirty =
    lines.length > 0 ||
    Object.values(customerValues).some((value) => String(value || "").trim()) ||
    persons !== 1 ||
    discountValue !== 0 ||
    charges !== 0 ||
    !!agentId ||
    interstate ||
    paymentMode !== "full" ||
    paymentRows.length > 1 ||
    paymentRows[0]?.method !== "UPI";
  const snapshot: BillingDraft = {
    version: 1,
    customer: { ...emptyCustomer, ...customerValues },
    persons,
    lines,
    discountValue,
    discountType,
    charges,
    agentId,
    interstate,
    paymentMode,
    paymentRows: paymentRows.map((row) => ({
      ...row,
      method: row.method as BillingDraft["paymentRows"][number]["method"],
    })),
  };
  const draftState = useBillingDraft({
    storageKey: `adventure-pos-draft-v1:${role}`,
    value: snapshot,
    dirty: !!dirty,
    notify: onNotify,
    restore: (draft) => {
      customerLookupRef.current = draft.customer.phone;
      form.reset(draft.customer);
      setPersons(draft.persons);
      setLines(
        draft.lines.map((line) => {
          const catalog = state.services.find(
            (service) => service.id === line.serviceId,
          );
          return !can("edit") && catalog
            ? { ...line, price: catalog.price }
            : line;
        }),
      );
      setDiscountValue(draft.discountValue);
      setDiscountType(draft.discountType);
      setCharges(draft.charges);
      setAgentId(draft.agentId);
      setInterstate(draft.interstate);
      setPaymentMode(draft.paymentMode);
      setPaymentRows(draft.paymentRows);
    },
  });
  useEffect(() => {
    if (draftState.ready && !blocked) form.setFocus("phone");
  }, [draftState.ready]);
  useEffect(() => {
    onDirtyChange(!!dirty);
    return () => onDirtyChange(false);
  }, [dirty, onDirtyChange]);
  const customerCheck = customerSchema.safeParse(customerValues);
  const reason = !draftState.ready
    ? "Restoring the bill…"
    : !can()
      ? "Your role cannot create invoices."
      : !/^\d{10}$/.test(phone)
        ? "Enter a 10-digit mobile number."
        : !customerValues.name?.trim()
          ? "Enter the customer’s name."
          : !lines.length
            ? "Choose at least one activity."
            : !customerCheck.success
              ? "Check the customer information in More details."
              : lines.some((line) => !validActivityDate(line.date))
                ? "Enter valid activity dates as DD/MM/YYYY."
                : lines.some(
                      (line) =>
                        line.slot &&
                        !/^([01]\d|2[0-3]):[0-5]\d$/.test(line.slot),
                    )
                  ? "Choose a valid time slot."
                  : discountType === "percent" &&
                      (discountValue < 0 || discountValue > 100)
                    ? "Discount percentage must be between 0 and 100."
                    : calculationIssue ||
                      (agentId &&
                      !state.agents.some(
                        (agent) => agent.id === agentId && agent.active,
                      )
                        ? "Select an existing active agent or clear the referral field."
                        : "") ||
                      paymentError(paymentMode, paymentRows, billTotals.total);
  function resetBill() {
    setLines([]);
    setDiscountValue(0);
    setDiscountType("amount");
    setCharges(0);
    setAgentId("");
    setPersons(1);
    setInterstate(false);
    setPaymentMode("full");
    setPaymentRows([{ method: "UPI", amount: 0 }]);
    form.reset(emptyCustomer);
    setMoreOpen(false);
    draftState.clear();
  }
  function newBill() {
    if (
      dirty &&
      !window.confirm(
        "Discard this unsaved bill and start a new one? Your saved invoices will remain.",
      )
    )
      return;
    resetBill();
    setLastSaved(null);
    requestAnimationFrame(() => form.setFocus("phone"));
  }
  function saveBill(print = false) {
    if (savingRef.current) return;
    if (reason) return onNotify(reason);
    if (print && !can("print"))
      return onNotify("Your role cannot print invoices.");
    savingRef.current = true;
    setSaving(true);
    form.handleSubmit(
      (customer) => {
        try {
          if (
            !can("edit") &&
            lines.some(
              (line) =>
                line.price !==
                state.services.find((service) => service.id === line.serviceId)
                  ?.price,
            )
          )
            throw Error("Your role cannot change activity prices.");
          const invoice = onSave(
            {
              customer: {
                ...customer,
                phone: returningCustomer?.phone || customer.phone,
                id: returningCustomer?.id || "",
              },
              lines,
              discount,
              charges,
              agentId,
              interstate,
              payments: resolvedPayments(
                paymentMode,
                paymentRows,
                billTotals.total,
              )
                .filter((row) => row.amount > 0)
                .map((row) => ({ ...row, date: new Date().toISOString() })),
            },
            print,
          );
          resetBill();
          setLastSaved(invoice);
          if (!print) requestAnimationFrame(() => form.setFocus("phone"));
        } catch (error) {
          onNotify(
            error instanceof Error
              ? error.message
              : "Unable to save this invoice.",
          );
        } finally {
          savingRef.current = false;
          setSaving(false);
        }
      },
      () => {
        setMoreOpen(true);
        onNotify("Check the customer information before saving.");
        savingRef.current = false;
        setSaving(false);
      },
    )();
  }
  const modifier = usePosShortcuts({
    blocked,
    save: saveBill,
    newBill,
    fullPayment: () => {
      setPaymentMode("full");
      setPaymentRows([{ method: paymentRows[0]?.method || "UPI", amount: 0 }]);
    },
    paymentMethod: (method) =>
      setPaymentRows((rows) =>
        rows.map((row, index) => (index === 0 ? { ...row, method } : row)),
      ),
    search: () => {
      setShortcutHelp(false);
      onGlobalSearch();
    },
    focusActivities: () => adventureSearchRef.current?.focus(),
    help: () => setShortcutHelp(true),
    closeOverlays: () => setShortcutHelp(false),
  });
  return (
    <div className="pos-workspace">
      <div className="pos-draft-toolbar">
        <span aria-live="polite">
          <Clock3 size={14} />
          {draftState.error ||
            (draftState.restored
              ? "Draft restored from this browser"
              : draftState.savedAt
                ? "Draft saved in this browser"
                : "New bill · draft saves automatically")}
        </span>
        <div className="heading-actions">
          <label className="service-images-toggle">
            <input
              type="checkbox"
              checked={showServiceImages}
              onChange={(event) => setShowServiceImages(event.target.checked)}
            />{" "}
            Show service images
          </label>
          <button
            className="link"
            type="button"
            onClick={() => setShortcutHelp(true)}
          >
            <Keyboard size={15} /> Shortcuts
          </button>
          <button
            type="button"
            className="link"
            onClick={newBill}
            disabled={!dirty && !draftState.error && !draftState.restored}
          >
            <X size={14} /> Discard draft
          </button>
          <button
            type="button"
            className="btn secondary small-button"
            onClick={newBill}
          >
            <Plus size={14} /> New bill
          </button>
        </div>
      </div>
      <div className="pos-grid">
        <div>
          <CustomerDetails
            form={form}
            persons={persons}
            onPersons={setPersons}
            returning={!!returningCustomer}
            moreOpen={moreOpen}
            onMoreOpen={setMoreOpen}
          />
          <AdventurePicker
            services={state.services}
            showImages={showServiceImages}
            lines={lines}
            searchRef={adventureSearchRef}
            onAdd={addActivity}
          />
          <BookingRows
            services={state.services}
            showImages={showServiceImages}
            lines={lines}
            onLines={setLines}
            canEditPrices={can("edit")}
            onNotify={onNotify}
          />
        </div>
        <aside className="pos-summary card" aria-label="Booking summary">
          <div className="pos-summary-heading">
            <h3>
              <FileText size={18} /> Booking summary
            </h3>
            <div>
              <span>Grand total</span>
              <output aria-live="polite">{money(billTotals.total)}</output>
            </div>
          </div>
          <div className="pos-summary-scroll">
            {lines.length > 0 && (
              <ul
                className="pos-summary-activities"
                aria-label="Selected activities"
              >
                {lines.map((line, index) => (
                  <li key={`${line.serviceId}-${index}`}>
                    {showServiceImages && (
                      <ServiceThumbnail
                        service={
                          state.services.find(
                            (service) => service.id === line.serviceId,
                          ) || { name: line.name, category: "" }
                        }
                        size={36}
                      />
                    )}
                    <div>
                      <b>{line.name}</b>
                      <small>
                        {line.qty} × {money(line.price)}
                      </small>
                    </div>
                    <strong>{money(line.qty * line.price)}</strong>
                  </li>
                ))}
              </ul>
            )}

            <label>
              Referral agent
              <input
                list="agent-list"
                placeholder="Search existing agents"
                value={
                  state.agents.find((a) => a.id === agentId)?.name || agentId
                }
                onChange={(e) =>
                  setAgentId(
                    state.agents.find((a) => a.name === e.target.value)?.id ||
                      e.target.value,
                  )
                }
              />
              <datalist id="agent-list">
                <option value="" />
                {state.agents
                  .filter((a) => a.active)
                  .map((a) => (
                    <option key={a.id} value={a.name} />
                  ))}
              </datalist>
            </label>
            <details className="pos-adjustments">
              <summary>
                Adjustments <span>Discount, charges & tax treatment</span>
              </summary>
              <label>
                Discount
                <div className="discount-control">
                  <input
                    aria-label={
                      discountType === "amount"
                        ? "Discount (₹)"
                        : "Discount (%)"
                    }
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    max={discountType === "percent" ? 100 : serviceSubtotal}
                    value={discountValue}
                    onChange={(e) => setDiscountValue(Number(e.target.value))}
                  />
                  <div role="group" aria-label="Discount type">
                    <button
                      type="button"
                      aria-pressed={discountType === "amount"}
                      onClick={() => {
                        setDiscountType("amount");
                        setDiscountValue(0);
                      }}
                    >
                      ₹
                    </button>
                    <button
                      type="button"
                      aria-pressed={discountType === "percent"}
                      onClick={() => {
                        setDiscountType("percent");
                        setDiscountValue(0);
                      }}
                    >
                      %
                    </button>
                  </div>
                </div>
              </label>
              <label>
                Additional non-taxable charges (₹)
                <input
                  type="number"
                  min="0"
                  inputMode="decimal"
                  step="0.01"
                  value={charges}
                  onChange={(e) => setCharges(Number(e.target.value))}
                />
              </label>
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={interstate}
                  onChange={(e) => setInterstate(e.target.checked)}
                />{" "}
                Interstate supply (IGST)
              </label>
            </details>
            <div className="summary-lines">
              <div>
                Service subtotal <b>{money(billTotals.subtotal)}</b>
              </div>
              <div>
                Discount <b>− {money(discount)}</b>
              </div>
              <div>
                {interstate ? "IGST" : "CGST + SGST"}{" "}
                <b>{money(billTotals.tax)}</b>
              </div>
              <div>
                Additional charges <b>{money(charges)}</b>
              </div>
            </div>
            {allowed(state, role, "Agents & Commissions") && agentId && (
              <div className="info-note">
                Agent commission: {money(billTotals.commission)}
                <br />
                Calculated on discounted services, excluding GST.
              </div>
            )}
            <PaymentSection
              total={billTotals.total}
              mode={paymentMode}
              onMode={setPaymentMode}
              rows={paymentRows}
              onRows={setPaymentRows}
            />
            <small className="muted">
              GST is configured per service. Additional charges are non-taxable.
            </small>
          </div>
          <SaveActions
            total={billTotals.total}
            reason={reason}
            saving={saving}
            onSave={saveBill}
            canPrint={can("print")}
            modifier={modifier}
          />
        </aside>
      </div>
      {shortcutHelp && (
        <ShortcutsHelp
          modifier={modifier}
          onClose={() => setShortcutHelp(false)}
        />
      )}
      {lastSaved && (
        <section
          className="pos-success-toast"
          role="status"
          aria-label="Invoice saved"
        >
          <div className="spread">
            <strong>
              <Check size={17} /> {lastSaved.id} saved successfully
            </strong>
            <button
              type="button"
              className="icon-button"
              aria-label="Dismiss invoice success"
              onClick={() => setLastSaved(null)}
            >
              <X size={16} />
            </button>
          </div>
          <p>
            {lastSaved.customer.name} · {money(lastSaved.total)}
          </p>
          <div className="heading-actions">
            {can("print") && (
              <button
                type="button"
                className="btn secondary"
                onClick={() => onPreview(lastSaved)}
              >
                <Printer size={15} /> Print
              </button>
            )}
            <a
              className="btn secondary"
              target="_blank"
              rel="noopener noreferrer"
              href={`https://wa.me/91${mobileDigits(lastSaved.customer.phone)}?text=${encodeURIComponent(`${state.business.name} — Invoice ${lastSaved.id}: Total ${money(lastSaved.total)}, paid ${money(paid(lastSaved))}, balance ${money(lastSaved.total - paid(lastSaved))}. Thank you for booking with us!`)}`}
            >
              <MessageCircle size={15} /> WhatsApp
            </a>
            <button type="button" className="btn" onClick={newBill}>
              <Plus size={15} /> New bill
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
