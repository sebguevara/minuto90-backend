export type CreateNewsInput = {
  title: string;
  slug: string;
  summary?: string | null;
  body: string;
  imageUrl?: string | null;
  authorId?: string | null;
  publishedAt?: Date;
};

export type UpdateNewsInput = {
  title?: string;
  slug?: string;
  summary?: string | null;
  body?: string;
  imageUrl?: string | null;
  publishedAt?: Date;
};
