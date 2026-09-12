function getTeamFromHeader(competitors, homeAway) {
  return competitors.find((competitor) => competitor.homeAway === homeAway) || {};
}

function getTeamLogo(team, fallback = "https://espncdn.com") {
  if (team?.logos && team.logos.length > 0) {
    return team.logos[0].href;
  }
  if (team?.logo) {
    return team.logo;
  }
  return fallback;
}

export function buildGameDetail(data, fallbackId = undefined) {
  const headerComp = data?.header?.competitions?.[0] || {};
  const headerCompetitors = headerComp.competitors || [];
  const headerAway = getTeamFromHeader(headerCompetitors, "away");
  const headerHome = getTeamFromHeader(headerCompetitors, "home");

  const boxTeams = data?.boxscore?.teams || [];
  const awayRaw = boxTeams.find((team) => team.homeAway === "away") || {};
  const homeRaw = boxTeams.find((team) => team.homeAway === "home") || {};

  const awayTeam = {
    id: headerAway.id || awayRaw.team?.id || "",
    abbrev: headerAway.team?.abbreviation || awayRaw.team?.abbreviation || "AWAY",
    name: headerAway.team?.displayName || awayRaw.team?.displayName || "Away Team",
    rank: headerAway.rank || null,
    logo: getTeamLogo(headerAway.team, awayRaw.team?.logo || "https://espncdn.com"),
    score: headerAway.score || "0",
    statistics: awayRaw.statistics || [],
  };

  const homeTeam = {
    id: headerHome.id || homeRaw.team?.id || "",
    abbrev: headerHome.team?.abbreviation || homeRaw.team?.abbreviation || "HOME",
    name: headerHome.team?.displayName || homeRaw.team?.displayName || "Home Team",
    rank: headerHome.rank || null,
    logo: getTeamLogo(headerHome.team, homeRaw.team?.logo || "https://espncdn.com"),
    score: headerHome.score || "0",
    statistics: homeRaw.statistics || [],
  };

  return {
    id: fallbackId ?? data?.id ?? "",
    raw: data,
    teams: { away: awayTeam, home: homeTeam },
    scoringPlays: data?.scoringPlays || [],
    drives: data?.drives || {},
    winprobability: data?.winprobability || [],
  };
}
