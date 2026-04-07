import { minutoPrismaClient } from "../../../lib/minuto-client";
import type { CreatePostInput, UpdatePostInput } from "../domain/post.types";

const db = minutoPrismaClient;

export const postService = {
  async list(
    page = 1,
    limit = 20,
    filters?: {
      context?: string;
      type?: string;
      category?: string;
      countryCode?: string;
      includeDeleted?: boolean;
    }
  ) {
    const skip = (page - 1) * limit;
    const where = {
      ...(filters?.includeDeleted ? {} : { isDeleted: false }),
      ...(filters?.context !== undefined && { context: filters.context }),
      ...(filters?.type !== undefined && { type: filters.type }),
      ...(filters?.category !== undefined && { category: filters.category }),
      ...(filters?.countryCode !== undefined && { countryCode: filters.countryCode }),
    };
    const [items, total] = await Promise.all([
      db.post.findMany({
        where,
        orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }],
        skip,
        take: limit,
        include: { author: { select: { id: true, name: true, imageUrl: true } } },
      }),
      db.post.count({ where }),
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
        context: input.context ?? null,
        type: input.type ?? "general",
        category: input.category ?? null,
        countryCode: input.countryCode?.toUpperCase() ?? null,
        gallery: input.gallery ?? null,
        displayOrder: input.displayOrder ?? 0,
      },
    });
  },

  async update(id: string, input: UpdatePostInput) {
    return db.post.update({
      where: { id },
      data: {
        ...(input.content !== undefined && { content: input.content }),
        ...(input.imageUrl !== undefined && { imageUrl: input.imageUrl }),
        ...(input.context !== undefined && { context: input.context }),
        ...(input.type !== undefined && { type: input.type }),
        ...(input.category !== undefined && { category: input.category }),
        ...(input.countryCode !== undefined && { countryCode: input.countryCode?.toUpperCase() ?? null }),
        ...(input.gallery !== undefined && { gallery: input.gallery }),
        ...(input.displayOrder !== undefined && { displayOrder: input.displayOrder ?? 0 }),
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
