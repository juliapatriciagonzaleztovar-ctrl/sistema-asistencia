"use client";

import { useState, useEffect, useContext, createContext } from "react";
import { getProfile, signOut as signOutAction } from "@/lib/auth";
import type { Profile } from "@/types/database";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";

interface AuthContextType {
  user: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    checkUser();
  }, []);

  async function checkUser() {
    try {
      const profile = await getProfile();
      setUser(profile);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  async function signOut() {
    try {
      await signOutAction();
      toast.success("Sesion cerrada correctamente");
      router.push("/login");
    } catch {
      toast.error("Error al cerrar sesion");
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}