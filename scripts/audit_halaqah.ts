import { db } from "../src/firebase/config.js";
import { collection, getDocs } from "firebase/firestore";

async function runAudit() {
  console.log("=== AUDIT FIRESTORE DATA FOR HALAQAH ===");

  try {
    // 1. halaqah_groups
    console.log("\n--- 1. COLLECTION: halaqah_groups ---");
    const groupsSnap = await getDocs(collection(db, "halaqah_groups"));
    console.log(`Total documents in halaqah_groups: ${groupsSnap.size}`);
    groupsSnap.forEach(doc => {
      console.log(`Doc ID: ${doc.id} =>`, JSON.stringify(doc.data(), null, 2));
    });

    // 2. halaqah_schedules
    console.log("\n--- 2. COLLECTION: halaqah_schedules ---");
    const schedulesSnap = await getDocs(collection(db, "halaqah_schedules"));
    console.log(`Total documents in halaqah_schedules: ${schedulesSnap.size}`);
    schedulesSnap.forEach(doc => {
      console.log(`Doc ID: ${doc.id} =>`, JSON.stringify(doc.data(), null, 2));
    });

    // 3. school_agendas
    console.log("\n--- 3. COLLECTION: school_agendas ---");
    const agendasSnap = await getDocs(collection(db, "school_agendas"));
    console.log(`Total documents in school_agendas: ${agendasSnap.size}`);
    agendasSnap.forEach(doc => {
      console.log(`Doc ID: ${doc.id} =>`, JSON.stringify(doc.data(), null, 2));
    });

    // 4. school_settings
    console.log("\n--- 4. COLLECTION: school_settings ---");
    const settingsSnap = await getDocs(collection(db, "school_settings"));
    console.log(`Total documents in school_settings: ${settingsSnap.size}`);
    settingsSnap.forEach(doc => {
      console.log(`Doc ID: ${doc.id} =>`, JSON.stringify(doc.data(), null, 2));
    });

  } catch (err) {
    console.error("Audit error:", err);
  }
}

runAudit().then(() => process.exit(0));
