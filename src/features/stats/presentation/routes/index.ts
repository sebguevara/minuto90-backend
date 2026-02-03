import { Elysia } from "elysia";
import { teamRoutes } from "./team.routes";
import { tournamentRoutes } from "./tournament.routes";
import { allRoutes } from "./all.routes";
import { statisticsRoutes } from "./statistics.routes";

export const statsRoutes = new Elysia({ prefix: "/stats" })
  .use(teamRoutes)
  .use(tournamentRoutes)
  .use(allRoutes)
  .use(statisticsRoutes);
