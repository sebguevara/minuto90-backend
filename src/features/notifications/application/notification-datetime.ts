/**
 * Zona horaria por país (una IANA representativa por ISO 3166-1 alpha-2).
 * Países con varias zonas: valor por defecto razonable; el usuario puede ampliar con campo en BD más adelante.
 */
const COUNTRY_TO_IANA: Record<string, string> = {
  AR: "America/Argentina/Buenos_Aires",
  BO: "America/La_Paz",
  BR: "America/Sao_Paulo",
  CL: "America/Santiago",
  CO: "America/Bogota",
  CR: "America/Costa_Rica",
  CU: "America/Havana",
  DO: "America/Santo_Domingo",
  EC: "America/Guayaquil",
  ES: "Europe/Madrid",
  GT: "America/Guatemala",
  HN: "America/Tegucigalpa",
  MX: "America/Mexico_City",
  NI: "America/Managua",
  PA: "America/Panama",
  PE: "America/Lima",
  PR: "America/Puerto_Rico",
  PY: "America/Asuncion",
  SV: "America/El_Salvador",
  UY: "America/Montevideo",
  US: "America/New_York",
  VE: "America/Caracas",
  DE: "Europe/Berlin",
  FR: "Europe/Paris",
  GB: "Europe/London",
  IT: "Europe/Rome",
  PT: "Europe/Lisbon",
  NL: "Europe/Amsterdam",
};

/**
 * Prefijo telefónico (solo dígitos, sin +) → ISO país (cuando es inequívoco).
 * Lista parcial: ampliar según audiencia.
 */
const DIAL_PREFIX_TO_COUNTRY: Array<{ prefix: string; country: string }> = [
  { prefix: "54", country: "AR" },
  { prefix: "591", country: "BO" },
  { prefix: "55", country: "BR" },
  { prefix: "56", country: "CL" },
  { prefix: "57", country: "CO" },
  { prefix: "506", country: "CR" },
  { prefix: "53", country: "CU" },
  { prefix: "593", country: "EC" },
  { prefix: "34", country: "ES" },
  { prefix: "502", country: "GT" },
  { prefix: "504", country: "HN" },
  { prefix: "52", country: "MX" },
  { prefix: "505", country: "NI" },
  { prefix: "507", country: "PA" },
  { prefix: "51", country: "PE" },
  { prefix: "595", country: "PY" },
  { prefix: "598", country: "UY" },
  { prefix: "1", country: "US" },
  { prefix: "58", country: "VE" },
  { prefix: "49", country: "DE" },
  { prefix: "33", country: "FR" },
  { prefix: "44", country: "GB" },
  { prefix: "39", country: "IT" },
  { prefix: "351", country: "PT" },
  { prefix: "31", country: "NL" },
];

export type SubscriberTimeInput = {
  countryCode?: string | null;
  dialCode?: string | null;
};

function normalizeDialCode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const d = String(raw).replace(/\D/g, "");
  return d.length ? d : null;
}

function countryFromDialCode(dial: string): string | null {
  const sorted = [...DIAL_PREFIX_TO_COUNTRY].sort((a, b) => b.prefix.length - a.prefix.length);
  for (const { prefix, country } of sorted) {
    if (dial.startsWith(prefix)) return country;
  }
  return null;
}

/**
 * Resuelve una zona IANA para formatear la hora del partido para el suscriptor.
 */
export function resolveIanaTimeZone(input: SubscriberTimeInput): string {
  const cc = input.countryCode?.trim().toUpperCase();
  if (cc && cc.length === 2 && COUNTRY_TO_IANA[cc]) {
    return COUNTRY_TO_IANA[cc];
  }

  const dial = normalizeDialCode(input.dialCode);
  if (dial) {
    const inferred = countryFromDialCode(dial);
    if (inferred && COUNTRY_TO_IANA[inferred]) {
      return COUNTRY_TO_IANA[inferred];
    }
  }

  return "UTC";
}

/**
 * Fecha/hora de inicio del partido en la zona del suscriptor (español neutro).
 * Si no hay país/prefijo reconocido, se indica explícitamente UTC.
 */
export function formatMatchKickoffForSubscriber(matchDate: Date, subscriber: SubscriberTimeInput): string {
  const timeZone = resolveIanaTimeZone(subscriber);
  const isUtc = timeZone === "UTC";

  const formatter = new Intl.DateTimeFormat("es", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone,
    timeZoneName: "short",
  });

  const formatted = formatter.format(matchDate);
  if (isUtc) {
    return `${formatted} (UTC)`;
  }
  return formatted;
}
