import { describe, expect, it } from "bun:test";
import {
  buildMatchNewsSlug,
  classifyTournamentPhase,
  parseMatchNewsDraft,
  sanitizeNewsHtml,
  slugify,
} from "./match-news.logic";

describe("slugify / buildMatchNewsSlug", () => {
  it("normalizes accents and non-alphanumerics", () => {
    expect(slugify("Peñarol vs Nacional")).toBe("penarol-vs-nacional");
    expect(slugify("  ¡Gol de River! ")).toBe("gol-de-river");
  });

  it("appends fixtureId for a unique, stable slug", () => {
    expect(buildMatchNewsSlug("Boca goleó a Independiente", 12345)).toBe(
      "boca-goleo-a-independiente-12345"
    );
  });

  it("falls back to a safe base when the title has no usable chars", () => {
    expect(buildMatchNewsSlug("⚽⚽⚽", 99)).toBe("cronica-99");
  });
});

describe("classifyTournamentPhase", () => {
  it("detects group stage", () => {
    expect(classifyTournamentPhase({ round: "Group Stage - 1" })).toBe("group");
    expect(classifyTournamentPhase({ round: "Fase de grupos - 2" })).toBe("group");
    expect(classifyTournamentPhase({ round: "League Stage - 3" })).toBe("group");
  });

  it("detects knockout rounds and two-legged ties", () => {
    expect(classifyTournamentPhase({ round: "Round of 16" })).toBe("knockout");
    expect(classifyTournamentPhase({ round: "Semi-finals" })).toBe("knockout");
    expect(classifyTournamentPhase({ round: "Final" })).toBe("knockout");
    expect(classifyTournamentPhase({ round: "8th Finals - 2nd Leg" })).toBe("knockout");
    expect(classifyTournamentPhase({ round: "Octavos de Final - Vuelta" })).toBe("knockout");
  });

  it("detects regular league rounds", () => {
    expect(classifyTournamentPhase({ round: "Regular Season - 5" })).toBe("league");
    expect(classifyTournamentPhase({ round: "Apertura - 3" })).toBe("league");
    expect(classifyTournamentPhase({ round: "Jornada 12" })).toBe("league");
  });

  it("falls back to competition type when the round is ambiguous", () => {
    expect(classifyTournamentPhase({ round: "", competitionType: "League" })).toBe("league");
    expect(classifyTournamentPhase({ round: "1st Round", competitionType: "Cup" })).toBe(
      "knockout"
    );
    expect(classifyTournamentPhase({ round: "Friendlies 1", competitionType: null })).toBe(
      "single"
    );
  });
});

describe("sanitizeNewsHtml", () => {
  it("strips dangerous blocks and disallowed tags but keeps allowed structure", () => {
    const dirty =
      '<h2>Resultado</h2><p>Gran partido <strong>de River</strong>.</p>' +
      '<script>alert(1)</script><img src=x onerror=alert(1)>' +
      '<div style="color:red">x</div>';
    const clean = sanitizeNewsHtml(dirty);
    expect(clean).toContain("<h2>Resultado</h2>");
    expect(clean).toContain("<strong>de River</strong>");
    expect(clean).not.toContain("<script");
    expect(clean).not.toContain("<img");
    expect(clean).not.toContain("onerror");
    expect(clean).not.toContain("style=");
    // div is allowed but attributes are dropped
    expect(clean).toContain("<div>");
  });

  it("neutralizes javascript: hrefs and adds safe rel/target on links", () => {
    expect(sanitizeNewsHtml('<a href="javascript:alert(1)">x</a>')).toContain("<a>");
    const safe = sanitizeNewsHtml('<a href="https://minuto90score.com">x</a>');
    expect(safe).toContain('href="https://minuto90score.com"');
    expect(safe).toContain('rel="noopener noreferrer nofollow"');
  });
});

describe("parseMatchNewsDraft", () => {
  const valid = {
    title: "River goleó a Boca en el clásico",
    summary: "Triunfo categórico por 3 a 0 en el Monumental.",
    bodyHtml: "<p>Arranque.</p><h2>El partido</h2><p>Desarrollo.</p>",
    hashtags: ["River", "Boca", "Superclásico", "Liga Profesional", "Goles"],
  };

  it("parses plain JSON", () => {
    expect(parseMatchNewsDraft(JSON.stringify(valid))).toEqual(valid);
  });

  it("parses JSON wrapped in code fences and surrounding prose", () => {
    const wrapped = "Acá va:\n```json\n" + JSON.stringify(valid) + "\n```";
    const parsed = parseMatchNewsDraft(wrapped);
    expect(parsed?.title).toBe(valid.title);
    expect(parsed?.hashtags).toHaveLength(5);
  });

  it("strips leading # from hashtags and accepts `body`/`tags` aliases", () => {
    const alt = JSON.stringify({
      title: "T",
      body: "<p>Cuerpo.</p>",
      tags: ["#River", "#Boca"],
    });
    const parsed = parseMatchNewsDraft(alt);
    expect(parsed?.bodyHtml).toBe("<p>Cuerpo.</p>");
    expect(parsed?.hashtags).toEqual(["River", "Boca"]);
  });

  it("returns null on missing title/body or invalid JSON", () => {
    expect(parseMatchNewsDraft("not json")).toBeNull();
    expect(parseMatchNewsDraft(JSON.stringify({ summary: "x" }))).toBeNull();
    expect(parseMatchNewsDraft("")).toBeNull();
  });
});
