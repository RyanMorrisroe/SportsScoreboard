import {
  LEAGUE_IDS,
  resolveLeague,
  type LeagueId,
  type ResolvedLeague,
} from "../plugins/registry";

export { LEAGUE_IDS };

export const LEAGUES = LEAGUE_IDS.flatMap((id) => {
  const league = resolveLeague(id);
  return league ? [{ id, label: league.label, name: league.name }] : [];
});

export function getLeague(id: string): ResolvedLeague | null {
  return resolveLeague(id as LeagueId);
}