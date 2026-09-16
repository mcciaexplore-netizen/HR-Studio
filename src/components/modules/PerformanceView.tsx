import React, { useState } from 'react';
import { 
  Award, 
  TrendingUp, 
  FileText, 
  Sparkles, 
  Plus, 
  Star,
  CheckCircle,
  Activity,
  Heart
} from 'lucide-react';
import { Appraisal, Employee } from '../../types';

interface PerformanceViewProps {
  appraisals: Appraisal[];
  employees: Employee[];
  currentUserName?: string;
  onAddAppraisal: (appraisal: Omit<Appraisal, 'id' | 'date'>) => Promise<boolean>;
  onApproveAppraisal: (id: string) => void;
}

export default function PerformanceView({
  appraisals,
  employees,
  currentUserName,
  onAddAppraisal,
  onApproveAppraisal
}: PerformanceViewProps) {
  const [showForm, setShowForm] = useState(false);
  
  // Form states
  const [employeeId, setEmployeeId] = useState('');
  const [period, setPeriod] = useState(`${new Date().getMonth()<6 ? 'H1' : 'H2'} ${new Date().getFullYear()}`);
  const [goalsSet, setGoalsSet] = useState('');
  const [selfRating, setSelfRating] = useState(4);
  const [managerRating, setManagerRating] = useState(4);
  const [feedback, setFeedback] = useState('');

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const emp = employees.find(x => x.id === employeeId);
    if (!emp) return;

    const saved = await onAddAppraisal({
      employeeId,
      employeeName: emp.name,
      reviewerName: currentUserName || 'HR Admin',
      period,
      goalsSet,
      selfRating,
      managerRating,
      feedback,
      status: 'Submitted'
    });

    if (!saved) return;
    setShowForm(false);
    setGoalsSet('');
    setFeedback('');
  };

  return (
    <div className="space-y-6">
      
      {/* Top Title */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Performance Appraisals</h2>
          <p className="text-xs text-slate-500">Conduct biannual performance goals reviews, assign peer feedback, and audit core metrics</p>
        </div>

        <button 
          onClick={() => {
            if (employees.length > 0) setEmployeeId(employees[0].id);
            setShowForm(true);
          }}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-500 active:scale-95 text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Conduct Review</span>
        </button>
      </div>

      {/* Performance Split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Appraisal submissions list */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Evaluation Reviews</h3>
          
          <div className="space-y-4">
            {appraisals.map(app => (
              <div 
                key={app.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl space-y-4 shadow-sm dark:shadow-none"
              >
                <div className="flex justify-between items-start border-b border-slate-100 dark:border-slate-800/60 pb-3">
                  <div>
                    <span className="text-xs font-bold text-slate-900 dark:text-white block">{app.employeeName}</span>
                    <span className="text-[10px] text-slate-500 font-mono">Period: {app.period} • Assessed by {app.reviewerName}</span>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-mono font-bold border ${
                    app.status === 'Approved' 
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                      : 'bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse'
                  }`}>
                    {app.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-[9px] uppercase font-mono text-slate-500 font-bold block mb-1">Target Goals / Milestones</span>
                    <p className="text-slate-600 dark:text-slate-300 whitespace-pre-line leading-relaxed italic">"{app.goalsSet}"</p>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase font-mono text-slate-500 font-bold block mb-1">Executive Feedback</span>
                    <p className="text-slate-600 dark:text-slate-300 whitespace-pre-line leading-relaxed italic">"{app.feedback}"</p>
                  </div>
                </div>

                {/* Ratings display */}
                <div className="flex justify-between items-center pt-3 border-t border-slate-100 dark:border-slate-800/40 text-[10px] font-semibold">
                  <div className="flex gap-4">
                    <span className="text-slate-500">Self Rating: <strong className="text-indigo-400 font-mono">{app.selfRating}/5</strong></span>
                    <span className="text-slate-500">Manager Rating: <strong className="text-purple-400 font-mono">{app.managerRating}/5</strong></span>
                  </div>

                  {app.status !== 'Approved' && (
                    <button
                      onClick={() => onApproveAppraisal(app.id)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600/10 hover:bg-emerald-600/20 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold transition-all flex items-center gap-1"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>Approve Review</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Competency matrix visual card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm dark:shadow-none self-start">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800/60 mb-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-purple-400" />
              Core Competency Weights
            </h3>
            <span className="text-[10px] font-mono text-slate-500">Averages</span>
          </div>

          <div className="space-y-4">
            {appraisals.length === 0 ? (
              <div className="text-center py-6 bg-slate-50 dark:bg-slate-950/40 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                <TrendingUp className="w-5 h-5 text-slate-400 dark:text-slate-500 mx-auto mb-2" />
                <span className="text-xs text-slate-500 dark:text-slate-400 block">No appraisal data yet</span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 block mt-1">Conduct a review to see average ratings here</span>
              </div>
            ) : (
              (() => {
                const avgSelf = appraisals.reduce((acc, a) => acc + a.selfRating, 0) / appraisals.length;
                const avgManager = appraisals.reduce((acc, a) => acc + a.managerRating, 0) / appraisals.length;
                const approvedCount = appraisals.filter(a => a.status === 'Approved').length;
                const rows = [
                  { label: "Average Self Rating", value: avgSelf },
                  { label: "Average Manager Rating", value: avgManager },
                  { label: "Approved Reviews", value: (approvedCount / appraisals.length) * 5 , display: `${approvedCount}/${appraisals.length}` }
                ];
                return rows.map((comp, idx) => {
                  const pct = `${Math.min(100, (comp.value / 5) * 100)}%`;
                  return (
                    <div key={idx} className="space-y-1.5">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-600 dark:text-slate-300 font-semibold">{comp.label}</span>
                        <span className="text-slate-400 font-mono text-[10px]">{comp.display || `${comp.value.toFixed(1)} / 5.0`}</span>
                      </div>
                      <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden border border-slate-800/40">
                        <div className="bg-gradient-to-r from-purple-600 to-indigo-500 h-full rounded-full" style={{ width: pct }} />
                      </div>
                    </div>
                  );
                });
              })()
            )}
          </div>
        </div>

      </div>

      {/* Conduct Appraisal Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-950">
              <h3 className="text-sm font-bold text-white">Record Performance Appraisal</h3>
              <button onClick={() => setShowForm(false)} className="p-1 rounded-lg border border-slate-800 text-slate-500 hover:text-white">
                <FileText className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="p-6 space-y-4">
              <label className="account-field">Manager rating (1–5)<input type="number" min={1} max={5} required value={managerRating} onChange={e=>setManagerRating(Number(e.target.value))}/></label>
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-mono text-slate-400 block">Select Employee Profile</label>
                <select
                  required
                  value={employeeId}
                  onChange={e => setEmployeeId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs rounded-lg p-2.5 text-slate-900 dark:text-white outline-none focus:border-purple-500"
                >
                  {employees.map(e => (
                    <option key={e.id} value={e.id}>{e.name} ({e.role})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-mono text-slate-400 block">Review Period</label>
                  <select
                    value={period}
                    onChange={e => setPeriod(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs rounded-lg p-2.5 text-slate-900 dark:text-white outline-none"
                  >
                    <option value="H1 2026">H1 2026</option>
                    <option value="H2 2025">H2 2025</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-mono text-slate-400 block">Self Rating (1-5)</label>
                  <input
                    type="number"
                    min={1}
                    max={5}
                    required
                    value={selfRating}
                    onChange={e => setSelfRating(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs rounded-lg p-2.5 text-slate-900 dark:text-white outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-mono text-slate-400 block">Target Goals Established</label>
                <textarea
                  required
                  rows={2}
                  value={goalsSet}
                  onChange={e => setGoalsSet(e.target.value)}
                  placeholder="e.g. 1. Deploy component vault. 2. Redesign mobile assets..."
                  className="w-full bg-slate-50 dark:bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs rounded-lg p-2.5 text-slate-900 dark:text-white outline-none focus:border-purple-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-mono text-slate-400 block">Manager Critique & Feedback</label>
                <textarea
                  required
                  rows={2}
                  value={feedback}
                  onChange={e => setFeedback(e.target.value)}
                  placeholder="Critique contributions and peer interaction indexes..."
                  className="w-full bg-slate-50 dark:bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs rounded-lg p-2.5 text-slate-900 dark:text-white outline-none focus:border-purple-500"
                />
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 py-2.5 rounded-lg bg-transparent hover:bg-slate-800 border border-slate-800 text-xs font-bold text-slate-400 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-xs font-bold text-white transition-all shadow-md"
                >
                  Submit Review
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
