import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getCheckInValidationOutcome, applyMultiJpAttendancePropagation, summarizeDistinctTeacherKpis } from "./teacherTeachingAttendance.service";

describe("teacherTeachingAttendanceService validation", () => {
  it("marks check-in as on time before 15 minutes, late between 15 and 25 minutes, and rejects beyond 25 minutes", () => {
    assert.equal(getCheckInValidationOutcome("07:30", "07:15").status, "on_time");
    assert.equal(getCheckInValidationOutcome("07:30", "07:46").status, "late");
    assert.equal(getCheckInValidationOutcome("07:30", "07:56").status, "rejected");
  });

  it("propagates a single check-in / check-out across all covered JP sessions in one class", () => {
    const items = [
      { id: "a", sequence: 1, timeSlot: "07:30 - 08:15", status: "Belum Diverifikasi", checkInTime: undefined, checkOutTime: undefined },
      { id: "b", sequence: 2, timeSlot: "08:15 - 09:00", status: "Belum Diverifikasi", checkInTime: undefined, checkOutTime: undefined },
      { id: "c", sequence: 3, timeSlot: "09:00 - 09:45", status: "Belum Diverifikasi", checkInTime: undefined, checkOutTime: undefined },
    ] as any[];

    const result = applyMultiJpAttendancePropagation(items, "07:35", "08:45");

    assert.equal(result.filter((item: any) => item.status === "Hadir Mengajar").length, 2);
    assert.equal(result[0].checkInTime, "07:35");
    assert.equal(result[0].checkOutTime, "08:45");
    assert.equal(result[1].checkInTime, "07:35");
    assert.equal(result[1].checkOutTime, "08:45");
  });

  it("counts unique teachers correctly when late sessions are included in the hadir KPI", () => {
    const summary = summarizeDistinctTeacherKpis([
      { teacherId: "g-1", teacherName: "Guru A", status: "Terlambat", checkInTime: "07:50", timeSlot: "07:30 - 08:15", sequence: 1 },
      { teacherId: "g-2", teacherName: "Guru B", status: "Hadir Mengajar", checkInTime: "07:15", timeSlot: "07:30 - 08:15", sequence: 1 },
      { teacherId: "g-2", teacherName: "Guru B", status: "Hadir Mengajar", checkInTime: "07:15", timeSlot: "08:15 - 09:00", sequence: 2 },
      { teacherId: "g-3", teacherName: "Guru C", status: "Tidak Hadir", checkInTime: undefined, timeSlot: "09:00 - 09:45", sequence: 3 },
    ] as any[]);

    assert.equal(summary.totalUniqueTeachers, 3);
    assert.equal(summary.hadirUniqueTeachers, 2);
    assert.equal(summary.terlambatUniqueTeachers, 1);
    assert.equal(summary.tidakHadirUniqueTeachers, 1);
  });
});
