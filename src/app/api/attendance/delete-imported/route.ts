import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { startDate, endDate, registeredBy } = body;

    if (!startDate || !endDate) {
      return NextResponse.json({ error: "Se requieren startDate y endDate" }, { status: 400 });
    }

    const adminDb = getAdminDb();
    const snapshot = await adminDb
      .collection("attendance_children")
      .where("registered_by", "==", registeredBy || "csv-import")
      .where("attendance_date", ">=", startDate)
      .where("attendance_date", "<=", endDate)
      .get();

    if (snapshot.empty) {
      return NextResponse.json({ deleted: 0, message: "No se encontraron registros" });
    }

    // Batch delete (max 500 per batch)
    let deleted = 0;
    const batchSize = 500;
    const docs = snapshot.docs;

    for (let i = 0; i < docs.length; i += batchSize) {
      const batch = adminDb.batch();
      const chunk = docs.slice(i, i + batchSize);
      for (const doc of chunk) {
        batch.delete(doc.ref);
      }
      await batch.commit();
      deleted += chunk.length;
    }

    return NextResponse.json({
      success: true,
      deleted,
      message: `${deleted} registros eliminados correctamente`,
    });
  } catch (err: unknown) {
    console.error("Delete error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error interno" }, { status: 500 });
  }
}
