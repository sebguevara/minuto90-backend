import { ApiSportsModuleError, createApiSportsValidationError } from "../domain/api-sports.errors";

export function parseOptionalInteger(value: unknown, field: string) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    throw createApiSportsValidationError(`El parametro ${field} debe ser un numero entero`);
  }

  return parsed;
}

export function parseRequiredInteger(value: unknown, field: string) {
  const parsed = parseOptionalInteger(value, field);
  if (parsed === undefined) {
    throw createApiSportsValidationError(`El parametro ${field} es obligatorio`);
  }

  return parsed;
}

export function parseOptionalString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

export function handleApiSportsError(set: { status?: number | string }, error: unknown) {
  if (error instanceof ApiSportsModuleError) {
    set.status = error.status;
    return { error: error.message, code: error.code };
  }

  set.status = 500;
  return { error: "Error interno del servidor", code: "INTERNAL_ERROR" };
}
