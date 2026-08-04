import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  addDoc
} from "firebase/firestore";
import { db } from "../firebase/config";

import { adminComplianceEngineService } from "./adminComplianceEngine.service";

export interface StudentViolation {
  id: string;
  studentId: string;
  studentName: string;
  className: string;
  violationType: "Ringan" | "Sedang" | "Berat";
  description: string;
  points: number;
  date: string;
  createdAt: string;
}

export interface StudentReward {
  id: string;
  studentId: string;
  studentName: string;
  className: string;
  rewardType: "Akademik" | "Akhlak" | "Tahfidz";
  description: string;
  points: number;
  date: string;
  createdAt: string;
}

export interface SarprasInventory {
  id: string;
  itemName: string;
  category: "Elektronik" | "Mebel" | "Kitab" | "Fasilitas";
  quantity: number;
  goodConditionCount: number;
  damagedConditionCount: number;
  location: string;
  createdAt: string;
}

export interface SarprasMaintenance {
  id: string;
  itemName: string;
  reporterName: string;
  issueDescription: string;
  status: "Dilaporkan" | "Sedang Diperbaiki" | "Selesai";
  cost: number;
  date: string;
  createdAt: string;
}

const VIOLATIONS_COL = "student_violations";
const REWARDS_COL = "student_rewards";
const INVENTORY_COL = "sarpras_inventory";
const MAINTENANCE_COL = "sarpras_maintenance";

export const executiveDashboardService = {
  async getViolations(): Promise<StudentViolation[]> {
    try {
      const q = query(collection(db, VIOLATIONS_COL), orderBy("date", "desc"));
      const snapshot = await getDocs(q);
      const items: StudentViolation[] = [];
      snapshot.forEach((d) => {
        items.push({ id: d.id, ...d.data() } as StudentViolation);
      });
      return items;
    } catch (e) {
      console.error("Error fetching violations:", e);
      return [];
    }
  },

  async getRewards(): Promise<StudentReward[]> {
    try {
      const q = query(collection(db, REWARDS_COL), orderBy("date", "desc"));
      const snapshot = await getDocs(q);
      const items: StudentReward[] = [];
      snapshot.forEach((d) => {
        items.push({ id: d.id, ...d.data() } as StudentReward);
      });
      return items;
    } catch (e) {
      console.error("Error fetching rewards:", e);
      return [];
    }
  },

  async getInventory(): Promise<SarprasInventory[]> {
    try {
      const snapshot = await getDocs(collection(db, INVENTORY_COL));
      const items: SarprasInventory[] = [];
      snapshot.forEach((d) => {
        items.push({ id: d.id, ...d.data() } as SarprasInventory);
      });
      return items;
    } catch (e) {
      console.error("Error fetching inventory:", e);
      return [];
    }
  },

  async getMaintenance(): Promise<SarprasMaintenance[]> {
    try {
      const q = query(collection(db, MAINTENANCE_COL), orderBy("date", "desc"));
      const snapshot = await getDocs(q);
      const items: SarprasMaintenance[] = [];
      snapshot.forEach((d) => {
        items.push({ id: d.id, ...d.data() } as SarprasMaintenance);
      });
      return items;
    } catch (e) {
      console.error("Error fetching maintenance:", e);
      return [];
    }
  },

  async addViolation(data: Omit<StudentViolation, "id" | "createdAt">): Promise<StudentViolation> {
    const colRef = collection(db, VIOLATIONS_COL);
    const newDoc = doc(colRef);
    const item: StudentViolation = {
      id: newDoc.id,
      ...data,
      createdAt: new Date().toISOString()
    };
    await setDoc(newDoc, item);
    return item;
  },

  async addReward(data: Omit<StudentReward, "id" | "createdAt">): Promise<StudentReward> {
    const colRef = collection(db, REWARDS_COL);
    const newDoc = doc(colRef);
    const item: StudentReward = {
      id: newDoc.id,
      ...data,
      createdAt: new Date().toISOString()
    };
    await setDoc(newDoc, item);
    return item;
  },

  async addInventory(data: Omit<SarprasInventory, "id" | "createdAt">): Promise<SarprasInventory> {
    const colRef = collection(db, INVENTORY_COL);
    const newDoc = doc(colRef);
    const item: SarprasInventory = {
      id: newDoc.id,
      ...data,
      createdAt: new Date().toISOString()
    };
    await setDoc(newDoc, item);
    return item;
  },

  async addMaintenance(data: Omit<SarprasMaintenance, "id" | "createdAt">): Promise<SarprasMaintenance> {
    const colRef = collection(db, MAINTENANCE_COL);
    const newDoc = doc(colRef);
    const item: SarprasMaintenance = {
      id: newDoc.id,
      ...data,
      createdAt: new Date().toISOString()
    };
    await setDoc(newDoc, item);
    return item;
  },

  async updateMaintenanceStatus(
    id: string,
    status: "Dilaporkan" | "Sedang Diperbaiki" | "Selesai",
    cost?: number
  ): Promise<void> {
    const docRef = doc(db, MAINTENANCE_COL, id);
    const updates: any = { status };
    if (cost !== undefined) {
      updates.cost = cost;
    }
    await updateDoc(docRef, updates);
  },

  async deleteViolation(id: string): Promise<void> {
    await deleteDoc(doc(db, VIOLATIONS_COL, id));
  },

  async deleteReward(id: string): Promise<void> {
    await deleteDoc(doc(db, REWARDS_COL, id));
  },

  async deleteInventory(id: string): Promise<void> {
    await deleteDoc(doc(db, INVENTORY_COL, id));
  },

  async seedInitialDataIfEmpty(): Promise<void> {
    try {
      // Purge any dummy seeded records if present in student_violations
      const violSnapshot = await getDocs(collection(db, VIOLATIONS_COL));
      const dummyStudentIds = ["std-01", "std-02", "std-03", "std-04", "std-05"];
      for (const d of violSnapshot.docs) {
        const data = d.data();
        if (dummyStudentIds.includes(data.studentId) || data.studentName === "Muhammad Al-Fatih" || data.studentName === "Zaid Bin Haritsah" || data.studentName === "Usamah Bin Zaid") {
          await deleteDoc(doc(db, VIOLATIONS_COL, d.id));
        }
      }

      // Purge dummy student_rewards
      const rewSnapshot = await getDocs(collection(db, REWARDS_COL));
      for (const d of rewSnapshot.docs) {
        const data = d.data();
        if (dummyStudentIds.includes(data.studentId) || data.studentName === "Muhammad Al-Fatih" || data.studentName === "Abdurrahman Al-Khattab" || data.studentName === "Hamzah Bin Abdul Muthalib") {
          await deleteDoc(doc(db, REWARDS_COL, d.id));
        }
      }

      // Purge dummy sarpras_inventory
      const dummyInventoryNames = [
        "Proyektor BenQ MX550",
        "Meja Belajar Kayu Jati",
        "Kitab Tafsir Jalalain",
        "Air Conditioning (AC) Daikin 1 PK",
        "Sajadah Tebal Turki"
      ];
      const invSnapshot = await getDocs(collection(db, INVENTORY_COL));
      for (const d of invSnapshot.docs) {
        const data = d.data();
        if (dummyInventoryNames.includes(data.itemName)) {
          await deleteDoc(doc(db, INVENTORY_COL, d.id));
        }
      }

      // Purge dummy sarpras_maintenance
      const dummyReporters = ["Ustadz Mansur", "Ustadzah Rasyidah", "Ustadz Zulkifli"];
      const maintSnapshot = await getDocs(collection(db, MAINTENANCE_COL));
      for (const d of maintSnapshot.docs) {
        const data = d.data();
        if (dummyReporters.includes(data.reporterName) || dummyInventoryNames.includes(data.itemName)) {
          await deleteDoc(doc(db, MAINTENANCE_COL, d.id));
        }
      }
    } catch (e) {
      console.error("Error purging dummy dashboard data:", e);
    }
  },

  async getDistinctTeacherKpiSummary(filters: any = {}) {
    return adminComplianceEngineService.getDistinctTeacherKpiSummary(filters);
  }
};

export const getDistinctTeacherKpiSummary = (filters?: any) =>
  executiveDashboardService.getDistinctTeacherKpiSummary(filters);

