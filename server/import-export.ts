import ExcelJS from "exceljs";
import { Worker } from "node:worker_threads";
import { resolve } from "node:path";
import { Store, HttpError, type Actor } from "./store";
import { validateRecord, text } from "./validation";
import { config } from "./suite-domain";

export const employeeColumns = [
  "name",
  "email",
  "role",
  "department",
  "contact",
  "hireDate",
  "status",
  "basic",
  "hra",
  "allowances",
  "deductions",
  "branchCode",
  "workerType",
  "costCentre",
  "managerEmail",
  "payBasis",
  "payRate",
  "probationEnd",
  "endDate",
];
export function parseCSV(source: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false,
    closed = false;
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (quoted) {
      if (char === '"') {
        if (source[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else cell += char;
    } else if (char === '"') {
      if (cell || closed) throw new HttpError(400, "Invalid CSV quoting.");
      quoted = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
      closed = false;
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && source[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      cell = "";
      closed = false;
    } else {
      if (closed && !/\s/.test(char))
        throw new HttpError(400, "Unexpected text after a quoted CSV cell.");
      if (!closed) cell += char;
    }
    if (rows.length > 501 || row.length > 60 || cell.length > 2000)
      throw new HttpError(
        400,
        "Import exceeds 500 rows, 60 columns or 2,000 characters per cell.",
      );
  }
  if (quoted) throw new HttpError(400, "CSV contains an unclosed quoted cell.");
  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}
let excelBusy = false;
async function readExcel(buffer: Buffer): Promise<string[][]> {
  if (excelBusy)
    throw new HttpError(
      429,
      "Another workbook is being checked. Please try again shortly.",
    );
  excelBusy = true;
  try {
    return await new Promise((resolveRows, reject) => {
      const worker = new Worker(
        resolve(
          process.env.NODE_ENV === "production"
            ? "dist/excel-worker.cjs"
            : "server/excel-worker.cjs",
        ),
        {
          workerData: buffer,
          resourceLimits: { maxOldGenerationSizeMb: 96, stackSizeMb: 4 },
        },
      );
      const timer = setTimeout(() => {
        void worker.terminate();
        reject(
          new HttpError(
            400,
            "Workbook took too long to read. Use a smaller values-only file.",
          ),
        );
      }, 10000);
      worker.once("message", (result) => {
        clearTimeout(timer);
        void worker.terminate();
        result.error
          ? reject(new HttpError(400, result.error))
          : resolveRows(result.rows);
      });
      worker.once("error", () => {
        clearTimeout(timer);
        reject(
          new HttpError(
            400,
            "Workbook could not be read within the import limits.",
          ),
        );
      });
      worker.once("exit", (code) => {
        clearTimeout(timer);
        if (code !== 0)
          reject(new HttpError(400, "Workbook import was stopped."));
      });
    });
  } finally {
    excelBusy = false;
  }
}
function employeeRow(store: Store, actor: Actor, row: Record<string, string>) {
  const employees = store.list(actor.orgId, "employees"),
    branches = store.list(actor.orgId, "branches");
  const branch = row.branchCode
    ? branches.find(
        (branch) =>
          branch.code.toLowerCase() === row.branchCode.trim().toLowerCase(),
      )
    : null;
  const manager = row.managerEmail
    ? employees.find(
        (emp) => emp.email.toLowerCase() === row.managerEmail.toLowerCase(),
      )
    : null;
  if (row.branchCode && !branch)
    throw new HttpError(
      400,
      "Branch code does not exist. Create the branch first.",
    );
  if (row.managerEmail && !manager)
    throw new HttpError(
      400,
      "Manager email does not exist. Import managers first.",
    );
  const customFields = Object.fromEntries(
    config(store, actor.orgId)
      .customFields.filter(
        (field: any) => row[`custom.${field.key}`] !== undefined,
      )
      .map((field: any) => [
        field.key,
        field.type === "number" && row[`custom.${field.key}`].trim() !== ""
          ? Number(row[`custom.${field.key}`])
          : row[`custom.${field.key}`],
      ]),
  );
  return validateRecord(store, actor, "employees", {
    ...row,
    avatar: "",
    branchId: branch?.id,
    managerId: manager?.id,
    customFields,
    payRate: Number(row.payRate || 0),
    salary: Object.fromEntries(
      ["basic", "hra", "allowances", "deductions"].map((key) => [
        key,
        Number(row[key] || 0),
      ]),
    ),
  });
}
export async function previewImport(store: Store, actor: Actor, body: any) {
  const filename = text(body.name, "Filename", 200),
    encoded = text(body.contentBase64, "File", 1500000),
    buffer = Buffer.from(encoded, "base64");
  if (
    !buffer.length ||
    buffer.length > 1024 * 1024 ||
    buffer.toString("base64") !== encoded
  )
    throw new HttpError(400, "Choose a CSV or XLSX file up to 1 MB.");
  const rows = filename.toLowerCase().endsWith(".xlsx")
    ? await readExcel(buffer)
    : filename.toLowerCase().endsWith(".csv")
      ? parseCSV(buffer.toString("utf8").replace(/^\uFEFF/, ""))
      : null;
  if (!rows || rows.length < 2 || rows.length > 501)
    throw new HttpError(
      400,
      "Provide a CSV or XLSX file with 1–500 employee rows.",
    );
  const headers = rows[0].map((value) => value.trim()),
    allowed = [
      ...employeeColumns,
      ...config(store, actor.orgId).customFields.map(
        (field: any) => `custom.${field.key}`,
      ),
    ];
  if (
    new Set(headers).size !== headers.length ||
    headers.some((header) => !allowed.includes(header))
  )
    throw new HttpError(
      400,
      "Column headers must be unique and match the downloadable template.",
    );
  const seen = new Set(
    store.list(actor.orgId, "employees").map((emp) => emp.email.toLowerCase()),
  );
  const checked = rows
    .slice(1)
    .filter((row) => row.some((value) => value.trim()))
    .map((row, index) => {
      const input = Object.fromEntries(
        headers.map((header, col) => [header, (row[col] || "").trim()]),
      );
      try {
        if (row.slice(headers.length).some((value) => value.trim()))
          throw new Error("This row has values beyond the column headers.");
        const employee = employeeRow(store, actor, input);
        if (seen.has(employee.email))
          throw new Error("Duplicate email in the company or this import.");
        seen.add(employee.email);
        return { row: index + 2, input, employee, error: "" };
      } catch (error) {
        return { row: index + 2, input, error: error.message };
      }
    });
  const result = store.save(actor, "imports", {
    name: filename,
    createdBy: actor.id,
    companyVersion: store.company(actor.orgId).version,
    createdAt: new Date().toISOString(),
    status: "Preview",
    rows: checked,
  });
  return {
    id: result.id,
    version: result.version,
    rows: checked.map(({ employee, ...row }: any) => row),
    valid: checked.every((row) => !row.error),
    count: checked.length,
  };
}
export function commitImport(
  store: Store,
  actor: Actor,
  id: string,
  version: number,
) {
  return store.transaction(() => {
    const preview = store.get(actor.orgId, "imports", id);
    if (preview.createdBy !== actor.id)
      throw new HttpError(
        403,
        "Only the person who previewed this import can commit it.",
      );
    if (preview.status !== "Preview" || preview.version !== version)
      throw new HttpError(409, "This preview is no longer available.");
    if (
      Date.now() - Date.parse(preview.createdAt) > 3600000 ||
      preview.companyVersion !== store.company(actor.orgId).version
    )
      throw new HttpError(
        409,
        "The preview expired or company settings changed. Preview the file again.",
      );
    if (!preview.rows.length || preview.rows.some((row: any) => row.error))
      throw new HttpError(
        400,
        "Resolve every row error and upload the corrected file.",
      );
    const existing = new Set(
      store.list(actor.orgId, "employees").map((emp) => emp.email),
    );
    for (const row of preview.rows) {
      const employee = employeeRow(store, actor, row.input);
      if (existing.has(employee.email))
        throw new HttpError(
          409,
          "An email was added after preview. Preview again. No rows were imported.",
        );
      existing.add(employee.email);
      store.save(actor, "employees", employee);
    }
    store.save(
      actor,
      "imports",
      { ...preview, status: "Committed", rows: [], count: preview.rows.length },
      id,
      version,
    );
    return { count: preview.rows.length };
  });
}
export async function workbookBuffer(
  columns: string[],
  rows: any[],
  name = "Report",
) {
  const workbook = new ExcelJS.Workbook(),
    sheet = workbook.addWorksheet(name.slice(0, 31));
  sheet.columns = columns.map((header) => ({
    header,
    key: header,
    width: Math.min(35, Math.max(18, header.length + 3)),
  }));
  for (const row of rows)
    sheet.addRow(
      (Array.isArray(row) ? row : columns.map((key) => row[key])).map(
        (value) =>
          typeof value === "string" && /^[=+\-@\t\r]/.test(value)
            ? `'${value}`
            : (value ?? ""),
      ),
    );
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF4338CA" },
  };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: Math.max(1, rows.length + 1), column: columns.length },
  };
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
