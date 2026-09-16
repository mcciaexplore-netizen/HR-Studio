const { parentPort, workerData } = require("node:worker_threads");
const ExcelJS = require("exceljs");
(async () => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(workerData));
  const sheet = workbook.worksheets[0];
  if (
    !sheet ||
    workbook.worksheets.length !== 1 ||
    sheet.rowCount > 501 ||
    sheet.columnCount > 60
  )
    throw new Error("Use one sheet with at most 500 employees and 60 columns.");
  const rows = [];
  sheet.eachRow({ includeEmpty: true }, (row) => {
    const values = [];
    for (let col = 1; col <= sheet.columnCount; col++) {
      const cell = row.getCell(col),
        value = cell.value;
      if (
        value &&
        typeof value === "object" &&
        ("formula" in value || "sharedFormula" in value || "hyperlink" in value)
      )
        throw new Error(
          "Formulas and linked cells are not supported. Paste values before importing.",
        );
      const normalized =
        value instanceof Date
          ? value.toISOString().slice(0, 10)
          : value === null
            ? ""
            : typeof value === "object"
              ? cell.text
              : String(value);
      if (normalized.length > 2000)
        throw new Error("A cell exceeds 2,000 characters.");
      values.push(normalized);
    }
    rows.push(values);
  });
  parentPort.postMessage({ rows });
})().catch((error) => parentPort.postMessage({ error: error.message }));
