import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase/config";
import {
  AcademicSupervision,
  ManagerialSupervision,
  SupervisionSchedule,
  SupervisionInstrument,
  SupervisionResult,
  SupervisionIndicator
} from "../types";
import { sdmPerformanceService } from "./sdmPerformanceService";

const ACADEMIC_COLLECTION = "supervision_academic";
const MANAGERIAL_COLLECTION = "supervision_managerial";
const SCHEDULES_COLLECTION = "supervision_schedules";
const INSTRUMENTS_COLLECTION = "supervision_instruments";
const RESULTS_COLLECTION = "supervision_results";

export const supervisionService = {
  // =========================================================================
  // ACADEMIC SUPERVISION OPERATIONS
  // =========================================================================

  async getAcademicSupervisions(filters?: {
    academicYearId?: string;
    semesterId?: string;
    supervisorId?: string;
    teacherId?: string;
    status?: string;
  }): Promise<AcademicSupervision[]> {
    const colRef = collection(db, ACADEMIC_COLLECTION);
    let q = query(colRef, orderBy("createdAt", "desc"));

    // Apply filters in memory to avoid setting up complex Firestore composite indexes
    // unless necessary, or by combining where clauses for single field filters.
    try {
      const querySnapshot = await getDocs(q);
      const items: AcademicSupervision[] = [];
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.isDeleted) return;

        let match = true;
        if (filters) {
          if (filters.academicYearId && data.academicYearId !== filters.academicYearId) match = false;
          if (filters.semesterId && data.semesterId !== filters.semesterId) match = false;
          if (filters.supervisorId && data.supervisorId !== filters.supervisorId) match = false;
          if (filters.teacherId && data.teacherId !== filters.teacherId) match = false;
          if (filters.status && data.status !== filters.status) match = false;
        }

        if (match) {
          items.push({
            id: docSnap.id,
            ...data
          } as AcademicSupervision);
        }
      });
      return items;
    } catch (error) {
      return handleFirestoreError(error, OperationType.LIST, ACADEMIC_COLLECTION);
    }
  },

  async createAcademicSupervision(
    data: Omit<AcademicSupervision, "id" | "createdAt" | "updatedAt">
  ): Promise<AcademicSupervision> {
    const colRef = collection(db, ACADEMIC_COLLECTION);
    const newDocRef = doc(colRef);
    const now = new Date().toISOString();

    const newSupervision: AcademicSupervision = {
      id: newDocRef.id,
      ...data,
      createdAt: now,
      updatedAt: now
    };

    try {
      await setDoc(newDocRef, newSupervision);
      return newSupervision;
    } catch (error) {
      return handleFirestoreError(error, OperationType.WRITE, `${ACADEMIC_COLLECTION}/${newDocRef.id}`);
    }
  },

  async updateAcademicSupervision(id: string, data: Partial<AcademicSupervision>): Promise<void> {
    const docRef = doc(db, ACADEMIC_COLLECTION, id);
    const updateData = {
      ...data,
      updatedAt: new Date().toISOString()
    };

    try {
      await updateDoc(docRef, updateData);

      // Keep supervision results in sync with RTL fields
      if (data.rtlText !== undefined || data.rtlStatus !== undefined || data.rtlNotes !== undefined) {
        const resultsCol = collection(db, RESULTS_COLLECTION);
        const q = query(resultsCol, where("supervisionId", "==", id));
        const resSnap = await getDocs(q);
        resSnap.forEach(async (docSnap) => {
          await updateDoc(doc(db, RESULTS_COLLECTION, docSnap.id), {
            rtlText: data.rtlText !== undefined ? data.rtlText : "",
            rtlStatus: data.rtlStatus !== undefined ? data.rtlStatus : "Belum Dilaksanakan",
            rtlNotes: data.rtlNotes !== undefined ? data.rtlNotes : "",
            updatedAt: new Date().toISOString()
          });
        });
      }
    } catch (error) {
      return handleFirestoreError(error, OperationType.WRITE, `${ACADEMIC_COLLECTION}/${id}`);
    }
  },

  async deleteAcademicSupervision(id: string): Promise<void> {
    const docRef = doc(db, ACADEMIC_COLLECTION, id);
    try {
      // Soft delete
      await updateDoc(docRef, {
        isDeleted: true,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      return handleFirestoreError(error, OperationType.DELETE, `${ACADEMIC_COLLECTION}/${id}`);
    }
  },

  // =========================================================================
  // MANAGERIAL SUPERVISION OPERATIONS
  // =========================================================================

  async getManagerialSupervisions(filters?: {
    academicYearId?: string;
    semesterId?: string;
    supervisorId?: string;
    staffId?: string;
    status?: string;
  }): Promise<ManagerialSupervision[]> {
    const colRef = collection(db, MANAGERIAL_COLLECTION);
    let q = query(colRef, orderBy("createdAt", "desc"));

    try {
      const querySnapshot = await getDocs(q);
      const items: ManagerialSupervision[] = [];
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.isDeleted) return;

        let match = true;
        if (filters) {
          if (filters.academicYearId && data.academicYearId !== filters.academicYearId) match = false;
          if (filters.semesterId && data.semesterId !== filters.semesterId) match = false;
          if (filters.supervisorId && data.supervisorId !== filters.supervisorId) match = false;
          if (filters.staffId && data.staffId !== filters.staffId && data.teacherId !== filters.staffId) match = false;
          if (filters.status && data.status !== filters.status) match = false;
        }

        if (match) {
          items.push({
            id: docSnap.id,
            staffId: data.staffId || data.teacherId,
            staffName: data.staffName || data.teacherName,
            ...data
          } as ManagerialSupervision);
        }
      });
      return items;
    } catch (error) {
      return handleFirestoreError(error, OperationType.LIST, MANAGERIAL_COLLECTION);
    }
  },

  async createManagerialSupervision(
    data: Omit<ManagerialSupervision, "id" | "createdAt" | "updatedAt">
  ): Promise<ManagerialSupervision> {
    const colRef = collection(db, MANAGERIAL_COLLECTION);
    const newDocRef = doc(colRef);
    const now = new Date().toISOString();

    const newSupervision: ManagerialSupervision = {
      id: newDocRef.id,
      ...data,
      staffId: data.staffId || data.teacherId,
      staffName: data.staffName || data.teacherName,
      createdAt: now,
      updatedAt: now
    };

    try {
      await setDoc(newDocRef, newSupervision);
      return newSupervision;
    } catch (error) {
      return handleFirestoreError(error, OperationType.WRITE, `${MANAGERIAL_COLLECTION}/${newDocRef.id}`);
    }
  },

  async updateManagerialSupervision(id: string, data: Partial<ManagerialSupervision>): Promise<void> {
    const docRef = doc(db, MANAGERIAL_COLLECTION, id);
    const updateData = {
      ...data,
      updatedAt: new Date().toISOString()
    };

    try {
      await updateDoc(docRef, updateData);

      // Keep supervision results in sync with RTL fields
      if (data.rtlText !== undefined || data.rtlStatus !== undefined || data.rtlNotes !== undefined) {
        const resultsCol = collection(db, RESULTS_COLLECTION);
        const q = query(resultsCol, where("supervisionId", "==", id));
        const resSnap = await getDocs(q);
        resSnap.forEach(async (docSnap) => {
          await updateDoc(doc(db, RESULTS_COLLECTION, docSnap.id), {
            rtlText: data.rtlText !== undefined ? data.rtlText : "",
            rtlStatus: data.rtlStatus !== undefined ? data.rtlStatus : "Belum Dilaksanakan",
            rtlNotes: data.rtlNotes !== undefined ? data.rtlNotes : "",
            updatedAt: new Date().toISOString()
          });
        });
      }
    } catch (error) {
      return handleFirestoreError(error, OperationType.WRITE, `${MANAGERIAL_COLLECTION}/${id}`);
    }
  },

  async deleteManagerialSupervision(id: string): Promise<void> {
    const docRef = doc(db, MANAGERIAL_COLLECTION, id);
    try {
      await updateDoc(docRef, {
        isDeleted: true,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      return handleFirestoreError(error, OperationType.DELETE, `${MANAGERIAL_COLLECTION}/${id}`);
    }
  },

  // =========================================================================
  // SUPERVISION SCHEDULES OPERATIONS
  // =========================================================================

  async getSupervisionSchedules(filters?: {
    supervisorId?: string;
    participantId?: string;
    type?: string;
    status?: string;
    academicYearId?: string;
    semesterId?: string;
  }): Promise<SupervisionSchedule[]> {
    const colRef = collection(db, SCHEDULES_COLLECTION);
    let q = query(colRef, orderBy("date", "asc"));

    try {
      const querySnapshot = await getDocs(q);
      const items: SupervisionSchedule[] = [];
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.isDeleted) return;

        let match = true;
        if (filters) {
          if (filters.supervisorId && data.supervisorId !== filters.supervisorId) match = false;
          if (filters.participantId && data.participantId !== filters.participantId && data.teacherId !== filters.participantId) match = false;
          if (filters.type && data.type !== filters.type) match = false;
          if (filters.status && data.status !== filters.status) match = false;
          if (filters.academicYearId && data.academicYearId !== filters.academicYearId) match = false;
          if (filters.semesterId && data.semesterId !== filters.semesterId) match = false;
        }

        if (match) {
          items.push({
            id: docSnap.id,
            participantId: data.participantId || data.teacherId,
            participantName: data.participantName || data.teacherName,
            ...data
          } as SupervisionSchedule);
        }
      });
      return items;
    } catch (error) {
      return handleFirestoreError(error, OperationType.LIST, SCHEDULES_COLLECTION);
    }
  },

  async createSupervisionSchedule(
    data: Omit<SupervisionSchedule, "id" | "createdAt" | "updatedAt">
  ): Promise<SupervisionSchedule> {
    const colRef = collection(db, SCHEDULES_COLLECTION);
    const newDocRef = doc(colRef);
    const now = new Date().toISOString();

    const newSchedule: SupervisionSchedule = {
      id: newDocRef.id,
      ...data,
      participantId: data.participantId || data.teacherId,
      participantName: data.participantName || data.teacherName,
      createdAt: now,
      updatedAt: now
    };

    try {
      await setDoc(newDocRef, newSchedule);
      return newSchedule;
    } catch (error) {
      return handleFirestoreError(error, OperationType.WRITE, `${SCHEDULES_COLLECTION}/${newDocRef.id}`);
    }
  },

  async updateSupervisionSchedule(id: string, data: Partial<SupervisionSchedule>): Promise<void> {
    const docRef = doc(db, SCHEDULES_COLLECTION, id);
    const updateData = {
      ...data,
      updatedAt: new Date().toISOString()
    };

    try {
      await updateDoc(docRef, updateData);
    } catch (error) {
      return handleFirestoreError(error, OperationType.WRITE, `${SCHEDULES_COLLECTION}/${id}`);
    }
  },

  async deleteSupervisionSchedule(id: string): Promise<void> {
    const docRef = doc(db, SCHEDULES_COLLECTION, id);
    try {
      await updateDoc(docRef, {
        isDeleted: true,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      return handleFirestoreError(error, OperationType.DELETE, `${SCHEDULES_COLLECTION}/${id}`);
    }
  },

  // =========================================================================
  // SUPERVISION INSTRUMENTS OPERATIONS
  // =========================================================================

  async getSupervisionInstruments(filters?: {
    type?: string;
    category?: string;
    isActive?: boolean;
  }): Promise<SupervisionInstrument[]> {
    const colRef = collection(db, INSTRUMENTS_COLLECTION);
    let q = query(colRef, orderBy("createdAt", "desc"));

    try {
      const querySnapshot = await getDocs(q);
      const items: SupervisionInstrument[] = [];
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.isDeleted) return;

        let match = true;
        if (filters) {
          if (filters.type && data.type !== filters.type) match = false;
          if (filters.category && data.category !== filters.category) match = false;
          if (filters.isActive !== undefined && data.isActive !== filters.isActive) match = false;
        }

        if (match) {
          items.push({
            id: docSnap.id,
            ...data
          } as SupervisionInstrument);
        }
      });

      // Seeding initial instruments if collection is completely empty, to provide standard template
      if (items.length === 0 && (!filters || Object.keys(filters).length === 0)) {
        const now = new Date().toISOString();
        const defaultInstruments: Omit<SupervisionInstrument, "createdAt" | "updatedAt">[] = [
          // ==========================================
          // ACADEMIC INSTRUMENTS (TEACHER / GURU)
          // ==========================================
          {
            id: "inst_ac_1",
            code: "INST-AK-01",
            name: "Perencanaan Pembelajaran",
            category: "Perencanaan Pembelajaran",
            type: "Akademik",
            targetSdmType: "Guru",
            aspects: ["Tujuan Pembelajaran", "Materi & Media", "Alokasi Waktu"],
            weight: 100,
            isActive: true,
            createdBy: "system",
            updatedBy: "system",
            indicators: [
              { id: "ind_ac1_1", name: "Perumusan Tujuan Pembelajaran", description: "Kesesuaian dengan capaian pembelajaran dan kompetensi dasar", weight: 35, scoringType: "1-5", maxScore: 5, isActive: true },
              { id: "ind_ac1_2", name: "Pemilihan & Pengorganisasian Materi", description: "Kedalaman, kesesuaian, dan struktur materi", weight: 25, scoringType: "1-4", maxScore: 4, isActive: true },
              { id: "ind_ac1_3", name: "Pemilihan Media & Sumber Belajar", description: "Variasi, relevansi, dan inovasi media belajar", weight: 20, scoringType: "yes-no", maxScore: 1, isActive: true },
              { id: "ind_ac1_4", name: "Rencana Skenario & Alokasi Waktu", description: "Langkah KBM yang sistematis dan pembagian waktu", weight: 20, scoringType: "percentage", maxScore: 100, isActive: true }
            ]
          },
          {
            id: "inst_ac_2",
            code: "INST-AK-02",
            name: "Pelaksanaan Pembelajaran",
            category: "Pelaksanaan Pembelajaran",
            type: "Akademik",
            targetSdmType: "Guru",
            aspects: ["Kegiatan Pendahuluan", "Penguasaan Materi", "Strategi Pembelajaran", "Penutupan"],
            weight: 100,
            isActive: true,
            createdBy: "system",
            updatedBy: "system",
            indicators: [
              { id: "ind_ac2_1", name: "Kegiatan Pendahuluan & Apersepsi", description: "Apersepsi, motivasi, penyampaian tujuan", weight: 20, scoringType: "1-5", maxScore: 5, isActive: true },
              { id: "ind_ac2_2", name: "Penguasaan Materi Pembelajaran", description: "Kejelasan konsep, kedalaman materi, responsif", weight: 30, scoringType: "1-5", maxScore: 5, isActive: true },
              { id: "ind_ac2_3", name: "Penerapan Strategi Pembelajaran", description: "Kesesuaian metode dengan karakteristik siswa", weight: 30, scoringType: "1-4", maxScore: 4, isActive: true },
              { id: "ind_ac2_4", name: "Kegiatan Penutup & Refleksi", description: "Kesimpulan, evaluasi singkat, tindak lanjut", weight: 20, scoringType: "yes-no", maxScore: 1, isActive: true }
            ]
          },
          {
            id: "inst_ac_3",
            code: "INST-AK-03",
            name: "Pengelolaan Kelas",
            category: "Pengelolaan Kelas",
            type: "Akademik",
            targetSdmType: "Guru",
            aspects: ["Suasana Kondusif", "Disiplin", "Lingkungan Fisik"],
            weight: 100,
            isActive: true,
            createdBy: "system",
            updatedBy: "system",
            indicators: [
              { id: "ind_ac3_1", name: "Penciptaan Suasana Kelas Kondusif", description: "Kehangatan, antusiasme, ketertiban umum", weight: 40, scoringType: "1-5", maxScore: 5, isActive: true },
              { id: "ind_ac3_2", name: "Disiplin & Ketepatan Waktu", description: "Ketepatan waktu mengajar dan efisiensi durasi", weight: 30, scoringType: "yes-no", maxScore: 1, isActive: true },
              { id: "ind_ac3_3", name: "Penataan Lingkungan Kelas", description: "Kerapian, sirkulasi, kenyamanan ruang", weight: 30, scoringType: "1-4", maxScore: 4, isActive: true }
            ]
          },
          {
            id: "inst_ac_4",
            code: "INST-AK-04",
            name: "Asesmen",
            category: "Asesmen",
            type: "Akademik",
            targetSdmType: "Guru",
            aspects: ["Penyusunan Asesmen", "Pelaksanaan Asesmen", "Feedback"],
            weight: 100,
            isActive: true,
            createdBy: "system",
            updatedBy: "system",
            indicators: [
              { id: "ind_ac4_1", name: "Penyusunan Instrumen Asesmen", description: "Kesesuaian instrumen penilaian dengan indikator", weight: 40, scoringType: "1-5", maxScore: 5, isActive: true },
              { id: "ind_ac4_2", name: "Pelaksanaan Asesmen Otentik", description: "Penilaian proses dan sikap secara konsisten", weight: 30, scoringType: "percentage", maxScore: 100, isActive: true },
              { id: "ind_ac4_3", name: "Pemberian Feedback / Umpan Balik", description: "Kecepatan dan kualitas feedback untuk siswa", weight: 30, scoringType: "1-4", maxScore: 4, isActive: true }
            ]
          },
          {
            id: "inst_ac_5",
            code: "INST-AK-05",
            name: "Refleksi",
            category: "Refleksi",
            type: "Akademik",
            targetSdmType: "Guru",
            aspects: ["Evaluasi Diri", "Pemanfaatan Hasil"],
            weight: 100,
            isActive: true,
            createdBy: "system",
            updatedBy: "system",
            indicators: [
              { id: "ind_ac5_1", name: "Evaluasi Diri Pendidik", description: "Kemauan pendidik mengevaluasi kekurangan mengajar", weight: 50, scoringType: "1-5", maxScore: 5, isActive: true },
              { id: "ind_ac5_2", name: "Pemanfaatan Hasil Refleksi", description: "Penerapan perbaikan pada pertemuan selanjutnya", weight: 50, scoringType: "1-4", maxScore: 4, isActive: true }
            ]
          },
          {
            id: "inst_ac_6",
            code: "INST-AK-06",
            name: "Administrasi Pembelajaran",
            category: "Administrasi",
            type: "Akademik",
            targetSdmType: "Guru",
            aspects: ["Dokumen Silabus & RPP", "Buku Nilai & Jurnal", "Arsip Soal"],
            weight: 100,
            isActive: true,
            createdBy: "system",
            updatedBy: "system",
            indicators: [
              { id: "ind_ac6_1", name: "Kelengkapan Dokumen Silabus & RPP", description: "Ketersediaan dokumen lengkap awal semester", weight: 40, scoringType: "yes-no", maxScore: 1, isActive: true },
              { id: "ind_ac6_2", name: "Buku Nilai & Jurnal Guru", description: "Kedisplinan pengisian catatan kemajuan siswa", weight: 40, scoringType: "1-5", maxScore: 5, isActive: true },
              { id: "ind_ac6_3", name: "Arsip Soal & Kisi-Kisi", description: "Ketersediaan bank soal dan analisis hasil tes", weight: 20, scoringType: "yes-no", maxScore: 1, isActive: true }
            ]
          },

          // ==========================================
          // MANAGERIAL - WAKIL KEPALA SEKOLAH
          // ==========================================
          {
            id: "inst_mj_waka_1",
            code: "INST-MJ-WAKA",
            name: "Supervisi Wakil Kepala Sekolah",
            category: "Kepemimpinan & Evaluasi",
            type: "Manajerial",
            targetSdmType: "Wakil Kepala Sekolah",
            aspects: ["Kepemimpinan", "Manajemen Program", "Monitoring", "Evaluasi"],
            weight: 100,
            isActive: true,
            createdBy: "system",
            updatedBy: "system",
            indicators: [
              { id: "ind_waka_1", name: "Kepemimpinan", description: "Keteladanan, membangun budaya disiplin, koordinasi dan pengaruh positif", weight: 25, scoringType: "1-5", maxScore: 5, isActive: true },
              { id: "ind_waka_2", name: "Manajemen Program", description: "Penyusunan program kerja, efektivitas pelaksanaan program unit", weight: 25, scoringType: "percentage", maxScore: 100, isActive: true },
              { id: "ind_waka_3", name: "Monitoring", description: "Pemantauan kinerja staf/guru secara objektif dan berkala", weight: 25, scoringType: "1-5", maxScore: 5, isActive: true },
              { id: "ind_waka_4", name: "Evaluasi", description: "Ketajaman analisis kendala, pelaporan, dan rencana tindak lanjut (RTL)", weight: 25, scoringType: "1-5", maxScore: 5, isActive: true }
            ]
          },

          // ==========================================
          // MANAGERIAL - MUSRIF
          // ==========================================
          {
            id: "inst_mj_musrif_1",
            code: "INST-MJ-MUSRIF",
            name: "Supervisi Guru Halaqoh",
            category: "Pembinaan & Kedisiplinan",
            type: "Manajerial",
            targetSdmType: "Guru Halaqoh",
            aspects: ["Pembinaan Halaqah", "Mutabaah Santri", "Kehadiran", "Keteladanan", "Administrasi Halaqah", "Capaian Target Santri"],
            weight: 100,
            isActive: true,
            createdBy: "system",
            updatedBy: "system",
            indicators: [
              { id: "ind_musrif_1", name: "Pembinaan Halaqah", description: "Pendampingan, pembinaan akhlak santri, dan kelancaran kegiatan", weight: 20, scoringType: "1-5", maxScore: 5, isActive: true },
              { id: "ind_musrif_2", name: "Mutabaah Santri", description: "Pemantauan ibadah harian santri, kedisiplinan, kerapian asrama", weight: 15, scoringType: "1-5", maxScore: 5, isActive: true },
              { id: "ind_musrif_3", name: "Kehadiran", description: "Kehadiran tepat waktu di halaqah, sholat jamaah, kegiatan asrama", weight: 15, scoringType: "percentage", maxScore: 100, isActive: true },
              { id: "ind_musrif_4", name: "Keteladanan", description: "Adab, lisan, pakaian, integritas, dan kedekatan emosional santri", weight: 20, scoringType: "1-5", maxScore: 5, isActive: true },
              { id: "ind_musrif_5", name: "Administrasi Halaqah", description: "Ketertiban pengisian absen santri, buku mutabaah, progress tahfidz", weight: 15, scoringType: "yes-no", maxScore: 1, isActive: true },
              { id: "ind_musrif_6", name: "Capaian Target Santri", description: "Ketercapaian target hafalan (ziyadah) & murajaah santri", weight: 15, scoringType: "percentage", maxScore: 100, isActive: true }
            ]
          },

          // ==========================================
          // MANAGERIAL - TENAGA KEPENDIDIKAN
          // ==========================================
          {
            id: "inst_mj_tendik_1",
            code: "INST-MJ-TENDIK",
            name: "Supervisi Tenaga Kependidikan",
            category: "Disiplin & Layanan",
            type: "Manajerial",
            targetSdmType: "Tenaga Kependidikan",
            aspects: ["Disiplin", "Pelayanan", "Administrasi", "Tanggung Jawab", "Kerjasama"],
            weight: 100,
            isActive: true,
            createdBy: "system",
            updatedBy: "system",
            indicators: [
              { id: "ind_tendik_1", name: "Disiplin", description: "Kepatuhan jam kerja, presensi harian, kepatuhan seragam/aturan", weight: 20, scoringType: "percentage", maxScore: 100, isActive: true },
              { id: "ind_tendik_2", name: "Pelayanan", description: "Keramahan, kecepatan respon pelayanan, serta kualitas solusi", weight: 20, scoringType: "1-5", maxScore: 5, isActive: true },
              { id: "ind_tendik_3", name: "Administrasi", description: "Ketertiban pemberkasan fisik/digital, kecepatan penyelesaian tugas", weight: 20, scoringType: "1-5", maxScore: 5, isActive: true },
              { id: "ind_tendik_4", name: "Tanggung Jawab", description: "Penyelesaian tugas pokok, kemandirian kerja, pemeliharaan fasilitas", weight: 20, scoringType: "yes-no", maxScore: 1, isActive: true },
              { id: "ind_tendik_5", name: "Kerjasama", description: "Kolaborasi antar unit kerja, komunikasi tim, kepatuhan arahan pimpinan", weight: 20, scoringType: "1-5", maxScore: 5, isActive: true }
            ]
          }
        ];

        for (const inst of defaultInstruments) {
          const docRef = doc(colRef, inst.id);
          const newInst: SupervisionInstrument = {
            ...inst,
            academicYear: "2025/2026",
            version: "1.0",
            rubricType: inst.type === "Akademik" ? "1-4" : "1-5",
            rubricLevels: inst.type === "Akademik" ? [
              { score: 1, label: "Belum Terlihat" },
              { score: 2, label: "Mulai Berkembang" },
              { score: 3, label: "Sudah Berjalan" },
              { score: 4, label: "Sangat Inspiratif" }
            ] : [
              { score: 1, label: "Sangat Kurang" },
              { score: 2, label: "Kurang" },
              { score: 3, label: "Cukup" },
              { score: 4, label: "Baik" },
              { score: 5, label: "Sangat Baik" }
            ],
            createdAt: now,
            updatedAt: now
          } as SupervisionInstrument;
          await setDoc(docRef, newInst);
          items.push(newInst);
        }
      }

      return items;
    } catch (error) {
      return handleFirestoreError(error, OperationType.LIST, INSTRUMENTS_COLLECTION);
    }
  },

  async createSupervisionInstrument(
    data: Omit<SupervisionInstrument, "id" | "createdAt" | "updatedAt">
  ): Promise<SupervisionInstrument> {
    const colRef = collection(db, INSTRUMENTS_COLLECTION);
    const newDocRef = doc(colRef);
    const now = new Date().toISOString();

    const newInstrument: SupervisionInstrument = {
      id: newDocRef.id,
      ...data,
      createdAt: now,
      updatedAt: now
    };

    try {
      await setDoc(newDocRef, newInstrument);
      return newInstrument;
    } catch (error) {
      return handleFirestoreError(error, OperationType.WRITE, `${INSTRUMENTS_COLLECTION}/${newDocRef.id}`);
    }
  },

  async updateSupervisionInstrument(id: string, data: Partial<SupervisionInstrument>): Promise<void> {
    const docRef = doc(db, INSTRUMENTS_COLLECTION, id);
    const updateData = {
      ...data,
      updatedAt: new Date().toISOString()
    };

    try {
      await updateDoc(docRef, updateData);
    } catch (error) {
      return handleFirestoreError(error, OperationType.WRITE, `${INSTRUMENTS_COLLECTION}/${id}`);
    }
  },

  async deleteSupervisionInstrument(id: string): Promise<void> {
    const docRef = doc(db, INSTRUMENTS_COLLECTION, id);
    try {
      await updateDoc(docRef, {
        isDeleted: true,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      return handleFirestoreError(error, OperationType.DELETE, `${INSTRUMENTS_COLLECTION}/${id}`);
    }
  },

  async isInstrumentUsed(id: string): Promise<boolean> {
    const colRef = collection(db, RESULTS_COLLECTION);
    const q = query(colRef, where("instrumentId", "==", id));
    try {
      const querySnapshot = await getDocs(q);
      let used = false;
      querySnapshot.forEach(docSnap => {
        if (!docSnap.data().isDeleted) {
          used = true;
        }
      });
      return used;
    } catch (error) {
      console.error("Error checking if instrument is used:", error);
      return false;
    }
  },

  // =========================================================================
  // SUPERVISION RESULTS / ASSESSMENT OPERATIONS
  // =========================================================================

  async getSupervisionResult(supervisionId: string): Promise<SupervisionResult | null> {
    const colRef = collection(db, RESULTS_COLLECTION);
    const q = query(colRef, where("supervisionId", "==", supervisionId));
    try {
      const querySnapshot = await getDocs(q);
      if (querySnapshot.empty) return null;
      let result: SupervisionResult | null = null;
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (!data.isDeleted) {
          result = {
            id: docSnap.id,
            ...data
          } as SupervisionResult;
        }
      });
      return result;
    } catch (error) {
      return handleFirestoreError(error, OperationType.GET, `${RESULTS_COLLECTION}?supervisionId=${supervisionId}`);
    }
  },

  async saveSupervisionResult(
    data: Omit<SupervisionResult, "id" | "createdAt" | "updatedAt"> & { id?: string; createdAt?: string }
  ): Promise<SupervisionResult> {
    const colRef = collection(db, RESULTS_COLLECTION);
    const docId = data.id || doc(colRef).id;
    const docRef = doc(colRef, docId);
    const now = new Date().toISOString();

    const resultDoc: SupervisionResult = {
      ...data,
      id: docId,
      createdAt: data.createdAt || now,
      updatedAt: now
    } as SupervisionResult;

    try {
      await setDoc(docRef, resultDoc);

      // Update the main supervision record with status, score, and instrument cache
      const isAcademic = data.supervisionType === "Akademik";
      const targetCollection = isAcademic ? ACADEMIC_COLLECTION : MANAGERIAL_COLLECTION;
      const supervisionDocRef = doc(db, targetCollection, data.supervisionId);
      
      await updateDoc(supervisionDocRef, {
        status: "Selesai",
        score: data.totalScore,
        instrumentId: data.instrumentId,
        instrumentName: data.instrumentName,
        rtlText: data.rtlText || "",
        rtlStatus: data.rtlStatus || "Belum Dilaksanakan",
        rtlNotes: data.rtlNotes || "",
        updatedAt: now,
        updatedBy: data.updatedBy
      });

      // Automatically sync to Rapor Kinerja (SDM Performance)
      try {
        await sdmPerformanceService.syncSupervisionToPerformance(
          data.teacherId,
          data.academicYear,
          data.semester
        );
      } catch (err) {
        console.error("Failed to sync supervision result to performance evaluation:", err);
      }

      return resultDoc;
    } catch (error) {
      return handleFirestoreError(error, OperationType.WRITE, `${RESULTS_COLLECTION}/${docId}`);
    }
  }
};
