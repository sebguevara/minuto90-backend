import {
  createKickertechNotFoundError,
  createKickertechValidationError,
} from "../domain/kickertech.errors";
import {
  kickertechOddsService,
  type KickertechOddsServiceContract,
} from "./kickertech-odds.service";

/**
 * Resolución del betslip de afiliado:
 *  1. Recuperar el evento (cacheado).
 *  2. Validar que el `oddId` exista dentro de alguno de sus mercados.
 *  3. Reemplazar el placeholder `#ODD_ID` en `betslipTemplate` por ese ID.
 *
 * Devolver una URL inválida o de un odd que no pertenece al evento sería
 * un agujero de seguridad (carrito ajeno) — por eso validamos siempre.
 */
const ODD_PLACEHOLDER = "#ODD_ID";

export interface KickertechBetslipResolution {
  url: string;
  eventId: number;
  oddId: number;
  decimal: number;
  marketTypeId: number;
  marketTypeName: string | null;
  selectionName: string;
}

export interface KickertechBetslipServiceContract {
  resolveBetslip(input: {
    sportId: number;
    eventId: number;
    oddId: number;
  }): Promise<KickertechBetslipResolution>;
}

export class KickertechBetslipService implements KickertechBetslipServiceContract {
  constructor(
    private readonly oddsService: KickertechOddsServiceContract = kickertechOddsService
  ) {}

  async resolveBetslip(input: { sportId: number; eventId: number; oddId: number }) {
    const { sportId, eventId, oddId } = input;

    const event = await this.oddsService.getEventOdds(sportId, eventId);
    if (!event.betslipTemplate) {
      throw createKickertechNotFoundError(
        "El evento solicitado no tiene un enlace de apuesta disponible",
        { sportId, eventId }
      );
    }

    if (!event.betslipTemplate.includes(ODD_PLACEHOLDER)) {
      throw createKickertechValidationError(
        "El enlace de apuesta del evento no es válido",
        { sportId, eventId }
      );
    }

    for (const market of event.markets) {
      const odd = market.odds.find((entry) => entry.id === oddId);
      if (!odd) continue;
      return {
        url: event.betslipTemplate.replace(ODD_PLACEHOLDER, String(oddId)),
        eventId,
        oddId,
        decimal: odd.decimal,
        marketTypeId: market.typeId,
        marketTypeName: market.typeName,
        selectionName: odd.name,
      };
    }

    throw createKickertechNotFoundError(
      "La selección de cuota indicada no existe en este evento",
      { sportId, eventId, oddId }
    );
  }
}

export const kickertechBetslipService = new KickertechBetslipService();
