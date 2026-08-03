import {
  collection, query, where, getDocs, addDoc, updateDoc, doc,
  orderBy, writeBatch, documentId
} from "firebase/firestore";
import { getFirebaseDb } from "./firebase";
import type { AttendanceChild, AttendanceStaff } from "@/types/database";
import { getTodayDate } from "./utils";

export async function getChildrenAttendance(date?: string) {
  const targetDate = date || getTodayDate();
  const q = query(collection(getFirebaseDb(), "attendance_children"), where("attendance_date", "==", targetDate));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as AttendanceChild));
}

export async function getChildrenAttendanceByChild(childId: string, date?: string) {
  const targetDate = date || getTodayDate();
  const q = query(
    collection(getFirebaseDb(), "attendance_children"),
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
  const childIds = attendances.map((a) => a.childId);

  const existingSnap = await getDocs(
    query(
      collection(getFirebaseDb(), "attendance_children"),
      where("attendance_date", "==", today),
      where("child_id", "in", childIds.slice(0, 30))
    )
  );
  const existingIds = new Set(existingSnap.docs.map((d) => d.data().child_id as string));

  const batch = writeBatch(getFirebaseDb());
  for (const a of attendances) {
    if (!existingIds.has(a.childId)) {
      const docRef = doc(collection(getFirebaseDb(), "attendance_children"));
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
  const q = query(collection(getFirebaseDb(), "attendance_children"), where("attendance_date", "==", targetDate));
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
    collection(getFirebaseDb(), "attendance_staff"),
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

  const docRef = await addDoc(collection(getFirebaseDb(), "attendance_staff"), {
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
    collection(getFirebaseDb(), "attendance_staff"),
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
  const q = query(collection(getFirebaseDb(), "attendance_staff"), where("attendance_date", "==", targetDate));
  const snapshot = await getDocs(q);
  const all = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as AttendanceStaff));
  return {
    teachers: all.filter((a) => a.staff_type === "teacher"),
    practitioners: all.filter((a) => a.staff_type === "practitioner"),
  };
}

export async function autoMarkAbsentChildren(userId: string) {
  const now = new Date();
  if (now.getHours() < 18) return 0;
  const today = getTodayDate();
  const [childrenSnap, attendanceSnap] = await Promise.all([
    getDocs(query(collection(getFirebaseDb(), "children"), where("status", "==", "active"))),
    getDocs(query(collection(getFirebaseDb(), "attendance_children"), where("attendance_date", "==", today))),
  ]);
  const markedIds = new Set(attendanceSnap.docs.map((d) => d.data().child_id));
  const unmarked = childrenSnap.docs.filter((d) => !markedIds.has(d.id));
  if (unmarked.length === 0) return 0;
  const batch = writeBatch(getFirebaseDb());
  for (const childDoc of unmarked) {
    const docRef = doc(collection(getFirebaseDb(), "attendance_children"));
    batch.set(docRef, {
      child_id: childDoc.id,
      attendance_date: today,
      status: "absent",
      registered_by: userId,
      auto_marked: true,
      created_at: now.toISOString(),
    });
  }
  await batch.commit();
  return unmarked.length;
}

export async function autoMarkAbsentStaff(userId: string) {
  const now = new Date();
  if (now.getHours() < 18) return 0;
  const today = getTodayDate();
  const [teachersSnap, practitionersSnap, attendanceSnap] = await Promise.all([
    getDocs(query(collection(getFirebaseDb(), "teachers"), where("status", "==", "active"))),
    getDocs(query(collection(getFirebaseDb(), "practitioners"), where("status", "==", "active"))),
    getDocs(query(collection(getFirebaseDb(), "attendance_staff"), where("attendance_date", "==", today))),
  ]);
  const markedIds = new Set(attendanceSnap.docs.map((d) => `${d.data().staff_type}-${d.data().staff_id}`));
  const unmarkedStaff: Array<{ id: string; type: "teacher" | "practitioner" }> = [];
  teachersSnap.docs.forEach((d) => { if (!markedIds.has(`teacher-${d.id}`)) unmarkedStaff.push({ id: d.id, type: "teacher" }); });
  practitionersSnap.docs.forEach((d) => { if (!markedIds.has(`practitioner-${d.id}`)) unmarkedStaff.push({ id: d.id, type: "practitioner" }); });
  if (unmarkedStaff.length === 0) return 0;
  const batch = writeBatch(getFirebaseDb());
  for (const s of unmarkedStaff) {
    const docRef = doc(collection(getFirebaseDb(), "attendance_staff"));
    batch.set(docRef, {
      staff_id: s.id,
      staff_type: s.type,
      attendance_date: today,
      check_in: null,
      check_out: null,
      status: "absent",
      signature_url: null,
      registered_by: userId,
      auto_marked: true,
      created_at: now.toISOString(),
    });
  }
  await batch.commit();
  return unmarkedStaff.length;
}

export async function updateChildAttendance(attendanceId: string, newStatus: "present" | "absent", note: string, userId: string) {
  const attRef = doc(getFirebaseDb(), "attendance_children", attendanceId);
  await updateDoc(attRef, {
    status: newStatus,
    modified_by: userId,
    modification_note: note,
    modified_at: new Date().toISOString(),
  });
}

export async function updateStaffAttendance(attendanceId: string, newCheckIn: string | null, note: string, userId: string) {
  const attRef = doc(getFirebaseDb(), "attendance_staff", attendanceId);
  await updateDoc(attRef, {
    check_in: newCheckIn || new Date().toISOString(),
    status: newCheckIn ? null : "absent",
    modified_by: userId,
    modification_note: note,
    modified_at: new Date().toISOString(),
  });
}
