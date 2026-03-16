export class FootballModuleError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "FootballModuleError";
  }
}

export function createFootballValidationError(
  message: string,
  details?: Record<string, unknown>
) {
  return new FootballModuleError(message, 400, "VALIDATION_ERROR", details);
}

export function createFootballNotFoundError(
  message: string,
  details?: Record<string, unknown>
) {
  return new FootballModuleError(message, 404, "NOT_FOUND", details);
}

export function createFootballConfigurationError(details?: Record<string, unknown>) {
  return new FootballModuleError(
    "No se configuró la API de Football",
    503,
    "FOOTBALL_API_CONFIGURATION_ERROR",
    details
  );
}

export function createFootballUpstreamError(
  status: number,
  message: string,
  details?: Record<string, unknown>
) {
  return new FootballModuleError(message, status, "FOOTBALL_API_UPSTREAM_ERROR", details);
}

export function createFootballUnexpectedError(details?: Record<string, unknown>) {
  return new FootballModuleError(
    "No se pudo obtener la información de Football",
    500,
    "FOOTBALL_API_UNEXPECTED_ERROR",
    details
  );
}
