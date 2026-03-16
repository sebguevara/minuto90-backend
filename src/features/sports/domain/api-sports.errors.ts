export class ApiSportsModuleError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "ApiSportsModuleError";
  }
}

export function createApiSportsValidationError(
  message: string,
  details?: Record<string, unknown>
) {
  return new ApiSportsModuleError(message, 400, "VALIDATION_ERROR", details);
}

export function createApiSportsConfigurationError(
  sportLabel: string,
  sportCode: string,
  details?: Record<string, unknown>
) {
  return new ApiSportsModuleError(
    `No se configuro la API de ${sportLabel}`,
    503,
    `${sportCode}_API_CONFIGURATION_ERROR`,
    details
  );
}

export function createApiSportsUpstreamError(
  sportCode: string,
  status: number,
  message: string,
  details?: Record<string, unknown>
) {
  return new ApiSportsModuleError(message, status, `${sportCode}_API_UPSTREAM_ERROR`, details);
}

export function createApiSportsUnexpectedError(
  sportLabel: string,
  sportCode: string,
  details?: Record<string, unknown>
) {
  return new ApiSportsModuleError(
    `No se pudo obtener la informacion de ${sportLabel}`,
    500,
    `${sportCode}_API_UNEXPECTED_ERROR`,
    details
  );
}

