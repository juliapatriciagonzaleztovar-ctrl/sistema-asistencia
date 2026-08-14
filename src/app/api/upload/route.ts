import { NextRequest, NextResponse } from "next/server";
import { getAdminStorage } from "@/lib/firebase-admin";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const collection = formData.get("collection") as string || "children";
    const entityId = formData.get("entityId") as string || "unknown";

    if (!file) {
      return NextResponse.json({ error: "No file" }, { status: 400 });
    }

    const storage = getAdminStorage();
    const bucket = storage.bucket("sistema-asistencia-fb5f5");
    const fileName = `${collection}/${entityId}.jpg`;
    const buffer = Buffer.from(await file.arrayBuffer());

    await bucket.file(fileName).save(buffer, {
      contentType: "image/jpeg",
      metadata: { cacheControl: "public, max-age=31536000" },
    });

    const url = bucket.file(fileName).publicUrl();

    return NextResponse.json({ url });
  } catch (err: unknown) {
    console.error("Upload API error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Upload failed" }, { status: 500 });
  }
}
