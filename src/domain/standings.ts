import { resolveLeague } from "../plugins/registry";

type JsonObject = Record<string, unknown>;

export interface StandingStat {
  key: string;
  label: string;
  value: unknown;
}

export interface StandingColumn {
  key: string;
  label: string;
}

export interface StandingTeam {
  id: string | number;
  name: string;
  abbreviation: string;
  logo: string;
  note: string;
  stats: StandingStat[];
}

export interface StandingGroup {
  id: string;
  name: string;
  depth: number;
  columns: StandingColumn[];
  teams: StandingTeam[];
}

interface SortableStandingTeam {
  stats: Array<{ key: string; value: unknown }>;
}

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

function getStatValue(stat: JsonObject, key: unknown): unknown {
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

function normalizeEntry(entryValue: unknown, index: number, hiddenStats: Set<string>): StandingTeam {
  const entry = asObject(entryValue);
  const stats = asArray(entry.stats)
    .map(asObject)
    .filter((stat) => stat.name || stat.abbreviation || stat.displayName)
    .map((stat) => {
      const key = String(stat.name || stat.abbreviation || stat.displayName);
      return {
        key,
        label: getString(
          stat.shortDisplayName,
          getString(stat.abbreviation, getString(stat.displayName, getString(stat.name))),
        ),
        value: getStatValue(stat, key),
      };
    })
    .filter((stat) => !hiddenStats.has(stat.key.toLowerCase()));
  const team = asObject(entry.team);
  const logos = asArray(team.logos).map(asObject);
  const teamId = team.id || `${getString(team.abbreviation, getString(team.displayName, "team"))}-${index}`;

  return {
    id: typeof teamId === "number" || typeof teamId === "string" ? teamId : String(teamId),
    name: getString(team.displayName, getString(team.name, "Unknown team")),
    abbreviation: getString(team.abbreviation),
    logo: getString(logos[0]?.href, getString(team.logo)),
    note: getString(asObject(entry.note).description),
    stats,
  };
}

function collectGroups(
  nodeValue: unknown,
  path: string[],
  groups: StandingGroup[],
  hiddenStats: Set<string>,
): void {
  if (nodeValue === null || typeof nodeValue !== "object" || Array.isArray(nodeValue)) return;
  const node = asObject(nodeValue);
  const name = getString(node.name, getString(node.displayName, "Standings"));
  const id = getString(node.id, getString(node.abbreviation, name));
  const entries = asArray(asObject(node.standings).entries ?? node.entries);
  const eligibleEntries = entries.filter((entry) => Boolean(asObject(entry).team));

  if (eligibleEntries.length > 0) {
    const teams = eligibleEntries.map((entry, index) => normalizeEntry(entry, index, hiddenStats));
    const columns: StandingColumn[] = [];
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

  for (const child of asArray(node.children)) {
    collectGroups(child, [...path, id], groups, hiddenStats);
  }
}

export function normalizeStandings(
  payload: unknown,
  { league }: { league?: string } = {},
): StandingGroup[] {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return [];
  const hiddenStats = new Set(
    resolveLeague(league ?? "")?.standings.hiddenStatKeys ?? ["lockeddivrank"],
  );
  const groups: StandingGroup[] = [];
  const children = asArray(asObject(payload).children);
  if (children.length > 0) {
    for (const child of children) {
      collectGroups(child, [], groups, hiddenStats);
    }
  } else {
    collectGroups(payload, [], groups, hiddenStats);
  }
  return groups;
}

export function getUniqueStandingTeams(groups: unknown): Array<{
  id: string;
  name: string;
  abbreviation: string;
  logo: string;
}> {
  const teams = new Map<string, { id: string; name: string; abbreviation: string; logo: string }>();
  for (const groupValue of asArray(groups)) {
    const group = asObject(groupValue);
    for (const teamValue of asArray(group.teams)) {
      const team = asObject(teamValue);
      if (team.id === undefined || team.id === null) continue;
      const id = String(team.id);
      if (!teams.has(id)) {
        teams.set(id, {
          id,
          name: getString(team.name, id),
          abbreviation: getString(team.abbreviation),
          logo: getString(team.logo),
        });
      }
    }
  }
  return [...teams.values()].sort((first, second) =>
    first.name.localeCompare(second.name, undefined, { sensitivity: "base" }),
  );
}

export function getStandingPositionKey(groupValue: unknown): string | null {
  const columns = asArray(asObject(groupValue).columns).map(asObject);
  const positionKeys = ["playoffseed", "rank", "position"];
  const key = columns.find((column) =>
    positionKeys.includes(String(column.key).toLowerCase()),
  )?.key;
  return typeof key === "string" ? key : null;
}

function getStandingSortValue(team: SortableStandingTeam, key: string): number | string | null {
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

export function sortStandingTeams<T extends SortableStandingTeam>(
  teams: T[],
  key: string | null | undefined,
  direction: "asc" | "desc" | null | undefined,
): T[] {
  if (!key || !["asc", "desc"].includes(direction || "")) return teams;
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
