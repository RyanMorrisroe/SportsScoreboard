export function getFavoriteFilterText(selectedLeague) {
  if (selectedLeague === "college-football") return "Northwestern";
  return "Chicago";
}

export function getGameState(game) {
  return String(game?.status?.type?.state || "").toLowerCase();
}

export function getSituation(game, selectedLeague) {
  const competitionsList = game?.competitions || [];
  const comp = competitionsList.length > 0 ? competitionsList[0] : {};
  if (selectedLeague === "mlb") {
    if (getGameState(game) === "in") return game?.status?.type?.detail || "";
    return "";
  }
  return comp?.situation?.downDistanceText || "";
}

export function hasPossession(game, homeAway, selectedLeague) {
  if (selectedLeague === "mlb") return false;
  const competitionsList = game?.competitions || [];
  const comp = competitionsList.length > 0 ? competitionsList[0] : {};
  const competitorsList = comp.competitors || [];
  const teamId = competitorsList.find((c) => c.homeAway === homeAway)?.id;
  return (
    comp?.situation?.possession &&
    comp?.situation?.possession === teamId
  );
}

export function getNetwork(game) {
  const competitionsList = game?.competitions || [];
  const comp = competitionsList.length > 0 ? competitionsList[0] : {};
  const broadcastsList = comp.broadcasts || [];
  const geoBroadcastsList = comp.geoBroadcasts || [];

  if (
    broadcastsList.length > 0 &&
    broadcastsList[0].names &&
    broadcastsList[0].names.length > 0
  ) {
    return broadcastsList[0].names[0];
  }
  if (
    geoBroadcastsList.length > 0 &&
    geoBroadcastsList[0].media &&
    geoBroadcastsList[0].media.shortName
  ) {
    return geoBroadcastsList[0].media.shortName;
  }
  return "";
}

export function formatGameTime(game) {
  const state = getGameState(game);
  const detail = game?.status?.type?.shortDetail || "";
  if (state !== "pre" || !game.date) return detail;

  const gameDate = new Date(game.date);
  if (Number.isNaN(gameDate.getTime())) {
    return detail;
  }

  try {
    const today = new Date();
    const isToday =
      gameDate.getDate() === today.getDate() &&
      gameDate.getMonth() === today.getMonth() &&
      gameDate.getFullYear() === today.getFullYear();

    const options = {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    };
    if (!isToday) options.weekday = "short";

    return gameDate.toLocaleTimeString("en-US", options);
  } catch {
    return detail;
  }
}

export function getCompetitor(game, type) {
  const competitionsList = game?.competitions || [];
  const comp = competitionsList.length > 0 ? competitionsList[0] : {};
  const competitorsList = comp.competitors || [];
  return competitorsList.find((c) => c.homeAway === type) || {};
}

export function getTeamName(game, type) {
  const comp = getCompetitor(game, type);
  return comp?.team?.displayName || comp?.team?.location || "Team";
}

export function getTeamLogo(game, type) {
  return getCompetitor(game, type)?.team?.logo || "https://a.espncdn.com/i/teamlogos/default-team-logo-500.png";
}

export function getTeamScore(game, type) {
  return getCompetitor(game, type)?.score || "0";
}

export function getTeamRank(game, type) {
  const r = parseInt(getCompetitor(game, type)?.curatedRank?.current, 10);
  return r > 0 && r < 99 ? r : null;
}

export function isWinner(game, type) {
  return getCompetitor(game, type)?.winner === true;
}

export function isTeamStringHighlighted(name, matchStr) {
  return name.toLowerCase().includes(matchStr.toLowerCase());
}

export function isGameHighlighted(game, favoriteText) {
  return (
    isTeamStringHighlighted(getTeamName(game, "home"), favoriteText) ||
    isTeamStringHighlighted(getTeamName(game, "away"), favoriteText)
  );
}

export function sortGames(games, selectedLeague) {
  return [...games].sort((gameA, gameB) => {
    const stateA = getGameState(gameA);
    const stateB = getGameState(gameB);

    const getBucketWeight = (state) => {
      if (state === "in") return 1;
      if (state === "pre") return 2;
      return 3;
    };

    const weightA = getBucketWeight(stateA);
    const weightB = getBucketWeight(stateB);

    if (weightA !== weightB) return weightA - weightB;

    if (
      stateA === "pre" &&
      stateB === "pre" &&
      gameA.date &&
      gameB.date
    ) {
      const dateA = new Date(gameA.date).getTime();
      const dateB = new Date(gameB.date).getTime();
      if (dateA !== dateB) return dateA - dateB;
    }

    const getBestRank = (game) => {
      const rHome = getTeamRank(game, "home") || 99;
      const rAway = getTeamRank(game, "away") || 99;
      return Math.min(rHome, rAway);
    };

    return getBestRank(gameA) - getBestRank(gameB);
  });
}
