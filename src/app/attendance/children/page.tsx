"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { getTodayDate, formatTime } from "@/lib/utils";
import { registerSingleChildAttendance, autoMarkAbsentChildren, updateChildAttendance } from "@/lib/attendance";
import { logAction } from "@/lib/audit";
import { toast } from "react-hot-toast";
import { CheckCircleIcon, XCircleIcon, ClockIcon, ClipboardDocumentCheckIcon, PencilIcon } from "@heroicons/react/24/outline";
import { Modal } from "@/components/ui/Modal";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import type { Child, Group, AttendanceChild } from "@/types/database";

interface ChildItem { child: Child; existing: AttendanceChild | null; selectedStatus: "present" | "absent" | null; }

export default function ChildrenAttendancePage() {
  const { user, profile } = useAuth();
  const isAdmin = profile?.role === "super_admin";
  const [items, setItems] = useState<ChildItem[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroup, setSelectedGroup] = useState("all");
  const [loading, setLoading] = useState(true);
  const [date] = useState(getTodayDate());
  const [now, setNow] = useState(new Date());
  const [editItem, setEditItem] = useState<ChildItem | null>(null);
  const [editStatus, setEditStatus] = useState<"present" | "absent">("present");
  const [editNote, setEditNote] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    loadData();
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  async function loadData() {
    const today = getTodayDate();
    if (user) {
      const autoMarked = await autoMarkAbsentChildren(user.uid);
      if (autoMarked > 0) toast(`Se marcaron ${autoMarked} ninos como ausentes (pasado las 5:50pm)`, { icon: "\u2139\uFE0F" });
    }
    const [childrenData, groupsData, attendanceData] = await Promise.all([
      getDocs(query(collection(getFirebaseDb(), "children"), where("status", "==", "active"))),
      getDocs(collection(getFirebaseDb(), "groups")),
      getDocs(query(collection(getFirebaseDb(), "attendance_children"), where("attendance_date", "==", today))),
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

  async function markAttendance(child: Child, status: "present" | "absent") {
    if (!user) return;
    try {
      const attId = await registerSingleChildAttendance(child.id, status, user.uid);
      const checkInTime = status === "present" ? new Date().toISOString() : null;
      await logAction("create", "attendance_children", attId, {
        child_name: `${child.first_name} ${child.last_name}`,
        status,
        check_in: checkInTime,
      });
      toast.success(status === "present" ? `${child.first_name} - Asistio (${formatTime(new Date().toISOString())})` : `${child.first_name} - No asistio`);
      loadData();
    } catch { toast.error("Error al marcar asistencia"); }
  }

  function openEdit(item: ChildItem) {
    setEditItem(item);
    setEditStatus(item.existing?.status === "absent" ? "absent" : "present");
    setEditNote("");
  }

  async function saveEdit() {
    if (!editItem?.existing || !editNote.trim() || !user) return;
    setSavingEdit(true);
    try {
      await updateChildAttendance(editItem.existing.id, editStatus, editNote.trim(), user.uid);
      await logAction("update", "attendance_children", editItem.existing.id, {
        child_name: `${editItem.child.first_name} ${editItem.child.last_name}`,
        old_status: editItem.existing.status,
        new_status: editStatus,
        note: editNote.trim(),
      });
      toast.success("Asistencia corregida");
      setEditItem(null);
      loadData();
    } catch { toast.error("Error al corregir asistencia"); }
    setSavingEdit(false);
  }

  const filtered = selectedGroup === "all" ? items : items.filter((i) => i.child.group_id === selectedGroup);
  const totalPresent = filtered.filter((i) => i.existing?.status === "present").length;
  const totalAbsent = filtered.filter((i) => i.existing?.status === "absent").length;
  const isAfterAutoMark = now.getHours() >= 17 && now.getMinutes() >= 50;
  const unmarked = filtered.filter((i) => !i.existing).length;

  if (loading) return <LoadingSpinner label="Cargando..." />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl gradient-primary flex items-center justify-center shadow-md"><ClipboardDocumentCheckIcon className="w-6 h-6 text-white" /></div>
          <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Asistencia de Ninos</h1><p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2"><ClockIcon className="w-4 h-4" />{date} - {formatTime(now.toISOString())}</p></div>
        </div>
        <div className={`px-4 py-2 rounded-xl text-sm font-semibold ${isAfterAutoMark ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400" : "bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400"}`}>
          {isAfterAutoMark ? `Cierre del dia · ${totalPresent + totalAbsent} registrados` : `${unmarked} pendientes · Auto-cierre a las 5:50pm`}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white dark:bg-[#1a2438] rounded-2xl p-4 text-center border border-gray-100 dark:border-gray-800"><p className="text-3xl font-bold text-gray-900 dark:text-white">{filtered.length}</p><p className="text-xs font-medium text-gray-400">Total</p></div>
        <div className="bg-white dark:bg-[#1a2438] rounded-2xl p-4 text-center border border-gray-100 dark:border-gray-800"><p className="text-3xl font-bold text-emerald-500">{totalPresent}</p><p className="text-xs font-medium text-gray-400">Presentes</p></div>
        <div className="bg-white dark:bg-[#1a2438] rounded-2xl p-4 text-center border border-gray-100 dark:border-gray-800"><p className="text-3xl font-bold text-red-500">{totalAbsent}</p><p className="text-xs font-medium text-gray-400">Ausentes</p></div>
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
                  <p className="text-[11px] text-gray-400">{item.child.shift}{item.child.group_id ? ` \u00B7 ${groups.find((g) => g.id === item.child.group_id)?.name || ""}` : ""}</p>
                </div>
              </div>
              <div className="flex gap-2 items-center">
                {item.existing ? (
                  <div className="flex items-center gap-2">
                    <div className={`flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-bold ${item.existing.status === "present" ? "bg-emerald-500 text-white shadow-md" : "bg-red-500 text-white shadow-md"}`}>
                      {item.existing.status === "present" ? <><CheckCircleIcon className="w-4 h-4" />Asistio </> : <><XCircleIcon className="w-4 h-4" />No asistio</>}
                    </div>
                    {(item.existing as AttendanceChild & { check_in?: string }).check_in && (
                      <span className="text-xs text-gray-400">{formatTime((item.existing as AttendanceChild & { check_in?: string }).check_in!)}</span>
                    )}
                  </div>
                ) : (
                  <>
                    <button onClick={() => markAttendance(item.child, "present")} className="flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-bold bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 active:scale-95 transition-all">
                      <CheckCircleIcon className="w-4 h-4" />Asistio
                    </button>
                    <button onClick={() => markAttendance(item.child, "absent")} className="flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-bold bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 active:scale-95 transition-all">
                      <XCircleIcon className="w-4 h-4" />No asistio
                    </button>
                  </>
                )}
                {isAdmin && item.existing && (
                  <button onClick={() => openEdit(item)} aria-label="Corregir asistencia" className="flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-bold bg-primary/10 text-primary hover:bg-primary/20 transition-all active:scale-95">
                    <PencilIcon className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && <div className="bg-white dark:bg-[#1a2438] rounded-2xl p-12 text-center border border-gray-100 dark:border-gray-800"><p className="text-gray-400 font-medium">No hay ninos en este grupo</p></div>}

      <Modal open={!!editItem} onClose={() => setEditItem(null)} title="Corregir Asistencia" size="md">
        {editItem && (
          <div className="space-y-4">
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4">
              <p className="font-bold text-gray-900 dark:text-white">{editItem.child.first_name} {editItem.child.last_name}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Estado actual: <span className={`font-bold ${editItem.existing?.status === "present" ? "text-emerald-500" : "text-red-500"}`}>{editItem.existing?.status === "present" ? "Asistio" : "No asistio"}</span></p>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">Cambiar a:</label>
              <div className="flex gap-3">
                <button onClick={() => setEditStatus("present")} className={`flex-1 flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition-all ${editStatus === "present" ? "bg-emerald-500 text-white shadow-md" : "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800"}`}><CheckCircleIcon className="w-5 h-5" />Asistio</button>
                <button onClick={() => setEditStatus("absent")} className={`flex-1 flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition-all ${editStatus === "absent" ? "bg-red-500 text-white shadow-md" : "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 border border-red-200 dark:border-red-800"}`}><XCircleIcon className="w-5 h-5" />No asistio</button>
              </div>
            </div>
            <div><label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">Motivo de la correccion *</label><textarea value={editNote} onChange={(e) => setEditNote(e.target.value)} placeholder="Ej: Se registro por error, el nino si asistio..." rows={3} className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-[#0c1220] text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all resize-none" /></div>
            <div className="flex justify-end gap-3 pt-2"><button type="button" onClick={() => setEditItem(null)} className="px-4 py-2 rounded-xl text-sm font-semibold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 transition-colors">Cancelar</button><button onClick={saveEdit} disabled={!editNote.trim() || savingEdit} className="px-5 py-2.5 gradient-primary text-white font-semibold rounded-xl shadow-md disabled:opacity-50">{savingEdit ? "Guardando..." : "Corregir"}</button></div>
          </div>
        )}
      </Modal>
    </div>
  );
}