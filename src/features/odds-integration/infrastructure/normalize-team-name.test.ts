import { describe, expect, it } from "bun:test";

import { normalizeTeamName, tokenizeTeamName } from "./normalize-team-name";

describe("normalizeTeamName", () => {
  it("hace lowercase y quita acentos", () => {
    expect(normalizeTeamName("Atlético Madrid")).toBe("atletico madrid");
    expect(normalizeTeamName("Bayern München")).toBe("bayern munchen");
  });

  it("elimina sufijos corporativos comunes", () => {
    expect(normalizeTeamName("Manchester United FC")).toBe("manchester united");
    expect(normalizeTeamName("Real Madrid CF")).toBe("real madrid");
  });

  it("normaliza separadores y colapsa espacios", () => {
    expect(normalizeTeamName("Saint-Étienne")).toBe("saint etienne");
    expect(normalizeTeamName("  Inter  Milan  ")).toBe("inter milan");
  });

  it("conserva nombres ya normales", () => {
    expect(normalizeTeamName("River Plate")).toBe("river plate");
  });

  it("maneja strings vacios", () => {
    expect(normalizeTeamName("")).toBe("");
    expect(normalizeTeamName("   ")).toBe("");
  });
});

describe("tokenizeTeamName", () => {
  it("devuelve los tokens", () => {
    expect(tokenizeTeamName("Manchester United FC")).toEqual(["manchester", "united"]);
  });

  it("devuelve array vacio si el nombre es vacio", () => {
    expect(tokenizeTeamName("")).toEqual([]);
  });
});
