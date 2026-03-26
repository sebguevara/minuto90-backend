import { minutoPrismaClient } from "../../../lib/minuto-client";
import type { CreatePostInput, UpdatePostInput } from "../domain/post.types";

const db = minutoPrismaClient;

export const postService = {
  async list(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      db.post.findMany({
        where: { isDeleted: false },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: { author: { select: { id: true, name: true, imageUrl: true } } },
      }),
      db.post.count({ where: { isDeleted: false } }),
    ]);
    return { items, total, page, limit };
  },

  async getById(id: string) {
    return db.post.findFirst({
      where: { id, isDeleted: false },
      include: { author: { select: { id: true, name: true, imageUrl: true } } },
    });
  },

  async create(input: CreatePostInput) {
    return db.post.create({
      data: {
        content: input.content,
        imageUrl: input.imageUrl ?? null,
        authorId: input.authorId ?? null,
      },
    });
  },

  async update(id: string, input: UpdatePostInput) {
    return db.post.update({
      where: { id },
      data: {
        ...(input.content !== undefined && { content: input.content }),
        ...(input.imageUrl !== undefined && { imageUrl: input.imageUrl }),
      },
    });
  },

  async softDelete(id: string) {
    return db.post.update({
      where: { id },
      data: { isDeleted: true },
    });
  },
};
