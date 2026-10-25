import type { NormalizedPlayEvent, PlayByPlayTimeline } from "../domain/playByPlay";

interface ScoringEvent extends Omit<NormalizedPlayEvent, "awayScore" | "homeScore"> {
  awayScore: number;
  homeScore: number;
}

export interface GameFlowPoint {
  x: number;
  awayScore: number;
  homeScore: number;
  awayY: number;
  homeY: number;
  lead: string | number;
  event: ScoringEvent | null;
}

export interface GameFlow {
  points: GameFlowPoint[];
  awayPoints: string;
  homePoints: string;
  markers: GameFlowPoint[];
  chartMarkers: GameFlowPoint[];
}

type TeamSides = Partial<Record<"away" | "home", { id?: string | number }>>;

function hasScore(event: NormalizedPlayEvent): event is ScoringEvent {
  return Number.isFinite(event.awayScore) && Number.isFinite(event.homeScore);
}

function getLead(
  awayScore: number,
  homeScore: number,
  awayTeamId: string | number,
  homeTeamId: string | number,
): string | number {
  if (awayScore === homeScore) return "tie";
  return awayScore > homeScore ? awayTeamId : homeTeamId;
}

function getY(score: number, maximumScore: number): number {
  return Number((94 - (score / maximumScore) * 88).toFixed(2));
}

function sampleChartMarkers(markers: GameFlowPoint[], maximum = 14): GameFlowPoint[] {
  if (markers.length <= maximum) return markers;
  return Array.from({ length: maximum }, (_, index) =>
    markers[Math.round((index * (markers.length - 1)) / (maximum - 1))]!,
  );
}

export function buildGameFlow(
  timeline: PlayByPlayTimeline | null | undefined,
  teams: TeamSides = {},
): GameFlow {
  const scoringEvents: ScoringEvent[] = [];
  let lastScore: { awayScore: number; homeScore: number } | null = null;

  for (const event of timeline?.events ?? []) {
    if (!hasScore(event)) continue;
    const awayScore = Math.max(lastScore?.awayScore ?? 0, event.awayScore);
    const homeScore = Math.max(lastScore?.homeScore ?? 0, event.homeScore);
    const scoreChanged = Boolean(
      lastScore &&
      (awayScore !== lastScore.awayScore || homeScore !== lastScore.homeScore),
    );
    if ((event.scoring || scoreChanged) && (!lastScore || scoreChanged)) {
      scoringEvents.push({ ...event, awayScore, homeScore });
    }
    lastScore = { awayScore, homeScore };
  }

  if (!scoringEvents.length) {
    return { points: [], awayPoints: "", homePoints: "", markers: [], chartMarkers: [] };
  }

  const maximumScore = Math.max(
    1,
    ...scoringEvents.flatMap((event) => [event.awayScore, event.homeScore]),
  );
  const points: GameFlowPoint[] = [
    {
      x: 0,
      awayScore: 0,
      homeScore: 0,
      awayY: getY(0, maximumScore),
      homeY: getY(0, maximumScore),
      lead: "tie",
      event: null,
    },
    ...scoringEvents.map((event, index) => {
      const x = Number((((index + 1) / scoringEvents.length) * 100).toFixed(2));
      return {
        x,
        awayScore: event.awayScore,
        homeScore: event.homeScore,
        awayY: getY(event.awayScore, maximumScore),
        homeY: getY(event.homeScore, maximumScore),
        lead: getLead(
          event.awayScore,
          event.homeScore,
          teams.away?.id ?? "away",
          teams.home?.id ?? "home",
        ),
        event,
      };
    }),
  ];

  const markers = points.slice(1);
  const chartMarkers = sampleChartMarkers(markers);
  const chartPoints = [points[0]!, ...chartMarkers];
  return {
    points: chartPoints,
    awayPoints: chartPoints.map((point) => `${point.x},${point.awayY}`).join(" "),
    homePoints: chartPoints.map((point) => `${point.x},${point.homeY}`).join(" "),
    markers,
    chartMarkers,
  };
}