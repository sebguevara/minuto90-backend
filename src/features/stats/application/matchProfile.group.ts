type Nullable<T> = T | null | undefined;

type TopStatBase = {
  tournamentId: number;
  viewTypeId: number;
  Tournament?: any;
  TableType?: any;
};

type TopStatXg = TopStatBase & {
  side: "for_team" | "against_team";
  pensMode: "all" | "exclude_penalties";
};

export type GroupedTeamTopStats = {
  tournaments: Array<{
    tournamentId: number;
    tournament: any | null;
    viewTypes: Array<{
      viewTypeId: number;
      viewType: any | null;
      summary: any | null;
      offensive: any | null;
      defensive: any | null;
      xg: {
        all: { forTeam: any | null; againstTeam: any | null };
        exclude_penalties: { forTeam: any | null; againstTeam: any | null };
      };
    }>;
  }>;
};

function getTournamentPayload(record: Nullable<TopStatBase>) {
  return (record && ("Tournament" in record ? (record as any).Tournament : null)) ?? null;
}

function getViewTypePayload(record: Nullable<TopStatBase>) {
  return (record && ("TableType" in record ? (record as any).TableType : null)) ?? null;
}

export function groupTeamTopStats(topStats: {
  summary: TopStatBase[];
  offensive: TopStatBase[];
  defensive: TopStatBase[];
  xg: TopStatXg[];
}): GroupedTeamTopStats {
  const tournaments = new Map<
    number,
    {
      tournamentId: number;
      tournament: any | null;
      viewTypes: Map<
        number,
        {
          viewTypeId: number;
          viewType: any | null;
          summary: any | null;
          offensive: any | null;
          defensive: any | null;
          xg: {
            all: { forTeam: any | null; againstTeam: any | null };
            exclude_penalties: { forTeam: any | null; againstTeam: any | null };
          };
        }
      >;
    }
  >();

  const ensureTournament = (record: TopStatBase) => {
    const existing = tournaments.get(record.tournamentId);
    if (existing) {
      if (!existing.tournament) existing.tournament = getTournamentPayload(record);
      return existing;
    }
    const t = {
      tournamentId: record.tournamentId,
      tournament: getTournamentPayload(record),
      viewTypes: new Map(),
    };
    tournaments.set(record.tournamentId, t);
    return t;
  };

  const ensureView = (t: ReturnType<typeof ensureTournament>, record: TopStatBase) => {
    const existing = t.viewTypes.get(record.viewTypeId);
    if (existing) {
      if (!existing.viewType) existing.viewType = getViewTypePayload(record);
      return existing;
    }
    const v = {
      viewTypeId: record.viewTypeId,
      viewType: getViewTypePayload(record),
      summary: null,
      offensive: null,
      defensive: null,
      xg: {
        all: { forTeam: null, againstTeam: null },
        exclude_penalties: { forTeam: null, againstTeam: null },
      },
    };
    t.viewTypes.set(record.viewTypeId, v);
    return v;
  };

  for (const row of topStats.summary) {
    const t = ensureTournament(row);
    const v = ensureView(t, row);
    v.summary = row;
  }
  for (const row of topStats.offensive) {
    const t = ensureTournament(row);
    const v = ensureView(t, row);
    v.offensive = row;
  }
  for (const row of topStats.defensive) {
    const t = ensureTournament(row);
    const v = ensureView(t, row);
    v.defensive = row;
  }
  for (const row of topStats.xg) {
    const t = ensureTournament(row);
    const v = ensureView(t, row);
    const byPens = row.pensMode === "exclude_penalties" ? "exclude_penalties" : "all";
    const sideKey = row.side === "against_team" ? "againstTeam" : "forTeam";
    v.xg[byPens][sideKey] = row;
  }

  const result: GroupedTeamTopStats = {
    tournaments: Array.from(tournaments.values())
      .map((t) => ({
        tournamentId: t.tournamentId,
        tournament: t.tournament,
        viewTypes: Array.from(t.viewTypes.values()).sort((a, b) => a.viewTypeId - b.viewTypeId),
      }))
      .sort((a, b) => {
        const an = (a.tournament?.name as string | undefined) ?? "";
        const bn = (b.tournament?.name as string | undefined) ?? "";
        if (an && bn) return an.localeCompare(bn);
        if (an) return -1;
        if (bn) return 1;
        return a.tournamentId - b.tournamentId;
      }),
  };

  return result;
}

