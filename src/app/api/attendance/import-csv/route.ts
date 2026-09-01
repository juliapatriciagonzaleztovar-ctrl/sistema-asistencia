import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";

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

function fixEncoding(text: string): string {
  return text
    .replace(/Ã¡/g, "á")
    .replace(/Ã©/g, "é")
    .replace(/Ã­/g, "í")
    .replace(/Ã³/g, "ó")
    .replace(/Ãº/g, "ú")
    .replace(/Ã±/g, "ñ")
    .replace(/Ã/g, "Á")
    .replace(/Ã‰/g, "É")
    .replace(/Ã/g, "Í")
    .replace(/Ã“/g, "Ó")
    .replace(/Ãš/g, "Ú")
    .replace(/Ã‘/g, "Ñ")
    .replace(/Ã¼/g, "ü")
    .replace(/Ãœ/g, "Ü");
}

// Try multiple matching strategies
function findChildMatch(recordNormName: string, nameToChild: Map<string, any>): any {
  // 1. Exact match
  if (nameToChild.has(recordNormName)) {
    return nameToChild.get(recordNormName);
  }

  // 2. Try matching by parts (first name + last name combinations)
  const recordParts = recordNormName.split(" ").filter(p => p.length > 2);
  if (recordParts.length >= 2) {
    for (const [key, child] of nameToChild.entries()) {
      const keyParts = key.split(" ");
      const firstMatch = recordParts.some(rp => keyParts.some(kp => kp.startsWith(rp) || rp.startsWith(kp)));
      const lastMatch = recordParts.some(rp => keyParts.some(kp => kp.endsWith(rp) || rp.endsWith(kp)));
      if (firstMatch && lastMatch) {
        return child;
      }
    }
  }

  // 3. Fuzzy similarity (Jaccard on words)
  let bestMatch = null;
  let bestScore = 0;
  
  for (const [key, child] of nameToChild.entries()) {
    const score = similarity(recordNormName, key);
    if (score > 0.65 && score > (bestScore || 0)) {
      bestScore = score;
      bestMatch = child;
    }
  }
  
  return bestMatch;
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

    // Read file as array buffer to handle encoding
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Try to detect encoding and decode properly
    let text: string;
    try {
      // Try UTF-8 first
      text = new TextDecoder("utf-8").decode(uint8Array);
    } catch {
      // Fallback to Latin1 (common for Excel exports in Spanish)
      text = new TextDecoder("latin1").decode(uint8Array);
    }
    
    // Fix common encoding issues
    text = fixEncoding(text);

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

    // Detect if the entire row is wrapped in quotes as a single field
    // e.g., "Fecha,Nombre,Estado" instead of "Fecha","Nombre","Estado"
    const rows = parsed.map(row => {
      if (row.length === 1 && row[0].includes(",")) {
        return row[0].split(",").map(c => c.replace(/^"|"$/g, "").trim());
      }
      return row;
    });

    // Find column indices
    const header = rows[0].map(h => h.toLowerCase().trim());
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
    
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row.length <= Math.max(fechaIdx, nombreIdx, estadoIdx)) continue;

      const fecha = row[fechaIdx]?.trim();
      const nombre = row[nombreIdx]?.trim();
      const estadoRaw = row[estadoIdx]?.toLowerCase().trim() || "";

      if (!fecha || !nombre) continue;

      const status = estadoRaw.includes("no asist") ? "absent" : estadoRaw.includes("asist") ? "present" : "absent";

      // Fix encoding on the name
      const fixedName = fixEncoding(nombre.trim());

      records.push({
        name: fixedName,
        normName: normalizeName(fixedName),
        date: fecha,
        status,
      });
    }

    if (records.length === 0) {
      return NextResponse.json({ error: "No se encontraron registros válidos" }, { status: 400 });
    }

    console.log(`[Import] Processing ${records.length} records`);

    // Load children from Firestore
    const adminDb = getAdminDb();
    const childrenSnap = await adminDb.collection("children").where("status", "==", "active").get();
    
    const nameToChild = new Map<string, { id: string; name: string; normName: string; firstName: string; lastName: string; code: string; groupId: string }>();
    
    childrenSnap.docs.forEach(doc => {
      const data = doc.data();
      const fullName = `${data.first_name} ${data.last_name}`;
      const norm = normalizeName(fullName);
      const child = {
        id: doc.id,
        name: fullName,
        normName: norm,
        firstName: normalizeName(data.first_name),
        lastName: normalizeName(data.last_name),
        code: data.child_id_code || "",
        groupId: data.group_id,
      };
      nameToChild.set(norm, child);
    });

    console.log(`[Import] Loaded ${nameToChild.size} children from Firestore`);

    // Match and import
    let imported = 0;
    const unmatched: string[] = [];
    const matchedNames: string[] = [];

    for (const record of records) {
      const child = findChildMatch(record.normName, nameToChild);
      
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

    // Log unmatched for debugging
    if (unmatched.length > 0) {
      console.log(`[Import] Unmatched (${unmatched.length}):`, unmatched.slice(0, 20));
    }

    return NextResponse.json({
      success: true,
      totalRecords: records.length,
      imported: matchedNames.length,
      unmatched: unmatched.length,
      unmatchedNames: unmatched.slice(0, 50),
      matchedNames: matchedNames.slice(0, 50),
    });

  } catch (err: unknown) {
    console.error("Import error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error interno" }, { status: 500 });
  }
}