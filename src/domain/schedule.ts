const FALLBACK_LOGO =
  "https://a.espncdn.com/i/teamlogos/default-team-logo-500.png";

type JsonObject = Record<string, unknown>;

export interface NormalizedScheduleEntry {
  id: string | number;
  date: string;
  startTime: number | null;
  week: string;
  opponent: string;
  opponentLogo: string;
  teamLogo: string;
  homeAway: string | undefined;
  score: string;
  result: "W" | "L" | "T" | "";
  state: string;
  status: string;
  venue: string;
  rawEvent: unknown;
}

function asObject(value: unknown): JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function getString(value: unknown, fallback = ""): string {
  return typeof value === "string" && value ? value : fallback;
}

function getId(value: unknown): string | number {
  return typeof value === "string" || typeof value === "number" ? value : "";
}

function getTeam(competitor: JsonObject): JsonObject {
  return asObject(competitor.team);
}

function getTeamLogo(team: JsonObject): string {
  const logos = asArray(team.logos).map(asObject);
  return getString(logos[0]?.href, getString(team.logo, FALLBACK_LOGO));
}

export function formatScheduleDate(date: unknown, locale?: string): string {
  if (
    !date ||
    !(
      typeof date === "string" ||
      typeof date === "number" ||
      date instanceof Date
    )
  ) {
    return "Date TBD";
  }
  try {
    const timezone =
      locale && locale.toUpperCase() === "UTC" ? "UTC" : undefined;
    const formatterLocale = timezone ? "en-US" : locale || "en-US";

    return new Intl.DateTimeFormat(formatterLocale, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      ...(timezone ? { timeZone: timezone } : {}),
    }).format(new Date(date));
  } catch {
    return "Date TBD";
  }
}

export function normalizeSchedule(
  payload: unknown,
  teamId: string | number,
  locale?: string,
): NormalizedScheduleEntry[] {
  const isSelectedTeam = (competitor: JsonObject) =>
    String(competitor.id || getTeam(competitor).id) === String(teamId);
  const getScore = (competitor: JsonObject): string => {
    const score = competitor.score;
    if (score && typeof score === "object") {
      const scoreObject = asObject(score);
      return String(scoreObject.displayValue ?? scoreObject.value ?? "--");
    }
    return String(score ?? "--");
  };
  const getNumericScore = (competitor: JsonObject): number | null => {
    const score = competitor.score;
    const value =
      score !== null && typeof score === "object"
        ? (asObject(score).value ?? asObject(score).displayValue)
        : score;
    if (typeof value !== "string" && typeof value !== "number") return null;
    if (typeof value === "string" && value.trim() === "") return null;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  };

  return asArray(asObject(payload).events).map((eventValue) => {
    const event = asObject(eventValue);
    const rawDate = event.date;
    const competition = asObject(asArray(event.competitions)[0]);
    const competitors = asArray(competition.competitors).map(asObject);
    const opponent =
      competitors.find((competitor) => !isSelectedTeam(competitor)) || {};
    const own = competitors.find(isSelectedTeam) || {};
    const competitionStatus = asObject(competition.status);
    const statusType = asObject(competitionStatus.type);
    const rawStatus = getString(
      statusType.shortDetail,
      getString(statusType.description, "Scheduled"),
    );
    const timeIsTBD =
      rawStatus.toUpperCase().includes("TBD") ||
      event.timeValid === false ||
      competition.timeValid === false;
    const parsedStartTime = new Date(
      typeof rawDate === "string" || typeof rawDate === "number"
        ? rawDate
        : NaN,
    ).getTime();
    const ownTeam = getTeam(own);
    const opponentTeam = getTeam(opponent);
    const ownScore = own.score;
    const opponentScore = opponent.score;
    const venue = asObject(competition.venue);
    const status = asObject(competitionStatus.type);
    const state = getString(statusType.state).toLowerCase();
    const ownNumericScore = getNumericScore(own);
    const opponentNumericScore = getNumericScore(opponent);
    const result =
      own.winner === true
        ? "W"
        : opponent.winner === true
          ? "L"
          : state === "post" &&
              ownNumericScore !== null &&
              ownNumericScore === opponentNumericScore
            ? "T"
            : "";

    return {
      id: getId(event.id),
      date: timeIsTBD ? "TBD" : formatScheduleDate(rawDate, locale),
      startTime:
        !timeIsTBD && Number.isFinite(parsedStartTime) ? parsedStartTime : null,
      week: getString(asObject(event.week).text),
      opponent: getString(opponentTeam.displayName, "Opponent"),
      opponentLogo: getTeamLogo(opponentTeam),
      teamLogo: getTeamLogo(ownTeam),
      homeAway: typeof own.homeAway === "string" ? own.homeAway : undefined,
      score:
        ownScore !== undefined && opponentScore !== undefined
          ? `${getScore(own)}-${getScore(opponent)}`
          : "--",
      result,
      state,
      status: timeIsTBD
        ? "TBD"
        : status.state === "pre"
          ? "Scheduled"
          : rawStatus,
      venue: getString(venue.fullName),
      rawEvent: eventValue,
    };
  });
}

export function filterMyTeamsScheduleEntries<
  T extends Pick<NormalizedScheduleEntry, "startTime" | "state">,
>(entries: T[], now = Date.now(), days = 7): T[] {
  const startOfRecentWindow = now - days * 24 * 60 * 60 * 1000;
  const endTime = now + days * 24 * 60 * 60 * 1000;
  const liveAndUpcoming = entries.filter(
    (entry) =>
      entry.state === "in" ||
      (entry.state === "pre" &&
        entry.startTime !== null &&
        entry.startTime >= now &&
        entry.startTime <= endTime),
  );
  const recentFinals = entries.filter(
    (entry) =>
      entry.state === "post" &&
      entry.startTime !== null &&
      entry.startTime >= startOfRecentWindow &&
      entry.startTime <= now,
  );
  const lastFinal = recentFinals.reduce<T | null>(
    (latest, entry) =>
      latest === null || entry.startTime! > latest.startTime! ? entry : latest,
    null,
  );
  const laterGameHasStarted =
    lastFinal !== null &&
    entries.some(
      (entry) =>
        entry !== lastFinal &&
        (entry.state === "in" || entry.state === "post") &&
        (entry.startTime === null || entry.startTime >= lastFinal.startTime!),
    );

  if (lastFinal && !laterGameHasStarted) liveAndUpcoming.push(lastFinal);
  return liveAndUpcoming;
}
