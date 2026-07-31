import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Token no proporcionado" }, { status: 401 });
    }

    const idToken = authHeader.split("Bearer ")[1];
    const decodedToken = await getAdminAuth().verifyIdToken(idToken);

    const adminDoc = await getAdminDb().collection("profiles").doc(decodedToken.uid).get();
    if (!adminDoc.exists || adminDoc.data()?.role !== "super_admin") {
      return NextResponse.json({ error: "No tienes permisos" }, { status: 403 });
    }

    const { email, password, display_name, role } = await req.json();

    if (!email || !password || !display_name || !role) {
      return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: "La contrasena debe tener al menos 6 caracteres" }, { status: 400 });
    }

    if (!["super_admin", "operator"].includes(role)) {
      return NextResponse.json({ error: "Rol invalido" }, { status: 400 });
    }

    const userRecord = await getAdminAuth().createUser({ email, password, displayName: display_name });

    await getAdminDb().collection("profiles").doc(userRecord.uid).set({
      email,
      display_name,
      role,
      avatar_url: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    return NextResponse.json({ uid: userRecord.uid, message: "Usuario creado exitosamente" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error al crear usuario";
    if (message.includes("email already exists")) {
      return NextResponse.json({ error: "El correo ya esta registrado" }, { status: 409 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
