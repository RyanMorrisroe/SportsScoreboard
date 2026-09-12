const FALLBACK_LOGO = "https://a.espncdn.com/i/teamlogos/default-team-logo-500.png";

export function formatScheduleDate(date, locale = undefined) {
  if (!date) return "Date TBD";
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

export function normalizeSchedule(payload, teamId, locale = undefined) {
  const isSelectedTeam = (competitor) =>
    String(competitor?.id || competitor?.team?.id) === String(teamId);
  const getScore = (competitor) => {
    const score = competitor?.score;
    if (score && typeof score === "object") {
      return score.displayValue || score.value || "--";
    }
    return score ?? "--";
  };

  return (payload?.events || []).map((event) => {
    const competition = event.competitions?.[0] || {};
    const competitors = competition.competitors || [];
    const opponent = competitors.find((competitor) => !isSelectedTeam(competitor)) || {};
    const own = competitors.find(isSelectedTeam) || {};
    const rawStatus =
      competition.status?.type?.shortDetail ||
      competition.status?.type?.description ||
      "Scheduled";
    const timeIsTBD =
      rawStatus.toUpperCase().includes("TBD") ||
      event.timeValid === false ||
      competition.timeValid === false;

    return {
      id: event.id,
      date: timeIsTBD ? "TBD" : formatScheduleDate(event.date, locale),
      week: event.week?.text || "",
      opponent: opponent.team?.displayName || "Opponent",
      opponentLogo: opponent.team?.logos?.[0]?.href || opponent.team?.logo || FALLBACK_LOGO,
      teamLogo: own.team?.logos?.[0]?.href || own.team?.logo || FALLBACK_LOGO,
      homeAway: own.homeAway,
      score:
        own.score !== undefined && opponent.score !== undefined
          ? `${getScore(own)}-${getScore(opponent)}`
          : "--",
      result: own.winner === true ? "W" : opponent.winner === true ? "L" : "",
      status: timeIsTBD
        ? "TBD"
        : competition.status?.type?.state === "pre"
          ? "Scheduled"
          : rawStatus,
      venue: competition.venue?.fullName || "",
    };
  });
}
