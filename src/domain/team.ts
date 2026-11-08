import type { NormalizedScheduleEntry } from "./schedule";

type JsonObject = Record<string, unknown>;

export interface TeamRecord {
  label: string;
  value: unknown;
}

export interface TeamRecordStat {
  key: string;
  category: string;
  label: string;
  value: unknown;
}

export interface TeamRecordStatGroup {
  key: string;
  label: string;
  categories: TeamRecordStatCategory[];
}

export interface TeamRecordStatCategory {
  key: string;
  label: string;
  stats: TeamRecordStat[];
}

export interface TeamDetailsView {
  team: {
    logos: { href?: string }[];
    logo?: string;
    displayName?: string;
    abbreviation?: string;
    location?: string;
    groups?: { name?: string };
  };
  groups?: { name?: string };
}

export interface TeamScheduleSections {
  upcoming: NormalizedScheduleEntry[];
  completed: NormalizedScheduleEntry[];
  lastFive: NormalizedScheduleEntry[];
}

function asObject(value: unknown): JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function getRecordItems(teamPayload: unknown): unknown[] {
  const team = asObject(asObject(teamPayload).team);
  const record = asObject(team.record);
  return asArray(record.items);
}

function getString(value: unknown, fallback: string): string {
  return typeof value === "string" && value ? value : fallback;
}

function getOptionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function normalizeGroup(value: unknown): { name?: string } | undefined {
  const group = asObject(value);
  const name = getOptionalString(group.name);
  return name === undefined ? undefined : { name };
}

export function normalizeTeamDetails(payload: unknown): TeamDetailsView | null {
  if (payload === null || payload === undefined) return null;
  const details = asObject(payload);
  const team = asObject(details.team);
  const logos = asArray(team.logos).map((value) => {
    const href = getOptionalString(asObject(value).href);
    return href === undefined ? {} : { href };
  });
  const normalizedTeam: TeamDetailsView["team"] = { logos };
  const logo = getOptionalString(team.logo);
  const displayName = getOptionalString(team.displayName);
  const abbreviation = getOptionalString(team.abbreviation);
  const location = getOptionalString(team.location);
  const groups = normalizeGroup(team.groups);
  if (logo !== undefined) normalizedTeam.logo = logo;
  if (displayName !== undefined) normalizedTeam.displayName = displayName;
  if (abbreviation !== undefined) normalizedTeam.abbreviation = abbreviation;
  if (location !== undefined) normalizedTeam.location = location;
  if (groups !== undefined) normalizedTeam.groups = groups;
  const rootGroups = normalizeGroup(details.groups);
  return {
    team: normalizedTeam,
    ...(rootGroups === undefined ? {} : { groups: rootGroups }),
  };
}

function formatStatValue(stat: JsonObject): unknown {
  if (stat.displayValue !== undefined && stat.displayValue !== null) {
    return stat.displayValue;
  }
  if (typeof stat.value !== "number") return stat.value;
  if (
    typeof stat.name === "string" &&
    /win.?percent|percentage|pct/i.test(stat.name) &&
    stat.value >= 0 &&
    stat.value <= 1
  ) {
    return `${(stat.value * 100).toFixed(1)}%`;
  }
  return Number(stat.value.toFixed(3));
}

export function getTeamRecords(teamPayload: unknown): TeamRecord[] {
  return getRecordItems(teamPayload).map((item) => {
    const itemObj = asObject(item);
    return {
      label: getString(
        itemObj.description,
        getString(itemObj.displayName, "Record"),
      ),
      value: itemObj.summary || itemObj.displayValue || "--",
    };
  });
}

export function getTeamRecordStats(teamPayload: unknown): TeamRecordStat[] {
  return getRecordItems(teamPayload).flatMap((item) => {
    const itemObj = asObject(item);
    const category = getString(
      itemObj.description,
      getString(itemObj.displayName, getString(itemObj.type, "Season")),
    );
    return asArray(itemObj.stats).flatMap((statValue) => {
      const stat = asObject(statValue);
      if (typeof stat.name !== "string" || !stat.name) return [];
      return [
        {
          key: `${getString(
            itemObj.type,
            category.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
          )}-${stat.name}`,
          category,
          label: stat.name
            .replace(/([A-Z])/g, " $1")
            .replace(/^./, (letter) => letter.toUpperCase()),
          value: formatStatValue(stat),
        },
      ];
    });
  });
}

export function groupTeamRecordStats(
  stats: TeamRecordStat[],
): TeamRecordStatGroup[] {
  const groups = new Map<string, TeamRecordStatGroup>();
  for (const stat of stats) {
    const name = stat.label.toLowerCase();
    const key = /power play|penalty kill|special team/.test(name)
      ? "special-teams"
      : /win|loss|tie|percent|rank|seed|streak|record|games behind/.test(name)
      ? "results"
      : /point|run|goal|score|differential/.test(name)
        ? "scoring"
        : /offen|pass|rush|yard|reception|attempt|assist|rebound|shot|hit|bat|faceoff/.test(
              name,
            )
          ? "offense"
          : /defen|against|allowed|sack|interception|turnover|block|steal|save|field|out/.test(
                name,
              )
            ? "defense"
            : "other";
    const label =
        key === "special-teams"
          ? "Special Teams"
          : key === "results"
            ? "Results"
            : key === "scoring"
          ? "Scoring"
          : key === "offense"
            ? "Offense"
            : key === "defense"
              ? "Defense"
              : "Other";
    const group = groups.get(key) ?? { key, label, categories: [] };
    const categoryKey = stat.category.toLowerCase();
    let category = group.categories.find((entry) => entry.key === categoryKey);
    if (!category) {
      category = { key: categoryKey, label: stat.category, stats: [] };
      group.categories.push(category);
    }
    category.stats.push(stat);
    groups.set(key, group);
  }
  const groupOrder = [
    "results",
    "scoring",
    "offense",
    "defense",
    "special-teams",
    "other",
  ];
  const categoryOrder = (category: TeamRecordStatCategory) => {
    const name = category.label.toLowerCase();
    if (/overall|total/.test(name)) return 0;
    if (/conference|league/.test(name)) return 1;
    if (/division/.test(name)) return 2;
    if (/home/.test(name)) return 3;
    if (/away/.test(name)) return 4;
    return 5;
  };
  const statOrder = (stat: TeamRecordStat) => {
    const name = stat.label.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const priorities: Record<string, number> = {
      wins: 0,
      losses: 1,
      ties: 2,
      "win percent": 3,
      "win percentage": 3,
      streak: 4,
      "ot wins": 5,
      "overtime wins": 5,
      "ot losses": 6,
      "overtime losses": 6,
      "shootout wins": 7,
      "shootout losses": 8,
      "playoff seed": 9,
      "games behind": 10,
    };
    return priorities[name] ?? 100;
  };

  return [...groups.values()]
    .sort(
      (first, second) =>
        groupOrder.indexOf(first.key) - groupOrder.indexOf(second.key),
    )
    .map((group) => ({
      ...group,
      categories: group.categories
        .sort(
          (first, second) =>
            categoryOrder(first) - categoryOrder(second) ||
            first.label.localeCompare(second.label),
        )
        .map((category) => ({
          ...category,
          stats: category.stats.sort(
            (first, second) =>
              statOrder(first) - statOrder(second) ||
              first.label.localeCompare(second.label),
          ),
        })),
    }));
}

export function getTeamScheduleSections(
  schedule: NormalizedScheduleEntry[],
): TeamScheduleSections {
  const upcoming = schedule
    .filter((game) => game.state !== "post")
    .sort((first, second) => {
      const stateOrder =
        Number(second.state === "in") - Number(first.state === "in");
      const firstTime = first.startTime ?? Number.MAX_SAFE_INTEGER;
      const secondTime = second.startTime ?? Number.MAX_SAFE_INTEGER;
      return stateOrder || firstTime - secondTime;
    });
  const completed = schedule
    .filter((game) => game.state === "post")
    .sort(
      (first, second) =>
        (second.startTime ?? Number.MIN_SAFE_INTEGER) -
        (first.startTime ?? Number.MIN_SAFE_INTEGER),
    );

  return {
    upcoming,
    completed,
    lastFive: completed
      .filter((game) => game.result !== "")
      .slice(0, 5),
  };
}

export function getTeamDirectoryOptions(payload: unknown): Array<{
  id: string;
  name: string;
  abbreviation: string;
  logo: string;
}> {
  const sports = asArray(asObject(payload).sports).map(asObject);
  const leagues = sports.flatMap((sport) =>
    asArray(sport.leagues).map(asObject),
  );
  const teams = leagues.flatMap((league) =>
    asArray(league.teams).map(asObject),
  );

  return teams
    .flatMap((entry) => {
      const team = asObject(entry.team);
      if (team.id === undefined || team.id === null) return [];
      const id = String(team.id);
      const logos = asArray(team.logos).map(asObject);
      return [
        {
          id,
          name: getString(team.displayName, getString(team.name, id)),
          abbreviation: getString(team.abbreviation, ""),
          logo: getString(logos[0]?.href, getString(team.logo, "")),
        },
      ];
    })
    .sort((first, second) =>
      first.name.localeCompare(second.name, undefined, { sensitivity: "base" }),
    );
}
