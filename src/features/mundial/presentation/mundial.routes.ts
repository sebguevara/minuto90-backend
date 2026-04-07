import { Elysia, t } from "elysia";
import { mundialPronosticoService } from "../application/mundial-pronostico.service";
import { userService } from "../../users/application/user.service";
import { logError } from "../../../shared/logging/logger";

async function requireUser(
  clerkId: string | null | undefined
): Promise<
  | { ok: true; userId: string }
  | { ok: false; status: number; error: string }
> {
  if (!clerkId) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }
  const user = await userService.findOrCreateByClerkId(clerkId);
  return { ok: true, userId: user.id };
}

export const mundialRoutes = new Elysia({ prefix: "/api/mundial" })
  // Get own pronostico (auth required)
  .get(
    "/pronostico",
    async ({ request, set }) => {
      try {
        const clerkId = request.headers.get("x-clerk-user-id");
        const auth = await requireUser(clerkId);
        if (!auth.ok) {
          set.status = auth.status;
          return { error: auth.error };
        }

        const pronostico = await mundialPronosticoService.get(auth.userId);
        return {
          data: {
            pronostico,
            isLocked: mundialPronosticoService.isLocked(),
          },
        };
      } catch (err: any) {
        logError("mundial.pronostico.get.failed", {
          err: err?.message ?? String(err),
        });
        set.status = 500;
        return { error: "Internal server error" };
      }
    },
    {
      detail: {
        tags: ["Mundial"],
        summary: "Get own Mundial 2026 pronostico (auth required)",
      },
    }
  )

  // Save/update own pronostico (auth required)
  .put(
    "/pronostico",
    async ({ body, request, set }) => {
      try {
        const clerkId = request.headers.get("x-clerk-user-id");
        const auth = await requireUser(clerkId);
        if (!auth.ok) {
          set.status = auth.status;
          return { error: auth.error };
        }

        if (mundialPronosticoService.isLocked()) {
          set.status = 423;
          return { error: "Los pronósticos están cerrados" };
        }

        const pronostico = await mundialPronosticoService.save(
          auth.userId,
          body.bracket as any
        );
        return { data: pronostico };
      } catch (err: any) {
        if (err?.message === "LOCKED") {
          set.status = 423;
          return { error: "Los pronósticos están cerrados" };
        }
        logError("mundial.pronostico.save.failed", {
          err: err?.message ?? String(err),
        });
        set.status = 500;
        return { error: "Internal server error" };
      }
    },
    {
      body: t.Object({
        bracket: t.Any(),
      }),
      detail: {
        tags: ["Mundial"],
        summary: "Save Mundial 2026 pronostico (auth required)",
      },
    }
  )

  // Ranking (public)
  .get(
    "/ranking",
    async ({ query, set }) => {
      try {
        const page = Math.max(1, Number(query.page) || 1);
        const limit = Math.min(100, Math.max(1, Number(query.limit) || 50));
        const result = await mundialPronosticoService.getRanking(page, limit);
        return { data: result };
      } catch (err: any) {
        logError("mundial.ranking.failed", { err: err?.message ?? String(err) });
        set.status = 500;
        return { error: "Internal server error" };
      }
    },
    {
      query: t.Object({
        page: t.Optional(t.String()),
        limit: t.Optional(t.String()),
      }),
      detail: {
        tags: ["Mundial"],
        summary: "Get Mundial 2026 pronostico ranking (public)",
      },
    }
  );
