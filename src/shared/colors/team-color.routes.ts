import { Elysia } from "elysia";
import { getTeamColors, getTeamColorsIfCached, FALLBACK_COLORS } from "./team-color.service";

const normalizeSport = (value: string | undefined): string =>
  value?.trim().toLowerCase() || "football";

const parseTeamId = (value: string | undefined): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

export const teamColorRoutes = new Elysia({ prefix: "/api/team-colors" }).get(
  "/",
  async ({ query, set }) => {
    const sport = normalizeSport(typeof query.sport === "string" ? query.sport : undefined);
    const teamId = parseTeamId(typeof query.teamId === "string" ? query.teamId : undefined);
    const logoUrl = typeof query.logoUrl === "string" ? query.logoUrl.trim() : "";

    if (!teamId) {
      set.status = 400;
      return { error: "teamId is required" };
    }

    const cached = await getTeamColorsIfCached(sport, teamId);
    if (cached) {
      return { response: cached, cached: true };
    }

    if (!logoUrl) {
      return { response: FALLBACK_COLORS, cached: false, fallback: true };
    }

    try {
      const colors = await getTeamColors(sport, teamId, logoUrl);
      return { response: colors, cached: false };
    } catch {
      return { response: FALLBACK_COLORS, cached: false, fallback: true };
    }
  }
);
