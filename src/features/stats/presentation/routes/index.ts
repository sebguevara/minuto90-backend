import { Elysia } from "elysia";
import { teamRoutes } from "./team.routes";
import { tournamentRoutes } from "./tournament.routes";
import { allRoutes } from "./all.routes";

export const statsRoutes = new Elysia({ prefix: "/stats" })
  .use(teamRoutes)
  .use(tournamentRoutes)
  .use(allRoutes);
