const FOOTBALL_LEAGUES = new Set(["nfl", "college-football"]);

function getFootballPlays(raw) {
  const drives = raw?.drives || {};
  const previous = Array.isArray(drives.previous) ? drives.previous : [];
  const current = drives.current ? [drives.current] : [];
  return [...previous, ...current].flatMap((drive) =>
    (Array.isArray(drive?.plays) ? drive.plays : []).map((play) => ({
      ...play,
      drive: {
        id: drive.id || "",
        description: drive.description || "",
        result: drive.displayResult || drive.shortDisplayResult || drive.result || "",
        teamId: drive.team?.id ? String(drive.team.id) : "",
        teamAbbreviation: drive.team?.abbreviation || "",
      },
    })),
  );
}

function getOrdinal(value) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) return String(value || "");
  const suffix = number % 100 >= 11 && number % 100 <= 13
    ? "th"
    : ({ 1: "st", 2: "nd", 3: "rd" }[number % 10] || "th");
  return `${number}${suffix}`;
}

function getPeriodLabel(period, league) {
  if (!period?.number) return period?.displayValue || "";
  const ordinal = getOrdinal(period.number);
  const type = String(period.type || "").toLowerCase();

  if (league === "mlb") {
    const side = type === "top" ? "Top of" : type === "bottom" ? "Bottom of" : "";
    return `${side ? `${side} ` : ""}${ordinal} Inning`;
  }
  if (league === "college-football") {
    if (Number(period.number) <= 4) return `${ordinal} Quarter`;
    return `Overtime ${Number(period.number) - 4}`;
  }
  if (league === "nfl") return `${ordinal} Quarter`;
  if (league === "nba") return Number(period.number) <= 4
    ? `${ordinal} Quarter`
    : `Overtime ${Number(period.number) - 4}`;
  if (league === "nhl") return Number(period.number) <= 3
    ? `${ordinal} Period`
    : `Overtime ${Number(period.number) - 3}`;

  if (period.displayValue) return period.displayValue;
  return period.type ? `${period.type} ${period.number}` : `Period ${period.number}`;
}

function getTeamId(play) {
  if (play?.team?.id !== undefined && play.team.id !== null) {
    return String(play.team.id);
  }
  const participant = Array.isArray(play?.teamParticipants)
    ? play.teamParticipants[0]
    : null;
  const id = participant?.team?.id ?? participant?.id;
  return id === undefined || id === null ? "" : String(id);
}

function getScoreValue(value) {
  if (value === null || value === undefined || value === "") return null;
  const score = Number(value);
  return Number.isFinite(score) ? score : null;
}

function normalizeEvent(play, index, league, scoringOnly = false) {
  const period = play?.period || {};
  const teamId = getTeamId(play) || play?.drive?.teamId || "";
  const scoreValue = getScoreValue(play?.scoreValue);
  const isScoring =
    scoringOnly || play?.scoringPlay === true || (scoreValue !== null && scoreValue > 0);
  const end = play?.end || {};

  return {
    id: String(play?.id ?? `event-${index}`),
    order: index,
    sequenceNumber: play?.sequenceNumber ?? null,
    periodNumber: Number.isFinite(Number(period.number)) ? Number(period.number) : null,
    periodLabel: getPeriodLabel(period, league),
    periodType: typeof period.type === "string" ? period.type : "",
    clock: play?.clock?.displayValue || "",
    description: play?.text || play?.shortText || play?.type?.text || "Play details unavailable.",
    eventType: play?.type?.text || play?.summaryType || "",
    teamId,
    teamAbbreviation:
      play?.team?.abbreviation || play?.drive?.teamAbbreviation || "",
    scoring: isScoring,
    awayScore: getScoreValue(play?.awayScore),
    homeScore: getScoreValue(play?.homeScore),
    scoreValue,
    downDistance: FOOTBALL_LEAGUES.has(league)
      ? end.downDistanceText || ""
      : "",
    fieldPosition: FOOTBALL_LEAGUES.has(league)
      ? end.possessionText || ""
      : "",
    yardLine: FOOTBALL_LEAGUES.has(league) && Number.isFinite(Number(end.yardLine))
      ? Number(end.yardLine)
      : null,
    drive: play?.drive || null,
    isTurnover: play?.isTurnover === true,
    isPenalty: play?.isPenalty === true,
    pitchCount: play?.pitchCount ?? null,
    outs: play?.outs ?? null,
  };
}

function getSequenceNumber(event) {
  if (event?.sequenceNumber === null || event?.sequenceNumber === undefined || event.sequenceNumber === "") {
    return null;
  }
  const sequence = Number(event?.sequenceNumber);
  return Number.isFinite(sequence) ? sequence : null;
}

function getClockSeconds(event) {
  const match = String(event?.clock?.displayValue || "").match(/^(\d+):(\d{2})$/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

function compareEvents(left, right) {
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

export function normalizePlayByPlay(raw, league) {
  const summaryPlays = Array.isArray(raw?.plays) ? raw.plays : [];
  const footballPlays = FOOTBALL_LEAGUES.has(league) ? getFootballPlays(raw) : [];
  const fullPlays = summaryPlays.length ? summaryPlays : footballPlays;
  const scoringPlays = Array.isArray(raw?.scoringPlays) ? raw.scoringPlays : [];
  const source = fullPlays.length ? fullPlays : scoringPlays;
  const uniquePlays = [];
  const seenIds = new Set();

  for (const play of source) {
    const id = play?.id === undefined || play?.id === null ? null : String(play.id);
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