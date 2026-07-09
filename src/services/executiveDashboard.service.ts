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
      // 1. Violations Seeding
      const violSnapshot = await getDocs(collection(db, VIOLATIONS_COL));
      if (violSnapshot.empty) {
        console.log("Seeding initial student violations...");
        const initialViolations: Omit<StudentViolation, "id" | "createdAt">[] = [
          {
            studentId: "std-01",
            studentName: "Muhammad Al-Fatih",
            className: "Kelas 7A",
            violationType: "Ringan",
            description: "Terlambat memasuki halaqah subuh selama 15 menit tanpa keterangan",
            points: 5,
            date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
          },
          {
            studentId: "std-02",
            studentName: "Zaid Bin Haritsah",
            className: "Kelas 7A",
            violationType: "Sedang",
            description: "Membawa barang elektronik (MP3 Player) yang dilarang di lingkungan pondok",
            points: 15,
            date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
          },
          {
            studentId: "std-03",
            studentName: "Usamah Bin Zaid",
            className: "Kelas 7A",
            violationType: "Ringan",
            description: "Tidak memakai kopiah dan pakaian rapi saat makan siang di kantin",
            points: 2,
            date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
          }
        ];
        for (const v of initialViolations) {
          await this.addViolation(v);
        }
      }

      // 2. Rewards Seeding
      const rewSnapshot = await getDocs(collection(db, REWARDS_COL));
      if (rewSnapshot.empty) {
        console.log("Seeding initial student rewards...");
        const initialRewards: Omit<StudentReward, "id" | "createdAt">[] = [
          {
            studentId: "std-01",
            studentName: "Muhammad Al-Fatih",
            className: "Kelas 7A",
            rewardType: "Tahfidz",
            description: "Menyelesaikan hafalan Surah Al-Kahfi dengan tajwid sangat baik",
            points: 20,
            date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
          },
          {
            studentId: "std-04",
            studentName: "Abdurrahman Al-Khattab",
            className: "Kelas 7A",
            rewardType: "Akhlak",
            description: "Membantu membersihkan masjid raya pesantren di luar jadwal piket",
            points: 10,
            date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
          },
          {
            studentId: "std-05",
            studentName: "Hamzah Bin Abdul Muthalib",
            className: "Kelas 8A",
            rewardType: "Akademik",
            description: "Juara 1 Lomba Cepat Tepat Bahasa Arab tingkat kabupaten",
            points: 50,
            date: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
          }
        ];
        for (const r of initialRewards) {
          await this.addReward(r);
        }
      }

      // 3. Inventory Seeding
      const invSnapshot = await getDocs(collection(db, INVENTORY_COL));
      if (invSnapshot.empty) {
        console.log("Seeding initial inventory...");
        const initialInventory: Omit<SarprasInventory, "id" | "createdAt">[] = [
          {
            itemName: "Proyektor BenQ MX550",
            category: "Elektronik",
            quantity: 5,
            goodConditionCount: 4,
            damagedConditionCount: 1,
            location: "Ruang Guru & Kelas 7"
          },
          {
            itemName: "Meja Belajar Kayu Jati",
            category: "Mebel",
            quantity: 120,
            goodConditionCount: 112,
            damagedConditionCount: 8,
            location: "Seluruh Ruang Kelas"
          },
          {
            itemName: "Kitab Tafsir Jalalain",
            category: "Kitab",
            quantity: 80,
            goodConditionCount: 80,
            damagedConditionCount: 0,
            location: "Perpustakaan & Asrama"
          },
          {
            itemName: "Air Conditioning (AC) Daikin 1 PK",
            category: "Elektronik",
            quantity: 8,
            goodConditionCount: 6,
            damagedConditionCount: 2,
            location: "Asrama Guru & Masjid"
          },
          {
            itemName: "Sajadah Tebal Turki",
            category: "Fasilitas",
            quantity: 150,
            goodConditionCount: 145,
            damagedConditionCount: 5,
            location: "Masjid Al-Karim"
          }
        ];
        for (const i of initialInventory) {
          await this.addInventory(i);
        }
      }

      // 4. Maintenance Seeding
      const maintSnapshot = await getDocs(collection(db, MAINTENANCE_COL));
      if (maintSnapshot.empty) {
        console.log("Seeding initial maintenance...");
        const initialMaintenance: Omit<SarprasMaintenance, "id" | "createdAt">[] = [
          {
            itemName: "Air Conditioning (AC) Daikin 1 PK",
            reporterName: "Ustadz Mansur",
            issueDescription: "AC mengeluarkan suara bising dan tidak dingin di Kamar Asrama 3-B",
            status: "Sedang Diperbaiki",
            cost: 250000,
            date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
          },
          {
            itemName: "Proyektor BenQ MX550",
            reporterName: "Ustadzah Rasyidah",
            issueDescription: "Lampu indikator berkedip merah dan tidak memancarkan cahaya di Kelas 7A",
            status: "Dilaporkan",
            cost: 0,
            date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
          },
          {
            itemName: "Meja Belajar Kayu Jati",
            reporterName: "Ustadz Zulkifli",
            issueDescription: "Engsel pintu laci meja guru di Kelas 9B lepas",
            status: "Selesai",
            cost: 45000,
            date: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
          }
        ];
        for (const m of initialMaintenance) {
          await this.addMaintenance(m);
        }
      }
    } catch (e) {
      console.error("Error seeding initial dashboard data:", e);
    }
  }
};
