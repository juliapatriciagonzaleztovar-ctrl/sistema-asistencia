"use client";

import { useEffect, useState, useMemo } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import { exportToExcel, exportToPDF, exportToPDFDetail, type PDFDetailRow } from "@/lib/export";
import { getTodayDate, isWeekday } from "@/lib/utils";
import { DocumentArrowDownIcon, ChartBarIcon, UserGroupIcon, AcademicCapIcon, CalendarDaysIcon, TableCellsIcon, UserIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { DynamicBarChart, DynamicPieChart } from "@/components/charts/DynamicCharts";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import type { Child, Group, AttendanceChild, Teacher, Practitioner, AttendanceStaff } from "@/types/database";

interface ReportRow { childName: string; groupName: string; totalPresent: number; totalAbsent: number; percentage: number; }
interface StaffReportRow { staffName: string; type: string; totalPresent: number; totalAbsent: number; percentage: number; }
interface SpecificRow { id: string; name: string; groupOrType: string; date: string; status: string; statusLabel: string; signatureUrl: string | null; }
interface PersonDayRow { date: string; dateFormatted: string; dayName: string; status: "present" | "absent"; statusLabel: string; checkIn: string | null; signatureUrl: string | null; }
interface PersonOption { id: string; name: string; subtitle: string; type: "child" | "teacher" | "practitioner"; }

export default function ReportsPage() {
  const [reportData, setReportData] = useState<ReportRow[]>([]);
  const [staffReportData, setStaffReportData] = useState<StaffReportRow[]>([]);
  const [monthlyData, setMonthlyData] = useState<{ month: string; presentes: number; ausentes: number }[]>([]);
  const [filter, setFilter] = useState<"day" | "week" | "month" | "year">("month");
  const [groupId, setGroupId] = useState("all");
  const [reportTab, setReportTab] = useState<"children" | "staff">("children");
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);

  const [reportType, setReportType] = useState<"aggregate" | "specific" | "person">("aggregate");
  const [selectedDate, setSelectedDate] = useState(getTodayDate());
  const [specificData, setSpecificData] = useState<SpecificRow[]>([]);

  const [personSearch, setPersonSearch] = useState("");
  const [personResults, setPersonResults] = useState<PersonOption[]>([]);
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [selectedPersonName, setSelectedPersonName] = useState("");
  const [personHistory, setPersonHistory] = useState<PersonDayRow[]>([]);
  const [allPeople, setAllPeople] = useState<PersonOption[]>([]);

  useEffect(() => { loadReport(); }, [filter, groupId]);
  useEffect(() => { if (reportType === "specific") loadSpecificDate(); }, [selectedDate, reportType, reportTab]);
  useEffect(() => { if (reportType === "person") loadAllPeople(); }, [reportType, reportTab]);
  useEffect(() => { if (selectedPersonId) loadPersonHistory(); }, [selectedPersonId]);

  useEffect(() => {
    if (personSearch.trim().length > 0 && allPeople.length > 0) {
      const term = personSearch.toLowerCase();
      const filtered = allPeople.filter((p) =>
        p.name.toLowerCase().includes(term) || p.subtitle.toLowerCase().includes(term) || (p.type === "child" && p.id.toLowerCase().includes(term))
      );
      setPersonResults(filtered.slice(0, 20));
    } else {
      setPersonResults([]);
    }
  }, [personSearch, allPeople]);

  async function loadAllPeople() {
    setLoading(true);
    const [childrenSnap, groupsSnap, teachersSnap, practitionersSnap] = await Promise.all([
      getDocs(query(collection(getFirebaseDb(), "children"), where("status", "==", "active"))),
      getDocs(collection(getFirebaseDb(), "groups")),
      getDocs(query(collection(getFirebaseDb(), "teachers"), where("status", "==", "active"))),
      getDocs(query(collection(getFirebaseDb(), "practitioners"), where("status", "==", "active"))),
    ]);
    const groupsList = groupsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Group));
    setGroups(groupsList);
    const children = childrenSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Child));
    const teachers = teachersSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Teacher));
    const practitioners = practitionersSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Practitioner));

    const people: PersonOption[] = [
      ...children.map((c) => ({
        id: c.id,
        name: `${c.first_name} ${c.last_name}`,
        subtitle: `${c.child_id_code || ""} · ${groupsList.find((g) => g.id === c.group_id)?.name || "Sin grupo"}`,
        type: "child" as const,
      })),
      ...teachers.map((t) => ({
        id: t.id,
        name: `${t.first_name} ${t.last_name}`,
        subtitle: `Profesor · ${t.document || ""}`,
        type: "teacher" as const,
      })),
      ...practitioners.map((p) => ({
        id: p.id,
        name: `${p.first_name} ${p.last_name}`,
        subtitle: `Practicante · ${p.document || ""}`,
        type: "practitioner" as const,
      })),
    ];
    setAllPeople(people);
    setLoading(false);
  }

  async function loadPersonHistory() {
    if (!selectedPersonId) return;
    setLoading(true);
    const person = allPeople.find((p) => p.id === selectedPersonId);
    const isChild = person?.type === "child";

    const attSnap = await getDocs(query(
      collection(getFirebaseDb(), isChild ? "attendance_children" : "attendance_staff"),
      isChild ? where("child_id", "==", selectedPersonId) : where("staff_id", "==", selectedPersonId)
    ));

    const rawAtt = attSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const weekdayAtt = rawAtt.filter((a: Record<string, unknown>) => isWeekday(a.attendance_date as string));

    const history: PersonDayRow[] = weekdayAtt
      .map((a: Record<string, unknown>) => {
        const dateStr = a.attendance_date as string;
        const date = new Date(dateStr + "T12:00:00");
        const status = isChild
          ? (a.status as string === "present" ? "present" : "absent")
          : ((a.status as string !== "absent" || a.check_in) ? "present" : "absent");
        return {
          date: dateStr,
          dateFormatted: date.toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" }),
          dayName: date.toLocaleDateString("es-CO", { weekday: "long" }),
          status: status as "present" | "absent",
          statusLabel: status === "present" ? "Asistio" : "No asistio",
          checkIn: (a.check_in as string) || null,
          signatureUrl: (a.signature_url as string) || null,
        };
      })
      .sort((a, b) => b.date.localeCompare(a.date));

    setPersonHistory(history);
    setLoading(false);
  }

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
      getDocs(query(collection(getFirebaseDb(), "children"), where("status", "==", "active"))),
      getDocs(collection(getFirebaseDb(), "groups")),
      getDocs(query(collection(getFirebaseDb(), "attendance_children"), where("attendance_date", ">=", startDate), where("attendance_date", "<=", endDate))),
      getDocs(query(collection(getFirebaseDb(), "teachers"), where("status", "==", "active"))),
      getDocs(query(collection(getFirebaseDb(), "practitioners"), where("status", "==", "active"))),
      getDocs(query(collection(getFirebaseDb(), "attendance_staff"), where("attendance_date", ">=", startDate), where("attendance_date", "<=", endDate))),
    ]);

    const groupsList = groupsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Group));
    setGroups(groupsList);
    const children = childrenSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Child));
    const attendance = attendanceSnap.docs.map((d) => ({ id: d.id, ...d.data() } as AttendanceChild)).filter((a) => isWeekday(a.attendance_date));
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
    const staffAttendance = staffAttendanceSnap.docs.map((d) => ({ id: d.id, ...d.data() } as AttendanceStaff)).filter((a) => isWeekday(a.attendance_date));
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

  async function loadSpecificDate() {
    if (!isWeekday(selectedDate)) { setSpecificData([]); setLoading(false); return; }
    setLoading(true);
    const [childrenSnap, groupsSnap, attChildSnap, teachersSnap, practitionersSnap, attStaffSnap] = await Promise.all([
      getDocs(query(collection(getFirebaseDb(), "children"), where("status", "==", "active"))),
      getDocs(collection(getFirebaseDb(), "groups")),
      getDocs(query(collection(getFirebaseDb(), "attendance_children"), where("attendance_date", "==", selectedDate))),
      getDocs(query(collection(getFirebaseDb(), "teachers"), where("status", "==", "active"))),
      getDocs(query(collection(getFirebaseDb(), "practitioners"), where("status", "==", "active"))),
      getDocs(query(collection(getFirebaseDb(), "attendance_staff"), where("attendance_date", "==", selectedDate))),
    ]);

    const groupsList = groupsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Group));
    setGroups(groupsList);
    const children = childrenSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Child));
    const attChild = attChildSnap.docs.map((d) => ({ id: d.id, ...d.data() } as AttendanceChild));
    const teachers = teachersSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Teacher));
    const practitioners = practitionersSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Practitioner));
    const attStaff = attStaffSnap.docs.map((d) => ({ id: d.id, ...d.data() } as AttendanceStaff));

    const dateFormatted = new Date(selectedDate + "T12:00:00").toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" });

    if (reportTab === "children") {
      const childRows: SpecificRow[] = children.map((child) => {
        const att = attChild.find((a) => a.child_id === child.id);
        const groupName = groupsList.find((g) => g.id === child.group_id)?.name || "Sin grupo";
        return { id: child.id, name: `${child.first_name} ${child.last_name}`, groupOrType: groupName, date: dateFormatted, status: att?.status || "absent", statusLabel: att?.status === "present" ? "Asistio" : "No asistio", signatureUrl: null };
      });
      setSpecificData(childRows);
    } else {
      const staffRows: SpecificRow[] = [
        ...teachers.map((t) => { const att = attStaff.find((a) => a.staff_id === t.id && a.staff_type === "teacher"); return { id: t.id, name: `${t.first_name} ${t.last_name}`, groupOrType: "Profesor", date: dateFormatted, status: att ? (att.status === "absent" && !att.check_in ? "absent" : "present") : "absent", statusLabel: att ? (att.status === "absent" && !att.check_in ? "No asistio" : "Asistio") : "No asistio", signatureUrl: att?.signature_url || null }; }),
        ...practitioners.map((p) => { const att = attStaff.find((a) => a.staff_id === p.id && a.staff_type === "practitioner"); return { id: p.id, name: `${p.first_name} ${p.last_name}`, groupOrType: "Practicante", date: dateFormatted, status: att ? (att.status === "absent" && !att.check_in ? "absent" : "present") : "absent", statusLabel: att ? (att.status === "absent" && !att.check_in ? "No asistio" : "Asistio") : "No asistio", signatureUrl: att?.signature_url || null }; }),
      ];
      setSpecificData(staffRows);
    }
    setLoading(false);
  }

  function handleExportExcel() {
    if (reportType === "person" && selectedPersonId) {
      exportToExcel(personHistory.map((r) => ({ "Fecha": r.dateFormatted, "Dia": r.dayName, "Asistencia": r.statusLabel, ...(r.checkIn ? { "Hora": r.checkIn } : {}) })), `historial_${selectedPersonName.replace(/\s+/g, "_")}`);
    } else if (reportType === "specific") {
      if (reportTab === "children") { exportToExcel(specificData.map((r) => ({ "Nombre": r.name, "Grupo": r.groupOrType, "Fecha": r.date, "Asistencia": r.statusLabel })), `reporte_asistencia_ninos_${selectedDate}`); }
      else { exportToExcel(specificData.map((r) => ({ "Nombre": r.name, "Cargo": r.groupOrType, "Fecha": r.date, "Asistencia": r.statusLabel })), `reporte_asistencia_personal_${selectedDate}`); }
    } else {
      if (reportTab === "children") { exportToExcel(reportData.map((r) => ({ "Nombre": r.childName, "Grupo": r.groupName, "Presentes": r.totalPresent, "Ausentes": r.totalAbsent, "% Asistencia": r.percentage })), `reporte_asistencia_ninos_${filter}`); }
      else { exportToExcel(staffReportData.map((r) => ({ "Nombre": r.staffName, "Tipo": r.type, "Presentes": r.totalPresent, "Ausentes": r.totalAbsent, "% Asistencia": r.percentage })), `reporte_asistencia_personal_${filter}`); }
    }
  }

  function handleExportPDF() {
    if (reportType === "person" && selectedPersonId) {
      const isStaff = allPeople.find((p) => p.id === selectedPersonId)?.type !== "child";
      const headers = ["Fecha", "Dia", "Asistencia", ...(isStaff ? ["Hora"] : [])];
      const rows: PDFDetailRow[] = personHistory.map((r) => ({ name: selectedPersonName, groupOrType: r.dayName, date: r.dateFormatted, status: r.statusLabel, signatureDataUrl: isStaff ? r.signatureUrl : undefined }));
      exportToPDFDetail(`Historial de Asistencia - ${selectedPersonName}`, headers, rows, `historial_${selectedPersonName.replace(/\s+/g, "_")}`, false);
    } else if (reportType === "specific") {
      const isStaff = reportTab === "staff";
      const headers = isStaff ? ["Nombre Completo", "Cargo", "Fecha", "Asistencia", "Firma"] : ["Nombre Completo", "Grupo", "Fecha", "Asistencia"];
      const rows: PDFDetailRow[] = specificData.map((r) => ({ name: r.name, groupOrType: r.groupOrType, date: r.date, status: r.statusLabel, signatureDataUrl: isStaff ? r.signatureUrl : undefined }));
      const title = isStaff ? `Reporte de Asistencia Personal - ${specificData[0]?.date || selectedDate}` : `Reporte de Asistencia Infantil - ${specificData[0]?.date || selectedDate}`;
      exportToPDFDetail(title, headers, rows, `reporte_${reportTab}_${selectedDate}`, isStaff);
    } else {
      if (reportTab === "children") { exportToPDF("Reporte de Asistencia Infantil", ["Nombre", "Grupo", "Presentes", "Ausentes", "% Asistencia"], reportData.map((r) => [r.childName, r.groupName, String(r.totalPresent), String(r.totalAbsent), `${r.percentage}%`]), `reporte_asistencia_ninos_${filter}`); }
      else { exportToPDF("Reporte de Asistencia Personal", ["Nombre", "Tipo", "Presentes", "Ausentes", "% Asistencia"], staffReportData.map((r) => [r.staffName, r.type, String(r.totalPresent), String(r.totalAbsent), `${r.percentage}%`]), `reporte_asistencia_personal_${filter}`); }
    }
  }

  function selectPerson(person: PersonOption) {
    setSelectedPersonId(person.id);
    setSelectedPersonName(person.name);
    setPersonSearch(person.name);
    setPersonResults([]);
  }

  const totalPresent = reportData.reduce((acc, r) => acc + r.totalPresent, 0);
  const totalAbsent = reportData.reduce((acc, r) => acc + r.totalAbsent, 0);
  const staffTotalPresent = staffReportData.reduce((acc, r) => acc + r.totalPresent, 0);
  const staffTotalAbsent = staffReportData.reduce((acc, r) => acc + r.totalAbsent, 0);
  const currentPresent = reportTab === "children" ? totalPresent : staffTotalPresent;
  const currentAbsent = reportTab === "children" ? totalAbsent : staffTotalAbsent;
  const specificPresent = specificData.filter((r) => r.status === "present").length;
  const specificAbsent = specificData.filter((r) => r.status === "absent").length;
  const personPresent = personHistory.filter((r) => r.status === "present").length;
  const personAbsent = personHistory.filter((r) => r.status === "absent").length;
  const personTotal = personPresent + personAbsent;
  const personPercentage = personTotal > 0 ? Math.round((personPresent / personTotal) * 100) : 0;

  const isWeekend = !isWeekday(selectedDate);

  if (loading) return <LoadingSpinner label="Generando reportes..." />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl gradient-primary flex items-center justify-center shadow-md"><ChartBarIcon className="w-6 h-6 text-white" /></div>
          <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Reportes</h1><p className="text-sm text-gray-500 dark:text-gray-400">Analisis de asistencia (Lunes a Viernes)</p></div>
        </div>
        <div className="flex gap-2">
          <button onClick={handleExportExcel} className="px-4 py-2 rounded-xl text-sm font-semibold bg-white dark:bg-[#1a2438] text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:border-primary shadow-sm flex items-center gap-2"><DocumentArrowDownIcon className="w-4 h-4" /> Excel</button>
          <button onClick={handleExportPDF} className="px-4 py-2 rounded-xl text-sm font-semibold bg-white dark:bg-[#1a2438] text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:border-primary shadow-sm flex items-center gap-2"><DocumentArrowDownIcon className="w-4 h-4" /> PDF</button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button onClick={() => { setReportTab("children"); setSelectedPersonId(null); setPersonSearch(""); setPersonHistory([]); }} className={`px-4 py-2 rounded-xl text-[13px] font-semibold transition-all duration-200 ${reportTab === "children" ? "gradient-primary text-white shadow-md" : "bg-white dark:bg-[#1a2438] text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:border-primary"}`}>
          <span className="flex items-center gap-2"><UserGroupIcon className="w-4 h-4" /> Ninos</span>
        </button>
        <button onClick={() => { setReportTab("staff"); setSelectedPersonId(null); setPersonSearch(""); setPersonHistory([]); }} className={`px-4 py-2 rounded-xl text-[13px] font-semibold transition-all duration-200 ${reportTab === "staff" ? "gradient-primary text-white shadow-md" : "bg-white dark:bg-[#1a2438] text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:border-primary"}`}>
          <span className="flex items-center gap-2"><AcademicCapIcon className="w-4 h-4" /> Personal</span>
        </button>
        <div className="w-px bg-gray-200 dark:bg-gray-700 mx-1" />
        <button onClick={() => setReportType("aggregate")} className={`px-4 py-2 rounded-xl text-[13px] font-semibold transition-all duration-200 ${reportType === "aggregate" ? "gradient-success text-white shadow-md" : "bg-white dark:bg-[#1a2438] text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:border-primary"}`}>
          <span className="flex items-center gap-2"><TableCellsIcon className="w-4 h-4" /> Resumen</span>
        </button>
        <button onClick={() => setReportType("specific")} className={`px-4 py-2 rounded-xl text-[13px] font-semibold transition-all duration-200 ${reportType === "specific" ? "gradient-success text-white shadow-md" : "bg-white dark:bg-[#1a2438] text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:border-primary"}`}>
          <span className="flex items-center gap-2"><CalendarDaysIcon className="w-4 h-4" /> Por Fecha</span>
        </button>
        <button onClick={() => setReportType("person")} className={`px-4 py-2 rounded-xl text-[13px] font-semibold transition-all duration-200 ${reportType === "person" ? "gradient-success text-white shadow-md" : "bg-white dark:bg-[#1a2438] text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:border-primary"}`}>
          <span className="flex items-center gap-2"><UserIcon className="w-4 h-4" /> Por Persona</span>
        </button>
      </div>

      {reportType === "aggregate" && (
        <>
          <div className="flex flex-wrap gap-2">
            {(["day", "week", "month", "year"] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)} className={`px-4 py-2 rounded-xl text-[13px] font-semibold transition-all duration-200 ${filter === f ? "gradient-primary text-white shadow-md" : "bg-white dark:bg-[#1a2438] text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:border-primary"}`}>
                {f === "day" ? "Dia" : f === "week" ? "Semana" : f === "month" ? "Mes" : "Ano"}
              </button>
            ))}
            {reportTab === "children" && (
              <>
                <label htmlFor="reports-group-filter" className="text-sm font-semibold text-gray-900 dark:text-white">Grupo:</label>
                <select id="reports-group-filter" value={groupId} onChange={(e) => setGroupId(e.target.value)} aria-label="Filtrar por grupo" className="px-4 py-2 rounded-xl text-[13px] font-semibold bg-white dark:bg-[#1a2438] text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700">
                  <option value="all">Todos los grupos</option>
                  {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </>
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
              <div className="h-64"><DynamicBarChart data={monthlyData} /></div>
            </div>
            <div className="bg-white dark:bg-[#1a2438] rounded-2xl p-6 border border-gray-100 dark:border-gray-800 shadow-sm">
              <h3 className="mb-4 text-base font-bold text-gray-900 dark:text-white">Distribucion</h3>
              <div className="h-64 flex items-center justify-center"><DynamicPieChart present={currentPresent} absent={currentAbsent} /></div>
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
        </>
      )}

      {reportType === "specific" && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <label htmlFor="reports-date" className="text-sm font-semibold text-gray-900 dark:text-white">Seleccionar fecha:</label>
            <input id="reports-date" type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} aria-label="Seleccionar fecha para reporte" className="px-4 py-2 rounded-xl text-sm font-semibold bg-white dark:bg-[#1a2438] text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all" />
          </div>
          {isWeekend ? (
            <div className="bg-white dark:bg-[#1a2438] rounded-2xl p-12 border border-gray-100 dark:border-gray-800 shadow-sm text-center">
              <CalendarDaysIcon className="w-12 h-12 mx-auto text-gray-400 dark:text-gray-500 mb-3" />
              <p className="text-gray-700 dark:text-gray-300 font-medium">No se registra asistencia los fines de semana</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">La atencion es de Lunes a Viernes</p>
            </div>
          ) : (
            <>
              <div className="grid gap-4 lg:grid-cols-3">
                <div className="bg-white dark:bg-[#1a2438] rounded-2xl p-5 border border-gray-100 dark:border-gray-800 shadow-sm text-center"><p className="text-3xl font-bold text-gray-900 dark:text-white">{specificData.length}</p><p className="text-[12px] font-medium text-gray-500 dark:text-gray-400">{reportTab === "children" ? "Ninos" : "Personal"}</p></div>
                <div className="bg-white dark:bg-[#1a2438] rounded-2xl p-5 border border-gray-100 dark:border-gray-800 shadow-sm text-center"><p className="text-3xl font-bold text-emerald-500">{specificPresent}</p><p className="text-[12px] font-medium text-gray-500 dark:text-gray-400">Presentes</p></div>
                <div className="bg-white dark:bg-[#1a2438] rounded-2xl p-5 border border-gray-100 dark:border-gray-800 shadow-sm text-center"><p className="text-3xl font-bold text-red-500">{specificAbsent}</p><p className="text-[12px] font-medium text-gray-500 dark:text-gray-400">Ausentes</p></div>
              </div>
              <div className="bg-white dark:bg-[#1a2438] rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-gray-100 dark:border-gray-800">
                      <th className="text-left px-5 py-3.5 font-semibold text-gray-500 dark:text-gray-400">Nombre Completo</th>
                      {reportTab === "children" && <th className="text-left px-5 py-3.5 font-semibold text-gray-500 dark:text-gray-400">Grupo</th>}
                      {reportTab === "staff" && <th className="text-left px-5 py-3.5 font-semibold text-gray-500 dark:text-gray-400">Cargo</th>}
                      <th className="text-center px-5 py-3.5 font-semibold text-gray-500 dark:text-gray-400">Asistencia</th>
                      {reportTab === "staff" && <th className="text-center px-5 py-3.5 font-semibold text-gray-500 dark:text-gray-400">Firma</th>}
                    </tr></thead>
                    <tbody>
                      {specificData.map((r, i) => (
                        <tr key={i} className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-[#1e293b] transition-colors">
                          <td className="px-5 py-3.5 font-medium text-gray-900 dark:text-white">{r.name}</td>
                          <td className="px-5 py-3.5">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${reportTab === "staff" ? (r.groupOrType === "Profesor" ? "bg-primary/10 text-primary" : "bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400") : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"}`}>{r.groupOrType}</span>
                          </td>
                          <td className="px-5 py-3.5 text-center">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${r.status === "present" ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400" : "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400"}`}>{r.statusLabel}</span>
                          </td>
                          {reportTab === "staff" && (
                            <td className="px-5 py-3.5 text-center">
                              {r.signatureUrl && r.signatureUrl.startsWith("data:image") ? (
                                <img src={r.signatureUrl} alt="Firma" className="h-8 mx-auto rounded border border-gray-200 dark:border-gray-700" />
                              ) : <span className="text-gray-300 dark:text-gray-600">—</span>}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {specificData.length === 0 && <div className="py-12 text-center text-gray-500 dark:text-gray-400">No hay registros de asistencia para esta fecha.</div>}
              </div>
            </>
          )}
        </>
      )}

      {reportType === "person" && (
        <>
          <div className="relative max-w-md">
            <MagnifyingGlassIcon className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
            <input type="text" placeholder={reportTab === "children" ? "Buscar por nombre o ID (CT001...)..." : "Buscar por nombre..."} aria-label="Buscar persona" value={personSearch} onChange={(e) => { setPersonSearch(e.target.value); setSelectedPersonId(null); setPersonHistory([]); }} className="w-full px-4 py-3 pl-11 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-[#0c1220] text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all" />
            {personResults.length > 0 && (
              <div className="absolute z-50 mt-1 w-full bg-white dark:bg-[#1a2438] border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg max-h-64 overflow-y-auto">
                {personResults.map((p) => (
                  <button key={p.id} onClick={() => selectPerson(p)} className="w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-[#1e293b] transition-colors border-b border-gray-100 dark:border-gray-800 last:border-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{p.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{p.subtitle}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {selectedPersonId ? (
            <>
              <div className="grid gap-4 lg:grid-cols-4">
                <div className="bg-white dark:bg-[#1a2438] rounded-2xl p-5 border border-gray-100 dark:border-gray-800 shadow-sm text-center">
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">{personTotal}</p>
                  <p className="text-[12px] font-medium text-gray-500 dark:text-gray-400">Dias laborales</p>
                </div>
                <div className="bg-white dark:bg-[#1a2438] rounded-2xl p-5 border border-gray-100 dark:border-gray-800 shadow-sm text-center">
                  <p className="text-3xl font-bold text-emerald-500">{personPresent}</p>
                  <p className="text-[12px] font-medium text-gray-500 dark:text-gray-400">Asistencias</p>
                </div>
                <div className="bg-white dark:bg-[#1a2438] rounded-2xl p-5 border border-gray-100 dark:border-gray-800 shadow-sm text-center">
                  <p className="text-3xl font-bold text-red-500">{personAbsent}</p>
                  <p className="text-[12px] font-medium text-gray-500 dark:text-gray-400">Faltas</p>
                </div>
                <div className="bg-white dark:bg-[#1a2438] rounded-2xl p-5 border border-gray-100 dark:border-gray-800 shadow-sm text-center">
                  <p className={`text-3xl font-bold ${personPercentage >= 80 ? "text-emerald-500" : personPercentage >= 60 ? "text-amber-500" : "text-red-500"}`}>{personPercentage}%</p>
                  <p className="text-[12px] font-medium text-gray-500 dark:text-gray-400">% Asistencia</p>
                </div>
              </div>
              <div className="bg-white dark:bg-[#1a2438] rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">Historial de {selectedPersonName}</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Solo dias laborales (Lunes a Viernes)</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-gray-100 dark:border-gray-800">
                      <th className="text-left px-5 py-3.5 font-semibold text-gray-500 dark:text-gray-400">Fecha</th>
                      <th className="text-left px-5 py-3.5 font-semibold text-gray-500 dark:text-gray-400">Dia</th>
                      <th className="text-center px-5 py-3.5 font-semibold text-gray-500 dark:text-gray-400">Estado</th>
                    </tr></thead>
                    <tbody>
                      {personHistory.map((r, i) => (
                        <tr key={i} className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-[#1e293b] transition-colors">
                          <td className="px-5 py-3.5 font-medium text-gray-900 dark:text-white">{r.dateFormatted}</td>
                          <td className="px-5 py-3.5 text-gray-500 dark:text-gray-400 capitalize">{r.dayName}</td>
                          <td className="px-5 py-3.5 text-center">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${r.status === "present" ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400" : "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400"}`}>{r.statusLabel}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {personHistory.length === 0 && <div className="py-12 text-center text-gray-500 dark:text-gray-400">No hay registros de asistencia para esta persona.</div>}
              </div>
            </>
          ) : (
            <div className="bg-white dark:bg-[#1a2438] rounded-2xl p-12 border border-gray-100 dark:border-gray-800 shadow-sm text-center">
              <UserIcon className="w-12 h-12 mx-auto text-gray-400 dark:text-gray-500 mb-3" />
              <p className="text-gray-700 dark:text-gray-300 font-medium">Busca una persona para ver su historial</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{reportTab === "children" ? "Puedes buscar por nombre o codigo (CT001...)" : "Busca por nombre"}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
