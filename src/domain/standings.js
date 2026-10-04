function getStatValue(stat) {
  if (stat.displayValue !== undefined && stat.displayValue !== null) {
    return stat.displayValue;
  }
  if (stat.summary !== undefined && stat.summary !== null) return stat.summary;
  if (stat.value !== undefined && stat.value !== null) return stat.value;
  return "--";
}

function normalizeEntry(entry, index) {
  const stats = (Array.isArray(entry.stats) ? entry.stats : [])
    .filter((stat) => stat && (stat.name || stat.abbreviation || stat.displayName))
    .map((stat) => ({
      key: stat.name || stat.abbreviation || stat.displayName,
      label: stat.shortDisplayName || stat.abbreviation || stat.displayName || stat.name,
      value: getStatValue(stat),
    }));

  return {
    id: entry.team?.id || `${entry.team?.abbreviation || entry.team?.displayName || "team"}-${index}`,
    name: entry.team?.displayName || entry.team?.name || "Unknown team",
    abbreviation: entry.team?.abbreviation || "",
    logo: entry.team?.logos?.[0]?.href || entry.team?.logo || "",
    note: entry.note?.description || "",
    stats,
  };
}

function collectGroups(node, path, groups) {
  if (!node || typeof node !== "object") return;
  const name = node.name || node.displayName || "Standings";
  const id = node.id || node.abbreviation || name;
  const entries = node.standings?.entries || node.entries || [];
  if (Array.isArray(entries) && entries.some((entry) => entry?.team)) {
    const teams = entries.filter((entry) => entry?.team).map(normalizeEntry);
    const columns = [];
    for (const team of teams) {
      for (const stat of team.stats) {
        if (!columns.some((column) => column.key === stat.key)) {
          columns.push({ key: stat.key, label: stat.label });
        }
      }
    }
    groups.push({
      id: [...path, id].join("-"),
      name,
      depth: path.length,
      columns,
      teams,
    });
  }

  for (const child of Array.isArray(node.children) ? node.children : []) {
    collectGroups(child, [...path, id], groups);
  }
}

export function normalizeStandings(payload) {
  if (!payload || typeof payload !== "object") return [];
  const groups = [];
  if (Array.isArray(payload.children) && payload.children.length > 0) {
    for (const child of payload.children) {
      collectGroups(child, [], groups);
    }
  } else {
    collectGroups(payload, [], groups);
  }
  return groups;
}
