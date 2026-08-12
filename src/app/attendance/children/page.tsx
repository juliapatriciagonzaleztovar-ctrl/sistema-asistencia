"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { getTodayDate, formatTime } from "@/lib/utils";
import { registerSingleChildAttendance, autoMarkAbsentChildren, updateChildAttendance } from "@/lib/attendance";
import { createChildCorrectionRequest, getMyChildCorrections } from "@/lib/corrections";
import { logAction } from "@/lib/audit";
import { toast } from "react-hot-toast";
import { CheckCircleIcon, XCircleIcon, ClockIcon, ClipboardDocumentCheckIcon, PencilIcon, MagnifyingGlassIcon, ArrowUpIcon, ArrowDownIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { Modal } from "@/components/ui/Modal";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import type { Child, Group, AttendanceChild, CorrectionRequestChild } from "@/types/database";

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
  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [correctionItem, setCorrectionItem] = useState<ChildItem | null>(null);
  const [correctionReason, setCorrectionReason] = useState("");
  const [highlightChildId, setHighlightChildId] = useState<string | null>(null);
  const [myCorrections, setMyCorrections] = useState<CorrectionRequestChild[]>([]);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadData();
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (user && !isAdmin) {
      loadMyCorrections();
      const interval = setInterval(loadMyCorrections, 15000);
      return () => clearInterval(interval);
    }
  }, [user, isAdmin]);

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

  async function loadMyCorrections() {
    if (!user) return;
    try {
      const data = await getMyChildCorrections(user.uid);
      const prevPending = myCorrections.filter((c) => c.status === "pending").length;
      const newPending = data.filter((c) => c.status === "pending").length;
      const resolved = data.filter((c) => c.status === "approved" || c.status === "rejected");
      const newResolved = resolved.filter((c) => {
        const resolvedTime = new Date(c.resolved_at || c.created_at).getTime();
        const fiveMinAgo = Date.now() - 5 * 60 * 1000;
        return resolvedTime > fiveMinAgo;
      });

      if (prevPending > 0 && newPending < prevPending) {
        const approved = data.find((c) => c.status === "approved" && c.child_id);
        if (approved) {
          toast.success(`Solicitud aprobada para ${approved.child_name}. Puede volver a marcar.`);
          highlightChild(approved.child_id);
          loadData();
        }
        const rejected = data.find((c) => c.status === "rejected");
        if (rejected) {
          toast.error(`Solicitud rechazada: ${rejected.admin_note || "Sin motivo"}`);
        }
      }

      setMyCorrections(data);
    } catch (e) {
      console.error("Error loading corrections:", e);
    }
  }

  const highlightChild = useCallback((childId: string) => {
    setHighlightChildId(childId);
    setTimeout(() => {
      const el = document.getElementById(`child-${childId}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 300);
    setTimeout(() => setHighlightChildId(null), 5000);
  }, []);

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

  async function submitCorrection() {
    if (!correctionItem?.existing || !correctionReason.trim() || !user) return;
    try {
      const childName = `${correctionItem.child.first_name} ${correctionItem.child.last_name}`;
      const oldStatus = correctionItem.existing.status as "present" | "absent";
      await createChildCorrectionRequest(
        correctionItem.existing.id,
        correctionItem.child.id,
        childName,
        correctionItem.child.child_id_code || "S/I",
        oldStatus,
        date,
        correctionReason.trim()
      );
      toast.success("Solicitud enviada al administrador");
      setCorrectionItem(null);
      setCorrectionReason("");
      loadMyCorrections();
    } catch { toast.error("Error al enviar solicitud"); }
  }

  const filtered = items
    .filter((i) => selectedGroup === "all" || i.child.group_id === selectedGroup)
    .filter((i) => {
      if (!search.trim()) return true;
      const term = search.toLowerCase();
      const fullName = `${i.child.first_name} ${i.child.last_name}`.toLowerCase();
      const code = i.child.child_id_code?.toLowerCase() || "";
      return fullName.includes(term) || code.includes(term);
    })
    .sort((a, b) => {
      const nameA = `${a.child.first_name} ${a.child.last_name}`.toLowerCase();
      const nameB = `${b.child.first_name} ${b.child.last_name}`.toLowerCase();
      return sortOrder === "asc" ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
    });

  const totalPresent = items.filter((i) => i.existing?.status === "present").length;
  const totalAbsent = items.filter((i) => i.existing?.status === "absent").length;
  const isAfterAutoMark = now.getHours() >= 17 && now.getMinutes() >= 50;
  const unmarked = items.filter((i) => !i.existing).length;

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

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
          <input type="text" placeholder="Buscar por nombre o ID (CT001...)..." aria-label="Buscar ninos" value={search} onChange={(e) => setSearch(e.target.value)} className="w-full px-4 py-3 pl-11 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-[#0c1220] text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all" />
        </div>
        <button onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")} className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#0c1220] text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all" aria-label={`Ordenar ${sortOrder === "asc" ? "Z a A" : "A a Z"}`}>
          {sortOrder === "asc" ? <ArrowUpIcon className="w-4 h-4" /> : <ArrowDownIcon className="w-4 h-4" />}
          {sortOrder === "asc" ? "A - Z" : "Z - A"}
        </button>
      </div>

      <div ref={listRef} className="space-y-2">
        {filtered.map((item) => (
          <div
            key={item.child.id}
            id={`child-${item.child.id}`}
            className={`bg-white dark:bg-[#1a2438] rounded-2xl p-4 border shadow-sm transition-all duration-500 ${
              highlightChildId === item.child.id
                ? "border-primary ring-4 ring-primary/20 opacity-100"
                : item.existing ? "border-gray-100 dark:border-gray-800 opacity-60" : "border-gray-100 dark:border-gray-800"
            }`}
          >
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center text-white text-sm font-bold">{item.child.first_name.charAt(0)}{item.child.last_name.charAt(0)}</div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-gray-900 dark:text-white text-sm">{item.child.first_name} {item.child.last_name}</h3>
                    {item.child.child_id_code && <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-primary/10 text-primary">{item.child.child_id_code}</span>}
                  </div>
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
                    {!isAdmin && (
                      <button
                        onClick={() => { setCorrectionItem(item); setCorrectionReason(""); }}
                        aria-label="Reportar error"
                        className="flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-bold bg-amber-50 text-amber-600 hover:bg-amber-100 dark:bg-amber-900/20 dark:text-amber-400 transition-all active:scale-95"
                      >
                        <ExclamationTriangleIcon className="w-4 h-4" />
                      </button>
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

      {filtered.length === 0 && <div className="bg-white dark:bg-[#1a2438] rounded-2xl p-12 text-center border border-gray-100 dark:border-gray-800"><p className="text-gray-400 font-medium">{search ? "No se encontraron resultados" : "No hay ninos en este grupo"}</p></div>}

      <Modal open={!!correctionItem} onClose={() => setCorrectionItem(null)} title="Reportar Error de Asistencia" size="md">
        {correctionItem && (
          <div className="space-y-4">
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4">
              <div className="flex items-center gap-2">
                <p className="font-bold text-gray-900 dark:text-white">{correctionItem.child.first_name} {correctionItem.child.last_name}</p>
                {correctionItem.child.child_id_code && <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-primary/10 text-primary">{correctionItem.child.child_id_code}</span>}
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Marcado como: <span className={`font-bold ${correctionItem.existing?.status === "present" ? "text-emerald-500" : "text-red-500"}`}>{correctionItem.existing?.status === "present" ? "Asistio" : "No asistio"}</span></p>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300">Describe el error cometido. El administrador revisara tu solicitud.</p>
            <div><label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">Motivo del error *</label><textarea value={correctionReason} onChange={(e) => setCorrectionReason(e.target.value)} placeholder="Ej: Marque No asistio por error, el nino si asistio..." rows={3} className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-[#0c1220] text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all resize-none" /></div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setCorrectionItem(null)} className="px-4 py-2 rounded-xl text-sm font-semibold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 transition-colors">Cancelar</button>
              <button onClick={submitCorrection} disabled={!correctionReason.trim()} className="px-5 py-2.5 gradient-primary text-white font-semibold rounded-xl shadow-md disabled:opacity-50">Enviar Solicitud</button>
            </div>
          </div>
        )}
      </Modal>

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
