"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { getTodayDate, formatTime } from "@/lib/utils";
import { registerStaffAttendance, autoMarkAbsentStaff, updateStaffAttendance } from "@/lib/attendance";
import { logAction } from "@/lib/audit";
import { toast } from "react-hot-toast";
import { PencilIcon, CheckCircleIcon, ClockIcon, UserGroupIcon } from "@heroicons/react/24/outline";
import { Modal } from "@/components/ui/Modal";
import type { Teacher, Practitioner, AttendanceStaff } from "@/types/database";

interface StaffItem { staff: Teacher | Practitioner; type: "teacher" | "practitioner"; attendance: AttendanceStaff | null; }

export default function StaffAttendancePage() {
  const { user, profile } = useAuth();
  const isAdmin = profile?.role === "super_admin";
  const [items, setItems] = useState<StaffItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [date] = useState(getTodayDate());
  const [now, setNow] = useState(new Date());
  const [showSignature, setShowSignature] = useState(false);
  const [signingFor, setSigningFor] = useState<StaffItem | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [editItem, setEditItem] = useState<StaffItem | null>(null);
  const [editNote, setEditNote] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => { loadData(); const i = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(i); }, []);

  async function loadData() {
    const today = getTodayDate();
    if (user) {
      const autoMarked = await autoMarkAbsentStaff(user.uid);
      if (autoMarked > 0) toast(`Se marcaron ${autoMarked} miembros del personal como ausentes (pasado las 6:00pm)`, { icon: "ℹ️" });
    }
    const [teachersData, practitionersData, attendanceData] = await Promise.all([
      getDocs(query(collection(getFirebaseDb(), "teachers"), where("status", "==", "active"))),
      getDocs(query(collection(getFirebaseDb(), "practitioners"), where("status", "==", "active"))),
      getDocs(query(collection(getFirebaseDb(), "attendance_staff"), where("attendance_date", "==", today))),
    ]);
    const attList = attendanceData.docs.map((d) => ({ id: d.id, ...d.data() } as AttendanceStaff));
    setItems([
      ...teachersData.docs.map((d) => ({ staff: { id: d.id, ...d.data() } as Teacher, type: "teacher" as const, attendance: attList.find((a) => a.staff_id === d.id && a.staff_type === "teacher") || null })),
      ...practitionersData.docs.map((d) => ({ staff: { id: d.id, ...d.data() } as Practitioner, type: "practitioner" as const, attendance: attList.find((a) => a.staff_id === d.id && a.staff_type === "practitioner") || null })),
    ]);
    setLoading(false);
  }

  function startSignature(item: StaffItem) {
    setSigningFor(item);
    setShowSignature(true);
    setTimeout(() => {
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;
        const ctx = canvas.getContext("2d");
        if (ctx) { ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.strokeStyle = "#1a2332"; ctx.lineWidth = 2.5; ctx.lineCap = "round"; }
      }
    }, 100);
  }

  function getPos(e: React.TouchEvent | React.MouseEvent) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
  }

  function startDraw(e: React.TouchEvent | React.MouseEvent) { setIsDrawing(true); const ctx = canvasRef.current?.getContext("2d"); if (ctx) { const p = getPos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); } }
  function draw(e: React.TouchEvent | React.MouseEvent) { if (!isDrawing) return; const ctx = canvasRef.current?.getContext("2d"); if (ctx) { const p = getPos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); } }
  function stopDraw() { setIsDrawing(false); }
  function clearCanvas() { const c = canvasRef.current; if (c) { const ctx = c.getContext("2d"); if (ctx) { ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height); } } }

  const saveAttendance = useCallback(async () => {
    if (!signingFor || !user) return;
    const signatureUrl = canvasRef.current?.toDataURL("image/png") || null;
    try {
      await registerStaffAttendance(signingFor.staff.id, signingFor.type, user.uid, signatureUrl);
      await logAction("create", "attendance_staff", null, { staff_id: signingFor.staff.id, staff_name: `${signingFor.staff.first_name} ${signingFor.staff.last_name}`, staff_type: signingFor.type, signed: true });
      toast.success("Asistencia registrada con firma");
      setShowSignature(false);
      setSigningFor(null);
      loadData();
    } catch { toast.error("Error al registrar"); }
  }, [signingFor, user]);

  function openEdit(item: StaffItem) {
    setEditItem(item);
    setEditNote("");
  }

  async function saveEdit() {
    if (!editItem?.attendance || !editNote.trim() || !user) return;
    setSavingEdit(true);
    try {
      await updateStaffAttendance(editItem.attendance.id, editItem.attendance.check_in, editNote.trim(), user.uid);
      await logAction("update", "attendance_staff", editItem.attendance.id, {
        staff_name: `${editItem.staff.first_name} ${editItem.staff.last_name}`,
        staff_type: editItem.type,
        note: editNote.trim(),
      });
      toast.success("Asistencia corregida");
      setEditItem(null);
      loadData();
    } catch { toast.error("Error al corregir asistencia"); }
    setSavingEdit(false);
  }

  if (loading) return <div className="flex h-64 items-center justify-center"><div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl gradient-success flex items-center justify-center shadow-md"><UserGroupIcon className="w-6 h-6 text-white" /></div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Asistencia de Personal</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2"><ClockIcon className="w-4 h-4" />{date} - {formatTime(now.toISOString())}</p>
        </div>
      </div>

      <div className="space-y-2">
        {items.map((item) => (
          <div key={`${item.type}-${item.staff.id}`} className={`bg-white dark:bg-[#1a2438] rounded-2xl p-4 border border-gray-100 dark:border-gray-800 shadow-sm transition-all ${item.attendance ? "opacity-60" : ""}`}>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold ${item.type === "teacher" ? "gradient-success" : "gradient-warm"}`}>{item.staff.first_name.charAt(0)}{item.staff.last_name.charAt(0)}</div>
                <div><h3 className="font-bold text-gray-900 dark:text-white text-sm">{item.staff.first_name} {item.staff.last_name}</h3><p className="text-[11px] text-gray-400">{item.type === "teacher" ? "Profesor" : "Practicante"}</p></div>
              </div>
              {item.attendance ? (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/20"><CheckCircleIcon className="w-4 h-4 text-emerald-500" /><span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">Presente</span><span className="text-xs text-gray-400">{item.attendance.check_in ? formatTime(item.attendance.check_in) : ""}</span></div>
                  {isAdmin && (
                    <button onClick={() => openEdit(item)} className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-bold bg-primary/10 text-primary hover:bg-primary/20 transition-all active:scale-95" title="Corregir asistencia">
                      <PencilIcon className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ) : (
                <button onClick={() => startSignature(item)} className="flex items-center gap-2 px-5 py-2.5 gradient-primary text-white font-semibold rounded-xl shadow-md hover:shadow-lg transition-all active:scale-95"><PencilIcon className="w-4 h-4" />Firmar</button>
              )}
            </div>
          </div>
        ))}
      </div>

      {showSignature && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => { setShowSignature(false); setSigningFor(null); }} />
          <div className="relative bg-white dark:bg-[#1a2438] rounded-2xl p-6 w-full max-w-lg shadow-2xl animate-fade-in">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Firma Digital</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Firma con el dedo o con el mouse.</p>
            <div className="rounded-xl overflow-hidden border-2 border-gray-200 dark:border-gray-700 shadow-md mb-4">
              <canvas ref={canvasRef} className="w-full h-48 touch-none cursor-crosshair" onMouseDown={startDraw} onMouseMove={draw} onMouseUp={stopDraw} onMouseLeave={stopDraw} onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={stopDraw} />
            </div>
            <div className="flex justify-between">
              <button onClick={clearCanvas} className="px-4 py-2 rounded-xl text-sm font-semibold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">Limpiar</button>
              <div className="flex gap-3">
                <button onClick={() => { setShowSignature(false); setSigningFor(null); }} className="px-4 py-2 rounded-xl text-sm font-semibold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">Cancelar</button>
                <button onClick={saveAttendance} className="px-5 py-2 rounded-xl text-sm font-semibold gradient-success text-white shadow-md hover:shadow-lg transition-all">Guardar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Modal open={!!editItem} onClose={() => setEditItem(null)} title="Corregir Asistencia Personal" size="md">
        {editItem && (
          <div className="space-y-4">
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4">
              <p className="font-bold text-gray-900 dark:text-white">{editItem.staff.first_name} {editItem.staff.last_name}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{editItem.type === "teacher" ? "Profesor" : "Practicante"}</p>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">Motivo de la correccion *</label>
              <textarea value={editNote} onChange={(e) => setEditNote(e.target.value)} placeholder="Ej: Se registro por error, el personal si asistio..." rows={3} className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-[#0c1220] text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all resize-none" />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setEditItem(null)} className="px-4 py-2 rounded-xl text-sm font-semibold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 transition-colors">Cancelar</button>
              <button onClick={saveEdit} disabled={!editNote.trim() || savingEdit} className="px-5 py-2.5 gradient-primary text-white font-semibold rounded-xl shadow-md disabled:opacity-50">{savingEdit ? "Guardando..." : "Corregir"}</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
