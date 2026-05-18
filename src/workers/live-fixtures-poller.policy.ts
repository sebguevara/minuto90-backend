/**
 * Política de "fin de partido por desaparición" (FT_DISAPPEARED).
 *
 * Funciones puras y constantes — sin side effects ni dependencias de Redis/Prisma/BullMQ — para
 * que el poller y los tests las consuman sin arrastrar inicialización de infraestructura.
 *
 * El poller dispara FT cuando un fixture deja de aparecer en el endpoint live de la API. Esa
 * señal es ruidosa (el proveedor a veces saca un fixture del listado transitoriamente), así
 * que estas constantes y funciones aplican guardas conservadoras para evitar falsos positivos.
 */

const MISSING_POLLS_BEFORE_FULL_TIME = Number(process.env.LIVE_FULL_TIME_MISSING_POLLS ?? 3);

/** Elapsed mínimo (minutos) para considerar disparar FT por desaparición. Si el partido está
 *  por debajo de este umbral, nunca disparamos FT: o el proveedor lo recupera, o lo detectamos
 *  cuando el partido llegue a 2H y el path normal de status="FT" lo cubra. */
export const MIN_ELAPSED_FOR_FT_DISAPPEARED = Number(process.env.LIVE_FT_DISAPPEARED_MIN_ELAPSED ?? 60);

/** Estados en los que NUNCA disparamos FT por desaparición:
 *  - FT/AET/PEN: ya terminales, no avisar de nuevo.
 *  - SUSP/INT/BT: suspendido/interrumpido/break — el partido NO terminó realmente.
 *  - NS/TBD: no empezado — no puede "terminar".
 *  - CANC/PST/ABD/AWD/WO: cancelado/pospuesto/abandonado/walkover — no es "fin normal". */
export const FT_DISAPPEARED_SKIP_STATUSES = new Set([
  "FT",
  "AET",
  "PEN",
  "SUSP",
  "INT",
  "BT",
  "NS",
  "TBD",
  "CANC",
  "PST",
  "ABD",
  "AWD",
  "WO",
]);

export function isLikelyHalftime(statusShort: string, elapsed: number | null): boolean {
  return (
    statusShort === "HT" ||
    statusShort === "BT" ||
    statusShort === "INT" ||
    (statusShort === "1H" && typeof elapsed === "number" && elapsed >= 40 && elapsed <= 55)
  );
}

/** Cantidad de polls consecutivos sin el fixture en el listado live antes de asumir FT.
 *  Más alto = más tolerante a blips transitorios del proveedor (menos falsos positivos)
 *  pero retrasa la notificación de finales reales hasta `threshold × pollInterval` segundos. */
export function missingPollThresholdFor(oldStatus: string, elapsed: number | null): number {
  if (isLikelyHalftime(oldStatus, elapsed)) return Math.max(6, MISSING_POLLS_BEFORE_FULL_TIME);
  // Cerca del final: el proveedor suele sacar el partido del listado live antes de que veamos FT en diff.
  if (oldStatus === "2H" && typeof elapsed === "number" && elapsed >= 70) return 2;
  // Early-game: requerir 12 polls (≈ 60s) antes de asumir final. El proveedor a veces saca
  // un partido recién arrancado del listado live por blips transitorios.
  if (oldStatus === "1H" && typeof elapsed === "number" && elapsed < 35) return 12;
  return Math.max(2, MISSING_POLLS_BEFORE_FULL_TIME);
}
