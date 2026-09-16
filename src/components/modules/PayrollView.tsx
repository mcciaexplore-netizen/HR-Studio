import React, { useState } from 'react';
import { 
  CreditCard, 
  IndianRupee, 
  FileText, 
  CheckCircle, 
  Download, 
  Search,
  Building,
  Calendar,
  User,
  X,
  Printer
} from 'lucide-react';
import { Employee } from '../../types';

interface PayrollViewProps {
  employees: Employee[];
  companyName: string;
}

export default function PayrollView({ employees, companyName }: PayrollViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPayslipEmp, setSelectedPayslipEmp] = useState<Employee | null>(null);
  const currentMonthLabel = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const [payslipMonth, setPayslipMonth] = useState(currentMonthLabel);

  const filteredEmployees = employees.filter(emp => 
    emp.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    emp.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const calculateSalaryMetrics = (emp: Employee) => {
    const { basic, hra, allowances, deductions } = emp.salary;
    const gross = basic + hra + allowances;
    const net = gross - deductions;
    return { gross, net };
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Salary Estimates</h2>
          <p className="text-xs text-slate-500">Based on current monthly salary settings. Payroll processing, historical salary snapshots and payment confirmation are not yet available.</p>
        </div>

        <div className="flex items-center gap-2 bg-slate-950/20 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 shrink-0">
          <span className="text-xs text-slate-400">Payroll Month:</span>
          <select 
            value={payslipMonth}
            onChange={e => setPayslipMonth(e.target.value)}
            className="bg-transparent text-xs font-bold text-slate-900 dark:text-white outline-none border-none"
          >
            {[0, 1, 2].map(offset => {
              const d = new Date();
              d.setMonth(d.getMonth() - offset);
              const label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
              return <option key={label} value={label}>{label}</option>;
            })}
          </select>
        </div>
      </div>

      {/* Main Directory & Summary grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Payroll Calculations List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center bg-slate-950/30 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
            <Search className="w-4 h-4 text-slate-500 ml-1.5 mr-2" />
            <input 
              type="text"
              placeholder="Search employee compensations..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-transparent border-none text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-500 outline-none"
            />
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm dark:shadow-none">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-950/40 border-b border-slate-100 dark:border-slate-800/80 text-slate-500 font-mono text-[10px] uppercase">
                  <th className="p-4">Employee</th>
                  <th className="p-4">Gross Salary</th>
                  <th className="p-4">Deductions</th>
                  <th className="p-4">Net Payout</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {filteredEmployees.map(emp => {
                  const { gross, net } = calculateSalaryMetrics(emp);
                  return (
                    <tr key={emp.id} className="hover:bg-slate-950/10">
                      <td className="p-4">
                        <span className="font-bold text-slate-900 dark:text-white block">{emp.name}</span>
                        <span className="text-[10px] text-slate-500 font-mono">{emp.id} • {emp.role}</span>
                      </td>
                      <td className="p-4 font-mono text-slate-600 dark:text-slate-300">₹{gross.toLocaleString()}</td>
                      <td className="p-4 font-mono text-rose-400">₹{emp.salary.deductions.toLocaleString()}</td>
                      <td className="p-4 font-mono text-purple-400 font-bold">₹{net.toLocaleString()}</td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => setSelectedPayslipEmp(emp)}
                          className="px-2.5 py-1.5 rounded-lg bg-purple-600/10 hover:bg-purple-600/20 text-purple-400 border border-purple-500/10 text-[10px] font-bold transition-all"
                        >
                          View Estimate
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Financial Stat side card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm dark:shadow-none self-start">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800/60 mb-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Estimated Salary Summary</h3>
            <span className="text-[10px] font-mono text-slate-500">Estimate</span>
          </div>

          <div className="space-y-4">
            <div>
              <span className="text-[10px] text-slate-500 uppercase block font-semibold">Total Gross Payout</span>
              <span className="text-xl font-black font-mono tracking-tight text-slate-900 dark:text-white">
                ₹{employees.reduce((acc, emp) => acc + calculateSalaryMetrics(emp).gross, 0).toLocaleString()}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 uppercase block font-semibold">Total Deductions Saved</span>
              <span className="text-xl font-black font-mono tracking-tight text-rose-400">
                ₹{employees.reduce((acc, emp) => acc + emp.salary.deductions, 0).toLocaleString()}
              </span>
            </div>
            <div className="border-t border-slate-100 dark:border-slate-800/60 pt-4">
              <span className="text-[10px] text-slate-500 uppercase block font-semibold">Total estimated net salary</span>
              <span className="text-2xl font-black font-mono tracking-tight text-purple-400">
                ₹{employees.reduce((acc, emp) => acc + calculateSalaryMetrics(emp).net, 0).toLocaleString()}
              </span>
            </div>
          </div>
        </div>

      </div>

      {/* Payslip View Modal Overlay */}
      {selectedPayslipEmp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white text-slate-900 rounded-2xl w-full max-w-2xl overflow-hidden flex flex-col p-8 relative shadow-2xl">
            
            {/* Top Close icon (Hidden in print) */}
            <button 
              onClick={() => setSelectedPayslipEmp(null)}
              className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-all print:hidden"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Print Header Button */}
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-200 print:hidden">
              <span className="text-xs text-slate-500">Salary estimate — not a processed payslip</span>
              <button
                onClick={handlePrint}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                <span>Print/Save PDF</span>
              </button>
            </div>

            {/* Actual Print Layout */}
            <div className="space-y-6 select-none">
              
              {/* Corporate Identity */}
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-6 h-6 rounded bg-purple-600 flex items-center justify-center">
                      <span className="text-white font-bold text-xs">D</span>
                    </div>
                    <span className="font-extrabold tracking-tight text-slate-900 text-sm">{companyName}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 block max-w-xs">Current salary configuration; no payment recorded.</span>
                </div>
                <div className="text-right">
                  <h3 className="text-lg font-black tracking-tight text-slate-900">SALARY ESTIMATE</h3>
                  <span className="text-xs font-mono font-bold text-slate-600 uppercase">Month: {payslipMonth}</span>
                </div>
              </div>

              {/* Employee Particulars Grid */}
              <div className="grid grid-cols-2 gap-x-12 gap-y-2 text-xs py-4 border-t border-b border-slate-200 bg-slate-50 p-4 rounded-xl">
                <div>
                  <span className="text-slate-400 block text-[9px] uppercase font-semibold">Employee Name</span>
                  <span className="font-bold text-slate-900">{selectedPayslipEmp.name}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[9px] uppercase font-semibold">Employee ID</span>
                  <span className="font-mono text-slate-900">{selectedPayslipEmp.id}</span>
                </div>
                <div className="mt-2">
                  <span className="text-slate-400 block text-[9px] uppercase font-semibold">Department</span>
                  <span className="font-bold text-slate-900">{selectedPayslipEmp.department}</span>
                </div>
                <div className="mt-2">
                  <span className="text-slate-400 block text-[9px] uppercase font-semibold">Designation</span>
                  <span className="font-bold text-slate-900">{selectedPayslipEmp.role}</span>
                </div>
              </div>

              {/* Earnings vs Deductions Table */}
              <div className="grid grid-cols-2 gap-8 mt-6">
                
                {/* Earnings */}
                <div className="space-y-2">
                  <span className="text-xs font-bold text-slate-900 border-b-2 border-slate-200 pb-1 block">Earnings</span>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between text-slate-600">
                      <span>Basic Salary</span>
                      <span className="font-mono">₹{selectedPayslipEmp.salary.basic.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>House Rent Allowance (HRA)</span>
                      <span className="font-mono">₹{selectedPayslipEmp.salary.hra.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Special Allowances</span>
                      <span className="font-mono">₹{selectedPayslipEmp.salary.allowances.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* Deductions */}
                <div className="space-y-2">
                  <span className="text-xs font-bold text-slate-900 border-b-2 border-slate-200 pb-1 block">Deductions</span>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between text-slate-600">
                      <span>Professional Income Tax</span>
                      <span className="font-mono">₹{selectedPayslipEmp.salary.deductions.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Medical Benefit Co-pay</span>
                      <span className="font-mono">₹0.00</span>
                    </div>
                  </div>
                </div>

              </div>

              {/* Overall Totals Block */}
              <div className="grid grid-cols-2 gap-8 border-t border-slate-200 pt-4 mt-4 font-bold text-xs">
                <div className="flex justify-between text-slate-900">
                  <span>Gross Earnings</span>
                  <span className="font-mono">
                    ₹{(selectedPayslipEmp.salary.basic + selectedPayslipEmp.salary.hra + selectedPayslipEmp.salary.allowances).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-slate-900">
                  <span>Gross Deductions</span>
                  <span className="font-mono">
                    ₹{selectedPayslipEmp.salary.deductions.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Net Payout Banner */}
              <div className="bg-slate-900 text-white rounded-xl p-4 flex justify-between items-center mt-6">
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-semibold">Estimated Net Salary</span>
                  <span className="text-[9px] text-slate-400">Assigned bank check cleared electronically</span>
                </div>
                <span className="text-xl font-black font-mono">
                  ₹{(selectedPayslipEmp.salary.basic + selectedPayslipEmp.salary.hra + selectedPayslipEmp.salary.allowances - selectedPayslipEmp.salary.deductions).toLocaleString()}
                </span>
              </div>

            </div>

          </div>
        </div>
      )}

    </div>
  );
}
