import { minutoPrismaClient } from "../../../lib/minuto-client";
import type { CreateNewsInput, UpdateNewsInput } from "../domain/news.types";

const db = minutoPrismaClient;

export const newsService = {
  async list(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      db.news.findMany({
        where: { isDeleted: false },
        orderBy: { publishedAt: "desc" },
        skip,
        take: limit,
        include: { author: { select: { id: true, name: true, imageUrl: true } } },
      }),
      db.news.count({ where: { isDeleted: false } }),
    ]);
    return { items, total, page, limit };
  },

  async getById(id: string) {
    return db.news.findFirst({
      where: { id, isDeleted: false },
      include: { author: { select: { id: true, name: true, imageUrl: true } } },
    });
  },

  async getBySlug(slug: string) {
    return db.news.findFirst({
      where: { slug, isDeleted: false },
      include: { author: { select: { id: true, name: true, imageUrl: true } } },
    });
  },

  async create(input: CreateNewsInput) {
    return db.news.create({
      data: {
        title: input.title,
        slug: input.slug,
        summary: input.summary ?? null,
        body: input.body,
        imageUrl: input.imageUrl ?? null,
        authorId: input.authorId ?? null,
        publishedAt: input.publishedAt ?? new Date(),
      },
    });
  },

  async update(id: string, input: UpdateNewsInput) {
    return db.news.update({
      where: { id },
      data: {
        ...(input.title !== undefined && { title: input.title }),
        ...(input.slug !== undefined && { slug: input.slug }),
        ...(input.summary !== undefined && { summary: input.summary }),
        ...(input.body !== undefined && { body: input.body }),
        ...(input.imageUrl !== undefined && { imageUrl: input.imageUrl }),
        ...(input.publishedAt !== undefined && { publishedAt: input.publishedAt }),
      },
    });
  },

  async softDelete(id: string) {
    return db.news.update({
      where: { id },
      data: { isDeleted: true },
    });
  },
};
