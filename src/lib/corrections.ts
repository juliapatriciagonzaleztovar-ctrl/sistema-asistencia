import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, orderBy, where } from "firebase/firestore";
import { getFirebaseDb, getFirebaseAuth } from "./firebase";
import { logAction } from "./audit";
import type { CorrectionRequest } from "@/types/database";

export async function createCorrectionRequest(
  attendanceId: string,
  staffId: string,
  staffType: "teacher" | "practitioner",
  staffName: string,
  attendanceDate: string,
  reason: string
) {
  const user = getFirebaseAuth().currentUser;
  if (!user) throw new Error("No autenticado");

  const docRef = await addDoc(collection(getFirebaseDb(), "correction_requests"), {
    attendance_id: attendanceId,
    staff_id: staffId,
    staff_type: staffType,
    staff_name: staffName,
    attendance_date: attendanceDate,
    requested_by: user.uid,
    requested_by_email: user.email || "",
    reason,
    status: "pending",
    resolved_by: null,
    resolved_by_email: null,
    created_at: new Date().toISOString(),
    resolved_at: null,
  });

  await logAction("create", "correction_requests", docRef.id, {
    staff_name: staffName,
    staff_type: staffType,
    attendance_date: attendanceDate,
    reason,
  });

  return docRef.id;
}

export async function getPendingCorrections(): Promise<CorrectionRequest[]> {
  const q = query(
    collection(getFirebaseDb(), "correction_requests"),
    where("status", "==", "pending"),
    orderBy("created_at", "desc")
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as CorrectionRequest));
}

export async function approveCorrection(correctionId: string) {
  const user = getFirebaseAuth().currentUser;
  if (!user) throw new Error("No autenticado");

  const reqRef = doc(getFirebaseDb(), "correction_requests", correctionId);
  await updateDoc(reqRef, {
    status: "approved",
    resolved_by: user.uid,
    resolved_by_email: user.email || "",
    resolved_at: new Date().toISOString(),
  });

  await logAction("update", "correction_requests", correctionId, {
    status: "approved",
    by: user.email,
  });
}

export async function rejectCorrection(correctionId: string) {
  const user = getFirebaseAuth().currentUser;
  if (!user) throw new Error("No autenticado");

  const reqRef = doc(getFirebaseDb(), "correction_requests", correctionId);
  await updateDoc(reqRef, {
    status: "rejected",
    resolved_by: user.uid,
    resolved_by_email: user.email || "",
    resolved_at: new Date().toISOString(),
  });

  await logAction("update", "correction_requests", correctionId, {
    status: "rejected",
    by: user.email,
  });
}