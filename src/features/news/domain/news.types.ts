export type CreateNewsInput = {
  title: string;
  slug: string;
  summary?: string | null;
  body: string;
  imageUrl?: string | null;
  authorId?: string | null;
  featured?: boolean;
  publishFrom?: Date | null;
  publishTo?: Date | null;
  publishedAt?: Date;
  categoryId?: string | null;
};

export type UpdateNewsInput = {
  title?: string;
  slug?: string;
  summary?: string | null;
  body?: string;
  imageUrl?: string | null;
  featured?: boolean;
  publishFrom?: Date | null;
  publishTo?: Date | null;
  publishedAt?: Date;
  categoryId?: string | null;
};

export type CreateCategoryInput = {
  name: string;
  slug: string;
  color?: string | null;
  sortOrder?: number;
};

export type UpdateCategoryInput = {
  name?: string;
  slug?: string;
  color?: string | null;
  sortOrder?: number;
  isActive?: boolean;
};
