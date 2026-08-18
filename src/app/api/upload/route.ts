import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const collection = formData.get("collection") as string || "children";
    const entityId = formData.get("entityId") as string || "unknown";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const sa = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!sa || sa === "{}" || !JSON.parse(sa).private_key) {
      return NextResponse.json({ error: "Service account not configured on server" }, { status: 500 });
    }

    const { getAdminStorage } = await import("@/lib/firebase-admin");
    const storage = getAdminStorage();
    const bucket = storage.bucket("sistema-asistencia-fb5f5.firebasestorage.app");
    const fileName = `${collection}/${entityId}.jpg`;
    const buffer = Buffer.from(await file.arrayBuffer());

    await bucket.file(fileName).save(buffer, {
      contentType: "image/jpeg",
      metadata: { cacheControl: "public, max-age=31536000" },
    });

    const url = `https://firebasestorage.googleapis.com/v0/b/sistema-asistencia-fb5f5.firebasestorage.app/o/${encodeURIComponent(fileName)}?alt=media`;

    return NextResponse.json({ url });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Upload failed";
    console.error("Upload API error:", msg, err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
