"use client";

import { useEffect, useState } from "react";
import { getPendingCorrections, approveCorrection, rejectCorrection, getPendingChildCorrections, approveChildCorrection, rejectChildCorrection, getAllChildCorrections } from "@/lib/corrections";
import { deleteDoc, doc, getDoc } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { CheckCircleIcon, XCircleIcon, ArrowPathIcon, UserGroupIcon, UserIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { toast } from "react-hot-toast";
import { formatDateTime } from "@/lib/utils";
import type { CorrectionRequest, CorrectionRequestChild } from "@/types/database";

export default function CorrectionsPage() {
  const [staffRequests, setStaffRequests] = useState<CorrectionRequest[]>([]);
  const [childRequests, setChildRequests] = useState<CorrectionRequestChild[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"staff" | "children">("staff");
  const [rejectNote, setRejectNote] = useState("");
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const [staff, children] = await Promise.all([
        getPendingCorrections(),
        getPendingChildCorrections(),
      ]);
      setStaffRequests(staff);
      setChildRequests(children);
    } catch (err) {
      console.error("Error loading corrections:", err);
      toast.error("Error al cargar solicitudes de corrección");
    } finally {
      setLoading(false);
    }
  }

  async function handleApproveStaff(req: CorrectionRequest) {
    try {
      await approveCorrection(req.id);
      const attRef = doc(getFirebaseDb(), "attendance_staff", req.attendance_id);
      const attSnap = await getDoc(attRef);
      if (attSnap.exists()) {
        await import("firebase/firestore").then(({ updateDoc }) => updateDoc(attRef, { status: null, check_in: null, signature_url: null }));
      }
      toast.success(`Solicitud aprobada - ${req.staff_name}`);
      // Send email to operator
      try {
        await fetch("/api/email/send-correction-resolution-operator", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            operatorEmail: req.requested_by_email,
            childName: req.staff_name,
            childCode: req.staff_type === "teacher" ? "PROF" : "PRAC",
            date: req.attendance_date,
            approved: true,
            adminNote: undefined,
          }),
        });
      } catch { /* ignore email errors */ }
      loadData();
    } catch (err) { console.error("Error approving staff correction:", err); toast.error("Error al aprobar"); }
  }

  async function handleRejectStaff(req: CorrectionRequest) {
    try {
      await rejectCorrection(req.id, rejectNote.trim() || undefined);
      toast.success(`Solicitud rechazada - ${req.staff_name}`);
      // Send email to operator
      try {
        await fetch("/api/email/send-correction-resolution-operator", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            operatorEmail: req.requested_by_email,
            childName: req.staff_name,
            childCode: req.staff_type === "teacher" ? "PROF" : "PRAC",
            date: req.attendance_date,
            approved: false,
            adminNote: rejectNote.trim(),
          }),
        });
      } catch { /* ignore email errors */ }
      setRejectingId(null);
      setRejectNote("");
      loadData();
    } catch (err) { console.error("Error rejecting staff correction:", err); toast.error("Error al rechazar"); }
  }

  async function handleApproveChild(req: CorrectionRequestChild) {
    try {
      await approveChildCorrection(req.id, req.attendance_id);
      toast.success(`Solicitud aprobada - ${req.child_name}. Registro eliminado.`);
      // Send email to operator
      try {
        await fetch("/api/email/send-correction-resolution-operator", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            operatorEmail: req.requested_by_email,
            childName: req.child_name,
            childCode: req.child_id_code || "S/I",
            date: req.attendance_date,
            approved: true,
            adminNote: undefined,
          }),
        });
      } catch { /* ignore email errors */ }
      loadData();
    } catch (err) { console.error("Error approving child correction:", err); toast.error("Error al aprobar"); }
  }

  async function handleRejectChild(req: CorrectionRequestChild) {
    try {
      await rejectChildCorrection(req.id, rejectNote.trim() || undefined);
      toast.success(`Solicitud rechazada - ${req.child_name}`);
      // Send email to operator
      try {
        await fetch("/api/email/send-correction-resolution-operator", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            operatorEmail: req.requested_by_email,
            childName: req.child_name,
            childCode: req.child_id_code || "S/I",
            date: req.attendance_date,
            approved: false,
            adminNote: rejectNote.trim(),
          }),
        });
      } catch { /* ignore email errors */ }
      setRejectingId(null);
      setRejectNote("");
      loadData();
    } catch (err) { console.error("Error rejecting child correction:", err); toast.error("Error al rechazar"); }
  }

  if (loading) return <LoadingSpinner label="Cargando solicitudes..." />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl gradient-primary flex items-center justify-center shadow-md"><ArrowPathIcon className="w-6 h-6 text-white" /></div>
        <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Solicitudes de Correccion</h1><p className="text-sm text-gray-500 dark:text-gray-400">{staffRequests.length + childRequests.length} pendientes</p></div>
      </div>

      <div className="flex gap-2">
        <button onClick={() => setActiveTab("staff")} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${activeTab === "staff" ? "gradient-primary text-white shadow-md" : "bg-white dark:bg-[#1a2438] text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700"}`}>
          <UserIcon className="w-4 h-4" />Personal ({staffRequests.length})
        </button>
        <button onClick={() => setActiveTab("children")} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${activeTab === "children" ? "gradient-primary text-white shadow-md" : "bg-white dark:bg-[#1a2438] text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700"}`}>
          <UserGroupIcon className="w-4 h-4" />Ninos ({childRequests.length})
        </button>
      </div>

      {activeTab === "staff" && (
        staffRequests.length > 0 ? (
          <div className="space-y-3">
            {staffRequests.map((req) => (
              <div key={req.id} className="bg-white dark:bg-[#1a2438] rounded-2xl p-5 border border-gray-100 dark:border-gray-800 shadow-sm">
                <div className="flex items-start justify-between flex-wrap gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${req.staff_type === "teacher" ? "bg-primary/10 text-primary" : "bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400"}`}>
                        {req.staff_type === "teacher" ? "Profesor" : "Practicante"}
                      </span>
                      <span className="text-sm text-gray-400">{req.attendance_date}</span>
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">{req.staff_name}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{req.reason}</p>
                    <p className="text-xs text-gray-400 mt-2">Solicitado por: {req.requested_by_email} · {formatDateTime(req.created_at)}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleApproveStaff(req)} className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 text-white font-semibold rounded-xl shadow-md hover:bg-emerald-600 transition-colors active:scale-95"><CheckCircleIcon className="w-5 h-5" />Aprobar</button>
                    <button onClick={() => { setRejectingId(req.id); setRejectNote(""); }} className="flex items-center gap-2 px-4 py-2.5 bg-red-500 text-white font-semibold rounded-xl shadow-md hover:bg-red-600 transition-colors active:scale-95"><XCircleIcon className="w-5 h-5" />Rechazar</button>
                  </div>
                </div>
                {rejectingId === req.id && (
                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">Motivo del rechazo *</label>
                    <textarea value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} placeholder="Escriba el motivo del rechazo..." rows={2} className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-[#0c1220] text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all resize-none" />
                    <div className="flex justify-end gap-2 mt-2">
                      <button onClick={() => { setRejectingId(null); setRejectNote(""); }} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">Cancelar</button>
                      <button onClick={() => handleRejectStaff(req)} disabled={!rejectNote.trim()} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-500 text-white disabled:opacity-50">Confirmar Rechazo</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white dark:bg-[#1a2438] rounded-2xl p-12 border border-gray-100 dark:border-gray-800 shadow-sm text-center">
            <UserIcon className="w-12 h-12 mx-auto text-gray-400 dark:text-gray-500 mb-3" />
            <p className="text-gray-700 dark:text-gray-300 font-medium">No hay solicitudes de personal pendientes</p>
          </div>
        )
      )}

      {activeTab === "children" && (
        childRequests.length > 0 ? (
          <div className="space-y-3">
            {childRequests.map((req) => (
              <div key={req.id} className="bg-white dark:bg-[#1a2438] rounded-2xl p-5 border border-gray-100 dark:border-gray-800 shadow-sm">
                <div className="flex items-start justify-between flex-wrap gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary">
                        {req.child_id_code}
                      </span>
                      <span className="text-sm text-gray-400">{req.attendance_date}</span>
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">{req.child_name}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      Marcado como: <span className={`font-bold ${req.old_status === "present" ? "text-emerald-500" : "text-red-500"}`}>{req.old_status === "present" ? "Asistio" : "No asistio"}</span>
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{req.reason}</p>
                    <p className="text-xs text-gray-400 mt-2">Solicitado por: {req.requested_by_email} · {formatDateTime(req.created_at)}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleApproveChild(req)} className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 text-white font-semibold rounded-xl shadow-md hover:bg-emerald-600 transition-colors active:scale-95"><CheckCircleIcon className="w-5 h-5" />Aprobar</button>
                    <button onClick={() => { setRejectingId(req.id); setRejectNote(""); }} className="flex items-center gap-2 px-4 py-2.5 bg-red-500 text-white font-semibold rounded-xl shadow-md hover:bg-red-600 transition-colors active:scale-95"><XCircleIcon className="w-5 h-5" />Rechazar</button>
                  </div>
                </div>
                {rejectingId === req.id && (
                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">Motivo del rechazo *</label>
                    <textarea value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} placeholder="Escriba el motivo del rechazo..." rows={2} className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-[#0c1220] text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all resize-none" />
                    <div className="flex justify-end gap-2 mt-2">
                      <button onClick={() => { setRejectingId(null); setRejectNote(""); }} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">Cancelar</button>
                      <button onClick={() => handleRejectChild(req)} disabled={!rejectNote.trim()} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-500 text-white disabled:opacity-50">Confirmar Rechazo</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white dark:bg-[#1a2438] rounded-2xl p-12 border border-gray-100 dark:border-gray-800 shadow-sm text-center">
            <UserGroupIcon className="w-12 h-12 mx-auto text-gray-400 dark:text-gray-500 mb-3" />
            <p className="text-gray-700 dark:text-gray-300 font-medium">No hay solicitudes de ninos pendientes</p>
          </div>
        )
      )}
    </div>
  );
}
