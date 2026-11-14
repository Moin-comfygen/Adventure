import { Invoice, paid, round } from "./model";
export function pluralize(
  count: number,
  singular: string,
  plural = `${singular}s`,
) {
  return `${count} ${count === 1 ? singular : plural}`;
}
export function initials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "?"
  );
}
export function compactMoney(value: number) {
  const absolute = Math.abs(value);
  const [divisor, suffix] =
    absolute >= 10000000
      ? [10000000, "Cr"]
      : absolute >= 100000
        ? [100000, "L"]
        : absolute >= 1000
          ? [1000, "k"]
          : [1, ""];
  return `₹${new Intl.NumberFormat("en-IN", { maximumFractionDigits: divisor === 1 ? 0 : 1 }).format(value / divisor)}${suffix}`;
}
export function indianDate(value: string) {
  return new Date(value.slice(0, 10) + "T12:00:00").toLocaleDateString(
    "en-IN",
    { day: "numeric", month: "short", year: "numeric" },
  );
}
export function displayDate(value: string) {
  return value ? value.slice(0, 10).split("-").reverse().join("/") : "";
}
export function parseDisplayDate(value: string) {
  if (!value) return "";
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const iso = `${match[3]}-${match[2]}-${match[1]}`;
  const date = new Date(iso + "T12:00:00Z");
  return !isNaN(date.getTime()) && date.toISOString().slice(0, 10) === iso
    ? iso
    : null;
}
export function invoiceStatus(
  invoice: Invoice & { dueDate?: string },
  today = new Date().toISOString().slice(0, 10),
) {
  const collected = paid(invoice);
  const due = Math.max(0, round(invoice.total - collected));
  if (invoice.status !== "Active")
    return { label: invoice.status, tone: "red", due: 0 };
  if (collected > 0 && collected >= invoice.total)
    return { label: "Paid", tone: "green", due: 0 };
  if (due > 0 && invoice.dueDate && invoice.dueDate.slice(0, 10) < today)
    return { label: "Overdue", tone: "overdue", due };
  return {
    label: collected === 0 ? "Unpaid" : "Partial",
    tone: collected === 0 ? "red" : "amber",
    due,
  };
}
export function avatarStyle(name: string) {
  const palette = [
    ["#e3f4f0", "#145c50"],
    ["#e9eefb", "#304e89"],
    ["#fff2d8", "#805109"],
    ["#f2eafd", "#65438c"],
  ];
  const index =
    Array.from(name).reduce((sum, char) => sum + char.charCodeAt(0), 0) %
    palette.length;
  return { background: palette[index][0], color: palette[index][1] };
}
export const showDemoLabels =
  process.env.NODE_ENV === "development" ||
  process.env.NEXT_PUBLIC_DEMO_MODE === "true";
