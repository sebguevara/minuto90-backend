export type ToggleFavoriteInput = {
  sport: string;
  entityType: string;
  entityId: number;
  metadata: Record<string, unknown>;
};

export type SyncFavoritesInput = {
  favoritesBySport: Record<
    string,
    {
      matches?: Record<string, unknown>;
      leagues?: Record<string, unknown>;
      teams?: Record<string, unknown>;
      fights?: Record<string, unknown>;
      fighters?: Record<string, unknown>;
    }
  >;
};

export type FavoritesBySport = Record<
  string,
  {
    matches: Record<number, unknown>;
    leagues: Record<number, unknown>;
    teams: Record<number, unknown>;
    fights: Record<number, unknown>;
    fighters: Record<number, unknown>;
  }
>;
