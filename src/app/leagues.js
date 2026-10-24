export const LEAGUES = [
  { id: "college-football", label: "CFB", name: "College Football" },
  { id: "nfl", label: "NFL", name: "NFL" },
  { id: "mlb", label: "MLB", name: "MLB" },
  { id: "nba", label: "NBA", name: "NBA" },
  { id: "nhl", label: "NHL", name: "NHL" },
];

export const LEAGUE_IDS = LEAGUES.map(({ id }) => id);

export function getLeague(id) {
  return LEAGUES.find((league) => league.id === id) || null;
}