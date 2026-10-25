import { DEFAULT_LEAGUE_BEHAVIOR, resolveLeague } from "../plugins/registry";

type JsonObject = Record<string, unknown>;
type HomeAway = "away" | "home";

function asObject(value: unknown): JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as JsonObject
    : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

export function isBeforeFootballWeekStart(
  date: Date = new Date(),
  timeZone: string = Intl.DateTimeFormat().resolvedOptions().timeZone,
) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "numeric",
    hourCycle: "h23",
  }).formatToParts(date);
  const weekday = parts.find((part) => part.type === "weekday")?.value;
  const hour = Number(parts.find((part) => part.type === "hour")?.value);
  return weekday === "Sun" && hour < 3;
}

export function getGameState(game: unknown): string {
  const statusType = asObject(asObject(asObject(game).status).type);
  return asString(statusType.state).toLowerCase();
}

export function getSituation(game: unknown, selectedLeague: string): unknown {
  const behavior = resolveLeague(selectedLeague);
  const gameObject = asObject(game);
  const statusType = asObject(asObject(gameObject.status).type);
  const comp = asObject(asArray(gameObject.competitions)[0]);
  const situation = asObject(comp.situation);
  if (behavior?.linescore.situation === "baseball") {
    if (getGameState(game) === "in") return statusType.detail || "";
    return "";
  }
  if (behavior?.linescore.situation === "football" || selectedLeague === "football") {
    return situation.downDistanceText || "";
  }
  if (getGameState(game) === "in") {
    return statusType.detail || statusType.shortDetail || "";
  }
  return "";
}

export function hasPossession(
  game: unknown,
  homeAway: HomeAway,
  selectedLeague: string,
): boolean {
  const supportsPossession =
    resolveLeague(selectedLeague)?.linescore.supportsPossession ||
    selectedLeague === "football";
  if (!supportsPossession) return false;
  const gameObject = asObject(game);
  const comp = asObject(asArray(gameObject.competitions)[0]);
  const competitors = asArray(comp.competitors).map(asObject);
  const teamId = competitors.find((competitor) => competitor.homeAway === homeAway)?.id;
  const possession = asObject(comp.situation).possession;
  return Boolean(possession && possession === teamId);
}

export function getLinescoreHeaders(
  selectedLeague: string,
  awayLines: unknown[] = [],
  homeLines: unknown[] = [],
): (number | string)[] {
  const behavior = resolveLeague(selectedLeague);
  const defaultPeriods = behavior?.linescore.regulationPeriods ??
    (selectedLeague === "football" ? 4 : 0);
  const periodCount = Math.max(awayLines.length, homeLines.length, defaultPeriods);

  return Array.from({ length: periodCount }, (_, index) => {
    if (behavior?.linescore.kind === "inning" || selectedLeague === "mlb") return index + 1;
    const regulationPeriods = behavior?.linescore.regulationPeriods ??
      (selectedLeague === "nhl" ? 3 : 4);
    if (index < regulationPeriods) return index + 1;
    return index === regulationPeriods ? "OT" : `${index - regulationPeriods + 1}OT`;
  });
}

export function getLinescoreValues(
  competition: unknown,
  periodCount: number,
): { away: unknown[]; home: unknown[] } {
  const competitors = asArray(asObject(competition).competitors).map(asObject);
  const formatTeamLines = (homeAway: HomeAway): unknown[] => {
    const linescores = asArray(
      competitors.find((team) => team.homeAway === homeAway)?.linescores,
    ).map(asObject);
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

function getPlayerStatGroupTitle(
  category: JsonObject,
  league: string,
  labels: string[],
): string {
  const sourceTitle = category.name || category.displayName || category.shortDisplayName;
  if (typeof sourceTitle === "string" && sourceTitle) {
    return sourceTitle
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/^./, (letter) => letter.toUpperCase());
  }

  if (resolveLeague(league)?.family === "baseball") {
    if (
      labels.includes("IP") ||
      (Array.isArray(category.keys) && category.keys.includes("fullInnings.partInnings"))
    ) {
      return "Pitching";
    }
    if (labels.includes("H-AB") || labels.includes("AB")) return "Batting";
    if (labels.includes("E") || labels.includes("PO")) return "Fielding";
  }

  return "Player Stats";
}

export interface PlayerBoxScorePlayer {
  id: string;
  name: string;
  jersey: string;
  position: string;
  headshot: string;
  starter: boolean;
  stats: unknown[];
}

export interface PlayerBoxScoreGroup {
  id: string;
  title: string;
  labels: string[];
  players: PlayerBoxScorePlayer[];
}

export interface PlayerBoxScoreTeam {
  id: string;
  side: HomeAway;
  name: string;
  abbreviation: string;
  logo: string;
  groups: PlayerBoxScoreGroup[];
}

export interface PlayerBoxScore {
  available: boolean;
  teams: PlayerBoxScoreTeam[];
}

function getId(value: unknown): string {
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

export function getPlayerBoxScore(gameDetail: unknown, league = ""): PlayerBoxScore {
  const detail = asObject(gameDetail);
  const raw = asObject(detail.raw);
  const rawPlayers = asArray(asObject(raw.boxscore).players).map(asObject);
  const headerCompetition = asObject(asArray(asObject(raw.header).competitions)[0]);
  const competitors = asArray(headerCompetition.competitors).map(asObject);
  const detailTeams = asObject(detail.teams);
  const teams = (["away", "home"] as const).map((side): PlayerBoxScoreTeam => {
    const detailTeam = asObject(detailTeams[side]);
    const competitor = competitors.find((entry) => entry.homeAway === side);
    const competitorTeam = asObject(competitor?.team);
    const teamId = String(detailTeam.id || competitor?.id || "");
    const teamBlock = rawPlayers.find((entry) => {
      const boxTeam = asObject(entry.team);
      const boxTeamId = getId(boxTeam.id);
      return Boolean(
        (teamId && boxTeamId === teamId) ||
        (boxTeam.abbreviation && boxTeam.abbreviation === detailTeam.abbrev),
      );
    });
    const statistics = asArray(teamBlock?.statistics).map(asObject);
    const groups = statistics.flatMap((category, groupIndex): PlayerBoxScoreGroup[] => {
      const athletes = asArray(category.athletes).map(asObject);
      if (!athletes.length) return [];
      const rawLabels = category.labels || category.names || category.keys || [];
      const sourceLabels = Array.isArray(rawLabels) ? rawLabels : [];
      const labelCount = Math.max(
        sourceLabels.length,
        ...athletes.map((row) => asArray(row.stats).length),
      );
      const labels = Array.from({ length: labelCount }, (_, index) =>
        asString(sourceLabels[index], `STAT ${index + 1}`),
      );

      return [{
        id: `${side}-${groupIndex}`,
        title: getPlayerStatGroupTitle(category, league, labels),
        labels,
        players: athletes.map((row, playerIndex): PlayerBoxScorePlayer => {
          const athlete = asObject(row.athlete);
          const position = asObject(athlete.position);
          const headshot = asObject(athlete.headshot);
          return {
          id: getId(athlete.id) || `${teamId}-${groupIndex}-${playerIndex}`,
          name: asString(athlete.displayName, "Player"),
          jersey: asString(athlete.jersey),
          position: asString(position.abbreviation || position.displayName),
          headshot: asString(headshot.href,
            "https://a.espncdn.com/i/headshots/placeholder.png",
          ),
          starter: row.starter === true,
          stats: asArray(row.stats).map((value) => value ?? ""),
          };
        }),
      }];
    });

    return {
      id: teamId,
      side,
      name: asString(detailTeam.name || competitorTeam.displayName, "Team"),
      abbreviation: asString(detailTeam.abbrev || competitorTeam.abbreviation),
      logo: asString(detailTeam.logo || competitorTeam.logo),
      groups,
    };
  });

  return {
    available: teams.some((team) => team.groups.length > 0),
    teams,
  };
}

function getNumericStatValue(stat: unknown): number {
  const statObject = asObject(stat);
  const value = Number.parseFloat(String(statObject.value ?? ""));
  if (Number.isFinite(value)) return value;

  const displayValue = Number.parseFloat(String(statObject.displayValue ?? ""));
  return Number.isFinite(displayValue) ? displayValue : 0;
}

export interface TeamStatComparison {
  label: string;
  awayDisplay: unknown;
  homeDisplay: unknown;
  awayPct: number;
  homePct: number;
}

export function getTeamStatComparisons(
  awayStats: unknown[] = [],
  homeStats: unknown[] = [],
): TeamStatComparison[] {
  const away = awayStats.map(asObject);
  const home = homeStats.map(asObject);
  return away.map((awayStat) => {
    const homeStat = home.find((stat) => stat.name === awayStat.name) || {};
    const awayValue = getNumericStatValue(awayStat);
    const homeValue = getNumericStatValue(homeStat);
    const total = awayValue + homeValue;
    const awayPct = total > 0 ? (awayValue / total) * 100 : 50;

    return {
      label: asString(awayStat.label) || asString(awayStat.name),
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

export function getBaseballTeamStatComparisons(
  boxscoreTeams: unknown,
  groupName: string,
): TeamStatComparison[] {
  const metrics = BASEBALL_STAT_GROUPS[groupName as keyof typeof BASEBALL_STAT_GROUPS];
  const teams = asArray(boxscoreTeams).map(asObject);
  if (!metrics || !Array.isArray(boxscoreTeams)) return [];

  const getGroupStats = (homeAway: HomeAway): JsonObject[] => {
    const team = teams.find((entry) => entry.homeAway === homeAway);
    const groups = asArray(team?.statistics).map(asObject);
    return asArray(groups.find((group) => group.name === groupName)?.stats).map(asObject);
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

type HexColor = `#${string}`;

function normalizeHexColor(value: unknown): HexColor | null {
  if (typeof value !== "string") return null;
  const hex = value.trim().replace(/^#/, "");
  return /^[\da-f]{6}$/i.test(hex) ? `#${hex}` : null;
}

function relativeLuminance(hexColor: HexColor): number {
  const channels = hexColor.slice(1).match(/.{2}/g) ?? [];
  const [red = 0, green = 0, blue = 0] = channels.map((channel) => {
    const value = parseInt(channel, 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return red * 0.2126 + green * 0.7152 + blue * 0.0722;
}

function lightenHexColor(hexColor: HexColor, amount = 0.5): HexColor {
  const channels = (hexColor.slice(1).match(/.{2}/g) ?? []).map((channel) => {
    const value = parseInt(channel, 16);
    return Math.round(value + (255 - value) * amount)
      .toString(16)
      .padStart(2, "0");
  });
  return `#${channels.join("")}`;
}

function getTeamStatBarColor(team: unknown, fallback: HexColor): HexColor {
  const teamObject = asObject(team);
  const primary = normalizeHexColor(teamObject.color);
  const alternate = normalizeHexColor(teamObject.alternateColor);
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

export function getTeamStatBarColors(teams: unknown): { away: HexColor; home: HexColor } {
  const teamObjects = asObject(teams);
  return {
    away: getTeamStatBarColor(teamObjects.away, "#2563eb"),
    home: getTeamStatBarColor(teamObjects.home, "#059669"),
  };
}

function getTeamFlowColor(team: unknown, fallback: HexColor): HexColor {
  const teamObject = asObject(team);
  const primary = normalizeHexColor(teamObject.color);
  if (primary) {
    return relativeLuminance(primary) < 0.12
      ? lightenHexColor(primary, 0.35)
      : primary;
  }

  const alternate = normalizeHexColor(teamObject.alternateColor);
  return alternate && relativeLuminance(alternate) < 0.88
    ? alternate
    : fallback;
}

export function getGameFlowColors(teams: unknown): { away: HexColor; home: HexColor } {
  const teamObjects = asObject(teams);
  const teamColors = {
    away: getTeamFlowColor(teamObjects.away, "#2563eb"),
    home: getTeamFlowColor(teamObjects.home, "#059669"),
  };
  const awayChannels = (teamColors.away.slice(1).match(/.{2}/g) ?? []).map((channel) => parseInt(channel, 16));
  const homeChannels = (teamColors.home.slice(1).match(/.{2}/g) ?? []).map((channel) => parseInt(channel, 16));
  const colorDistance = Math.sqrt(
    awayChannels.reduce(
      (distance, channel, index) => distance + (channel - homeChannels[index]) ** 2,
      0,
    ),
  );

  return colorDistance < 100
    ? { away: "#60a5fa", home: "#34d399" }
    : teamColors;
}

export interface WinProbabilityChart {
  points: string;
  singlePoint: { x: number; y: number } | null;
}

export function getWinProbabilityChart(probabilities: unknown): WinProbabilityChart {
  if (!Array.isArray(probabilities) || probabilities.length === 0) {
    return { points: "", singlePoint: null };
  }

  const values = probabilities
    .map((value: unknown) => {
      const entry = asObject(value);
      const rawProbability = entry.homeWinPercentage ?? entry.homeProbability;
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

export function getNetwork(game: unknown): string {
  const gameObject = asObject(game);
  const comp = asObject(asArray(gameObject.competitions)[0]);
  const broadcastsList = asArray(comp.broadcasts).map(asObject);
  const geoBroadcastsList = asArray(comp.geoBroadcasts).map(asObject);
  const firstBroadcast = broadcastsList[0];
  const firstGeoBroadcast = geoBroadcastsList[0];
  const broadcastNames = asArray(firstBroadcast?.names);
  const media = asObject(firstGeoBroadcast?.media);

  if (
    broadcastNames.length > 0 && typeof broadcastNames[0] === "string"
  ) {
    return broadcastNames[0];
  }
  return asString(media.shortName);
}

const TV_LINEUP_HALF_HOUR_MS = 30 * 60 * 1000;
const TV_LINEUP_HALF_HOUR_WIDTH = 44;
const TV_LINEUP_LANE_HEIGHT = 92;

export function getTvLineupDurationMinutes(
  game: unknown,
  selectedLeague: string,
  seasonType = 2,
): number {
  const duration = resolveLeague(selectedLeague)?.tvLineup.duration ??
    DEFAULT_LEAGUE_BEHAVIOR.tvLineup.duration;
  if (duration.mode === "fixed") return duration.minutes;
  if (seasonType === duration.postseasonType) return duration.extendedMinutes;
  const gameDateValue = asObject(game).date;
  if (typeof gameDateValue !== "string" || gameDateValue.trim() === "") {
    return duration.regularMinutes;
  }

  const gameDate = new Date(gameDateValue);
  if (Number.isNaN(gameDate.getTime())) return duration.regularMinutes;
  const kickoffHour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: duration.timezone,
      hour: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(gameDate)
      .find((part) => part.type === "hour")?.value,
  );
  return kickoffHour >= duration.eveningKickoffHour
    ? duration.extendedMinutes
    : duration.regularMinutes;
}

export function getTvLineupStatus(game: unknown, selectedLeague: string): string {
  const gameObject = asObject(game);
  const state = getGameState(game);
  const status = asObject(gameObject.status);
  const type = asObject(status.type);

  if (state === "pre") return formatGameTime(game) || "TBD";
  if (state !== "in") return "FINAL";

  const competition = asObject(asArray(gameObject.competitions)[0]);
  const competitionStatus = asObject(competition.status);
  const situation = asObject(competition.situation);
  const clockSituation = asObject(situation.clock);
  const detail = String(type.detail || "").trim();
  const shortDetail = String(type.shortDetail || "").trim();
  if (resolveLeague(selectedLeague)?.tvLineup.status === "inning") {
    const inning = detail || shortDetail;
    return inning ? `LIVE · ${inning}` : "LIVE";
  }
  if (/\b\d{1,2}:\d{2}\b/.test(detail)) return `LIVE · ${detail}`;

  const clock =
    status.displayClock ||
    competitionStatus.displayClock ||
    clockSituation.displayValue ||
    "";
  const period =
    status.period ||
    competitionStatus.period ||
    situation.period ||
    "";
  const periodLabel = shortDetail || (period ? `Period ${period}` : "");
  if (periodLabel && clock) return `LIVE · ${periodLabel} ${clock}`;
  const liveDetail = periodLabel || detail || shortDetail;
  return liveDetail ? `LIVE · ${liveDetail}` : "LIVE";
}

export function getTvLineupTeamStyle(
  game: unknown,
  homeAway: HomeAway,
): { backgroundColor: HexColor; color: "#ffffff" | "#09090b" } {
  const team = asObject(getCompetitor(game, homeAway).team);
  const fallback = homeAway === "away" ? "#2563eb" : "#059669";
  const backgroundColor =
    normalizeHexColor(team.color) ||
    normalizeHexColor(team.alternateColor) ||
    fallback;
  const luminance = relativeLuminance(backgroundColor);
  const whiteContrast = 1.05 / (luminance + 0.05);
  const blackContrast = (luminance + 0.05) / 0.05;

  return {
    backgroundColor,
    color: whiteContrast >= blackContrast ? "#ffffff" : "#09090b",
  };
}

interface TvLineupGameEntry {
  game: GameRecord;
  channel: string;
  status: string;
}

interface ScheduledTvGame extends TvLineupGameEntry {
  start: number;
  end: number;
  durationMinutes: number;
}

interface PositionedTvGame extends ScheduledTvGame {
  lane: number;
  left: number;
  width: number;
}

export interface TvLineupLayout {
  channels: {
    name: string;
    games: PositionedTvGame[];
    laneCount: number;
    firstStart: number;
  }[];
  ticks: { timestamp: number; label: string }[];
  gridlines: { index: number; left: number }[];
  timelineWidth: number;
  laneHeight: number;
  scale: number;
  unscheduled: TvLineupGameEntry[];
}

interface GameRecord extends JsonObject {
  id?: string | number;
  competitions?: unknown[];
}

function asGameRecord(value: unknown): GameRecord {
  const game = asObject(value);
  const id = game.id;
  if (id === undefined || typeof id === "string" || typeof id === "number") {
    return game as GameRecord;
  }
  return {
    ...game,
    id: undefined,
  };
}

function getLocalDateKey(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function roundToHalfHour(timestamp: number, roundUp = false): number {
  const date = new Date(timestamp);
  const minuteOffset =
    (date.getMinutes() % 30) + date.getSeconds() / 60 + date.getMilliseconds() / 60000;
  const adjustment = roundUp
    ? minuteOffset === 0 ? 0 : 30 - minuteOffset
    : -minuteOffset;
  return timestamp + adjustment * 60 * 1000;
}

export function getTvLineupLayout(
  games: unknown,
  selectedLeague: string,
  seasonType = 2,
  selectedDay = getLocalDateKey(new Date()),
): TvLineupLayout {
  const channelMap = new Map<string, ScheduledTvGame[]>();
  const scheduledGames: { start: number; end: number }[] = [];
  const unscheduled: TvLineupGameEntry[] = [];

  for (const gameValue of asArray(games)) {
    const game = asGameRecord(gameValue);
    const channel = getNetwork(game) || "Other";
    const dateValue = game.date;
    const date = new Date(
      typeof dateValue === "string" || typeof dateValue === "number" ? dateValue : NaN,
    );
    const hasCalendarDate =
      typeof dateValue === "string" &&
      dateValue.trim() !== "" &&
      !Number.isNaN(date.getTime());
    if (!hasCalendarDate || getLocalDateKey(date) !== selectedDay) continue;

    const status = asObject(game.status);
    const statusType = asObject(status.type);
    const statusText = `${statusType.detail || ""} ${statusType.shortDetail || ""}`;
    const competition = asObject(asArray(game.competitions)[0]);
    const hasValidTime =
      game.timeValid !== false &&
      competition.timeValid !== false &&
      !/\bTBD\b/i.test(statusText);

    if (!hasValidTime) {
      unscheduled.push({
        game,
        channel,
        status: getTvLineupStatus(game, selectedLeague),
      });
      continue;
    }

    const start = date.getTime();
    const durationMinutes = getTvLineupDurationMinutes(game, selectedLeague, seasonType);
    const channelGames = channelMap.get(channel) || [];
    channelGames.push({
      game,
      channel,
      start,
      end: start + durationMinutes * 60 * 1000,
      durationMinutes,
      status: getTvLineupStatus(game, selectedLeague),
    });
    channelMap.set(channel, channelGames);
    scheduledGames.push({ start, end: start + durationMinutes * 60 * 1000 });
  }

  if (scheduledGames.length === 0) {
    return {
      channels: [],
      ticks: [],
      gridlines: [],
      timelineWidth: 0,
      laneHeight: TV_LINEUP_LANE_HEIGHT,
      scale: TV_LINEUP_HALF_HOUR_WIDTH,
      unscheduled,
    };
  }

  const rangeStart = roundToHalfHour(Math.min(...scheduledGames.map((game) => game.start)));
  const rangeEnd = roundToHalfHour(
    Math.max(...scheduledGames.map((game) => game.end)),
    true,
  );
  const tickCount =
    (rangeEnd - rangeStart) / TV_LINEUP_HALF_HOUR_MS + 1;
  const timelineWidth = tickCount * TV_LINEUP_HALF_HOUR_WIDTH;
  const ticks: { timestamp: number; label: string }[] = [];

  for (let timestamp = rangeStart; timestamp <= rangeEnd; timestamp += TV_LINEUP_HALF_HOUR_MS) {
    ticks.push({
      timestamp,
      label: new Date(timestamp).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      }),
    });
  }
  const gridlines = Array.from({ length: ticks.length + 1 }, (_, index) => ({
    index,
    left: Math.min(
      index * TV_LINEUP_HALF_HOUR_WIDTH,
      timelineWidth - 1,
    ),
  }));

  const channels = [...channelMap.entries()]
    .map(([name, entries]) => {
      const laneEnds: number[] = [];
      const gamesInChannel = entries
        .sort((gameA, gameB) => gameA.start - gameB.start)
        .map((entry) => {
          let lane = laneEnds.findIndex((laneEnd) => laneEnd <= entry.start);
          if (lane === -1) lane = laneEnds.length;
          laneEnds[lane] = entry.end;
          return {
            ...entry,
            lane,
            left: ((entry.start - rangeStart) / TV_LINEUP_HALF_HOUR_MS) * TV_LINEUP_HALF_HOUR_WIDTH,
            width:
              (entry.durationMinutes / 30) * TV_LINEUP_HALF_HOUR_WIDTH,
          };
        });

      return {
        name,
        games: gamesInChannel,
        laneCount: Math.max(laneEnds.length, 1),
        firstStart: Math.min(...entries.map((entry) => entry.start)),
      };
    })
    .sort((channelA, channelB) =>
      channelA.firstStart - channelB.firstStart || channelA.name.localeCompare(channelB.name),
    );

  return {
    channels,
    ticks,
    gridlines,
    timelineWidth,
    laneHeight: TV_LINEUP_LANE_HEIGHT,
    scale: TV_LINEUP_HALF_HOUR_WIDTH,
    unscheduled,
  };
}

export function formatGameTime(game: unknown): string {
  const gameObject = asObject(game);
  const state = getGameState(game);
  const status = asObject(gameObject.status);
  const statusType = asObject(status.type);
  const detail = asString(statusType.shortDetail);
  const statusDetail = asString(statusType.detail);
  if (state !== "pre") return detail;

  const competition = asObject(asArray(gameObject.competitions)[0]);
  if (
    gameObject.timeValid === false ||
    competition.timeValid === false ||
    /\bTBD\b/i.test(`${detail} ${statusDetail}`)
  ) {
    return "TBD";
  }
  if (typeof gameObject.date !== "string" || !gameObject.date) return detail;

  const gameDate = new Date(gameObject.date);
  if (Number.isNaN(gameDate.getTime())) {
    return detail;
  }

  try {
    const today = new Date();
    const isToday =
      gameDate.getDate() === today.getDate() &&
      gameDate.getMonth() === today.getMonth() &&
      gameDate.getFullYear() === today.getFullYear();

    const options: Intl.DateTimeFormatOptions = {
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

export function getCompetitor(game: unknown, type: HomeAway): JsonObject {
  const gameObject = asObject(game);
  const competition = asObject(asArray(gameObject.competitions)[0]);
  const competitors = asArray(competition.competitors).map(asObject);
  return competitors.find((competitor) => competitor.homeAway === type) || {};
}

export function getSeriesSummary(competitionValue: unknown): string {
  const competition = asObject(competitionValue);
  const series = asObject(competition.series);
  const seriesCompetitors = asArray(series.competitors).map(asObject);
  if (seriesCompetitors.length !== 2) return "";
  const competitors = asArray(competition.competitors).map(asObject);

  const records = seriesCompetitors.map((record) => {
    const competitor = competitors.find(
      (candidate) => String(candidate.id) === String(record.id),
    );
    const wins = Number(record.wins);
    const team = asObject(competitor?.team);
    const name = asString(team.displayName || team.location);
    if (!name || !Number.isFinite(wins) || wins < 0) return null;
    return { name, wins };
  });

  const [first, second] = records;
  if (!first || !second) return "";
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

export function getTeamName(game: unknown, type: HomeAway): string {
  const comp = getCompetitor(game, type);
  const team = asObject(comp.team);
  return asString(team.displayName || team.location, "Team");
}

export function getTeamLogo(game: unknown, type: HomeAway): string {
  const team = asObject(getCompetitor(game, type).team);
  return asString(team.logo, "https://a.espncdn.com/i/teamlogos/default-team-logo-500.png");
}

export function getTeamScore(game: unknown, type: HomeAway): string | number {
  const score = getCompetitor(game, type).score;
  return typeof score === "string" || typeof score === "number" ? score || "0" : "0";
}

export function getTeamRank(game: unknown, type: HomeAway): number | null {
  const rank = asObject(getCompetitor(game, type).curatedRank).current;
  const r = Number.parseInt(String(rank ?? ""), 10);
  return r > 0 && r < 99 ? r : null;
}

export function isWinner(game: unknown, type: HomeAway): boolean {
  return getCompetitor(game, type).winner === true;
}

export function isTeamHighlighted(teamId: unknown, favoriteTeamIds: string[] = []): boolean {
  if (teamId === undefined || teamId === null) return false;
  const id = String(teamId);
  return favoriteTeamIds.some((favoriteId) => String(favoriteId) === id);
}

export function isGameHighlighted(game: unknown, favoriteTeamIds: string[] = []): boolean {
  return (
    isTeamHighlighted(getCompetitor(game, "home")?.id, favoriteTeamIds) ||
    isTeamHighlighted(getCompetitor(game, "away")?.id, favoriteTeamIds)
  );
}

export function sortGames(games: unknown, _selectedLeague: string): GameRecord[] {
  return asArray(games).map(asGameRecord).sort((gameA, gameB) => {
    const stateA = getGameState(gameA);
    const stateB = getGameState(gameB);

    const getBucketWeight = (state: string): number => {
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
      typeof gameA.date === "string" &&
      typeof gameB.date === "string"
    ) {
      const dateA = new Date(gameA.date).getTime();
      const dateB = new Date(gameB.date).getTime();
      if (dateA !== dateB) return dateA - dateB;
    }

    const getBestRank = (game: GameRecord): number => {
      const rHome = getTeamRank(game, "home") || 99;
      const rAway = getTeamRank(game, "away") || 99;
      return Math.min(rHome, rAway);
    };

    return getBestRank(gameA) - getBestRank(gameB);
  });
}
