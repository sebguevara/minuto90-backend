export type CreatePostInput = {
  content: string;
  imageUrl?: string | null;
  authorId?: string | null;
  context?: string | null;
};

export type UpdatePostInput = {
  content?: string;
  imageUrl?: string | null;
  context?: string | null;
};
