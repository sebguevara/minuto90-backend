import { Elysia, t } from "elysia";
import { categoryService } from "../application/category.service";
import { requireAdmin } from "../../../shared/middleware/admin-guard";
import { logError } from "../../../shared/logging/logger";

export const categoryRoutes = new Elysia({ prefix: "/api/news/categories" })
  // List categories — public (active only) or admin (all with ?admin=true)
  .get(
    "/",
    async ({ query, request, set }) => {
      try {
        const isAdmin = query.admin === "true";

        if (isAdmin) {
          const clerkId = request.headers.get("x-clerk-user-id");
          const guard = await requireAdmin(clerkId);
          if (!guard.ok) {
            set.status = guard.status;
            return { error: guard.error };
          }
          const items = await categoryService.listAll();
          return { data: items };
        }

        const items = await categoryService.list();
        return { data: items };
      } catch (err: any) {
        logError("categories.list.failed", { err: err?.message ?? String(err) });
        set.status = 500;
        return { error: "Internal server error" };
      }
    },
    {
      query: t.Object({
        admin: t.Optional(t.String()),
      }),
      detail: { tags: ["News"], summary: "List news categories" },
    }
  )

  // Create (admin only)
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

        const category = await categoryService.create(body);
        set.status = 201;
        return { data: category };
      } catch (err: any) {
        if (err?.code === "P2002") {
          set.status = 409;
          return { error: "Slug already exists" };
        }
        logError("categories.create.failed", { err: err?.message ?? String(err) });
        set.status = 500;
        return { error: "Internal server error" };
      }
    },
    {
      body: t.Object({
        name: t.String({ minLength: 1 }),
        slug: t.String({ minLength: 1 }),
        color: t.Optional(t.Nullable(t.String())),
        sortOrder: t.Optional(t.Number()),
      }),
      detail: { tags: ["News"], summary: "Create a news category (admin only)" },
    }
  )

  // Update (admin only)
  .patch(
    "/:id",
    async ({ params, body, request, set }) => {
      try {
        const clerkId = request.headers.get("x-clerk-user-id");
        const guard = await requireAdmin(clerkId);
        if (!guard.ok) {
          set.status = guard.status;
          return { error: guard.error };
        }

        const existing = await categoryService.getById(params.id);
        if (!existing) {
          set.status = 404;
          return { error: "Category not found" };
        }

        const category = await categoryService.update(params.id, body);
        return { data: category };
      } catch (err: any) {
        if (err?.code === "P2002") {
          set.status = 409;
          return { error: "Slug already exists" };
        }
        logError("categories.update.failed", { err: err?.message ?? String(err) });
        set.status = 500;
        return { error: "Internal server error" };
      }
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        name: t.Optional(t.String({ minLength: 1 })),
        slug: t.Optional(t.String({ minLength: 1 })),
        color: t.Optional(t.Nullable(t.String())),
        sortOrder: t.Optional(t.Number()),
        isActive: t.Optional(t.Boolean()),
      }),
      detail: { tags: ["News"], summary: "Update a news category (admin only)" },
    }
  )

  // Delete (admin only — hard delete, fails if news linked)
  .delete(
    "/:id",
    async ({ params, request, set }) => {
      try {
        const clerkId = request.headers.get("x-clerk-user-id");
        const guard = await requireAdmin(clerkId);
        if (!guard.ok) {
          set.status = guard.status;
          return { error: guard.error };
        }

        const existing = await categoryService.getById(params.id);
        if (!existing) {
          set.status = 404;
          return { error: "Category not found" };
        }

        await categoryService.delete(params.id);
        return { data: { deleted: true } };
      } catch (err: any) {
        if (err?.message === "CATEGORY_HAS_NEWS") {
          set.status = 409;
          return { error: "Cannot delete category with linked news articles" };
        }
        logError("categories.delete.failed", { err: err?.message ?? String(err) });
        set.status = 500;
        return { error: "Internal server error" };
      }
    },
    {
      params: t.Object({ id: t.String() }),
      detail: { tags: ["News"], summary: "Delete a news category (admin only)" },
    }
  );
