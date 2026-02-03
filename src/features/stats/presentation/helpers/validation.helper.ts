import * as zod from "zod";

export function validateQuery<T>(
  schema: zod.ZodSchema<T>,
  data: any
): { success: boolean; data?: T; error?: any } {
  try {
    const result = schema.parse(data);
    return { success: true, data: result };
  } catch (err: any) {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid query parameters",
        details: err.errors || err.message,
      },
    };
  }
}
