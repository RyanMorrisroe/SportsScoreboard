# ESPN fixtures

These trimmed fixtures represent the ESPN NFL team details and schedule endpoints used by the application.

- `nfl-team-details.json`: `/sports/football/nfl/teams/12`, captured 2026-09-12
- `nfl-team-schedule.json`: `/sports/football/nfl/teams/12/schedule`, captured 2026-09-12

Only fields consumed by the API and domain layers are retained. Fixture tests assert normalized contracts and representative behavior, not volatile values such as live rankings, event counts, or current records. Refresh fixtures intentionally when ESPN payload shapes change.
