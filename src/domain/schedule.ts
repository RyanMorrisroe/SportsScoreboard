const FALLBACK_LOGO = "https://a.espncdn.com/i/teamlogos/default-team-logo-500.png";

type JsonObject = Record<string, unknown>;

export interface NormalizedScheduleEntry {
  id: string | number;
  date: string;
  week: string;
  opponent: string;
  opponentLogo: string;
  teamLogo: string;
  homeAway: string | undefined;
  score: string;
  result: "W" | "L" | "";
  status: string;
  venue: string;
}

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
  if (!date || !(typeof date === "string" || typeof date === "number" || date instanceof Date)) {
    return "Date TBD";
  }
  try {
    const timezone = locale && locale.toUpperCase() === "UTC" ? "UTC" : undefined;
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
      return String(scoreObject.displayValue || scoreObject.value || "--");
    }
    return String(score ?? "--");
  };

  return asArray(asObject(payload).events).map((eventValue) => {
    const event = asObject(eventValue);
    const competition = asObject(asArray(event.competitions)[0]);
    const competitors = asArray(competition.competitors).map(asObject);
    const opponent = competitors.find((competitor) => !isSelectedTeam(competitor)) || {};
    const own = competitors.find(isSelectedTeam) || {};
    const competitionStatus = asObject(competition.status);
    const statusType = asObject(competitionStatus.type);
    const rawStatus = getString(statusType.shortDetail, getString(statusType.description, "Scheduled"));
    const timeIsTBD =
      rawStatus.toUpperCase().includes("TBD") ||
      event.timeValid === false ||
      competition.timeValid === false;
    const ownTeam = getTeam(own);
    const opponentTeam = getTeam(opponent);
    const ownScore = own.score;
    const opponentScore = opponent.score;
    const venue = asObject(competition.venue);
    const status = asObject(competitionStatus.type);

    return {
      id: getId(event.id),
      date: timeIsTBD ? "TBD" : formatScheduleDate(event.date, locale),
      week: getString(asObject(event.week).text),
      opponent: getString(opponentTeam.displayName, "Opponent"),
      opponentLogo: getTeamLogo(opponentTeam),
      teamLogo: getTeamLogo(ownTeam),
      homeAway: typeof own.homeAway === "string" ? own.homeAway : undefined,
      score:
        ownScore !== undefined && opponentScore !== undefined
          ? `${getScore(own)}-${getScore(opponent)}`
          : "--",
      result: own.winner === true ? "W" : opponent.winner === true ? "L" : "",
      status: timeIsTBD
        ? "TBD"
        : status.state === "pre"
          ? "Scheduled"
          : rawStatus,
      venue: getString(venue.fullName),
    };
  });
}