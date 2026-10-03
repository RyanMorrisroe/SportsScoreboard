# Agent Guide

This file records repository-specific context and working guidance. Follow higher-priority platform and user instructions where they apply.

## Project

- Sports Scoreboard is a static, browser-only Vue 3 app with Tailwind loaded from CDNs. ESPN requests are made directly from the browser; there is no backend or runtime Node.js service.
- `index.html` owns the UI and Vue setup. Keep domain logic and testable decisions in `src/` instead of growing inline calculations in the page.
- `src/api/espn.js` builds ESPN Site API URLs and fetches team details/schedules.
- `src/app/scoreboard.js` contains display, sorting, sport-specific helpers, and stat comparisons.
- `src/domain/` normalizes game summaries, team schedules, and team records.
- `tests/unit/` covers pure helper behavior. `tests/integration/` verifies fixture-backed API/domain contracts. `tests/fixtures/espn/` contains trimmed ESPN-shaped payloads.

## Supported Leagues

- College Football and NFL use the ESPN `football` sport path and week/season-type controls.
- MLB uses `baseball`; NBA uses `basketball`; NHL uses `hockey`. These leagues use calendar dates for scoreboard requests.
- The app currently supports NBA and NHL only for pro basketball/hockey, not NCAA or other international leagues.

## ESPN Payload Notes

- Game summaries include team `color` and sometimes `alternateColor` as six-digit hex strings without a leading `#`. `buildGameDetail` should preserve them. Validate values before using them as styles and keep dark colors legible against the dark UI.
- ESPN may return home competitors before away competitors. Identify teams by `homeAway`, never array position.
- Event and competition objects can independently set `timeValid: false`; show `TBD` instead of formatting their placeholder date. Explicit TBD status text should also remain TBD.
- NBA/NHL team stats can have `displayValue` without `value`; comparison helpers should handle both.
- MLB summary team stats are grouped into nested `batting`, `pitching`, and `fielding` groups. Keep the drilldown grouped rather than dumping every raw metric in one list.
- NBA player-stat groups may omit a group `name`; NHL groups are commonly named.
- NBA summary feeds can include `winprobability`. NHL probability data was not available from the checked ESPN Site API summary/CDN game endpoints; do not synthesize it.
- ESPN responses may omit optional fields. Keep normalizers and UI fallbacks defensive.

## Development And Validation

- Install locked dependencies with `npm ci`.
- Run deterministic unit and fixture integration tests with `npm test`.
- Inspect statement/branch/function coverage with `npm run test:coverage`. Treat changes as production work: add focused tests for new branches, fallbacks, and payload variants; aim for complete coverage of newly added behavior.
- Run `npm run build` before considering source changes complete. The build runs tests, removes/recreates `dist/`, then copies `index.html`, `LICENSE`, and `src/`.
- Do not edit `dist/` directly; it is generated and ignored. Serve it over HTTP for browser testing, for example `python -m http.server 8080 --directory dist`.
- `npm run test:live` calls ESPN and is network-dependent. Keep deterministic CI coverage fixture-backed; use live checks as supplementary validation.

## Contribution Guidance

- Read the current contents of files before editing, especially documentation that may have user changes. Preserve unrelated work in the worktree.
- Keep changes focused and follow existing module boundaries. Prefer existing helpers and tests over introducing new abstractions or dependencies.
- When a real ESPN payload exposes a sport-specific difference, capture a trimmed fixture and test the consumed contract rather than relying only on live tests.
- Update user-facing documentation when supported leagues or workflows change. Avoid unrelated formatting or generated-file churn.
