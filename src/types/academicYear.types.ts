export interface AcademicYear {
  id: string; // Document ID (for backward compatibility)
  academicYearId: string; // Document ID
  name: string; // e.g. "2025/2026"
  year: string; // e.g. "2025/2026" (for backward compatibility)
  semester: "Ganjil" | "Genap"; // for backward compatibility
  startDate: any; // timestamp
  endDate: any; // timestamp
  isActive: boolean;
  
  createdAt: any; // timestamp
  updatedAt: any; // timestamp
  createdBy: string;
  updatedBy: string;
  isDeleted: boolean;
  deletedAt: any | null;
  deletedBy: string | null;
}
