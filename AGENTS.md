# Agent Guide

This file records repository-specific context and working guidance. Follow higher-priority platform and user instructions where they apply.

## Project

- Sports Scoreboard is a static Vue 3 app. Vite bundles Vue, Tailwind CSS, and application modules locally; it has no backend or production Node.js runtime. In a normal browser it requests ESPN directly; in Tauri the API adapter calls the native ESPN command over IPC.
- `src/App.vue` owns the UI and Vue setup. Keep domain logic and testable decisions in `src/` instead of growing inline calculations in the component.
- `src/api/espn.ts` builds ESPN Site API URLs and fetches external payloads as `unknown`.
- `src/plugins/` composes shared behavior, sport-family defaults, and league overrides. Keep league differences declarative where possible; avoid duplicating sport implementations.
- `src/composables/*.ts` contains typed Vue state and workflow composables.
- `src/app/scoreboard.ts` contains display, sorting, TV lineup layout, and stat-comparison helpers.
- `src/domain/*.ts` validates and normalizes game details, schedules, play-by-play, matchups, standings, and team records.
- `src/app/*.ts` contains typed league lookup, preferences, browser history, and game-flow helpers.
- Application code, tests, and `vite.config.ts` are strict TypeScript. `scripts/*.mjs` are Node build/release tooling, not application modules.
- `tests/unit/*.test.ts` covers pure helper behavior. `tests/integration/*.test.ts` verifies fixture-backed API/domain contracts. `tests/fixtures/espn/` contains trimmed ESPN-shaped payloads. `tests/live/*.test.ts` calls real ESPN endpoints.

## Supported Leagues

- College Football and NFL use the ESPN `football` sport path and week/season-type controls.
- MLB uses `baseball`; NBA uses `basketball`; NHL uses `hockey`. These leagues use calendar dates for scoreboard requests.
- The app currently supports NBA and NHL only for pro basketball/hockey, not NCAA or other international leagues.
- Plugin composition order is shared defaults, then sport-family defaults, then league-specific overrides. Keep the registry limited to the five supported leagues unless product scope changes.

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
- Run `npm run typecheck` for strict TypeScript and Vue checks. `tsconfig.json` excludes JavaScript; keep application and test code in TypeScript.
- Run all discovered tests with `npm test`. Vitest's default discovery includes `tests/live`, so this command and `npm run test:coverage` make network requests to ESPN. For deterministic unit and fixture integration tests, run `npx vitest run tests/unit tests/integration`.
- Inspect statement/branch/function coverage with `npm run test:coverage`. Treat changes as production work: add focused tests for new branches, fallbacks, and payload variants; aim for complete coverage of newly added behavior.
- Run `npm run build` before considering source changes complete. It runs strict typechecking and `npm test`, creates the Vite production bundle in `dist/`, and copies `LICENSE`; it therefore also requires ESPN network access for the live smoke test.
- Do not edit `dist/` directly; it is generated and ignored. Use `npm run serve` for development and `npm run preview` to serve the production bundle over HTTP. The dev server stays in the foreground on strict port 8000; stop an existing listener before starting it.
- `npm run test:live` calls ESPN and is network-dependent; it runs only the live test directory.

## Contribution Guidance

- Read the current contents of files before editing, especially documentation that may have user changes. Preserve unrelated work in the worktree.
- Keep changes focused and follow existing module boundaries. Prefer existing helpers and tests over introducing new abstractions or dependencies.
- When a real ESPN payload exposes a sport-specific difference, capture a trimmed fixture and test the consumed contract rather than relying only on live tests.
- Update user-facing documentation when supported leagues or workflows change. Avoid unrelated formatting or generated-file churn.
