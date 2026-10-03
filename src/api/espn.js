const ESPN_BASE_URL = "https://site.api.espn.com/apis/site/v2/sports";
const SPORT_BY_LEAGUE = {
  "college-football": "football",
  nfl: "football",
  mlb: "baseball",
  nba: "basketball",
  nhl: "hockey",
};

export function getSportPath(league) {
  return SPORT_BY_LEAGUE[league] || "football";
}

export function getLeagueBaseUrl(league) {
  return `${ESPN_BASE_URL}/${getSportPath(league)}/${league}`;
}

export function getTeamUrls(league, teamId) {
  const baseUrl = `${getLeagueBaseUrl(league)}/teams/${encodeURIComponent(teamId)}`;
  return {
    details: baseUrl,
    schedule: `${baseUrl}/schedule`,
  };
}

export function getScoreboardRequestParams(
  league,
  { date, week, seasonType, group, initial = false } = {},
) {
  if (["mlb", "nba", "nhl"].includes(league)) {
    return date ? { dates: String(date).replace(/-/g, "") } : {};
  }

  const params = {};
  if (!initial) {
    params.week = week;
    params.seasontype = seasonType;
  }
  if (league === "college-football" && group) {
    params.groups = group;
  }
  return params;
}

export function getScoreboardUrl(league, params = {}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      query.set(key, value);
    }
  }
  const queryString = query.toString();
  return `${getLeagueBaseUrl(league)}/scoreboard${queryString ? `?${queryString}` : ""}`;
}

export function getGameSummaryUrl(league, eventId) {
  return `${getLeagueBaseUrl(league)}/summary?event=${encodeURIComponent(eventId)}`;
}

export async function fetchJson(url, fetchImpl = fetch) {
  const response = await fetchImpl(url);
  if (!response.ok) {
    throw new Error(`ESPN request failed (${response.status})`);
  }
  return response.json();
}

export async function fetchTeamDetails(league, teamId, fetchImpl = fetch) {
  const urls = getTeamUrls(league, teamId);
  const [details, schedule] = await Promise.all([
    fetchJson(urls.details, fetchImpl),
    fetchJson(urls.schedule, fetchImpl),
  ]);
  return { details, schedule };
}
