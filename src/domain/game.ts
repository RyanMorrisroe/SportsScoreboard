type JsonObject = Record<string, unknown>;

export interface GameDetailTeam {
  id: string | number;
  abbrev: string;
  name: string;
  rank: string | number | null;
  logo: string;
  color: string | null;
  alternateColor: string | null;
  score: string | number;
  statistics: unknown[];
}

export interface GameDetail {
  id: string | number;
  raw: unknown;
  teams: { away: GameDetailTeam; home: GameDetailTeam };
  scoringPlays: unknown[];
  drives: unknown;
  winprobability: unknown[];
}

function isObject(value: unknown): value is JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function asObject(value: unknown): JsonObject {
  return isObject(value) ? value : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function getTeamFromHeader(competitors: unknown[], homeAway: "away" | "home"): JsonObject {
  return competitors
    .map(asObject)
    .find((competitor) => competitor.homeAway === homeAway) || {};
}

function getString(value: unknown, fallback: string): string {
  return typeof value === "string" && value ? value : fallback;
}

function getScalar(value: unknown, fallback: string | number): string | number {
  return (typeof value === "string" || typeof value === "number") && value
    ? value
    : fallback;
}

function getOptionalScalar(value: unknown): string | number | null {
  return typeof value === "string" || typeof value === "number" ? value : null;
}

function getTeamLogo(team: JsonObject, fallback = "https://espncdn.com"): string {
  const logos = asArray(team.logos).map(asObject);
  const firstLogo = logos[0];
  if (typeof firstLogo?.href === "string" && firstLogo.href) return firstLogo.href;
  return getString(team.logo, fallback);
}

function normalizeTeam(
  headerTeam: JsonObject,
  boxscoreTeam: JsonObject,
  side: "away" | "home",
): GameDetailTeam {
  const headerData = asObject(headerTeam.team);
  const boxscoreData = asObject(boxscoreTeam.team);
  return {
    id: getScalar(headerTeam.id, getScalar(boxscoreData.id, "")),
    abbrev: getString(headerData.abbreviation, side === "away" ? "AWAY" : "HOME") ||
      getString(boxscoreData.abbreviation, side === "away" ? "AWAY" : "HOME"),
    name: getString(headerData.displayName, "") ||
      getString(boxscoreData.displayName, side === "away" ? "Away Team" : "Home Team"),
    rank: getOptionalScalar(headerTeam.rank),
    logo: getTeamLogo(headerData, getString(boxscoreData.logo, "https://espncdn.com")),
    color: getOptionalString(headerData.color) ?? getOptionalString(boxscoreData.color),
    alternateColor:
      getOptionalString(headerData.alternateColor) ??
      getOptionalString(boxscoreData.alternateColor),
    score: getScalar(headerTeam.score, "0"),
    statistics: asArray(boxscoreTeam.statistics),
  };
}

function getOptionalString(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

export function buildGameDetail(data: unknown, fallbackId?: string | number): GameDetail {
  const raw = asObject(data);
  const header = asObject(raw.header);
  const headerCompetition = asObject(asArray(header.competitions)[0]);
  const competitors = asArray(headerCompetition.competitors);
  const boxscore = asObject(raw.boxscore);
  const boxscoreTeams = asArray(boxscore.teams).map(asObject);
  const awayRaw = boxscoreTeams.find((team) => team.homeAway === "away") || {};
  const homeRaw = boxscoreTeams.find((team) => team.homeAway === "home") || {};

  return {
    id: fallbackId ?? getScalar(raw.id, ""),
    raw: data,
    teams: {
      away: normalizeTeam(getTeamFromHeader(competitors, "away"), awayRaw, "away"),
      home: normalizeTeam(getTeamFromHeader(competitors, "home"), homeRaw, "home"),
    },
    scoringPlays: asArray(raw.scoringPlays),
    drives: raw.drives ?? {},
    winprobability: asArray(raw.winprobability),
  };
}