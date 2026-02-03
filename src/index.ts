import { Elysia } from "elysia";
import { swagger } from "@elysiajs/swagger";
// import { pushRoutes } from "./features/push/presentation/routes";
import { footballRoutes } from "./features/sports/football/presentation/routes";
import { statsRoutes } from "./features/stats/presentation/routes";

const app = new Elysia()
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
  .listen(4500);

console.log(`🚀 Backend iniciado en http://localhost:${app.server?.port}`);
console.log(`📚 Swagger UI: http://localhost:${app.server?.port}/swagger`);
