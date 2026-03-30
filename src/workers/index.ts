import { logInfo } from "../shared/logging/logger";
import "./football-odds-today.worker";
import "./daily-prewarm.worker";
import "./live-fixtures-poller";
import "./whatsapp-notifications.worker";

logInfo("worker.bundle.started", {
  services: [
    "football-odds-today",
    "daily-prewarm",
    "live-fixtures-poller",
    "whatsapp-notifications",
  ],
});
