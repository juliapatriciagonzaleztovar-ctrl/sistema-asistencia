const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

// Load FIREBASE_SERVICE_ACCOUNT from .env.local
const envPath = path.resolve(__dirname, "../.env.local");
const envContent = fs.readFileSync(envPath, "utf-8");
const match = envContent.match(/FIREBASE_SERVICE_ACCOUNT=(.*)/);
if (!match) {
  console.error("❌ FIREBASE_SERVICE_ACCOUNT not found in .env.local");
  process.exit(1);
}

const serviceAccount = JSON.parse(match[1].replace(/^["']|["']$/g, ""));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function deleteImportedAttendance() {
  console.log("🔍 Buscando registros importados del 1 al 16 de junio 2026...\n");

  const startDate = "2026-06-01";
  const endDate = "2026-06-16";

  const snapshot = await db
    .collection("attendance_children")
    .where("registered_by", "==", "csv-import")
    .where("attendance_date", ">=", startDate)
    .where("attendance_date", "<=", endDate)
    .get();

  if (snapshot.empty) {
    console.log("✅ No se encontraron registros para eliminar.");
    return;
  }

  console.log(`📋 Encontrados ${snapshot.size} registros para eliminar:\n`);

  let count = 0;
  const batchSize = 500;
  let batch = db.batch();

  for (const doc of snapshot.docs) {
    const data = doc.data();
    count++;
    if (count <= 10) {
      console.log(`   ${count}. ${data.attendance_date} - ${data.child_id} - ${data.status}`);
    }
    batch.delete(doc.ref);

    if (count % batchSize === 0) {
      await batch.commit();
      console.log(`   ... eliminados ${count} registros...`);
      batch = db.batch();
    }
  }

  if (count > 10) {
    console.log(`   ... y ${count - 10} más`);
  }

  await batch.commit();
  console.log(`\n✅ ${count} registros eliminados correctamente.`);
}

deleteImportedAttendance()
  .then(() => {
    console.log("\n🎯 Listo. Ahora puedes reimportar el CSV.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("❌ Error:", err.message);
    process.exit(1);
  });
