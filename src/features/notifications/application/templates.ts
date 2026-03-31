export type TemplateBase = {
  homeTeam: string;
  awayTeam: string;
  leagueName: string;
  matchUrl: string;
};

export type TemplateCommon = TemplateBase & {
  scoreHome: number;
  scoreAway: number;
};

function followMatchLine(matchUrl: string) {
  return `Seguilo en: ${matchUrl}`;
}

export const templates = {
  goal: (
    input: TemplateCommon & {
      teamName: string;
      playerName: string;
      assistName?: string | null;
      minute: number | string;
    }
  ) =>
    [
      `GOL de ${input.teamName}`,
      "",
      `${input.playerName} (${input.minute}')`,
      ...(input.assistName ? [`Asistencia: ${input.assistName}`] : []),
      `${input.homeTeam} ${input.scoreHome} - ${input.scoreAway} ${input.awayTeam}`,
      "",
      input.leagueName,
      followMatchLine(input.matchUrl),
    ].join("\n"),

  redCard: (
    input: TemplateCommon & {
      teamName: string;
      playerName: string;
      minute: number | string;
    }
  ) =>
    [
      "Tarjeta roja",
      "",
      `${input.teamName} se queda con uno menos.`,
      `${input.playerName} (${input.minute}')`,
      "",
      `${input.homeTeam} ${input.scoreHome} - ${input.scoreAway} ${input.awayTeam}`,
      "",
      input.leagueName,
      followMatchLine(input.matchUrl),
    ].join("\n"),

  varCancelled: (input: TemplateCommon) =>
    [
      "Gol anulado por VAR",
      "El marcador vuelve atras.",
      "",
      `${input.homeTeam} ${input.scoreHome} - ${input.scoreAway} ${input.awayTeam}`,
      "",
      input.leagueName,
      followMatchLine(input.matchUrl),
    ].join("\n"),

  kickoff: (input: TemplateBase) =>
    [
      "Arranca el partido",
      "",
      `${input.homeTeam} vs ${input.awayTeam}`,
      "",
      input.leagueName,
      followMatchLine(input.matchUrl),
    ].join("\n"),

  preMatch30m: (input: TemplateBase & { kickoffLabel: string }) =>
    [
      "Faltan 30 minutos para el partido",
      "",
      `${input.homeTeam} vs ${input.awayTeam}`,
      `Hora: ${input.kickoffLabel}`,
      "",
      input.leagueName,
      followMatchLine(input.matchUrl),
    ].join("\n"),

  fullTime: (input: TemplateCommon) =>
    [
      "Final del partido",
      "",
      `${input.homeTeam} ${input.scoreHome} - ${input.scoreAway} ${input.awayTeam}`,
      "",
      input.leagueName,
      followMatchLine(input.matchUrl),
    ].join("\n"),

  halfTime: (input: TemplateCommon) =>
    [
      "Entretiempo",
      "",
      `${input.homeTeam} ${input.scoreHome} - ${input.scoreAway} ${input.awayTeam}`,
      "",
      input.leagueName,
      followMatchLine(input.matchUrl),
    ].join("\n"),

  secondHalf: (input: TemplateCommon) =>
    [
      "Arranca el segundo tiempo",
      "",
      `${input.homeTeam} ${input.scoreHome} - ${input.scoreAway} ${input.awayTeam}`,
      "",
      input.leagueName,
      followMatchLine(input.matchUrl),
    ].join("\n"),
};
