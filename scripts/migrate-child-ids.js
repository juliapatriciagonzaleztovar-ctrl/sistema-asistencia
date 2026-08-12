const { initializeApp } = require("firebase/app");
const { getFirestore, collection, getDocs, doc, updateDoc, query, orderBy } = require("firebase/firestore");

const firebaseConfig = {
  apiKey: "AIzaSyA41wqU5c4Vp8nI4xK8w5y7z9q2mNrKc0",
  authDomain: "sistema-asistencia-fb5f5.firebaseapp.com",
  projectId: "sistema-asistencia-fb5f5",
  storageBucket: "sistema-asistencia-fb5f5.firebasestorage.app",
  messagingSenderId: "928235232971",
  appId: "1:928235232971:web:75101a925c3890bc72a8fd",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function migrate() {
  console.log("Obteniendo todos los ninos ordenados por created_at...");

  const snap = await getDocs(query(collection(db, "children"), orderBy("created_at", "asc")));

  console.log(`Total de ninos encontrados: ${snap.size}`);

  let count = 0;
  for (const docSnap of snap.docs) {
    count++;
    const code = `CT${String(count).padStart(3, "0")}`;
    const data = docSnap.data();
    console.log(`${code} -> ${data.first_name} ${data.last_name} (created_at: ${data.created_at})`);
    await updateDoc(doc(db, "children", docSnap.id), { child_id_code: code });
  }

  console.log(`\nMigracion completada. ${count} ninos actualizados.`);
  process.exit(0);
}

migrate().catch((e) => {
  console.error("Error en migracion:", e.message);
  process.exit(1);
});
