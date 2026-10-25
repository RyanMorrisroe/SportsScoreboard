import type {
  LeagueBehavior,
  LeagueBehaviorOverrides,
  LeaguePluginDefinition,
  SportFamily,
} from "./types";

export const DEFAULT_LEAGUE_BEHAVIOR: LeagueBehavior = {
  sportPath: "football",
  schedule: {
    mode: "date",
    includesSeasonType: false,
    supportsGroupFilter: false,
  },
  linescore: {
    regulationPeriods: 4,
    kind: "period",
    periodLabelStyle: "period",
    overtimeLabelStyle: "ordinal",
    situation: "period",
    supportsPossession: false,
  },
  game: {
    teamStatsMode: "standard",
    supportsDrives: false,
  },
  standings: {
    hiddenStatKeys: ["lockeddivrank"],
  },
  tvLineup: {
    duration: { mode: "fixed", minutes: 180 },
    status: "standard",
  },
};

export const SPORT_FAMILY_DEFAULTS: Record<SportFamily, LeagueBehaviorOverrides> = {
  football: {
    sportPath: "football",
    schedule: { mode: "week", includesSeasonType: true },
    linescore: {
      situation: "football",
      supportsPossession: true,
      periodLabelStyle: "quarter",
    },
    game: { supportsDrives: true },
    tvLineup: {
      duration: {
        mode: "football",
        regularMinutes: 180,
        extendedMinutes: 210,
        postseasonType: 3,
        timezone: "America/New_York",
        eveningKickoffHour: 19,
      },
    },
  },
  baseball: {
    sportPath: "baseball",
    linescore: {
      regulationPeriods: 9,
      kind: "inning",
      periodLabelStyle: "inning",
      situation: "baseball",
    },
    game: { teamStatsMode: "grouped" },
    tvLineup: { status: "inning" },
  },
  basketball: {
    sportPath: "basketball",
    linescore: { periodLabelStyle: "quarter", overtimeLabelStyle: "overtime" },
    tvLineup: { duration: { mode: "fixed", minutes: 150 } },
  },
  hockey: {
    sportPath: "hockey",
    linescore: { regulationPeriods: 3, overtimeLabelStyle: "overtime" },
  },
};

export const LEAGUE_PLUGINS = {
  "college-football": {
    label: "CFB",
    name: "College Football",
    family: "football",
    overrides: {
      schedule: { supportsGroupFilter: true },
      linescore: { overtimeLabelStyle: "overtime" },
      standings: {
        hiddenStatKeys: ["divisionwins", "divisionlosses", "divisionties", "vs division"],
      },
      tvLineup: { duration: { mode: "fixed", minutes: 210 } },
    },
  },
  nfl: { label: "NFL", name: "NFL", family: "football" },
  mlb: { label: "MLB", name: "MLB", family: "baseball" },
  nba: { label: "NBA", name: "NBA", family: "basketball" },
  nhl: { label: "NHL", name: "NHL", family: "hockey" },
} as const satisfies Record<string, LeaguePluginDefinition>;

export type LeagueId = keyof typeof LEAGUE_PLUGINS;

export type ResolvedLeague = LeaguePluginDefinition &
  LeagueBehavior & { readonly id: LeagueId };

export const LEAGUE_IDS = Object.freeze(
  Object.keys(LEAGUE_PLUGINS) as LeagueId[],
);

export function composeLeagueBehavior(
  family: SportFamily,
  overrides: LeagueBehaviorOverrides = {},
): LeagueBehavior {
  const familyDefaults = SPORT_FAMILY_DEFAULTS[family];
  return {
    sportPath:
      overrides.sportPath ??
      familyDefaults.sportPath ??
      DEFAULT_LEAGUE_BEHAVIOR.sportPath,
    schedule: {
      ...DEFAULT_LEAGUE_BEHAVIOR.schedule,
      ...familyDefaults.schedule,
      ...overrides.schedule,
    },
    linescore: {
      ...DEFAULT_LEAGUE_BEHAVIOR.linescore,
      ...familyDefaults.linescore,
      ...overrides.linescore,
    },
    game: {
      ...DEFAULT_LEAGUE_BEHAVIOR.game,
      ...familyDefaults.game,
      ...overrides.game,
    },
    standings: {
      hiddenStatKeys: [...new Set([
        ...DEFAULT_LEAGUE_BEHAVIOR.standings.hiddenStatKeys,
        ...(familyDefaults.standings?.hiddenStatKeys ?? []),
        ...(overrides.standings?.hiddenStatKeys ?? []),
      ])],
    },
    tvLineup: {
      ...DEFAULT_LEAGUE_BEHAVIOR.tvLineup,
      ...familyDefaults.tvLineup,
      ...overrides.tvLineup,
    },
  };
}

export function resolveLeague(id: string): ResolvedLeague | null {
  if (!Object.prototype.hasOwnProperty.call(LEAGUE_PLUGINS, id)) return null;

  const leagueId = id as LeagueId;
  const plugin = LEAGUE_PLUGINS[leagueId];
  return {
    ...plugin,
    id: leagueId,
    ...composeLeagueBehavior(
      plugin.family,
      "overrides" in plugin ? plugin.overrides : undefined,
    ),
  };
}