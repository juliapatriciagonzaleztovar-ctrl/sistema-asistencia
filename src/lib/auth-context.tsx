"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "./firebase";
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
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
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
      const docRef = doc(db, "profiles", uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setProfile({ id: docSnap.id, ...docSnap.data() } as Profile);
      } else {
        const newProfile = {
          email: auth.currentUser?.email || "",
          display_name: auth.currentUser?.email?.split("@")[0] || "Usuario",
          role: "super_admin" as const,
          avatar_url: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        await setDoc(docRef, newProfile);
        setProfile({ id: uid, ...newProfile });
      }
    } catch {
      setProfile(null);
    }
  }

  function signOut() {
    import("firebase/auth").then(({ signOut: fbSignOut }) => {
      fbSignOut(auth).then(() => { window.location.href = "/login"; });
    });
  }

  return <AuthCtx.Provider value={{ user, profile, loading, signOut }}>{children}</AuthCtx.Provider>;
}

export function useAuth() { return useContext(AuthCtx); }
