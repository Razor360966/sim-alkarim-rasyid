import ExcelJS from "exceljs";
import { AcademicCalendarDay, Semester, Teacher, SchoolSettings } from "../../types";
import { 
  EXCEL_FONTS, 
  EXCEL_COLORS, 
  EXCEL_ALIGNMENTS, 
  EXCEL_BORDERS, 
  getCategoryExcelStyle, 
  formatExcelCell 
} from "./styles";
import { 
  createSchoolHeader, 
  createSignatureFooter, 
  applyPageSetup, 
  writeExportMetadata 
} from "./template";

interface ExportKaldikParams {
  currentSemester: Semester;
  calendarDays: AcademicCalendarDay[];
  weeksConfig: any[];
  teachers: Teacher[];
  user: any;
  schoolSettings: SchoolSettings | null;
  users?: any[];
}

const indonesianMonths = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];

const indonesianDayNames = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

/**
 * Builds and downloads a highly professional academic calendar spreadsheet (KALDIK)
 */
export async function exportAcademicCalendarExcel({
  currentSemester,
  calendarDays,
  weeksConfig,
  teachers,
  user,
  schoolSettings
}: ExportKaldikParams): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Kaldik " + currentSemester.name);

  // Enable grid lines visibility
  sheet.views = [{ showGridLines: true }];

  // 1. Column configuration
  const columnsConfig: any[] = [
    { key: "month", width: 20 }, // Column A: Month
  ];
  for (let i = 1; i <= 31; i++) {
    columnsConfig.push({ key: `day_${i}`, width: 4.5 }); // Columns B to AF: Days 1-31
  }
  columnsConfig.push({ key: "spacer", width: 2.2 }); // Column AG: Divider
  columnsConfig.push({ key: "notes", width: 45 }); // Column AH: Agenda Notes
  sheet.columns = columnsConfig;

  // 2. Generate Brand Header
  const startRow = createSchoolHeader(sheet, {
    title: "KALENDER PENDIDIKAN (KALDIK) SEKOLAH ISLAM TERPADU",
    academicYear: currentSemester.academicYearName,
    semesterName: currentSemester.code === "S1" ? "Semester Ganjil" : "Semester Genap",
    operatorName: user?.displayName || "System Operator",
    mergeEndCol: "AH"
  });

  let currentRow = startRow;

  // 3. Main Calendar Table Header (at Row 8 by default)
  const headerRow = sheet.getRow(currentRow);
  headerRow.height = 28;

  // Month column header
  const colMonthHeader = sheet.getCell(`A${currentRow}`);
  colMonthHeader.value = "BULAN / TANGGAL";
  formatExcelCell(colMonthHeader, {
    font: EXCEL_FONTS.HEADER,
    fillColor: EXCEL_COLORS.PRIMARY_NAVY,
    alignment: EXCEL_ALIGNMENTS.CENTER_MIDDLE,
    border: EXCEL_BORDERS.MEDIUM
  });

  // Date column headers (1 to 31)
  for (let i = 1; i <= 31; i++) {
    const cell = headerRow.getCell(i + 1);
    cell.value = i;
    formatExcelCell(cell, {
      font: EXCEL_FONTS.HEADER,
      fillColor: EXCEL_COLORS.SECONDARY_BLUE,
      alignment: EXCEL_ALIGNMENTS.CENTER_MIDDLE,
      border: EXCEL_BORDERS.HEADER_BORDER
    });
  }

  // Notes/Agenda column header
  const colNotesHeader = sheet.getCell(`AH${currentRow}`);
  colNotesHeader.value = "KETERANGAN & AGENDA KEGIATAN";
  formatExcelCell(colNotesHeader, {
    font: EXCEL_FONTS.HEADER,
    fillColor: EXCEL_COLORS.PRIMARY_NAVY,
    alignment: EXCEL_ALIGNMENTS.CENTER_MIDDLE,
    border: EXCEL_BORDERS.MEDIUM
  });

  currentRow += 1;

  // 4. Determine months in range
  const startSem = new Date(currentSemester.startDate);
  const endSem = new Date(currentSemester.endDate);
  const monthsInRange: { year: number; month: number; name: string }[] = [];
  let curM = new Date(startSem.getFullYear(), startSem.getMonth(), 1);
  while (curM <= endSem) {
    monthsInRange.push({
      year: curM.getFullYear(),
      month: curM.getMonth(),
      name: indonesianMonths[curM.getMonth()]
    });
    curM.setMonth(curM.getMonth() + 1);
  }

  // Active working days list from settings (or defaults)
  const activeDaysList = schoolSettings?.activeDays || ["Sabtu", "Minggu", "Senin", "Selasa", "Rabu", "Kamis"];

  const getCalendarDayEvents = (dateStr: string) => {
    const dayObj = calendarDays.find(d => d.date === dateStr);
    return dayObj ? dayObj.events : [];
  };

  // 5. Fill calendar months
  monthsInRange.forEach((mth) => {
    const datesRowIndex = currentRow;
    const eventsRowIndex = currentRow + 1;

    const datesRow = sheet.getRow(datesRowIndex);
    const eventsRow = sheet.getRow(eventsRowIndex);

    datesRow.height = 22;
    eventsRow.height = 42; // spacious row to avoid text clipping

    // Vertical merge for Month Name in Col A
    sheet.mergeCells(`A${datesRowIndex}:A${eventsRowIndex}`);
    const monthCell = sheet.getCell(`A${datesRowIndex}`);
    monthCell.value = `${mth.name.toUpperCase()}\n${mth.year}`;
    formatExcelCell(monthCell, {
      font: EXCEL_FONTS.BODY_BOLD,
      fillColor: EXCEL_COLORS.GRAY_BG,
      alignment: EXCEL_ALIGNMENTS.CENTER_MIDDLE,
      border: {
        top: { style: "thin" },
        bottom: { style: "thin" },
        left: { style: "medium" },
        right: { style: "thin" }
      }
    });

    const totalDays = new Date(mth.year, mth.month + 1, 0).getDate();

    // 5a. Fill Dates Row (Day Numbers)
    for (let d = 1; d <= 31; d++) {
      const cell = datesRow.getCell(d + 1);

      if (d <= totalDays) {
        cell.value = d;
        const dateStr = `${mth.year}-${String(mth.month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const dayOfWeekIndex = new Date(mth.year, mth.month, d).getDay();
        const dayName = indonesianDayNames[dayOfWeekIndex];
        const isActiveDay = activeDaysList.includes(dayName);

        const dayEvents = getCalendarDayEvents(dateStr);

        let bgHex = EXCEL_COLORS.WHITE;
        let textHex = "FF000000";
        let isBold = false;

        if (dayEvents.length > 0) {
          const primaryEvt = dayEvents[0];
          const catStyle = getCategoryExcelStyle(primaryEvt.categoryName || "", primaryEvt.title);
          bgHex = catStyle.fill;
          textHex = catStyle.text;
          isBold = true;
        } else if (!isActiveDay) {
          // If it is a rest day (e.g. Friday), style accordingly
          bgHex = EXCEL_COLORS.REST_DAY_GRAY.fill;
          textHex = EXCEL_COLORS.REST_DAY_GRAY.text;
          isBold = true;
        }

        formatExcelCell(cell, {
          font: { name: "Calibri", size: 10, bold: isBold, color: { argb: textHex } },
          fillColor: bgHex,
          alignment: EXCEL_ALIGNMENTS.CENTER_MIDDLE,
          border: EXCEL_BORDERS.THIN
        });
      } else {
        // Date blackout for non-existent days (e.g. Feb 30/31, April 31)
        cell.value = "";
        formatExcelCell(cell, {
          font: { name: "Calibri", size: 10, color: { argb: "FFFFFFFF" } },
          fillColor: EXCEL_COLORS.BLACK_OUT,
          alignment: EXCEL_ALIGNMENTS.CENTER_MIDDLE,
          border: {
            top: { style: "thin", color: { argb: "FF444444" } },
            bottom: { style: "thin", color: { argb: "FF444444" } }
          }
        });
      }
    }

    // 5b. Fill and initialize all cells in Events Row with thin borders and appropriate backgrounds
    for (let d = 1; d <= 31; d++) {
      const cell = eventsRow.getCell(d + 1);
      if (d <= totalDays) {
        const dateStr = `${mth.year}-${String(mth.month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const dayOfWeekIndex = new Date(mth.year, mth.month, d).getDay();
        const dayName = indonesianDayNames[dayOfWeekIndex];
        const isActiveDay = activeDaysList.includes(dayName);
        const dayEvents = getCalendarDayEvents(dateStr);

        let bgHex = EXCEL_COLORS.WHITE;
        if (dayEvents.length > 0) {
          const catStyle = getCategoryExcelStyle(dayEvents[0].categoryName || "", dayEvents[0].title);
          bgHex = catStyle.fill;
        } else if (!isActiveDay) {
          bgHex = EXCEL_COLORS.REST_DAY_GRAY.fill;
        }

        cell.value = "";
        formatExcelCell(cell, {
          fillColor: bgHex,
          border: EXCEL_BORDERS.THIN
        });
      } else {
        cell.value = "";
        formatExcelCell(cell, {
          fillColor: EXCEL_COLORS.BLACK_OUT,
          border: {
            top: { style: "thin", color: { argb: "FF444444" } },
            bottom: { style: "thin", color: { argb: "FF444444" } }
          }
        });
      }
    }

    // 5c. Merge horizontal cells for contiguous events
    const contiguousEvents: { title: string; categoryName: string; start: number; end: number }[] = [];
    let scanDay = 1;
    while (scanDay <= totalDays) {
      const dateStr = `${mth.year}-${String(mth.month + 1).padStart(2, '0')}-${String(scanDay).padStart(2, '0')}`;
      const dayEvents = getCalendarDayEvents(dateStr);

      if (dayEvents.length > 0) {
        const firstEvt = dayEvents[0];
        const eventTitle = firstEvt.title;
        const categoryName = firstEvt.categoryName || "";
        const start = scanDay;
        let end = scanDay;

        // Trace event length
        while (end + 1 <= totalDays) {
          const nextDateStr = `${mth.year}-${String(mth.month + 1).padStart(2, '0')}-${String(end + 1).padStart(2, '0')}`;
          const nextEvents = getCalendarDayEvents(nextDateStr);
          if (nextEvents.length > 0 && nextEvents[0].title === eventTitle) {
            end++;
          } else {
            break;
          }
        }

        contiguousEvents.push({ title: eventTitle, categoryName, start, end });
        scanDay = end + 1;
      } else {
        scanDay++;
      }
    }

    // Apply merge and style settings for discovered contiguous events
    contiguousEvents.forEach((evt) => {
      const catStyle = getCategoryExcelStyle(evt.categoryName, evt.title);
      const bgHex = catStyle.fill;
      const textHex = catStyle.text;

      if (evt.start !== evt.end) {
        // Merge cells horizontally
        sheet.mergeCells(eventsRowIndex, evt.start + 1, eventsRowIndex, evt.end + 1);
      }

      const cell = eventsRow.getCell(evt.start + 1);
      cell.value = evt.title;
      formatExcelCell(cell, {
        font: { name: "Calibri", size: 8.5, bold: true, color: { argb: textHex } },
        fillColor: bgHex,
        alignment: EXCEL_ALIGNMENTS.CENTER_MIDDLE,
      });

      // Maintain background coloring inside the merged spans
      for (let col = evt.start; col <= evt.end; col++) {
        const c = eventsRow.getCell(col + 1);
        c.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: bgHex }
        };
        c.border = {
          top: { style: "thin" },
          bottom: { style: "thin" },
          left: col === evt.start ? { style: "medium" } : { style: "thin" },
          right: col === evt.end ? { style: "medium" } : { style: "thin" }
        };
      }
    });

    // 5d. Write descriptive Agenda for Column AH
    const monthEventsList = calendarDays
      .filter(d => {
        const dDate = new Date(d.date);
        return dDate.getFullYear() === mth.year && dDate.getMonth() === mth.month;
      })
      .flatMap(d => d.events.map(e => ({ date: d.date, title: e.title })))
      // Deduplicate events by title to avoid visual duplicates
      .filter((v, i, self) => self.findIndex(t => t.title === v.title) === i)
      .sort((a, b) => a.date.localeCompare(b.date));

    sheet.mergeCells(`AH${datesRowIndex}:AH${eventsRowIndex}`);
    const notesCell = sheet.getCell(`AH${datesRowIndex}`);

    if (monthEventsList.length > 0) {
      notesCell.value = monthEventsList
        .map(e => {
          const dayNum = new Date(e.date).getDate();
          return `• Tgl ${dayNum}: ${e.title}`;
        })
        .join("\r\n");
    } else {
      notesCell.value = "KBM Efektif Biasa";
    }

    formatExcelCell(notesCell, {
      font: { 
        name: "Calibri", 
        size: 9, 
        italic: monthEventsList.length === 0, 
        color: { argb: monthEventsList.length === 0 ? "FF7F7F7F" : "FF333333" } 
      },
      alignment: EXCEL_ALIGNMENTS.TOP_LEFT,
      border: {
        top: { style: "thin" },
        bottom: { style: "thin" },
        left: { style: "thin" },
        right: { style: "medium" }
      }
    });

    // Standard filler for Spacer Column (AG)
    const spacerCellDates = datesRow.getCell(33);
    spacerCellDates.value = "";
    spacerCellDates.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } };
    const spacerCellEvents = eventsRow.getCell(33);
    spacerCellEvents.value = "";
    spacerCellEvents.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } };

    currentRow += 2;
  });

  // Finish outline borders for calendar dates rows
  for (let i = 1; i <= 34; i++) {
    const lastCell = sheet.getRow(currentRow - 1).getCell(i);
    if (lastCell.border) {
      lastCell.border = {
        ...lastCell.border,
        bottom: { style: "medium" }
      };
    }
  }

  // 6. ANALISIS PEKAN EFEKTIF TABLE
  currentRow += 2;
  const rekapStartRow = currentRow;

  sheet.mergeCells(`A${rekapStartRow}:G${rekapStartRow}`);
  const rekapTitleCell = sheet.getCell(`A${rekapStartRow}`);
  rekapTitleCell.value = "REKAPITULASI ANALISIS PEKAN EFEKTIF";
  formatExcelCell(rekapTitleCell, {
    font: EXCEL_FONTS.SECTION,
    alignment: EXCEL_ALIGNMENTS.LEFT_MIDDLE
  });

  currentRow += 1;

  // Header for rekap table
  const rHeaderRow = sheet.getRow(currentRow);
  rHeaderRow.height = 24;

  const rekapHeaders = [
    { col: "A", val: "NO", mergeTo: null },
    { col: "B", val: "BULAN", mergeTo: "D" },
    { col: "E", val: "JUMLAH PEKAN", mergeTo: null },
    { col: "F", val: "PEKAN EFEKTIF", mergeTo: null },
    { col: "G", val: "TIDAK EFEKTIF", mergeTo: null },
    { col: "H", val: "ANALISIS / KETERANGAN", mergeTo: "N" }
  ];

  rekapHeaders.forEach(h => {
    if (h.mergeTo) {
      sheet.mergeCells(`${h.col}${currentRow}:${h.mergeTo}${currentRow}`);
    }
    const cell = sheet.getCell(`${h.col}${currentRow}`);
    cell.value = h.val;
    formatExcelCell(cell, {
      font: EXCEL_FONTS.HEADER,
      fillColor: EXCEL_COLORS.SECONDARY_BLUE,
      alignment: EXCEL_ALIGNMENTS.CENTER_MIDDLE,
    });
  });

  // Borders for Rekap table header row (Cols A to N)
  for (let c = 1; c <= 14; c++) {
    rHeaderRow.getCell(c).border = EXCEL_BORDERS.THIN;
  }

  currentRow += 1;

  // Fill Rekap rows
  let no = 1;
  let totalTotalWeeks = 0;
  let totalEffectiveWeeks = 0;
  let totalIneffectiveWeeks = 0;

  weeksConfig.forEach((item) => {
    const rRow = sheet.getRow(currentRow);
    rRow.height = 20;

    sheet.mergeCells(`B${currentRow}:D${currentRow}`);
    sheet.mergeCells(`H${currentRow}:N${currentRow}`);

    const cellA = sheet.getCell(`A${currentRow}`);
    cellA.value = no++;
    cellA.alignment = EXCEL_ALIGNMENTS.CENTER_MIDDLE;

    const cellB = sheet.getCell(`B${currentRow}`);
    cellB.value = item.month;
    cellB.alignment = EXCEL_ALIGNMENTS.LEFT_MIDDLE;

    const cellE = sheet.getCell(`E${currentRow}`);
    const tw = Number(item.totalWeeks) || 0;
    cellE.value = tw;
    cellE.alignment = EXCEL_ALIGNMENTS.CENTER_MIDDLE;
    totalTotalWeeks += tw;

    const cellF = sheet.getCell(`F${currentRow}`);
    const ew = Number(item.effectiveWeeks) || 0;
    cellF.value = ew;
    cellF.alignment = EXCEL_ALIGNMENTS.CENTER_MIDDLE;
    totalEffectiveWeeks += ew;

    const cellG = sheet.getCell(`G${currentRow}`);
    const ineff = Math.max(0, tw - ew);
    cellG.value = ineff;
    cellG.alignment = EXCEL_ALIGNMENTS.CENTER_MIDDLE;
    totalIneffectiveWeeks += ineff;

    const cellH = sheet.getCell(`H${currentRow}`);
    cellH.value = item.notes || "-";
    cellH.alignment = EXCEL_ALIGNMENTS.LEFT_MIDDLE;

    // Apply formatting to rekap row cells
    for (let c = 1; c <= 14; c++) {
      const cell = rRow.getCell(c);
      cell.font = EXCEL_FONTS.SMALL;
      cell.border = EXCEL_BORDERS.THIN;
      // Add zebra styling to rekap rows
      if ((no - 1) % 2 === 0) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: EXCEL_COLORS.ZEBRA_LIGHT }
        };
      }
    }

    currentRow += 1;
  });

  // Total Summary Row for rekap table
  const tRow = sheet.getRow(currentRow);
  tRow.height = 24;

  sheet.mergeCells(`A${currentRow}:D${currentRow}`);
  sheet.mergeCells(`H${currentRow}:N${currentRow}`);

  const totalLabelCell = sheet.getCell(`A${currentRow}`);
  totalLabelCell.value = "JUMLAH TOTAL PEKAN";
  totalLabelCell.font = EXCEL_FONTS.BODY_BOLD;
  totalLabelCell.alignment = EXCEL_ALIGNMENTS.RIGHT_MIDDLE;

  const totalECell = sheet.getCell(`E${currentRow}`);
  totalECell.value = currentSemester.totalWeeks || totalTotalWeeks;
  totalECell.font = EXCEL_FONTS.BODY_BOLD;
  totalECell.alignment = EXCEL_ALIGNMENTS.CENTER_MIDDLE;

  const totalFCell = sheet.getCell(`F${currentRow}`);
  totalFCell.value = currentSemester.effectiveWeeks || totalEffectiveWeeks;
  totalFCell.font = EXCEL_FONTS.BODY_BOLD;
  totalFCell.alignment = EXCEL_ALIGNMENTS.CENTER_MIDDLE;

  const totalGCell = sheet.getCell(`G${currentRow}`);
  totalGCell.value = currentSemester.ineffectiveWeeks || totalIneffectiveWeeks;
  totalGCell.font = EXCEL_FONTS.BODY_BOLD;
  totalGCell.alignment = EXCEL_ALIGNMENTS.CENTER_MIDDLE;

  const totalHCell = sheet.getCell(`H${currentRow}`);
  totalHCell.value = "Sesuai Data Analisis Efektif";
  totalHCell.font = EXCEL_FONTS.SMALL_ITALIC;
  totalHCell.alignment = EXCEL_ALIGNMENTS.LEFT_MIDDLE;

  for (let c = 1; c <= 14; c++) {
    const cell = tRow.getCell(c);
    formatExcelCell(cell, {
      fillColor: EXCEL_COLORS.GRAY_BG,
      border: EXCEL_BORDERS.DOUBLE_BOTTOM
    });
  }

  // 7. Dynamic SIGNATURES
  currentRow += 3; // elegant separation space

  const formatTeacherFullName = (t: Teacher) => {
    const front = t.frontTitle && t.frontTitle.trim() ? t.frontTitle.trim() + " " : "";
    const back = t.backTitle && t.backTitle.trim() ? ", " + t.backTitle.trim() : "";
    return `${front}${t.name}${back}`;
  };

  // A. Resolve Kepala Sekolah (Principal) from Manajemen Akun (users) or teachers list
  let headmasterName = "";
  let headmasterNiy = "";

  const headmasterUser = (users || []).find(u => {
    if (u.isDeleted) return false;
    const rList = (u.roles || (u.role ? [u.role] : [])).map((r: string) => String(r).toLowerCase());
    return rList.some((r: string) => r === "kepala sekolah" || r === "kepala_sekolah" || r.includes("kepala sekolah"));
  });

  if (headmasterUser) {
    const linkedTeacher = teachers.find(t => 
      (headmasterUser.teacherId && (t.id === headmasterUser.teacherId || t.teacherId === headmasterUser.teacherId)) ||
      (t.email && headmasterUser.email && t.email.toLowerCase() === headmasterUser.email.toLowerCase()) ||
      (t.name && headmasterUser.name && t.name.toLowerCase() === headmasterUser.name.toLowerCase())
    );

    if (linkedTeacher) {
      headmasterName = formatTeacherFullName(linkedTeacher);
      headmasterNiy = linkedTeacher.niy || linkedTeacher.nuptk ? `NIY: ${linkedTeacher.niy || linkedTeacher.nuptk}` : "";
    } else {
      headmasterName = headmasterUser.name || headmasterUser.teacherName || "";
      headmasterNiy = headmasterUser.niy || headmasterUser.nuptk ? `NIY: ${headmasterUser.niy || headmasterUser.nuptk}` : "";
    }
  }

  if (!headmasterName) {
    const headmasterTeacher = teachers.find(t => {
      const roles = (t as any).roles || [];
      const type = (t.employeeType || "").toLowerCase();
      return roles.includes("kepala_sekolah") || roles.includes("kepala sekolah") || type.includes("kepala sekolah");
    });
    if (headmasterTeacher) {
      headmasterName = formatTeacherFullName(headmasterTeacher);
      headmasterNiy = headmasterTeacher.niy || headmasterTeacher.nuptk ? `NIY: ${headmasterTeacher.niy || headmasterTeacher.nuptk}` : "";
    }
  }

  if (!headmasterName) {
    headmasterName = "Kepala Sekolah";
    headmasterNiy = "NIY: -";
  } else if (!headmasterNiy) {
    headmasterNiy = "NIY: -";
  }

  // B. Resolve Waka Kurikulum from Manajemen Akun (users) or teachers list
  let wakaName = "";
  let wakaNiy = "";

  const wakaUser = (users || []).find(u => {
    if (u.isDeleted) return false;
    const rList = (u.roles || (u.role ? [u.role] : [])).map((r: string) => String(r).toLowerCase());
    return rList.some((r: string) => r === "wakil kepala sekolah" || r === "wakakur" || r.includes("wakil kepala sekolah") || r.includes("wakakur") || r.includes("kurikulum"));
  });

  if (wakaUser) {
    const linkedTeacher = teachers.find(t => 
      (wakaUser.teacherId && (t.id === wakaUser.teacherId || t.teacherId === wakaUser.teacherId)) ||
      (t.email && wakaUser.email && t.email.toLowerCase() === wakaUser.email.toLowerCase()) ||
      (t.name && wakaUser.name && t.name.toLowerCase() === wakaUser.name.toLowerCase())
    );

    if (linkedTeacher) {
      wakaName = formatTeacherFullName(linkedTeacher);
      wakaNiy = linkedTeacher.niy || linkedTeacher.nuptk ? `NIY: ${linkedTeacher.niy || linkedTeacher.nuptk}` : "";
    } else {
      wakaName = wakaUser.name || wakaUser.teacherName || "";
      wakaNiy = wakaUser.niy || wakaUser.nuptk ? `NIY: ${wakaUser.niy || wakaUser.nuptk}` : "";
    }
  }

  if (!wakaName) {
    const wakaTeacher = teachers.find(t => {
      const roles = (t as any).roles || [];
      const type = (t.employeeType || "").toLowerCase();
      return roles.includes("wakakur") || roles.includes("wakil kepala sekolah") || type.includes("wakakur") || type.includes("kurikulum");
    });
    if (wakaTeacher) {
      wakaName = formatTeacherFullName(wakaTeacher);
      wakaNiy = wakaTeacher.niy || wakaTeacher.nuptk ? `NIY: ${wakaTeacher.niy || wakaTeacher.nuptk}` : "";
    }
  }

  if (!wakaName) {
    wakaName = "Waka Kurikulum";
    wakaNiy = "NIY: -";
  } else if (!wakaNiy) {
    wakaNiy = "NIY: -";
  }

  currentRow = createSignatureFooter(sheet, currentRow, {
    headmasterName,
    headmasterNiy,
    wakaName,
    wakaNiy,
    startColLeft: "B",
    endColLeft: "D",
    startColRight: "J",
    endColRight: "N"
  });

  // 8. Configure Professional Print Areas & Setup
  applyPageSetup(sheet, {
    orientation: "landscape",
    fitToWidth: true,
    fitToHeight: false,
    repeatRowsStart: 8,
    repeatRowsEnd: 8,
    printAreaStartCol: "A",
    printAreaEndCol: "AH",
    printAreaEndRow: currentRow + 1
  });

  // 9. Write Audit/Export Metadata Hidden Worksheet
  writeExportMetadata(workbook, user?.displayName || "System Operator");

  // 10. Generate download stream
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `Kalender_Akademik_SMP_Alkarim_${currentSemester.academicYearName.replace("/", "_")}_${currentSemester.code}.xlsx`;
  anchor.click();
  window.URL.revokeObjectURL(url);
}
