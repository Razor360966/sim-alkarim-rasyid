import type { IncomingMessage, ServerResponse } from "http";
import fs from "fs";
import path from "path";
import { initializeApp, cert, getApps, getApp, App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

let adminApp: App | null = null;
let adminAuth: any = null;

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

function getAdmin() {
  if (!adminApp) {
    try {
      if (getApps().length === 0) {
        if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
          const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
          adminApp = initializeApp({
            credential: cert(sa),
            projectId: sa.project_id || projectId,
          });
        } else {
          adminApp = initializeApp({ projectId });
        }
      } else {
        adminApp = getApp();
      }
    } catch (e: any) {
      console.error("[API Health] Firebase Admin init error:", e.message);
    }
  }

  if (adminApp && !adminAuth) {
    try {
      adminAuth = getAuth(adminApp);
    } catch (e: any) {
      console.error("[API Health] Firebase Admin Auth error:", e.message);
    }
  }

  return { adminAuth };
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Accept");
  res.setHeader("Content-Type", "application/json");

  if (req.method === "OPTIONS") {
    res.statusCode = 200;
    res.end();
    return;
  }

  if (req.method !== "GET") {
    res.statusCode = 405;
    res.end(JSON.stringify({ success: false, message: `Method ${req.method} tidak diizinkan. Gunakan GET.` }));
    return;
  }

  const { adminAuth: auth } = getAdmin();
  res.statusCode = 200;
  res.end(
    JSON.stringify({
      status: "ok",
      projectId,
      adminInitialized: !!auth,
    })
  );
}
