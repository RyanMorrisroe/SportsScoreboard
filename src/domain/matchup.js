import { normalizeSchedule } from "./schedule.js";

function normalizeRecord(competitor) {
  const records = Array.isArray(competitor?.record)
    ? competitor.record
    : competitor?.record
      ? [competitor.record]
      : [];
  const overall = records.find((record) => record?.type === "total") || records[0];
  return overall?.summary || overall?.displayValue || "";
}

function getScheduleRecentGames(payload, teamId) {
  const sourceEvents = Array.isArray(payload?.events) ? payload.events : [];
  const eventsById = new Map(sourceEvents.map((event) => [String(event.id), event]));
  return normalizeSchedule(payload, teamId, "UTC")
    .filter((game) => {
      const competition = eventsById.get(String(game.id))?.competitions?.[0];
      return competition?.status?.type?.state === "post" ||
        competition?.status?.type?.completed === true;
    })
    .map((game) => {
      const event = eventsById.get(String(game.id));
      return {
        id: String(game.id || ""),
        date: event?.date || event?.competitions?.[0]?.date || "",
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

function normalizeTeam(competitor, homeAway, recentForm, schedule) {
  const team = competitor?.team || {};
  const rank = Number(competitor?.curatedRank?.current ?? competitor?.rank);
  const teamId = competitor?.id ?? team.id;
  const form = recentForm?.find((entry) => String(entry.team?.id) === String(teamId));
  const summaryGames = (Array.isArray(form?.events) ? form.events : []).slice(0, 5).map((event) => ({
    id: String(event.id || ""),
    date: event.gameDate || event.date || "",
    result: event.gameResult || event.result || "",
    score: event.score || "",
    opponent: event.opponent?.displayName || event.opponent?.name || "Opponent",
    opponentLogo: event.opponentLogo || event.opponent?.logo || "",
    atVs: event.atVs || "",
  }));

  return {
    id: teamId === undefined ? "" : String(teamId),
    homeAway,
    name: team.displayName || team.name || "Team",
    abbreviation: team.abbreviation || "",
    logo: team.logos?.[0]?.href || team.logo || "",
    record: normalizeRecord(competitor),
    rank: Number.isInteger(rank) && rank > 0 && rank < 99 ? rank : null,
    recentGames: summaryGames.length
      ? summaryGames
      : getScheduleRecentGames(schedule, teamId),
  };
}

export function normalizeMatchup(raw, schedules = {}) {
  const competition = raw?.header?.competitions?.[0] || {};
  const competitors = Array.isArray(competition.competitors)
    ? competition.competitors
    : [];
  const recentForm = Array.isArray(raw?.lastFiveGames) ? raw.lastFiveGames : [];
  const away = competitors.find((team) => team.homeAway === "away");
  const home = competitors.find((team) => team.homeAway === "home");
  const series = (Array.isArray(raw?.seasonseries) ? raw.seasonseries : [])
    .find((item) => item?.summary || item?.shortSummary);
  const venue = raw?.gameInfo?.venue || competition.venue || {};

  return {
    date: competition.timeValid === false ? "" : competition.date || "",
    venue: venue.fullName || venue.name || "",
    venueLocation: [venue.address?.city, venue.address?.state].filter(Boolean).join(", "),
    away: away
      ? normalizeTeam(away, "away", recentForm, schedules[String(away.id ?? away.team?.id)])
      : null,
    home: home
      ? normalizeTeam(home, "home", recentForm, schedules[String(home.id ?? home.team?.id)])
      : null,
    series: series
      ? {
          title: series.title || series.description || "Series",
          summary: series.summary || series.shortSummary || "",
          score: series.seriesScore || "",
          completed: series.completed === true,
        }
      : null,
  };
}