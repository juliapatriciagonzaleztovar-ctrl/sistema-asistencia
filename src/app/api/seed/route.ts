import { NextResponse } from "next/server";
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, collection, addDoc, getDocs } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAJOKIzGTeDfdqEve1tvSN4m1PtDkcR7gc",
  authDomain: "sistema-asistencia-fb5f5.firebaseapp.com",
  projectId: "sistema-asistencia-fb5f5",
  storageBucket: "sistema-asistencia-fb5f5.firebasestorage.app",
  messagingSenderId: "809785160456",
  appId: "1:809785160456:web:490613b53adfc0586332bd",
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(app);

export async function GET() {
  const results: string[] = [];

  try {
    const settings = [
      { key: "institution_name", value: "Casita de tareas - La alegria del conocimiento" },
      { key: "institution_phone", value: "3173883636" },
      { key: "institution_address", value: "" },
      { key: "morning_start", value: "" },
      { key: "morning_end", value: "" },
      { key: "afternoon_start", value: "14:00" },
      { key: "afternoon_end", value: "17:00" },
    ];

    const existing = await getDocs(collection(db, "system_settings"));
    if (existing.empty) {
      for (const s of settings) {
        await addDoc(collection(db, "system_settings"), {
          setting_key: s.key,
          setting_value: s.value,
          updated_at: new Date().toISOString(),
        });
      }
      results.push("Configuracion creada (7 campos)");
    } else {
      results.push("Configuracion ya existe, saltando...");
    }

    const groups = [
      { name: "Ninos pequenos", description: "0 a 5 anos" },
      { name: "Ninos infancia", description: "6 a 10 anos" },
      { name: "Ninos preadolescencia", description: "11 a 16 anos" },
    ];

    const existingGroups = await getDocs(collection(db, "groups"));
    if (existingGroups.empty) {
      for (const g of groups) {
        await addDoc(collection(db, "groups"), {
          ...g,
          created_at: new Date().toISOString(),
        });
      }
      results.push("Grupos creados (3)");
    } else {
      results.push("Grupos ya existen, saltando...");
    }

    return NextResponse.json({ ok: true, results });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
