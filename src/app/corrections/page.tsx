"use client";

import { useEffect, useState } from "react";
import { getPendingCorrections, approveCorrection, rejectCorrection } from "@/lib/corrections";
import { deleteDoc, doc } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { CheckCircleIcon, XCircleIcon, ArrowPathIcon } from "@heroicons/react/24/outline";
import { toast } from "react-hot-toast";
import { formatDateTime } from "@/lib/utils";
import type { CorrectionRequest } from "@/types/database";

export default function CorrectionsPage() {
  const [requests, setRequests] = useState<CorrectionRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const data = await getPendingCorrections();
    setRequests(data);
    setLoading(false);
  }

  async function handleApprove(req: CorrectionRequest) {
    try {
      await approveCorrection(req.id);
      const attRef = doc(getFirebaseDb(), "attendance_staff", req.attendance_id);
      await import("firebase/firestore").then(({ updateDoc }) => updateDoc(attRef, { status: null, check_in: null, signature_url: null }));
      toast.success(`Solicitud aprobada - ${req.staff_name}`);
      loadData();
    } catch { toast.error("Error al aprobar"); }
  }

  async function handleReject(req: CorrectionRequest) {
    try {
      await rejectCorrection(req.id);
      toast.success(`Solicitud rechazada - ${req.staff_name}`);
      loadData();
    } catch { toast.error("Error al rechazar"); }
  }

  if (loading) return <LoadingSpinner label="Cargando solicitudes..." />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl gradient-primary flex items-center justify-center shadow-md"><ArrowPathIcon className="w-6 h-6 text-white" /></div>
        <div><h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Solicitudes de Correccion</h1><p className="text-sm text-gray-500 dark:text-gray-400">{requests.length} pendientes</p></div>
      </div>

      {requests.length > 0 ? (
        <div className="space-y-3">
          {requests.map((req) => (
            <div key={req.id} className="bg-white dark:bg-[#1a2438] rounded-2xl p-5 border border-gray-100 dark:border-gray-800 shadow-sm">
              <div className="flex items-start justify-between flex-wrap gap-4">
                <div>
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
                  <button onClick={() => handleApprove(req)} className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 text-white font-semibold rounded-xl shadow-md hover:bg-emerald-600 transition-colors active:scale-95"><CheckCircleIcon className="w-5 h-5" />Aprobar</button>
                  <button onClick={() => handleReject(req)} className="flex items-center gap-2 px-4 py-2.5 bg-red-500 text-white font-semibold rounded-xl shadow-md hover:bg-red-600 transition-colors active:scale-95"><XCircleIcon className="w-5 h-5" />Rechazar</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white dark:bg-[#1a2438] rounded-2xl p-12 border border-gray-100 dark:border-gray-800 shadow-sm text-center">
          <ArrowPathIcon className="w-12 h-12 mx-auto text-gray-400 dark:text-gray-500 mb-3" />
          <p className="text-gray-700 dark:text-gray-300 font-medium">No hay solicitudes pendientes</p>
        </div>
      )}
    </div>
  );
}