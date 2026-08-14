import { initializeApp, getApps, cert, type ServiceAccount, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getStorage, type Storage } from "firebase-admin/storage";

let app: App | null = null;

function getApp(): App {
  if (app) return app;
  const serviceAccount: ServiceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || "{}");
  app = getApps().length === 0
    ? initializeApp({
        credential: cert(serviceAccount),
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "sistema-asistencia-fb5f5.firebasestorage.app",
      })
    : getApps()[0];
  return app;
}

export function getAdminDb(): Firestore {
  return getFirestore(getApp());
}

export function getAdminAuth(): Auth {
  return getAuth(getApp());
}

export function getAdminStorage(): Storage {
  return getStorage(getApp());
}
