"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, PieChart, Pie, Cell } from "recharts";

const COLORS = ["#10b981", "#ef4444"];

export function BarChartComp({ data }: { data: { month: string; presentes: number; ausentes: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 12, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }} />
        <Legend />
        <Bar dataKey="presentes" name="Presentes" fill="#10b981" radius={[6, 6, 0, 0]} />
        <Bar dataKey="ausentes" name="Ausentes" fill="#ef4444" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function PieChartComp({ present, absent }: { present: number; absent: number }) {
  const data = [
    { name: "Presentes", value: present || 0 },
    { name: "Ausentes", value: absent || 0 },
  ];
  if (present <= 0 && absent <= 0) {
    return <p className="text-gray-500 dark:text-gray-400">Sin datos para mostrar</p>;
  }
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={5} dataKey="value">
          {data.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}