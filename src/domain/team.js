export function getTeamRecords(teamPayload) {
  return (teamPayload?.team?.record?.items || []).map((item) => ({
    label: item.description || item.displayName || "Record",
    value: item.summary || item.displayValue || "--",
  }));
}

function formatStatValue(stat) {
  if (stat.displayValue !== undefined && stat.displayValue !== null) {
    return stat.displayValue;
  }
  if (typeof stat.value !== "number") return stat.value;
  return Number(stat.value.toFixed(3));
}

export function getTeamRecordStats(teamPayload) {
  return (teamPayload?.team?.record?.items || []).flatMap((item) =>
    (item.stats || []).map((stat) => ({
      key: `${item.type || "record"}-${stat.name}`,
      label: stat.name
        .replace(/([A-Z])/g, " $1")
        .replace(/^./, (letter) => letter.toUpperCase()),
      value: formatStatValue(stat),
    })),
  );
}
