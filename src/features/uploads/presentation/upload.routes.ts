import { Elysia, t } from "elysia";
import { uploadToR2 } from "../../../lib/r2-client";
import { requireAdmin } from "../../../shared/middleware/admin-guard";
import { logError, logInfo } from "../../../shared/logging/logger";

const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];

export const uploadRoutes = new Elysia().post(
  "/api/uploads/image",
  async ({ request, set }) => {
    try {
      const clerkId = request.headers.get("x-clerk-user-id");
      const guard = await requireAdmin(clerkId);
      if (!guard.ok) {
        set.status = guard.status;
        return { error: guard.error };
      }

      const formData = await request.formData();
      const file = formData.get("file");

      if (!file || !(file instanceof File)) {
        set.status = 400;
        return { error: "No file provided" };
      }

      if (!ALLOWED_TYPES.includes(file.type)) {
        set.status = 400;
        return { error: `Invalid file type: ${file.type}. Allowed: ${ALLOWED_TYPES.join(", ")}` };
      }

      if (file.size > MAX_SIZE) {
        set.status = 400;
        return { error: `File too large. Max size: ${MAX_SIZE / 1024 / 1024}MB` };
      }

      const ext = file.type.split("/")[1] === "jpeg" ? "jpg" : file.type.split("/")[1];
      const key = `news/${crypto.randomUUID()}.${ext}`;
      const buffer = Buffer.from(await file.arrayBuffer());

      const url = await uploadToR2(buffer, key, file.type);

      logInfo("uploads.image.success", { key, size: file.size, type: file.type });

      return { data: { url, key } };
    } catch (err: any) {
      logError("uploads.image.failed", { err: err?.message ?? String(err) });
      set.status = 500;
      return { error: "Upload failed" };
    }
  },
  {
    detail: { tags: ["Uploads"], summary: "Upload an image to R2 (admin only)" },
  }
);
