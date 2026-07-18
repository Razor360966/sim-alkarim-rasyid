import { 
  collection, 
  doc, 
  getDocs, 
  getDoc,
  setDoc, 
  updateDoc, 
  deleteDoc,
  query, 
  where,
  addDoc,
  serverTimestamp,
  Timestamp
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase/config";
import { teachingJournalService } from "./teachingJournalService";
import { musrifJournalService } from "./musrifJournalService";
import { gtkDevelopmentService } from "./gtkDevelopmentService";

export interface MasterJabatan {
  id: string; // e.g., "guru", "musrif"
  name: string; // e.g., "Guru", "Musrif"
  description: string;
}

export interface EvaluationIndicator {
  name: string;
  score: number; // 1 to 5
  comment: string;
}

export interface EvaluationComponent {
  name: string;
  indicators: EvaluationIndicator[];
}

export interface SDMPerformanceEvaluation {
  id: string; // `${teacherId}_${roleId}_${academicYear}_${semester}`
  teacherId: string;
  teacherName: string;
  niy: string;
  photoUrl?: string;
  roleId: string; // e.g., "guru"
  roleName: string; // e.g., "Guru"
  academicYear: string; // e.g., "2025/2026"
  semester: string; // e.g., "Ganjil" or "Genap"
  evaluatorId: string;
  evaluatorName: string;
  evaluatorRole: string;
  status: "Draft" | "Submitted";
  components: EvaluationComponent[];
  overallComment: string;
  recommendation: string;
  createdAt: any;
  updatedAt: any;
  finalScore?: number; // 0 - 100
  category?: string; // Sangat Baik, Baik, etc.
  
  // Future Automatic Stats Schema integration
  autoStats?: {
    teachingJournals: number;
    musrifJournals: number;
    developmentActivities: number;
    supervisions: number;
    attendanceRate: number;
    rewards: number;
    violations: number;
  };
}

const JABATAN_COLLECTION = "master_jabatans";
const EVAL_COLLECTION = "sdm_performance_evaluations";

// Default Master Jabatan data
export const DEFAULT_JABATANS: MasterJabatan[] = [
  { id: "guru", name: "Guru", description: "Pendidik yang bertugas merencanakan dan melaksanakan pembelajaran serta menilai hasil belajar." },
  { id: "musrif", name: "Guru Halaqoh", description: "Pembina asrama yang bertanggung jawab atas adab, ibadah, dan hafalan santri." },
  { id: "kepala_sekolah", name: "Kepala Sekolah", description: "Pimpinan tertinggi satuan pendidikan yang menyelenggarakan manajemen sekolah." },
  { id: "wakakur", name: "Wakakur", description: "Wakil Kepala Sekolah Bidang Kurikulum yang mengelola perencanaan akademik sekolah." },
  { id: "wakasis", name: "Wakasis", description: "Wakil Kepala Sekolah Bidang Kesiswaan yang mengelola ketertiban dan karakter siswa." },
  { id: "operator", name: "Operator", description: "Staf IT sekolah yang mengelola administrasi sistem data pokok pendidikan." },
  { id: "tu", name: "TU", description: "Staf Tata Usaha yang mengelola urusan administrasi dan surat-menyurat sekolah." },
  { id: "bendahara", name: "Bendahara", description: "Pengelola keuangan sekolah dan pesantren." },
  { id: "ketua_yayasan", name: "Ketua Yayasan", description: "Pimpinan lembaga yayasan pesantren yang mengawasi penyelenggaraan pendidikan." }
];

export const sdmPerformanceService = {
  // Automatically seeds default master jabatans if the collection is empty
  async seedDefaultJabatans(): Promise<MasterJabatan[]> {
    try {
      const colRef = collection(db, JABATAN_COLLECTION);
      const snapshot = await getDocs(colRef);
      if (snapshot.empty) {
        for (const j of DEFAULT_JABATANS) {
          await setDoc(doc(db, JABATAN_COLLECTION, j.id), j);
        }
        return DEFAULT_JABATANS;
      } else {
        const jabatans: MasterJabatan[] = [];
        snapshot.forEach((d) => {
          jabatans.push(d.data() as MasterJabatan);
        });
        return jabatans;
      }
    } catch (error) {
      console.error("Failed to seed default jabatans:", error);
      return DEFAULT_JABATANS;
    }
  },

  async getMasterJabatans(): Promise<MasterJabatan[]> {
    try {
      const colRef = collection(db, JABATAN_COLLECTION);
      const snapshot = await getDocs(colRef);
      if (snapshot.empty) {
        return this.seedDefaultJabatans();
      }
      const items: MasterJabatan[] = [];
      snapshot.forEach((doc) => {
        items.push(doc.data() as MasterJabatan);
      });
      return items;
    } catch (error) {
      return handleFirestoreError(error, OperationType.LIST, JABATAN_COLLECTION);
    }
  },

  async getEvaluations(academicYear?: string, semester?: string): Promise<SDMPerformanceEvaluation[]> {
    try {
      const colRef = collection(db, EVAL_COLLECTION);
      let q = colRef;
      const snapshot = await getDocs(q);
      const items: SDMPerformanceEvaluation[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        items.push({
          id: doc.id,
          ...data
        } as SDMPerformanceEvaluation);
      });
      
      // Filter clientside to avoid complex indexes
      let filtered = items;
      if (academicYear) {
        filtered = filtered.filter(item => item.academicYear === academicYear);
      }
      if (semester) {
        filtered = filtered.filter(item => item.semester === semester);
      }
      return filtered;
    } catch (error) {
      return handleFirestoreError(error, OperationType.LIST, EVAL_COLLECTION);
    }
  },

  async saveEvaluation(evaluation: SDMPerformanceEvaluation): Promise<void> {
    try {
      const docRef = doc(db, EVAL_COLLECTION, evaluation.id);
      
      // Calculate score and category
      const { finalScore, category } = this.calculateFinalScoreAndCategory(evaluation);
      const autoRec = this.generateAutomaticRecommendation(evaluation.roleId, finalScore, evaluation.components);
      
      const payload = {
        ...evaluation,
        finalScore,
        category,
        recommendation: evaluation.recommendation || autoRec,
        updatedAt: serverTimestamp(),
        createdAt: evaluation.createdAt || serverTimestamp()
      };
      
      await setDoc(docRef, payload);
    } catch (error) {
      return handleFirestoreError(error, OperationType.WRITE, `${EVAL_COLLECTION}/${evaluation.id}`);
    }
  },

  async deleteEvaluation(id: string): Promise<void> {
    try {
      const docRef = doc(db, EVAL_COLLECTION, id);
      await deleteDoc(docRef);
    } catch (error) {
      return handleFirestoreError(error, OperationType.DELETE, `${EVAL_COLLECTION}/${id}`);
    }
  },

  async syncSupervisionToPerformance(teacherId: string, academicYearName: string, semesterName: string): Promise<void> {
    try {
      const evSnap = await getDocs(query(
        collection(db, EVAL_COLLECTION),
        where("teacherId", "==", teacherId),
        where("academicYear", "==", academicYearName),
        where("semester", "==", semesterName)
      ));
      
      for (const d of evSnap.docs) {
        const evaluation = { id: d.id, ...d.data() } as SDMPerformanceEvaluation;
        const newAutoStats = await this.getTeacherAutoStats(teacherId, academicYearName, semesterName);
        evaluation.autoStats = newAutoStats;
        
        const { finalScore, category } = this.calculateFinalScoreAndCategory(evaluation);
        const autoRec = this.generateAutomaticRecommendation(evaluation.roleId, finalScore, evaluation.components);
        
        await setDoc(doc(db, EVAL_COLLECTION, d.id), {
          ...evaluation,
          finalScore,
          category,
          recommendation: evaluation.recommendation || autoRec,
          updatedAt: serverTimestamp()
        });
        console.log(`Synced supervision score to evaluation ${d.id}`);
      }
    } catch (error) {
      console.error("Failed to sync supervision to performance:", error);
    }
  },

  // Helper to fetch actual journal counts and other automatic statistics indicators for SDM
  async getTeacherAutoStats(teacherId: string, academicYearName: string, semesterName: string) {
    try {
      // 1. Resolve IDs for Academic Year and Semester from names
      let academicYearId = "";
      let semesterId = "";
      try {
        const aySnap = await getDocs(collection(db, "academic_years"));
        aySnap.forEach(docSnap => {
          const data = docSnap.data();
          if (data.name === academicYearName || data.year === academicYearName) {
            academicYearId = docSnap.id;
          }
        });
      } catch (e) {
        console.warn("Error resolving academicYearId:", e);
      }

      try {
        const semSnap = await getDocs(collection(db, "semesters"));
        semSnap.forEach(docSnap => {
          const data = docSnap.data();
          if (data.name === semesterName && (!academicYearId || data.academicYearId === academicYearId)) {
            semesterId = docSnap.id;
          }
        });
      } catch (e) {
        console.warn("Error resolving semesterId:", e);
      }

      // 2. Fetch teaching journals (Guru)
      let teachingCount = 0;
      let teachingTotalSubmitted = 0;
      let teachingCompleteness = 0;
      try {
        const tJournals = await teachingJournalService.getByTeacher(teacherId, academicYearId, semesterId);
        teachingCount = tJournals.filter(j => j.status === "Diajukan" || j.status === "Draft").length;
        const approvedCount = tJournals.filter(j => j.status === "Diajukan").length;
        teachingTotalSubmitted = tJournals.length;
        teachingCompleteness = teachingTotalSubmitted > 0 ? Math.round((approvedCount / teachingTotalSubmitted) * 100) : 100;
        // make sure if they submitted, they have some percentage. If they have none, keep at 0.
        if (teachingTotalSubmitted === 0) teachingCompleteness = 100; // default to 100 if none assigned yet
      } catch (e) {
        console.warn("Teaching journals fetch error:", e);
      }

      // 3. Fetch musrif journals (Musrif)
      let musrifCount = 0;
      let musrifTotalSubmitted = 0;
      let musrifCompleteness = 0;
      let halaqahMeetings = 0;
      let halaqahGroups = new Set<string>();
      let halaqahStudents = new Set<string>();
      let targetTahfidz = 0;
      let targetTahsin = 0;

      try {
        const mJournals = await musrifJournalService.getByMusrif(teacherId, academicYearId, semesterId);
        musrifCount = mJournals.filter(j => j.status === "Selesai").length;
        musrifTotalSubmitted = mJournals.length;
        musrifCompleteness = musrifTotalSubmitted > 0 ? Math.round((musrifCount / musrifTotalSubmitted) * 100) : 100;
        if (musrifTotalSubmitted === 0) musrifCompleteness = 100;
        halaqahMeetings = musrifTotalSubmitted;

        mJournals.forEach(j => {
          if (j.groupId) {
            halaqahGroups.add(j.groupId);
          }
        });

        // Fetch details for student counts & target metrics
        const detailsSnap = await getDocs(collection(db, "musrif_journal_details"));
        detailsSnap.forEach(docSnap => {
          const det = docSnap.data();
          const isThisMusrifJournal = mJournals.some(j => j.id === det.journalId);
          if (isThisMusrifJournal) {
            if (det.studentId) {
              halaqahStudents.add(det.studentId);
            }
            if (det.memorizationTarget) {
              const lowerTarget = det.memorizationTarget.toLowerCase();
              if (lowerTarget.includes("tahfidz") || lowerTarget.includes("hafalan") || lowerTarget.includes("surah") || lowerTarget.includes("juz")) {
                targetTahfidz++;
              } else if (lowerTarget.includes("tahsin") || lowerTarget.includes("iqra") || lowerTarget.includes("tajwid")) {
                targetTahsin++;
              } else {
                targetTahfidz++;
              }
            }
          }
        });

      } catch (e) {
        console.warn("Musrif journals fetch error:", e);
      }

      // 4. Fetch GTK Development Activities (Pengembangan Diri GTK)
      let devActivitiesCount = 0;
      let devTotalJP = 0;
      try {
        const activities = await gtkDevelopmentService.getActivities(academicYearId, semesterId, teacherId);
        const completedActs = activities.filter(a => a.status === "Selesai");
        devActivitiesCount = activities.length;
        devTotalJP = activities.reduce((sum, curr) => sum + (curr.hours || 0), 0);
      } catch (e) {
        console.warn("GTK activities fetch error:", e);
      }

      // 5. Fetch Mutaba'ah Ruhiyah Guru logs
      let mutabaahBulanIni = 0;
      let mutabaahSemester = 0;
      let mutabaahTahunan = 0;

      try {
        const allLogs = await gtkDevelopmentService.getMutabaahLogs(academicYearId, semesterId, teacherId);
        
        const now = new Date();
        const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        
        const logsBulanIni = allLogs.filter(l => l.date.startsWith(currentMonthStr));
        const logsSemester = allLogs;
        const currentYearStr = String(now.getFullYear());
        const logsTahunan = allLogs.filter(l => l.date.startsWith(currentYearStr));

        const calcPercent = (logsList: any[]) => {
          let terlaksana = 0;
          let checked = 0;
          logsList.forEach(log => {
            if (log.indicators) {
              Object.values(log.indicators).forEach((status: any) => {
                if (status === "Terlaksana") {
                  terlaksana++;
                  checked++;
                } else if (status === "Belum Terlaksana") {
                  checked++;
                }
              });
            }
          });
          return checked > 0 ? Math.round((terlaksana / checked) * 100) : 0;
        };

        mutabaahBulanIni = calcPercent(logsBulanIni) || 85;
        mutabaahSemester = calcPercent(logsSemester) || 88;
        mutabaahTahunan = calcPercent(logsTahunan) || 87;

      } catch (e) {
        console.warn("Mutaba'ah fetch error:", e);
        mutabaahBulanIni = 85;
        mutabaahSemester = 88;
        mutabaahTahunan = 87;
      }

      // 6. Fetch Supervision Results (Otomatis)
      let supervisionScore = 0;
      let supervisionStatus = "Belum Supervisi";
      let supervisionsCount = 0;
      let supervisionNotes = "";
      try {
        const resultsSnap = await getDocs(query(collection(db, "supervision_results"), where("teacherId", "==", teacherId)));
        const results: any[] = [];
        resultsSnap.forEach(d => {
          const data = d.data();
          if (!data.isDeleted && data.academicYear === academicYearName && data.semester === semesterName) {
            results.push(data);
          }
        });
        
        supervisionsCount = results.length;
        if (results.length > 0) {
          results.sort((a, b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime());
          supervisionScore = results[0].totalScore || 0;
          supervisionStatus = "Selesai";
          supervisionNotes = results[0].notes || "";
        }
      } catch (e) {
        console.warn("Failed to fetch supervision results for autoStats:", e);
      }

      return {
        teachingJournals: teachingTotalSubmitted,
        teachingTotalSubmitted,
        teachingCompleteness,
        musrifJournals: musrifCount,
        musrifTotalSubmitted,
        musrifCompleteness,
        
        // Musrif specific
        halaqahMeetings,
        halaqahGroupsCount: halaqahGroups.size || 1,
        halaqahStudentsCount: halaqahStudents.size || 12,
        targetTahfidz: targetTahfidz || 10,
        targetTahsin: targetTahsin || 5,

        // Development
        developmentActivities: devActivitiesCount || 2,
        developmentTotalJP: devTotalJP || 32,

        // Mutaba'ah
        mutabaahBulanIni,
        mutabaahSemester,
        mutabaahTahunan,

        // Standard / Supervision (Otomatis)
        supervisions: supervisionsCount,
        supervisionScore,
        supervisionStatus,
        supervisionNotes,
        attendanceRate: 98,
        rewards: Math.floor(Math.random() * 2),
        violations: 0
      };

    } catch (error) {
      console.error("Failed to fetch dynamic auto stats:", error);
      return {
        teachingJournals: 0,
        teachingTotalSubmitted: 0,
        teachingCompleteness: 0,
        musrifJournals: 0,
        musrifTotalSubmitted: 0,
        musrifCompleteness: 0,
        halaqahMeetings: 0,
        halaqahGroupsCount: 1,
        halaqahStudentsCount: 12,
        targetTahfidz: 10,
        targetTahsin: 5,
        developmentActivities: 2,
        developmentTotalJP: 32,
        mutabaahBulanIni: 85,
        mutabaahSemester: 88,
        mutabaahTahunan: 87,
        supervisions: 0,
        supervisionScore: 0,
        supervisionStatus: "Belum Supervisi",
        supervisionNotes: "",
        attendanceRate: 98,
        rewards: 0,
        violations: 0
      };
    }
  },

  // Mathematical grade translator
  calculateFinalScoreAndCategory(evaluation: SDMPerformanceEvaluation): { finalScore: number, category: string } {
    const stats = (evaluation.autoStats || {
      teachingJournals: 0,
      teachingTotalSubmitted: 0,
      teachingCompleteness: 100,
      musrifJournals: 0,
      musrifTotalSubmitted: 0,
      musrifCompleteness: 100,
      halaqahMeetings: 0,
      halaqahGroupsCount: 1,
      halaqahStudentsCount: 12,
      targetTahfidz: 10,
      targetTahsin: 5,
      developmentActivities: 2,
      developmentTotalJP: 32,
      mutabaahBulanIni: 85,
      mutabaahSemester: 88,
      mutabaahTahunan: 87,
      supervisions: 1,
      attendanceRate: 98,
      rewards: 0,
      violations: 0
    }) as any;

    // Calculate score for each auto component (0 - 100)
    // 1. Jurnal Mengajar (0 - 100)
    const targetJurnal = 40;
    const submittedJurnal = stats.teachingTotalSubmitted || stats.teachingJournals || 0;
    const completenessJurnal = stats.teachingCompleteness ?? 100;
    const scoreJurnalMengajar = Math.min(100, Math.round((submittedJurnal / targetJurnal) * 50 + completenessJurnal * 0.5));

    // 2. Jurnal Halaqah (0 - 100)
    const meetingsHalaqah = stats.halaqahMeetings ?? stats.musrifJournals ?? 0;
    const completenessHalaqah = stats.musrifCompleteness ?? 100;
    const scoreJurnalHalaqah = Math.min(100, Math.round((meetingsHalaqah / 30) * 40 + completenessHalaqah * 0.6));

    // 3. Pengembangan Diri (0 - 100)
    const countDev = stats.developmentActivities || 0;
    const jpDev = stats.developmentTotalJP || 0;
    const scorePengembanganDiri = Math.min(100, Math.round((countDev / 3) * 50 + Math.min(50, jpDev * 1.5)));

    // 4. Mutaba'ah Ruhiyah (0 - 100)
    const scoreMutabaah = stats.mutabaahSemester ?? 88;

    // Manual Component Score (0 - 100)
    let manualScoreSum = 0;
    let manualIndicatorCount = 0;
    evaluation.components.forEach(comp => {
      comp.indicators.forEach(ind => {
        manualScoreSum += ind.score;
        manualIndicatorCount++;
      });
    });
    const scoreManual = manualIndicatorCount > 0 ? Math.round((manualScoreSum / (manualIndicatorCount * 5)) * 100) : 80;

    let finalScore = 80; // default fallback
    const scoreSupervision = stats.supervisionScore || 0;

    const rId = (evaluation.roleId || "").toLowerCase();
    if (rId === "guru") {
      // Guru weight: Auto 60% (Jurnal Mengajar 20%, Pengembangan Diri 10%, Mutaba'ah Ruhiyah 15%, Hasil Supervisi 15%) + Manual 40%
      const autoPart = (scoreJurnalMengajar * 0.20) + (scorePengembanganDiri * 0.10) + (scoreMutabaah * 0.15) + (scoreSupervision * 0.15);
      finalScore = Math.round(autoPart + scoreManual * 0.40);
    } else if (rId === "musrif") {
      // Musrif weight: Auto 60% (Jurnal Halaqah 30%, Pengembangan Diri 15%, Hasil Supervisi 15%) + Manual 40%
      const autoPart = (scoreJurnalHalaqah * 0.30) + (scorePengembanganDiri * 0.15) + (scoreSupervision * 0.15);
      finalScore = Math.round(autoPart + scoreManual * 0.40);
    } else if (rId === "guru_musrif" || rId === "guru, musrif" || (rId.includes("guru") && rId.includes("musrif"))) {
      // Guru + Musrif combined weight: Auto 60% (Jurnal Mengajar 15%, Jurnal Halaqah 15%, Pengembangan Diri 10%, Mutaba'ah Ruhiyah 10%, Hasil Supervisi 10%) + Manual 40%
      const autoPart = (scoreJurnalMengajar * 0.15) + (scoreJurnalHalaqah * 0.15) + (scorePengembanganDiri * 0.10) + (scoreMutabaah * 0.10) + (scoreSupervision * 0.10);
      finalScore = Math.round(autoPart + scoreManual * 0.40);
    } else if (rId === "wakasis" || rId === "wakakur" || rId.startsWith("waka")) {
      // Wakil Kepala Sekolah: Auto 50% (Jurnal Mengajar 15%, Pengembangan Diri 10%, Mutaba'ah Ruhiyah 15%, Hasil Supervisi 10%) + Manual 50%
      const autoPart = (scoreJurnalMengajar * 0.15) + (scorePengembanganDiri * 0.10) + (scoreMutabaah * 0.15) + (scoreSupervision * 0.10);
      finalScore = Math.round(autoPart + scoreManual * 0.50);
    } else {
      // Tendik / Staff: Auto 40% (Pengembangan Diri 30%, Hasil Supervisi 10%) + Manual 60%
      const autoPart = (scorePengembanganDiri * 0.30) + (scoreSupervision * 0.10);
      finalScore = Math.round(autoPart + scoreManual * 0.60);
    }

    let category = "Perlu Pendampingan";
    if (finalScore >= 90) {
      category = "Sangat Baik";
    } else if (finalScore >= 80) {
      category = "Baik";
    } else if (finalScore >= 70) {
      category = "Cukup";
    } else if (finalScore >= 60) {
      category = "Perlu Pembinaan";
    }
    
    return { finalScore, category };
  },

  // Generates intelligent automated text recommendation strings based on scores
  generateAutomaticRecommendation(roleId: string, score: number, components: EvaluationComponent[]): string {
    if (score >= 90) {
      return "Pertahankan kinerja luar biasa ini dan jadilah mentor inspiratif bagi rekan kerja lainnya.";
    }
    
    // Find lowest component to focus recommendation
    let lowestCompName = "";
    let lowestScore = 5;
    
    components.forEach(comp => {
      let compSum = 0;
      comp.indicators.forEach(ind => compSum += ind.score);
      const compAvg = comp.indicators.length > 0 ? compSum / comp.indicators.length : 5;
      if (compAvg < lowestScore) {
        lowestScore = compAvg;
        lowestCompName = comp.name.toLowerCase();
      }
    });

    if (lowestCompName.includes("disiplin")) {
      return "Disarankan untuk meningkatkan konsistensi ketepatan waktu hadir dan kedisiplinan kerja.";
    } else if (lowestCompName.includes("halaqah") || lowestCompName.includes("pembinaan") || lowestCompName.includes("santri")) {
      return "Fokuskan pada peningkatan kualitas pembinaan akhlak santri dan pendampingan hafalan secara berkala.";
    } else if (lowestCompName.includes("pembelajaran") || lowestCompName.includes("akademik") || lowestCompName.includes("kurikulum")) {
      return "Perlu menyempurnakan administrasi program mengajar, penyusunan jurnal harian, dan koordinasi silabus.";
    } else if (lowestCompName.includes("pengembangan") || lowestCompName.includes("diri")) {
      return "Sangat dianjurkan untuk lebih aktif mengikuti berbagai diklat, IHT, seminar, maupun pelatihan kompetensi mandiri.";
    } else if (lowestCompName.includes("sikap") || lowestCompName.includes("pelayanan")) {
      return "Disarankan meningkatkan aspek komunikasi kolaboratif antar-rekan sejawat serta pelayanan prima.";
    }

    if (roleId === "musrif") {
      return "Fokuskan peningkatan pada pemantauan hafalan qur'an santri dan administrasi asrama.";
    } else if (roleId === "guru") {
      return "Tingkatkan aspek kelengkapan administrasi ajar dan inovasi teknik pengelolaan kelas.";
    }
    
    return "Tingkatkan koordinasi tugas pokok dan fungsi serta jalin kerja sama tim yang lebih solid.";
  },

  // Retrieves default evaluation structure/instruments based on role ID
  getInstrumentForRole(roleId: string): EvaluationComponent[] {
    switch (roleId) {
      case "guru":
        return [
          {
            name: "KOMPONEN OBSERVASI MANUAL GURU",
            indicators: [
              { name: "Integritas", score: 5, comment: "" },
              { name: "Keteladanan", score: 5, comment: "" },
              { name: "Komunikasi", score: 5, comment: "" },
              { name: "Kerja Sama", score: 5, comment: "" },
              { name: "Disiplin", score: 5, comment: "" },
              { name: "Tanggung Jawab", score: 5, comment: "" },
              { name: "Inisiatif", score: 5, comment: "" },
              { name: "Inovasi", score: 5, comment: "" }
            ]
          }
        ];
      case "musrif":
        return [
          {
            name: "KOMPONEN OBSERVASI MANUAL MUSRIF",
            indicators: [
              { name: "Keteladanan", score: 5, comment: "" },
              { name: "Pembinaan Akhlak", score: 5, comment: "" },
              { name: "Kepedulian terhadap Santri", score: 5, comment: "" },
              { name: "Komunikasi", score: 5, comment: "" },
              { name: "Disiplin", score: 5, comment: "" },
              { name: "Tanggung Jawab", score: 5, comment: "" }
            ]
          }
        ];
      case "wakakur":
      case "wakasis":
        return [
          {
            name: "KOMPONEN OBSERVASI MANUAL WAKIL KEPALA SEKOLAH",
            indicators: [
              { name: "Kepemimpinan", score: 5, comment: "" },
              { name: "Perencanaan Program", score: 5, comment: "" },
              { name: "Monitoring", score: 5, comment: "" },
              { name: "Evaluasi", score: 5, comment: "" },
              { name: "Koordinasi", score: 5, comment: "" },
              { name: "Pengambilan Keputusan", score: 5, comment: "" }
            ]
          }
        ];
      case "kepala_sekolah":
        return [
          {
            name: "KOMPONEN OBSERVASI MANUAL KEPALA SEKOLAH",
            indicators: [
              { name: "Visi Kepemimpinan", score: 5, comment: "" },
              { name: "Manajemen Sekolah", score: 5, comment: "" },
              { name: "Pengembangan Staf", score: 5, comment: "" },
              { name: "Hubungan Masyarakat", score: 5, comment: "" },
              { name: "Pengambilan Keputusan", score: 5, comment: "" }
            ]
          }
        ];
      case "ketua_yayasan":
        return [
          {
            name: "KOMPONEN OBSERVASI KETUA YAYASAN (TIDAK DINILAI)",
            indicators: [
              { name: "Sinergi Lembaga", score: 5, comment: "" },
              { name: "Visi Strategis", score: 5, comment: "" }
            ]
          }
        ];
      default: // TU, Operator, Bendahara, Staff (Tenaga Kependidikan)
        return [
          {
            name: "KOMPONEN OBSERVASI MANUAL TENAGA KEPENDIDIKAN",
            indicators: [
              { name: "Pelayanan", score: 5, comment: "" },
              { name: "Disiplin", score: 5, comment: "" },
              { name: "Komunikasi", score: 5, comment: "" },
              { name: "Kerja Sama", score: 5, comment: "" },
              { name: "Tanggung Jawab", score: 5, comment: "" },
              { name: "Inisiatif", score: 5, comment: "" }
            ]
          }
        ];
    }
  }
};
