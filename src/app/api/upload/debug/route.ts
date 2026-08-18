import { NextResponse } from "next/server";
import { GoogleAuth } from "google-auth-library";

export async function GET() {
  const debug: Record<string, unknown> = {};

  try {
    const saRaw = process.env.FIREBASE_SERVICE_ACCOUNT;
    debug.serviceAccountExists = !!saRaw;
    debug.serviceAccountLength = saRaw?.length || 0;

    if (!saRaw || saRaw === "{}") {
      debug.error = "FIREBASE_SERVICE_ACCOUNT not set";
      return NextResponse.json(debug);
    }

    const sa = JSON.parse(saRaw);
    debug.hasPrivateKey = !!sa.private_key;
    debug.hasClientEmail = !!sa.client_email;
    debug.projectId = sa.project_id;

    const auth = new GoogleAuth({
      credentials: { client_email: sa.client_email, private_key: sa.private_key },
      scopes: ["https://www.googleapis.com/auth/cloud-platform"],
    });

    const client = await auth.getClient();
    debug.authOk = true;

    const bucketName = "sistema-asistencia-fb5f5.appspot.com";
    const testFileName = "_test.txt";
    const uploadUrl = `https://storage.googleapis.com/upload/storage/v1/b/${bucketName}/o?uploadType=media&name=${encodeURIComponent(testFileName)}`;

    const uploadRes = await client.request({ url: uploadUrl, method: "POST", headers: { "Content-Type": "text/plain" }, body: "test" });
    debug.uploadTest = uploadRes.status === 200 ? "OK" : `Failed: ${uploadRes.status}`;

    const deleteUrl = `https://storage.googleapis.com/storage/v1/b/${bucketName}/o/${encodeURIComponent(testFileName)}`;
    const deleteRes = await client.request({ url: deleteUrl, method: "DELETE" });
    debug.deleteTest = deleteRes.status === 204 ? "OK" : `Failed: ${deleteRes.status}`;

    return NextResponse.json(debug);
  } catch (err: unknown) {
    debug.error = err instanceof Error ? err.message : String(err);
    return NextResponse.json(debug);
  }
}
