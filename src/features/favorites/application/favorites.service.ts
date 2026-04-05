import { minutoPrismaClient } from "../../../lib/minuto-client";
import type { FavoritesBySport, SyncFavoritesInput, ToggleFavoriteInput } from "../domain/favorites.types";
import { userNotificationSettingsService } from "../../notifications/application/user-notification-settings.service";

const ENTITY_TYPE_MAP: Record<string, string> = {
  matches: "match",
  leagues: "league",
  teams: "team",
  fights: "fight",
  fighters: "fighter",
};

const ENTITY_BUCKET_MAP: Record<string, keyof FavoritesBySport[string]> = {
  match: "matches",
  league: "leagues",
  team: "teams",
  fight: "fights",
  fighter: "fighters",
};

export const favoritesService = {
  async getByUserId(userId: string): Promise<FavoritesBySport> {
    const rows = await minutoPrismaClient.favorite.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
    });

    const result: FavoritesBySport = {};
    for (const row of rows) {
      if (!result[row.sport]) {
        result[row.sport] = { matches: {}, leagues: {}, teams: {}, fights: {}, fighters: {} };
      }
      const bucket = result[row.sport];
      const bucketKey = ENTITY_BUCKET_MAP[row.entityType];
      if (bucketKey) {
        (bucket[bucketKey] as Record<number, unknown>)[row.entityId] = row.metadata;
      }
    }
    return result;
  },

  async toggle(userId: string, input: ToggleFavoriteInput) {
    const existing = await minutoPrismaClient.favorite.findUnique({
      where: {
        userId_sport_entityType_entityId: {
          userId,
          sport: input.sport,
          entityType: input.entityType,
          entityId: input.entityId,
        },
      },
    });

    if (existing) {
      await minutoPrismaClient.favorite.delete({ where: { id: existing.id } });
      await userNotificationSettingsService.syncFavoriteToggleByUserId({
        userId,
        favorite: input,
        action: "removed",
      });
      return { action: "removed" as const };
    }

    await minutoPrismaClient.favorite.create({
      data: {
        userId,
        sport: input.sport,
        entityType: input.entityType,
        entityId: input.entityId,
        metadata: input.metadata as any,
      },
    });
    await userNotificationSettingsService.syncFavoriteToggleByUserId({
      userId,
      favorite: input,
      action: "added",
    });
    return { action: "added" as const };
  },

  async sync(userId: string, input: SyncFavoritesInput): Promise<FavoritesBySport> {
    const { favoritesBySport } = input;

    for (const [sport, bucket] of Object.entries(favoritesBySport)) {
      if (!bucket) continue;

      for (const [bucketKey, entities] of Object.entries(bucket)) {
        const entityType = ENTITY_TYPE_MAP[bucketKey];
        if (!entityType || !entities || typeof entities !== "object") continue;

        for (const [idStr, metadata] of Object.entries(entities)) {
          const entityId = parseInt(idStr, 10);
          if (isNaN(entityId)) continue;

          await minutoPrismaClient.favorite.upsert({
            where: {
              userId_sport_entityType_entityId: {
                userId,
                sport,
                entityType,
                entityId,
              },
            },
            create: {
              userId,
              sport,
              entityType,
              entityId,
              metadata: (metadata ?? {}) as any,
            },
            update: {
              metadata: (metadata ?? {}) as any,
            },
          });

          if (sport === "football" && (entityType === "match" || entityType === "team" || entityType === "league")) {
            await userNotificationSettingsService.syncFavoriteToggleByUserId({
              userId,
              favorite: {
                sport,
                entityType,
                entityId,
                metadata: (metadata ?? {}) as Record<string, unknown>,
              },
              action: "added",
            });
          }
        }
      }
    }

    return this.getByUserId(userId);
  },
};
