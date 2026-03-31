import { userService } from "../../features/users/application/user.service";

export async function requireAdmin(clerkId: string | null | undefined): Promise<{ ok: true; userId: string } | { ok: false; status: number; error: string }> {
  if (!clerkId) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  const user = await userService.findByClerkId(clerkId);
  if (!user) {
    return { ok: false, status: 404, error: "User not found" };
  }

  if ((user as any).role !== "admin") {
    return { ok: false, status: 403, error: "Forbidden" };
  }

  return { ok: true, userId: user.id };
}
