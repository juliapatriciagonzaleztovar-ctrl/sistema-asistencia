import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { getFirebaseDb } from "@/lib/firebase";

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.,]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function similarity(a: string, b: string): number {
  const setA = new Set(a.split(" "));
  const setB = new Set(b.split(" "));
  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return intersection.size / union.size;
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No se envió archivo" }, { status: 400 });
    }

    if (!file.name.endsWith(".csv")) {
      return NextResponse.json({ error: "El archivo debe ser .csv" }, { status: 400 });
    }

    const text = await file.text();
    const lines = text.trim().split("\n");

    // Parse CSV (simple parser, handles quoted fields)
    const parseCSV = (text: string): string[][] => {
      const result: string[][] = [];
      let current = "";
      let inQuotes = false;
      let row: string[] = [];

      for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const nextChar = text[i + 1];

        if (char === '"') {
          if (inQuotes && nextChar === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === "," && !inQuotes) {
          row.push(current);
          current = "";
        } else if ((char === "\n" || char === "\r") && !inQuotes) {
          if (char === "\r" && nextChar === "\n") i++;
          row.push(current);
          result.push(row);
          row = [];
          current = "";
        } else {
          current += char;
        }
      }
      if (current || row.length > 0) {
        row.push(current);
        result.push(row);
      }
      return result;
    };

    const parsed = parseCSV(text);

    if (parsed.length < 2) {
      return NextResponse.json({ error: "CSV vacío o inválido" }, { status: 400 });
    }

    // Find column indices
    const header = parsed[0].map(h => h.toLowerCase().trim());
    const fechaIdx = header.findIndex(h => h.includes("fecha"));
    const nombreIdx = header.findIndex(h => h.includes("nombre"));
    const estadoIdx = header.findIndex(h => h.includes("asist") || h.includes("estado"));

    if (fechaIdx === -1 || nombreIdx === -1 || estadoIdx === -1) {
      return NextResponse.json({ 
        error: "CSV debe tener columnas: Fecha, Nombre Completo, Estado" 
      }, { status: 400 });
    }

    // Parse records
    const records: { name: string; normName: string; date: string; status: "present" | "absent" }[] = [];
    
    for (let i = 1; i < parsed.length; i++) {
      const row = parsed[i];
      if (row.length <= Math.max(fechaIdx, nombreIdx, estadoIdx)) continue;

      const fecha = row[fechaIdx]?.trim();
      const nombre = row[nombreIdx]?.trim();
      const estadoRaw = row[estadoIdx]?.toLowerCase().trim() || "";

      if (!fecha || !nombre) continue;

      const status = estadoRaw.includes("asist") ? "present" : "absent";

      records.push({
        name: nombre.trim(),
        normName: normalizeName(nombre.trim()),
        date: fecha,
        status,
      });
    }

    if (records.length === 0) {
      return NextResponse.json({ error: "No se encontraron registros válidos" }, { status: 400 });
    }

    // Load children from Firestore
    const adminDb = getAdminDb();
    const childrenSnap = await adminDb.collection("children").where("status", "==", "active").get();
    
    const children: { id: string; name: string; normName: string; code: string; groupId: string }[] = [];
    const nameToChild = new Map<string, { id: string; name: string; normName: string; code: string }>();
    
    childrenSnap.docs.forEach(doc => {
      const data = doc.data();
      const fullName = `${data.first_name} ${data.last_name}`;
      const norm = normalizeName(fullName);
      const child = {
        id: doc.id,
        name: fullName,
        normName: norm,
        code: data.child_id_code || "",
        groupId: data.group_id,
      };
      children.push(child);
      nameToChild.set(norm, child);
    });

    // Match and import
    let imported = 0;
    let skipped = 0;
    const unmatched: string[] = [];
    const matchedNames: string[] = [];

    for (const record of records) {
      // Exact match
      let child = nameToChild.get(record.normName);
      
      // Fuzzy match if not found
      if (!child) {
        let bestMatch = null;
        let bestScore = 0;
        
        for (const [key, val] of nameToChild.entries()) {
          const score = similarity(record.normName, key);
          if (score > 0.7 && score > (bestScore || 0)) {
            bestScore = score;
            bestMatch = val;
          }
        }
        
        if (bestMatch) {
          child = bestMatch;
        }
      }

      if (!child) {
        unmatched.push(`${record.name} (${record.date})`);
        continue;
      }

      // Check if already exists
      const existingSnap = await adminDb.collection("attendance_children")
        .where("child_id", "==", child.id)
        .where("attendance_date", "==", record.date)
        .limit(1)
        .get();

      if (!existingSnap.empty) {
        // Already exists, skip
        continue;
      }

      // Import
      try {
        await adminDb.collection("attendance_children").add({
          child_id: child.id,
          attendance_date: record.date,
          status: record.status,
          check_in: record.status === "present" ? new Date().toISOString() : null,
          registered_by: "csv-import",
          created_at: new Date().toISOString(),
        });
        matchedNames.push(`${child.name} - ${record.date} - ${record.status === "present" ? "Presente" : "Ausente"}`);
      } catch (e) {
        console.error(`Error importing ${record.name}:`, e);
      }
    }

    return NextResponse.json({
      success: true,
      totalRecords: records.length,
      imported: matchedNames.length,
      unmatched: unmatched.length,
      unmatchedNames: unmatched,
      importedDetails: matchedNames,
    });

  } catch (err: unknown) {
    console.error("Import error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error interno" }, { status: 500 });
  }
}