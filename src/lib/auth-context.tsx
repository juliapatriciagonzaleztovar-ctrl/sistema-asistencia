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
    const unsubscribe = onAuthStateChanged(getFirebaseAuth(), async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        await loadProfile(firebaseUser.uid);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  async function loadProfile(uid: string) {
    try {
      console.log("[Auth] Loading profile for:", uid);
      const docRef = doc(getFirebaseDb(), "profiles", uid);
      const docSnap = await getDoc(docRef);
      console.log("[Auth] Profile exists:", docSnap.exists());
      if (docSnap.exists()) {
        setProfile({ id: docSnap.id, ...docSnap.data() } as Profile);
      } else {
        // Create profile for new user with default operator role
        console.log("[Auth] Creating new profile for:", uid);
        const currentUser = getFirebaseAuth().currentUser;
        const email = currentUser?.email || "";
        const profilesSnap = await getDocs(collection(getFirebaseDb(), "profiles"));
        const isFirstUser = profilesSnap.empty;
        
        const newProfile = {
          email,
          display_name: email?.split("@")[0] || "Usuario",
          role: isFirstUser ? "super_admin" as const : "operator" as const,
          avatar_url: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        
        console.log("[Auth] Creating profile:", newProfile);
        await setDoc(docRef, newProfile);
        console.log("[Auth] Profile created successfully");
        setProfile({ id: uid, ...newProfile });
      }
    } catch (err) {
      console.error("Error loading profile:", err);
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
