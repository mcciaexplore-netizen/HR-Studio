import React, { useState } from "react";
import { Employee, EmployeeDocument } from "../../types";
import { ErrorMessage, Field } from "../AccountViews";

function readBase64(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = () => reject(new Error("The file could not be read."));
    reader.readAsDataURL(file);
  });
}
const letterTypes = [
  "Offer Letter",
  "Appointment Letter",
  "LOR",
  "Experience Letter",
];
export default function DocsView({
  employees,
  documents,
  companyName,
  readOnly,
  onAddDocument,
  onDeleteDocument,
}: {
  employees: Employee[];
  documents: EmployeeDocument[];
  companyName: string;
  readOnly: boolean;
  onAddDocument: (doc: any) => Promise<boolean>;
  onDeleteDocument: (id: string) => Promise<boolean>;
}) {
  const [search, setSearch] = useState(""),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const [employeeId, setEmployeeId] = useState(""),
    [type, setType] = useState(letterTypes[0]),
    [content, setContent] = useState("");
  const [draftEmployeeId, setDraftEmployeeId] = useState(""),
    [draftType, setDraftType] = useState("");
  function generate() {
    const employee = employees.find((emp) => emp.id === employeeId);
    if (!employee) return;
    const gross =
      employee.salary.basic + employee.salary.hra + employee.salary.allowances;
    const intros = {
      "Offer Letter": `Dear ${employee.name},\n\nWe would like to offer you the role of ${employee.role} in our ${employee.department} department.\n\nProposed start date: ${employee.hireDate}\nProposed monthly gross salary: INR ${gross.toLocaleString("en-IN")}\n\n[Add and review employment terms, reporting arrangements, probation, benefits, acceptance deadline and signatory before issuing.]`,
      "Appointment Letter": `Dear ${employee.name},\n\nThis draft records your appointment as ${employee.role} in the ${employee.department} department from ${employee.hireDate}.\n\nMonthly gross salary: INR ${gross.toLocaleString("en-IN")}\n\n[Confirm the agreed terms, work location, reporting manager, working hours, leave and applicable company policies before issuing.]`,
      LOR: `To whom it may concern,\n\n${employee.name} has worked with ${companyName} as ${employee.role} in the ${employee.department} department.\n\n[Add factual achievements, responsibilities, employment dates and the recommender's assessment. Verify each statement before issuing.]`,
      "Experience Letter": `To whom it may concern,\n\nThis draft records the employment of ${employee.name} as ${employee.role} in the ${employee.department} department, starting on ${employee.hireDate}.\n\n[Confirm the employment end date, responsibilities and authorized signatory before issuing.]`,
    };
    setContent(
      `${companyName}\n${type} — DRAFT\nDate: ${new Date().toLocaleDateString("en-IN")}\n\n${intros[type]}\n\nFor ${companyName}\n[Authorized signatory]`,
    );
    setDraftEmployeeId(employee.id);
    setDraftType(type);
    setMessage("");
    setError("");
  }
  async function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget,
      fields = new FormData(form),
      file = fields.get("file") as File;
    setError("");
    setMessage("");
    setBusy(true);
    try {
      if (!file?.size || file.size > 2 * 1024 * 1024)
        throw new Error("Choose a file up to 2 MB.");
      const mimeType =
        file.type ||
        (file.name.toLowerCase().endsWith(".txt") ? "text/plain" : "");
      if (
        !["application/pdf", "image/png", "image/jpeg", "text/plain"].includes(
          mimeType,
        )
      )
        throw new Error("Use PDF, PNG, JPEG or plain text.");
      if (
        await onAddDocument({
          employeeId: fields.get("employeeId"),
          category: fields.get("category"),
          name: file.name,
          mimeType,
          contentBase64: await readBase64(file),
        })
      ) {
        form.reset();
        setMessage("File saved.");
      }
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  }
  async function saveDraft() {
    setError("");
    setMessage("");
    setBusy(true);
    try {
      if (
        await onAddDocument({
          employeeId: draftEmployeeId,
          category: "Contract",
          name: `${draftType}-${employees.find((emp) => emp.id === draftEmployeeId)?.name || "employee"}.txt`,
          mimeType: "text/plain",
          contentBase64: await readBase64(
            new Blob([content], { type: "text/plain" }),
          ),
        })
      )
        setMessage("Draft saved as a text document.");
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Documents</h1>
        <p className="text-sm text-slate-500 mt-1">
          Employee files and editable letter drafts.
        </p>
      </div>
      <ErrorMessage message={error} />
      {message && (
        <p role="status" className="text-sm text-emerald-700">
          {message}
        </p>
      )}
      {!readOnly && (
        <div className="grid xl:grid-cols-2 gap-6">
          <form onSubmit={upload} className="account-panel space-y-4">
            <h2 className="text-lg font-bold">Upload a file</h2>
            <fieldset disabled={busy} className="space-y-4">
              <Field label="Employee">
                <select required name="employeeId" defaultValue="">
                  <option value="">Choose employee</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Category">
                <select name="category">
                  {["Contract", "ID Proof", "Certificate", "Other"].map(
                    (category) => (
                      <option key={category}>{category}</option>
                    ),
                  )}
                </select>
              </Field>
              <Field label="File — PDF, PNG, JPEG or TXT, up to 2 MB">
                <input
                  required
                  type="file"
                  name="file"
                  accept=".pdf,.png,.jpg,.jpeg,.txt"
                />
              </Field>
              <button className="account-primary">
                {busy ? "Saving…" : "Save file"}
              </button>
            </fieldset>
          </form>
          <section className="account-panel space-y-4">
            <h2 className="text-lg font-bold">Prepare a letter</h2>
            <Field label="Employee">
              <select
                value={employeeId}
                onChange={(event) => {
                  setEmployeeId(event.target.value);
                  setContent("");
                }}
              >
                <option value="">Choose employee</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Letter type">
              <select
                value={type}
                onChange={(event) => {
                  setType(event.target.value);
                  setContent("");
                }}
              >
                {letterTypes.map((type) => (
                  <option key={type}>{type}</option>
                ))}
              </select>
            </Field>
            <p className="text-xs text-slate-500">
              Templates are drafts. Review the terms and employee details before
              issuing a letter.
            </p>
            <button
              className="account-primary"
              disabled={!employeeId || busy}
              onClick={generate}
            >
              Prepare draft
            </button>
          </section>
        </div>
      )}
      {!readOnly && content && (
        <section className="account-panel space-y-4">
          <Field label="Edit letter draft">
            <textarea
              rows={18}
              value={content}
              onChange={(event) => setContent(event.target.value)}
            />
          </Field>
          <div className="flex gap-4">
            <button
              disabled={busy || !content.trim()}
              onClick={() => void saveDraft()}
              className="account-primary"
            >
              Save draft to documents
            </button>
            <button
              onClick={() => {
                navigator.clipboard
                  .writeText(content)
                  .then(() => setMessage("Draft copied."))
                  .catch(() =>
                    setError(
                      "Clipboard is unavailable. Select and copy the letter text.",
                    ),
                  );
              }}
              className="text-sm underline"
            >
              Copy text
            </button>
          </div>
          <p className="text-xs text-slate-500">
            Saved drafts are downloadable TXT files. Upload the final signed PDF
            when ready.
          </p>
        </section>
      )}
      <section className="account-panel space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-lg font-bold">
            Saved documents ({documents.length})
          </h2>
          <label className="account-field">
            <span className="sr-only">Search documents</span>
            <input
              placeholder="Search documents…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
        </div>
        <div className="divide-y divide-slate-200 dark:divide-slate-800">
          {documents
            .filter((doc) =>
              `${doc.name} ${employees.find((emp) => emp.id === doc.employeeId)?.name || ""}`
                .toLowerCase()
                .includes(search.toLowerCase()),
            )
            .map((doc) => (
              <div
                key={doc.id}
                className="py-4 flex flex-wrap gap-4 justify-between items-center"
              >
                <div className="min-w-0">
                  <p className="font-medium text-sm break-all">{doc.name}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {employees.find((emp) => emp.id === doc.employeeId)?.name} ·{" "}
                    {doc.category} · {doc.size} · {doc.uploadDate}
                  </p>
                  {doc.expiryDate && (
                    <p className="text-xs text-amber-700 mt-1">
                      Expires: {doc.expiryDate}
                    </p>
                  )}
                  {doc.signature && (
                    <p className="text-xs text-emerald-700 mt-1">
                      Signature: {doc.signature.status} by{" "}
                      {doc.signature.provider} · {doc.signature.reference}
                    </p>
                  )}
                </div>
                <div className="flex gap-4 text-sm">
                  <a
                    className="text-indigo-600 underline"
                    href={`/api/documents/${doc.id}/download`}
                  >
                    Download
                  </a>
                  {!readOnly && (
                    <button
                      disabled={busy}
                      className="text-red-600 underline"
                      onClick={() => {
                        if (window.confirm(`Delete ${doc.name}?`))
                          void onDeleteDocument(doc.id);
                      }}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
        </div>
        {!documents.length && (
          <p className="py-6 text-sm text-slate-500">No documents saved yet.</p>
        )}
      </section>
    </div>
  );
}
