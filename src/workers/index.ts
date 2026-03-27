import { logInfo } from "../shared/logging/logger";
import "./live-fixtures-poller";
import "./whatsapp-notifications.worker";

logInfo("worker.bundle.started", {
  services: ["live-fixtures-poller", "whatsapp-notifications"],
});
