import { Elysia, t } from "elysia";
import { postService } from "../application/post.service";
import { logError } from "../../../shared/logging/logger";
import { requireAdmin } from "../../../shared/middleware/admin-guard";

const galleryItemSchema = t.Object({
  url: t.String({ minLength: 1 }),
  alt: t.Optional(t.Nullable(t.String())),
});

export const postRoutes = new Elysia({ prefix: "/api/posts" })
  // List posts (paginated)
  .get(
    "/",
    async ({ query, headers, set }) => {
      try {
        const page = Math.max(1, Number(query.page) || 1);
        const limit = Math.min(50, Math.max(1, Number(query.limit) || 20));
        const isAdmin = query.admin === "true";

        if (isAdmin) {
          const clerkId = headers["x-clerk-user-id"];
          const guard = await requireAdmin(clerkId);
          if (!guard.ok) {
            set.status = guard.status;
            return { error: guard.error };
          }
        }

        const result = await postService.list(page, limit, {
          context: query.context ?? undefined,
          type: query.type ?? undefined,
          category: query.category ?? undefined,
          countryCode: query.countryCode?.toUpperCase() ?? undefined,
          includeDeleted: false,
        });
        return { data: result };
      } catch (err: any) {
        logError("posts.list.failed", { err: err?.message ?? String(err) });
        set.status = 500;
        return { error: "Internal server error" };
      }
    },
    {
      query: t.Object({
        page: t.Optional(t.String()),
        limit: t.Optional(t.String()),
        context: t.Optional(t.String()),
        type: t.Optional(t.String()),
        category: t.Optional(t.String()),
        countryCode: t.Optional(t.String()),
        admin: t.Optional(t.String()),
      }),
      detail: { tags: ["Posts"], summary: "List posts" },
    }
  )

  // Get by ID
  .get(
    "/:id",
    async ({ params, set }) => {
      try {
        const post = await postService.getById(params.id);
        if (!post) {
          set.status = 404;
          return { error: "Post not found" };
        }
        return { data: post };
      } catch (err: any) {
        logError("posts.getById.failed", { err: err?.message ?? String(err) });
        set.status = 500;
        return { error: "Internal server error" };
      }
    },
    {
      params: t.Object({ id: t.String() }),
      detail: { tags: ["Posts"], summary: "Get post by ID" },
    }
  )

  // Create
  .post(
    "/",
    async ({ body, headers, set }) => {
      try {
        const clerkId = headers["x-clerk-user-id"];
        const guard = await requireAdmin(clerkId);
        if (!guard.ok) {
          set.status = guard.status;
          return { error: guard.error };
        }

        const post = await postService.create({
          ...body,
          authorId: guard.userId,
        });
        set.status = 201;
        return { data: post };
      } catch (err: any) {
        logError("posts.create.failed", { err: err?.message ?? String(err) });
        set.status = 500;
        return { error: "Internal server error" };
      }
    },
    {
      body: t.Object({
        content: t.String({ minLength: 1 }),
        imageUrl: t.Optional(t.Nullable(t.String())),
        authorId: t.Optional(t.Nullable(t.String())),
        context: t.Optional(t.Nullable(t.String())),
        type: t.Optional(t.Nullable(t.String())),
        category: t.Optional(t.Nullable(t.String())),
        countryCode: t.Optional(t.Nullable(t.String())),
        gallery: t.Optional(t.Nullable(t.Array(galleryItemSchema))),
        displayOrder: t.Optional(t.Nullable(t.Number())),
      }),
      detail: { tags: ["Posts"], summary: "Create a post" },
    }
  )

  // Update
  .patch(
    "/:id",
    async ({ params, body, headers, set }) => {
      try {
        const clerkId = headers["x-clerk-user-id"];
        const guard = await requireAdmin(clerkId);
        if (!guard.ok) {
          set.status = guard.status;
          return { error: guard.error };
        }

        const existing = await postService.getById(params.id);
        if (!existing) {
          set.status = 404;
          return { error: "Post not found" };
        }
        const post = await postService.update(params.id, body);
        return { data: post };
      } catch (err: any) {
        logError("posts.update.failed", { err: err?.message ?? String(err) });
        set.status = 500;
        return { error: "Internal server error" };
      }
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        content: t.Optional(t.String({ minLength: 1 })),
        imageUrl: t.Optional(t.Nullable(t.String())),
        context: t.Optional(t.Nullable(t.String())),
        type: t.Optional(t.Nullable(t.String())),
        category: t.Optional(t.Nullable(t.String())),
        countryCode: t.Optional(t.Nullable(t.String())),
        gallery: t.Optional(t.Nullable(t.Array(galleryItemSchema))),
        displayOrder: t.Optional(t.Nullable(t.Number())),
      }),
      detail: { tags: ["Posts"], summary: "Update a post" },
    }
  )

  // Soft delete
  .delete(
    "/:id",
    async ({ params, headers, set }) => {
      try {
        const clerkId = headers["x-clerk-user-id"];
        const guard = await requireAdmin(clerkId);
        if (!guard.ok) {
          set.status = guard.status;
          return { error: guard.error };
        }

        const existing = await postService.getById(params.id);
        if (!existing) {
          set.status = 404;
          return { error: "Post not found" };
        }
        await postService.softDelete(params.id);
        return { data: { deleted: true } };
      } catch (err: any) {
        logError("posts.delete.failed", { err: err?.message ?? String(err) });
        set.status = 500;
        return { error: "Internal server error" };
      }
    },
    {
      params: t.Object({ id: t.String() }),
      detail: { tags: ["Posts"], summary: "Soft delete a post" },
    }
  );
