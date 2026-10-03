# ESPN fixtures

These trimmed fixtures represent ESPN responses consumed by the application.

- `nfl-team-details.json`: `/sports/football/nfl/teams/12`, captured 2026-09-12
- `nfl-team-schedule.json`: `/sports/football/nfl/teams/12/schedule`, captured 2026-09-12
- `nba.json`: NBA scoreboard for 2025-03-20, game summary for event `401705576`, and Lakers team/schedule responses. The summary preserves ESPN's home-first competitor order and unnamed player-stat group shape.
- `nhl.json`: NHL scoreboard for 2025-04-15, game summary for event `401688890`, and Jets team/schedule responses. The summary preserves home-first competitor order, an overtime period, and named player-stat groups.
- `mlb-boxscore-stats.json`: MLB boxscore team stat groups from Braves at Tigers, event `401697218`, trimmed to the batting, pitching, and fielding metrics displayed in the game drilldown.

The NBA/NHL samples were read from the documented `site.api.espn.com/apis/site/v2/sports/{sport}/{league}` scoreboard, `summary?event=`, team, and team schedule resources. Only fields consumed by the app and normalizers are retained. Fixture tests assert payload contracts and representative behavior, not volatile live rankings or current season values. Refresh fixtures intentionally when ESPN payload shapes change.
