import { minutoPrismaClient } from "../../../lib/minuto-client";
import type { Prisma } from "../../../../prisma-minuto/minuto-client-types/client";
import type { CreateNewsInput, UpdateNewsInput } from "../domain/news.types";

const db = minutoPrismaClient;

export function buildPublicNewsWhere(now = new Date()): Prisma.NewsWhereInput {
  return {
    isDeleted: false,
    publishedAt: { lte: now },
    OR: [
      { publishFrom: null, publishTo: null },
      { publishFrom: { lte: now }, publishTo: null },
      { publishFrom: null, publishTo: { gte: now } },
      { publishFrom: { lte: now }, publishTo: { gte: now } },
    ],
  };
}

export function isNewsPubliclyVisible(
  news: {
    isDeleted: boolean;
    publishedAt: Date;
    publishFrom: Date | null;
    publishTo: Date | null;
  },
  now = new Date()
) {
  if (news.isDeleted) return false;
  if (news.publishedAt.getTime() > now.getTime()) return false;
  if (news.publishFrom && news.publishFrom.getTime() > now.getTime()) return false;
  if (news.publishTo && news.publishTo.getTime() < now.getTime()) return false;
  return true;
}

export const newsService = {
  async list(page = 1, limit = 20) {
    const now = new Date();
    const skip = (page - 1) * limit;
    const publicWhere = buildPublicNewsWhere(now);
    const [items, total] = await Promise.all([
      db.news.findMany({
        where: publicWhere,
        orderBy: { publishedAt: "desc" },
        skip,
        take: limit,
        include: {
          author: { select: { id: true, name: true, imageUrl: true } },
          category: { select: { id: true, name: true, slug: true, color: true } },
        },
      }),
      db.news.count({ where: publicWhere }),
    ]);
    return { items, total, page, limit };
  },

  async listAdmin(page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      db.news.findMany({
        where: { isDeleted: false },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          author: { select: { id: true, name: true, imageUrl: true } },
          category: { select: { id: true, name: true, slug: true, color: true } },
        },
      }),
      db.news.count({ where: { isDeleted: false } }),
    ]);
    return { items, total, page, limit };
  },

  async getById(id: string) {
    return db.news.findFirst({
      where: { id, isDeleted: false },
      include: {
        author: { select: { id: true, name: true, imageUrl: true } },
        category: { select: { id: true, name: true, slug: true, color: true } },
      },
    });
  },

  async getBySlug(slug: string) {
    return db.news.findFirst({
      where: { slug, ...buildPublicNewsWhere(new Date()) },
      include: {
        author: { select: { id: true, name: true, imageUrl: true } },
        category: { select: { id: true, name: true, slug: true, color: true } },
      },
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
        featured: input.featured ?? false,
        publishFrom: input.publishFrom ?? null,
        publishTo: input.publishTo ?? null,
        publishedAt: input.publishedAt ?? new Date(),
        categoryId: input.categoryId ?? null,
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
        ...(input.featured !== undefined && { featured: input.featured }),
        ...(input.publishFrom !== undefined && { publishFrom: input.publishFrom }),
        ...(input.publishTo !== undefined && { publishTo: input.publishTo }),
        ...(input.publishedAt !== undefined && { publishedAt: input.publishedAt }),
        ...(input.categoryId !== undefined && { categoryId: input.categoryId }),
      },
    });
  },

  async softDelete(id: string) {
    return db.news.update({
      where: { id },
      data: { isDeleted: true },
    });
  },

  async trackView(id: string) {
    return db.news.update({
      where: { id },
      data: { viewCount: { increment: 1 } },
    });
  },

  async trackClick(id: string) {
    return db.news.update({
      where: { id },
      data: { clickCount: { increment: 1 } },
    });
  },

  async getAdminOverview() {
    const now = new Date();
    const publicWhere = buildPublicNewsWhere(now);

    const [
      totalNews,
      publishedNews,
      scheduledNews,
      featuredNews,
      totals,
      totalCategories,
      activeCategories,
      topByViews,
      topByClicks,
      recentNews,
      categoryBreakdown,
    ] = await Promise.all([
      db.news.count({ where: { isDeleted: false } }),
      db.news.count({
        where: publicWhere,
      }),
      db.news.count({
        where: {
          isDeleted: false,
          OR: [{ publishedAt: { gt: now } }, { publishFrom: { gt: now } }],
        },
      }),
      db.news.count({
        where: {
          isDeleted: false,
          featured: true,
        },
      }),
      db.news.aggregate({
        where: { isDeleted: false },
        _sum: {
          viewCount: true,
          clickCount: true,
        },
      }),
      db.newsCategory.count(),
      db.newsCategory.count({ where: { isActive: true } }),
      db.news.findMany({
        where: { isDeleted: false },
        orderBy: [{ viewCount: "desc" }, { clickCount: "desc" }, { publishedAt: "desc" }],
        take: 5,
        include: {
          category: { select: { id: true, name: true, slug: true, color: true } },
        },
      }),
      db.news.findMany({
        where: { isDeleted: false },
        orderBy: [{ clickCount: "desc" }, { viewCount: "desc" }, { publishedAt: "desc" }],
        take: 5,
        include: {
          category: { select: { id: true, name: true, slug: true, color: true } },
        },
      }),
      db.news.findMany({
        where: { isDeleted: false },
        orderBy: { createdAt: "desc" },
        take: 6,
        include: {
          category: { select: { id: true, name: true, slug: true, color: true } },
          author: { select: { id: true, name: true, imageUrl: true } },
        },
      }),
      db.newsCategory.findMany({
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: {
          id: true,
          name: true,
          slug: true,
          color: true,
          isActive: true,
          sortOrder: true,
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
      }),
    ]);

    return {
      metrics: {
        totalNews,
        publishedNews,
        scheduledNews,
        featuredNews,
        totalCategories,
        activeCategories,
        totalViews: totals._sum.viewCount ?? 0,
        totalClicks: totals._sum.clickCount ?? 0,
      },
      topByViews,
      topByClicks,
      recentNews,
      categoryBreakdown,
    };
  },
};
