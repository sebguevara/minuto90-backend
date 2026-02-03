import { z } from "zod";

// ==================== COMMON SCHEMAS ====================

export const paginationSchema = z.object({
  limit: z.coerce.number().min(1).max(200).default(50),
  offset: z.coerce.number().min(0).default(0),
});

export const minIdParamSchema = z.object({
  minId: z.coerce.number().int().positive(),
});

// ==================== ENUMS ====================

// Mode enum for performance and streaks
export const modeEnum = z.enum(["all", "home", "away"]).default("all");

// Scope enum for streaks
export const scopeEnum = z.enum(["Current", "Season", "Historical"]).default(
  "Current"
);

// Category enum for performance (generic string for flexibility)
export const categoryEnum = z.string();

// Timeframe enum for Best XI
export const timeframeEnum = z.enum([
  "all",
  "round",
  "monthly",
  "season",
  "custom",
]);

// ==================== TEAM ENDPOINTS ====================

export const teamTournamentsQuerySchema = paginationSchema.extend({
  seasonId: z.coerce.number().int().positive().optional(),
});

export const teamPerformanceQuerySchema = paginationSchema.extend({
  tournamentId: z.coerce.number().int().positive(),
  viewTypeId: z.coerce.number().int().positive(),
  category: categoryEnum.optional(),
  mode: modeEnum,
});

export const teamPositionalQuerySchema = paginationSchema.extend({
  tournamentId: z.coerce.number().int().positive(),
  viewTypeId: z.coerce.number().int().positive(),
  sectionId: z.coerce.number().int().positive().optional(),
  category: categoryEnum.optional(),
});

export const teamSituationalQuerySchema = paginationSchema.extend({
  tournamentId: z.coerce.number().int().positive(),
  viewTypeId: z.coerce.number().int().positive(),
  sectionId: z.coerce.number().int().positive().optional(),
  category: categoryEnum.optional(),
});

export const teamStreaksQuerySchema = paginationSchema.extend({
  tournamentId: z.coerce.number().int().positive(),
  viewTypeId: z.coerce.number().int().positive(),
  mode: modeEnum,
  scope: scopeEnum,
  streakType: z
    .enum([
      "wins",
      "losses",
      "draws",
      "unbeaten",
      "winless",
      "scoreless",
      "cleansheets",
      "goals",
    ])
    .optional(),
});

export const topPlayerMetricEnum = z.enum([
  "rating",
  "assist",
  "shot",
  "aggression",
  "goalContribution",
]);

export const teamTopPlayersQuerySchema = z.object({
  tournamentId: z.coerce.number().int().positive(),
  viewTypeId: z.coerce.number().int().positive(),
  metric: topPlayerMetricEnum,
  limit: z.coerce.number().min(1).max(100).default(10),
});

export const teamTournamentParamSchema = z.object({
  minId: z.coerce.number().int().positive(),
  tournamentId: z.coerce.number().int().positive(),
});

// ==================== TOURNAMENT ENDPOINTS ====================

export const tournamentTeamsQuerySchema = paginationSchema.extend({
  seasonId: z.coerce.number().int().positive().optional(),
});

export const tournamentTableTypeEnum = z.enum([
  "defensive",
  "offensive",
  "summary",
  "xg",
]);

export const tournamentTablesQuerySchema = paginationSchema.extend({
  viewTypeId: z.coerce.number().int().positive(),
  type: tournamentTableTypeEnum.optional(),
  categoryId: z.coerce.number().int().positive().optional(),
  sectionId: z.coerce.number().int().positive().optional(),
  typeId: z.coerce.number().int().positive().optional(),
});

export const tournamentPlayerTableTypeEnum = z.enum([
  "defensive",
  "offensive",
  "passing",
  "summary",
  "xg",
]);

export const tournamentPlayerTablesQuerySchema = paginationSchema.extend({
  viewTypeId: z.coerce.number().int().positive(),
  type: tournamentPlayerTableTypeEnum.optional(),
  categoryId: z.coerce.number().int().positive().optional(),
  sectionId: z.coerce.number().int().positive().optional(),
  typeId: z.coerce.number().int().positive().optional(),
  minApps: z.coerce.number().int().min(0).optional(),
});

export const tournamentBestXIQuerySchema = z.object({
  timeframe: timeframeEnum,
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
});

// ==================== TYPE EXPORTS ====================

export type PaginationQuery = z.infer<typeof paginationSchema>;
export type MinIdParam = z.infer<typeof minIdParamSchema>;
export type ModeEnum = z.infer<typeof modeEnum>;
export type ScopeEnum = z.infer<typeof scopeEnum>;
export type CategoryEnum = z.infer<typeof categoryEnum>;
export type TimeframeEnum = z.infer<typeof timeframeEnum>;
export type TeamTournamentsQuery = z.infer<typeof teamTournamentsQuerySchema>;
export type TeamPerformanceQuery = z.infer<typeof teamPerformanceQuerySchema>;
export type TeamPositionalQuery = z.infer<typeof teamPositionalQuerySchema>;
export type TeamSituationalQuery = z.infer<typeof teamSituationalQuerySchema>;
export type TeamStreaksQuery = z.infer<typeof teamStreaksQuerySchema>;
export type TopPlayerMetric = z.infer<typeof topPlayerMetricEnum>;
export type TeamTopPlayersQuery = z.infer<typeof teamTopPlayersQuerySchema>;
export type TeamTournamentParam = z.infer<typeof teamTournamentParamSchema>;
export type TournamentTeamsQuery = z.infer<typeof tournamentTeamsQuerySchema>;
export type TournamentTableType = z.infer<typeof tournamentTableTypeEnum>;
export type TournamentTablesQuery = z.infer<typeof tournamentTablesQuerySchema>;
export type TournamentPlayerTableType = z.infer<
  typeof tournamentPlayerTableTypeEnum
>;
export type TournamentPlayerTablesQuery = z.infer<
  typeof tournamentPlayerTablesQuerySchema
>;
export type TournamentBestXIQuery = z.infer<typeof tournamentBestXIQuerySchema>;
