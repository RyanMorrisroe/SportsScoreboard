type JsonObject = Record<string, unknown>;

export interface TeamRecord {
  label: string;
  value: unknown;
}

export interface TeamRecordStat {
  key: string;
  label: string;
  value: unknown;
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

function asObject(value: unknown): JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as JsonObject
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
  return Number(stat.value.toFixed(3));
}

export function getTeamRecords(teamPayload: unknown): TeamRecord[] {
  return getRecordItems(teamPayload).map((item) => {
    const itemObj = asObject(item);
    return {
      label: getString(itemObj.description, getString(itemObj.displayName, "Record")),
      value: itemObj.summary || itemObj.displayValue || "--",
    };
  });
}

export function getTeamRecordStats(teamPayload: unknown): TeamRecordStat[] {
  return getRecordItems(teamPayload).flatMap((item) => {
    const itemObj = asObject(item);
    return asArray(itemObj.stats).flatMap((statValue) => {
      const stat = asObject(statValue);
      if (typeof stat.name !== "string" || !stat.name) return [];
      return [{
        key: `${getString(itemObj.type, "record")}-${stat.name}`,
        label: stat.name
          .replace(/([A-Z])/g, " $1")
          .replace(/^./, (letter) => letter.toUpperCase()),
        value: formatStatValue(stat),
      }];
    });
  });
}