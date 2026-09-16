import React from 'react';
import { Employee } from '../../types';

export default function OrgChartView({ employees }: { employees: Employee[] }) {
  const departments = [...new Set(employees.map(employee => employee.department))].sort();
  return <div className="space-y-6">
    <div><h1 className="text-2xl font-bold">Departments</h1><p className="text-sm text-slate-500 mt-1">People grouped by department. Reporting managers and reporting lines are not yet configured.</p></div>
    {!departments.length && <p className="account-panel text-sm text-slate-500">Add employees to view your departments here.</p>}
    <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">{departments.map(department => {
      const members = employees.filter(employee => employee.department === department);
      return <details open key={department} className="account-panel">
        <summary className="font-bold cursor-pointer">{department} <span className="text-xs text-slate-500 font-normal">({members.length})</span></summary>
        <ul className="mt-4 divide-y divide-slate-200 dark:divide-slate-800">{members.map(employee => <li key={employee.id} className="flex gap-3 items-center py-3">
          <img src={employee.avatar || '/avatar.svg'} alt="" className="w-9 h-9 rounded-full object-cover"/>
          <div><p className="font-medium text-sm">{employee.name}</p><p className="text-xs text-slate-500">{employee.role} · {employee.status}</p></div>
        </li>)}</ul>
      </details>;
    })}</div>
  </div>;
}
