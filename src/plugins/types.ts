export type SportFamily = "football" | "baseball" | "basketball" | "hockey";

export type LeagueScheduleMode = "date" | "week";

export type LeaguePeriodKind = "inning" | "period";

export type LeaguePeriodLabelStyle = "inning" | "quarter" | "period";

export type LeagueOvertimeLabelStyle = "ordinal" | "overtime";

export type LeagueSituationKind = "baseball" | "football" | "period";

export type LeagueTeamStatsMode = "standard" | "grouped";

export type TvLineupDurationBehavior =
  | { readonly mode: "fixed"; readonly minutes: number }
  | {
      readonly mode: "football";
      readonly regularMinutes: number;
      readonly extendedMinutes: number;
      readonly postseasonType: number;
      readonly timezone: string;
      readonly eveningKickoffHour: number;
    };

export type TvLineupStatusMode = "standard" | "inning";

export interface LeagueBehavior {
  readonly sportPath: "baseball" | "basketball" | "football" | "hockey";
  readonly schedule: {
    readonly mode: LeagueScheduleMode;
    readonly includesSeasonType: boolean;
    readonly supportsGroupFilter: boolean;
  };
  readonly linescore: {
    readonly regulationPeriods: number;
    readonly kind: LeaguePeriodKind;
    readonly periodLabelStyle: LeaguePeriodLabelStyle;
    readonly overtimeLabelStyle: LeagueOvertimeLabelStyle;
    readonly situation: LeagueSituationKind;
    readonly supportsPossession: boolean;
  };
  readonly game: {
    readonly teamStatsMode: LeagueTeamStatsMode;
    readonly supportsDrives: boolean;
  };
  readonly standings: {
    readonly hiddenStatKeys: readonly string[];
  };
  readonly tvLineup: {
    readonly duration: TvLineupDurationBehavior;
    readonly status: TvLineupStatusMode;
  };
}

export interface LeagueBehaviorOverrides {
  readonly sportPath?: LeagueBehavior["sportPath"];
  readonly schedule?: Partial<LeagueBehavior["schedule"]>;
  readonly linescore?: Partial<LeagueBehavior["linescore"]>;
  readonly game?: Partial<LeagueBehavior["game"]>;
  readonly standings?: Partial<LeagueBehavior["standings"]>;
  readonly tvLineup?: Partial<LeagueBehavior["tvLineup"]>;
}

export interface LeaguePluginDefinition {
  readonly label: string;
  readonly name: string;
  readonly family: SportFamily;
  readonly overrides?: LeagueBehaviorOverrides;
}