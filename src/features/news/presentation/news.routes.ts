import { Elysia, t } from "elysia";
import { newsService } from "../application/news.service";
import { logError } from "../../../shared/logging/logger";

export const newsRoutes = new Elysia({ prefix: "/api/news" })
  // List news (paginated)
  .get(
    "/",
    async ({ query, set }) => {
      try {
        const page = Math.max(1, Number(query.page) || 1);
        const limit = Math.min(50, Math.max(1, Number(query.limit) || 20));
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

  // Create
  .post(
    "/",
    async ({ body, set }) => {
      try {
        const news = await newsService.create(body);
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
        authorId: t.Optional(t.Nullable(t.String())),
        publishedAt: t.Optional(t.Nullable(t.String())),
      }),
      detail: { tags: ["News"], summary: "Create a news article" },
    }
  )

  // Update
  .patch(
    "/:id",
    async ({ params, body, set }) => {
      try {
        const existing = await newsService.getById(params.id);
        if (!existing) {
          set.status = 404;
          return { error: "News not found" };
        }
        const news = await newsService.update(params.id, {
          ...body,
          publishedAt: body.publishedAt ? new Date(body.publishedAt) : undefined,
        });
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
        publishedAt: t.Optional(t.Nullable(t.String())),
      }),
      detail: { tags: ["News"], summary: "Update a news article" },
    }
  )

  // Soft delete
  .delete(
    "/:id",
    async ({ params, set }) => {
      try {
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
      detail: { tags: ["News"], summary: "Soft delete a news article" },
    }
  );
