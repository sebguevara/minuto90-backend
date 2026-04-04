import { Elysia, t } from "elysia";
import { tagService } from "../application/tag.service";
import { requireAdmin } from "../../../shared/middleware/admin-guard";
import { logError } from "../../../shared/logging/logger";

export const tagRoutes = new Elysia({ prefix: "/api/tags" })
  .get(
    "/",
    async ({ request, set }) => {
      try {
        const clerkId = request.headers.get("x-clerk-user-id");
        const guard = await requireAdmin(clerkId);
        if (!guard.ok) {
          set.status = guard.status;
          return { error: guard.error };
        }

        const items = await tagService.list();
        return { data: items };
      } catch (err: any) {
        logError("tags.list.failed", { err: err?.message ?? String(err) });
        set.status = 500;
        return { error: "Internal server error" };
      }
    },
    {
      detail: { tags: ["News"], summary: "List news tags (admin only)" },
    }
  )
  .post(
    "/",
    async ({ body, request, set }) => {
      try {
        const clerkId = request.headers.get("x-clerk-user-id");
        const guard = await requireAdmin(clerkId);
        if (!guard.ok) {
          set.status = guard.status;
          return { error: guard.error };
        }

        const tag = await tagService.findOrCreate({
          name: body.name,
          slug: body.slug ?? "",
        });
        set.status = 201;
        return { data: tag };
      } catch (err: any) {
        if (err?.message === "TAG_SLUG_EMPTY") {
          set.status = 400;
          return { error: "Invalid tag name" };
        }
        if (err?.code === "P2002") {
          set.status = 409;
          return { error: "Tag slug conflict" };
        }
        logError("tags.create.failed", { err: err?.message ?? String(err) });
        set.status = 500;
        return { error: "Internal server error" };
      }
    },
    {
      body: t.Object({
        name: t.String({ minLength: 1 }),
        slug: t.Optional(t.String()),
      }),
      detail: { tags: ["News"], summary: "Create or reuse news tag by slug (admin only)" },
    }
  );
