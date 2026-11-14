"use client";
import { useMemo, useRef, useState } from "react";
import { pluralize } from "@/lib/presentation";
import { Dialog } from "@/components/ui/dialog";
import { Role, State, money, allowed } from "@/lib/model";
import {
  applySalesImport,
  downloadSalesTemplate,
  errorReport,
  parseSalesFile,
  reviewSalesImport,
} from "@/lib/sales-import";
import { writeWorkbook } from "@/lib/workbook";
export function ImportSales({
  state,
  role,
  onState,
  onClose,
  notify,
}: {
  state: State;
  role: Role;
  onState: (s: State) => void;
  onClose: () => void;
  notify: (s: string) => void;
}) {
  const [step, setStep] = useState(1),
    [raw, setRaw] = useState<Record<string, unknown>[]>([]),
    [file, setFile] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [validOnly, setValidOnly] = useState(false),
    [duplicate, setDuplicate] = useState<"skip" | "overwrite">("skip"),
    [page, setPage] = useState(1);
  const request = useRef(0);
  const groups = useMemo(() => reviewSalesImport(raw, state), [raw, state]);
  const errors = groups.flatMap((g) => g.issues.filter((e) => !e.warning)),
    warnings = groups.flatMap((g) => g.issues.filter((e) => e.warning)),
    valid = groups.filter((g) => !g.issues.some((e) => !e.warning));
  async function confirm() {
    setBusy(true);
    setError("");
    try {
      const next = applySalesImport(state, role, groups, file, duplicate);
      const batch = next.imports[0];
      onState({
        ...next,
        audit: [
          {
            date: new Date().toISOString(),
            user: role,
            action: "Import sales",
            detail: `${file}: ${batch.accepted} imported, ${batch.skipped} skipped, ${batch.failed} failed`,
          },
          ...(next.audit || []),
        ],
      });
      notify(
        `${batch.accepted} invoices imported · ${batch.skipped} skipped · ${batch.failed} failed`,
      );
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      title="Import sales"
      wide
      onClose={() => {
        request.current++;
        onClose();
      }}
    >
      <ol className="import-steps" aria-label="Import steps">
        {["Download template", "Upload", "Review & confirm"].map(
          (label, index) => (
            <li
              key={label}
              aria-current={step === index + 1 ? "step" : undefined}
            >
              {index + 1}. {label}
            </li>
          ),
        )}
      </ol>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {step === 1 && (
        <>
          <p>
            Use the template’s Sales Data sheet. Rows sharing an Invoice Ref
            become one invoice. Prices, GST and commission use the existing
            invoice engine.
          </p>
          <button
            className="btn secondary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await downloadSalesTemplate(state);
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Download template (.xlsx)
          </button>
          <button className="btn" onClick={() => setStep(2)}>
            Continue to upload
          </button>
        </>
      )}
      {step === 2 && (
        <>
          <p>
            Accepts .xlsx or .csv · max 5 MB · max 2,000 rows. Nothing is saved
            until confirmation.
          </p>
          <label>
            Sales spreadsheet
            <input
              type="file"
              accept=".xlsx,.csv"
              disabled={busy}
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const id = ++request.current;
                setBusy(true);
                setError("");
                setRaw([]);
                try {
                  const rows = await parseSalesFile(f);
                  if (id !== request.current) return;
                  setRaw(rows);
                  setFile(f.name);
                  setPage(1);
                  setValidOnly(false);
                  setStep(3);
                } catch (error) {
                  if (id === request.current)
                    setError((error as Error).message);
                } finally {
                  if (id === request.current) setBusy(false);
                }
              }}
            />
          </label>
          <button className="btn secondary" onClick={() => setStep(1)}>
            Back
          </button>
          {busy && <p role="status">Reading spreadsheet…</p>}
        </>
      )}
      {step === 3 && (
        <>
          <h3>{file}</h3>
          <div className="import-counts">
            <span>{pluralize(valid.length, "valid invoice")}</span>
            <span>{warnings.length} warnings</span>
            <span>{errors.length} errors</span>
            <span>{raw.length} activity rows</span>
          </div>
          <label>
            Duplicate invoices
            <select
              value={duplicate}
              onChange={(e) =>
                setDuplicate(e.target.value as "skip" | "overwrite")
              }
            >
              <option value="skip">Skip</option>
              {allowed(state, role, "Sales Management", "edit") && (
                <option value="overwrite">
                  Overwrite (keeps invoice number)
                </option>
              )}
            </select>
          </label>
          <p>
            Any invalid activity rejects its entire invoice. Invoice-level
            values must agree across the group. Overwrite replaces the invoice’s
            lines and payments; the previous snapshot is retained for Undo.
          </p>
          <div
            className="table-wrap import-review"
            tabIndex={0}
            aria-label="Import review table"
          >
            <table>
              <thead>
                <tr>
                  <th>Row</th>
                  {Object.keys(raw[0] || {}).map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {raw.slice((page - 1) * 25, page * 25).map((r, index) => {
                  const row = (page - 1) * 25 + index + 2;
                  const group = groups.find((g) => g.rows.includes(row));
                  return (
                    <tr key={row}>
                      <th>{row}</th>
                      {Object.entries(r).map(([column, value]) => {
                        const issues =
                          group?.issues.filter(
                            (e) => e.row === row && e.column === column,
                          ) || [];
                        return (
                          <td
                            key={column}
                            className={
                              issues.some((e) => !e.warning)
                                ? "import-cell-error"
                                : ""
                            }
                          >
                            {String(value)}
                            {issues.map((e, n) => (
                              <small
                                key={n}
                                className={e.warning ? "muted" : "error"}
                              >
                                {e.message}
                              </small>
                            ))}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="ledger-pagination">
            <button disabled={page === 1} onClick={() => setPage(page - 1)}>
              Previous
            </button>
            <span>
              Page {page} of {Math.ceil(raw.length / 25)}
            </span>
            <button
              disabled={page * 25 >= raw.length}
              onClick={() => setPage(page + 1)}
            >
              Next
            </button>
          </div>
          <details>
            <summary>Invoice totals and all validation messages</summary>
            {groups.map((g) => (
              <p key={g.ref}>
                {g.ref} · {money(g.total)}
                {g.issues.map((e, n) => (
                  <small key={n} className={e.warning ? "muted" : "error"}>
                    Row {e.row} · {e.column}: {e.message}
                  </small>
                ))}
              </p>
            ))}
          </details>
          {(errors.length > 0 || warnings.length > 0) && (
            <button
              className="btn secondary"
              onClick={async () => {
                try {
                  await writeWorkbook(
                    errorReport(raw, groups),
                    "Sales-import-errors",
                  );
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              Download error report
            </button>
          )}
          {errors.length > 0 && (
            <label className="check-label">
              <input
                type="checkbox"
                checked={validOnly}
                onChange={(e) => setValidOnly(e.target.checked)}
              />
              Import valid rows only (whole valid invoices)
            </label>
          )}
          <div className="heading-actions">
            <button
              className="btn secondary"
              disabled={busy}
              onClick={() => {
                setStep(2);
                setRaw([]);
              }}
            >
              Fix file and re-upload
            </button>
            <button
              className="btn"
              disabled={
                busy || !valid.length || (errors.length > 0 && !validOnly)
              }
              onClick={confirm}
            >
              {busy
                ? "Importing…"
                : `Confirm import · ${pluralize(valid.length, "valid invoice")}`}
            </button>
          </div>
        </>
      )}
    </Dialog>
  );
}
