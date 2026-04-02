function createJsonResponse(description: string, example: unknown) {
  return {
    description,
    content: {
      "application/json": {
        example,
      },
    },
  };
}

export function createSwaggerDetail(
  tag: string,
  summary: string,
  successExample: unknown,
  description?: string
) {
  return {
    tags: [tag],
    summary,
    ...(description ? { description } : {}),
    responses: {
      200: createJsonResponse("Respuesta exitosa", successExample),
      400: createJsonResponse("Error de validacion", {
        error: "El parametro league debe ser un numero entero",
        code: "VALIDATION_ERROR",
      }),
      500: createJsonResponse("Error interno", {
        error: "Error interno del servidor",
        code: "INTERNAL_ERROR",
      }),
    },
  };
}

export function createSwaggerTagDetail(
  tag: string,
  summary: string,
  description?: string
) {
  return {
    tags: [tag],
    summary,
    ...(description ? { description } : {}),
  };
}
