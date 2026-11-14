import ExcelJS from "exceljs";
export async function writeWorkbook(
  rows: Record<string, unknown>[],
  name: string,
) {
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet("Data");
  const keys = Object.keys(rows[0] || { Result: "" });
  sheet.addRow(keys);
  for (const row of rows)
    sheet.addRow(keys.map((k) => row[k] as string | number));
  sheet.getRow(1).font = { bold: true };
  sheet.columns.forEach((c) => (c.width = 24));
  const buffer = await book.xlsx.writeBuffer();
  const url = URL.createObjectURL(
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `${name}.xlsx`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function readWorkbook(
  buffer: ArrayBuffer,
  fileName: string,
): Promise<Record<string, unknown>[]> {
  const rows: unknown[][] = [];
  if (fileName.toLowerCase().endsWith(".csv")) {
    const text = new TextDecoder().decode(buffer).replace(/^\uFEFF/, "");
    let row: string[] = [],
      cell = "",
      quote = false;
    for (let n = 0; n < text.length; n++) {
      const char = text[n];
      if (char === '"') {
        if (quote && text[n + 1] === '"') {
          cell += '"';
          n++;
        } else quote = !quote;
      } else if (char === "," && !quote) {
        row.push(cell);
        cell = "";
      } else if ((char === "\n" || char === "\r") && !quote) {
        if (char === "\r" && text[n + 1] === "\n") n++;
        row.push(cell);
        if (row.some(Boolean)) rows.push(row);
        row = [];
        cell = "";
      } else cell += char;
    }
    if (cell || row.length) {
      row.push(cell);
      rows.push(row);
    }
    if (quote) throw Error("Unclosed CSV quote");
  } else {
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(buffer);
    const sheet = book.worksheets[0];
    if (!sheet) throw Error("No worksheet");
    sheet.eachRow((row) => {
      const cells: unknown[] = [];
      for (let n = 1; n <= sheet.columnCount; n++) {
        const value = row.getCell(n).value;
        cells.push(
          value instanceof Date
            ? value.toISOString().slice(0, 10)
            : value && typeof value === "object" && "text" in value
              ? value.text
              : (value ?? ""),
        );
      }
      rows.push(cells);
    });
  }
  const headers = (rows.shift() || []).map(String);
  if (new Set(headers).size !== headers.length)
    throw Error("Duplicate column headers");
  return rows.map((row) =>
    Object.fromEntries(headers.map((h, i) => [h, row[i] ?? ""])),
  );
}
