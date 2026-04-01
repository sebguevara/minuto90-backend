import { Elysia } from "elysia";
import { getTeamColors, getTeamColorsIfCached, FALLBACK_COLORS } from "./team-color.service";
import { logInfo, logWarn } from "../logging/logger";

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

    logInfo("team_colors.http.request", {
      sport,
      rawTeamId: typeof query.teamId === "string" ? query.teamId : null,
      teamId,
      hasLogoUrl: Boolean(logoUrl),
    });

    if (!teamId) {
      set.status = 400;
      logWarn("team_colors.http.invalid_team_id", {
        sport,
        rawTeamId: typeof query.teamId === "string" ? query.teamId : null,
      });
      return { error: "teamId is required" };
    }

    const cached = await getTeamColorsIfCached(sport, teamId);
    if (cached) {
      logInfo("team_colors.http.response", {
        sport,
        teamId,
        source: "cache",
        fallback: false,
        colors: cached,
      });
      return { response: cached, cached: true };
    }

    if (!logoUrl) {
      logWarn("team_colors.http.response", {
        sport,
        teamId,
        source: "no_logo_fallback",
        fallback: true,
        colors: FALLBACK_COLORS,
      });
      return { response: FALLBACK_COLORS, cached: false, fallback: true };
    }

    try {
      const colors = await getTeamColors(sport, teamId, logoUrl);
      const fallback =
        colors.dark === FALLBACK_COLORS.dark && colors.light === FALLBACK_COLORS.light;
      logInfo("team_colors.http.response", {
        sport,
        teamId,
        source: fallback ? "extract_fallback" : "extract",
        fallback,
        colors,
      });
      return { response: colors, cached: false };
    } catch (error) {
      logWarn("team_colors.http.response_error", {
        sport,
        teamId,
        hasLogoUrl: Boolean(logoUrl),
        error: error instanceof Error ? error.message : String(error),
      });
      return { response: FALLBACK_COLORS, cached: false, fallback: true };
    }
  }
);
