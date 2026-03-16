import { whoscoredPrismaClient } from "./src/lib/whoscored-client";

async function run() {
  try {
    console.log("Finding Team 55 by minId...");
    const team1 = await whoscoredPrismaClient.team.findFirst({ where: { minId: 55 } });
    console.log("Team by minId:", team1?.id || null);

    console.log("Finding Team 39 by id...");
    const team2 = await whoscoredPrismaClient.team.findFirst({ where: { id: 39 } });
    console.log("Team by id:", team2?.id || null);

    console.log("Finding Tournament 39 by minId...");
    const tour1 = await whoscoredPrismaClient.tournament.findFirst({ where: { minId: 39 } });
    console.log("Tournament by minId:", tour1?.id || null);

    console.log("Finding Tournament 39 by id...");
    const tour2 = await whoscoredPrismaClient.tournament.findFirst({ where: { id: 39 } });
    console.log("Tournament by id:", tour2?.id || null);

  } catch (error) {
    console.error("DIAGNOSTIC ERROR", error);
  } finally {
    process.exit(0);
  }
}

run();
