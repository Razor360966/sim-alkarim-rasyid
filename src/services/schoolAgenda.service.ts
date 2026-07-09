import { 
  collection, 
  doc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  serverTimestamp,
  query,
  where
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase/config";
import { SchoolAgenda } from "../types";
import { schoolSettingsService } from "./schoolSettings.service";
import { lessonPeriodService } from "./lessonPeriod.service";

const COLLECTION_NAME = "school_agendas";

export async function logAgendaActivity(
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
    console.error("Failed to write agenda activity log:", error);
  }
}

// Convert "HH:MM" to minutes since midnight
function timeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const parts = timeStr.split(":");
  if (parts.length < 2) return 0;
  const hours = parseInt(parts[0], 10) || 0;
  const minutes = parseInt(parts[1], 10) || 0;
  return hours * 60 + minutes;
}

export const schoolAgendaService = {
  // Get all agendas
  async getAgendas(): Promise<SchoolAgenda[]> {
    try {
      const q = query(collection(db, COLLECTION_NAME));
      const querySnapshot = await getDocs(q);
      const agendas: SchoolAgenda[] = [];
      
      querySnapshot.forEach((doc) => {
        agendas.push({
          id: doc.id,
          ...doc.data()
        } as SchoolAgenda);
      });
      
      return agendas;
    } catch (error) {
      return handleFirestoreError(error, OperationType.GET, COLLECTION_NAME);
    }
  },

  // Get active agendas
  async getActiveAgendas(): Promise<SchoolAgenda[]> {
    try {
      const q = query(collection(db, COLLECTION_NAME), where("active", "==", true));
      const querySnapshot = await getDocs(q);
      const agendas: SchoolAgenda[] = [];
      
      querySnapshot.forEach((doc) => {
        agendas.push({
          id: doc.id,
          ...doc.data()
        } as SchoolAgenda);
      });
      
      return agendas;
    } catch (error) {
      return handleFirestoreError(error, OperationType.GET, COLLECTION_NAME);
    }
  },

  // Validate an agenda against overlaps and school hours
  async validateAgenda(agenda: SchoolAgenda, currentAgendas: SchoolAgenda[]): Promise<void> {
    const startVal = timeToMinutes(agenda.startTime);
    const endVal = timeToMinutes(agenda.endTime);
    
    if (startVal >= endVal) {
      throw new Error("Jam Selesai harus setelah Jam Mulai!");
    }

    // 1. Validate against school hours
    const settings = await schoolSettingsService.getSettings();
    const schoolStartStr = settings.schoolHours?.startTime || settings.startTime || "07:00";
    const schoolEndStr = settings.schoolHours?.endTime || settings.endTime || "14:00";
    
    const schoolStart = timeToMinutes(schoolStartStr);
    const schoolEnd = timeToMinutes(schoolEndStr);
    
    if (startVal < schoolStart || endVal > schoolEnd) {
      throw new Error(`Agenda harus berada di dalam jam operasional sekolah (${schoolStartStr} - ${schoolEndStr})!`);
    }

    // 2. Validate against overlapping active agendas on the same day
    if (!agenda.active) return; // Inactive agendas don't overlap

    const sameDayActiveAgendas = currentAgendas.filter(a => 
      a.id !== agenda.id && 
      a.active && 
      a.day.toLowerCase() === agenda.day.toLowerCase()
    );

    for (const other of sameDayActiveAgendas) {
      const otherStart = timeToMinutes(other.startTime);
      const otherEnd = timeToMinutes(other.endTime);
      
      if (startVal < otherEnd && otherStart < endVal) {
        throw new Error(`Bentrok: Agenda '${agenda.name}' (${agenda.startTime} - ${agenda.endTime}) tumpang tindih dengan '${other.name}' (${other.startTime} - ${other.endTime}) pada hari ${agenda.day}.`);
      }
    }
  },

  // Add agenda
  async addAgenda(
    agenda: Omit<SchoolAgenda, "id">, 
    operatorId: string, 
    operatorName: string
  ): Promise<SchoolAgenda> {
    try {
      const currentAgendas = await this.getAgendas();
      const newAgenda: SchoolAgenda = {
        ...agenda,
        duration: timeToMinutes(agenda.endTime) - timeToMinutes(agenda.startTime)
      };

      await this.validateAgenda(newAgenda, currentAgendas);

      const docRef = await addDoc(collection(db, COLLECTION_NAME), {
        ...newAgenda,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      const savedAgenda = {
        id: docRef.id,
        ...newAgenda
      };

      // Sync Lesson Periods
      await lessonPeriodService.syncLessonPeriods(operatorId, operatorName);

      await logAgendaActivity(
        operatorId,
        operatorName,
        "ADD_AGENDA",
        `Menambahkan agenda rutin '${agenda.name}' pada hari ${agenda.day} pukul ${agenda.startTime} - ${agenda.endTime}.`
      );

      return savedAgenda;
    } catch (error: any) {
      if (error.message && !error.message.includes("Firestore")) {
        throw error;
      }
      return handleFirestoreError(error, OperationType.WRITE, COLLECTION_NAME);
    }
  },

  // Update agenda
  async updateAgenda(
    id: string, 
    agenda: Partial<SchoolAgenda>, 
    operatorId: string, 
    operatorName: string
  ): Promise<SchoolAgenda> {
    try {
      const currentAgendas = await this.getAgendas();
      const existing = currentAgendas.find(a => a.id === id);
      if (!existing) {
        throw new Error("Agenda tidak ditemukan!");
      }

      const merged: SchoolAgenda = {
        ...existing,
        ...agenda,
        id
      };
      
      merged.duration = timeToMinutes(merged.endTime) - timeToMinutes(merged.startTime);

      await this.validateAgenda(merged, currentAgendas);

      const docRef = doc(db, COLLECTION_NAME, id);
      await updateDoc(docRef, {
        name: merged.name,
        agendaType: merged.agendaType,
        day: merged.day,
        startTime: merged.startTime,
        endTime: merged.endTime,
        duration: merged.duration,
        active: merged.active,
        notes: merged.notes || null,
        updatedAt: new Date().toISOString()
      });

      // Sync Lesson Periods
      await lessonPeriodService.syncLessonPeriods(operatorId, operatorName);

      await logAgendaActivity(
        operatorId,
        operatorName,
        "UPDATE_AGENDA",
        `Memperbarui agenda rutin '${merged.name}' (${merged.active ? "Aktif" : "Nonaktif"}) pada hari ${merged.day} pukul ${merged.startTime} - ${merged.endTime}.`
      );

      return merged;
    } catch (error: any) {
      if (error.message && !error.message.includes("Firestore")) {
        throw error;
      }
      return handleFirestoreError(error, OperationType.WRITE, `${COLLECTION_NAME}/${id}`);
    }
  },

  // Delete agenda
  async deleteAgenda(
    id: string, 
    operatorId: string, 
    operatorName: string
  ): Promise<void> {
    try {
      const currentAgendas = await this.getAgendas();
      const existing = currentAgendas.find(a => a.id === id);
      if (!existing) {
        throw new Error("Agenda tidak ditemukan!");
      }

      const docRef = doc(db, COLLECTION_NAME, id);
      await deleteDoc(docRef);

      // Sync Lesson Periods
      await lessonPeriodService.syncLessonPeriods(operatorId, operatorName);

      await logAgendaActivity(
        operatorId,
        operatorName,
        "DELETE_AGENDA",
        `Menghapus agenda rutin '${existing.name}' pada hari ${existing.day}.`
      );
    } catch (error) {
      return handleFirestoreError(error, OperationType.DELETE, `${COLLECTION_NAME}/${id}`);
    }
  }
};
