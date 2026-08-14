import { NextResponse } from "next/server";
import { getAdminStorage } from "@/lib/firebase-admin";

export async function GET() {
  const debug: Record<string, unknown> = {};

  try {
    debug.serviceAccountExists = !!process.env.FIREBASE_SERVICE_ACCOUNT;
    debug.serviceAccountLength = process.env.FIREBASE_SERVICE_ACCOUNT?.length || 0;

    const raw = process.env.FIREBASE_SERVICE_ACCOUNT || "{}";
    const parsed = JSON.parse(raw);
    debug.hasPrivateKey = !!parsed.private_key;
    debug.hasClientEmail = !!parsed.client_email;
    debug.projectId = parsed.project_id;

    const storage = getAdminStorage();
    const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "sistema-asistencia-fb5f5.firebasestorage.app";
    const bucket = storage.bucket(bucketName);
    debug.bucketName = bucketName;

    const [exists] = await bucket.exists();
    debug.bucketExists = exists;

    if (!exists) {
      return NextResponse.json(debug);
    }

    const testFile = bucket.file("_test.txt");
    await testFile.save("test", { contentType: "text/plain" });
    debug.writeTest = "OK";
    await testFile.delete();
    debug.deleteTest = "OK";

    return NextResponse.json(debug);
  } catch (err: unknown) {
    debug.error = err instanceof Error ? err.message : String(err);
    debug.stack = err instanceof Error ? err.stack : undefined;
    return NextResponse.json(debug);
  }
}
