export interface MyTeamsGroup<T> {
  key: string;
  label: string;
  games: T[];
}

interface ScheduledGame {
  startTime: number | null;
  state: string;
}

function localDateKey(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

export function groupMyTeamsGames<T extends ScheduledGame>(
  games: T[],
  now: number,
): MyTeamsGroup<T>[] {
  const todayKey = localDateKey(new Date(now));
  const groups = new Map<string, MyTeamsGroup<T>>();

  for (const game of games) {
    const date = new Date(game.startTime ?? now);
    const dateKey = localDateKey(date);
    const key =
      game.state === "in" ? "live" : dateKey === todayKey ? "today" : dateKey;
    const label =
      key === "live"
        ? "Live now"
        : key === "today"
          ? "Today"
          : date.toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
            });
    const group = groups.get(key) ?? { key, label, games: [] };
    group.games.push(game);
    groups.set(key, group);
  }

  return [...groups.values()].sort((first, second) => {
    const priority = (key: string) =>
      key === "live" ? 0 : key === "today" ? 1 : 2;
    return (
      priority(first.key) - priority(second.key) ||
      first.key.localeCompare(second.key)
    );
  });
}
