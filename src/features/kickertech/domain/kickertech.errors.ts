/**
 * Errores tipados del módulo Kickertech. Se traducen en presentación a HTTP.
 */
export class KickertechModuleError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "KickertechModuleError";
  }
}

export const createKickertechValidationError = (
  message: string,
  details?: Record<string, unknown>
) => new KickertechModuleError(message, 400, "KICKERTECH_VALIDATION_ERROR", details);

export const createKickertechConfigurationError = (details?: Record<string, unknown>) =>
  new KickertechModuleError(
    "No se configuró la integración con Kickertech",
    503,
    "KICKERTECH_CONFIGURATION_ERROR",
    details
  );

export const createKickertechUpstreamError = (
  status: number,
  message: string,
  details?: Record<string, unknown>
) => new KickertechModuleError(message, status, "KICKERTECH_UPSTREAM_ERROR", details);

export const createKickertechParseError = (details?: Record<string, unknown>) =>
  new KickertechModuleError(
    "No se pudo procesar la respuesta de Kickertech",
    502,
    "KICKERTECH_PARSE_ERROR",
    details
  );

export const createKickertechNotFoundError = (
  message = "No se encontraron datos para la consulta realizada",
  details?: Record<string, unknown>
) => new KickertechModuleError(message, 404, "KICKERTECH_NOT_FOUND", details);
