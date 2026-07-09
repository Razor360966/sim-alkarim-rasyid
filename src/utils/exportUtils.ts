import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";

/**
 * Export raw JSON data to an Excel Spreadsheet
 */
export function exportToExcel(data: any[], fileName: string, sheetName: string = "Sheet1") {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, `${fileName}.xlsx`);
}

/**
 * Generate and download a PDF document report containing a clean, structured table
 */
export function exportToPDF(
  title: string,
  headers: string[],
  rows: string[][],
  fileName: string
) {
  const doc = new jsPDF("p", "mm", "a4");
  
  // Header section
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(30, 41, 59); // slate-800
  doc.text("SMP ALKARIM RASYID", 14, 15);
  
  doc.setFontSize(12);
  doc.setTextColor(71, 85, 105); // slate-600
  doc.text(title, 14, 21);
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184); // slate-400
  const dateStr = new Date().toLocaleDateString("id-ID", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
  doc.text(`Waktu Cetak: ${dateStr}`, 14, 27);
  
  // Horizontal divider
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.setLineWidth(0.5);
  doc.line(14, 30, 196, 30);
  
  // Draw table
  let y = 38;
  const tableWidth = 182; // 196 - 14
  const colWidth = tableWidth / headers.length;
  
  // Table Header Background
  doc.setFillColor(241, 245, 249); // slate-100
  doc.rect(14, y, tableWidth, 9, "F");
  
  // Table Header Border
  doc.setDrawColor(203, 213, 225); // slate-300
  doc.rect(14, y, tableWidth, 9, "S");
  
  // Table Headers
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85); // slate-700
  headers.forEach((header, index) => {
    doc.text(header, 16 + index * colWidth, y + 6);
  });
  
  y += 9;
  
  // Table Rows
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105); // slate-600
  
  rows.forEach((row, rowIndex) => {
    // Add new page if y exceeds safe printable margin
    if (y > 275) {
      doc.addPage();
      y = 20;
      
      // Draw Table Header on the new page too
      doc.setFillColor(241, 245, 249);
      doc.rect(14, y, tableWidth, 9, "F");
      doc.setDrawColor(203, 213, 225);
      doc.rect(14, y, tableWidth, 9, "S");
      doc.setFont("helvetica", "bold");
      headers.forEach((header, idx) => {
        doc.text(header, 16 + idx * colWidth, y + 6);
      });
      y += 9;
      doc.setFont("helvetica", "normal");
    }
    
    // Zebra rows bg shading
    if (rowIndex % 2 === 0) {
      doc.setFillColor(248, 250, 252); // slate-50
      doc.rect(14, y, tableWidth, 8, "F");
    }
    
    // Draw columns cells
    row.forEach((cell, cellIndex) => {
      const truncatedText = cell ? String(cell).substring(0, Math.floor(colWidth * 0.4)) : "";
      doc.text(truncatedText, 16 + cellIndex * colWidth, y + 5);
    });
    
    // Bottom border line for row
    doc.setDrawColor(241, 245, 249); // slate-100
    doc.line(14, y + 8, 196, y + 8);
    
    y += 8;
  });
  
  // Save PDF triggers download
  doc.save(`${fileName}.pdf`);
}
