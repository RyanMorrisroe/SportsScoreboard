const ESPN_BASE_URL = "https://site.api.espn.com/apis/site/v2/sports";

export function getSportPath(league) {
  return league === "mlb" ? "baseball" : "football";
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
