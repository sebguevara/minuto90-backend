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

function matchLinkLine(matchUrl: string) {
  return `🔗 ${matchUrl}`;
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
      "⚽ *Gol*",
      "",
      `*${input.teamName}*`,
      `*${input.playerName}* · _${input.minute}′_`,
      ...(input.assistName ? [`_Asistencia: ${input.assistName}_`] : []),
      "",
      `*${input.homeTeam} ${input.scoreHome} - ${input.scoreAway} ${input.awayTeam}*`,
      "",
      `_${input.leagueName}_`,
      matchLinkLine(input.matchUrl),
    ].join("\n"),

  redCard: (
    input: TemplateCommon & {
      teamName: string;
      playerName: string;
      minute: number | string;
    }
  ) =>
    [
      "🟥 *Tarjeta roja*",
      "",
      `*${input.teamName}* — expulsión, _un jugador menos_.`,
      `*${input.playerName}* · _${input.minute}′_`,
      "",
      `*${input.homeTeam} ${input.scoreHome} - ${input.scoreAway} ${input.awayTeam}*`,
      "",
      `_${input.leagueName}_`,
      matchLinkLine(input.matchUrl),
    ].join("\n"),

  varCancelled: (input: TemplateCommon) =>
    [
      "📺 *Gol anulado (VAR)*",
      "",
      "Marcador actualizado.",
      "",
      `*${input.homeTeam} ${input.scoreHome} - ${input.scoreAway} ${input.awayTeam}*`,
      "",
      `_${input.leagueName}_`,
      matchLinkLine(input.matchUrl),
    ].join("\n"),

  kickoff: (input: TemplateBase) =>
    [
      "▶️ *Comienza el partido*",
      "",
      `*${input.homeTeam}* vs *${input.awayTeam}*`,
      "",
      `_${input.leagueName}_`,
      matchLinkLine(input.matchUrl),
    ].join("\n"),

  preMatch30m: (input: TemplateBase & { kickoffLabel: string }) =>
    [
      "⏰ *Recordatorio*",
      "",
      "Quedan *30 minutos* para el inicio.",
      "",
      `*${input.homeTeam}* vs *${input.awayTeam}*`,
      "",
      `_Inicio:_ ${input.kickoffLabel}`,
      "",
      `_${input.leagueName}_`,
      matchLinkLine(input.matchUrl),
    ].join("\n"),

  fullTime: (input: TemplateCommon) =>
    [
      "🏁 *Final del partido*",
      "",
      `*${input.homeTeam} ${input.scoreHome} - ${input.scoreAway} ${input.awayTeam}*`,
      "",
      `_${input.leagueName}_`,
      matchLinkLine(input.matchUrl),
    ].join("\n"),

  halfTime: (input: TemplateCommon) =>
    [
      "⏱️ *Descanso*",
      "",
      `*${input.homeTeam} ${input.scoreHome} - ${input.scoreAway} ${input.awayTeam}*`,
      "",
      `_${input.leagueName}_`,
      matchLinkLine(input.matchUrl),
    ].join("\n"),

  secondHalf: (input: TemplateCommon) =>
    [
      "▶️ *Segunda mitad*",
      "",
      `*${input.homeTeam} ${input.scoreHome} - ${input.scoreAway} ${input.awayTeam}*`,
      "",
      `_${input.leagueName}_`,
      matchLinkLine(input.matchUrl),
    ].join("\n"),
};
