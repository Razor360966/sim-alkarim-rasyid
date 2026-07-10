import ExcelJS from "exceljs";
import { EXCEL_FONTS, EXCEL_COLORS, EXCEL_ALIGNMENTS, EXCEL_BORDERS, formatExcelCell } from "./styles";

interface SchoolHeaderOptions {
  title: string;
  subtitle?: string;
  academicYear: string;
  semesterName: string;
  operatorName: string;
  schoolName?: string;
  schoolAddress?: string;
  logoText?: string;
  mergeEndCol?: string; // e.g., "AH"
}

interface SignatureOptions {
  headmasterName?: string;
  headmasterNiy?: string;
  wakaName?: string;
  wakaNiy?: string;
  location?: string;
  startColLeft?: string; // e.g. "B"
  endColLeft?: string;   // e.g. "D"
  startColRight?: string; // e.g. "J"
  endColRight?: string;   // e.g. "N"
}

/**
 * Creates a highly polished corporate school header template for SIM Alkarim Rasyid
 */
export function createSchoolHeader(
  sheet: ExcelJS.Worksheet,
  options: SchoolHeaderOptions
): number {
  const schoolName = options.schoolName || "SMP ALKARIM RASYID BOARDING SCHOOL";
  const address = options.schoolAddress || "Alamat: Jl. Solo-Suko, Surakarta, Jawa Tengah";
  const logoText = options.logoText || "🕌\nSMP AR";
  const mergeEndCol = options.mergeEndCol || "AH";

  // 1. Logo Block (A2:B5)
  sheet.mergeCells(`A2:B5`);
  const logoCell = sheet.getCell("A2");
  logoCell.value = logoText;
  formatExcelCell(logoCell, {
    font: { name: "Calibri", size: 12, bold: true, color: { argb: "FFFFFFFF" } },
    fillColor: EXCEL_COLORS.PRIMARY_NAVY,
    alignment: EXCEL_ALIGNMENTS.CENTER_MIDDLE,
    border: EXCEL_BORDERS.MEDIUM
  });

  // 2. School Info Block (C2:AH5 merged respectively per row)
  const rows = [
    { row: 2, val: options.title.toUpperCase(), font: EXCEL_FONTS.SUBTITLE },
    { row: 3, val: schoolName.toUpperCase(), font: EXCEL_FONTS.TITLE },
    { row: 4, val: `TAHUN PELAJARAN ${options.academicYear} | ${options.semesterName.toUpperCase()}`, font: EXCEL_FONTS.SECTION },
    { row: 5, val: `${address} | Dicetak oleh: ${options.operatorName}`, font: EXCEL_FONTS.SMALL_ITALIC }
  ];

  rows.forEach(({ row, val, font }) => {
    sheet.mergeCells(`C${row}:${mergeEndCol}${row}`);
    const cell = sheet.getCell(`C${row}`);
    cell.value = val;
    formatExcelCell(cell, {
      font,
      alignment: EXCEL_ALIGNMENTS.LEFT_MIDDLE
    });
  });

  // Return the row index after the header block (including spacing)
  return 7;
}

/**
 * Creates dynamic and elegant signatures at the bottom of the worksheet
 */
export function createSignatureFooter(
  sheet: ExcelJS.Worksheet,
  startRow: number,
  options: SignatureOptions = {}
): number {
  let currentRow = startRow;

  const hName = options.headmasterName || "Dr. H. Alkarim Rasyid, M.Pd.";
  const hNiy = options.headmasterNiy || "NIY: 197808202005111002";
  const wName = options.wakaName || "Ahmad Syaifuddin, S.Pd., M.P.I.";
  const wNiy = options.wakaNiy || "NIY: 198511042010121003";
  const location = options.location || "Surakarta";

  const startL = options.startColLeft || "B";
  const endL = options.endColLeft || "D";
  const startR = options.startColRight || "J";
  const endR = options.endColRight || "N";

  // Row 1: Mengetahui & Date
  const r1 = currentRow;
  sheet.mergeCells(`${startL}${r1}:${endL}${r1}`);
  sheet.mergeCells(`${startR}${r1}:${endR}${r1}`);
  
  const cellL1 = sheet.getCell(`${startL}${r1}`);
  cellL1.value = "Mengetahui,";
  cellL1.font = EXCEL_FONTS.BODY;
  cellL1.alignment = EXCEL_ALIGNMENTS.CENTER_MIDDLE;

  const cellR1 = sheet.getCell(`${startR}${r1}`);
  const todayFormatted = new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
  cellR1.value = `${location}, ${todayFormatted}`;
  cellR1.font = EXCEL_FONTS.BODY;
  cellR1.alignment = EXCEL_ALIGNMENTS.CENTER_MIDDLE;

  currentRow += 1;

  // Row 2: Roles
  const r2 = currentRow;
  sheet.mergeCells(`${startL}${r2}:${endL}${r2}`);
  sheet.mergeCells(`${startR}${r2}:${endR}${r2}`);

  const cellL2 = sheet.getCell(`${startL}${r2}`);
  cellL2.value = "Kepala Sekolah";
  cellL2.font = EXCEL_FONTS.BODY_BOLD;
  cellL2.alignment = EXCEL_ALIGNMENTS.CENTER_MIDDLE;

  const cellR2 = sheet.getCell(`${startR}${r2}`);
  cellR2.value = "Waka Kurikulum";
  cellR2.font = EXCEL_FONTS.BODY_BOLD;
  cellR2.alignment = EXCEL_ALIGNMENTS.CENTER_MIDDLE;

  // Spacing for physical signature
  currentRow += 4;

  // Row 3: Names
  const r3 = currentRow;
  sheet.mergeCells(`${startL}${r3}:${endL}${r3}`);
  sheet.mergeCells(`${startR}${r3}:${endR}${r3}`);

  const cellL3 = sheet.getCell(`${startL}${r3}`);
  cellL3.value = hName;
  cellL3.font = { ...EXCEL_FONTS.BODY_BOLD, underline: true };
  cellL3.alignment = EXCEL_ALIGNMENTS.CENTER_MIDDLE;

  const cellR3 = sheet.getCell(`${startR}${r3}`);
  cellR3.value = wName;
  cellR3.font = { ...EXCEL_FONTS.BODY_BOLD, underline: true };
  cellR3.alignment = EXCEL_ALIGNMENTS.CENTER_MIDDLE;

  currentRow += 1;

  // Row 4: Identifikasi NIY/NUPTK
  const r4 = currentRow;
  sheet.mergeCells(`${startL}${r4}:${endL}${r4}`);
  sheet.mergeCells(`${startR}${r4}:${endR}${r4}`);

  const cellL4 = sheet.getCell(`${startL}${r4}`);
  cellL4.value = hNiy;
  cellL4.font = EXCEL_FONTS.SMALL_ITALIC;
  cellL4.alignment = EXCEL_ALIGNMENTS.CENTER_MIDDLE;

  const cellR4 = sheet.getCell(`${startR}${r4}`);
  cellR4.value = wNiy;
  cellR4.font = EXCEL_FONTS.SMALL_ITALIC;
  cellR4.alignment = EXCEL_ALIGNMENTS.CENTER_MIDDLE;

  return currentRow + 2;
}

/**
 * Configure professional page settings, orientations and scaling options for prints
 */
export function applyPageSetup(
  sheet: ExcelJS.Worksheet,
  options: {
    orientation?: "landscape" | "portrait";
    fitToWidth?: boolean;
    fitToHeight?: boolean;
    repeatRowsStart?: number;
    repeatRowsEnd?: number;
    printAreaStartCol?: string;
    printAreaEndCol?: string;
    printAreaEndRow?: number;
  }
) {
  // Set orientation and margins
  sheet.pageSetup = {
    orientation: options.orientation || "landscape",
    paperSize: 9, // A4 paper size
    margins: {
      left: 0.5,
      right: 0.5,
      top: 0.5,
      bottom: 0.5,
      header: 0.3,
      footer: 0.3,
    },
    fitToPage: true,
    fitToWidth: options.fitToWidth !== false ? 1 : 0,
    fitToHeight: options.fitToHeight ? 1 : 0,
    horizontalCentered: true,
    verticalCentered: false,
  };

  // Repeat specific row headers at the top of every printed page
  if (options.repeatRowsStart && options.repeatRowsEnd) {
    sheet.pageSetup.printTitlesRow = `${options.repeatRowsStart}:${options.repeatRowsEnd}`;
  }

  // Set explicit print area if defined
  if (options.printAreaStartCol && options.printAreaEndCol && options.printAreaEndRow) {
    sheet.pageSetup.printArea = `${options.printAreaStartCol}1:${options.printAreaEndCol}${options.printAreaEndRow}`;
  }

  // Inject a clean header/footer page counter
  sheet.headerFooter = {
    differentFirst: false,
    differentOddEven: false,
    oddHeader: "&C&8SMP Alkarim Rasyid Boarding School - Dokumen Resmi",
    oddFooter: "&L&8SIM Alkarim v2.0 - Tanggal Cetak: &D &T&R&8Halaman &P dari &N"
  };
}

/**
 * Creates an auxiliary hidden sheet or section with system-trace metadata
 */
export function writeExportMetadata(
  workbook: ExcelJS.Workbook,
  operatorName: string,
  appName: string = "SIM Alkarim Rasyid Boarding School"
) {
  const metaSheet = workbook.addWorksheet("System_Metadata");
  // Hide the sheet to keep UI clean, but let auditor view it if they unhide
  metaSheet.state = "hidden";

  metaSheet.columns = [
    { header: "Key Parameter", key: "key", width: 30 },
    { header: "Value Detail", key: "value", width: 50 }
  ];

  const now = new Date();
  metaSheet.addRows([
    { key: "System Application", value: appName },
    { key: "Application Version", value: "v2.0.1" },
    { key: "Module", value: "Academic Planning & Calendar" },
    { key: "Exported By", value: operatorName },
    { key: "Export Date", value: now.toLocaleDateString("id-ID") },
    { key: "Export Time", value: now.toLocaleTimeString("id-ID") },
    { key: "ISO Timestamp", value: now.toISOString() },
    { key: "Security Status", value: "Verified Official Export" }
  ]);

  // Style header row
  const headerRow = metaSheet.getRow(1);
  headerRow.font = { name: "Calibri", size: 10, bold: true };
}
