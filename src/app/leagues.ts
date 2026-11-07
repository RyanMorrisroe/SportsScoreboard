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

export const CBB_CONFERENCE_GROUPS = [
  { id: "1", name: "America East" },
  { id: "62", name: "American" },
  { id: "3", name: "Atlantic 10" },
  { id: "2", name: "Atlantic Coast (ACC)" },
  { id: "46", name: "Atlantic Sun" },
  { id: "8", name: "Big 12" },
  { id: "4", name: "Big East" },
  { id: "5", name: "Big Sky" },
  { id: "6", name: "Big South" },
  { id: "7", name: "Big Ten" },
  { id: "9", name: "Big West" },
  { id: "10", name: "Coastal Athletic Association" },
  { id: "11", name: "Conference USA" },
  { id: "45", name: "Horizon League" },
  { id: "12", name: "Ivy League" },
  { id: "13", name: "Metro Conference" },
  { id: "14", name: "Mid-American (MAC)" },
  { id: "16", name: "Mid-Eastern Athletic (MEAC)" },
  { id: "18", name: "Missouri Valley" },
  { id: "44", name: "Mountain West" },
  { id: "19", name: "Northeast" },
  { id: "20", name: "Ohio Valley" },
  { id: "21", name: "Pac-12" },
  { id: "22", name: "Patriot League" },
  { id: "23", name: "Southeastern (SEC)" },
  { id: "24", name: "Southern" },
  { id: "25", name: "Southland" },
  { id: "26", name: "Southwestern Athletic" },
  { id: "49", name: "Summit League" },
  { id: "27", name: "Sun Belt" },
  { id: "30", name: "United Athletic" },
  { id: "29", name: "West Coast" },
] as const;

export function getLeague(id: string): ResolvedLeague | null {
  return resolveLeague(id as LeagueId);
}