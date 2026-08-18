import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { getStorage } from "firebase-admin/storage";

let app: App | null = null;

function getApp(): App {
  if (app) return app;

  const serviceAccountRaw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!serviceAccountRaw || serviceAccountRaw === "{}") {
    throw new Error("FIREBASE_SERVICE_ACCOUNT not configured");
  }

  const serviceAccount = JSON.parse(serviceAccountRaw);

  app = getApps().length === 0
    ? initializeApp({
        credential: cert(serviceAccount),
        storageBucket: "sistema-asistencia-fb5f5.firebasestorage.app",
      })
    : getApps()[0];

  return app;
}

export function getAdminDb() {
  return getFirestore(getApp());
}

export function getAdminAuth() {
  return getAuth(getApp());
}

export function getAdminStorage() {
  return getStorage(getApp());
}
