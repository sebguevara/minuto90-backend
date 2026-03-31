import { Elysia, t } from "elysia";
import { newsService } from "../application/news.service";
import { pushService } from "../../push/application/push.service";
import { requireAdmin } from "../../../shared/middleware/admin-guard";
import { logError } from "../../../shared/logging/logger";

export const newsRoutes = new Elysia({ prefix: "/api/news" })
  // Admin overview
  .get(
    "/admin/overview",
    async ({ request, set }) => {
      try {
        const clerkId = request.headers.get("x-clerk-user-id");
        const guard = await requireAdmin(clerkId);
        if (!guard.ok) {
          set.status = guard.status;
          return { error: guard.error };
        }

        const overview = await newsService.getAdminOverview();
        return { data: overview };
      } catch (err: any) {
        logError("news.adminOverview.failed", { err: err?.message ?? String(err) });
        set.status = 500;
        return { error: "Internal server error" };
      }
    },
    {
      detail: { tags: ["News"], summary: "Get news admin overview" },
    }
  )
  // List news (paginated) — public (filtered by date) or admin (all)
  .get(
    "/",
    async ({ query, request, set }) => {
      try {
        const page = Math.max(1, Number(query.page) || 1);
        const limit = Math.min(50, Math.max(1, Number(query.limit) || 20));
        const isAdmin = query.admin === "true";

        if (isAdmin) {
          const clerkId = request.headers.get("x-clerk-user-id");
          const guard = await requireAdmin(clerkId);
          if (!guard.ok) {
            set.status = guard.status;
            return { error: guard.error };
          }
          const result = await newsService.listAdmin(page, limit);
          return { data: result };
        }

        const result = await newsService.list(page, limit);
        return { data: result };
      } catch (err: any) {
        logError("news.list.failed", { err: err?.message ?? String(err) });
        set.status = 500;
        return { error: "Internal server error" };
      }
    },
    {
      query: t.Object({
        page: t.Optional(t.String()),
        limit: t.Optional(t.String()),
        admin: t.Optional(t.String()),
      }),
      detail: { tags: ["News"], summary: "List news articles" },
    }
  )

  // Get by ID
  .get(
    "/:id",
    async ({ params, set }) => {
      try {
        const news = await newsService.getById(params.id);
        if (!news) {
          set.status = 404;
          return { error: "News not found" };
        }
        return { data: news };
      } catch (err: any) {
        logError("news.getById.failed", { err: err?.message ?? String(err) });
        set.status = 500;
        return { error: "Internal server error" };
      }
    },
    {
      params: t.Object({ id: t.String() }),
      detail: { tags: ["News"], summary: "Get news article by ID" },
    }
  )

  // Get by slug
  .get(
    "/slug/:slug",
    async ({ params, set }) => {
      try {
        const news = await newsService.getBySlug(params.slug);
        if (!news) {
          set.status = 404;
          return { error: "News not found" };
        }
        return { data: news };
      } catch (err: any) {
        logError("news.getBySlug.failed", { err: err?.message ?? String(err) });
        set.status = 500;
        return { error: "Internal server error" };
      }
    },
    {
      params: t.Object({ slug: t.String() }),
      detail: { tags: ["News"], summary: "Get news article by slug" },
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

        const news = await newsService.create({
          ...body,
          authorId: guard.userId,
          featured: body.featured ?? false,
          publishFrom: body.publishFrom ? new Date(body.publishFrom) : null,
          publishTo: body.publishTo ? new Date(body.publishTo) : null,
          publishedAt: body.publishedAt ? new Date(body.publishedAt) : undefined,
          categoryId: body.categoryId ?? null,
        });
        try {
          await pushService.enqueueNewsPublicationPush(news.id);
        } catch (pushErr: any) {
          logError("news.push.enqueue_after_create.failed", {
            newsId: news.id,
            err: pushErr?.message ?? String(pushErr),
          });
        }
        set.status = 201;
        return { data: news };
      } catch (err: any) {
        if (err?.code === "P2002") {
          set.status = 409;
          return { error: "Slug already exists" };
        }
        logError("news.create.failed", { err: err?.message ?? String(err) });
        set.status = 500;
        return { error: "Internal server error" };
      }
    },
    {
      body: t.Object({
        title: t.String({ minLength: 1 }),
        slug: t.String({ minLength: 1 }),
        summary: t.Optional(t.Nullable(t.String())),
        body: t.String({ minLength: 1 }),
        imageUrl: t.Optional(t.Nullable(t.String())),
        featured: t.Optional(t.Boolean()),
        publishFrom: t.Optional(t.Nullable(t.String())),
        publishTo: t.Optional(t.Nullable(t.String())),
        publishedAt: t.Optional(t.Nullable(t.String())),
        categoryId: t.Optional(t.Nullable(t.String())),
      }),
      detail: { tags: ["News"], summary: "Create a news article (admin only)" },
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

        const existing = await newsService.getById(params.id);
        if (!existing) {
          set.status = 404;
          return { error: "News not found" };
        }
        const news = await newsService.update(params.id, {
          ...body,
          featured: body.featured,
          publishFrom: body.publishFrom !== undefined ? (body.publishFrom ? new Date(body.publishFrom) : null) : undefined,
          publishTo: body.publishTo !== undefined ? (body.publishTo ? new Date(body.publishTo) : null) : undefined,
          publishedAt: body.publishedAt ? new Date(body.publishedAt) : undefined,
          categoryId: body.categoryId !== undefined ? (body.categoryId ?? null) : undefined,
        });
        try {
          await pushService.enqueueNewsPublicationPush(news.id);
        } catch (pushErr: any) {
          logError("news.push.enqueue_after_update.failed", {
            newsId: news.id,
            err: pushErr?.message ?? String(pushErr),
          });
        }
        return { data: news };
      } catch (err: any) {
        if (err?.code === "P2002") {
          set.status = 409;
          return { error: "Slug already exists" };
        }
        logError("news.update.failed", { err: err?.message ?? String(err) });
        set.status = 500;
        return { error: "Internal server error" };
      }
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        title: t.Optional(t.String({ minLength: 1 })),
        slug: t.Optional(t.String({ minLength: 1 })),
        summary: t.Optional(t.Nullable(t.String())),
        body: t.Optional(t.String({ minLength: 1 })),
        imageUrl: t.Optional(t.Nullable(t.String())),
        featured: t.Optional(t.Boolean()),
        publishFrom: t.Optional(t.Nullable(t.String())),
        publishTo: t.Optional(t.Nullable(t.String())),
        publishedAt: t.Optional(t.Nullable(t.String())),
        categoryId: t.Optional(t.Nullable(t.String())),
      }),
      detail: { tags: ["News"], summary: "Update a news article (admin only)" },
    }
  )

  // Soft delete (admin only)
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

        const existing = await newsService.getById(params.id);
        if (!existing) {
          set.status = 404;
          return { error: "News not found" };
        }
        await newsService.softDelete(params.id);
        return { data: { deleted: true } };
      } catch (err: any) {
        logError("news.delete.failed", { err: err?.message ?? String(err) });
        set.status = 500;
        return { error: "Internal server error" };
      }
    },
    {
      params: t.Object({ id: t.String() }),
      detail: { tags: ["News"], summary: "Soft delete a news article (admin only)" },
    }
  )

  // Track view or click (public, no auth)
  .post(
    "/:id/track",
    async ({ params, body, set }) => {
      try {
        if (body.type === "view") {
          await newsService.trackView(params.id);
        } else {
          await newsService.trackClick(params.id);
        }
        return { data: { tracked: true } };
      } catch (err: any) {
        logError("news.track.failed", { err: err?.message ?? String(err) });
        set.status = 500;
        return { error: "Internal server error" };
      }
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        type: t.Union([t.Literal("view"), t.Literal("click")]),
      }),
      detail: { tags: ["News"], summary: "Track a view or click on a news article" },
    }
  );
