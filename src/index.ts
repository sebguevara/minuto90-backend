import { Elysia } from "elysia";
import { swagger } from "@elysiajs/swagger";
// import { pushRoutes } from "./features/push/presentation/routes";
import { footballRoutes } from "./features/sports/football/presentation/routes";
import { statsRoutes } from "./features/stats/presentation/routes";

const parseCorsOrigins = (value: string): string[] =>
  value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);

const CORS_ALLOW_ORIGIN_RAW = process.env.CORS_ALLOW_ORIGIN ?? "*";
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
          description: "READ-ONLY REST API for football statistics",
        },
        tags: [
          { name: "Teams", description: "Team statistics endpoints" },
          { name: "Tournaments", description: "Tournament statistics endpoints" },
          { name: "All", description: "Universal endpoints" },
          { name: "Statistics", description: "Statistics endpoints for teams and players" },
          { name: "Football", description: "Football matches and seasons endpoints" },
        ],
      },
      path: "/swagger",
      exclude: [],
    })
  )
  // .use(pushRoutes)
  .use(footballRoutes)
  .use(statsRoutes)
  .listen(
    process.env.NODE_ENV === "production" ? process.env.PORT : 4500
  );

console.log(`🚀 Backend iniciado en http://localhost:${app.server?.port}`);
console.log(`📚 Swagger UI: http://localhost:${app.server?.port}/swagger`);
