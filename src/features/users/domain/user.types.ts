export type CreateUserFromClerkInput = {
  clerkId: string;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  name?: string | null;
  imageUrl?: string | null;
};

export type UpdateUserFromClerkInput = {
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  name?: string | null;
  imageUrl?: string | null;
};
