import { minutoPrismaClient } from "../../../lib/minuto-client";
import type { CreateUserFromClerkInput, UpdateUserFromClerkInput } from "../domain/user.types";

export const userService = {
  async createFromClerk(input: CreateUserFromClerkInput) {
    return minutoPrismaClient.user.create({
      data: {
        clerkId: input.clerkId,
        email: input.email ?? undefined,
        name: input.name ?? undefined,
        imageUrl: input.imageUrl ?? undefined,
      },
    });
  },

  async updateFromClerk(clerkId: string, input: UpdateUserFromClerkInput) {
    return minutoPrismaClient.user.update({
      where: { clerkId },
      data: {
        email: input.email ?? undefined,
        name: input.name ?? undefined,
        imageUrl: input.imageUrl ?? undefined,
      },
    });
  },

  async deactivateByClerkId(clerkId: string) {
    return minutoPrismaClient.user.update({
      where: { clerkId },
      data: { isActive: false },
    });
  },

  async findByClerkId(clerkId: string) {
    return minutoPrismaClient.user.findUnique({
      where: { clerkId },
    });
  },
};
