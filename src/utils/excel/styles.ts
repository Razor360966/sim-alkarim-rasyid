import ExcelJS from "exceljs";

/**
 * Standard Palette and Typography for SIM Alkarim Rasyid
 */
export const EXCEL_FONTS = {
  TITLE: { name: "Calibri", size: 16, bold: true, color: { argb: "FF1F4E79" } },
  SUBTITLE: { name: "Calibri", size: 11, italic: true, color: { argb: "FF595959" } },
  HEADER: { name: "Calibri", size: 11, bold: true, color: { argb: "FFFFFFFF" } },
  SECTION: { name: "Calibri", size: 12, bold: true, color: { argb: "FF1F4E79" } },
  BODY_BOLD: { name: "Calibri", size: 10, bold: true },
  BODY: { name: "Calibri", size: 10 },
  SMALL_BOLD: { name: "Calibri", size: 9, bold: true },
  SMALL: { name: "Calibri", size: 9 },
  SMALL_ITALIC: { name: "Calibri", size: 9, italic: true, color: { argb: "FF7F7F7F" } },
  METADATA: { name: "Calibri", size: 8, italic: true, color: { argb: "FF8C8C8C" } },
};

export const EXCEL_COLORS = {
  PRIMARY_NAVY: "FF1F4E79", // Main brand color for titles/primary headers
  SECONDARY_BLUE: "FF2F5597", // Lighter corporate blue for sub-headers
  ZEBRA_LIGHT: "FFF9FBFD", // Soft tinted zebra row bg
  GRAY_BG: "FFF2F2F2", // Standard gray for totals or metadata rows
  BLACK_OUT: "FF000000", // Black for non-existent dates
  WHITE: "FFFFFFFF",
  
  // Custom Category colors matching Web UI
  HOLIDAY_RED: { fill: "FFFFD9D9", text: "FF9C0006" }, // Light red, dark red text
  SEMESTER_RED: { fill: "FFFFB2B2", text: "FF7F0000" }, // Medium red, darker red text
  EXAM_BLUE: { fill: "FFDDEBF7", text: "FF1F497D" }, // Soft blue, dark blue text
  PAS_ORANGE: { fill: "FFFCE4D6", text: "FFC65911" }, // Soft orange, dark orange text
  PAT_YELLOW: { fill: "FFFFF2CC", text: "FF806000" }, // Soft yellow, dark yellow text
  MPLS_GREEN: { fill: "FFE2EFDA", text: "FF375623" }, // Soft green, dark green text
  RAMADHAN_GREEN: { fill: "FFC6EFCE", text: "FF006100" }, // Medium green, dark green text
  ASSESSMENT_PURPLE: { fill: "FFE1D5E7", text: "FF59258C" }, // Soft purple, dark purple text
  FESTIVAL_BROWN: { fill: "FFF5F5DC", text: "FF5C4033" }, // Beige, dark brown text
  DEFAULT_KBM: { fill: "FFD9E1F2", text: "FF1F497D" }, // Lighter blue
  REST_DAY_GRAY: { fill: "FFEFEFEF", text: "FF7F7F7F" }, // Friday / Weekend rest day
};

export const EXCEL_BORDERS = {
  THIN: {
    top: { style: "thin" as const, color: { argb: "FFD3D3D3" } },
    bottom: { style: "thin" as const, color: { argb: "FFD3D3D3" } },
    left: { style: "thin" as const, color: { argb: "FFD3D3D3" } },
    right: { style: "thin" as const, color: { argb: "FFD3D3D3" } },
  },
  MEDIUM: {
    top: { style: "medium" as const, color: { argb: "FF1F4E79" } },
    bottom: { style: "medium" as const, color: { argb: "FF1F4E79" } },
    left: { style: "medium" as const, color: { argb: "FF1F4E79" } },
    right: { style: "medium" as const, color: { argb: "FF1F4E79" } },
  },
  DOUBLE_BOTTOM: {
    top: { style: "thin" as const, color: { argb: "FFD3D3D3" } },
    bottom: { style: "double" as const, color: { argb: "FF1F4E79" } },
    left: { style: "thin" as const, color: { argb: "FFD3D3D3" } },
    right: { style: "thin" as const, color: { argb: "FFD3D3D3" } },
  },
  HEADER_BORDER: {
    top: { style: "medium" as const, color: { argb: "FF1F4E79" } },
    bottom: { style: "medium" as const, color: { argb: "FF1F4E79" } },
    left: { style: "thin" as const, color: { argb: "FFD3D3D3" } },
    right: { style: "thin" as const, color: { argb: "FFD3D3D3" } },
  }
};

export const EXCEL_ALIGNMENTS = {
  CENTER_MIDDLE: { horizontal: "center" as const, vertical: "middle" as const, wrapText: true },
  LEFT_MIDDLE: { horizontal: "left" as const, vertical: "middle" as const, wrapText: true },
  RIGHT_MIDDLE: { horizontal: "right" as const, vertical: "middle" as const, wrapText: true },
  TOP_LEFT: { horizontal: "left" as const, vertical: "top" as const, wrapText: true },
};

/**
 * Helper to determine category styling
 */
export function getCategoryExcelStyle(categoryName: string, title: string) {
  const cat = (categoryName || "").toLowerCase();
  const ttl = (title || "").toLowerCase();

  if (cat.includes("nasional") || ttl.includes("libur nasional")) {
    return EXCEL_COLORS.HOLIDAY_RED;
  }
  if (cat.includes("semester") || ttl.includes("libur semester") || ttl.includes("libur akhir semester")) {
    return EXCEL_COLORS.SEMESTER_RED;
  }
  if (ttl.includes("pts") || ttl.includes("tengah semester")) {
    return EXCEL_COLORS.EXAM_BLUE;
  }
  if (ttl.includes("pas") || ttl.includes("akhir semester") || ttl.includes("penilaian akhir semester")) {
    return EXCEL_COLORS.PAS_ORANGE;
  }
  if (ttl.includes("pat") || ttl.includes("kenaikan kelas") || ttl.includes("penilaian akhir tahun")) {
    return EXCEL_COLORS.PAT_YELLOW;
  }
  if (ttl.includes("mpls") || ttl.includes("fortasi") || ttl.includes("pengenalan lingkungan") || cat.includes("mpls")) {
    return EXCEL_COLORS.MPLS_GREEN;
  }
  if (ttl.includes("ramadhan") || ttl.includes("puasa") || ttl.includes("pesantren ramadhan") || ttl.includes("ramadan")) {
    return EXCEL_COLORS.RAMADHAN_GREEN;
  }
  if (ttl.includes("asesmen") || ttl.includes("anbk") || ttl.includes("un") || cat.includes("asesmen")) {
    return EXCEL_COLORS.ASSESSMENT_PURPLE;
  }
  if (ttl.includes("festival") || ttl.includes("class meeting") || ttl.includes("lomba") || cat.includes("festival")) {
    return EXCEL_COLORS.FESTIVAL_BROWN;
  }
  return EXCEL_COLORS.DEFAULT_KBM;
}

/**
 * Format a cell with style properties
 */
export function formatExcelCell(
  cell: ExcelJS.Cell,
  options: {
    font?: any;
    fillColor?: string;
    alignment?: any;
    border?: any;
  }
) {
  if (options.font) cell.font = options.font;
  if (options.fillColor) {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: options.fillColor },
    };
  }
  if (options.alignment) cell.alignment = options.alignment;
  if (options.border) cell.border = options.border;
}
