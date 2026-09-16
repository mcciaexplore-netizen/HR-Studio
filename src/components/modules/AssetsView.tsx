import React, { useState } from 'react';
import { 
  Laptop, 
  Monitor, 
  Smartphone, 
  HardDrive, 
  Plus, 
  Trash2, 
  Search, 
  UserCheck, 
  Cpu, 
  Clock,
  ShieldCheck,
  XCircle
} from 'lucide-react';
import { Asset, Employee } from '../../types';

interface AssetsViewProps {
  assets: Asset[];
  employees: Employee[];
  onAddAsset: (asset: Omit<Asset, 'id'>) => Promise<boolean>;
  onUpdateAssetStatus: (id: string, status: Asset['status'], assignedToId?: string) => void;
  onDeleteAsset: (id: string) => void;
}

export default function AssetsView({
  assets,
  employees,
  onAddAsset,
  onUpdateAssetStatus,
  onDeleteAsset
}: AssetsViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  // New Asset states
  const [name, setName] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [category, setCategory] = useState<'Laptop' | 'Monitor' | 'Mobile' | 'Other'>('Laptop');
  const [assignedToId, setAssignedToId] = useState('');

  const filteredAssets = assets.filter(ast => 
    ast.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ast.serialNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (ast.assignedToName && ast.assignedToName.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const emp = employees.find(x => x.id === assignedToId);
    
    const saved = await onAddAsset({
      name,
      serialNumber,
      category,
      status: assignedToId ? 'Assigned' : 'Available',
      assignedToId: assignedToId || undefined,
      assignedToName: emp ? emp.name : undefined,
      purchaseDate: new Date().toISOString().split('T')[0]
    });

    if (!saved) return;
    setShowAddModal(false);
    setName('');
    setSerialNumber('');
    setAssignedToId('');
  };

  const getCategoryIcon = (cat: Asset['category']) => {
    switch (cat) {
      case 'Laptop': return Laptop;
      case 'Monitor': return Monitor;
      case 'Mobile': return Smartphone;
      default: return HardDrive;
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Banner */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Hardware Asset Directory</h2>
          <p className="text-xs text-slate-500">Inventory active equipment, track custody logs, and review system configuration parameters</p>
        </div>

        <button 
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-500 active:scale-95 text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Onboard Asset</span>
        </button>
      </div>

      {/* Grid search filters */}
      <div className="flex bg-slate-950/20 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
        <Search className="w-4 h-4 text-slate-500 ml-1.5 mr-2 mt-2" />
        <input 
          type="text"
          placeholder="Search devices by name, serial key, or employee..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="w-full bg-transparent border-none text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-500 outline-none"
        />
      </div>

      {/* Directory cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredAssets.map(ast => {
          const Icon = getCategoryIcon(ast.category);
          return (
            <div 
              key={ast.id}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl flex flex-col justify-between shadow-sm dark:shadow-none relative group"
            >
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-lg bg-slate-950 flex items-center justify-center border border-slate-800 shrink-0">
                      <Icon className="w-4 h-4 text-purple-400" />
                    </div>
                    
                    <button
                      onClick={() => {
                        if (confirm(`Are you sure you want to decommission and permanently remove ${ast.name} (Serial: ${ast.serialNumber})?`)) {
                          onDeleteAsset(ast.id);
                        }
                      }}
                      className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-rose-500 hover:border-rose-500/20 bg-slate-50 dark:bg-slate-950 transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
                      title="Decommission Asset"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold border ${
                    ast.status === 'Assigned' 
                      ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' 
                      : ast.status === 'Available' 
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                  }`}>
                    {ast.status}
                  </span>
                </div>

                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">{ast.name}</h4>
                  <span className="text-[10px] text-slate-500 font-mono block">Serial: {ast.serialNumber}</span>
                </div>

                {/* Custodian details block */}
                <div className="border-t border-slate-100 dark:border-slate-800/60 pt-3 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Assigned custodian:</span>
                    <span className="font-bold text-slate-900 dark:text-white">{ast.assignedToName || 'In Inventory'}</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-500">
                    <span>Provisioned on:</span>
                    <span className="font-mono">{ast.purchaseDate}</span>
                  </div>
                </div>
              </div>

              {/* Status controller inline */}
              <div className="flex justify-between items-center pt-3 border-t border-slate-100 dark:border-slate-800/40 mt-4 text-[9px]">
                <span className="text-slate-500">Asset: {ast.id}</span>
                
                <select
                  aria-label={`Assignment or status for ${ast.name}`}
                  value={ast.status==='Assigned' ? ast.assignedToId : ast.status}
                  onChange={e => {
                    const value=e.target.value;
                    if (value==='Available' || value==='Maintenance') onUpdateAssetStatus(ast.id,value);
                    else onUpdateAssetStatus(ast.id,'Assigned',value);
                  }}
                  className="bg-transparent text-[9px] text-slate-400 font-bold outline-none cursor-pointer border-none"
                >
                  <option value="Available">Available</option>
                  <option value="Maintenance">Maintenance</option>
                  {employees.map(emp=><option key={emp.id} value={emp.id}>Assign: {emp.name}</option>)}
                </select>
              </div>
            </div>
          );
        })}
      </div>

      {/* Onboard Asset Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md overflow-hidden flex flex-col transition-colors">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Onboard Hardware Equipment</h3>
              <button 
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-mono text-slate-500 dark:text-slate-400 block">Model Name / Description</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. MacBook Pro 16"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs rounded-lg p-2.5 text-slate-900 dark:text-white outline-none focus:border-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-mono text-slate-500 dark:text-slate-400 block">Serial Number</label>
                  <input
                    type="text"
                    required
                    value={serialNumber}
                    onChange={e => setSerialNumber(e.target.value)}
                    placeholder="e.g. C02XG..."
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs rounded-lg p-2.5 text-slate-900 dark:text-white outline-none focus:border-purple-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-mono text-slate-500 dark:text-slate-400 block">Category</label>
                  <select
                    value={category}
                    onChange={e => setCategory(e.target.value as any)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs rounded-lg p-2.5 text-slate-900 dark:text-white outline-none"
                  >
                    <option value="Laptop">Laptop</option>
                    <option value="Monitor">Monitor</option>
                    <option value="Mobile">Mobile</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-mono text-slate-500 dark:text-slate-400 block">Assign Direct Custody (Optional)</label>
                <select
                  value={assignedToId}
                  onChange={e => setAssignedToId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs rounded-lg p-2.5 text-slate-900 dark:text-white outline-none"
                >
                  <option value="">-- Remain in Inventory --</option>
                  {employees.map(e => (
                    <option key={e.id} value={e.id}>{e.name} ({e.id})</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2.5 rounded-lg bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-500 dark:text-slate-400 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-xs font-bold text-white transition-all shadow-md"
                >
                  Confirm Asset
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
