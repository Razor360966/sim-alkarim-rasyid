import { Timestamp } from "firebase/firestore";

export type Gender = "L" | "P";

export interface Teacher {
  id: string; // Alias for teacherId to ensure backward compatibility
  teacherId: string; // Document ID Firestore
  niy: string;
  nuptk: string;
  name: string;
  gender: Gender;
  birthPlace: string;
  birthDate: Timestamp | string | any; // Firestore Timestamp, formatted date, or date string
  address: string;
  phone: string;
  email: string;
  status: string | boolean; // Can be string or boolean for backward compatibility
  createdAt: Timestamp | string | any;
  updatedAt: Timestamp | string | any;
  createdBy: string;
  updatedBy: string;
  isDeleted: boolean;
  deletedAt: Timestamp | null | any;
  deletedBy: string | null;
  // Legacy / backward-compatibility fields for Classes.tsx and others
  nip?: string;
  isWaliKelas?: boolean;
  subjectIds?: string[];

  // New fields from 2026 update
  frontTitle?: string;
  backTitle?: string;
  nickName?: string;
  religion?: string;
  employeeType?: string;
  employmentStatus?: string;
  joinDate?: Timestamp | string | any;
  photoUrl?: string;
  customJpOverride?: number;
}

export interface ActivityLog {
  id?: string;
  userId: string;
  userName: string;
  action: string;
  collection: string;
  documentId: string;
  description: string;
  createdAt: Timestamp | string | any;
}
