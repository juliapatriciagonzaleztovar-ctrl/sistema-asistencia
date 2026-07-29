"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { getTodayDate, formatTime } from "@/lib/utils";
import { registerBulkChildAttendance, autoMarkAbsentChildren } from "@/lib/attendance";
import { logAction } from "@/lib/audit";
import { toast } from "react-hot-toast";
import { CheckCircleIcon, XCircleIcon, ClockIcon, ClipboardDocumentCheckIcon } from "@heroicons/react/24/outline";
import type { Child, Group, AttendanceChild } from "@/types/database";

interface ChildItem { child: Child; existing: AttendanceChild | null; selectedStatus: "present" | "absent" | null; }

export default function ChildrenAttendancePage() {
  const { user } = useAuth();
  const [items, setItems] = useState<ChildItem[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroup, setSelectedGroup] = useState("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [date] = useState(getTodayDate());
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    loadData();
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  async function loadData() {
    const today = getTodayDate();
    if (user) {
      const autoMarked = await autoMarkAbsentChildren(user.uid);
      if (autoMarked > 0) toast(`Se marcaron ${autoMarked} ninos como ausentes (pasado las 6:00pm)`, { icon: "ℹ️" });
    }
    const [childrenData, groupsData, attendanceData] = await Promise.all([
      getDocs(query(collection(db, "children"), where("status", "==", "active"))),
      getDocs(collection(db, "groups")),
      getDocs(query(collection(db, "attendance_children"), where("attendance_date", "==", today))),
    ]);
    const attList = attendanceData.docs.map((d) => ({ id: d.id, ...d.data() } as AttendanceChild));
    setItems(childrenData.docs.map((d) => {
      const child = { id: d.id, ...d.data() } as Child;
      const existing = attList.find((a) => a.child_id === child.id) || null;
      return { child, existing, selectedStatus: (existing?.status as "present" | "absent") || null };
    }));
    setGroups(groupsData.docs.map((d) => ({ id: d.id, ...d.data() } as Group)));
    setLoading(false);
  }

  function toggleStatus(childId: string, status: "present" | "absent") {
    setItems((prev) => prev.map((item) => {
      if (item.child.id !== childId || item.existing) return item;
      return { ...item, selectedStatus: item.selectedStatus === status ? null : status };
    }));
  }

  async function saveAll() {
    if (!user) return;
    const unsaved = items.filter((i) => i.selectedStatus && !i.existing);
    if (unsaved.length === 0) { toast("No hay cambios por guardar", { icon: "ℹ️" }); return; }
    setSaving(true);
    try {
      await registerBulkChildAttendance(unsaved.map((i) => ({ childId: i.child.id, status: i.selectedStatus! })), user.uid);
      await logAction("create", "attendance_children", null, { date, count: unsaved.length });
      toast.success(`${unsaved.length} asistencia(s) registrada(s)`);
      loadData();
    } catch { toast.error("Error al guardar asistencia"); }
    setSaving(false);
  }

  const filtered = selectedGroup === "all" ? items : items.filter((i) => i.child.group_id === selectedGroup);

  if (loading) return <div className="flex h-64 items-center justify-center"><div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl gradient-primary flex items-center justify-center shadow-md"><ClipboardDocumentCheckIcon className="w-6 h-6 text-white" /></div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Asistencia de Ninos</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2"><ClockIcon className="w-4 h-4" />{date} - {formatTime(now.toISOString())}</p>
          </div>
        </div>
        <button onClick={saveAll} disabled={saving} className="px-6 py-2.5 gradient-success text-white font-semibold rounded-xl shadow-md hover:shadow-lg transition-all disabled:opacity-50 active:scale-[0.97]">
          {saving ? "Guardando..." : "Guardar Asistencia"}
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white dark:bg-[#1a2438] rounded-2xl p-4 text-center border border-gray-100 dark:border-gray-800"><p className="text-3xl font-bold text-gray-900 dark:text-white">{filtered.length}</p><p className="text-xs font-medium text-gray-400">Total</p></div>
        <div className="bg-white dark:bg-[#1a2438] rounded-2xl p-4 text-center border border-gray-100 dark:border-gray-800"><p className="text-3xl font-bold text-emerald-500">{filtered.filter((i) => i.selectedStatus === "present" || i.existing?.status === "present").length}</p><p className="text-xs font-medium text-gray-400">Presentes</p></div>
        <div className="bg-white dark:bg-[#1a2438] rounded-2xl p-4 text-center border border-gray-100 dark:border-gray-800"><p className="text-3xl font-bold text-red-500">{filtered.filter((i) => i.selectedStatus === "absent" || i.existing?.status === "absent").length}</p><p className="text-xs font-medium text-gray-400">Ausentes</p></div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2">
        <button onClick={() => setSelectedGroup("all")} className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${selectedGroup === "all" ? "gradient-primary text-white shadow-md" : "bg-white dark:bg-[#1a2438] text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:border-primary"}`}>Todos ({items.length})</button>
        {groups.map((g) => (
          <button key={g.id} onClick={() => setSelectedGroup(g.id)} className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${selectedGroup === g.id ? "gradient-primary text-white shadow-md" : "bg-white dark:bg-[#1a2438] text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:border-primary"}`}>{g.name} ({items.filter((i) => i.child.group_id === g.id).length})</button>
        ))}
      </div>

      <div className="space-y-2">
        {filtered.map((item) => (
          <div key={item.child.id} className={`bg-white dark:bg-[#1a2438] rounded-2xl p-4 border border-gray-100 dark:border-gray-800 shadow-sm transition-all ${item.existing ? "opacity-60" : ""}`}>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center text-white text-sm font-bold">{item.child.first_name.charAt(0)}{item.child.last_name.charAt(0)}</div>
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white text-sm">{item.child.first_name} {item.child.last_name}</h3>
                  <p className="text-[11px] text-gray-400">{item.child.shift}{item.child.group_id ? ` · ${groups.find((g) => g.id === item.child.group_id)?.name || ""}` : ""}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => toggleStatus(item.child.id, "present")} disabled={!!item.existing}
                  className={`flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-bold transition-all ${item.selectedStatus === "present" || item.existing?.status === "present" ? "bg-emerald-500 text-white shadow-md" : "bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400"} ${item.existing ? "cursor-default" : "active:scale-95"}`}>
                  <CheckCircleIcon className="w-4 h-4" />Asistio
                </button>
                <button onClick={() => toggleStatus(item.child.id, "absent")} disabled={!!item.existing}
                  className={`flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-bold transition-all ${item.selectedStatus === "absent" || item.existing?.status === "absent" ? "bg-red-500 text-white shadow-md" : "bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400"} ${item.existing ? "cursor-default" : "active:scale-95"}`}>
                  <XCircleIcon className="w-4 h-4" />No asistio
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && <div className="bg-white dark:bg-[#1a2438] rounded-2xl p-12 text-center border border-gray-100 dark:border-gray-800"><p className="text-gray-400 font-medium">No hay ninos en este grupo</p></div>}
    </div>
  );
}
