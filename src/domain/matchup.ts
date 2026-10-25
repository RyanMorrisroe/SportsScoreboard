import { normalizeSchedule } from "./schedule.js";

type JsonObject = Record<string, unknown>;

export interface MatchupRecentGame {
  id: string;
  date: string;
  result: string;
  score: string;
  opponent: string;
  opponentLogo: string;
  atVs: string;
}

export interface MatchupTeam {
  id: string;
  homeAway: "away" | "home";
  name: string;
  abbreviation: string;
  logo: string;
  record: string;
  rank: number | null;
  recentGames: MatchupRecentGame[];
}

export interface NormalizedMatchup {
  date: string;
  venue: string;
  venueLocation: string;
  away: MatchupTeam | null;
  home: MatchupTeam | null;
  series: {
    title: string;
    summary: string;
    score: string;
    completed: boolean;
  } | null;
}

function asObject(value: unknown): JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as JsonObject
    : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function getString(value: unknown, fallback = ""): string {
  return typeof value === "string" && value ? value : fallback;
}

function normalizeRecord(competitor: JsonObject): string {
  const records = Array.isArray(competitor.record)
    ? competitor.record.map(asObject)
    : competitor.record
      ? [asObject(competitor.record)]
      : [];
  const overall = records.find((record) => record.type === "total") || records[0];
  return getString(overall?.summary, getString(overall?.displayValue));
}

function getScheduleRecentGames(payload: unknown, teamId: unknown): MatchupRecentGame[] {
  const rawEvents = asArray(asObject(payload).events).map(asObject);
  const eventsById = new Map(rawEvents.map((event) => [String(event.id), event]));
  return normalizeSchedule(payload, String(teamId ?? ""), "UTC")
    .filter((game) => {
      const competition = asObject(asArray(eventsById.get(String(game.id))?.competitions)[0]);
      const statusType = asObject(asObject(competition.status).type);
      return statusType.state === "post" || statusType.completed === true;
    })
    .map((game) => {
      const event = eventsById.get(String(game.id)) || {};
      const competition = asObject(asArray(event.competitions)[0]);
      return {
        id: String(game.id || ""),
        date: getString(event.date, getString(competition.date)),
        result: game.result,
        score: game.score,
        opponent: game.opponent,
        opponentLogo: game.opponentLogo,
        atVs: game.homeAway === "home" ? "vs" : "@",
      };
    })
    .sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime())
    .slice(0, 5);
}

function normalizeTeam(
  competitor: JsonObject,
  homeAway: "away" | "home",
  recentForm: unknown[],
  schedule: unknown,
): MatchupTeam {
  const team = asObject(competitor.team);
  const curatedRank = asObject(competitor.curatedRank);
  const rank = Number(curatedRank.current ?? competitor.rank);
  const teamId = competitor.id ?? team.id;
  const form = recentForm
    .map(asObject)
    .find((entry) => String(asObject(entry.team).id) === String(teamId));
  const summaryGames = asArray(form?.events).slice(0, 5).map((eventValue) => {
    const event = asObject(eventValue);
    const opponent = asObject(event.opponent);
    return {
      id: String(event.id || ""),
      date: getString(event.gameDate, getString(event.date)),
      result: getString(event.gameResult, getString(event.result)),
      score: getString(event.score),
      opponent: getString(opponent.displayName, getString(opponent.name, "Opponent")),
      opponentLogo: getString(event.opponentLogo, getString(opponent.logo)),
      atVs: getString(event.atVs),
    };
  });
  const logos = asArray(team.logos).map(asObject);

  return {
    id: teamId === undefined ? "" : String(teamId),
    homeAway,
    name: getString(team.displayName, getString(team.name, "Team")),
    abbreviation: getString(team.abbreviation),
    logo: getString(logos[0]?.href, getString(team.logo)),
    record: normalizeRecord(competitor),
    rank: Number.isInteger(rank) && rank > 0 && rank < 99 ? rank : null,
    recentGames: summaryGames.length ? summaryGames : getScheduleRecentGames(schedule, teamId),
  };
}

export function normalizeMatchup(
  rawValue: unknown,
  schedules: Readonly<Record<string, unknown>> = {},
): NormalizedMatchup {
  const raw = asObject(rawValue);
  const header = asObject(raw.header);
  const competition = asObject(asArray(header.competitions)[0]);
  const competitors = asArray(competition.competitors).map(asObject);
  const recentForm = asArray(raw.lastFiveGames);
  const away = competitors.find((team) => team.homeAway === "away");
  const home = competitors.find((team) => team.homeAway === "home");
  const series = asArray(raw.seasonseries)
    .map(asObject)
    .find((item) => item.summary || item.shortSummary);
  const gameInfo = asObject(raw.gameInfo);
  const venue = asObject(gameInfo.venue || competition.venue);
  const venueAddress = asObject(venue.address);
  const getSchedule = (team: JsonObject) => {
    const teamId = team.id ?? asObject(team.team).id;
    return schedules[String(teamId ?? "")];
  };

  return {
    date: competition.timeValid === false ? "" : getString(competition.date),
    venue: getString(venue.fullName, getString(venue.name)),
    venueLocation: [venueAddress.city, venueAddress.state].filter(Boolean).join(", "),
    away: away ? normalizeTeam(away, "away", recentForm, getSchedule(away)) : null,
    home: home ? normalizeTeam(home, "home", recentForm, getSchedule(home)) : null,
    series: series
      ? {
          title: getString(series.title, getString(series.description, "Series")),
          summary: getString(series.summary, getString(series.shortSummary)),
          score: getString(series.seriesScore),
          completed: series.completed === true,
        }
      : null,
  };
}