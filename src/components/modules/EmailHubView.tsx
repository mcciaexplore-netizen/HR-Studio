import React, { useState } from 'react';
import { Employee, EmailLog } from '../../types';
import { ErrorMessage, Field } from '../AccountViews';

export default function EmailHubView({ employees, emailLogs, mailConfigured, onSend }: { employees: Employee[]; emailLogs: EmailLog[]; mailConfigured: boolean; onSend: (data: any) => Promise<boolean> }) {
  const [employeeId, setEmployeeId] = useState(''), [subject, setSubject] = useState(''), [body, setBody] = useState('');
  const [campaignType, setCampaignType] = useState<EmailLog['campaignType']>('General Notice');
  const [message, setMessage] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const employee = employees.find(emp=>emp.id===employeeId);
  function draft(type: EmailLog['campaignType']) {
    setCampaignType(type); setMessage('');
    const name = employee?.name || 'team member';
    const drafts = {
      'General Notice': {subject:'Company update',body:`Hello ${name},\n\n[Write your update here.]\n\nRegards,\nHR team`},
      'Birthday': {subject:`Happy birthday, ${name}`,body:`Hello ${name},\n\nWishing you a wonderful birthday and a great year ahead!\n\nRegards,\nHR team`},
      'Work Anniversary': {subject:`Happy work anniversary, ${name}`,body:`Hello ${name},\n\nThank you for your contributions to our team. Happy work anniversary!\n\nRegards,\nHR team`},
      'Payslip': {subject:'Salary information',body:`Hello ${name},\n\nPlease contact HR for your approved payslip. Salary estimates in HR Studio do not confirm payment.\n\nRegards,\nHR team`}
    };
    setSubject(drafts[type].subject); setBody(drafts[type].body);
  }
  async function copy() { try { await navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`); setMessage('Draft copied.'); } catch { setError('Clipboard access was unavailable. Select and copy the text below.'); } }
  async function send(event: React.FormEvent) { event.preventDefault(); setBusy(true); setMessage(''); setError(''); try { if (await onSend({employeeId,subject,body,campaignType})) setMessage('Accepted by your mail server. Delivery to the inbox is not confirmed.'); } finally { setBusy(false); } }
  const ready = !!employee && !!subject.trim() && !!body.trim();
  return <div className="space-y-6">
    <div><h1 className="text-2xl font-bold">Email</h1><p className="text-sm text-slate-500 mt-1">Prepare a draft or explicitly send through your configured mail server.</p></div>
    {!mailConfigured && <p className="p-4 bg-amber-50 text-amber-900 rounded-xl text-sm">Email delivery is not configured. Copy a draft or open it in your email app.</p>}
    <form className="account-panel space-y-4" onSubmit={send}><ErrorMessage message={error}/>{message && <p className="text-sm text-emerald-700" role="status">{message}</p>}
      <fieldset disabled={busy} className="space-y-4"><div className="grid md:grid-cols-2 gap-4"><Field label="Recipient"><select required value={employeeId} onChange={event=>{setEmployeeId(event.target.value);setMessage('');}}><option value="">Choose employee</option>{employees.map(emp=><option key={emp.id} value={emp.id}>{emp.name} — {emp.email}</option>)}</select></Field><Field label="Draft template"><select value={campaignType} onChange={event=>draft(event.target.value as EmailLog['campaignType'])}>{['General Notice','Birthday','Work Anniversary','Payslip'].map(type=><option key={type}>{type}</option>)}</select></Field></div>
      <Field label="Subject"><input required maxLength={200} value={subject} onChange={event=>setSubject(event.target.value)}/></Field><Field label="Message"><textarea required rows={10} maxLength={12000} value={body} onChange={event=>setBody(event.target.value)}/></Field>
      <div className="flex flex-wrap gap-4 items-center"><button type="button" className="text-sm underline" disabled={!ready} onClick={()=>void copy()}>Copy draft</button>{ready && <><a className="text-sm underline" href={`mailto:${employee.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`}>Open email app</a><a className="text-sm underline" target="_blank" rel="noopener noreferrer" href={`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(employee.email)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`}>Open Gmail draft</a></>}<button type="submit" disabled={!ready || !mailConfigured} className="account-primary ml-auto">{busy ? 'Sending…' : 'Send email now'}</button></div>
      <p className="text-xs text-slate-500">Copying and opening drafts do not send email. “Send email now” sends to the employee address shown above.</p></fieldset>
    </form>
    <section className="account-panel space-y-4"><h2 className="text-lg font-bold">Outbox history</h2><p className="text-xs text-slate-500">Accepted means the mail server accepted the message. Queued may need investigation after a server interruption. Check your mail service before resending uncertain messages.</p>{!emailLogs.length && <p className="text-sm text-slate-500 py-6">No send attempts yet.</p>}<div className="divide-y divide-slate-200 dark:divide-slate-800">{emailLogs.map(log=><details key={log.id} className="py-4"><summary className="cursor-pointer text-sm"><strong>{log.subject}</strong><span className="ml-3 text-slate-500">{log.recipientEmail} · {log.status} · {new Date(log.timestamp).toLocaleString()}</span></summary><p className="whitespace-pre-wrap text-sm mt-3 text-slate-500">{log.body}</p></details>)}</div></section>
  </div>;
}
