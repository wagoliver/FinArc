import cron from "node-cron";

// ---------------------------------------------------------------------------
// Internal helpers to call sync endpoints from within the server process
// ---------------------------------------------------------------------------

const BASE_URL = process.env.AUTH_URL || "http://localhost:3000";

async function callEndpoint(path: string, method: "GET" | "POST" = "POST") {
  try {
    console.log(`[Scheduler] Calling ${method} ${path}...`);
    const res = await fetch(`${BASE_URL}${path}`, { method });
    const data = await res.json();
    if (data.success) {
      console.log(`[Scheduler] ${path} — OK`, data.data);
    } else {
      console.error(`[Scheduler] ${path} — Error:`, data.error);
    }
  } catch (error) {
    console.error(`[Scheduler] ${path} — Failed:`, error);
  }
}

// ---------------------------------------------------------------------------
// Scheduler jobs
// ---------------------------------------------------------------------------

export function startScheduler() {
  console.log("[Scheduler] Starting scheduled jobs...");

  // Exchange rates — 1st of each month at 06:00
  cron.schedule("0 6 1 * *", async () => {
    console.log("[Scheduler] Running exchange rate sync...");
    await callEndpoint("/api/exchange-rates", "POST");
  });

  // Azure sync — 2nd of each month at 07:00
  cron.schedule("0 7 2 * *", async () => {
    console.log("[Scheduler] Running Azure sync...");
    await callEndpoint("/api/azure/sync", "POST");
  });

  // MongoDB sync — 2nd of each month at 08:00
  cron.schedule("0 8 2 * *", async () => {
    console.log("[Scheduler] Running MongoDB sync...");
    await callEndpoint("/api/mongo/sync", "POST");
  });

  console.log("[Scheduler] Jobs scheduled:");
  console.log("  - Exchange rates: 1st of month at 06:00");
  console.log("  - Azure sync:     2nd of month at 07:00");
  console.log("  - MongoDB sync:   2nd of month at 08:00");
}
