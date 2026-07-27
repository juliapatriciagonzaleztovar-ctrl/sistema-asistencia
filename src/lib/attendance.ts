import {
  collection, query, where, getDocs, addDoc, updateDoc, doc,
  onSnapshot, orderBy, writeBatch, documentId
} from "firebase/firestore";
import { db } from "./firebase";
import type { AttendanceChild, AttendanceStaff } from "@/types/database";
import { getTodayDate } from "./utils";

export async function getChildrenAttendance(date?: string) {
  const targetDate = date || getTodayDate();
  const q = query(collection(db, "attendance_children"), where("attendance_date", "==", targetDate));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as AttendanceChild));
}

export async function getChildrenAttendanceByChild(childId: string, date?: string) {
  const targetDate = date || getTodayDate();
  const q = query(
    collection(db, "attendance_children"),
    where("child_id", "==", childId),
    where("attendance_date", "==", targetDate)
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  const doc = snapshot.docs[0];
  return { id: doc.id, ...doc.data() } as AttendanceChild;
}

export async function registerBulkChildAttendance(
  attendances: Array<{ childId: string; status: "present" | "absent" }>,
  userId: string
) {
  const today = getTodayDate();
  const batch = writeBatch(db);

  for (const a of attendances) {
    const q = query(
      collection(db, "attendance_children"),
      where("child_id", "==", a.childId),
      where("attendance_date", "==", today)
    );
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      const docRef = doc(collection(db, "attendance_children"));
      batch.set(docRef, {
        child_id: a.childId,
        attendance_date: today,
        status: a.status,
        registered_by: userId,
        created_at: new Date().toISOString(),
      });
    }
  }

  await batch.commit();
  return attendances.length;
}

export async function getAllChildrenAttendance(date?: string) {
  const targetDate = date || getTodayDate();
  const q = query(collection(db, "attendance_children"), where("attendance_date", "==", targetDate));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as AttendanceChild));
}

export async function registerStaffAttendance(
  staffId: string,
  staffType: "teacher" | "practitioner",
  userId: string,
  signatureUrl: string | null
) {
  const today = getTodayDate();
  const q = query(
    collection(db, "attendance_staff"),
    where("staff_id", "==", staffId),
    where("staff_type", "==", staffType),
    where("attendance_date", "==", today)
  );
  const snapshot = await getDocs(q);

  if (!snapshot.empty) {
    const docRef = snapshot.docs[0].ref;
    await updateDoc(docRef, {
      check_out: new Date().toISOString(),
      signature_url: signatureUrl,
    });
    return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as AttendanceStaff;
  }

  const docRef = await addDoc(collection(db, "attendance_staff"), {
    staff_id: staffId,
    staff_type: staffType,
    attendance_date: today,
    check_in: new Date().toISOString(),
    check_out: null,
    signature_url: signatureUrl,
    registered_by: userId,
    created_at: new Date().toISOString(),
  });

  return { id: docRef.id, staff_id: staffId, staff_type: staffType, attendance_date: today, check_in: new Date().toISOString(), check_out: null, signature_url: signatureUrl, registered_by: userId } as AttendanceStaff;
}

export async function getStaffAttendanceByToday(staffId: string, staffType: "teacher" | "practitioner") {
  const today = getTodayDate();
  const q = query(
    collection(db, "attendance_staff"),
    where("staff_id", "==", staffId),
    where("staff_type", "==", staffType),
    where("attendance_date", "==", today)
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as AttendanceStaff;
}

export async function getAllStaffAttendance(date?: string) {
  const targetDate = date || getTodayDate();
  const q = query(collection(db, "attendance_staff"), where("attendance_date", "==", targetDate));
  const snapshot = await getDocs(q);
  const all = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as AttendanceStaff));
  return {
    teachers: all.filter((a) => a.staff_type === "teacher"),
    practitioners: all.filter((a) => a.staff_type === "practitioner"),
  };
}
