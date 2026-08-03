"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, getDoc, setDoc, collection, getDocs } from "firebase/firestore";
import { getFirebaseAuth, getFirebaseDb } from "./firebase";
import type { Profile } from "@/types/database";

interface AuthCtxType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => void;
}

const AuthCtx = createContext<AuthCtxType>({ user: null, profile: null, loading: true, signOut: () => {} });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(getFirebaseAuth(), (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
      if (firebaseUser) {
        loadProfile(firebaseUser.uid);
      } else {
        setProfile(null);
      }
    });
    return () => unsubscribe();
  }, []);

  async function loadProfile(uid: string) {
    try {
      const docRef = doc(getFirebaseDb(), "profiles", uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setProfile({ id: docSnap.id, ...docSnap.data() } as Profile);
      } else {
        const profilesSnap = await getDocs(collection(getFirebaseDb(), "profiles"));
        if (profilesSnap.empty) {
          const newProfile = {
            email: getFirebaseAuth().currentUser?.email || "",
            display_name: getFirebaseAuth().currentUser?.email?.split("@")[0] || "Usuario",
            role: "super_admin" as const,
            avatar_url: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          await setDoc(docRef, newProfile);
          setProfile({ id: uid, ...newProfile });
        } else {
          setProfile(null);
        }
      }
    } catch {
      setProfile(null);
    }
  }

  function signOut() {
    import("firebase/auth").then(({ signOut: fbSignOut }) => {
      fbSignOut(getFirebaseAuth()).then(() => { window.location.href = "/login"; });
    });
  }

  return <AuthCtx.Provider value={{ user, profile, loading, signOut }}>{children}</AuthCtx.Provider>;
}

export function useAuth() { return useContext(AuthCtx); }
