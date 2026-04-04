import { minutoPrismaClient } from "../../../lib/minuto-client";

const db = minutoPrismaClient;

function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export const tagService = {
  async list() {
    return db.newsTag.findMany({
      orderBy: [{ name: "asc" }],
      select: { id: true, name: true, slug: true },
    });
  },

  /**
   * Find existing tag by slug or create with the given display name.
   */
  async findOrCreate(input: { name: string; slug: string }) {
    const slug = input.slug.trim() || slugify(input.name);
    if (!slug) {
      throw new Error("TAG_SLUG_EMPTY");
    }

    const existing = await db.newsTag.findUnique({
      where: { slug },
      select: { id: true, name: true, slug: true },
    });
    if (existing) {
      return existing;
    }

    const name = input.name.trim() || slug;
    try {
      return await db.newsTag.create({
        data: { name, slug },
        select: { id: true, name: true, slug: true },
      });
    } catch (err: any) {
      if (err?.code === "P2002") {
        const again = await db.newsTag.findUnique({
          where: { slug },
          select: { id: true, name: true, slug: true },
        });
        if (again) return again;
      }
      throw err;
    }
  },
};
