import { fetchCharacteristics } from "./fetchCharacteristics";
import { fetchWidgets } from "./fetchWidgets";
import { fetchStyleOfPlay } from "./fetchStyleOfPlay";
import { fetchTopStats } from "./fetchTopStats";

export async function fetchMatchProfile(teamId: number) {
  const [characteristics, widgets, styleOfPlay, topStats] = await Promise.all([
    fetchCharacteristics(teamId),
    fetchWidgets(teamId),
    fetchStyleOfPlay(teamId),
    fetchTopStats(teamId),
  ]);

  return { characteristics, styleOfPlay, widgets, topStats };
}
