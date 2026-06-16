import { minutoPrismaClient } from "../../../lib/minuto-client";
import type { CreateCategoryInput, UpdateCategoryInput } from "../domain/news.types";

const db = minutoPrismaClient;

export const categoryService = {
  async list() {
    return db.newsCategory.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
        color: true,
        sortOrder: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            news: {
              where: {
                isDeleted: false,
              },
            },
          },
        },
      },
    });
  },

  async listAll() {
    return db.newsCategory.findMany({
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
        color: true,
        sortOrder: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            news: {
              where: {
                isDeleted: false,
              },
            },
          },
        },
      },
    });
  },

  async getById(id: string) {
    return db.newsCategory.findUnique({ where: { id } });
  },

  /**
   * Find an existing category by slug or create it. Used by the AI post-match
   * news generator to ensure a default category exists (e.g. "resultados").
   */
  async findOrCreate(input: { name: string; slug: string; color?: string | null }) {
    const slug = input.slug.trim();
    if (!slug) throw new Error("CATEGORY_SLUG_EMPTY");

    const existing = await db.newsCategory.findUnique({ where: { slug } });
    if (existing) return existing;

    try {
      return await db.newsCategory.create({
        data: {
          name: input.name.trim() || slug,
          slug,
          color: input.color ?? null,
          sortOrder: 0,
        },
      });
    } catch (err: any) {
      if (err?.code === "P2002") {
        const again = await db.newsCategory.findUnique({ where: { slug } });
        if (again) return again;
      }
      throw err;
    }
  },

  async create(input: CreateCategoryInput) {
    return db.newsCategory.create({
      data: {
        name: input.name,
        slug: input.slug,
        color: input.color ?? null,
        sortOrder: input.sortOrder ?? 0,
      },
    });
  },

  async update(id: string, input: UpdateCategoryInput) {
    return db.newsCategory.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.slug !== undefined && { slug: input.slug }),
        ...(input.color !== undefined && { color: input.color }),
        ...(input.sortOrder !== undefined && { sortOrder: input.sortOrder }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
      },
    });
  },

  async delete(id: string) {
    const linkedCount = await db.news.count({ where: { categoryId: id } });
    if (linkedCount > 0) {
      throw new Error("CATEGORY_HAS_NEWS");
    }
    return db.newsCategory.delete({ where: { id } });
  },
};
