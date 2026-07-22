import { 
  collection, 
  getDocs, 
  doc, 
  getDoc,
  setDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  serverTimestamp,
  writeBatch
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase/config";
import { 
  AcademicReference, 
  AcademicEvent, 
  AcademicCalendarDay,
  EffectiveWeeksAnalysis,
  EffectiveDaysAnalysis,
  EffectiveJpAnalysis
} from "../types";
import { classService } from "./classService";
import { subjectService } from "./subjectService";
import { curriculumMatrixService } from "./curriculumMatrixService";
import { schoolSettingsService } from "./schoolSettings.service";

const REF_COLLECTION = "academic_reference";
const CALENDAR_COLLECTION = "academic_calendar";
const LOG_COLLECTION = "activity_logs";

// Helper log activity
async function logActivity(userId: string, userName: string, action: string, description: string) {
  try {
    const logsRef = collection(db, LOG_COLLECTION);
    await addDoc(logsRef, {
      userId,
      userName,
      action,
      collection: CALENDAR_COLLECTION,
      description,
      createdAt: serverTimestamp()
    });
  } catch (error) {
    console.error("Failed to write academic activity log:", error);
  }
}

// Initial seed data for Master Referensi Akademik
const DEFAULT_REFERENCES: Omit<AcademicReference, "id" | "createdAt">[] = [
  // 1. Kategori Event
  { category: "Kategori Event", code: "EVENT_KBM", name: "Kegiatan Belajar Mengajar (KBM)" },
  { category: "Kategori Event", code: "EVENT_ASESMEN", name: "Asesmen / Ujian" },
  { category: "Kategori Event", code: "EVENT_KEGIATAN", name: "Kegiatan Sekolah" },
  { category: "Kategori Event", code: "EVENT_LIBUR", name: "Libur Sekolah" },
  { category: "Kategori Event", code: "EVENT_RAPAT", name: "Rapat Guru / Staff" },

  // 2. Status Hari
  { category: "Status Hari", code: "STATUS_EFEKTIF", name: "Hari Efektif KBM" },
  { category: "Status Hari", code: "STATUS_TIDAK_EFEKTIF", name: "Hari Tidak Efektif KBM" },

  // 3. Jenis Hari
  { category: "Jenis Hari", code: "JH_PEMBELAJARAN", name: "Hari Pembelajaran" },
  { category: "Jenis Hari", code: "JH_LIBUR", name: "Hari Libur" },
  { category: "Jenis Hari", code: "JH_ASESMEN", name: "Hari Asesmen" },
  { category: "Jenis Hari", code: "JH_KEGIATAN", name: "Hari Kegiatan" },

  // 4. Jenis Penilaian
  { category: "Jenis Penilaian", code: "JP_FORMATIF", name: "Penilaian Formatif" },
  { category: "Jenis Penilaian", code: "JP_SUMATIF_HARIAN", name: "Penilaian Sumatif Harian" },
  { category: "Jenis Penilaian", code: "JP_PTS", name: "Penilaian Tengah Semester" },
  { category: "Jenis Penilaian", code: "JP_PAS", name: "Penilaian Akhir Semester" },

  // 5. Jenis Jurnal
  { category: "Jenis Jurnal", code: "JJ_KBM", name: "Jurnal Pembelajaran KBM" },
  { category: "Jenis Jurnal", code: "JJ_BIMBINGAN", name: "Jurnal Bimbingan & Konseling" },
  { category: "Jenis Jurnal", code: "JJ_EKSTRA", name: "Jurnal Ekstrakurikuler" },

  // 6. Status Pembelajaran
  { category: "Status Pembelajaran", code: "SP_TERLAKSANA", name: "Terlaksana Sepenuhnya" },
  { category: "Status Pembelajaran", code: "SP_SEBAGIAN", name: "Terlaksana Sebagian" },
  { category: "Status Pembelajaran", code: "SP_TIDAK", name: "Tidak Terlaksana" },

  // 7. Jenis Kegiatan Akademik
  { category: "Jenis Kegiatan Akademik", code: "JKA_UPACARA", name: "Upacara Bendera" },
  { category: "Jenis Kegiatan Akademik", code: "JKA_PERINGATAN", name: "Peringatan Hari Besar" },
  { category: "Jenis Kegiatan Akademik", code: "JKA_STUDI_TUR", name: "Studi Tur" },

  // 8. Jenis Libur
  { category: "Jenis Libur", code: "JL_NASIONAL", name: "Libur Nasional" },
  { category: "Jenis Libur", code: "JL_SEMESTER", name: "Libur Akhir Semester" },
  { category: "Jenis Libur", code: "JL_KHUSUS", name: "Libur Khusus Keagamaan" },

  // 9. Jenis Asesmen
  { category: "Jenis Asesmen", code: "JA_DIAGNOSTIK", name: "Asesmen Diagnostik" },
  { category: "Jenis Asesmen", code: "JA_FORMATIF", name: "Asesmen Formatif" },
  { category: "Jenis Asesmen", code: "JA_SUMATIF", name: "Asesmen Sumatif" },

  // 10. Kategori Kalender
  { category: "Kategori Kalender", code: "KK_SEKOLAH", name: "Kalender Internal Sekolah" },
  { category: "Kategori Kalender", code: "KK_NASIONAL", name: "Kalender Resmi Pemerintah" },
  { category: "Kategori Kalender", code: "KK_KEAGAMAAN", name: "Kalender Keagamaan" },
];

export const academicPlanningService = {
  // --- MASTER REFERENCES ---
  async getReferences(): Promise<AcademicReference[]> {
    try {
      const q = query(collection(db, REF_COLLECTION));
      const snap = await getDocs(q);
      const refs: AcademicReference[] = [];
      snap.forEach((docSnap) => {
        refs.push({ id: docSnap.id, ...docSnap.data() } as AcademicReference);
      });

      // Auto-seed if empty
      if (refs.length === 0) {
        await this.seedReferences();
        return this.getReferences();
      }
      return refs;
    } catch (error) {
      return handleFirestoreError(error, OperationType.LIST, REF_COLLECTION);
    }
  },

  async seedReferences(): Promise<void> {
    try {
      const batch = writeBatch(db);
      DEFAULT_REFERENCES.forEach((item) => {
        const ref = doc(collection(db, REF_COLLECTION));
        batch.set(ref, {
          ...item,
          createdAt: new Date().toISOString()
        });
      });
      await batch.commit();
      console.log("Master references seeded successfully.");
    } catch (error) {
      console.error("Failed to seed academic references:", error);
    }
  },

  async addReference(
    ref: Omit<AcademicReference, "id" | "createdAt">, 
    userId: string, 
    userName: string
  ): Promise<void> {
    try {
      const docRef = doc(collection(db, REF_COLLECTION));
      const data = {
        ...ref,
        createdAt: new Date().toISOString()
      };
      await setDoc(docRef, data);
      await logActivity(userId, userName, "ADD_REFERENCE", `Menambahkan referensi baru: [${ref.category}] ${ref.name}`);
    } catch (error) {
      return handleFirestoreError(error, OperationType.CREATE, REF_COLLECTION);
    }
  },

  async updateReference(
    id: string, 
    ref: Partial<AcademicReference>, 
    userId: string, 
    userName: string
  ): Promise<void> {
    try {
      const docRef = doc(db, REF_COLLECTION, id);
      await updateDoc(docRef, { ...ref });
      await logActivity(userId, userName, "UPDATE_REFERENCE", `Memperbarui referensi: [${ref.category}] ${ref.name}`);
    } catch (error) {
      return handleFirestoreError(error, OperationType.UPDATE, `${REF_COLLECTION}/${id}`);
    }
  },

  async deleteReference(id: string, userId: string, userName: string): Promise<void> {
    try {
      const docRef = doc(db, REF_COLLECTION, id);
      await deleteDoc(docRef);
      await logActivity(userId, userName, "DELETE_REFERENCE", `Menghapus referensi dengan ID: ${id}`);
    } catch (error) {
      return handleFirestoreError(error, OperationType.DELETE, `${REF_COLLECTION}/${id}`);
    }
  },

  // --- ACADEMIC CALENDAR EVENTS ---
  async migrateOldFormatDocuments(): Promise<void> {
    try {
      const q = query(collection(db, CALENDAR_COLLECTION));
      const snap = await getDocs(q);
      
      const batch = writeBatch(db);
      let needsCommit = false;
      const docsToDelete: string[] = [];

      snap.forEach((docSnap) => {
        const data = docSnap.data();
        const docId = docSnap.id;
        const dateStr = data.date || (/\d{4}-\d{2}-\d{2}/.test(docId) ? docId : null);

        // If it's a Type 1 old format document (represented by a date and contains 'events' array)
        if (data.events && Array.isArray(data.events) && dateStr) {
          needsCommit = true;
          docsToDelete.push(docId);
          
          data.events.forEach((evt: AcademicEvent, index: number) => {
            if (evt) {
              const eventId = evt.id || `evt-${dateStr}-${index}`;
              const eventDocRef = doc(db, CALENDAR_COLLECTION, eventId);
              
              const eventData = {
                id: eventId,
                title: evt.title || "",
                categoryId: evt.categoryId || "",
                categoryName: evt.categoryName || "",
                statusId: evt.statusId || "",
                statusName: evt.statusName || "",
                description: evt.description || "",
                priority: evt.priority || "Sedang",
                isEffectiveDay: evt.isEffectiveDay !== false,
                reduceLesson: !!evt.reduceLesson,
                specialLessonDuration: Number(evt.specialLessonDuration || 40),
                affectsAcademicPlanning: evt.affectsAcademicPlanning !== false,
                affectsScheduler: evt.affectsScheduler !== false,
                createdAt: evt.createdAt || data.createdAt || new Date().toISOString(),
                isRange: !!evt.isRange,
                startDate: evt.startDate || dateStr,
                endDate: evt.endDate || dateStr,
                academicYearId: data.academicYearId || "",
                semesterId: data.semesterId || "",
                updatedAt: serverTimestamp()
              };
              
              batch.set(eventDocRef, eventData, { merge: true });
            }
          });
        }
      });

      if (needsCommit) {
        docsToDelete.forEach((id) => {
          const docRef = doc(db, CALENDAR_COLLECTION, id);
          batch.delete(docRef);
        });
        await batch.commit();
        console.log(`[Migration] Cleaned up and migrated ${docsToDelete.length} old-format academic calendar documents.`);
      }
    } catch (error) {
      console.error("[Migration Error] Failed to migrate old format calendar documents:", error);
    }
  },

  async getCalendarDays(academicYearId?: string, semesterId?: string): Promise<AcademicCalendarDay[]> {
    try {
      // Clean and migrate old-format documents on load
      await this.migrateOldFormatDocuments();

      let q = query(collection(db, CALENDAR_COLLECTION));
      if (academicYearId) {
        q = query(collection(db, CALENDAR_COLLECTION), where("academicYearId", "==", academicYearId));
      }
      const snap = await getDocs(q);
      
      const daysMap: { [dateStr: string]: { events: AcademicEvent[]; academicYearId?: string; semesterId?: string } } = {};

      snap.forEach((docSnap) => {
        const data = docSnap.data();
        const docId = docSnap.id;
        const dateStr = data.date || (/\d{4}-\d{2}-\d{2}/.test(docId) ? docId : null);
        
        // Backwards compatibility: Check if it's the old format (representing a single date with 'events' list)
        if (data.events && Array.isArray(data.events) && dateStr) {
          if (!semesterId || data.semesterId === semesterId) {
            if (!daysMap[dateStr]) {
              daysMap[dateStr] = { events: [], academicYearId: data.academicYearId, semesterId: data.semesterId };
            }
            data.events.forEach((evt: AcademicEvent, index: number) => {
              const eventId = evt.id || `evt-${dateStr}-${index}`;
              const eventItem: AcademicEvent = {
                ...evt,
                id: eventId,
                startDate: evt.startDate || dateStr,
                endDate: evt.endDate || dateStr
              };
              if (!daysMap[dateStr].events.some(e => e.id === eventItem.id)) {
                daysMap[dateStr].events.push(eventItem);
              }
            });
          }
        } else if (data.startDate && data.endDate) {
          // New format: Represents a single event that might span a date range
          if (!semesterId || data.semesterId === semesterId) {
            const startStr = data.startDate;
            const endStr = data.endDate;
            const eventId = data.id || docId;
            
            // Get all dates in this event's range
            const rangeDates = this.getDatesRange(startStr, endStr);
            const eventItem: AcademicEvent = {
              id: eventId,
              title: data.title || "",
              categoryId: data.categoryId || "",
              categoryName: data.categoryName || "",
              statusId: data.statusId || "",
              statusName: data.statusName || "",
              description: data.description || "",
              priority: data.priority || "Sedang",
              isEffectiveDay: data.isEffectiveDay !== false,
              reduceLesson: !!data.reduceLesson,
              specialLessonDuration: Number(data.specialLessonDuration || 40),
              affectsAcademicPlanning: data.affectsAcademicPlanning !== false,
              affectsScheduler: data.affectsScheduler !== false,
              createdAt: data.createdAt || new Date().toISOString(),
              isRange: !!data.isRange,
              startDate: startStr,
              endDate: endStr,
              sasaran: data.sasaran || "Semua Siswa",
              pelaksana: data.pelaksana || "Sekolah"
            };

            rangeDates.forEach((dStr) => {
              if (!daysMap[dStr]) {
                daysMap[dStr] = { events: [], academicYearId: data.academicYearId, semesterId: data.semesterId };
              }
              if (!daysMap[dStr].events.some(e => e.id === eventItem.id)) {
                daysMap[dStr].events.push(eventItem);
              }
            });
          }
        }
      });

      // Construct the resulting AcademicCalendarDay[]
      const days: AcademicCalendarDay[] = Object.keys(daysMap).map((dateStr) => ({
        id: dateStr,
        date: dateStr,
        events: daysMap[dateStr].events,
        academicYearId: daysMap[dateStr].academicYearId,
        semesterId: daysMap[dateStr].semesterId
      }));

      // Sort chronological
      days.sort((a, b) => a.date.localeCompare(b.date));

      return days;
    } catch (error) {
      return handleFirestoreError(error, OperationType.LIST, CALENDAR_COLLECTION);
    }
  },

  async saveCalendarDayEvents(
    date: string, 
    events: AcademicEvent[], 
    academicYearId: string, 
    semesterId: string, 
    userId: string, 
    userName: string
  ): Promise<void> {
    try {
      const docRef = doc(db, CALENDAR_COLLECTION, date);
      
      if (events.length === 0) {
        await deleteDoc(docRef);
        await logActivity(userId, userName, "DELETE_CALENDAR_DAY", `Menghapus seluruh event pada tanggal ${date}`);
      } else {
        const data: AcademicCalendarDay = {
          id: date,
          date,
          events,
          academicYearId,
          semesterId
        };
        await setDoc(docRef, data);
        await logActivity(userId, userName, "SAVE_CALENDAR_DAY", `Menyimpan ${events.length} event baru pada tanggal ${date}`);
      }
    } catch (error) {
      return handleFirestoreError(error, OperationType.WRITE, `${CALENDAR_COLLECTION}/${date}`);
    }
  },

  async saveCalendarEvent(
    event: AcademicEvent,
    academicYearId: string,
    semesterId: string,
    userId: string,
    userName: string
  ): Promise<void> {
    try {
      const docRef = doc(db, CALENDAR_COLLECTION, event.id);
      const data = {
        ...event,
        academicYearId,
        semesterId,
        updatedAt: serverTimestamp()
      };
      await setDoc(docRef, data);
      await logActivity(userId, userName, "SAVE_CALENDAR_EVENT", `Menyimpan agenda: ${event.title} (${event.startDate} s/d ${event.endDate})`);
    } catch (error) {
      return handleFirestoreError(error, OperationType.WRITE, `${CALENDAR_COLLECTION}/${event.id}`);
    }
  },

  async deleteCalendarEvent(
    eventId: string,
    userId: string,
    userName: string
  ): Promise<void> {
    console.log(`[AUDIT-DELETE] Memulai proses hapus agenda.`);
    console.log(`[AUDIT-DELETE] ID Document: ${eventId}`);
    console.log(`[AUDIT-DELETE] Collection: ${CALENDAR_COLLECTION}`);
    
    try {
      if (!eventId) {
        throw new Error("ID Event tidak valid atau kosong.");
      }
      
      // 1. Delete direct document (New Format)
      const docRef = doc(db, CALENDAR_COLLECTION, eventId);
      await deleteDoc(docRef);
      console.log(`[AUDIT-DELETE] Status: BERHASIL menghapus dokumen langsung dengan ID: ${eventId}`);

      // 2. Also clean up any old format day documents that might contain this event
      const q = query(collection(db, CALENDAR_COLLECTION));
      const snap = await getDocs(q);
      const batch = writeBatch(db);
      let needsCommit = false;

      snap.forEach((docSnap) => {
        const data = docSnap.data();
        const docId = docSnap.id;
        const dateStr = data.date || (/\d{4}-\d{2}-\d{2}/.test(docId) ? docId : null);
        
        if (data.events && Array.isArray(data.events)) {
          const originalLength = data.events.length;
          
          const remainingEvents = data.events.filter((e: any, index: number) => {
            const eventStableId = e.id || `evt-${dateStr || docId}-${index}`;
            return eventStableId !== eventId && e.id !== eventId;
          });
          
          if (remainingEvents.length !== originalLength) {
            needsCommit = true;
            if (remainingEvents.length === 0) {
              batch.delete(docSnap.ref);
              console.log(`[AUDIT-DELETE] Menghapus dokumen day kosong: ${docId}`);
            } else {
              batch.update(docSnap.ref, { events: remainingEvents });
              console.log(`[AUDIT-DELETE] Menyaring event dari dokumen day: ${docId}`);
            }
          }
        }
      });

      if (needsCommit) {
        await batch.commit();
        console.log(`[AUDIT-DELETE] Batch commit selesai untuk membersihkan dokumen lama.`);
      }

      await logActivity(userId, userName, "DELETE_CALENDAR_EVENT", `Menghapus agenda dengan ID: ${eventId}`);
      console.log(`[AUDIT-DELETE] Status Akhir: BERHASIL SEPENUHNYA.`);
    } catch (error: any) {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error(`[AUDIT-DELETE] Status: GAGAL.`);
      console.error(`[AUDIT-DELETE] Pesan Error Firestore: ${errMsg}`);
      return handleFirestoreError(error, OperationType.DELETE, `${CALENDAR_COLLECTION}/${eventId}`);
    }
  },

  async getCalendarEvents(academicYearId?: string, semesterId?: string): Promise<AcademicEvent[]> {
    try {
      // Clean and migrate old-format documents on load
      await this.migrateOldFormatDocuments();

      let q = query(collection(db, CALENDAR_COLLECTION));
      if (academicYearId) {
        q = query(collection(db, CALENDAR_COLLECTION), where("academicYearId", "==", academicYearId));
      }
      const snap = await getDocs(q);
      const eventsMap: { [id: string]: AcademicEvent } = {};

      snap.forEach((docSnap) => {
        const data = docSnap.data();
        const docId = docSnap.id;
        const dateStr = data.date || (/\d{4}-\d{2}-\d{2}/.test(docId) ? docId : null);
        
        if (data.events && Array.isArray(data.events) && dateStr) {
          // Old format day representation
          if (!semesterId || data.semesterId === semesterId) {
            data.events.forEach((evt: AcademicEvent, index: number) => {
              const eventId = evt.id || `evt-${dateStr}-${index}`;
              eventsMap[eventId] = {
                ...evt,
                id: eventId,
                startDate: evt.startDate || dateStr,
                endDate: evt.endDate || dateStr
              };
            });
          }
        } else if (data.startDate && data.endDate) {
          // New format single event
          if (!semesterId || data.semesterId === semesterId) {
            const eventId = data.id || docId;
            eventsMap[eventId] = {
              id: eventId,
              title: data.title || "",
              categoryId: data.categoryId || "",
              categoryName: data.categoryName || "",
              statusId: data.statusId || "",
              statusName: data.statusName || "",
              description: data.description || "",
              priority: data.priority || "Sedang",
              isEffectiveDay: data.isEffectiveDay !== false,
              reduceLesson: !!data.reduceLesson,
              specialLessonDuration: Number(data.specialLessonDuration || 40),
              affectsAcademicPlanning: data.affectsAcademicPlanning !== false,
              affectsScheduler: data.affectsScheduler !== false,
              createdAt: data.createdAt || new Date().toISOString(),
              isRange: !!data.isRange,
              startDate: data.startDate,
              endDate: data.endDate,
              sasaran: data.sasaran || "Semua Siswa",
              pelaksana: data.pelaksana || "Sekolah"
            };
          }
        }
      });

      const events = Object.values(eventsMap);
      events.sort((a, b) => (a.startDate || "").localeCompare(b.startDate || ""));
      return events;
    } catch (error) {
      return handleFirestoreError(error, OperationType.LIST, CALENDAR_COLLECTION);
    }
  },

  async checkDateEffectiveness(
    dateStr: string,
    academicYearId: string,
    semesterId: string
  ): Promise<{ isEffective: boolean; notes?: string }> {
    try {
      if (!semesterId) {
        return { isEffective: true };
      }
      const semRef = doc(db, "semesters", semesterId);
      const semSnap = await getDoc(semRef);
      if (!semSnap.exists()) {
        return { isEffective: true };
      }
      const semData = semSnap.data();
      
      const dateObj = new Date(dateStr);
      if (isNaN(dateObj.getTime())) {
        return { isEffective: true };
      }
      
      const monthNames = [
        "Januari", "Februari", "Maret", "April", "Mei", "Juni", 
        "Juli", "Agustus", "September", "Oktober", "November", "Desember"
      ];
      const monthName = monthNames[dateObj.getMonth()];
      const year = dateObj.getFullYear();
      const monthYearKey = `${monthName} ${year}`;

      // Check manual config first
      if (semData.manualWeeksConfigured && Array.isArray(semData.details)) {
        const detail = semData.details.find((d: any) => d.month === monthYearKey || d.month.startsWith(monthName));
        if (detail) {
          // Calculate week index
          const weekIdx = this.getWeekIndexInMonth(dateObj);
          if (Array.isArray(detail.weeks) && detail.weeks[weekIdx]) {
            const isEffective = detail.weeks[weekIdx].isEffective === true;
            return { 
              isEffective, 
              notes: isEffective ? "Hari Efektif KBM" : (detail.weeks[weekIdx].notes || detail.notes || "Minggu Tidak Efektif") 
            };
          }
          const isEffective = weekIdx < Number(detail.effectiveWeeks);
          return { isEffective, notes: isEffective ? "Hari Efektif KBM" : (detail.notes || "Minggu Tidak Efektif") };
        }
      }

      // Automatically analyze from calendar days
      const weeksAnalysis = await this.analyzeEffectiveWeeks(
        semData.startDate,
        semData.endDate,
        academicYearId,
        semesterId
      );
      
      const detail = weeksAnalysis.details.find((d: any) => d.month === monthYearKey || d.month.startsWith(monthName));
      if (!detail) {
        return { isEffective: true };
      }
      
      const weekIdx = this.getWeekIndexInMonth(dateObj);
      if (Array.isArray(detail.weeks) && detail.weeks[weekIdx]) {
        const isEffective = detail.weeks[weekIdx].isEffective === true;
        return { 
          isEffective, 
          notes: isEffective ? "Hari Efektif KBM" : (detail.weeks[weekIdx].notes || detail.notes || "Minggu Tidak Efektif") 
        };
      }
      const isEffective = weekIdx < detail.effectiveWeeks;
      return { isEffective, notes: isEffective ? "Hari Efektif KBM" : (detail.notes || "Minggu Tidak Efektif") };
    } catch (error) {
      console.error("Error checking date effectiveness:", error);
      return { isEffective: true };
    }
  },

  getWeekIndexInMonth(dateObj: Date): number {
    const firstDayOfMonth = new Date(dateObj.getFullYear(), dateObj.getMonth(), 1);
    const daysInMonth: Date[] = [];
    const current = new Date(firstDayOfMonth);
    while (current.getMonth() === dateObj.getMonth()) {
      daysInMonth.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    const indonesianDays = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
    const weeks: Date[][] = [];
    let currentWeek: Date[] = [];
    
    daysInMonth.forEach((d) => {
      currentWeek.push(d);
      const dayName = indonesianDays[d.getDay()];
      if (dayName === "Jumat" || d.getDate() === daysInMonth.length) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    });

    const targetDateOnlyStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
    return weeks.findIndex(w => 
      w.some(d => {
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}` === targetDateOnlyStr;
      })
    );
  },

  async importCalendarEventsBulk(
    importedDays: AcademicCalendarDay[],
    academicYearId: string,
    semesterId: string,
    userId: string,
    userName: string
  ): Promise<void> {
    try {
      const eventsToWrite: { docId: string; data: any }[] = [];
      importedDays.forEach((day) => {
        day.events.forEach((evt) => {
          const eventId = evt.id || `evt-${day.date}-${Math.random().toString(36).substring(2, 7)}`;
          eventsToWrite.push({
            docId: eventId,
            data: {
              ...evt,
              id: eventId,
              startDate: evt.startDate || day.date,
              endDate: evt.endDate || day.date,
              academicYearId: (evt as any).academicYearId || day.academicYearId || academicYearId,
              semesterId: (evt as any).semesterId || day.semesterId || semesterId,
              updatedAt: serverTimestamp()
            }
          });
        });
      });

      const chunks: { docId: string; data: any }[][] = [];
      for (let i = 0; i < eventsToWrite.length; i += 400) {
        chunks.push(eventsToWrite.slice(i, i + 400));
      }

      for (const chunk of chunks) {
        const batch = writeBatch(db);
        chunk.forEach((item) => {
          const docRef = doc(db, CALENDAR_COLLECTION, item.docId);
          batch.set(docRef, item.data);
        });
        await batch.commit();
      }

      await logActivity(
        userId, 
        userName, 
        "IMPORT_CALENDAR", 
        `Mengimpor massal ${eventsToWrite.length} agenda kalender akademik.`
      );
    } catch (error) {
      return handleFirestoreError(error, OperationType.WRITE, CALENDAR_COLLECTION);
    }
  },

  // --- AUTOMATED ENGINE ANALYSES ---

  // Helper: Generates all dates in a string range [startDate, endDate] inclusive
  getDatesRange(startDateStr: string, endDateStr: string): string[] {
    const dates: string[] = [];
    const start = new Date(startDateStr);
    const end = new Date(endDateStr);
    
    // Prevent infinite loop if dates are invalid
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
      return [];
    }

    const current = new Date(start);
    while (current <= end) {
      const yyyy = current.getFullYear();
      const mm = String(current.getMonth() + 1).padStart(2, '0');
      const dd = String(current.getDate()).padStart(2, '0');
      dates.push(`${yyyy}-${mm}-${dd}`);
      current.setDate(current.getDate() + 1);
    }
    return dates;
  },

  // 1. ANALISIS HARI EFEKTIF
  async analyzeEffectiveDays(
    startDate: string,
    endDate: string,
    academicYearId: string,
    semesterId: string
  ): Promise<EffectiveDaysAnalysis> {
    const [calendarDays, settings] = await Promise.all([
      this.getCalendarDays(academicYearId, semesterId),
      schoolSettingsService.getSettings()
    ]);

    const activeDays = settings?.activeDays || ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
    const calendarDaysMap = new Map<string, AcademicEvent[]>();
    calendarDays.forEach((cd) => {
      calendarDaysMap.set(cd.date, cd.events);
    });

    const dates = this.getDatesRange(startDate, endDate);
    
    let learningDays = 0;
    let holidayDays = 0;
    let assessmentDays = 0;
    let activityDays = 0;

    const indonesianDays = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

    const details = dates.map((dateStr) => {
      const dateObj = new Date(dateStr);
      const dayIndex = dateObj.getDay();
      const dayName = indonesianDays[dayIndex];

      const events = calendarDaysMap.get(dateStr) || [];
      const isWeekend = !activeDays.some(ad => ad.toLowerCase() === dayName.toLowerCase());

      let type: "Hari Pembelajaran" | "Hari Libur" | "Hari Asesmen" | "Hari Kegiatan" | "Hari Tidak Aktif (Weekend)" = "Hari Pembelajaran";
      let isEffective = true;

      if (isWeekend) {
        type = "Hari Tidak Aktif (Weekend)";
        isEffective = false;
      } else if (events.length > 0) {
        // Evaluate effective day fields
        const hasIneffectiveEvent = events.some(e => e.isEffectiveDay === false);
        const eventTitles = events.map(e => e.title.toLowerCase());

        // Check if categorized as assessment, activity, or holiday
        const isAssessment = events.some(e => e.categoryId === "EVENT_ASESMEN" || e.categoryName?.toLowerCase().includes("asesmen") || e.title.toLowerCase().includes("ujian") || e.title.toLowerCase().includes("pts") || e.title.toLowerCase().includes("pas"));
        const isHoliday = events.some(e => e.categoryId === "EVENT_LIBUR" || e.categoryName?.toLowerCase().includes("libur") || e.title.toLowerCase().includes("libur") || e.title.toLowerCase().includes("merah"));
        const isActivity = events.some(e => e.categoryId === "EVENT_KEGIATAN" || e.categoryName?.toLowerCase().includes("kegiatan") || e.title.toLowerCase().includes("upacara") || e.title.toLowerCase().includes("rapat"));

        if (hasIneffectiveEvent || isHoliday) {
          isEffective = false;
          type = "Hari Libur";
          holidayDays++;
        } else if (isAssessment) {
          type = "Hari Asesmen";
          assessmentDays++;
        } else if (isActivity) {
          type = "Hari Kegiatan";
          activityDays++;
        } else {
          type = "Hari Pembelajaran";
          learningDays++;
        }
      } else {
        type = "Hari Pembelajaran";
        learningDays++;
      }

      return {
        date: dateStr,
        dayName,
        type,
        isEffective,
        events: events.map(e => e.title)
      };
    });

    return {
      academicYearId,
      semesterId,
      learningDays,
      holidayDays,
      assessmentDays,
      activityDays,
      details
    };
  },

  // 2. ANALISIS PEKAN EFEKTIF
  async analyzeEffectiveWeeks(
    startDate: string,
    endDate: string,
    academicYearId: string,
    semesterId: string,
    bypassManual: boolean = false
  ): Promise<EffectiveWeeksAnalysis> {
    const daysAnalysis = await this.analyzeEffectiveDays(startDate, endDate, academicYearId, semesterId);
    
    // Group days by calendar weeks
    const monthNames = [
      "Januari", "Februari", "Maret", "April", "Mei", "Juni", 
      "Juli", "Agustus", "September", "Oktober", "November", "Desember"
    ];

    const monthsMap = new Map<string, { days: typeof daysAnalysis.details }>();

    daysAnalysis.details.forEach((day) => {
      const parts = day.date.split("-");
      const monthIndex = parseInt(parts[1]) - 1;
      const monthYearKey = `${monthNames[monthIndex]} ${parts[0]}`;
      
      if (!monthsMap.has(monthYearKey)) {
        monthsMap.set(monthYearKey, { days: [] });
      }
      monthsMap.get(monthYearKey)!.days.push(day);
    });

    let totalWeeksSum = 0;
    let effectiveWeeksSum = 0;
    let ineffectiveWeeksSum = 0;

    const details: EffectiveWeeksAnalysis["details"] = [];

    monthsMap.forEach((data, monthKey) => {
      // Chunk days in this month into weeks (Saturday to Friday boundaries)
      const weeks: (typeof daysAnalysis.details)[] = [];
      let currentWeek: typeof daysAnalysis.details = [];

      data.days.forEach((day, index) => {
        currentWeek.push(day);
        // If Friday (Jumat) or end of month, push week
        if (day.dayName === "Jumat" || index === data.days.length - 1) {
          weeks.push(currentWeek);
          currentWeek = [];
        }
      });

      let effectiveInMonth = 0;
      let ineffectiveInMonth = 0;
      const holidayNotes: string[] = [];

      const mappedWeeks = weeks.map((weekDays, wIdx) => {
        // A week is effective if there are at least 3 effective days in it
        const effectiveDaysInWeek = weekDays.filter(d => d.isEffective).length;
        const isEffective = effectiveDaysInWeek >= 3;
        
        if (isEffective) {
          effectiveInMonth++;
        } else {
          ineffectiveInMonth++;
        }

        const weekHolidayNotes: string[] = [];
        weekDays.forEach(d => {
          if (d.events.length > 0) {
            d.events.forEach(e => {
              if (!weekHolidayNotes.includes(e)) weekHolidayNotes.push(e);
            });
          }
        });

        const notes = weekHolidayNotes.length > 0 ? weekHolidayNotes.join(", ") : "";
        if (notes && !isEffective) {
          if (!holidayNotes.includes(notes)) holidayNotes.push(notes);
        }

        return {
          weekNum: wIdx + 1,
          isEffective,
          notes: notes || (isEffective ? "" : "Minggu Tidak Efektif"),
          dates: weekDays.map(d => d.date)
        };
      });

      const totalInMonth = weeks.length;
      totalWeeksSum += totalInMonth;
      effectiveWeeksSum += effectiveInMonth;
      ineffectiveWeeksSum += ineffectiveInMonth;

      details.push({
        month: monthKey,
        totalWeeks: totalInMonth,
        effectiveWeeks: effectiveInMonth,
        effectiveWeeksByGrade: {
          "VII": effectiveInMonth,
          "VIII": effectiveInMonth,
          "IX": effectiveInMonth
        },
        ineffectiveWeeks: ineffectiveInMonth,
        notes: holidayNotes.length > 0 ? holidayNotes.join(", ") : "Hari efektif belajar penuh",
        weeks: mappedWeeks
      } as any);
    });

    let manualWeeksConfigured = false;
    let assessmentWeeks = 0;
    let pasPatWeeks = 0;
    let projectWeeks = 0;
    let otherWeeks = 0;

    try {
      if (semesterId && !bypassManual) {
        const semRef = doc(db, "semesters", semesterId);
        const semSnap = await getDoc(semRef);
        if (semSnap.exists()) {
          const semData = semSnap.data();
          if (semData.manualWeeksConfigured) {
            manualWeeksConfigured = true;
            assessmentWeeks = Number(semData.assessmentWeeks) || 0;
            pasPatWeeks = Number(semData.pasPatWeeks) || 0;
            projectWeeks = Number(semData.projectWeeks) || 0;
            otherWeeks = Number(semData.otherWeeks) || 0;

            const storedDetails = semData.details || [];
            
            if (storedDetails.length > 0) {
              // Ensure every month in storedDetails has a valid weeks array
              storedDetails.forEach((storedMonth: any) => {
                if (!Array.isArray(storedMonth.weeks)) {
                  storedMonth.weeks = [];
                }
                
                // If weeks list is empty but totalWeeks > 0, reconstruct it
                if (storedMonth.weeks.length === 0 && storedMonth.totalWeeks > 0) {
                  const storedEffCount = Number(storedMonth.effectiveWeeks) || 0;
                  storedMonth.weeks = Array.from({ length: storedMonth.totalWeeks }, (_, idx) => {
                    const isEff = idx < storedEffCount;
                    return {
                      weekNum: idx + 1,
                      isEffective: isEff,
                      notes: isEff ? "" : (storedMonth.notes || "Minggu Tidak Efektif"),
                      dates: []
                    };
                  });
                }
                
                // Recalculate monthly totals for consistency
                const mTotal = storedMonth.weeks.length;
                const mEff = storedMonth.weeks.filter((w: any) => w.isEffective).length;
                const mIneff = mTotal - mEff;
                const mNotesList = storedMonth.weeks.filter((w: any) => !w.isEffective).map((w: any) => w.notes).filter(Boolean);

                storedMonth.totalWeeks = mTotal;
                storedMonth.effectiveWeeks = mEff;
                storedMonth.ineffectiveWeeks = mIneff;
                storedMonth.effectiveWeeksByGrade = {
                  "VII": mEff,
                  "VIII": mEff,
                  "IX": mEff
                };
                storedMonth.notes = mNotesList.length > 0 ? mNotesList.join(", ") : "Hari efektif belajar penuh";
              });

              // Merge any dynamically computed months that are not in storedDetails
              details.forEach((computedMonth: any) => {
                const exists = storedDetails.some((sm: any) => sm.month === computedMonth.month || sm.month.startsWith(computedMonth.month));
                if (!exists) {
                  storedDetails.push(computedMonth);
                }
              });

              // Replace details with storedDetails
              details.length = 0;
              details.push(...storedDetails);
            }

            // Recalculate the overall semester summaries
            totalWeeksSum = details.reduce((sum, m) => sum + m.totalWeeks, 0);
            effectiveWeeksSum = details.reduce((sum, m) => sum + m.effectiveWeeks, 0);
            ineffectiveWeeksSum = totalWeeksSum - effectiveWeeksSum;
          }
        }
      }
    } catch (err) {
      console.error("Error checking manual weeks config:", err);
    }

    return {
      academicYearId,
      semesterId,
      totalWeeks: totalWeeksSum,
      effectiveWeeks: effectiveWeeksSum,
      ineffectiveWeeks: ineffectiveWeeksSum,
      details,
      manualWeeksConfigured,
      assessmentWeeks,
      pasPatWeeks,
      projectWeeks,
      otherWeeks
    };
  },

  // 3. ANALISIS JP EFEKTIF
  async analyzeEffectiveJp(
    academicYearId: string,
    semesterId: string,
    startDate: string,
    endDate: string
  ): Promise<EffectiveJpAnalysis> {
    const [
      matrixList,
      classList,
      subjectsList,
      weeksAnalysis
    ] = await Promise.all([
      curriculumMatrixService.getCurriculumMatrix(),
      classService.getClasses(),
      subjectService.getSubjects(),
      this.analyzeEffectiveWeeks(startDate, endDate, academicYearId, semesterId)
    ]);

    const activeClasses = classList.filter(c => c.status === "Aktif" && !c.isDeleted);
    
    // Count Rombel (Classes) per grade level (VII, VIII, IX)
    const rombuls = {
      VII: activeClasses.filter(c => c.gradeLevel === "VII").length,
      VIII: activeClasses.filter(c => c.gradeLevel === "VIII").length,
      IX: activeClasses.filter(c => c.gradeLevel === "IX").length
    };

    // Calculate effective weeks for semester and approximate yearly
    const effWeeksSemester = weeksAnalysis.effectiveWeeks;
    // For annual, we assume standard 18-20 effective weeks per semester (multiply semester 1 + 2 or assume double)
    const effWeeksYear = effWeeksSemester * 2; 

    // --- Compute by Grade Level ---
    // Total weekly JPs in curriculum matrix
    let weeklyJpVii = 0;
    let weeklyJpViii = 0;
    let weeklyJpIx = 0;

    matrixList.forEach((m) => {
      weeklyJpVii += m.jp_vii || 0;
      weeklyJpViii += m.jp_viii || 0;
      weeklyJpIx += m.jp_ix || 0;
    });

    // Multiplied by rombels to fulfill: "Seluruh engine harus mendukung jumlah rombel tidak terbatas."
    const weeklyJpViiMulti = weeklyJpVii * rombuls.VII;
    const weeklyJpViiiMulti = weeklyJpViii * rombuls.VIII;
    const weeklyJpIxMulti = weeklyJpIx * rombuls.IX;

    const getLevelWeeks = (grade: string) => {
      return weeksAnalysis.details?.reduce((sum: number, m: any) => {
        return sum + (m.effectiveWeeksByGrade?.[grade] ?? m.effectiveWeeks);
      }, 0) ?? weeksAnalysis.effectiveWeeks;
    };

    const weeksVII = getLevelWeeks("VII");
    const weeksVIII = getLevelWeeks("VIII");
    const weeksIX = getLevelWeeks("IX");

    const byGrade: EffectiveJpAnalysis["byGrade"] = [
      {
        gradeLevel: "VII",
        totalWeeklyJp: weeklyJpViiMulti,
        effectiveJpSemester: weeklyJpViiMulti * weeksVII,
        effectiveJpYear: weeklyJpViiMulti * (weeksVII * 2)
      },
      {
        gradeLevel: "VIII",
        totalWeeklyJp: weeklyJpViiiMulti,
        effectiveJpSemester: weeklyJpViiiMulti * weeksVIII,
        effectiveJpYear: weeklyJpViiiMulti * (weeksVIII * 2)
      },
      {
        gradeLevel: "IX",
        totalWeeklyJp: weeklyJpIxMulti,
        effectiveJpSemester: weeklyJpIxMulti * weeksIX,
        effectiveJpYear: weeklyJpIxMulti * (weeksIX * 2)
      }
    ];

    // --- Compute by Subject ---
    const bySubject: EffectiveJpAnalysis["bySubject"] = subjectsList.map((subject) => {
      // Find matrix entries for this subject
      const matrixForSubject = matrixList.filter(m => m.subjectId === subject.id);
      
      let subjectWeeklyVii = 0;
      let subjectWeeklyViii = 0;
      let subjectWeeklyIx = 0;

      matrixForSubject.forEach((m) => {
        subjectWeeklyVii += m.jp_vii || 0;
        subjectWeeklyViii += m.jp_viii || 0;
        subjectWeeklyIx += m.jp_ix || 0;
      });

      // Total weekly JP for this subject, factoring in rombuls (unlimited classes support)
      const totalWeeklyJpWithRombel = 
        (subjectWeeklyVii * rombuls.VII) + 
        (subjectWeeklyViii * rombuls.VIII) + 
        (subjectWeeklyIx * rombuls.IX);

      const effectiveSemesterGanjil = 
        (subjectWeeklyVii * rombuls.VII * weeksVII) + 
        (subjectWeeklyViii * rombuls.VIII * weeksVIII) + 
        (subjectWeeklyIx * rombuls.IX * weeksIX);
      const effectiveSemesterGenap = effectiveSemesterGanjil; // standard projection
      const effectiveTahunan = effectiveSemesterGanjil + effectiveSemesterGenap;

      return {
        subjectId: subject.id,
        subjectName: subject.name,
        weeklyJpVii: subjectWeeklyVii * rombuls.VII,
        weeklyJpViii: subjectWeeklyViii * rombuls.VIII,
        weeklyJpIx: subjectWeeklyIx * rombuls.IX,
        effectiveSemesterGanjil,
        effectiveSemesterGenap,
        effectiveTahunan
      };
    });

    const totalEffectiveJpHalfYear = byGrade.reduce((sum, g) => sum + g.effectiveJpSemester, 0);
    const totalEffectiveJpFullYear = byGrade.reduce((sum, g) => sum + g.effectiveJpYear, 0);

    return {
      academicYearId,
      semesterId,
      effectiveJpHalfYear: totalEffectiveJpHalfYear,
      effectiveJpFullYear: totalEffectiveJpFullYear,
      byGrade,
      bySubject
    };
  }
};
