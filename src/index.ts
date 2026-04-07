import { Elysia } from "elysia";
import { swagger } from "@elysiajs/swagger";
import { rateLimit } from "elysia-rate-limit";
import { pushRoutes } from "./features/push/presentation/routes";
import { footballRoutes } from "./features/sports/presentation/routes";
import { volleyballRoutes } from "./features/sports/presentation/volleyball.routes";
import { rugbyRoutes } from "./features/sports/presentation/rugby.routes";
import { nflRoutes } from "./features/sports/presentation/nfl.routes";
import { nbaRoutes } from "./features/sports/presentation/nba.routes";
import { basketballRoutes } from "./features/sports/presentation/basketball.routes";
import { hockeyRoutes } from "./features/sports/presentation/hockey.routes";
import { handballRoutes } from "./features/sports/presentation/handball.routes";
import { baseballRoutes } from "./features/sports/presentation/baseball.routes";
import { aflRoutes } from "./features/sports/presentation/afl.routes";
import { mmaRoutes } from "./features/sports/presentation/mma.routes";
import { formula1Routes } from "./features/sports/presentation/formula1.routes";
import { statsRoutes } from "./features/stats/presentation/routes";
import { notificationsRoutes } from "./features/notifications/presentation/routes";
import { insightsRoutes } from "./features/insights/presentation/insights.routes";
import { userRoutes } from "./features/users/presentation/user.routes";
import { newsRoutes } from "./features/news/presentation/news.routes";
import { categoryRoutes } from "./features/news/presentation/category.routes";
import { tagRoutes } from "./features/news/presentation/tag.routes";
import { postRoutes } from "./features/posts/presentation/post.routes";
import { comparatorRoutes } from "./features/comparator/presentation/comparator.routes";
import { favoritesRoutes } from "./features/favorites/presentation/favorites.routes";
import { uploadRoutes } from "./features/uploads/presentation/upload.routes";
import { teamColorRoutes } from "./shared/colors/team-color.routes";
import { mundialRoutes } from "./features/mundial/presentation/mundial.routes";

const SITEMAP_REQUEST_PURPOSE = "sitemap";

/** Cabecera opcional: mismo secreto en Next (MINUTO90_INTERNAL_API_KEY) y backend → el BFF no comparte bucket con el mundo. */
const INTERNAL_API_KEY_HEADER = "x-minuto90-internal-key";

/** Separador de segmentos en la clave de rate limit (no aparece en IPv4/IPv6). */
const RATE_LIMIT_KEY_SEP = "|";

const isRateLimitGloballyDisabled = (): boolean => {
  const v = process.env.RATE_LIMIT_DISABLED?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
};

const internalApiKeyConfigured = (): string | undefined => {
  const k = process.env.MINUTO90_INTERNAL_API_KEY?.trim();
  return k ? k : undefined;
};

const hasValidInternalKey = (request: Request): boolean => {
  const expected = internalApiKeyConfigured();
  if (!expected) return false;
  return request.headers.get(INTERNAL_API_KEY_HEADER) === expected;
};

const getRequestPurpose = (request: Request): string =>
  request.headers.get("x-minuto90-purpose") === SITEMAP_REQUEST_PURPOSE
    ? SITEMAP_REQUEST_PURPOSE
    : "default";

/** Rutas de cuotas (p. ej. /football/odds, /football/odds/live, /volleyball/odds). */
const isOddsApiPath = (pathname: string): boolean => /\/odds(\/|$)/.test(pathname);

/**
 * Identificador para rate limit: preferir IP del cliente real si el proxy o Next reenvían cabeceras.
 * Sin esto, todo el SSR desde Next comparte una IP → un bucket → 429 masivo y la navegación “no abre”.
 */
const getClientAddress = (
  request: Request,
  server?: { requestIP?: (request: Request) => { address?: string } | null } | null
): string => {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) {
      return first;
    }
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp?.trim()) {
    return realIp.trim();
  }
  const resolved = server?.requestIP?.(request)?.address;
  return resolved && resolved.trim() ? resolved : "unknown";
};

const rateLimitBucket = (request: Request): "odds" | "baseball" | "default" => {
  try {
    const pathname = new URL(request.url).pathname;
    if (isOddsApiPath(pathname)) return "odds";
    if (pathname === "/baseball" || pathname.startsWith("/baseball/")) {
      return "baseball";
    }
    return "default";
  } catch {
    return "default";
  }
};

const rateLimitMax = (key: string): number => {
  const [purpose, bucket] = key.split(RATE_LIMIT_KEY_SEP);
  if (purpose === SITEMAP_REQUEST_PURPOSE) {
    return Number(process.env.RATE_LIMIT_SITEMAP_MAX ?? 2000);
  }
  if (bucket === "odds") {
    return Number(process.env.RATE_LIMIT_ODDS_MAX ?? 50000);
  }
  if (bucket === "baseball") {
    return Number(process.env.RATE_LIMIT_BASEBALL_MAX ?? 50000);
  }
  /**
   * BFF/SSR (p. ej. Railway): peticiones Next→backend suelen verse como una IP; límites bajos = 429 en cadena.
   * `MINUTO90_INTERNAL_API_KEY` + cabecera o `RATE_LIMIT_DISABLED=true` evita el colapso sin depender del proxy.
   */
  return Number(process.env.RATE_LIMIT_MAX ?? 500000);
};

const rateLimitKeyGenerator = (
  request: Request,
  server?: { requestIP?: (request: Request) => { address?: string } | null } | null
): string =>
  [
    getRequestPurpose(request),
    rateLimitBucket(request),
    getClientAddress(request, server),
  ].join(RATE_LIMIT_KEY_SEP);

const parseCorsOrigins = (value: string): string[] =>
  value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);

const defaultOrigins = "https://minuto90score.com, https://www.minuto90score.com, http://localhost:3000";
const CORS_ALLOW_ORIGIN_RAW = process.env.CORS_ALLOW_ORIGIN ?? defaultOrigins;
const CORS_ALLOW_ALL_ORIGINS = CORS_ALLOW_ORIGIN_RAW.trim() === "*";
const CORS_EXTRA_ORIGINS = process.env.CORS_EXTRA_ORIGINS
  ? parseCorsOrigins(process.env.CORS_EXTRA_ORIGINS)
  : [];
const CORS_ALLOWED_ORIGINS = CORS_ALLOW_ALL_ORIGINS
  ? []
  : [...parseCorsOrigins(CORS_ALLOW_ORIGIN_RAW), ...CORS_EXTRA_ORIGINS];
const CORS_ALLOW_HEADERS =
  process.env.CORS_ALLOW_HEADERS ?? "Content-Type, Authorization";
const CORS_ALLOW_METHODS =
  process.env.CORS_ALLOW_METHODS ?? "GET, POST, PUT, PATCH, DELETE, OPTIONS";

const swaggerTags = [
  { name: "Football", description: "Football matches and seasons endpoints" },
  { name: "Volleyball", description: "Volleyball endpoints" },
  { name: "Rugby", description: "Rugby endpoints" },
  { name: "NFL", description: "American football endpoints" },
  { name: "NBA", description: "NBA endpoints" },
  { name: "Basketball", description: "Global basketball endpoints" },
  { name: "Hockey", description: "Ice hockey endpoints" },
  { name: "Handball", description: "Handball endpoints" },
  { name: "Baseball", description: "Baseball endpoints" },
  { name: "AFL", description: "Aussie Rules endpoints" },
  { name: "MMA", description: "MMA endpoints" },
  { name: "Formula 1", description: "Formula 1 endpoints" },
  {
    name: "Stats",
    description:
      "Estadisticas de equipos, torneos, tablas, perfiles de partido, rankings e insights",
  },
  {
    name: "Notifications",
    description: "Gestion de suscriptores y suscripciones de notificaciones",
  },
  { name: "Evolution API", description: "Instancias y operaciones de Evolution API" },
  { name: "Insights", description: "Generacion de resumenes de partido e insights con IA" },
  { name: "Users", description: "Gestion de usuarios y webhooks de Clerk" },
  { name: "News", description: "Noticias y categorias" },
  { name: "Posts", description: "Posts y publicaciones" },
  { name: "Comparador", description: "Comparador de equipos" },
  { name: "Push", description: "Web push y suscripciones del cliente" },
  { name: "Favorites", description: "Favoritos del usuario" },
  { name: "Uploads", description: "Uploads administrativos" },
  { name: "Team Colors", description: "Colores y branding de equipos" },
  { name: "Mundial", description: "Sección Mundial 2026 — pronósticos y ranking" },
];

const swaggerTagGroups = [
  {
    name: "Sports",
    tags: [
      "Football",
      "Volleyball",
      "Rugby",
      "NFL",
      "NBA",
      "Basketball",
      "Hockey",
      "Handball",
      "Baseball",
      "AFL",
      "MMA",
      "Formula 1",
      "Stats",
      "Comparador",
    ],
  },
  { name: "Frontend", tags: ["Users", "Push", "Favorites", "Team Colors"] },
  { name: "AI", tags: ["Insights"] },
  { name: "Evolution API", tags: ["Evolution API"] },
  { name: "Content", tags: ["News", "Posts", "Uploads"] },
  { name: "Notifications", tags: ["Notifications"] },
];

const swaggerDocumentation = {
  info: {
    title: "Minuto 90 Score API",
    version: "1.0.0",
    description: "Read-only REST API for multi-sport statistics and fixtures",
  },
  tags: swaggerTags,
  "x-tagGroups": swaggerTagGroups,
} as any;

const app = new Elysia()
  .use(
    rateLimit({
      duration: 60000,
      max: (key) => rateLimitMax(key),
      generator: (request, server) => rateLimitKeyGenerator(request, server),
      skip: (req) => isRateLimitGloballyDisabled() || hasValidInternalKey(req),
    })
  )
  .onRequest(({ set, request }) => {
    const requestOrigin = request.headers.get("origin");
    const allowOrigin =
      CORS_ALLOW_ALL_ORIGINS
        ? "*"
        : requestOrigin && CORS_ALLOWED_ORIGINS.includes(requestOrigin)
          ? requestOrigin
          : null;

    if (allowOrigin) {
      set.headers["Access-Control-Allow-Origin"] = allowOrigin;
      set.headers["Vary"] = "Origin";
    }

    set.headers["Access-Control-Allow-Headers"] = CORS_ALLOW_HEADERS;
    set.headers["Access-Control-Allow-Methods"] = CORS_ALLOW_METHODS;
    set.headers["Access-Control-Max-Age"] = "86400";
  })
  .options("*", ({ set }) => {
    set.status = 204;
    return null;
  })
  .use(
    swagger({
      documentation: swaggerDocumentation,
      path: "/swagger",
      exclude: [],
    })
  )
  .use(pushRoutes)
  .use(footballRoutes)
  .use(volleyballRoutes)
  .use(rugbyRoutes)
  .use(nflRoutes)
  .use(nbaRoutes)
  .use(basketballRoutes)
  .use(hockeyRoutes)
  .use(handballRoutes)
  .use(baseballRoutes)
  .use(aflRoutes)
  .use(mmaRoutes)
  .use(formula1Routes)
  .use(statsRoutes)
  .use(notificationsRoutes)
  .use(insightsRoutes)
  .use(userRoutes)
  .use(newsRoutes)
  .use(categoryRoutes)
  .use(tagRoutes)
  .use(postRoutes)
  .use(comparatorRoutes)
  .use(favoritesRoutes)
  .use(uploadRoutes)
  .use(teamColorRoutes)
  .use(mundialRoutes)
  .listen(
    process.env.NODE_ENV !== "development"
      ? Number(process.env.PORT ?? 4500)
      : 4500
  );
