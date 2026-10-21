/**
 * midtermPrintSettings.service.ts
 * 
 * Pengaturan Cetak Rapor Tengah Semester (RTS) SIMAK SMP Alkarim Rasyid.
 * Mengelola KOP, Tanda Tangan Kepala Sekolah, Tanda Tangan Wali Kelas, dan Cap Sekolah.
 * Tersimpan persisten di Firestore: school_settings/midterm_print.
 */

import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase/config";
import { MidtermPrintSettings } from "../types/midtermReport.types";
import { APP_CONFIG } from "../config/appConfig";

const COLLECTION_NAME = "school_settings";
const DOCUMENT_ID = "midterm_print";

export const midtermPrintSettingsService = {
  /**
   * Mengambil pengaturan cetak RTS terkini dengan fallback ke SSOT identitas sekolah.
   */
  async getPrintSettings(): Promise<MidtermPrintSettings> {
    try {
      // 1. Ambil data SSOT dari school_settings/identity
      let ssotPrincipalName = APP_CONFIG.principalName || "H. Abdullah";
      let ssotPrincipalNipNiy = APP_CONFIG.principalNipNiy || "NIY. 202001001";
      let ssotSignatureUrl = APP_CONFIG.principalSignatureUrl || "";

      try {
        const idenSnap = await getDoc(doc(db, "school_settings", "identity"));
        if (idenSnap.exists()) {
          const idData = idenSnap.data();
          ssotPrincipalName = idData.principalName || idData.headmasterName || ssotPrincipalName;
          ssotPrincipalNipNiy = idData.principalNipNiy || ssotPrincipalNipNiy;
          ssotSignatureUrl = idData.principalSignatureUrl || idData.headmasterSignatureUrl || ssotSignatureUrl;
        }
      } catch (err) {
        console.warn("Could not read school_settings/identity in getPrintSettings:", err);
      }

      // 2. Ambil data spesifik RTS dari school_settings/midterm_print
      const docRef = doc(db, COLLECTION_NAME, DOCUMENT_ID);
      const snap = await getDoc(docRef);

      if (snap.exists()) {
        const data = snap.data();
        return {
          reportCity: data.reportCity !== undefined ? data.reportCity : (APP_CONFIG.regency || "Solok"),
          reportDate: data.reportDate !== undefined ? data.reportDate : "",
          schoolLogoUrl: data.schoolLogoUrl !== undefined ? data.schoolLogoUrl : (APP_CONFIG.logoUrl || ""),
          pesantrenLogoUrl: data.pesantrenLogoUrl || "",
          accreditationText: data.accreditationText || "",
          headmasterName: data.headmasterName || ssotPrincipalName,
          headmasterTitle: data.headmasterTitle || "Kepala Sekolah / Kepala Madrasah",
          headmasterNipNiy: data.headmasterNipNiy || ssotPrincipalNipNiy,
          headmasterSignatureUrl: data.headmasterSignatureUrl !== undefined ? data.headmasterSignatureUrl : ssotSignatureUrl,
          schoolStampUrl: data.schoolStampUrl || "",
          homeroomTeachers: data.homeroomTeachers || {},
          homeroomSignatures: data.homeroomSignatures || {},
          excludedSubjectIds: data.excludedSubjectIds || [],
          customHeader: data.customHeader || undefined,
          updatedAt: data.updatedAt,
          updatedBy: data.updatedBy
        };
      }

      // Default baseline jika dokumen belum pernah dibuat
      return {
        reportCity: APP_CONFIG.regency || "Solok",
        reportDate: "",
        schoolLogoUrl: APP_CONFIG.logoUrl || "",
        pesantrenLogoUrl: "",
        accreditationText: "",
        headmasterName: ssotPrincipalName,
        headmasterTitle: "Kepala Sekolah / Kepala Madrasah",
        headmasterNipNiy: ssotPrincipalNipNiy,
        headmasterSignatureUrl: ssotSignatureUrl,
        schoolStampUrl: "",
        homeroomTeachers: {},
        homeroomSignatures: {},
        excludedSubjectIds: []
      };
    } catch (error) {
      console.error("Error reading midterm print settings:", error);
      return {
        reportCity: APP_CONFIG.regency || "Solok",
        reportDate: "",
        schoolLogoUrl: APP_CONFIG.logoUrl || "",
        pesantrenLogoUrl: "",
        accreditationText: "",
        headmasterName: APP_CONFIG.principalName || "H. Abdullah",
        headmasterTitle: "Kepala Sekolah / Kepala Madrasah",
        headmasterNipNiy: APP_CONFIG.principalNipNiy || "NIY. 202001001",
        headmasterSignatureUrl: "",
        schoolStampUrl: "",
        homeroomTeachers: {},
        homeroomSignatures: {},
        excludedSubjectIds: []
      };
    }
  },

  /**
   * Menyimpan pembaruan konfigurasi cetak RTS ke Firestore.
   */
  async savePrintSettings(
    settings: Partial<MidtermPrintSettings>,
    updatedBy: string = "Admin"
  ): Promise<MidtermPrintSettings> {
    try {
      const docRef = doc(db, COLLECTION_NAME, DOCUMENT_ID);
      const payload: any = {
        ...settings,
        updatedAt: new Date().toISOString(),
        updatedBy
      };

      // Pastikan homeroomTeachers di-merge secara aman
      if (settings.homeroomTeachers) {
        payload.homeroomTeachers = settings.homeroomTeachers;
      }

      // Pastikan homeroomSignatures di-merge secara aman
      if (settings.homeroomSignatures) {
        payload.homeroomSignatures = settings.homeroomSignatures;
      }

      // Pastikan excludedSubjectIds di-merge secara aman
      if (settings.excludedSubjectIds !== undefined) {
        payload.excludedSubjectIds = settings.excludedSubjectIds;
      }

      await setDoc(docRef, payload, { merge: true });
      return await this.getPrintSettings();
    } catch (error) {
      console.error("Error saving midterm print settings:", error);
      throw error;
    }
  },

  /**
   * Menghapus aset gambar tertentu secara terisolasi tanpa mempengaruhi data lainnya.
   */
  async deleteAsset(
    assetType: "headmasterSignature" | "schoolStamp" | "homeroomSignature" | "schoolLogo" | "pesantrenLogo",
    classOrTeacherId?: string,
    updatedBy: string = "Admin"
  ): Promise<MidtermPrintSettings> {
    const current = await this.getPrintSettings();

    if (assetType === "headmasterSignature") {
      return await this.savePrintSettings({ headmasterSignatureUrl: "" }, updatedBy);
    } else if (assetType === "schoolStamp") {
      return await this.savePrintSettings({ schoolStampUrl: "" }, updatedBy);
    } else if (assetType === "schoolLogo") {
      return await this.savePrintSettings({ schoolLogoUrl: "" }, updatedBy);
    } else if (assetType === "pesantrenLogo") {
      return await this.savePrintSettings({ pesantrenLogoUrl: "" }, updatedBy);
    } else if (assetType === "homeroomSignature" && classOrTeacherId) {
      const updatedSigs = { ...(current.homeroomSignatures || {}) };
      delete updatedSigs[classOrTeacherId];
      const updatedTeachers = { ...(current.homeroomTeachers || {}) };
      if (updatedTeachers[classOrTeacherId]) {
        updatedTeachers[classOrTeacherId] = {
          ...updatedTeachers[classOrTeacherId],
          signatureUrl: ""
        };
      }
      return await this.savePrintSettings({
        homeroomSignatures: updatedSigs,
        homeroomTeachers: updatedTeachers
      }, updatedBy);
    }

    return current;
  },

  /**
   * Menonaktifkan / mengecualikan mata pelajaran dari Rapor Tengah Semester (KHUSUS ADMIN).
   * Tidak mengubah master mapel, nilai, jadwal, atau rapor semester.
   */
  async excludeSubjectFromMidterm(
    subjectId: string,
    updatedBy: string = "Admin",
    userRole?: string
  ): Promise<MidtermPrintSettings> {
    const roleNormalized = (userRole || "").toLowerCase().trim();
    if (roleNormalized !== "admin") {
      throw new Error("Akses Ditolak: Hanya pengguna dengan peran Admin yang berwenang menghapus / menonaktifkan mapel dari RTS.");
    }

    const current = await this.getPrintSettings();
    const existing = new Set(current.excludedSubjectIds || []);
    existing.add(subjectId);

    return await this.savePrintSettings(
      { excludedSubjectIds: Array.from(existing) },
      updatedBy
    );
  },

  /**
   * Mengaktifkan kembali mata pelajaran yang sebelumnya dinonaktifkan di RTS (KHUSUS ADMIN).
   */
  async restoreSubjectToMidterm(
    subjectId: string,
    updatedBy: string = "Admin",
    userRole?: string
  ): Promise<MidtermPrintSettings> {
    const roleNormalized = (userRole || "").toLowerCase().trim();
    if (roleNormalized !== "admin") {
      throw new Error("Akses Ditolak: Hanya pengguna dengan peran Admin yang berwenang mengaktifkan mapel di RTS.");
    }

    const current = await this.getPrintSettings();
    const existing = (current.excludedSubjectIds || []).filter((id) => id !== subjectId);

    return await this.savePrintSettings(
      { excludedSubjectIds: existing },
      updatedBy
    );
  }
};
