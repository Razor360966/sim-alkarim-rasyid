export interface HalaqahSchedule {
  id: string;
  day: string; // "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Ahad"
  startTime: string; // HH:mm format, e.g. "07:10"
  endTime: string; // HH:mm format, e.g. "08:20"
  groupId: string;
  groupName: string;
  teacherId: string;
  teacherName: string;
  academicYearId: string;
  semesterId: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TeacherHalaqahAttendance {
  id: string;
  teacherId: string;
  teacherName: string;
  groupId: string;
  groupName: string;
  date: string; // YYYY-MM-DD
  dayName: string; // e.g. "Kamis"
  checkInTime: string; // HH:mm
  checkOutTime?: string; // HH:mm
  duration?: number; // minutes
  status: string;
  academicYearId: string;
  semesterId: string;
  createdAt: string;
  updatedAt: string;
}

export interface HalaqahAttendanceWidgetStats {
  date?: string;
  totalGroups?: number;
  totalTeachers: number;
  alreadyCheckedIn: number;
  alreadyCheckedOut: number;
  currentlyMentoring: number;
  notYetAttended: number;
  attendancePercentage: number;
  records: TeacherHalaqahAttendance[];
}

export interface HalaqahQrPayload {
  type: "halaqah";
  groupId: string;
  groupName?: string;
}
