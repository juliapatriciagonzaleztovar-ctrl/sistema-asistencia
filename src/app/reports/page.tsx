"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { exportToExcel, exportToPDF } from "@/lib/export";
import { getTodayDate } from "@/lib/utils";
import { DocumentArrowDownIcon, ChartBarIcon, UserGroupIcon, AcademicCapIcon } from "@heroicons/react/24/outline";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, PieChart, Pie, Cell } from "recharts";
import type { Child, Group, AttendanceChild, Teacher, Practitioner, AttendanceStaff } from "@/types/database";

interface ReportRow { childName: string; groupName: string; totalPresent: number; totalAbsent: number; percentage: number; }
interface StaffReportRow { staffName: string; type: string; totalPresent: number; totalAbsent: number; percentage: number; }
const COLORS = ["#10b981", "#ef4444"];

export default function ReportsPage() {
  const [reportData, setReportData] = useState<ReportRow[]>([]);
  const [staffReportData, setStaffReportData] = useState<StaffReportRow[]>([]);
  const [monthlyData, setMonthlyData] = useState<{ month: string; presentes: number; ausentes: number }[]>([]);
  const [filter, setFilter] = useState<"day" | "week" | "month" | "year">("month");
  const [groupId, setGroupId] = useState("all");
  const [reportTab, setReportTab] = useState<"children" | "staff">("children");
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadReport(); }, [filter, groupId]);

  async function loadReport() {
    setLoading(true);
    const now = new Date();
    let startDate: string, endDate: string;
    if (filter === "day") { startDate = endDate = getTodayDate(); }
    else if (filter === "week") {
      const day = now.getDay();
      const monday = new Date(now);
      monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      startDate = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`;
      endDate = `${sunday.getFullYear()}-${String(sunday.getMonth() + 1).padStart(2, "0")}-${String(sunday.getDate()).padStart(2, "0")}`;
    }
    else if (filter === "month") { startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`; endDate = getTodayDate(); }
    else { startDate = `${now.getFullYear()}-01-01`; endDate = getTodayDate(); }

    const [childrenSnap, groupsSnap, attendanceSnap, teachersSnap, practitionersSnap, staffAttendanceSnap] = await Promise.all([
      getDocs(query(collection(db, "children"), where("status", "==", "active"))),
      getDocs(collection(db, "groups")),
      getDocs(query(collection(db, "attendance_children"), where("attendance_date", ">=", startDate), where("attendance_date", "<=", endDate))),
      getDocs(query(collection(db, "teachers"), where("status", "==", "active"))),
      getDocs(query(collection(db, "practitioners"), where("status", "==", "active"))),
      getDocs(query(collection(db, "attendance_staff"), where("attendance_date", ">=", startDate), where("attendance_date", "<=", endDate))),
    ]);

    const groupsList = groupsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Group));
    setGroups(groupsList);
    const children = childrenSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Child));
    const attendance = attendanceSnap.docs.map((d) => ({ id: d.id, ...d.data() } as AttendanceChild));
    const filteredChildren = groupId === "all" ? children : children.filter((c) => c.group_id === groupId);

    setReportData(filteredChildren.map((child) => {
      const childAtt = attendance.filter((a) => a.child_id === child.id);
      const present = childAtt.filter((a) => a.status === "present").length;
      const absent = childAtt.filter((a) => a.status === "absent").length;
      const total = present + absent;
      return { childName: `${child.first_name} ${child.last_name}`, groupName: groupsList.find((g) => g.id === child.group_id)?.name || "Sin grupo", totalPresent: present, totalAbsent: absent, percentage: total > 0 ? Math.round((present / total) * 100) : 0 };
    }));

    const teachers = teachersSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Teacher));
    const practitioners = practitionersSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Practitioner));
    const staffAttendance = staffAttendanceSnap.docs.map((d) => ({ id: d.id, ...d.data() } as AttendanceStaff));
    const allStaff = [
      ...teachers.map((t) => ({ id: t.id, name: `${t.first_name} ${t.last_name}`, type: "Profesor" })),
      ...practitioners.map((p) => ({ id: p.id, name: `${p.first_name} ${p.last_name}`, type: "Practicante" })),
    ];
    setStaffReportData(allStaff.map((s) => {
      const sAtt = staffAttendance.filter((a) => a.staff_id === s.id);
      const present = sAtt.filter((a) => a.status !== "absent" || a.check_in).length;
      const absent = sAtt.filter((a) => a.status === "absent" && !a.check_in).length;
      const total = present + absent;
      return { staffName: s.name, type: s.type, totalPresent: present, totalAbsent: absent, percentage: total > 0 ? Math.round((present / total) * 100) : 0 };
    }));

    const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    const monthly: { month: string; presentes: number; ausentes: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = d.getFullYear(); const month = d.getMonth() + 1;
      const sDate = `${year}-${String(month).padStart(2, "0")}-01`;
      const endMonth = month === 12 ? 1 : month + 1; const endYear = month === 12 ? year + 1 : year;
      const eDate = `${endYear}-${String(endMonth).padStart(2, "0")}-01`;
      const monthAtt = attendance.filter((a) => a.attendance_date >= sDate && a.attendance_date < eDate);
      monthly.push({ month: monthNames[d.getMonth()], presentes: monthAtt.filter((a) => a.status === "present").length, ausentes: monthAtt.filter((a) => a.status === "absent").length });
    }
    setMonthlyData(monthly);
    setLoading(false);
  }

  function handleExportExcel() {
    if (reportTab === "children") {
      exportToExcel(reportData.map((r) => ({ "Nombre": r.childName, "Grupo": r.groupName, "Presentes": r.totalPresent, "Ausentes": r.totalAbsent, "% Asistencia": r.percentage })), `reporte_asistencia_ninos_${filter}`);
    } else {
      exportToExcel(staffReportData.map((r) => ({ "Nombre": r.staffName, "Tipo": r.type, "Presentes": r.totalPresent, "Ausentes": r.totalAbsent, "% Asistencia": r.percentage })), `reporte_asistencia_personal_${filter}`);
    }
  }
  function handleExportPDF() {
    if (reportTab === "children") {
      exportToPDF("Reporte de Asistencia Infantil", ["Nombre", "Grupo", "Presentes", "Ausentes", "% Asistencia"], reportData.map((r) => [r.childName, r.groupName, String(r.totalPresent), String(r.totalAbsent), `${r.percentage}%`]), `reporte_asistencia_ninos_${filter}`);
    } else {
      exportToPDF("Reporte de Asistencia Personal", ["Nombre", "Tipo", "Presentes", "Ausentes", "% Asistencia"], staffReportData.map((r) => [r.staffName, r.type, String(r.totalPresent), String(r.totalAbsent), `${r.percentage}%`]), `reporte_asistencia_personal_${filter}`);
    }
  }

  const totalPresent = reportData.reduce((acc, r) => acc + r.totalPresent, 0);
  const totalAbsent = reportData.reduce((acc, r) => acc + r.totalAbsent, 0);
  const staffTotalPresent = staffReportData.reduce((acc, r) => acc + r.totalPresent, 0);
  const staffTotalAbsent = staffReportData.reduce((acc, r) => acc + r.totalAbsent, 0);
  const currentPresent = reportTab === "children" ? totalPresent : staffTotalPresent;
  const currentAbsent = reportTab === "children" ? totalAbsent : staffTotalAbsent;
  const pieData = [{ name: "Presentes", value: currentPresent || 0 }, { name: "Ausentes", value: currentAbsent || 0 }];

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><div className="flex flex-col items-center gap-3"><div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" /><span className="text-sm font-medium text-gray-500 dark:text-gray-400">Generando reportes...</span></div></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl gradient-primary flex items-center justify-center shadow-md"><ChartBarIcon className="w-6 h-6 text-white" /></div>
          <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Reportes</h1><p className="text-sm text-gray-500 dark:text-gray-400">Analisis de asistencia</p></div>
        </div>
        <div className="flex gap-2">
          <button onClick={handleExportExcel} className="px-4 py-2 rounded-xl text-sm font-semibold bg-white dark:bg-[#1a2438] text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:border-primary shadow-sm flex items-center gap-2"><DocumentArrowDownIcon className="w-4 h-4" /> Excel</button>
          <button onClick={handleExportPDF} className="px-4 py-2 rounded-xl text-sm font-semibold bg-white dark:bg-[#1a2438] text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:border-primary shadow-sm flex items-center gap-2"><DocumentArrowDownIcon className="w-4 h-4" /> PDF</button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button onClick={() => setReportTab("children")} className={`px-4 py-2 rounded-xl text-[13px] font-semibold transition-all duration-200 ${reportTab === "children" ? "gradient-primary text-white shadow-md" : "bg-white dark:bg-[#1a2438] text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:border-primary"}`}>
          <span className="flex items-center gap-2"><UserGroupIcon className="w-4 h-4" /> Ninos</span>
        </button>
        <button onClick={() => setReportTab("staff")} className={`px-4 py-2 rounded-xl text-[13px] font-semibold transition-all duration-200 ${reportTab === "staff" ? "gradient-primary text-white shadow-md" : "bg-white dark:bg-[#1a2438] text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:border-primary"}`}>
          <span className="flex items-center gap-2"><AcademicCapIcon className="w-4 h-4" /> Personal</span>
        </button>
        {(["day", "week", "month", "year"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`px-4 py-2 rounded-xl text-[13px] font-semibold transition-all duration-200 ${filter === f ? "gradient-primary text-white shadow-md" : "bg-white dark:bg-[#1a2438] text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:border-primary"}`}>
            {f === "day" ? "Dia" : f === "week" ? "Semana" : f === "month" ? "Mes" : "Ano"}
          </button>
        ))}
        {reportTab === "children" && (
          <select value={groupId} onChange={(e) => setGroupId(e.target.value)} className="px-4 py-2 rounded-xl text-[13px] font-semibold bg-white dark:bg-[#1a2438] text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700">
            <option value="all">Todos los grupos</option>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="bg-white dark:bg-[#1a2438] rounded-2xl p-5 border border-gray-100 dark:border-gray-800 shadow-sm text-center"><p className="text-3xl font-bold text-gray-900 dark:text-white">{reportTab === "children" ? reportData.length : staffReportData.length}</p><p className="text-[12px] font-medium text-gray-500 dark:text-gray-400">{reportTab === "children" ? "Ninos evaluados" : "Personal evaluado"}</p></div>
        <div className="bg-white dark:bg-[#1a2438] rounded-2xl p-5 border border-gray-100 dark:border-gray-800 shadow-sm text-center"><p className="text-3xl font-bold text-emerald-500">{reportTab === "children" ? totalPresent : staffTotalPresent}</p><p className="text-[12px] font-medium text-gray-500 dark:text-gray-400">Total asistencias</p></div>
        <div className="bg-white dark:bg-[#1a2438] rounded-2xl p-5 border border-gray-100 dark:border-gray-800 shadow-sm text-center"><p className="text-3xl font-bold text-red-500">{reportTab === "children" ? totalAbsent : staffTotalAbsent}</p><p className="text-[12px] font-medium text-gray-500 dark:text-gray-400">Total ausencias</p></div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="bg-white dark:bg-[#1a2438] rounded-2xl p-6 border border-gray-100 dark:border-gray-800 shadow-sm">
          <h3 className="mb-4 text-base font-bold text-gray-900 dark:text-white">Tendencia Mensual</h3>
          <div className="h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={monthlyData}><CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" /><XAxis dataKey="month" tick={{ fontSize: 12, fill: "#9ca3af" }} axisLine={false} tickLine={false} /><YAxis tick={{ fontSize: 12, fill: "#9ca3af" }} axisLine={false} tickLine={false} /><Tooltip contentStyle={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }} /><Legend /><Bar dataKey="presentes" name="Presentes" fill="#10b981" radius={[6, 6, 0, 0]} /><Bar dataKey="ausentes" name="Ausentes" fill="#ef4444" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></div>
        </div>
        <div className="bg-white dark:bg-[#1a2438] rounded-2xl p-6 border border-gray-100 dark:border-gray-800 shadow-sm">
          <h3 className="mb-4 text-base font-bold text-gray-900 dark:text-white">Distribucion</h3>
          <div className="h-64 flex items-center justify-center">
            {currentPresent > 0 || currentAbsent > 0 ? (<ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={5} dataKey="value">{pieData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}</Pie><Tooltip /><Legend /></PieChart></ResponsiveContainer>) : <p className="text-gray-500 dark:text-gray-400">Sin datos para mostrar</p>}
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-[#1a2438] rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-100 dark:border-gray-800">
              <th className="text-left px-5 py-3.5 font-semibold text-gray-500 dark:text-gray-400">Nombre</th>
              {reportTab === "children" && <th className="text-left px-5 py-3.5 font-semibold text-gray-500 dark:text-gray-400">Grupo</th>}
              {reportTab === "staff" && <th className="text-left px-5 py-3.5 font-semibold text-gray-500 dark:text-gray-400">Tipo</th>}
              <th className="text-center px-5 py-3.5 font-semibold text-gray-500 dark:text-gray-400">Presentes</th>
              <th className="text-center px-5 py-3.5 font-semibold text-gray-500 dark:text-gray-400">Ausentes</th>
              <th className="text-center px-5 py-3.5 font-semibold text-gray-500 dark:text-gray-400">% Asistencia</th>
            </tr></thead>
            <tbody>
              {reportTab === "children" ? reportData.map((r, i) => (
                <tr key={i} className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-[#1e293b] transition-colors">
                  <td className="px-5 py-3.5 font-medium text-gray-900 dark:text-white">{r.childName}</td>
                  <td className="px-5 py-3.5 text-gray-500 dark:text-gray-400">{r.groupName}</td>
                  <td className="px-5 py-3.5 text-center font-bold text-emerald-500">{r.totalPresent}</td>
                  <td className="px-5 py-3.5 text-center font-bold text-red-500">{r.totalAbsent}</td>
                  <td className="px-5 py-3.5 text-center"><span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${r.percentage >= 80 ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400" : r.percentage >= 60 ? "bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400" : "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400"}`}>{r.percentage}%</span></td>
                </tr>
              )) : staffReportData.map((r, i) => (
                <tr key={i} className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-[#1e293b] transition-colors">
                  <td className="px-5 py-3.5 font-medium text-gray-900 dark:text-white">{r.staffName}</td>
                  <td className="px-5 py-3.5"><span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${r.type === "Profesor" ? "bg-primary/10 text-primary" : "bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400"}`}>{r.type}</span></td>
                  <td className="px-5 py-3.5 text-center font-bold text-emerald-500">{r.totalPresent}</td>
                  <td className="px-5 py-3.5 text-center font-bold text-red-500">{r.totalAbsent}</td>
                  <td className="px-5 py-3.5 text-center"><span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${r.percentage >= 80 ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400" : r.percentage >= 60 ? "bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400" : "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400"}`}>{r.percentage}%</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {(reportTab === "children" ? reportData.length === 0 : staffReportData.length === 0) && <div className="py-12 text-center text-gray-500 dark:text-gray-400">No hay datos para mostrar en este periodo.</div>}
      </div>
    </div>
  );
}
