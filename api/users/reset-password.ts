import type { IncomingMessage, ServerResponse } from "http";
import fs from "fs";
import path from "path";
import { initializeApp, cert, getApps, getApp, App } from "firebase-admin/app";
import { getAuth, Auth } from "firebase-admin/auth";
import { getFirestore, Firestore, FieldValue } from "firebase-admin/firestore";

let adminApp: App | null = null;
let adminAuth: Auth | null = null;
let adminDb: Firestore | null = null;
let initError: string | null = null;

let firebaseConfigJson: any = {};
try {
  const configPath = path.join(process.cwd(), "firebase-applet-config.json");
  if (fs.existsSync(configPath)) {
    firebaseConfigJson = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  }
} catch {
  // Ignore fallback
}

const projectId = process.env.VITE_FIREBASE_PROJECT_ID || firebaseConfigJson.projectId || "smp-alkarim-rasyid";
const DEFAULT_SYSTEM_PASSWORD = process.env.DEFAULT_SYSTEM_PASSWORD || "Alkarim123";

function getFirebaseAdmin(): {
  adminApp: App | null;
  adminAuth: Auth | null;
  adminDb: Firestore | null;
  initError: string | null;
} {
  if (!adminApp) {
    try {
      if (getApps().length === 0) {
        if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
          try {
            const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
            adminApp = initializeApp({
              credential: cert(serviceAccount),
              projectId: serviceAccount.project_id || projectId,
            });
          } catch (saErr: any) {
            console.error("[Vercel API] Error parsing FIREBASE_SERVICE_ACCOUNT_KEY:", saErr.message);
            adminApp = initializeApp({ projectId });
          }
        } else {
          adminApp = initializeApp({ projectId });
        }
      } else {
        adminApp = getApp();
      }
    } catch (err: any) {
      initError = err.message;
      console.error("[Vercel API] Error initializing Firebase Admin App:", err.message);
    }
  }

  if (adminApp && !adminAuth) {
    try {
      adminAuth = getAuth(adminApp);
    } catch (err: any) {
      initError = err.message;
      console.error("[Vercel API] Error getting Admin Auth:", err.message);
    }
  }

  if (adminApp && !adminDb) {
    try {
      adminDb = getFirestore(adminApp);
    } catch (err: any) {
      initError = err.message;
      console.error("[Vercel API] Error getting Admin Firestore:", err.message);
    }
  }

  return { adminApp, adminAuth, adminDb, initError };
}

function parseBody(req: any): any {
  if (req.body) {
    if (typeof req.body === "object") return req.body;
    if (typeof req.body === "string") {
      try {
        return JSON.parse(req.body);
      } catch {
        return {};
      }
    }
  }
  return {};
}

function sendJson(res: any, status: number, data: any) {
  if (!res.headersSent) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Accept");
    res.setHeader("Content-Type", "application/json");
  }
  if (typeof res.status === "function" && typeof res.json === "function") {
    return res.status(status).json(data);
  }
  res.statusCode = status;
  res.end(JSON.stringify(data));
}

export default async function handler(req: any, res: any) {
  try {
    if (req.method === "OPTIONS") {
      res.statusCode = 200;
      res.end();
      return;
    }

    if (req.method !== "POST") {
      return sendJson(res, 405, {
        success: false,
        message: `Method ${req.method} tidak diizinkan. Endpoint ini hanya menerima POST.`,
      });
    }

    const body = parseBody(req);
    const targetUid = (body?.uid || body?.userId || "").toString().trim();
    const operatorId = (body?.operatorId || "").toString().trim();
    const operatorName = (body?.operatorName || "").toString().trim();

    // Safe logging (NO sensitive passwords or credentials)
    console.log(
      `[RESET PASSWORD] method: ${req.method}, path: /api/users/reset-password, targetUserId: ${targetUid || "undefined"}, operatorId: ${operatorId || "undefined"}`
    );

    if (!targetUid) {
      return sendJson(res, 400, {
        success: false,
        message: "UID pengguna target wajib disertakan.",
      });
    }

    if (!operatorId) {
      return sendJson(res, 400, {
        success: false,
        message: "Operator ID wajib disertakan untuk otorisasi dan audit trail.",
      });
    }

    const { adminAuth: auth, adminDb: db, initError: adminErr } = getFirebaseAdmin();

    console.log(
      `[RESET PASSWORD] Firebase Admin Status - App: ${!!adminApp}, Auth: ${!!auth}, Firestore: ${!!db}`
    );

    if (!auth) {
      console.error(
        `[RESET PASSWORD ERROR]\nmessage: Konfigurasi Firebase Admin belum tersedia (${adminErr || "No admin auth"})\ncode: CONFIG_UNAVAILABLE\nstack: ${new Error().stack}`
      );
      return sendJson(res, 500, {
        success: false,
        message: "Konfigurasi Firebase Admin belum tersedia",
      });
    }

    // 1. Verify operator permission from Firestore (Admin, Kepala Sekolah, Waka, Operator, Tata Usaha)
    if (db && operatorId !== "system") {
      try {
        const operatorDoc = await db.collection("users").doc(operatorId).get();
        if (operatorDoc.exists) {
          const opData = operatorDoc.data() || {};
          const roles: string[] = opData.roles || (opData.role ? [opData.role] : []);
          const allowedRoles = ["admin", "kepala sekolah", "wakil kepala sekolah", "operator", "tata usaha"];
          const hasPermission = roles.some((r: string) => allowedRoles.includes(r.toLowerCase()));
          if (!hasPermission) {
            return sendJson(res, 403, {
              success: false,
              message: "Akses ditolak: Anda tidak memiliki izin untuk mereset kata sandi akun pengguna.",
            });
          }
        }
      } catch (authCheckErr: any) {
        console.warn("[Vercel API] Operator permission check warning:", authCheckErr.message);
      }
    }

    // 2. Fetch target user info for logging & verification
    let targetUserName = targetUid;
    let targetEmail = "";
    if (db) {
      try {
        const targetDoc = await db.collection("users").doc(targetUid).get();
        if (targetDoc.exists) {
          const targetData = targetDoc.data() || {};
          targetUserName = targetData.name || targetUid;
          targetEmail = targetData.email || "";
        }
      } catch (fetchTargetErr: any) {
        console.warn("[Vercel API] Fetch target info warning:", fetchTargetErr.message);
      }
    }

    // 3. Check if user exists in Firebase Authentication
    try {
      await auth.getUser(targetUid);
    } catch (getUserErr: any) {
      if (getUserErr.code === "auth/user-not-found") {
        console.warn(
          `[RESET PASSWORD ERROR]\nmessage: User not found in Firebase Auth\ncode: ${getUserErr.code}\nstack: ${getUserErr.stack}`
        );
        return sendJson(res, 404, {
          success: false,
          message: "User tidak ditemukan",
        });
      }
      if (getUserErr.code === "auth/invalid-uid") {
        return sendJson(res, 400, {
          success: false,
          message: "Format UID pengguna tidak valid",
        });
      }
      // If error is other than user-not-found, rethrow to be handled by general catch
      throw getUserErr;
    }

    // 4. Execute password update in Firebase Authentication
    console.log(`[Vercel API] Resetting password for user ${targetUid} (${targetEmail || targetUserName}) to default credentials...`);
    await auth.updateUser(targetUid, {
      password: DEFAULT_SYSTEM_PASSWORD,
    });
    console.log(`[Vercel API] Firebase Auth password updated successfully for user ${targetUid}`);

    // 5. Update Firestore user document WITHOUT modifying roles/profile/NIY/NUPTK
    if (db) {
      try {
        await db.collection("users").doc(targetUid).update({
          requirePasswordChange: true,
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: operatorId,
        });

        // 6. Write audit log in activity_logs
        await db.collection("activity_logs").add({
          userId: operatorId,
          userName: operatorName || "Operator",
          action: "RESET_PASSWORD",
          collection: "users",
          documentId: targetUid,
          description: `Mengatur ulang kata sandi pengguna ${targetUserName} (${targetEmail}) ke kata sandi default sistem. Pengguna wajib mengganti kata sandi pada login berikutnya.`,
          createdAt: FieldValue.serverTimestamp(),
        });
      } catch (dbErr: any) {
        console.warn("[Vercel API] Firestore update warning after Auth reset:", dbErr.message);
      }
    }

    return sendJson(res, 200, {
      success: true,
      message: "Akun berhasil direset",
    });
  } catch (error: any) {
    console.error(
      `[RESET PASSWORD ERROR]\nmessage: ${error.message}\ncode: ${error.code || "UNKNOWN"}\nstack: ${error.stack || "N/A"}`
    );

    if (error.code === "auth/user-not-found") {
      return sendJson(res, 404, {
        success: false,
        message: "User tidak ditemukan",
      });
    }

    return sendJson(res, 500, {
      success: false,
      message: `Gagal mereset akun: ${error.message || "Kesalahan pada server"}`,
    });
  }
}
