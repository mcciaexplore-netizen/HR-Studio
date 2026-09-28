import React, { useState, useRef } from 'react';
import { 
  Download, 
  Search,
  X,
  Image as ImageIcon
} from 'lucide-react';
import { Employee } from '../../types';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

// Helper to convert number to words
function numberToWords(num: number): string {
  const a = ['','One ','Two ','Three ','Four ', 'Five ','Six ','Seven ','Eight ','Nine ','Ten ','Eleven ','Twelve ','Thirteen ','Fourteen ','Fifteen ','Sixteen ','Seventeen ','Eighteen ','Nineteen '];
  const b = ['', '', 'Twenty','Thirty','Forty','Fifty', 'Sixty','Seventy','Eighty','Ninety'];

  if ((num = num.toString()).length > 9) return 'overflow';
  const n = ('000000000' + num).substring(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
  if (!n) return ''; 
  let str = '';
  str += (n[1] != '00') ? (a[Number(n[1])] || b[n[1][0]] + ' ' + a[n[1][1]]) + 'Crore ' : '';
  str += (n[2] != '00') ? (a[Number(n[2])] || b[n[2][0]] + ' ' + a[n[2][1]]) + 'Lakh ' : '';
  str += (n[3] != '00') ? (a[Number(n[3])] || b[n[3][0]] + ' ' + a[n[3][1]]) + 'Thousand ' : '';
  str += (n[4] != '0') ? (a[Number(n[4])] || b[n[4][0]] + ' ' + a[n[4][1]]) + 'Hundred ' : '';
  str += (n[5] != '00') ? ((str != '') ? 'and ' : '') + (a[Number(n[5])] || b[n[5][0]] + ' ' + a[n[5][1]]) : '';
  return str.trim();
}

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

  const payslipRef = useRef<HTMLDivElement>(null);

  const handleDownloadPDF = async () => {
    if (!payslipRef.current) return;
    const canvas = await html2canvas(payslipRef.current, { scale: 2 });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    pdf.save(`Payslip_${selectedPayslipEmp?.name.replace(/\s+/g, '_')}_${payslipMonth}.pdf`);
  };

  const handleDownloadImage = async () => {
    if (!payslipRef.current) return;
    const canvas = await html2canvas(payslipRef.current, { scale: 2 });
    const imgData = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = imgData;
    link.download = `Payslip_${selectedPayslipEmp?.name.replace(/\s+/g, '_')}_${payslipMonth}.png`;
    link.click();
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto pt-24">
          <div className="bg-white text-slate-900 w-full max-w-4xl overflow-hidden flex flex-col relative shadow-2xl rounded-sm">
            
            {/* Top Close icon */}
            <button 
              onClick={() => setSelectedPayslipEmp(null)}
              className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-all print:hidden z-10"
            >
              <X className="w-6 h-6" />
            </button>

            {/* Actions Header */}
            <div className="flex justify-end items-center p-4 bg-slate-50 border-b border-slate-200 print:hidden gap-3">
              <button
                onClick={handleDownloadImage}
                className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-medium rounded-md transition-all shadow-sm flex items-center gap-2"
              >
                <ImageIcon className="w-4 h-4" />
                <span>Download Image</span>
              </button>
              <button
                onClick={handleDownloadPDF}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-all shadow-sm flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                <span>Download PDF</span>
              </button>
            </div>

            {/* Actual Print Layout */}
            <div ref={payslipRef} className="bg-white p-10 mx-auto w-full max-w-[800px] text-black">
              
              {/* Header */}
              <div className="text-center relative mb-12">
                {/* Company Logo at Left */}
                <div className="absolute left-0 top-0 flex items-center justify-center h-full">
                  <div className="w-16 h-16 bg-indigo-600 text-white rounded-xl flex items-center justify-center font-bold text-3xl shadow-sm">
                    {companyName.charAt(0)}
                  </div>
                </div>
                
                <h1 className="text-2xl font-bold mb-2">Payslip</h1>
                <h2 className="text-xl font-medium mb-1">{companyName}</h2>
                <p className="text-base text-gray-700">21023 Pearson Point Road</p>
                <p className="text-base text-gray-700">Gateway Avenue</p>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-2 gap-x-12 gap-y-3 text-[15px] mb-8">
                <div className="grid grid-cols-[130px_1fr] gap-x-2 gap-y-2">
                  <span className="text-gray-600">Date of Joining</span>
                  <span className="font-medium">: 2018-06-23</span>
                  <span className="text-gray-600">Pay Period</span>
                  <span className="font-medium">: {payslipMonth}</span>
                  <span className="text-gray-600">Worked Days</span>
                  <span className="font-medium">: 26</span>
                </div>
                <div className="grid grid-cols-[130px_1fr] gap-x-2 gap-y-2">
                  <span className="text-gray-600">Employee name</span>
                  <span className="font-medium">: {selectedPayslipEmp.name}</span>
                  <span className="text-gray-600">Designation</span>
                  <span className="font-medium">: {selectedPayslipEmp.role}</span>
                  <span className="text-gray-600">Department</span>
                  <span className="font-medium">: {selectedPayslipEmp.department}</span>
                </div>
              </div>

              {/* Table */}
              <div className="border border-black text-[15px] mb-8">
                <div className="grid grid-cols-[1fr_120px_1fr_120px] bg-gray-100 border-b border-black font-semibold text-center divide-x divide-black">
                  <div className="p-3">Earnings</div>
                  <div className="p-3">Amount</div>
                  <div className="p-3">Deductions</div>
                  <div className="p-3">Amount</div>
                </div>
                
                <div className="grid grid-cols-[1fr_120px_1fr_120px] divide-x divide-black min-h-[200px]">
                  {/* Earnings Column */}
                  <div className="p-3 flex flex-col gap-2">
                    <div>Basic</div>
                    <div>Incentive Pay</div>
                    <div>House Rent Allowance</div>
                    <div>Meal Allowance</div>
                  </div>
                  {/* Earnings Amounts */}
                  <div className="p-3 flex flex-col gap-2 text-right">
                    <div>{selectedPayslipEmp.salary.basic}</div>
                    <div>{selectedPayslipEmp.salary.allowances > 0 ? selectedPayslipEmp.salary.allowances : 1000}</div>
                    <div>{selectedPayslipEmp.salary.hra}</div>
                    <div>200</div>
                  </div>
                  {/* Deductions Column */}
                  <div className="p-3 flex flex-col gap-2">
                    <div>Provident Fund</div>
                    <div>Profesional Tax</div>
                    <div>Loan</div>
                  </div>
                  {/* Deductions Amounts */}
                  <div className="p-3 flex flex-col gap-2 text-right">
                    <div>{Math.round(selectedPayslipEmp.salary.basic * 0.12)}</div>
                    <div>{selectedPayslipEmp.salary.deductions}</div>
                    <div>400</div>
                  </div>
                </div>

                {/* Totals Row */}
                <div className="grid grid-cols-[1fr_120px_1fr_120px] border-t border-black divide-x divide-black font-medium">
                  <div className="p-3 text-right">Total Earnings</div>
                  <div className="p-3 text-right">
                    {(selectedPayslipEmp.salary.basic + selectedPayslipEmp.salary.hra + (selectedPayslipEmp.salary.allowances > 0 ? selectedPayslipEmp.salary.allowances : 1000) + 200)}
                  </div>
                  <div className="p-3 text-right flex flex-col font-medium">
                    <span>Total Deductions</span>
                    <span className="mt-1 pb-1">Net Pay</span>
                  </div>
                  <div className="p-3 text-right flex flex-col font-medium">
                    <span>{(Math.round(selectedPayslipEmp.salary.basic * 0.12) + selectedPayslipEmp.salary.deductions + 400)}</span>
                    <span className="mt-1 pb-1">{(selectedPayslipEmp.salary.basic + selectedPayslipEmp.salary.hra + (selectedPayslipEmp.salary.allowances > 0 ? selectedPayslipEmp.salary.allowances : 1000) + 200) - (Math.round(selectedPayslipEmp.salary.basic * 0.12) + selectedPayslipEmp.salary.deductions + 400)}</span>
                  </div>
                </div>
              </div>

              {/* Net Pay Amount in Words */}
              <div className="text-center mb-16">
                <div className="font-medium text-[15px] mb-1">
                  {(selectedPayslipEmp.salary.basic + selectedPayslipEmp.salary.hra + (selectedPayslipEmp.salary.allowances > 0 ? selectedPayslipEmp.salary.allowances : 1000) + 200) - (Math.round(selectedPayslipEmp.salary.basic * 0.12) + selectedPayslipEmp.salary.deductions + 400)}
                </div>
                <div className="text-[15px] capitalize">
                  {numberToWords((selectedPayslipEmp.salary.basic + selectedPayslipEmp.salary.hra + (selectedPayslipEmp.salary.allowances > 0 ? selectedPayslipEmp.salary.allowances : 1000) + 200) - (Math.round(selectedPayslipEmp.salary.basic * 0.12) + selectedPayslipEmp.salary.deductions + 400))}
                </div>
              </div>

              {/* Signatures */}
              <div className="flex justify-between px-16 mb-20 mt-8">
                <div className="text-center">
                  <div className="mb-10 text-[15px]">Employer Signature</div>
                  <div className="w-56 border-b border-black"></div>
                </div>
                <div className="text-center">
                  <div className="mb-10 text-[15px]">Employee Signature</div>
                  <div className="w-56 border-b border-black"></div>
                </div>
              </div>

              {/* Footer */}
              <div className="text-center text-[15px] pb-4">
                This is system generated payslip
              </div>

            </div>

          </div>
        </div>
      )}

    </div>
  );
}
