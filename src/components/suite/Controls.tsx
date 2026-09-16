import React, { useId, useState } from "react";

export type Row = Record<string, any>;
export interface Field {
  key: string;
  label: string;
  type?: string;
  options?: Array<string | { value: string; label: string }>;
  required?: boolean;
  hint?: string;
  min?: number;
  max?: number;
  step?: string;
}
export const inputClass = "ui-input";
export const buttonClass = "account-primary";
export const secondaryClass = "secondary-button";
export function getPath(value: Row, path: string): any {
  return path.split(".").reduce((v, k) => v?.[k], value);
}
export function setPath(value: Row, path: string, next: any) {
  const result = structuredClone(value),
    parts = path.split(".");
  let cursor = result;
  parts.slice(0, -1).forEach((k) => (cursor = cursor[k] ??= {}));
  cursor[parts.at(-1)!] = next;
  return result;
}
export function Panel({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="ui-panel space-y-4">
      <div>
        <h2 className="font-semibold text-lg">{title}</h2>
        {description && (
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {description}
          </p>
        )}
      </div>
      {children}
    </section>
  );
}
export function Form({
  fields,
  initial = {},
  onSubmit,
  submit = "Save",
  reset = true,
}: {
  fields: Field[];
  initial?: Row;
  onSubmit: (data: Row) => Promise<boolean>;
  submit?: string;
  reset?: boolean;
}) {
  const [value, setValue] = useState<Row>(initial),
    [busy, setBusy] = useState(false);
  const id = useId();
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy) return;
        const form = e.currentTarget;
        setBusy(true);
        try {
          if ((await onSubmit(value)) && reset) {
            setValue(initial);
            form.reset();
          }
        } finally {
          setBusy(false);
        }
      }}
      className="space-y-4"
    >
      <fieldset
        disabled={busy}
        className="grid grid-cols-1 md:grid-cols-2 gap-4"
      >
        {fields.map((field) => (
          <label
            key={field.key}
            htmlFor={`${id}-${field.key}`}
            className={`text-sm space-y-1 ${field.type === "textarea" ? "md:col-span-2" : ""}`}
          >
            <span className="font-medium">
              {field.label}
              {field.required === false ? " (optional)" : ""}
            </span>
            {field.options ? (
              <select
                id={`${id}-${field.key}`}
                className={inputClass}
                required={field.required !== false}
                value={getPath(value, field.key) ?? ""}
                onChange={(e) =>
                  setValue(setPath(value, field.key, e.target.value))
                }
              >
                <option value="">Choose…</option>
                {field.options.map((option) => {
                  const o =
                    typeof option === "string"
                      ? { value: option, label: option }
                      : option;
                  return (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  );
                })}
              </select>
            ) : field.type === "checkbox" ? (
              <input
                id={`${id}-${field.key}`}
                type="checkbox"
                className="ml-3 accent-indigo-600"
                checked={!!getPath(value, field.key)}
                onChange={(e) =>
                  setValue(setPath(value, field.key, e.target.checked))
                }
              />
            ) : field.type === "textarea" ? (
              <textarea
                id={`${id}-${field.key}`}
                rows={4}
                className={inputClass}
                required={field.required !== false}
                value={getPath(value, field.key) ?? ""}
                onChange={(e) =>
                  setValue(setPath(value, field.key, e.target.value))
                }
              />
            ) : field.type === "file" ? (
              <input
                id={`${id}-${field.key}`}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                className={inputClass}
                required={field.required !== false}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file && file.size > 2 * 1024 * 1024) {
                    e.target.setCustomValidity("Choose a file up to 2 MB.");
                    e.target.reportValidity();
                    return;
                  }
                  e.target.setCustomValidity("");
                  setValue(
                    setPath(
                      value,
                      field.key,
                      file ? await readFile(file) : null,
                    ),
                  );
                }}
              />
            ) : (
              <input
                id={`${id}-${field.key}`}
                type={field.type || "text"}
                className={inputClass}
                required={field.required !== false}
                min={field.min ?? (field.type === "number" ? 0 : undefined)}
                max={field.max}
                step={
                  field.step || (field.type === "number" ? "0.01" : undefined)
                }
                value={getPath(value, field.key) ?? ""}
                onChange={(e) =>
                  setValue(
                    setPath(
                      value,
                      field.key,
                      field.type === "number"
                        ? e.target.value === ""
                          ? ""
                          : Number(e.target.value)
                        : e.target.value,
                    ),
                  )
                }
              />
            )}
            {field.hint && (
              <span className="block text-xs text-slate-500 dark:text-slate-400">
                {field.hint}
              </span>
            )}
          </label>
        ))}
        <div className="md:col-span-2">
          <button className={buttonClass} type="submit">
            {busy ? "Saving…" : submit}
          </button>
        </div>
      </fieldset>
    </form>
  );
}
export async function readFile(file: File) {
  return new Promise<Row>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve({
        name: file.name,
        mimeType: file.type,
        contentBase64: String(reader.result).split(",")[1],
      });
    reader.onerror = () =>
      reject(new Error("The selected file could not be read."));
    reader.readAsDataURL(file);
  });
}
export function Table({
  rows,
  columns,
  actions,
}: {
  rows: Row[];
  columns: Array<[string, string]>;
  actions?: (row: Row) => React.ReactNode;
}) {
  return rows.length ? (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left">
        <thead>
          <tr className="border-b border-slate-200 dark:border-slate-700">
            {columns.map(([key, label]) => (
              <th
                key={key}
                className="p-3 font-medium text-slate-500 whitespace-nowrap"
              >
                {label}
              </th>
            ))}
            {actions && <th className="p-3">Actions</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={row.id || index}
              className="border-b border-slate-100 dark:border-slate-800"
            >
              {columns.map(([key]) => (
                <td key={key} className="p-3 align-top max-w-xs break-words">
                  {typeof getPath(row, key) === "boolean"
                    ? getPath(row, key)
                      ? "Yes"
                      : "No"
                    : (getPath(row, key) ?? "—")}
                </td>
              ))}
              {actions && (
                <td className="p-3">
                  <div className="flex flex-wrap gap-2">{actions(row)}</div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <p className="py-4 text-sm text-slate-500">No records yet.</p>
  );
}
export const options = (records: Row[], label = "name") =>
  records.map((row) => ({ value: row.id, label: row[label] }));
export const money = (value: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(
    value || 0,
  );
