import React, { useState } from 'react';
import { 
  Sparkles, 
  Printer, 
  Layers, 
  Mail, 
  Phone, 
  Calendar, 
  RotateCw, 
  QrCode,
  ShieldCheck
} from 'lucide-react';
import { Employee } from '../types';

interface IDCardViewProps {
  employees: Employee[];
  companyName: string;
}

export default function IDCardView({ employees, companyName }: IDCardViewProps) {
  const [selectedEmpId, setSelectedEmpId] = useState(employees[0]?.id || '');
  const [cardColor, setCardColor] = useState('#8b5cf6'); // Default violet
  const [isFlipped, setIsFlipped] = useState(false);

  const selectedEmp = employees.find(e => e.id === selectedEmpId) || employees[0];

  const colorPresets = [
    { label: "Violet", val: "#8b5cf6" },
    { label: "Indigo", val: "#6366f1" },
    { label: "Emerald", val: "#10b981" },
    { label: "Blue", val: "#3b82f6" },
    { label: "Rose", val: "#f43f5e" }
  ];

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      
      {/* Top Title Banner */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Employee ID Card Preview</h2>
          <p className="text-xs text-slate-500">Design and generate printable, high-resolution company identity badges</p>
        </div>

        <button
          onClick={handlePrint}
          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 shrink-0"
        >
          <Printer className="w-4 h-4" />
          <span>Print/Save PDF</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        
        {/* Designer Settings Panel */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm space-y-5 self-start transition-colors">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">ID Card Properties</h3>
          
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-mono text-slate-400 font-semibold block">Target Employee</label>
            <select
              value={selectedEmpId}
              onChange={e => setSelectedEmpId(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs rounded-lg p-2.5 text-slate-900 dark:text-slate-100 outline-none focus:border-purple-500"
            >
              {employees.map(e => (
                <option key={e.id} value={e.id}>{e.name} ({e.role})</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] uppercase font-mono text-slate-400 font-semibold block">Brand Color Scheme</label>
            <div className="flex gap-2">
              {colorPresets.map(col => (
                <button
                  key={col.val}
                  onClick={() => setCardColor(col.val)}
                  style={{ backgroundColor: col.val }}
                  className={`w-8 h-8 rounded-full border-2 transition-all relative ${
                    cardColor === col.val ? 'border-white scale-110 shadow-lg' : 'border-transparent hover:scale-105'
                  }`}
                  title={col.label}
                >
                  {cardColor === col.val && (
                    <div className="absolute inset-0.5 border border-slate-950/20 rounded-full" />
                  )}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => setIsFlipped(!isFlipped)}
            className="w-full py-2.5 rounded-lg bg-slate-100 dark:bg-slate-950 hover:bg-slate-200 dark:hover:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all flex items-center justify-center gap-1.5"
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span>Flip Badge ({isFlipped ? "Show Front" : "Show Back"})</span>
          </button>
        </div>

        {/* Live Visual Card Showcase */}
        {selectedEmp && (
          <div className="lg:col-span-3 flex flex-col items-center justify-center min-h-[400px] bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/60 rounded-2xl p-6 relative overflow-hidden transition-colors">
            
            {/* Ambient Background decoration */}
            <div 
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full blur-[100px] opacity-10 pointer-events-none transition-colors duration-500" 
              style={{ backgroundColor: cardColor }}
            />

            {/* Simulated Badge Holder Frame */}
            <div className="relative group perspective">
              
              {/* Actual 3D interactive Card Element */}
              <div 
                className={`w-[260px] h-[400px] rounded-2xl shadow-2xl relative transition-all duration-700 transform-style`}
                style={{
                  transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)'
                }}
              >
                
                {/* FRONT OF THE ID CARD */}
                <div 
                  className="absolute inset-0 bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden flex flex-col justify-between backface-hidden"
                  style={{ transform: 'rotateY(0deg)' }}
                >
                  {/* Top Header Background wave with cardColor */}
                  <div 
                    className="h-[120px] p-5 flex flex-col justify-between relative overflow-hidden transition-colors duration-500"
                    style={{ backgroundColor: cardColor }}
                  >
                    <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-white/10 blur-xl pointer-events-none" />
                    
                    {/* Brand metadata */}
                    <div className="flex items-center justify-between text-white">
                      <div className="flex items-center gap-1">
                        <Layers className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-black tracking-widest">{companyName}</span>
                      </div>
                      <ShieldCheck className="w-4 h-4 text-white/80" />
                    </div>

                    <div className="text-white">
                      <span className="text-[8px] tracking-wider uppercase opacity-75 block font-mono">STAFF DIRECTORY</span>
                      <span className="text-[9px] font-mono uppercase tracking-widest font-black">EMPLOYEE BADGE</span>
                    </div>
                  </div>

                  {/* Profile Avatar Container */}
                  <div className="relative -mt-10 flex justify-center">
                    <img 
                      src={selectedEmp.avatar || '/avatar.svg'}
                      alt={selectedEmp.name} 
                      className="w-20 h-20 rounded-full object-cover border-4 border-slate-950 shadow-md"
                    />
                  </div>

                  {/* Staff detail layout */}
                  <div className="text-center px-4 py-2 space-y-1">
                    <h4 className="text-sm font-black tracking-tight text-white leading-tight">{selectedEmp.name}</h4>
                    <span className="text-[10px] text-slate-400 block font-semibold">{selectedEmp.role}</span>
                    <span 
                      className="inline-block px-2.5 py-0.5 rounded text-[8px] font-mono tracking-wider text-white mt-1 uppercase"
                      style={{ backgroundColor: `${cardColor}25`, border: `1px solid ${cardColor}40` }}
                    >
                      {selectedEmp.department}
                    </span>
                  </div>

                  {/* Identity metadata Footer */}
                  <div className="bg-slate-900/60 border-t border-slate-900/80 p-4 flex justify-between items-center text-[9px] font-mono text-slate-500">
                    <div>
                      <span className="block text-[7px] uppercase tracking-wider text-slate-500">EXPRESS ID</span>
                      <span className="font-bold text-slate-300">{selectedEmp.id}</span>
                    </div>
                    <div className="text-right">
                      <span className="block text-[7px] uppercase tracking-wider text-slate-500">JOIN DATE</span>
                      <span className="font-bold text-slate-300">{selectedEmp.hireDate}</span>
                    </div>
                  </div>

                </div>

                {/* BACK OF THE ID CARD */}
                <div 
                  className="absolute inset-0 bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden flex flex-col justify-between p-5 backface-hidden"
                  style={{ transform: 'rotateY(180deg)' }}
                >
                  
                  {/* Security Terms block */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-1 pb-2 border-b border-slate-900">
                      <ShieldCheck className="w-4 h-4" style={{ color: cardColor }} />
                      <span className="text-[9px] font-bold text-white tracking-wider">EMPLOYEE IDENTIFICATION</span>
                    </div>
                    
                    <ul className="text-[7px] text-slate-500 space-y-1 leading-normal list-disc pl-3 font-mono">
                      <li>Employee identification preview for {companyName}.</li>
                      <li>Card is non-transferable. Loss must be reported instantly to HR Operations.</li>
                      <li>Access control and biometric verification are not connected.</li>
                    </ul>
                  </div>

                  {/* Centered QR scan representing staff signature */}
                  <div className="flex flex-col items-center justify-center space-y-2 py-4">
                    <div aria-hidden="true" className="p-2 bg-white rounded-lg inline-block">
                      {/* Interactive CSS SVG representation of QR code */}
                      <svg className="w-20 h-20 text-slate-950" viewBox="0 0 100 100" fill="currentColor">
                        <rect x="0" y="0" width="20" height="20" />
                        <rect x="0" y="80" width="20" height="20" />
                        <rect x="80" y="0" width="20" height="20" />
                        <rect x="25" y="25" width="10" height="10" />
                        <rect x="45" y="10" width="15" height="15" />
                        <rect x="10" y="45" width="15" height="15" />
                        <rect x="65" y="45" width="20" height="10" />
                        <rect x="45" y="65" width="10" height="20" />
                        <rect x="75" y="75" width="15" height="15" />
                      </svg>
                    </div>
                    <span className="text-[8px] font-mono text-slate-500 block">DECORATIVE PATTERN — NOT A SCANNABLE CODE</span>
                  </div>

                  {/* Return instruction footer */}
                  <div className="border-t border-slate-900/60 pt-2 text-center text-[7px] text-slate-500 font-mono">
                    If found, return to the HR team at {companyName}.
                  </div>

                </div>

              </div>
            </div>

            <span className="text-[10px] text-slate-500 mt-6 block">
              Click "Flip Badge" to view the back. This is a printable preview.
            </span>
          </div>
        )}

      </div>

    </div>
  );
}
