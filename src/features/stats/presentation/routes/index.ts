import { Elysia } from "elysia";
import { teamRoutes } from "./team.routes";
import { teamTablesRoutes } from "./team-tables.routes";
import { tournamentRoutes } from "./tournament.routes";
import { allRoutes } from "./all.routes";
import { statisticsRoutes } from "./statistics.routes";
import { matchProfileRoutes } from "./matchProfile.routes";
import { lookupsRoutes } from "./lookups.routes";

export const statsRoutes = new Elysia({ prefix: "/stats" })
  .use(teamRoutes)
  .use(teamTablesRoutes)
  .use(tournamentRoutes)
  .use(allRoutes)
  .use(statisticsRoutes)
  .use(matchProfileRoutes)
  .use(lookupsRoutes);
