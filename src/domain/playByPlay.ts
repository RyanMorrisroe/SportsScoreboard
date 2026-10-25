import { resolveLeague } from "../plugins/registry";

type JsonObject = Record<string, unknown>;

export interface NormalizedPlayEvent {
  id: string;
  order: number;
  sequenceNumber: unknown;
  periodNumber: number | null;
  periodLabel: string;
  periodType: string;
  clock: string;
  description: string;
  eventType: string;
  teamId: string;
  teamAbbreviation: string;
  scoring: boolean;
  awayScore: number | null;
  homeScore: number | null;
  scoreValue: number | null;
  downDistance: string;
  fieldPosition: string;
  yardLine: number | null;
  drive: unknown;
  isTurnover: boolean;
  isPenalty: boolean;
  pitchCount: unknown;
  outs: unknown;
}

export interface PlayByPlayTimeline {
  mode: "all-plays" | "scoring-only" | "unavailable";
  events: NormalizedPlayEvent[];
}

function asObject(value: unknown): JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as JsonObject
    : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function getText(value: unknown, fallback = ""): string {
  return typeof value === "string" && value ? value : fallback;
}

function getFootballPlays(raw: JsonObject): JsonObject[] {
  const drives = asObject(raw.drives);
  const previous = asArray(drives.previous).map(asObject);
  const current = drives.current ? [asObject(drives.current)] : [];
  return [...previous, ...current].flatMap((drive) =>
    asArray(drive.plays).map((playValue) => {
      const play = asObject(playValue);
      const team = asObject(drive.team);
      return {
        ...play,
        drive: {
          id: drive.id || "",
          description: drive.description || "",
          result: drive.displayResult || drive.shortDisplayResult || drive.result || "",
          teamId: team.id ? String(team.id) : "",
          teamAbbreviation: team.abbreviation || "",
        },
      };
    }),
  );
}

function getOrdinal(value: unknown): string {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) return String(value || "");
  const suffix = number % 100 >= 11 && number % 100 <= 13
    ? "th"
    : ({ 1: "st", 2: "nd", 3: "rd" }[number % 10] || "th");
  return `${number}${suffix}`;
}

function getPeriodLabel(period: JsonObject, league: string): string {
  if (!period.number) return getText(period.displayValue);
  const behavior = resolveLeague(league);
  if (!behavior) {
    if (period.displayValue) return getText(period.displayValue);
    return period.type
      ? `${String(period.type)} ${String(period.number)}`
      : `Period ${String(period.number)}`;
  }

  const ordinal = getOrdinal(period.number);
  const number = Number(period.number);
  if (behavior.linescore.periodLabelStyle === "inning") {
    const type = String(period.type || "").toLowerCase();
    const side = type === "top" ? "Top of" : type === "bottom" ? "Bottom of" : "";
    return `${side ? `${side} ` : ""}${ordinal} Inning`;
  }
  if (
    behavior.linescore.overtimeLabelStyle === "overtime" &&
    number > behavior.linescore.regulationPeriods
  ) {
    return `Overtime ${number - behavior.linescore.regulationPeriods}`;
  }

  const periodName = behavior.linescore.periodLabelStyle === "quarter"
    ? "Quarter"
    : "Period";
  return `${ordinal} ${periodName}`;
}

function getTeamId(play: JsonObject): string {
  const team = asObject(play.team);
  if (team.id !== undefined && team.id !== null) return String(team.id);
  const participant = asObject(asArray(play.teamParticipants)[0]);
  const participantTeam = asObject(participant.team);
  const id = participantTeam.id ?? participant.id;
  return id === undefined || id === null ? "" : String(id);
}

function getScoreValue(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const score = Number(value);
  return Number.isFinite(score) ? score : null;
}

function normalizeEvent(
  play: JsonObject,
  index: number,
  league: string,
  scoringOnly = false,
): NormalizedPlayEvent {
  const behavior = resolveLeague(league);
  const period = asObject(play.period);
  const drive = asObject(play.drive);
  const team = asObject(play.team);
  const teamId = getTeamId(play) || getText(drive.teamId);
  const scoreValue = getScoreValue(play.scoreValue);
  const isScoring =
    scoringOnly || play.scoringPlay === true || (scoreValue !== null && scoreValue > 0);
  const end = asObject(play.end);
  const type = asObject(play.type);
  const clock = asObject(play.clock);
  const footballDetails = behavior?.linescore.situation === "football";
  const yardLine = Number(end.yardLine);

  return {
    id: String(play.id ?? `event-${index}`),
    order: index,
    sequenceNumber: play.sequenceNumber ?? null,
    periodNumber: Number.isFinite(Number(period.number)) ? Number(period.number) : null,
    periodLabel: getPeriodLabel(period, league),
    periodType: getText(period.type),
    clock: getText(clock.displayValue),
    description: getText(play.text, getText(play.shortText, getText(type.text, "Play details unavailable."))),
    eventType: getText(type.text, getText(play.summaryType)),
    teamId,
    teamAbbreviation: getText(team.abbreviation, getText(drive.teamAbbreviation)),
    scoring: isScoring,
    awayScore: getScoreValue(play.awayScore),
    homeScore: getScoreValue(play.homeScore),
    scoreValue,
    downDistance: footballDetails ? getText(end.downDistanceText) : "",
    fieldPosition: footballDetails ? getText(end.possessionText) : "",
    yardLine: footballDetails && Number.isFinite(yardLine) ? yardLine : null,
    drive: play.drive ?? null,
    isTurnover: play.isTurnover === true,
    isPenalty: play.isPenalty === true,
    pitchCount: play.pitchCount ?? null,
    outs: play.outs ?? null,
  };
}

function getSequenceNumber(event: NormalizedPlayEvent): number | null {
  if (event.sequenceNumber === null || event.sequenceNumber === undefined || event.sequenceNumber === "") {
    return null;
  }
  const sequence = Number(event.sequenceNumber);
  return Number.isFinite(sequence) ? sequence : null;
}

function getClockSeconds(event: NormalizedPlayEvent): number | null {
  const match = event.clock.match(/^(\d+):(\d{2})$/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

function compareEvents(left: NormalizedPlayEvent, right: NormalizedPlayEvent): number {
  const leftPeriod = left.periodNumber;
  const rightPeriod = right.periodNumber;
  if (leftPeriod !== null && rightPeriod !== null && leftPeriod !== rightPeriod) {
    return leftPeriod - rightPeriod;
  }

  const leftSequence = getSequenceNumber(left);
  const rightSequence = getSequenceNumber(right);
  if (leftSequence !== null && rightSequence !== null && leftSequence !== rightSequence) {
    return leftSequence - rightSequence;
  }

  const leftClock = getClockSeconds(left);
  const rightClock = getClockSeconds(right);
  if (leftClock !== null && rightClock !== null && leftClock !== rightClock) {
    return rightClock - leftClock;
  }
  return left.order - right.order;
}

export function normalizePlayByPlay(rawValue: unknown, league: string): PlayByPlayTimeline {
  const raw = asObject(rawValue);
  const summaryPlays = asArray(raw.plays);
  const behavior = resolveLeague(league);
  const footballPlays = behavior?.game.supportsDrives ? getFootballPlays(raw) : [];
  const fullPlays = summaryPlays.length ? summaryPlays.map(asObject) : footballPlays;
  const scoringPlays = asArray(raw.scoringPlays).map(asObject);
  const source = fullPlays.length ? fullPlays : scoringPlays;
  const uniquePlays: JsonObject[] = [];
  const seenIds = new Set<string>();

  for (const play of source) {
    const id = play.id === undefined || play.id === null ? null : String(play.id);
    if (id && seenIds.has(id)) continue;
    if (id) seenIds.add(id);
    uniquePlays.push(play);
  }

  return {
    mode: fullPlays.length ? "all-plays" : scoringPlays.length ? "scoring-only" : "unavailable",
    events: uniquePlays
      .map((play, index) => normalizeEvent(play, index, league, fullPlays.length === 0))
      .sort(compareEvents)
      .map((event, index) => ({ ...event, order: index })),
  };
}
