export async function exportToExcel(data: Record<string, unknown>[], filename: string) {
  const XLSX = await getXlsx();
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Datos");
  XLSX.writeFile(workbook, `${filename}.xlsx`);
}

async function getPdfLibs(): Promise<{ jsPDF: typeof import("jspdf").default; autoTable: typeof import("jspdf-autotable").default }> {
  const [jsModule, atModule] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  return { jsPDF: jsModule.default, autoTable: atModule.default };
}

async function getXlsx() {
  return import("xlsx");
}

export async function exportToPDF(
  title: string,
  headers: string[],
  data: string[][],
  filename: string
) {
  const { jsPDF, autoTable } = await getPdfLibs();
  const doc = new jsPDF();

  doc.setFontSize(18);
  doc.text(title, 14, 22);
  doc.setFontSize(10);
  const now = new Date();
  const dateStr = now.toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" });
  const timeStr = now.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
  doc.text(`Fecha: ${dateStr}`, 14, 32);
  doc.text(`Hora: ${timeStr}`, 14, 38);

  autoTable(doc, {
    head: [headers],
    body: data as never[][],
    startY: 44,
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [37, 99, 235], textColor: 255 },
    alternateRowStyles: { fillColor: [240, 245, 255] },
  });

  doc.save(`${filename}.pdf`);
}

export async function exportToCsv(data: Record<string, unknown>[], filename: string) {
  const XLSX = await getXlsx();
  const worksheet = XLSX.utils.json_to_sheet(data);
  const csv = XLSX.utils.sheet_to_csv(worksheet);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export interface PDFDetailRow {
  name: string;
  groupOrType: string;
  date: string;
  status: string;
  signatureDataUrl?: string | null;
}

export async function exportToPDFDetail(
  title: string,
  headers: string[],
  rows: PDFDetailRow[],
  filename: string,
  includeSignature: boolean
) {
  const { jsPDF, autoTable } = await getPdfLibs();
  const doc = new jsPDF({ orientation: includeSignature ? "landscape" : "portrait", unit: "mm", format: "a4" });

  doc.setFontSize(16);
  doc.text(title, 14, 18);
  doc.setFontSize(9);
  const dateStr = new Date().toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" });
  doc.text(`Generado: ${dateStr}`, 14, 26);

  const body: (string | { content: string; styles: Record<string, unknown> })[][] = [];

  rows.forEach((row) => {
    const rowCells: (string | { content: string; styles: Record<string, unknown> })[] = [
      row.name,
      row.groupOrType,
      row.date,
      row.status,
    ];
    if (includeSignature) {
      rowCells.push("");
    }
    body.push(rowCells);
  });

  const tableOptions: Record<string, unknown> = {
    head: [headers],
    body: body as never[][],
    startY: 30,
    styles: { fontSize: includeSignature ? 8 : 10, cellPadding: includeSignature ? 2.5 : 3 },
    headStyles: { fillColor: [37, 99, 235], textColor: 255 },
    alternateRowStyles: { fillColor: [240, 245, 255] },
    columnStyles: includeSignature ? {
      0: { cellWidth: 50 },
      1: { cellWidth: 35 },
      2: { cellWidth: 30 },
      3: { cellWidth: 30 },
      4: { cellWidth: 55 },
    } : {
      0: { cellWidth: 65 },
      1: { cellWidth: 40 },
      2: { cellWidth: 40 },
      3: { cellWidth: 35 },
    },
  };

  autoTable(doc, tableOptions);

  if (includeSignature) {
    const docAny = doc as unknown as { lastAutoTable?: { finalY: number } };
    const finalY = docAny.lastAutoTable?.finalY || 30;

    rows.forEach((row, i) => {
      if (row.signatureDataUrl && row.signatureDataUrl.startsWith("data:image")) {
        try {
          const imgWidth = 28;
          const imgHeight = 14;
          const y = (finalY as number) + 4 + i * 14;
          if (y + imgHeight < doc.internal.pageSize.getHeight()) {
            doc.addImage(row.signatureDataUrl, "PNG", 195, y, imgWidth, imgHeight);
          }
        } catch { /* skip invalid images */ }
      }
    });
  }

  doc.save(`${filename}.pdf`);
}