import { Elysia } from "elysia";
import { swagger } from "@elysiajs/swagger";
// import { pushRoutes } from "./features/push/presentation/routes";
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

const parseCorsOrigins = (value: string): string[] =>
  value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);

const defaultOrigins = "https://minuto90.co, https://www.minuto90.co, https://90score.co, https://www.90score.co, http://localhost:3000";
const CORS_ALLOW_ORIGIN_RAW = process.env.CORS_ALLOW_ORIGIN ?? defaultOrigins;
const CORS_ALLOW_ALL_ORIGINS = CORS_ALLOW_ORIGIN_RAW.trim() === "*";
const CORS_ALLOWED_ORIGINS = CORS_ALLOW_ALL_ORIGINS
  ? []
  : parseCorsOrigins(CORS_ALLOW_ORIGIN_RAW);
const CORS_ALLOW_HEADERS =
  process.env.CORS_ALLOW_HEADERS ?? "Content-Type, Authorization";
const CORS_ALLOW_METHODS =
  process.env.CORS_ALLOW_METHODS ?? "GET, POST, PUT, PATCH, DELETE, OPTIONS";

const app = new Elysia()
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
      documentation: {
        info: {
          title: "Minuto90 API",
          version: "1.0.0",
          description: "Read-only REST API for multi-sport statistics and fixtures",
        },
        tags: [
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
              "Estadísticas de equipos, torneos, tablas, perfiles de partido, rankings e insights",
          },
          {
            name: "Notifications",
            description:
              "Gestión de suscriptores, suscripciones, instancias de Evolution y endpoints de debug",
          },
        ],
      },
      path: "/swagger",
      exclude: [],
    })
  )
  // .use(pushRoutes)
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
  .listen(
    process.env.NODE_ENV === "production"
      ? Number(process.env.PORT ?? 4500)
      : 4500
  );

console.log(`Backend iniciado en http://localhost:${app.server?.port}`);
console.log(`Swagger UI disponible en http://localhost:${app.server?.port}/swagger`);
