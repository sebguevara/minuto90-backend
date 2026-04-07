import { minutoPrismaClient } from "../../../lib/minuto-client";
import type { CreateUserFromClerkInput, UpdateUserFromClerkInput } from "../domain/user.types";

export const userService = {
  async createFromClerk(input: CreateUserFromClerkInput) {
    return minutoPrismaClient.user.upsert({
      where: { clerkId: input.clerkId },
      create: {
        clerkId: input.clerkId,
        email: input.email ?? undefined,
        firstName: input.firstName ?? undefined,
        lastName: input.lastName ?? undefined,
        name: input.name ?? undefined,
        imageUrl: input.imageUrl ?? undefined,
        isActive: true,
      },
      update: {
        email: input.email ?? undefined,
        firstName: input.firstName ?? undefined,
        lastName: input.lastName ?? undefined,
        name: input.name ?? undefined,
        imageUrl: input.imageUrl ?? undefined,
        isActive: true,
      },
    });
  },

  async updateFromClerk(clerkId: string, input: UpdateUserFromClerkInput) {
    return minutoPrismaClient.user.upsert({
      where: { clerkId },
      create: {
        clerkId,
        email: input.email ?? undefined,
        firstName: input.firstName ?? undefined,
        lastName: input.lastName ?? undefined,
        name: input.name ?? undefined,
        imageUrl: input.imageUrl ?? undefined,
        isActive: true,
      },
      update: {
        email: input.email ?? undefined,
        firstName: input.firstName ?? undefined,
        lastName: input.lastName ?? undefined,
        name: input.name ?? undefined,
        imageUrl: input.imageUrl ?? undefined,
        isActive: true,
      },
    });
  },

  async deactivateByClerkId(clerkId: string) {
    return minutoPrismaClient.user.updateMany({
      where: { clerkId },
      data: { isActive: false },
    });
  },

  async findByClerkId(clerkId: string) {
    return minutoPrismaClient.user.findUnique({
      where: { clerkId },
    });
  },

  async findOrCreateByClerkId(clerkId: string) {
    return minutoPrismaClient.user.upsert({
      where: { clerkId },
      create: {
        clerkId,
      },
      update: {},
    });
  },
};
