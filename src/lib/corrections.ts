import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, where } from "firebase/firestore";
import { getFirebaseDb, getFirebaseAuth } from "./firebase";
import { logAction } from "./audit";
import type { CorrectionRequest, CorrectionRequestChild } from "@/types/database";

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
    admin_note: null,
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
    where("status", "==", "pending")
  );
  const snapshot = await getDocs(q);
  const results = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as CorrectionRequest));
  results.sort((a, b) => b.created_at.localeCompare(a.created_at));
  return results;
}

export async function approveCorrection(correctionId: string, adminNote?: string) {
  const user = getFirebaseAuth().currentUser;
  if (!user) throw new Error("No autenticado");

  const reqRef = doc(getFirebaseDb(), "correction_requests", correctionId);
  await updateDoc(reqRef, {
    status: "approved",
    resolved_by: user.uid,
    resolved_by_email: user.email || "",
    admin_note: adminNote || null,
    resolved_at: new Date().toISOString(),
  });

  await logAction("update", "correction_requests", correctionId, {
    status: "approved",
    by: user.email,
  });
}

export async function rejectCorrection(correctionId: string, adminNote?: string) {
  const user = getFirebaseAuth().currentUser;
  if (!user) throw new Error("No autenticado");

  const reqRef = doc(getFirebaseDb(), "correction_requests", correctionId);
  await updateDoc(reqRef, {
    status: "rejected",
    resolved_by: user.uid,
    resolved_by_email: user.email || "",
    admin_note: adminNote || null,
    resolved_at: new Date().toISOString(),
  });

  await logAction("update", "correction_requests", correctionId, {
    status: "rejected",
    by: user.email,
  });
}

export async function createChildCorrectionRequest(
  attendanceId: string,
  childId: string,
  childName: string,
  childIdCode: string,
  oldStatus: "present" | "absent",
  attendanceDate: string,
  reason: string
) {
  const user = getFirebaseAuth().currentUser;
  if (!user) throw new Error("No autenticado");

  const docRef = await addDoc(collection(getFirebaseDb(), "correction_requests_children"), {
    attendance_id: attendanceId,
    child_id: childId,
    child_name: childName,
    child_id_code: childIdCode,
    old_status: oldStatus,
    attendance_date: attendanceDate,
    requested_by: user.uid,
    requested_by_email: user.email || "",
    reason,
    status: "pending",
    resolved_by: null,
    resolved_by_email: null,
    admin_note: null,
    created_at: new Date().toISOString(),
    resolved_at: null,
  });

  await logAction("create", "correction_requests_children", docRef.id, {
    child_name: childName,
    child_id_code: childIdCode,
    old_status: oldStatus,
    attendance_date: attendanceDate,
    reason,
  });

  return docRef.id;
}

export async function getPendingChildCorrections(): Promise<CorrectionRequestChild[]> {
  const q = query(
    collection(getFirebaseDb(), "correction_requests_children"),
    where("status", "==", "pending")
  );
  const snapshot = await getDocs(q);
  const results = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as CorrectionRequestChild));
  results.sort((a, b) => b.created_at.localeCompare(a.created_at));
  return results;
}

export async function getAllChildCorrections(): Promise<CorrectionRequestChild[]> {
  const snapshot = await getDocs(collection(getFirebaseDb(), "correction_requests_children"));
  const results = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as CorrectionRequestChild));
  results.sort((a, b) => b.created_at.localeCompare(a.created_at));
  return results;
}

export async function approveChildCorrection(correctionId: string, attendanceId: string, adminNote?: string) {
  const user = getFirebaseAuth().currentUser;
  if (!user) throw new Error("No autenticado");

  const reqRef = doc(getFirebaseDb(), "correction_requests_children", correctionId);
  await updateDoc(reqRef, {
    status: "approved",
    resolved_by: user.uid,
    resolved_by_email: user.email || "",
    admin_note: adminNote || null,
    resolved_at: new Date().toISOString(),
  });

  await deleteDoc(doc(getFirebaseDb(), "attendance_children", attendanceId));

  await logAction("update", "correction_requests_children", correctionId, {
    status: "approved",
    attendance_deleted: attendanceId,
    by: user.email,
  });
}

export async function rejectChildCorrection(correctionId: string, adminNote?: string) {
  const user = getFirebaseAuth().currentUser;
  if (!user) throw new Error("No autenticado");

  const reqRef = doc(getFirebaseDb(), "correction_requests_children", correctionId);
  await updateDoc(reqRef, {
    status: "rejected",
    resolved_by: user.uid,
    resolved_by_email: user.email || "",
    admin_note: adminNote || null,
    resolved_at: new Date().toISOString(),
  });

  await logAction("update", "correction_requests_children", correctionId, {
    status: "rejected",
    by: user.email,
  });
}

export async function getMyChildCorrections(userId: string): Promise<CorrectionRequestChild[]> {
  const q = query(
    collection(getFirebaseDb(), "correction_requests_children"),
    where("requested_by", "==", userId)
  );
  const snapshot = await getDocs(q);
  const results = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as CorrectionRequestChild));
  results.sort((a, b) => b.created_at.localeCompare(a.created_at));
  return results;
}
