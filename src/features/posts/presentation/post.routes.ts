import { Elysia, t } from "elysia";
import { postService } from "../application/post.service";
import { logError } from "../../../shared/logging/logger";

export const postRoutes = new Elysia({ prefix: "/api/posts" })
  // List posts (paginated)
  .get(
    "/",
    async ({ query, set }) => {
      try {
        const page = Math.max(1, Number(query.page) || 1);
        const limit = Math.min(50, Math.max(1, Number(query.limit) || 20));
        const result = await postService.list(page, limit);
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
    async ({ body, set }) => {
      try {
        const post = await postService.create(body);
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
      }),
      detail: { tags: ["Posts"], summary: "Create a post" },
    }
  )

  // Update
  .patch(
    "/:id",
    async ({ params, body, set }) => {
      try {
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
      }),
      detail: { tags: ["Posts"], summary: "Update a post" },
    }
  )

  // Soft delete
  .delete(
    "/:id",
    async ({ params, set }) => {
      try {
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
