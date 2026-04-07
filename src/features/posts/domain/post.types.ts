export type PostGalleryItem = {
  url: string;
  alt?: string | null;
};

export type CreatePostInput = {
  content: string;
  imageUrl?: string | null;
  authorId?: string | null;
  context?: string | null;
  type?: string | null;
  category?: string | null;
  countryCode?: string | null;
  gallery?: PostGalleryItem[] | null;
  displayOrder?: number | null;
};

export type UpdatePostInput = {
  content?: string;
  imageUrl?: string | null;
  context?: string | null;
  type?: string | null;
  category?: string | null;
  countryCode?: string | null;
  gallery?: PostGalleryItem[] | null;
  displayOrder?: number | null;
};
