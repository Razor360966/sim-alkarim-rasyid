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
          headmasterName: data.headmasterName || ssotPrincipalName,
          headmasterTitle: data.headmasterTitle || "Kepala Sekolah / Kepala Madrasah",
          headmasterNipNiy: data.headmasterNipNiy || ssotPrincipalNipNiy,
          headmasterSignatureUrl: data.headmasterSignatureUrl !== undefined ? data.headmasterSignatureUrl : ssotSignatureUrl,
          schoolStampUrl: data.schoolStampUrl || "",
          homeroomSignatures: data.homeroomSignatures || {},
          customHeader: data.customHeader || undefined,
          updatedAt: data.updatedAt,
          updatedBy: data.updatedBy
        };
      }

      // Default baseline jika dokumen belum pernah dibuat
      return {
        headmasterName: ssotPrincipalName,
        headmasterTitle: "Kepala Sekolah / Kepala Madrasah",
        headmasterNipNiy: ssotPrincipalNipNiy,
        headmasterSignatureUrl: ssotSignatureUrl,
        schoolStampUrl: "",
        homeroomSignatures: {}
      };
    } catch (error) {
      console.error("Error reading midterm print settings:", error);
      return {
        headmasterName: APP_CONFIG.principalName || "H. Abdullah",
        headmasterTitle: "Kepala Sekolah / Kepala Madrasah",
        headmasterNipNiy: APP_CONFIG.principalNipNiy || "NIY. 202001001",
        headmasterSignatureUrl: "",
        schoolStampUrl: "",
        homeroomSignatures: {}
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

      // Pastikan homeroomSignatures di-merge secara aman
      if (settings.homeroomSignatures) {
        payload.homeroomSignatures = settings.homeroomSignatures;
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
    assetType: "headmasterSignature" | "schoolStamp" | "homeroomSignature",
    classOrTeacherId?: string,
    updatedBy: string = "Admin"
  ): Promise<MidtermPrintSettings> {
    const current = await this.getPrintSettings();

    if (assetType === "headmasterSignature") {
      return await this.savePrintSettings({ headmasterSignatureUrl: "" }, updatedBy);
    } else if (assetType === "schoolStamp") {
      return await this.savePrintSettings({ schoolStampUrl: "" }, updatedBy);
    } else if (assetType === "homeroomSignature" && classOrTeacherId) {
      const updatedSigs = { ...(current.homeroomSignatures || {}) };
      delete updatedSigs[classOrTeacherId];
      return await this.savePrintSettings({ homeroomSignatures: updatedSigs }, updatedBy);
    }

    return current;
  }
};
