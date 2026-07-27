import { signInWithEmailAndPassword, signOut as fbSignOut, onAuthStateChanged, type User } from "firebase/auth";
import { doc, getDoc, setDoc, collection, getDocs, deleteDoc, query, orderBy } from "firebase/firestore";
import { auth, db } from "./firebase";
import type { Profile } from "@/types/database";

export async function signIn(email: string, password: string) {
  const result = await signInWithEmailAndPassword(auth, email, password);
  return result;
}

export async function signOut() {
  await fbSignOut(auth);
}

export function onAuthChange(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}

export async function getCurrentUser(): Promise<User | null> {
  return auth.currentUser;
}

export async function getProfile(): Promise<Profile | null> {
  const user = auth.currentUser;
  if (!user) return null;
  const docRef = doc(db, "profiles", user.uid);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) return null;
  return { id: docSnap.id, ...docSnap.data() } as Profile;
}

export async function getProfileById(uid: string): Promise<Profile | null> {
  const docRef = doc(db, "profiles", uid);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) return null;
  return { id: docSnap.id, ...docSnap.data() } as Profile;
}

export async function getAllProfiles(): Promise<Profile[]> {
  const q = query(collection(db, "profiles"), orderBy("display_name"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Profile));
}

export async function createProfile(
  uid: string,
  email: string,
  displayName: string,
  role: "super_admin" | "operator"
) {
  await setDoc(doc(db, "profiles", uid), {
    email,
    display_name: displayName,
    role,
    created_at: new Date().toISOString(),
  });
}

export async function updateProfile(
  id: string,
  updates: Partial<{ display_name: string; role: string }>
) {
  const { updateProfile: fbUpdate } = await import("firebase/auth");
  if (auth.currentUser?.uid === id && updates.display_name) {
    await fbUpdate(auth.currentUser, { displayName: updates.display_name });
  }
  const { updateDoc } = await import("firebase/firestore");
  await updateDoc(doc(db, "profiles", id), updates);
}

export async function deleteProfile(id: string) {
  const { deleteUser } = await import("firebase/auth");
  if (auth.currentUser?.uid === id) {
    await deleteUser(auth.currentUser);
  }
  const { deleteDoc } = await import("firebase/firestore");
  await deleteDoc(doc(db, "profiles", id));
}
