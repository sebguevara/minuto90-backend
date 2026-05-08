import { logWarn } from "../../../shared/logging/logger";
import {
  createKickertechConfigurationError,
  createKickertechUpstreamError,
} from "../domain/kickertech.errors";
import {
  getKickertechConfig,
  isKickertechFeedConfigured,
  type KickertechConfig,
} from "./kickertech-config";

/**
 * Cliente HTTP del feed XML de Kickertech (host privado SbxHost).
 *
 * Devuelve el XML crudo. El parseo a modelo canónico se hace en
 * `kickertech-xml-parser`. Esta separación permite testear parser y client
 * de forma independiente.
 */
export interface KickertechFeedClientContract {
  getSportFeedXml(sportId: number): Promise<string>;
  getEventFeedXml(sportId: number, eventId: number): Promise<string>;
}

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

const messageFor = (status: number): string => {
  if (status === 401 || status === 403)
    return "Kickertech rechazó las credenciales del feed";
  if (status === 429) return "Se excedió el límite de consultas en Kickertech";
  if (status === 404) return "No se encontraron datos para la consulta realizada";
  if (status >= 500) return "Kickertech no está disponible en este momento";
  return "No se pudo obtener el feed de cuotas";
};

const upstreamStatus = (status: number): number => {
  if (status === 404 || status === 429) return status;
  if (status === 401 || status === 403) return 503;
  if (status >= 500) return 503;
  return 502;
};

export class KickertechFeedClient implements KickertechFeedClientContract {
  private readonly config: KickertechConfig;
  private readonly fetchFn: FetchLike;

  constructor(options?: { config?: KickertechConfig; fetchFn?: FetchLike }) {
    this.config = options?.config ?? getKickertechConfig();
    this.fetchFn = options?.fetchFn ?? fetch;
  }

  getSportFeedXml(sportId: number) {
    return this.requestXml(this.buildFeedUrl(sportId));
  }

  getEventFeedXml(sportId: number, eventId: number) {
    return this.requestXml(`${this.buildFeedUrl(sportId)}&eid=${eventId}`);
  }

  private buildFeedUrl(sportId: number): string {
    if (!isKickertechFeedConfigured(this.config)) {
      throw createKickertechConfigurationError({
        missing: [
          this.config.feedHost ? null : "KICKERTECH_FEED_HOST",
          this.config.configId ? null : "KICKERTECH_CONFIG_ID",
          this.config.configHash ? null : "KICKERTECH_CONFIG_HASH",
        ].filter(Boolean),
      });
    }

    return `${this.config.feedHost}/affiliates/feeds/configs/${encodeURIComponent(
      this.config.configId
    )}/${encodeURIComponent(this.config.configHash)}?sport=${sportId}`;
  }

  private async requestXml(url: string): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.requestTimeoutMs);

    let response: Response;
    try {
      response = await this.fetchFn(url, {
        method: "GET",
        headers: { Accept: "application/xml, text/xml;q=0.9, */*;q=0.5" },
        signal: controller.signal,
      });
    } catch (error) {
      throw createKickertechUpstreamError(503, "Kickertech no está disponible en este momento", {
        endpoint: this.maskUrl(url),
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      clearTimeout(timer);
    }

    const body = await response.text();

    if (!response.ok) {
      logWarn("kickertech.feed.upstream_error", {
        endpoint: this.maskUrl(url),
        status: response.status,
      });
      throw createKickertechUpstreamError(upstreamStatus(response.status), messageFor(response.status), {
        endpoint: this.maskUrl(url),
        upstreamStatus: response.status,
      });
    }

    return body;
  }

  /** Oculta el `configHash` en logs y errores para evitar fugas. */
  private maskUrl(url: string): string {
    const hash = this.config.configHash;
    if (!hash) return url;
    return url.replace(hash, "***");
  }
}

export const kickertechFeedClient = new KickertechFeedClient();
