/**
 * Dry-run preview of the AI post-match news generator (no DB writes, no push).
 *
 * Usage:
 *   bun run src/scripts/preview-match-news.ts <fixtureId>
 *   bun run src/scripts/preview-match-news.ts --teams saudi uruguay
 *   bun run src/scripts/preview-match-news.ts --teams saudi uruguay --date 2026-06-15
 */
import { footballService } from "../features/sports/application/football.service";
import { previewMatchNewsDraft } from "../features/news/application/match-news.service";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function findFixtureByTeams(a: string, b: string): Promise<number | null> {
  const reA = new RegExp(a, "i");
  const reB = new RegExp(b, "i");
  const matches = (home: string, away: string) =>
    (reA.test(home) && reB.test(away)) || (reA.test(away) && reB.test(home));

  // 1) World Cup 2026 (league 1) — most likely for a Saudi Arabia vs Uruguay tie around now.
  try {
    const wc = await footballService.getFixtures({ league: 1, season: 2026 });
    const hit = (wc.response ?? []).find((f) =>
      matches(f.teams.home.name, f.teams.away.name)
    );
    if (hit) return hit.fixture.id;
  } catch {}

  // 2) Scan recent dates.
  const explicitDate = arg("--date");
  const dates = explicitDate
    ? [explicitDate]
    : ["2026-06-15", "2026-06-14", "2026-06-13", "2026-06-16", "2026-06-12"];
  for (const date of dates) {
    try {
      const res = await footballService.getFixtures({ date, timezone: "UTC" });
      const hit = (res.response ?? []).find((f) =>
        matches(f.teams.home.name, f.teams.away.name)
      );
      if (hit) return hit.fixture.id;
    } catch {}
  }
  return null;
}

function stripHtml(html: string): string {
  return html
    .replace(/<\/(p|h2|h3|h4|li|blockquote)>/gi, "\n")
    .replace(/<li>/gi, "  • ")
    .replace(/<h2>/gi, "\n## ")
    .replace(/<h3>/gi, "\n### ")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function main() {
  let fixtureId = Number(process.argv[2]);

  if (!Number.isFinite(fixtureId) || fixtureId <= 0) {
    const teamsIdx = process.argv.indexOf("--teams");
    const a = teamsIdx >= 0 ? process.argv[teamsIdx + 1] : "saudi";
    const b = teamsIdx >= 0 ? process.argv[teamsIdx + 2] : "uruguay";
    console.log(`Buscando fixture: "${a}" vs "${b}"...`);
    const found = await findFixtureByTeams(a, b);
    if (!found) {
      console.error("No se encontró el fixture. Probá pasar el fixtureId directo.");
      process.exit(1);
    }
    fixtureId = found;
    console.log(`Fixture encontrado: ${fixtureId}\n`);
  }

  const result = await previewMatchNewsDraft(fixtureId);
  if (result.status !== "ok") {
    console.error("No se pudo generar el preview:", result.reason);
    if ("raw" in result && result.raw) console.error("\nRaw del modelo:\n", result.raw.slice(0, 1000));
    process.exit(1);
  }

  const p = result.preview;
  console.log("=".repeat(78));
  console.log(`PARTIDO: ${p.homeTeam} ${p.finalScore} ${p.awayTeam}`);
  console.log(`TORNEO:  ${p.tournament}  |  ${p.round}  |  fase: ${p.phase}`);
  console.log("=".repeat(78));
  console.log(`\nTÍTULO:\n${p.title}`);
  console.log(`\nBAJADA:\n${p.summary}`);
  console.log(`\nCUERPO (texto):\n${stripHtml(p.bodyHtml)}`);
  console.log(`\nHASHTAGS: ${p.hashtags.map((h) => "#" + h.replace(/\s+/g, "")).join("  ")}`);
  console.log(`\nAUTOR: minuto90   |   IMAGEN: (vacía)`);
  console.log("\n" + "-".repeat(78));
  console.log("CUERPO (HTML crudo que se guarda):\n");
  console.log(p.bodyHtml);
  process.exit(0);
}

main().catch((e) => {
  console.error("Error:", e?.message ?? e);
  process.exit(1);
});
