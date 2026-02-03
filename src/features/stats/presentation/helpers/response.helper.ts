export function errorResponse(error: any, code = "INTERNAL_ERROR") {
  return {
    error: {
      code,
      message: error.message || "An error occurred",
      details: error.details || undefined,
    },
  };
}

export function successResponse<T>(data: T, meta?: any) {
  return {
    data,
    ...(meta && { meta }),
  };
}
