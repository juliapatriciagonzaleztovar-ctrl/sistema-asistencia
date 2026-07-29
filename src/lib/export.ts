import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export function exportToExcel(data: Record<string, unknown>[], filename: string) {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Datos");
  XLSX.writeFile(workbook, `${filename}.xlsx`);
}

export function exportToPDF(
  title: string,
  headers: string[],
  data: string[][],
  filename: string
) {
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

export function exportToCsv(data: Record<string, unknown>[], filename: string) {
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