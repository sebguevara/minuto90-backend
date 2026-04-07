export type CreateNewsInput = {
  title: string;
  slug: string;
  summary?: string | null;
  body: string;
  imageUrl?: string | null;
  authorId?: string | null;
  authorName?: string | null;
  featured?: boolean;
  isHidden?: boolean;
  isMundial?: boolean;
  publishFrom?: Date | null;
  publishTo?: Date | null;
  publishedAt?: Date;
  categoryId: string;
  tagIds?: string[];
};

export type UpdateNewsInput = {
  title?: string;
  slug?: string;
  summary?: string | null;
  body?: string;
  imageUrl?: string | null;
  authorName?: string | null;
  featured?: boolean;
  isHidden?: boolean;
  isMundial?: boolean;
  publishFrom?: Date | null;
  publishTo?: Date | null;
  publishedAt?: Date;
  categoryId?: string;
  tagIds?: string[];
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
