import { Elysia, t } from "elysia";
import { favoritesService } from "../application/favorites.service";
import { userService } from "../../users/application/user.service";
import { logError } from "../../../shared/logging/logger";

export const favoritesRoutes = new Elysia()
  .get(
    "/api/favorites/:clerkId",
    async ({ params, set }) => {
      try {
        const user = await userService.findByClerkId(params.clerkId);
        if (!user) {
          set.status = 404;
          return { error: "User not found" };
        }
        const data = await favoritesService.getByUserId(user.id);
        return { data };
      } catch (err: any) {
        logError("favorites.get.failed", { err: err?.message ?? String(err) });
        set.status = 500;
        return { error: "Internal server error" };
      }
    },
    {
      detail: { tags: ["Favorites"], summary: "Get all favorites for a user" },
      params: t.Object({ clerkId: t.String() }),
    }
  )
  .post(
    "/api/favorites/:clerkId/toggle",
    async ({ params, body, set }) => {
      try {
        const user = await userService.findByClerkId(params.clerkId);
        if (!user) {
          set.status = 404;
          return { error: "User not found" };
        }
        const result = await favoritesService.toggle(user.id, body);
        return { data: result };
      } catch (err: any) {
        logError("favorites.toggle.failed", { err: err?.message ?? String(err) });
        set.status = 500;
        return { error: "Internal server error" };
      }
    },
    {
      detail: { tags: ["Favorites"], summary: "Toggle a favorite" },
      params: t.Object({ clerkId: t.String() }),
      body: t.Object({
        sport: t.String(),
        entityType: t.String(),
        entityId: t.Number(),
        metadata: t.Any(),
      }),
    }
  )
  .post(
    "/api/favorites/:clerkId/sync",
    async ({ params, body, set }) => {
      try {
        const user = await userService.findByClerkId(params.clerkId);
        if (!user) {
          set.status = 404;
          return { error: "User not found" };
        }
        const data = await favoritesService.sync(user.id, body);
        return { data };
      } catch (err: any) {
        logError("favorites.sync.failed", { err: err?.message ?? String(err) });
        set.status = 500;
        return { error: "Internal server error" };
      }
    },
    {
      detail: { tags: ["Favorites"], summary: "Sync favorites from client" },
      params: t.Object({ clerkId: t.String() }),
      body: t.Object({
        favoritesBySport: t.Any(),
      }),
    }
  );
