const STANDINGS_STAT_ORDER = [
  "playoffseed",
  "rank",
  "position",
  "wins",
  "losses",
  "ties",
  "overall",
  "winpercent",
  "winpercentage",
  "leaguewinpercent",
  "gamesbehind",
  "pointsfor",
  "runsfor",
  "pointsagainst",
  "runsagainst",
  "pointdifferential",
  "rundifferential",
  "homerecord",
  "home",
  "awayrecord",
  "away",
  "divisionwins",
  "divisionlosses",
  "divisionties",
  "divisionrecord",
  "vs division",
  "vsdivision",
  "conferencerecord",
  "vsconfrecord",
  "vsconference",
  "vs. conf.",
  "vs ap top 25",
  "vs usa ranked teams",
  "lasttenrecord",
  "lastten",
  "streak",
];
const STANDINGS_STAT_ORDER_INDEX = new Map(
  STANDINGS_STAT_ORDER.map((key, index) => [key, index]),
);
const HIDDEN_STANDING_STATS = new Set(["lockeddivrank"]);
const HIDDEN_COLLEGE_FOOTBALL_STATS = new Set([
  "divisionwins",
  "divisionlosses",
  "divisionties",
  "vs division",
]);

function getStatValue(stat, key) {
  if (
    ["divisionwins", "divisionties"].includes(String(key).toLowerCase()) &&
    stat.value !== undefined &&
    stat.value !== null
  ) {
    const numericValue = Number(stat.value);
    if (Number.isInteger(numericValue)) return String(numericValue);
  }
  if (stat.displayValue !== undefined && stat.displayValue !== null) {
    return stat.displayValue;
  }
  if (stat.summary !== undefined && stat.summary !== null) return stat.summary;
  if (stat.value !== undefined && stat.value !== null) return stat.value;
  return "--";
}

function normalizeEntry(entry, index, hiddenStats) {
  const stats = (Array.isArray(entry.stats) ? entry.stats : [])
    .filter((stat) => stat && (stat.name || stat.abbreviation || stat.displayName))
    .map((stat) => {
      const key = stat.name || stat.abbreviation || stat.displayName;
      return {
        key,
        label: stat.shortDisplayName || stat.abbreviation || stat.displayName || stat.name,
        value: getStatValue(stat, key),
      };
    })
    .filter((stat) => !hiddenStats.has(String(stat.key).toLowerCase()));

  return {
    id: entry.team?.id || `${entry.team?.abbreviation || entry.team?.displayName || "team"}-${index}`,
    name: entry.team?.displayName || entry.team?.name || "Unknown team",
    abbreviation: entry.team?.abbreviation || "",
    logo: entry.team?.logos?.[0]?.href || entry.team?.logo || "",
    note: entry.note?.description || "",
    stats,
  };
}

function collectGroups(node, path, groups, hiddenStats) {
  if (!node || typeof node !== "object") return;
  const name = node.name || node.displayName || "Standings";
  const id = node.id || node.abbreviation || name;
  const entries = node.standings?.entries || node.entries || [];
  if (Array.isArray(entries) && entries.some((entry) => entry?.team)) {
    const teams = entries
      .filter((entry) => entry?.team)
      .map((entry, index) => normalizeEntry(entry, index, hiddenStats));
    const columns = [];
    for (const team of teams) {
      for (const stat of team.stats) {
        if (!columns.some((column) => column.key === stat.key)) {
          columns.push({ key: stat.key, label: stat.label });
        }
      }
    }
    columns.sort((first, second) => {
      const firstOrder = STANDINGS_STAT_ORDER_INDEX.get(first.key.toLowerCase());
      const secondOrder = STANDINGS_STAT_ORDER_INDEX.get(second.key.toLowerCase());
      return (firstOrder ?? Infinity) - (secondOrder ?? Infinity);
    });
    groups.push({
      id: [...path, id].join("-"),
      name,
      depth: path.length,
      columns,
      teams,
    });
  }

  for (const child of Array.isArray(node.children) ? node.children : []) {
    collectGroups(child, [...path, id], groups, hiddenStats);
  }
}

export function normalizeStandings(payload, { league } = {}) {
  if (!payload || typeof payload !== "object") return [];
  const hiddenStats = new Set(HIDDEN_STANDING_STATS);
  if (league === "college-football") {
    for (const key of HIDDEN_COLLEGE_FOOTBALL_STATS) hiddenStats.add(key);
  }
  const groups = [];
  if (Array.isArray(payload.children) && payload.children.length > 0) {
    for (const child of payload.children) {
      collectGroups(child, [], groups, hiddenStats);
    }
  } else {
    collectGroups(payload, [], groups, hiddenStats);
  }
  return groups;
}

export function getUniqueStandingTeams(groups) {
  const teams = new Map();
  for (const group of Array.isArray(groups) ? groups : []) {
    for (const team of Array.isArray(group?.teams) ? group.teams : []) {
      if (team?.id === undefined || team?.id === null) continue;
      const id = String(team.id);
      if (!teams.has(id)) {
        teams.set(id, {
          id,
          name: team.name || id,
          abbreviation: team.abbreviation || "",
          logo: team.logo || "",
        });
      }
    }
  }
  return [...teams.values()].sort((first, second) =>
    first.name.localeCompare(second.name, undefined, { sensitivity: "base" }),
  );
}

export function getStandingPositionKey(group) {
  const positionKeys = ["playoffseed", "rank", "position"];
  return group?.columns?.find((column) =>
    positionKeys.includes(String(column.key).toLowerCase()),
  )?.key ?? null;
}

function getStandingSortValue(team, key) {
  const value = team.stats.find((stat) => stat.key === key)?.value;
  if (value === undefined || value === null || value === "--") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;

  const text = String(value).trim();
  if (!text) return null;
  const splitRecord = text.match(/^(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)$/);
  if (splitRecord) return Number(splitRecord[1]);

  const numericValue = Number(text.replaceAll(",", ""));
  return Number.isFinite(numericValue) ? numericValue : text.toLocaleLowerCase();
}

export function sortStandingTeams(teams, key, direction) {
  if (!key || !["asc", "desc"].includes(direction)) return teams;
  const multiplier = direction === "desc" ? -1 : 1;

  return teams
    .map((team, index) => ({
      team,
      index,
      value: getStandingSortValue(team, key),
    }))
    .sort((first, second) => {
      if (first.value === null) return second.value === null ? first.index - second.index : 1;
      if (second.value === null) return -1;

      const comparison =
        typeof first.value === "number" && typeof second.value === "number"
          ? first.value - second.value
          : String(first.value).localeCompare(String(second.value), undefined, {
              numeric: true,
              sensitivity: "base",
            });
      return comparison * multiplier || first.index - second.index;
    })
    .map(({ team }) => team);
}
