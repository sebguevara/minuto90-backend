import { Elysia } from "elysia";
import { calendarService } from "../application/calendar.service";
import { logError } from "../../../shared/logging/logger";

export const calendarRoutes = new Elysia({ prefix: "/api/calendar" }).get(
  "/world-cup-2026.ics",
  async ({ set }) => {
    try {
      const ics = await calendarService.buildWorldCupCalendar();
      set.headers["Content-Type"] = "text/calendar; charset=utf-8";
      set.headers["Content-Disposition"] = 'inline; filename="world-cup-2026.ics"';
      set.headers["Cache-Control"] = "public, max-age=900";
      return ics;
    } catch (err: any) {
      logError("calendar.worldcup.ics.failed", {
        err: err?.message ?? String(err),
      });
      set.status = 500;
      return "Error generating calendar";
    }
  },
  {
    detail: {
      tags: ["Calendar"],
      summary: "Feed .ics suscribible del Mundial 2026 (webcal)",
    },
  }
);
