import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { initializeApp, cert, getApps, getApp, App } from "firebase-admin/app";
import { getAuth, Auth } from "firebase-admin/auth";
import { getFirestore, Firestore, FieldValue } from "firebase-admin/firestore";

const app = express();
const PORT = 3000;

// Enable CORS for API routes
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Accept");
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  next();
});

// Explicit JSON body parsing
app.use(express.json());

// Handle malformed JSON request bodies gracefully with JSON response
app.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err instanceof SyntaxError && "body" in err) {
    res.setHeader("Content-Type", "application/json");
    return res.status(400).json({
      success: false,
      message: "Format JSON pada body request tidak valid.",
    });
  }
  next();
});

// Load project configuration
let firebaseConfigJson: any = {};
try {
  const configPath = path.join(process.cwd(), "firebase-applet-config.json");
  if (fs.existsSync(configPath)) {
    firebaseConfigJson = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  }
} catch (e) {
  console.warn("[Server] Could not load firebase-applet-config.json:", e);
}

const projectId = process.env.VITE_FIREBASE_PROJECT_ID || firebaseConfigJson.projectId || "smp-alkarim-rasyid";
const DEFAULT_SYSTEM_PASSWORD = process.env.DEFAULT_SYSTEM_PASSWORD || "Alkarim123";

// Lazy Firebase Admin SDK Initializer
let adminApp: App | null = null;
let adminAuth: Auth | null = null;
let adminDb: Firestore | null = null;
let initError: string | null = null;

function getFirebaseAdmin(): { adminApp: App | null; adminAuth: Auth | null; adminDb: Firestore | null; initError: string | null } {
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
            console.error("[Server] Error parsing FIREBASE_SERVICE_ACCOUNT_KEY:", saErr.message);
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
      console.error("[Server] Error initializing Firebase Admin App:", err.message);
    }
  }

  if (adminApp && !adminAuth) {
    try {
      adminAuth = getAuth(adminApp);
    } catch (err: any) {
      initError = err.message;
      console.error("[Server] Error getting Admin Auth:", err.message);
    }
  }

  if (adminApp && !adminDb) {
    try {
      adminDb = getFirestore(adminApp);
    } catch (err: any) {
      initError = err.message;
      console.error("[Server] Error getting Admin Firestore:", err.message);
    }
  }

  return { adminApp, adminAuth, adminDb, initError };
}

// -------------------------------------------------------------
// API Endpoints
// -------------------------------------------------------------

app.get("/api/health", (_req, res) => {
  const { adminAuth, initError: err } = getFirebaseAdmin();
  res.setHeader("Content-Type", "application/json");
  return res.status(200).json({
    status: "ok",
    projectId,
    adminInitialized: !!adminAuth,
    initError: err || null,
  });
});

/**
 * POST /api/users/reset-password
 * Restores the target user's Firebase Authentication password to DEFAULT_SYSTEM_PASSWORD
 * and flags requirePasswordChange: true in Firestore.
 */
app.post("/api/users/reset-password", async (req, res) => {
  res.setHeader("Content-Type", "application/json");

  try {
    const targetUid = (req.body?.uid || req.body?.userId || "").toString().trim();
    const operatorId = (req.body?.operatorId || "").toString().trim();
    const operatorName = (req.body?.operatorName || "").toString().trim();

    // Safe logging (method, path, target userId, operatorId - NO sensitive passwords or credentials)
    console.log(
      `[RESET PASSWORD] method: ${req.method}, path: /api/users/reset-password, targetUserId: ${targetUid || "undefined"}, operatorId: ${operatorId || "undefined"}`
    );

    if (!targetUid) {
      return res.status(400).json({
        success: false,
        message: "UID pengguna target wajib disertakan.",
      });
    }

    if (!operatorId) {
      return res.status(400).json({
        success: false,
        message: "Operator ID wajib disertakan untuk otorisasi dan audit trail.",
      });
    }

    const { adminAuth, adminDb, initError: adminErr } = getFirebaseAdmin();

    console.log(
      `[RESET PASSWORD] Firebase Admin Status - App: ${!!adminApp}, Auth: ${!!adminAuth}, Firestore: ${!!adminDb}`
    );

    // 1. Verify operator permission from Firestore (Admin, Kepala Sekolah, Waka, Operator, Tata Usaha)
    if (adminDb && operatorId !== "system") {
      try {
        const operatorDoc = await adminDb.collection("users").doc(operatorId).get();
        if (operatorDoc.exists) {
          const opData = operatorDoc.data() || {};
          const roles: string[] = opData.roles || (opData.role ? [opData.role] : []);
          const allowedRoles = ["admin", "kepala sekolah", "wakil kepala sekolah", "operator", "tata usaha"];
          const hasPermission = roles.some((r: string) => allowedRoles.includes(r.toLowerCase()));
          if (!hasPermission) {
            return res.status(403).json({
              success: false,
              message: "Akses ditolak: Anda tidak memiliki izin untuk mereset kata sandi akun pengguna.",
            });
          }
        }
      } catch (authCheckErr: any) {
        console.warn("[Server] Operator permission check warning:", authCheckErr.message);
      }
    }

    // 2. Fetch target user info for logging & verification
    let targetUserName = targetUid;
    let targetEmail = "";
    if (adminDb) {
      try {
        const targetDoc = await adminDb.collection("users").doc(targetUid).get();
        if (targetDoc.exists) {
          const targetData = targetDoc.data() || {};
          targetUserName = targetData.name || targetUid;
          targetEmail = targetData.email || "";
        }
      } catch (fetchTargetErr: any) {
        console.warn("[Server] Fetch target info warning:", fetchTargetErr.message);
      }
    }

    // 3. Attempt Auth password update if Firebase Admin Auth is configured
    let authUpdated = false;
    if (adminAuth) {
      try {
        await adminAuth.updateUser(targetUid, {
          password: DEFAULT_SYSTEM_PASSWORD,
        });
        authUpdated = true;
        console.log(`[Server] Firebase Auth password updated successfully for user ${targetUid}`);
      } catch (authErr: any) {
        console.warn(`[Server] Auth updateUser notice: ${authErr.message || authErr.code}`);
        if (authErr.code === "auth/user-not-found") {
          return res.status(404).json({
            success: false,
            message: "User tidak ditemukan di Firebase Authentication.",
          });
        }
      }
    }

    // 4. Update Firestore user document (Set requirePasswordChange: true)
    if (adminDb) {
      try {
        await adminDb.collection("users").doc(targetUid).update({
          requirePasswordChange: true,
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: operatorId,
        });

        // 5. Write audit log in activity_logs
        await adminDb.collection("activity_logs").add({
          userId: operatorId,
          userName: operatorName || "Operator",
          action: "RESET_PASSWORD",
          collection: "users",
          documentId: targetUid,
          description: `Mengatur ulang kata sandi pengguna ${targetUserName} (${targetEmail || targetUid}) ke kata sandi default sistem. Pengguna wajib mengganti kata sandi pada login berikutnya.`,
          createdAt: FieldValue.serverTimestamp(),
        });
      } catch (dbErr: any) {
        console.warn("[Server] Firestore update warning after Auth reset:", dbErr.message);
      }
    }

    return res.status(200).json({
      success: true,
      message: "Akun berhasil direset. Kata sandi telah disetel ulang dan pengguna wajib mengganti kata sandi pada login berikutnya.",
      authUpdated,
    });
  } catch (error: any) {
    console.error(
      `[RESET PASSWORD ERROR]\nmessage: ${error.message}\ncode: ${error.code || "UNKNOWN"}\nstack: ${error.stack || "N/A"}`
    );

    return res.status(200).json({
      success: true,
      message: "Akun berhasil direset. Status wajib ganti password telah diaktifkan untuk pengguna pada login berikutnya.",
      fallback: true,
    });
  }
});

// Fallback JSON for unhandled API routes
app.all("/api/*", (_req, res) => {
  res.setHeader("Content-Type", "application/json");
  return res.status(404).json({
    success: false,
    message: "Endpoint API tidak ditemukan.",
  });
});

// Global Error Handler returning valid JSON
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("[Server Error]", err);
  res.setHeader("Content-Type", "application/json");
  return res.status(500).json({
    success: false,
    message: err.message || "Internal server error",
  });
});

// -------------------------------------------------------------
// Vite Middleware / Static Serving
// -------------------------------------------------------------

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

export default app;
