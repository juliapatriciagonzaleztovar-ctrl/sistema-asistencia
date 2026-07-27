import { collection, addDoc, query, orderBy, getDocs, limit } from "firebase/firestore";
import { db } from "./firebase";
import { auth } from "./firebase";
import type { AuditLog } from "@/types/database";

export async function logAction(
  action: string,
  entityType: string,
  entityId: string | null,
  details: Record<string, unknown> | null
) {
  const user = auth.currentUser;
  const userEmail = user?.email || "system";

  await addDoc(collection(db, "audit_logs"), {
    user_id: user?.uid || null,
    user_email: userEmail,
    action,
    entity_type: entityType,
    entity_id: entityId,
    details,
    created_at: new Date().toISOString(),
  });
}

export async function getAuditLogs(): Promise<AuditLog[]> {
  const q = query(collection(db, "audit_logs"), orderBy("created_at", "desc"), limit(100));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as AuditLog));
}
