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
  if (selectedLeague === "nfl" || selectedLeague === "college-football" || selectedLeague === "football") {
    return comp?.situation?.downDistanceText || "";
  }
  if (getGameState(game) === "in") {
    return game?.status?.type?.detail || game?.status?.type?.shortDetail || "";
  }
  return "";
}

export function hasPossession(game, homeAway, selectedLeague) {
  if (!["nfl", "college-football", "football"].includes(selectedLeague)) return false;
  const competitionsList = game?.competitions || [];
  const comp = competitionsList.length > 0 ? competitionsList[0] : {};
  const competitorsList = comp.competitors || [];
  const teamId = competitorsList.find((c) => c.homeAway === homeAway)?.id;
  return (
    comp?.situation?.possession &&
    comp?.situation?.possession === teamId
  );
}

export function getLinescoreHeaders(selectedLeague, awayLines = [], homeLines = []) {
  const defaultPeriods = {
    mlb: 9,
    nba: 4,
    nhl: 3,
    nfl: 4,
    "college-football": 4,
    football: 4,
  }[selectedLeague] || 0;
  const periodCount = Math.max(awayLines.length, homeLines.length, defaultPeriods);

  return Array.from({ length: periodCount }, (_, index) => {
    if (selectedLeague === "mlb") return index + 1;
    const regulationPeriods = selectedLeague === "nhl" ? 3 : 4;
    if (index < regulationPeriods) return index + 1;
    return index === regulationPeriods ? "OT" : `${index - regulationPeriods + 1}OT`;
  });
}

export function getLinescoreValues(competition, periodCount) {
  const competitors = competition?.competitors || [];
  const formatTeamLines = (homeAway) => {
    const linescores = competitors.find((team) => team.homeAway === homeAway)?.linescores || [];
    return Array.from({ length: periodCount }, (_, index) => {
      const line = linescores[index];
      return line ? line.displayValue || (line.value ?? "0") : "-";
    });
  };

  return {
    away: formatTeamLines("away"),
    home: formatTeamLines("home"),
  };
}

export function getPlayerLeaders(gameDetail) {
  const players = gameDetail?.raw?.boxscore?.players || [];
  const categories = [];

  players.forEach((teamBlock) => {
    const teamAbbrev = teamBlock.team?.abbreviation || "";
    if (!Array.isArray(teamBlock.statistics)) return;

    teamBlock.statistics.forEach((statCategory) => {
      if (!Array.isArray(statCategory.athletes) || !statCategory.athletes.length) return;
      const title = statCategory.name || statCategory.displayName || "Player stats";
      let category = categories.find(
        (item) => item.title.toLowerCase() === title.toLowerCase(),
      );
      if (!category) {
        category = {
          title: title.charAt(0).toUpperCase() + title.slice(1),
          labels: statCategory.labels || [],
          athletes: [],
        };
        categories.push(category);
      }

      statCategory.athletes.slice(0, 2).forEach((playerRow) => {
        category.athletes.push({
          name: playerRow.athlete?.displayName || "Player",
          jersey: playerRow.athlete?.jersey || "-",
          headshot:
            playerRow.athlete?.headshot?.href ||
            "https://a.espncdn.com/i/headshots/placeholder.png",
          teamAbbrev,
          stats: playerRow.stats || [],
        });
      });
    });
  });

  return categories;
}

function getNumericStatValue(stat) {
  const value = Number.parseFloat(stat?.value);
  if (Number.isFinite(value)) return value;

  const displayValue = Number.parseFloat(stat?.displayValue);
  return Number.isFinite(displayValue) ? displayValue : 0;
}

export function getTeamStatComparisons(awayStats = [], homeStats = []) {
  return awayStats.map((awayStat) => {
    const homeStat = homeStats.find((stat) => stat.name === awayStat.name) || {};
    const awayValue = getNumericStatValue(awayStat);
    const homeValue = getNumericStatValue(homeStat);
    const total = awayValue + homeValue;
    const awayPct = total > 0 ? (awayValue / total) * 100 : 50;

    return {
      label: awayStat.label || awayStat.name,
      awayDisplay: awayStat.displayValue ?? awayStat.value ?? "0",
      homeDisplay: homeStat.displayValue ?? homeStat.value ?? "0",
      awayPct,
      homePct: total > 0 ? (homeValue / total) * 100 : 50,
    };
  });
}

const BASEBALL_STAT_GROUPS = {
  batting: [
    { key: "atBats", label: "At Bats" },
    { key: "runs", label: "Runs" },
    { key: "hits", label: "Hits" },
    { key: "homeRuns", label: "Home Runs" },
    { key: "RBIs", label: "Runs Batted In" },
    { key: "walks", label: "Walks" },
    { key: "strikeouts", label: "Strikeouts" },
    { key: "stolenBases", label: "Stolen Bases" },
    { key: "runnersLeftOnBase", label: "Left On Base" },
    { key: "avg", label: "Batting Average" },
    { key: "onBasePct", label: "On-Base Percentage" },
    { key: "slugAvg", label: "Slugging Percentage" },
    { key: "OPS", label: "OPS" },
  ],
  pitching: [
    { key: "innings", label: "Innings Pitched" },
    { key: "hits", label: "Hits Allowed" },
    { key: "runs", label: "Runs Allowed" },
    { key: "earnedRuns", label: "Earned Runs" },
    { key: "strikeouts", label: "Strikeouts" },
    { key: "walks", label: "Walks" },
    { key: "homeRuns", label: "Home Runs Allowed" },
    { key: "pitches", label: "Pitches" },
    { key: "ERA", label: "ERA" },
    { key: "WHIP", label: "WHIP" },
  ],
  fielding: [
    { key: "errors", label: "Errors" },
    { key: "assists", label: "Assists" },
    { key: "putouts", label: "Putouts" },
    { key: "doublePlays", label: "Double Plays" },
    { key: "fieldingPct", label: "Fielding Percentage" },
  ],
};

export function getBaseballTeamStatComparisons(boxscoreTeams, groupName) {
  const metrics = BASEBALL_STAT_GROUPS[groupName];
  if (!metrics || !Array.isArray(boxscoreTeams)) return [];

  const getGroupStats = (homeAway) => {
    const team = boxscoreTeams.find((entry) => entry.homeAway === homeAway);
    return team?.statistics?.find((group) => group.name === groupName)?.stats || [];
  };
  const awayStats = getGroupStats("away");
  const homeStats = getGroupStats("home");

  return metrics.flatMap((metric) => {
    const awayStat = awayStats.find((stat) => stat.name === metric.key);
    const homeStat = homeStats.find((stat) => stat.name === metric.key);
    if (!awayStat && !homeStat) return [];

    const awayValue = getNumericStatValue(awayStat);
    const homeValue = getNumericStatValue(homeStat);
    const total = awayValue + homeValue;

    return [{
      label: metric.label,
      awayDisplay: awayStat?.displayValue ?? awayStat?.value ?? "0",
      homeDisplay: homeStat?.displayValue ?? homeStat?.value ?? "0",
      awayPct: total > 0 ? (awayValue / total) * 100 : 0,
      homePct: total > 0 ? (homeValue / total) * 100 : 0,
    }];
  });
}

function normalizeHexColor(value) {
  if (typeof value !== "string") return null;
  const hex = value.trim().replace(/^#/, "");
  return /^[\da-f]{6}$/i.test(hex) ? `#${hex}` : null;
}

function relativeLuminance(hexColor) {
  const channels = hexColor.slice(1).match(/.{2}/g).map((channel) => {
    const value = parseInt(channel, 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function lightenHexColor(hexColor, amount = 0.5) {
  const channels = hexColor.slice(1).match(/.{2}/g).map((channel) => {
    const value = parseInt(channel, 16);
    return Math.round(value + (255 - value) * amount)
      .toString(16)
      .padStart(2, "0");
  });
  return `#${channels.join("")}`;
}

function getTeamStatBarColor(team, fallback) {
  const primary = normalizeHexColor(team?.color);
  const alternate = normalizeHexColor(team?.alternateColor);
  if (!primary) return alternate || fallback;

  const primaryLuminance = relativeLuminance(primary);
  if (primaryLuminance < 0.12) {
    if (
      alternate &&
      relativeLuminance(alternate) >= 0.12 &&
      relativeLuminance(alternate) > primaryLuminance
    ) {
      return alternate;
    }
    return lightenHexColor(primary);
  }
  return primary;
}

export function getTeamStatBarColors(teams) {
  return {
    away: getTeamStatBarColor(teams?.away, "#2563eb"),
    home: getTeamStatBarColor(teams?.home, "#059669"),
  };
}

export function getWinProbabilityChart(probabilities) {
  if (!Array.isArray(probabilities) || probabilities.length === 0) {
    return { points: "", singlePoint: null };
  }

  const values = probabilities
    .map((entry) => {
      const rawProbability = entry?.homeWinPercentage ?? entry?.homeProbability;
      if (rawProbability === null || rawProbability === undefined || rawProbability === "") {
        return null;
      }
      const probability = Number(rawProbability);
      return Number.isFinite(probability)
        ? Math.min(1, Math.max(0, probability))
        : null;
    })
    .filter((probability) => probability !== null);

  if (values.length === 0) return { points: "", singlePoint: null };

  const coordinates = values.map((probability, index) => ({
    x: values.length === 1 ? 50 : Number(((index / (values.length - 1)) * 100).toFixed(2)),
    y: Number((probability * 100).toFixed(2)),
  }));

  return {
    points: coordinates.map(({ x, y }) => `${x},${y}`).join(" "),
    singlePoint: coordinates.length === 1 ? coordinates[0] : null,
  };
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
  const statusDetail = game?.status?.type?.detail || "";
  if (state !== "pre") return detail;

  const competition = game?.competitions?.[0];
  if (
    game?.timeValid === false ||
    competition?.timeValid === false ||
    /\bTBD\b/i.test(`${detail} ${statusDetail}`)
  ) {
    return "TBD";
  }
  if (!game.date) return detail;

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

export function getSeriesSummary(competition) {
  const series = competition?.series;
  const seriesCompetitors = series?.competitors;
  if (!Array.isArray(seriesCompetitors) || seriesCompetitors.length !== 2) return "";

  const records = seriesCompetitors.map((record) => {
    const competitor = competition.competitors?.find(
      (candidate) => String(candidate.id) === String(record.id),
    );
    const wins = Number(record.wins);
    const name = competitor?.team?.displayName || competitor?.team?.location;
    if (!name || !Number.isFinite(wins) || wins < 0) return null;
    return { name, wins };
  });
  if (records.some((record) => !record)) return "";

  const [first, second] = records;
  const bestOf = Number(series.totalCompetitions);
  const hasBestOf = Number.isInteger(bestOf) && bestOf > 0;
  const bestOfLabel = hasBestOf ? `Best of ${bestOf} · ` : "";
  const tieCounts = seriesCompetitors
    .map((record) => Number(record.ties))
    .filter((ties) => Number.isFinite(ties) && ties > 0);
  const tiedGames = tieCounts.length ? Math.max(...tieCounts) : 0;
  const isNonPlayoff =
    typeof series.type === "string" && series.type.toLowerCase() !== "playoff";
  const isComplete =
    series.completed === true ||
    (isNonPlayoff && hasBestOf && first.wins + second.wins + tiedGames === bestOf);
  const resultLabel = first.wins === second.wins
    ? `Series tied ${first.wins}-${second.wins}`
    : `${first.wins > second.wins ? first.name : second.name} ${isComplete ? "wins series" : "lead"} ${Math.max(first.wins, second.wins)}-${Math.min(first.wins, second.wins)}`;
  const tiesLabel = tiedGames > 0
    ? ` · ${tiedGames} tied game${tiedGames === 1 ? "" : "s"}`
    : "";

  return `${bestOfLabel}${resultLabel}${tiesLabel}`;
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
