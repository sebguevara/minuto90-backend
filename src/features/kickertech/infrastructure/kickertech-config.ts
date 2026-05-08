/**
 * Configuración de la integración con Kickertech.
 *
 * Hay dos hosts distintos:
 *   - Discovery (JSON): host público de Kickertech afiliados.
 *   - Feed (XML):       host privado (SbxHost) asignado por Kickertech al operador.
 *
 * El `configHash` es secreto: nunca debe salir del backend.
 */
export interface KickertechConfig {
  discoveryBaseUrl: string;
  feedHost: string;
  configId: string;
  configHash: string;
  /** Timeout HTTP en ms (request individual al proveedor). */
  requestTimeoutMs: number;
}

const DEFAULT_DISCOVERY = "https://affiliates.websbkt.com";
const DEFAULT_TIMEOUT_MS = 15_000;

const trim = (value: string | undefined): string => (value ?? "").trim();

const trimTrailingSlash = (value: string): string =>
  value.endsWith("/") ? value.slice(0, -1) : value;

const ensureProtocol = (host: string): string =>
  /^https?:\/\//i.test(host) ? host : `https://${host}`;

export const getKickertechConfig = (): KickertechConfig => ({
  discoveryBaseUrl: trimTrailingSlash(
    trim(process.env.KICKERTECH_DISCOVERY_BASE_URL) || DEFAULT_DISCOVERY
  ),
  feedHost: trimTrailingSlash(
    trim(process.env.KICKERTECH_FEED_HOST)
      ? ensureProtocol(trim(process.env.KICKERTECH_FEED_HOST)!)
      : ""
  ),
  configId: trim(process.env.KICKERTECH_CONFIG_ID),
  configHash: trim(process.env.KICKERTECH_CONFIG_HASH),
  requestTimeoutMs: Number(process.env.KICKERTECH_REQUEST_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS,
});

/** Discovery sólo necesita IP whitelisteada — la base URL siempre tiene fallback. */
export const isKickertechDiscoveryConfigured = (config: KickertechConfig): boolean =>
  Boolean(config.discoveryBaseUrl);

/** El feed XML requiere host + configId + configHash provistos por Kickertech. */
export const isKickertechFeedConfigured = (config: KickertechConfig): boolean =>
  Boolean(config.feedHost && config.configId && config.configHash);
