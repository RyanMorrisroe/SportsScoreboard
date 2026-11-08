import type { GameDetailTeam } from "./game";

type JsonObject = Record<string, unknown>;

export interface CurrentDriveSummary {
  description: string;
  result: string;
  possessionTeam: string;
  fieldPosition: string;
  downDistance: string;
  lastPlay: string;
  recap: string;
}

type DriveTeam = Pick<GameDetailTeam, "id" | "name" | "abbrev">;

function asObject(value: unknown): JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function getText(value: unknown, fallback = ""): string {
  return typeof value === "string" && value ? value : fallback;
}

function firstText(...values: unknown[]): string {
  return (
    values.find(
      (value): value is string => typeof value === "string" && value !== "",
    ) ?? ""
  );
}

export function getCurrentDriveSummary(
  drives: unknown,
  teams?: { away: DriveTeam; home: DriveTeam },
): CurrentDriveSummary | null {
  const drive = asObject(asObject(drives).current);
  if (Object.keys(drive).length === 0) return null;

  const plays = asArray(drive.plays);
  const lastPlay = asObject(plays[plays.length - 1]);
  const end = asObject(lastPlay.end);
  const start = asObject(lastPlay.start);
  const driveStart = asObject(drive.start);
  const driveTeam = asObject(drive.team);
  const driveTeamId = String(driveTeam.id ?? "");
  const matchingTeam = teams
    ? [teams.away, teams.home].find((team) => String(team.id) === driveTeamId)
    : undefined;
  const recapValue = drive.recap;
  const recap =
    typeof recapValue === "string"
      ? recapValue
      : getText(asObject(recapValue).recap);

  return {
    description: getText(drive.description, "Active drive ongoing..."),
    result: firstText(
      drive.displayResult,
      drive.shortDisplayResult,
      drive.result,
      "Ongoing",
    ),
    possessionTeam:
      matchingTeam?.name ||
      firstText(driveTeam.displayName, driveTeam.name, driveTeam.abbreviation),
    fieldPosition: firstText(
      end.possessionText,
      start.possessionText,
      driveStart.possessionText,
    ),
    downDistance: firstText(
      end.downDistanceText,
      start.downDistanceText,
      driveStart.downDistanceText,
    ),
    lastPlay: firstText(
      lastPlay.text,
      lastPlay.shortText,
      asObject(lastPlay.type).text,
    ),
    recap,
  };
}
