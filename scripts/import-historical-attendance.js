const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

// Initialize Firebase Admin
const serviceAccount = require("./service-account.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// Helper to normalize names for matching
function normalizeName(name) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove accents
    .replace(/\s+/g, " ")
    .trim();
}

// Parse the data from text
function parseAttendanceData(text, dateStr) {
  const lines = text.trim().split("\n");
  const data = [];
  const date = new Date(dateStr);
  const formattedDate = date.toISOString().split("T")[0];

  // Skip header lines
  let startIdx = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("Nombre Completo") && lines[i].includes("Asistencia")) {
      startIdx = i + 1;
      break;
    }
  }

  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const parts = line.split("\t");
    if (parts.length < 2) continue;

    const name = parts[0].trim();
    const age = parts[1]?.trim() || "";
    const group = parts[2]?.trim() || "";
    const attendance = parts[3]?.trim() || parts[2]?.trim() || "";

    // Some lines might have missing age/group columns
    const status = attendance.toLowerCase().includes("asistio") ? "present" : "absent";

    data.push({
      name: name,
      normalizedName: normalizeName(name),
      age: age,
      group: group,
      status: status,
      date: formattedDate,
    });
  }

  return data;
}

// Read the data files
const data01 = `01 de junio de 2026
Nombre Completo	Edad	Grupo	Asistencia
Abraham Nicolas Garzón Prado	12	Ninos preadolescencia	asistio
Alan Daniel Vallejo Romo	10	Ninos infancia	asistio
Alan Matias Delgado Aristaval	8	Ninos infancia	asistio
Alejandro Daniel Pinza Cadena			no asistio 
Alice Tamara Rojas Burbano			no asistio 
Alison Estefania Salazar Chamorro	8	Ninos infancia	asistio
Alison Salomé Quejada Diaz	6	Ninos infancia	no asistio 
Amelia Enriquez Santacruz	9	Ninos infancia	no asistio 
Andy Gabriel Pantoja Salas	11	Ninos preadolescencia	no asistio 
Antonia Enriquez Melo	12	Ninos preadolescencia	no asistio 
Ariana Sofia Noguera Salas			no asistio 
Aylin Daniela Andrade Martinez	9	Ninos infancia	asistio
Brigitte Luciana Maigual Jojoa			asistio
Carlos Alexander Obando Latorre	7	Ninos infancia	asistio
Cristopher Cerón			asistio
Dana Valentina Gonzalez Gomez	14	Ninos preadolescencia	no asistio 
Daniel Esteban Ordoñez Santacruz			asistio
Daniel Estiven Hernandez Narvaez	9	Ninos infancia	asistio
Daniela  Enriquez Melo	8	Ninos infancia	no asistio 
David Santiago de la Cruz Gonzalez	8	Ninos infancia	no asistio 
Dulce Gabriela Aguilar Delgado			no asistio 
Elkin stiven  Esterilla Correa	14	Ninos preadolescencia	no asistio 
Emanuel Alejandro Criollo Zambrano	6	Ninos infancia	asistio
Emanuel Santiago Eraso Chacua			asistio
Emiliana Alexandra Palacios			no asistio 
Eric Stiven Vallejo Botina	6	Ninos infancia	asistio
Felipe Fuertes Quintero	7	Ninos infancia	no asistio 
Gabriel Jesus Garcia Velazquez	6	Ninos infancia	no asistio 
Hanny Salome Narvaez Meneses			asistio
Isaac Matias Ortiz Castro	9	Ninos infancia	no asistio 
Isabela Peña	6	Ninos infancia	asistio
Isaac Joel Burbano Delgado			asistio
Isabella Acosta Luna Alina	8	Ninos infancia	asistio
Isabela Michel Matabajoy Fajardo			asistio
Ismael Tovar			asistio
Ivan Samuel Dorado Delgado	8	Ninos infancia	no asistio 
Jairo Sebastian Gavila Rosas			asistio
Jhoan Mauricio Tovar	5	Ninos pequenos	no asistio 
Jhoan Samuel Usama Reina	5	Ninos pequenos	no asistio 
Joaquin Alexander Salazar Madroñero			no asistio 
Juan Jose Casanova Pasos	6	Ninos infancia	no asistio 
Juan Jose Ojeda Guerrero			no asistio 
Juliana Sofia Erazo Cabrera	5	Ninos pequenos	no asistio 
Julieta Abigail Lopez Arteaga	8	Ninos infancia	no asistio 
Karen Botina Arevalo			no asistio 
Keila Abigail Tumal Portillo	6	Ninos infancia	asistio
Laura Gabriela Dias Torres	13	Ninos preadolescencia	no asistio 
Laura Isabela  Yama Chinchajoa	11	Ninos preadolescencia	no asistio 
Linda Victoria Botina del Toro	10	Ninos infancia	no asistio 
Lia Samara Guerrero Guancha			no asistio 
Luciana  Mora Jimenez	9	Ninos infancia	no asistio 
Luisa Maria Yela Benavides			no asistio 
Luciana Gelpud Buesaquillo	6	Ninos infancia	no asistio 
Manuel Jeronimo Puerres Ortega	5	Ninos infancia	no asistio 
Manuela  Bravo Jurado	3	Ninos pequenos	no asistio 
Maria Alejandra Carvajal Lara	8	Ninos infancia	asistio
Maria Jose Lagos			no asistio 
Maria Sofia Eraso Melo	11	Ninos preadolescencia	no asistio 
Marian Salome Moreno Caicedo	9	Ninos infancia	asistio
Martin Santiago Galindo Lugo			no asistio 
Mariana Guadalupe Mallama Cabrera	9	Ninos infancia	asistio
Martin Alejandro Garcia Velazquez	8	Ninos infancia	no asistio 
Martina Gamboa Corrales	7	Ninos infancia	asistio
Nayibe Valeria Chavez Rojas			asistio
Samuel Teja Zuñiga			no asistio 
Salomé  Noguera	5	Ninos pequenos	no asistio 
Samuel Alejandro Ascuntar Estrada	12	Ninos preadolescencia	no asistio 
Samuel Alejandro Pantoja Zuñiga	8	Ninos infancia	asistio
Samuel Alejandro Suarez Cabrera	11	Ninos infancia	no asistio 
Samuel Hernandez Narvaez	12	Ninos preadolescencia	asistio
Samuel Matias Moreno Caicedo	11	Ninos preadolescencia	asistio
Sebastian Mayama			no asistio 
Santiago Enriquez	5	Ninos pequenos	no asistio 
Sarita Antonella Sacro Miramag	6	Ninos pequenos	no asistio 
Sebas David  Chaucanes Garzón 	5	Ninos pequenos	asistio
Sergio Ordoñez Segovio	6	Ninos infancia	no asistio 
Sophia Enriquez Caicedo	11	Ninos preadolescencia	asistio
Valerie Samara Zañudo Arciniegas	6	Ninos infancia	asistio
Violeta Torres  Guerrero Quintero	7	Ninos infancia	asistio
Wilson Emanuel Meneses Orbes	9	Ninos infancia	no asistio 
Yerick Matias Chaqua			no asistio`;

const data02 = `2 de junio de 2026
Nombre Completo	Edad	Grupo	Asistencia
Abraham Nicolas Garzón Prado	12	Ninos preadolescencia	no asistio 
Alan Daniel Vallejo Romo	10	Ninos infancia	asistio
Alan Matias Delgado Aristaval	8	Ninos infancia	asistio
Alejandro Daniel Pinza Cadena			asistio
Alice Tamara Rojas Burbano			asistio
Alison Estefania Salazar Chamorro	8	Ninos infancia	no asistio 
Alison Salomé Quejada Diaz	6	Ninos infancia	no asistio 
Amelia Enriquez Santacruz	9	Ninos infancia	no asistio 
Andy Gabriel Pantoja Salas	11	Ninos preadolescencia	asistio
Antonia Enriquez Melo	12	Ninos preadolescencia	no asistio 
Ariana Sofia Noguera Salas			no asistio 
Aylin Daniela Andrade Martinez	9	Ninos infancia	asistio
Brigitte Luciana Maigual Jojoa			asistio
Carlos Alexander Obando Latorre	7	Ninos infancia	asistio
Cristopher Cerón			no asistio 
Dana Valentina Gonzalez Gomez	14	Ninos preadolescencia	no asistio 
Daniel Esteban Ordoñez Santacruz			asistio
Daniel Estiven Hernandez Narvaez	9	Ninos infancia	asistio
Daniela  Enriquez Melo	8	Ninos infancia	no asistio 
David Santiago de la Cruz Gonzalez	8	Ninos infancia	asistio
Dulce Gabriela Aguilar Delgado			asistio
Elkin stiven  Esterilla Correa	14	Ninos preadolescencia	no asistio 
Emanuel Alejandro Criollo Zambrano	6	Ninos infancia	asistio
Emanuel Santiago Eraso Chacua			asistio
Emiliana Alexandra Palacios			no asistio 
Eric Stiven Vallejo Botina	6	Ninos infancia	asistio
Felipe Fuertes Quintero	7	Ninos infancia	asistio
Gabriel Jesus Garcia Velazquez	6	Ninos infancia	no asistio 
Hanny Salome Narvaez Meneses			no asistio 
Isaac Matias Ortiz Castro	9	Ninos infancia	no asistio 
Isabela Peña	6	Ninos infancia	asistio
Isaac Joel Burbano Delgado			asistio
Isabella Acosta Luna Alina	8	Ninos infancia	asistio
Isabela Michel Matabajoy Fajardo			asistio
Ismael Tovar			no asistio 
Ivan Samuel Dorado Delgado	8	Ninos infancia	no asistio 
Jairo Sebastian Gavila Rosas			asistio
Jhoan Mauricio Tovar	5	Ninos pequenos	no asistio 
Jhoan Samuel Usama Reina	5	Ninos pequenos	asistio
Joaquin Alexander Salazar Madroñero			no asistio 
Juan Jose Casanova Pasos	6	Ninos infancia	no asistio 
Juan Jose Ojeda Guerrero			no asistio 
Juliana Sofia Erazo Cabrera	5	Ninos pequenos	no asistio 
Julieta Abigail Lopez Arteaga	8	Ninos infancia	no asistio 
Karen Botina Arevalo			no asistio 
Keila Abigail Tumal Portillo	6	Ninos infancia	asistio
Laura Gabriela Dias Torres	13	Ninos preadolescencia	no asistio 
Laura Isabela  Yama Chinchajoa	11	Ninos preadolescencia	no asistio 
Linda Victoria Botina del Toro	10	Ninos infancia	no asistio 
Lia Samara Guerrero Guancha			asistio
Luciana  Mora Jimenez	9	Ninos infancia	asistio
Luisa Maria Yela Benavides			no asistio 
Luciana Gelpud Buesaquillo	6	Ninos infancia	no asistio 
Manuel Jeronimo Puerres Ortega	5	Ninos infancia	asistio
Manuela  Bravo Jurado	3	Ninos pequenos	asistio
Maria Alejandra Carvajal Lara	8	Ninos infancia	asistio
Maria Jose Lagos			no asistio 
Maria Sofia Eraso Melo	11	Ninos preadolescencia	no asistio 
Marian Salome Moreno Caicedo	9	Ninos infancia	asistio
Martin Santiago Galindo Lugo			asistio
Mariana Guadalupe Mallama Cabrera	9	Ninos infancia	asistio
Martin Alejandro Garcia Velazquez	8	Ninos infancia	no asistio 
Martina Gamboa Corrales	7	Ninos infancia	asistio
Nayibe Valeria Chavez Rojas			asistio
Samuel Teja Zuñiga			no asistio 
Salomé  Noguera	5	Ninos pequenos	no asistio 
Samuel Alejandro Ascuntar Estrada	12	Ninos preadolescencia	no asistio 
Samuel Alejandro Pantoja Zuñiga	8	Ninos infancia	no asistio 
Samuel Alejandro Suarez Cabrera	11	Ninos infancia	no asistio 
Samuel Hernandez Narvaez	12	Ninos preadolescencia	asistio
Samuel Matias Moreno Caicedo	11	Ninos preadolescencia	no asistio 
Sebastian Mayama			no asistio 
Santiago Enriquez	5	Ninos pequenos	no asistio 
Sarita Antonella Sacro Miramag	6	Ninos pequenos	no asistio 
Sebas David  Chaucanes Garzón 	5	Ninos pequenos	asistio
Sergio Ordoñez Segovio	6	Ninos infancia	no asistio 
Sophia Enriquez Caicedo	11	Ninos preadolescencia	asistio
Valerie Samara Zañudo Arciniegas	6	Ninos infancia	asistio
Violeta Torres  Guerrero Quintero	7	Ninos infancia	no asistio 
Wilson Emanuel Meneses Orbes	9	Ninos infancia	asistio
Yerick Matias Chaqua			no asistio`;

async function importAttendance() {
  // Parse both days
  const day1 = parseAttendanceData(data01, "2026-06-01");
  const day2 = parseAttendanceData(data02, "2026-06-02");

  console.log(`Day 1 (2026-06-01): ${day1.length} records`);
  console.log(`Day 2 (2026-06-02): ${day2.length} records`);

  // Fetch all children from Firestore
  const childrenSnap = await db.collection("children").where("status", "==", "active").get();
  const children = [];
  childrenSnap.docs.forEach(doc => {
    const data = doc.data();
    children.push({
      id: doc.id,
      name: `${data.first_name} ${data.last_name}`,
      normalizedName: normalizeName(`${data.first_name} ${data.last_name}`),
      child_id_code: data.child_id_code,
      group_id: data.group_id,
    });
  });

  console.log(`Found ${children.length} children in Firestore`);

  // Create a map for matching
  const childrenMap = new Map();
  children.forEach(c => {
    childrenMap.set(c.normalizedName, c);
  });

  // Match and import
  const allRecords = [...day1, ...day2];
  let matched = 0;
  let unmatched = 0;
  const errors = [];

  for (const record of allRecords) {
    const child = childrenMap.get(record.normalizedName);
    
    if (!child) {
      // Try partial matching
      let found = null;
      for (const [key, val] of childrenMap.entries()) {
        if (key.includes(record.normalizedName) || record.normalizedName.includes(key)) {
          found = val;
          break;
        }
      }
      
      if (!found) {
        unmatched++;
        errors.push(`No match: ${record.name} (${record.date})`);
        continue;
      }
      child = found;
    }

    // Check if attendance already exists
    const existingSnap = await db.collection("attendance_children")
      .where("child_id", "==", child.id)
      .where("attendance_date", "==", record.date)
      .limit(1)
      .get();

    if (!existingSnap.empty) {
      console.log(`Already exists: ${record.name} - ${record.date}`);
      continue;
    }

    // Create attendance record
    try {
      await db.collection("attendance_children").add({
        child_id: child.id,
        attendance_date: record.date,
        status: record.status,
        check_in: record.status === "present" ? new Date().toISOString() : null,
        registered_by: "historical-import",
        created_at: new Date().toISOString(),
      });
      matched++;
      console.log(`✓ ${record.name} - ${record.date} - ${record.status}`);
    } catch (e) {
      errors.push(`Error importing ${record.name}: ${e.message}`);
    }
  }

  console.log(`\n--- SUMMARY ---`);
  console.log(`Matched & imported: ${matched}`);
  console.log(`Unmatched: ${unmatched}`);
  
  if (errors.length > 0) {
    console.log("\nErrors:");
    errors.forEach(e => console.log(e));
  }
}

importAttendance().catch(console.error).finally(() => process.exit());