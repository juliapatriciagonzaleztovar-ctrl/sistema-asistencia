import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAJOKIzGTeDfdqEve1tvSN4m1PtDkcR7gc",
  authDomain: "sistema-asistencia-fb5f5.firebaseapp.com",
  projectId: "sistema-asistencia-fb5f5",
  storageBucket: "sistema-asistencia-fb5f5.firebasestorage.app",
  messagingSenderId: "809785160456",
  appId: "1:809785160456:web:490613b53adfc0586332bd",
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = getAuth(app);
export const db = getFirestore(app);
