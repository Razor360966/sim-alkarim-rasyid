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

function getFirebaseAdmin() {
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

async function parseBody(req: any): Promise<any> {
  if (req.body && typeof req.body === "object") {
    return req.body;
  }
  if (req.body && typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk: any) => {
      data += chunk;
    });
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        resolve({});
      }
    });
    req.on("error", () => resolve({}));
  });
}

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Accept");
  res.setHeader("Content-Type", "application/json");

  if (req.method === "OPTIONS") {
    res.statusCode = 200;
    res.end();
    return;
  }

  if (req.method !== "POST") {
    res.statusCode = 405;
    res.end(
      JSON.stringify({
        success: false,
        message: `Method ${req.method} tidak diizinkan. Endpoint ini hanya menerima POST.`,
      })
    );
    return;
  }

  const body = await parseBody(req);
  const { uid, operatorId, operatorName } = body || {};

  // Safe logging (NO sensitive passwords or credentials)
  console.log(
    `[RESET PASSWORD] method: ${req.method}, path: /api/users/reset-password, targetUserId: ${uid || "undefined"}, operatorId: ${operatorId || "undefined"}`
  );

  if (!uid || typeof uid !== "string" || uid.trim() === "") {
    res.statusCode = 400;
    res.end(
      JSON.stringify({
        success: false,
        message: "UID pengguna target wajib disertakan.",
      })
    );
    return;
  }

  if (!operatorId || typeof operatorId !== "string" || operatorId.trim() === "") {
    res.statusCode = 400;
    res.end(
      JSON.stringify({
        success: false,
        message: "Operator ID wajib disertakan untuk otorisasi dan audit trail.",
      })
    );
    return;
  }

  const { adminAuth: auth, adminDb: db, initError: adminErr } = getFirebaseAdmin();

  try {
    if (!auth) {
      res.statusCode = 500;
      res.end(
        JSON.stringify({
          success: false,
          message: `Firebase Admin SDK belum terinisialisasi: ${adminErr || "Kredensial Admin tidak ditemukan."}`,
        })
      );
      return;
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
            res.statusCode = 403;
            res.end(
              JSON.stringify({
                success: false,
                message: "Akses ditolak: Anda tidak memiliki izin untuk mereset kata sandi akun pengguna.",
              })
            );
            return;
          }
        }
      } catch (authCheckErr: any) {
        console.warn("[Vercel API] Operator permission check warning:", authCheckErr.message);
      }
    }

    // 2. Fetch target user info for logging & verification
    let targetUserName = uid;
    let targetEmail = "";
    if (db) {
      try {
        const targetDoc = await db.collection("users").doc(uid).get();
        if (targetDoc.exists) {
          const targetData = targetDoc.data() || {};
          targetUserName = targetData.name || uid;
          targetEmail = targetData.email || "";
        }
      } catch (fetchTargetErr: any) {
        console.warn("[Vercel API] Fetch target info warning:", fetchTargetErr.message);
      }
    }

    // 3. Execute password update in Firebase Authentication
    console.log(`[Vercel API] Resetting password for user ${uid} (${targetEmail || targetUserName}) to default credentials...`);
    await auth.updateUser(uid, {
      password: DEFAULT_SYSTEM_PASSWORD,
    });
    console.log(`[Vercel API] Firebase Auth password updated successfully for user ${uid}`);

    // 4. Update Firestore user document
    if (db) {
      try {
        await db.collection("users").doc(uid).update({
          requirePasswordChange: true,
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: operatorId,
        });

        // 5. Write audit log in activity_logs
        await db.collection("activity_logs").add({
          userId: operatorId,
          userName: operatorName || "Operator",
          action: "RESET_PASSWORD",
          collection: "users",
          documentId: uid,
          description: `Mengatur ulang kata sandi pengguna ${targetUserName} (${targetEmail}) ke kata sandi default sistem. Pengguna wajib mengganti kata sandi pada login berikutnya.`,
          createdAt: FieldValue.serverTimestamp(),
        });
      } catch (dbErr: any) {
        console.warn("[Vercel API] Firestore update warning after Auth reset:", dbErr.message);
      }
    }

    res.statusCode = 200;
    res.end(
      JSON.stringify({
        success: true,
        message: "Reset akun berhasil. Password telah dikembalikan ke password awal sistem. Pengguna wajib mengganti password setelah login.",
      })
    );
  } catch (error: any) {
    console.error(`[Vercel API] Failed to reset password for user ${uid}:`, error);
    res.statusCode = 500;
    res.end(
      JSON.stringify({
        success: false,
        message: `Reset akun gagal. Password pengguna di Firebase Authentication tidak diubah: ${error.message}`,
      })
    );
  }
}
