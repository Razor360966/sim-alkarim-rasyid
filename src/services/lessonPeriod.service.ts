import { 
  collection, 
  getDocs, 
  writeBatch, 
  doc, 
  addDoc, 
  serverTimestamp,
  query,
  orderBy,
  where,
  updateDoc
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase/config";
import { schoolSettingsService } from "./schoolSettings.service";
import { generateDailySchedule } from "../utils/scheduleCalculator";
import { LessonPeriod, LessonPeriodType, SchoolSettings, RoutineActivity } from "../types";

const COLLECTION_NAME = "lesson_periods";

export async function logLessonPeriodActivity(
  userId: string, 
  userName: string, 
  action: string, 
  description: string
) {
  try {
    const logsRef = collection(db, "activity_logs");
    await addDoc(logsRef, {
      userId,
      userName,
      action,
      collection: COLLECTION_NAME,
      description,
      createdAt: serverTimestamp()
    });
  } catch (error) {
    console.error("Failed to write lesson period activity log:", error);
  }
}

export const lessonPeriodService = {
  // Get all generated lesson periods
  async getLessonPeriods(): Promise<LessonPeriod[]> {
    try {
      const q = query(collection(db, COLLECTION_NAME));
      const querySnapshot = await getDocs(q);
      const periods: LessonPeriod[] = [];
      
      querySnapshot.forEach((doc) => {
        periods.push({
          id: doc.id,
          ...doc.data()
        } as LessonPeriod);
      });

      // Sort periods by day order and then by sequence
      const DAY_ORDER: Record<string, number> = {
        "Sabtu": 1,
        "Minggu": 2,
        "Senin": 3,
        "Selasa": 4,
        "Rabu": 5,
        "Kamis": 6,
        "Jumat": 7
      };

      return periods.sort((a, b) => {
        const dayA = DAY_ORDER[a.day] || 99;
        const dayB = DAY_ORDER[b.day] || 99;
        if (dayA !== dayB) {
          return dayA - dayB;
        }
        return a.sequence - b.sequence;
      });
    } catch (error) {
      return handleFirestoreError(error, OperationType.GET, COLLECTION_NAME);
    }
  },

  // Generate or Regenerate all lesson periods based on active school settings
  // Generate or Regenerate all lesson periods based on active school settings and active school agendas
  async generateLessonPeriods(
    operatorId: string,
    operatorName: string
  ): Promise<LessonPeriod[]> {
    try {
      // 1. Fetch current school settings
      const settings = await schoolSettingsService.getSettings();
      if (!settings) {
        throw new Error("Pengaturan sekolah tidak ditemukan. Harap konfigurasi pengaturan sekolah terlebih dahulu.");
      }

      // 1b. Fetch active school agendas
      const agendasQuery = query(collection(db, "school_agendas"), where("active", "==", true));
      const agendasSnap = await getDocs(agendasQuery);
      const activeAgendas: any[] = [];
      agendasSnap.forEach(d => {
        activeAgendas.push({ id: d.id, ...d.data() });
      });

      // 2. Fetch existing lesson periods to delete
      const existingSnapshot = await getDocs(collection(db, COLLECTION_NAME));
      const existingDocs = existingSnapshot.docs;

      // 3. Delete existing periods in batches (max 400 per batch)
      const deleteChunks: typeof existingDocs[] = [];
      for (let i = 0; i < existingDocs.length; i += 400) {
        deleteChunks.push(existingDocs.slice(i, i + 400));
      }

      for (const chunk of deleteChunks) {
        const batch = writeBatch(db);
        chunk.forEach((d) => {
          batch.delete(d.ref);
        });
        await batch.commit();
      }

      // Determine if this is a "Generate" (empty before) or "Regenerate" (had entries before) action
      const actionName = existingDocs.length === 0 ? "GENERATE_LESSON_PERIOD" : "REGENERATE_LESSON_PERIOD";
      const actionDesc = existingDocs.length === 0 
        ? `Membuat (Generate) struktur Lesson Period baru berdasarkan pengaturan sekolah.` 
        : `Membuat ulang (Regenerate) struktur Lesson Period baru dan menghapus ${existingDocs.length} data lama.`;

      // 4. Generate new periods per active day
      const generatedPeriods: LessonPeriod[] = [];
      const generatedAtISO = new Date().toISOString();

      for (const day of settings.activeDays) {
        // Map active agendas for this day to RoutineActivity
        const dayAgendas = activeAgendas.filter(a => a.day.toLowerCase() === day.toLowerCase());
        const mappedAgendas: RoutineActivity[] = dayAgendas.map(a => ({
          id: a.id || `agenda-${Date.now()}`,
          name: a.name,
          enabled: a.active,
          days: [a.day],
          startTime: a.startTime,
          duration: a.duration || 10,
          autoEndTime: a.endTime,
          priority: 3,
          description: a.notes,
          agendaType: a.agendaType
        }));

        const mergedSettings: SchoolSettings = {
          ...settings,
          routineActivities: [
            ...(settings.routineActivities || []),
            ...mappedAgendas
          ]
        };

        // Generate schedule blocks for this day using the core calculation engine
        const blocks = generateDailySchedule(mergedSettings, day);
        
        // Filter blocks for ROUTINE, LESSON, BREAK and assign sequences
        let currentSeq = 1;
        for (const block of blocks) {
          let type: LessonPeriodType | null = null;
          
          if (block.type === "assembly" || block.type === "special") {
            type = LessonPeriodType.ROUTINE;
          } else if (block.type === "jp") {
            type = LessonPeriodType.LESSON;
          } else if (block.type === "break") {
            type = LessonPeriodType.BREAK;
          }

          if (type) {
            const periodCode = `${day.substring(0, 3).toUpperCase()}-${type}-${currentSeq}`;
            const period: LessonPeriod = {
              day,
              sequence: currentSeq,
              periodCode,
              type,
              title: block.name,
              startTime: block.start,
              endTime: block.end,
              duration: block.duration,
              instructional: type === LessonPeriodType.LESSON,
              generatedAt: generatedAtISO
            };
            generatedPeriods.push(period);
            currentSeq++;
          }
        }
      }

      // 5. Save new periods in batches
      const writeChunks: LessonPeriod[][] = [];
      for (let i = 0; i < generatedPeriods.length; i += 400) {
        writeChunks.push(generatedPeriods.slice(i, i + 400));
      }

      for (const chunk of writeChunks) {
        const batch = writeBatch(db);
        chunk.forEach((period) => {
          const docRef = doc(collection(db, COLLECTION_NAME));
          batch.set(docRef, period);
        });
        await batch.commit();
      }

      // 6. Log the activity
      await logLessonPeriodActivity(operatorId, operatorName, actionName, actionDesc);

      // Return the newly sorted list
      return generatedPeriods;
    } catch (error) {
      return handleFirestoreError(error, OperationType.WRITE, COLLECTION_NAME);
    }
  },

  // 7. Perform in-place sync for Lesson Periods without breaking references in schedules
  async syncLessonPeriods(
    operatorId: string,
    operatorName: string
  ): Promise<LessonPeriod[]> {
    try {
      // 1. Fetch current settings
      const settings = await schoolSettingsService.getSettings();
      if (!settings) {
        return [];
      }

      // 2. Fetch active school agendas
      const agendasQuery = query(collection(db, "school_agendas"), where("active", "==", true));
      const agendasSnap = await getDocs(agendasQuery);
      const activeAgendas: any[] = [];
      agendasSnap.forEach(d => {
        activeAgendas.push({ id: d.id, ...d.data() });
      });

      // 3. Fetch existing lesson periods
      const existingSnapshot = await getDocs(collection(db, COLLECTION_NAME));
      const existingPeriods: LessonPeriod[] = [];
      existingSnapshot.forEach((docSnap) => {
        existingPeriods.push({
          id: docSnap.id,
          ...docSnap.data()
        } as LessonPeriod);
      });

      // 4. Generate new periods per active day
      const generatedPeriods: LessonPeriod[] = [];
      const generatedAtISO = new Date().toISOString();

      for (const day of settings.activeDays) {
        // Map active agendas for this day to RoutineActivity
        const dayAgendas = activeAgendas.filter(a => a.day.toLowerCase() === day.toLowerCase());
        const mappedAgendas: RoutineActivity[] = dayAgendas.map(a => ({
          id: a.id || `agenda-${Date.now()}`,
          name: a.name,
          enabled: a.active,
          days: [a.day],
          startTime: a.startTime,
          duration: a.duration || 10,
          autoEndTime: a.endTime,
          priority: 3,
          description: a.notes,
          agendaType: a.agendaType
        }));

        const mergedSettings: SchoolSettings = {
          ...settings,
          routineActivities: [
            ...(settings.routineActivities || []),
            ...mappedAgendas
          ]
        };

        const blocks = generateDailySchedule(mergedSettings, day);
        
        let currentSeq = 1;
        for (const block of blocks) {
          let type: LessonPeriodType | null = null;
          
          if (block.type === "assembly" || block.type === "special") {
            type = LessonPeriodType.ROUTINE;
          } else if (block.type === "jp") {
            type = LessonPeriodType.LESSON;
          } else if (block.type === "break") {
            type = LessonPeriodType.BREAK;
          }

          if (type) {
            const periodCode = `${day.substring(0, 3).toUpperCase()}-${type}-${currentSeq}`;
            const period: LessonPeriod = {
              day,
              sequence: currentSeq,
              periodCode,
              type,
              title: block.name,
              startTime: block.start,
              endTime: block.end,
              duration: block.duration,
              instructional: type === LessonPeriodType.LESSON,
              generatedAt: generatedAtISO
            };
            generatedPeriods.push(period);
            currentSeq++;
          }
        }
      }

      // 5. Sync in-place using batch operations
      const batch = writeBatch(db);
      
      // Group existing and generated by day to keep matching sequences stable
      const DAYS_LIST = ["Sabtu", "Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat"];
      for (const day of DAYS_LIST) {
        const dayExisting = existingPeriods
          .filter(p => p.day.toLowerCase() === day.toLowerCase())
          .sort((a, b) => a.sequence - b.sequence);
        const dayGenerated = generatedPeriods
          .filter(p => p.day.toLowerCase() === day.toLowerCase())
          .sort((a, b) => a.sequence - b.sequence);

        const minLen = Math.min(dayExisting.length, dayGenerated.length);

        // Update overlapping records
        for (let i = 0; i < minLen; i++) {
          const exist = dayExisting[i];
          const gen = dayGenerated[i];
          const docRef = doc(db, COLLECTION_NAME, exist.id!);
          batch.set(docRef, {
            ...gen,
            id: exist.id // keep the same ID!
          });
          gen.id = exist.id; // update local in-memory object ID
        }

        // Add extra generated records
        if (dayGenerated.length > dayExisting.length) {
          for (let i = minLen; i < dayGenerated.length; i++) {
            const gen = dayGenerated[i];
            const newDocRef = doc(collection(db, COLLECTION_NAME));
            batch.set(newDocRef, gen);
            gen.id = newDocRef.id;
          }
        }

        // Delete remaining existing records
        if (dayExisting.length > dayGenerated.length) {
          for (let i = minLen; i < dayExisting.length; i++) {
            const exist = dayExisting[i];
            const docRef = doc(db, COLLECTION_NAME, exist.id!);
            batch.delete(docRef);
          }
        }
      }

      await batch.commit();
      await logLessonPeriodActivity(operatorId, operatorName, "SYNC_LESSON_PERIODS", "Sinkronisasi otomatis Lesson Periods setelah penyesuaian Agenda.");

      return generatedPeriods;
    } catch (error) {
      console.error("In-place sync failed:", error);
      return [];
    }
  }
};
