/**
 * Normalización de nombres de equipo.
 *
 * Función pura. No persistir el resultado (recalcular cuando se necesita).
 *
 * Pasos:
 *  1. Trim + lowercase.
 *  2. NFD + remove diacritics (Á → A, ñ → n).
 *  3. Reemplazar separadores (`-`, `.`, `&`) por espacio.
 *  4. Eliminar sufijos comunes corporativos (fc, cf, sc, ac, afc, cd...).
 *  5. Colapsar espacios.
 */

const SUFFIXES = [
  "fc",
  "cf",
  "sc",
  "ac",
  "afc",
  "cd",
  "se",
  "ec",
  "rfc",
  "if",
  "ks",
  "asd",
  "as",
];

const SUFFIX_REGEX = new RegExp(
  `(?:^|\\s)(?:${SUFFIXES.join("|")})(?=\\s|$)`,
  "g"
);

const stripDiacritics = (value: string): string =>
  value.normalize("NFD").replace(/[̀-ͯ]/g, "");

export const normalizeTeamName = (raw: string): string => {
  if (!raw) return "";
  let name = raw.trim().toLowerCase();
  name = stripDiacritics(name);
  name = name.replace(/[\-._&/]/g, " ");
  name = name.replace(/[^a-z0-9 ]+/g, " ");
  name = name.replace(SUFFIX_REGEX, " ");
  name = name.replace(/\s+/g, " ").trim();
  return name;
};

/** Tokens (palabras) del nombre normalizado. */
export const tokenizeTeamName = (raw: string): string[] => {
  const normalized = normalizeTeamName(raw);
  if (!normalized) return [];
  return normalized.split(" ").filter((token) => token.length > 0);
};
