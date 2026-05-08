export class OddsIntegrationModuleError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "OddsIntegrationModuleError";
  }
}

export const createOddsIntegrationValidationError = (
  message: string,
  details?: Record<string, unknown>
) =>
  new OddsIntegrationModuleError(
    message,
    400,
    "ODDS_INTEGRATION_VALIDATION_ERROR",
    details
  );

export const createOddsIntegrationNotFoundError = (
  message = "No se encontraron datos para la consulta realizada",
  details?: Record<string, unknown>
) =>
  new OddsIntegrationModuleError(
    message,
    404,
    "ODDS_INTEGRATION_NOT_FOUND",
    details
  );

export const createOddsIntegrationUnavailableError = (
  message = "No se pudo obtener información del proveedor de cuotas",
  details?: Record<string, unknown>
) =>
  new OddsIntegrationModuleError(
    message,
    503,
    "ODDS_INTEGRATION_UNAVAILABLE",
    details
  );
