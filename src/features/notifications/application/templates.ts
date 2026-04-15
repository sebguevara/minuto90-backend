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
      playerName?: string | null;
      assistName?: string | null;
      minute: number | string;
    }
  ) =>
    [
      "⚽ *Gol!!*",
      "",
      `*${input.teamName}*`,
      ...(input.playerName ? [`*${input.playerName}* · _${input.minute}′_`] : [`_${input.minute}′_`]),
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

  /** Inicio de la tanda (estado API `P`); el marcador es el del partido antes de los penales. */
  penaltyShootoutStart: (input: TemplateCommon) =>
    [
      "🎯 *Tanda de penales*",
      "",
      "*Empieza la tanda de penales.*",
      "Se define el partido desde el punto penal.",
      "",
      `*${input.homeTeam} ${input.scoreHome} - ${input.scoreAway} ${input.awayTeam}*`,
      "_Marcador tras tiempo reglamentario / prórroga (sin contar penales)._",
      "",
      `_${input.leagueName}_`,
      matchLinkLine(input.matchUrl),
    ].join("\n"),

  /**
   * Cada lanzamiento en tanda: acierto o error explícitos.
   * Solo se muestra la *serie* de penales (API `score.penalty`); no el marcador global del partido.
   */
  penaltyShootoutKick: (
    input: TemplateBase & {
      teamName: string;
      converted: boolean;
      shootoutHome: number | null;
      shootoutAway: number | null;
    }
  ) => {
    const serieLine =
      input.shootoutHome != null && input.shootoutAway != null
        ? `*Serie de penales:* *${input.homeTeam}* ${input.shootoutHome} - ${input.shootoutAway} *${input.awayTeam}*`
        : "_Serie de penales: aún sin dato en la API._";
    return [
      "🎯 *Penal (tanda)*",
      "",
      `*${input.teamName}*`,
      input.converted ? "✅ *Gol* en la serie." : "❌ *Penal errado*.",
      "",
      serieLine,
      "",
      `_${input.leagueName}_`,
      matchLinkLine(input.matchUrl),
    ].join("\n");
  },
};
