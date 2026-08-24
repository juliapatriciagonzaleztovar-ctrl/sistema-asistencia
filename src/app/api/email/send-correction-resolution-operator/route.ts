import { NextRequest, NextResponse } from "next/server";
import { sendCorrectionResolutionNotification } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    const { operatorEmail, childName, childCode, date, approved, adminNote } = await req.json();

    if (!operatorEmail || !childName || !childCode || !date || approved === undefined) {
      return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 });
    }

    await sendCorrectionResolutionNotification(operatorEmail, childName, childCode, date, approved, adminNote);

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("Error sending correction resolution notification:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error interno" }, { status: 500 });
  }
}