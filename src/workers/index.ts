import { logInfo } from "../shared/logging/logger";
import "./football-odds-today.worker";
import "./daily-prewarm.worker";
import "./live-fixtures-poller";
import "./pre-match-notifications.worker";
import "./news-publication-poller.worker";
import "./web-push-notifications.worker";
import "./whatsapp-notifications.worker";

logInfo("worker.bundle.started", {
  services: [
    "football-odds-today",
    "daily-prewarm",
    "live-fixtures-poller",
    "pre-match-notifications",
    "news-publication-poller",
    "web-push-notifications",
    "whatsapp-notifications",
  ],
});
