# Sports Scoreboard

A static, responsive sports scoreboard dashboard powered by ESPN's public site API. It is designed to run from a normal static web host, including Home Assistant's `config/www` directory, without a backend server or production Node.js runtime.

## Features

- College Football, NFL, MLB, NBA, NCAA men's basketball, and NHL scoreboard tabs
- TV Lineup view with network rows, estimated game windows, and live scores/status
- Cross-league My Teams view for favorite teams' live/upcoming games and their latest result from the prior seven days, refreshed while selected and when returning to the app
- Standings view for each supported league, showing ESPN-provided groupings and statistics
- Football week and season-type controls
- Calendar date selection for MLB, NBA, NCAA men's basketball, and NHL
- NCAA men's basketball conference filtering and two-half game scoring
- Live, upcoming, and completed game views
- Scoreboard and TV Lineup refresh every 15 seconds while visible; active sections refresh when selected and when returning to the app
- Game detail modal with scores, team statistics, scoring plays, drives, and win probability when supplied by ESPN
- Clickable team names that open team information, records, statistics, and schedule
- Customizable sport tabs, including visibility and ordering
- Multiple favorite teams per league, highlighted by ESPN team ID
- Browser-local preference persistence for favorite teams and sport settings
- Defensive handling for missing logos, scores, dates, records, and partial ESPN responses
- Static deployment with relative JavaScript module paths

## Browser CORS Limitation

ESPN's browser CORS behavior has been inconsistent since October 2026, particularly for team-detail and schedule requests. A static browser deployment, including Home Assistant, cannot work around a server's CORS policy; those requests may fail even while scoreboard data continues to load. My Teams may show cached schedules or report per-team failures in browser mode; the native wrapper routes ESPN JSON requests through its allowlisted Tauri command instead. Check the browser console and network panel when diagnosing direct-browser failures.

## Screenshots

These responsive browser captures use curated sample data, including synthetic scores and dates; they are not live ESPN results or Android device captures. Desktop uses a 1280 x 800 CSS-pixel viewport, and mobile uses 412 x 916 CSS pixels at 2x scale. Longer pages are captured in full. Native-only update notices and update settings are not shown.

| View                           | Desktop                                                                              | Mobile                                                                             |
| ------------------------------ | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| College football               | ![College football desktop](docs/screenshots/Desktop_Scoreboard_CFB.png)             | ![College football mobile](docs/screenshots/Mobile_Scoreboard_CFB.png)             |
| NFL                            | ![NFL desktop](docs/screenshots/Desktop_Scoreboard_NFL.png)                          | ![NFL mobile](docs/screenshots/Mobile_Scoreboard_NFL.png)                          |
| MLB                            | ![MLB desktop](docs/screenshots/Desktop_Scoreboard_MLB.png)                          | ![MLB mobile](docs/screenshots/Mobile_Scoreboard_MLB.png)                          |
| NBA                            | ![NBA desktop](docs/screenshots/Desktop_Scoreboard_NBA.png)                          | ![NBA mobile](docs/screenshots/Mobile_Scoreboard_NBA.png)                          |
| Men's college basketball       | ![College basketball desktop](docs/screenshots/Desktop_Scoreboard_CBB.png)           | ![College basketball mobile](docs/screenshots/Mobile_Scoreboard_CBB.png)           |
| Conference filter              | ![Conference filter desktop](docs/screenshots/Desktop_Scoreboard_CBB_Conference.png) | ![Conference filter mobile](docs/screenshots/Mobile_Scoreboard_CBB_Conference.png) |
| NHL                            | ![NHL desktop](docs/screenshots/Desktop_Scoreboard_NHL.png)                          | ![NHL mobile](docs/screenshots/Mobile_Scoreboard_NHL.png)                          |
| TV Lineup                      | ![TV Lineup desktop](docs/screenshots/Desktop_TV_Lineup.png)                         | ![TV Lineup mobile](docs/screenshots/Mobile_TV_Lineup.png)                         |
| Standings                      | ![Standings desktop](docs/screenshots/Desktop_Standings.png)                         | ![Standings mobile](docs/screenshots/Mobile_Standings.png)                         |
| My Teams                       | ![My Teams desktop](docs/screenshots/Desktop_My_Teams.png)                           | ![My Teams mobile](docs/screenshots/Mobile_My_Teams.png)                           |
| Sport settings                 | ![Sport settings desktop](docs/screenshots/Desktop_Settings_Sports.png)              | ![Sport settings mobile](docs/screenshots/Mobile_Settings_Sports.png)              |
| Favorite teams                 | ![Favorite teams desktop](docs/screenshots/Desktop_Settings_Favorites.png)           | ![Favorite teams mobile](docs/screenshots/Mobile_Settings_Favorites.png)           |
| Pregame matchup                | ![Pregame desktop](docs/screenshots/Desktop_Game_Pregame.png)                        | ![Pregame mobile](docs/screenshots/Mobile_Game_Pregame.png)                        |
| Team stats and win probability | ![Game stats desktop](docs/screenshots/Desktop_Game_Stats.png)                       | ![Game stats mobile](docs/screenshots/Mobile_Game_Stats.png)                       |
| Game flow                      | ![Game flow desktop](docs/screenshots/Desktop_Game_Flow.png)                         | ![Game flow mobile](docs/screenshots/Mobile_Game_Flow.png)                         |
| Play-by-play                   | ![Play-by-play desktop](docs/screenshots/Desktop_Game_Timeline.png)                  | ![Play-by-play mobile](docs/screenshots/Mobile_Game_Timeline.png)                  |
| Scoring plays                  | ![Scoring plays desktop](docs/screenshots/Desktop_Game_Scoring.png)                  | ![Scoring plays mobile](docs/screenshots/Mobile_Game_Scoring.png)                  |
| Player box score               | ![Box score desktop](docs/screenshots/Desktop_Game_Box_Score.png)                    | ![Box score mobile](docs/screenshots/Mobile_Game_Box_Score.png)                    |
| Matchup                        | ![Matchup desktop](docs/screenshots/Desktop_Game_Matchup.png)                        | ![Matchup mobile](docs/screenshots/Mobile_Game_Matchup.png)                        |
| Team overview                  | ![Team overview desktop](docs/screenshots/Desktop_Team_Overview.png)                 | ![Team overview mobile](docs/screenshots/Mobile_Team_Overview.png)                 |
| Team schedule                  | ![Team schedule desktop](docs/screenshots/Desktop_Team_Schedule.png)                 | ![Team schedule mobile](docs/screenshots/Mobile_Team_Schedule.png)                 |
| Football live drive            | ![Live drive desktop](docs/screenshots/Desktop_Football_Drive.png)                   | ![Live drive mobile](docs/screenshots/Mobile_Football_Drive.png)                   |
| Baseball batting stats         | ![Batting stats desktop](docs/screenshots/Desktop_Baseball_Stats.png)                | ![Batting stats mobile](docs/screenshots/Mobile_Baseball_Stats.png)                |
| Baseball pitching stats        | ![Pitching stats desktop](docs/screenshots/Desktop_Baseball_Pitching.png)            | ![Pitching stats mobile](docs/screenshots/Mobile_Baseball_Pitching.png)            |

### Regenerating Screenshots

From this directory, install dependencies and the Playwright browser once, then run the capture script on demand:

```sh
npm ci
npx playwright install chromium
npm run screenshots
```

The script starts a local Vite server on `127.0.0.1:18731` and uses an isolated browser profile, a fixed clock, and screenshot-only ESPN response fixtures. It intercepts API calls locally, avoiding ESPN's browser CORS restrictions; internet access is still required for ESPN-hosted team logos and player images. It checks for missing fixtures and broken images and stages the complete set before replacing the listed files in `docs/screenshots/`. Existing unrelated images are left alone. Run `npm run test:screenshots` to check the fixture router and scenario manifest. Screenshot generation is never part of a build or CI workflow.

## How It Works

The application is a Vue 3 single-page app. Vite compiles its component templates and bundles the frontend into static files.

- Vue 3 and Tailwind CSS are installed locally and included in the production bundle.
- Application code, the Vue script, Vite configuration, and tests are TypeScript. `tsconfig.json` enables strict checking; the production build runs `vue-tsc` before tests and bundling.
- The SPA calls ESPN directly with `fetch` in a browser. When hosted inside Tauri, the same API adapter uses Tauri IPC to call the native ESPN proxy.
- ESPN payloads enter through an `unknown` boundary and are normalized by typed domain modules.
- League behavior is composed from shared defaults, sport-family defaults, and league-specific overrides in `src/plugins/`. The current registry contains College Football, NFL, MLB, NBA, NCAA men's basketball, and NHL.
- The static browser build has no backend, database, production Node.js runtime, or runtime configuration service. The native Tauri wrapper optionally supplies the ESPN proxy over IPC.

The application currently builds ESPN endpoints using these patterns:

```text
Scoreboard:
https://site.api.espn.com/apis/site/v2/sports/{sport}/{league}/scoreboard

Game summary:
https://site.api.espn.com/apis/site/v2/sports/{sport}/{league}/summary?event={eventId}

Team details:
https://site.api.espn.com/apis/site/v2/sports/{sport}/{league}/teams/{teamId}

Team schedule:
https://site.api.espn.com/apis/site/v2/sports/{sport}/{league}/teams/{teamId}/schedule

Standings:
https://site.api.espn.com/apis/v2/sports/{sport}/{league}/standings
```

College Football and NFL use the `football` sport path. MLB uses `baseball`, NBA and NCAA men's basketball use `basketball`, and NHL uses `hockey`. Date-based leagues send the selected date as `dates=YYYYMMDD`; NCAA men's basketball can combine this with `groups={conferenceId}`. Football uses week and season-type parameters. NCAA men's basketball uses two regulation halves and labels overtime periods after the second half.
Standings use ESPN's v2 Site API endpoint, whose response contains league-specific groups and team statistics. NCAA men's basketball uses a static list of ESPN conference IDs, defaults to ESPN's date scoreboard response for Top 25 games, and fetches standings by conference to avoid oversized all-conference responses. Its favorite-team picker uses the bounded ESPN team directory instead of standings. Other leagues may expose additional standings levels through a `group` query parameter; the app follows those IDs and renders each league's hierarchy without assuming every sport uses the same conference or division structure.

## Project Structure

```text
index.html                         Vite HTML entry point
src/App.vue                        Vue UI and TypeScript component setup
src/main.ts                        Vue mount entry point
src/styles.css                     Tailwind import and global styles
src/api/espn.ts                    Typed ESPN URLs and fetch wrappers
src/domain/*.ts                    Game, team, schedule, matchup, standings, and play-by-play normalizers
src/composables/*.ts               Typed Vue state and workflow composables
src/plugins/                       Shared, family, and league-specific behavior contracts
src/app/*.ts                       League lookup, preferences, history, scoreboard, and game-flow helpers
scripts/build.mjs                  Vite production build and license packaging
vite.config.ts                     Vite, Vue, and Tailwind build configuration
tsconfig.json                      Strict TypeScript configuration
tests/unit/*.test.ts               Unit tests
tests/integration/*.test.ts        Fixture-backed integration tests
tests/fixtures/espn/               Trimmed ESPN response fixtures
tests/live/*.test.ts               Live ESPN smoke tests
.github/workflows/build.yml        Pull request and push build workflow
.github/workflows/espn-live.yml    Scheduled/manual live API workflow
.github/workflows/release.yml      Version-tagged release workflow
```

## Requirements

For development and builds:

- Node.js 20 or newer
- npm
- Network access for the browser to reach the ESPN API

Home Assistant only needs to serve the generated static files. It does not need Node.js.

## Install

From the project root:

```bash
npm ci
```

Use `npm install` only when intentionally updating dependencies or the lockfile.

## Test

Run all discovered tests:

```bash
npm test
```

Run strict TypeScript checking independently:

```bash
npm run typecheck
```

Vitest's default discovery includes unit tests, fixture-backed integration tests, and the live ESPN smoke test. The live test makes real requests and requires network access. For deterministic unit and fixture-backed integration tests only, run:

```bash
npx vitest run tests/unit tests/integration
```

Run all discovered tests with coverage (including the live smoke test):

```bash
npm run test:coverage
```

Start Vitest in watch mode while developing:

```bash
npm run test:watch
```

### Live ESPN Smoke Test

The live smoke test calls the real ESPN endpoints and validates the response shape and normalizer behavior. It uses NFL team `12` by default and can be configured with environment variables. It is included in `npm test` and `npm run test:coverage` because Vitest discovers all `*.test.ts` files by default; `npm run test:live` runs only this directory.

```bash
npm run test:live
```

PowerShell example:

```powershell
$env:ESPN_LEAGUE = "nfl"
$env:ESPN_TEAM_ID = "12"
npm run test:live
```

The live test is intentionally separate from the deterministic fixture tests. ESPN availability, rate limits, and changing sports data can cause a live test to fail even when the application code is correct.

## Build

Create the deployable static package:

```bash
npm run build
```

The build runs strict TypeScript checking and `npm test` before creating `dist/`. Since the default test command includes the live smoke test, building requires network access. The generated package contains:

- `index.html`
- `assets/` containing bundled JavaScript and CSS
- `LICENSE`

The browser loads no Vue, Tailwind, or application modules from a CDN or from `src/` at runtime. `dist/` is ignored by Git because it is generated output.

To develop locally, start the Vite server over HTTP (it remains in the foreground until stopped):

```bash
npm run serve
```

Then open `http://localhost:8000`. Port 8000 is strict; stop an existing server using that port before starting Vite. To test the production output, run `npm run preview` after the build and open `http://localhost:4173`. Do not test by opening `index.html` with a `file:` URL.

## GitHub Actions

The repository includes three workflows.

### Build workflow

`.github/workflows/build.yml` runs on pushes and pull requests targeting `main`. It:

1. Installs the locked dependencies with `npm ci`.
2. Runs coverage, including the live ESPN smoke test discovered by Vitest.
3. Runs the test-gated static build.
4. Uploads `dist/` as a workflow artifact.

Configure the `Build / build` job as a required status check in branch protection for `main`.

### Live ESPN workflow

`.github/workflows/espn-live.yml` runs daily and supports manual dispatch from the Actions tab. It calls the real ESPN API using the configured default NFL team.

GitHub-hosted standard runners are free for public repositories. Artifact storage and retention are still subject to GitHub limits. The live workflow does not require secrets because the tested ESPN endpoints are public.

### Release workflow

`.github/workflows/release.yml` can be run manually from the Actions tab or triggered by pushing a semantic version tag matching `v*.*.*`. A manual run finds the latest semantic version tag and creates the next minor version (for example, `v1.0.0` becomes `v1.1.0`). It installs dependencies, runs the test-gated build, packages `dist/` as a ZIP file, and creates a GitHub Release with generated release notes.

The workflow requires `contents: write` permission so it can create the release. It does not require a personal access token or repository secret; `github.token` is supplied by GitHub Actions.

To release with the automatic minor version bump, run **Release** from the Actions tab. To publish a specific version manually, create and push its tag from the project root:

```bash
git tag v1.1.0
git push origin v1.1.0
```

The resulting release asset will be named like:

```text
sports-scoreboard-v1.1.0.zip
```

The release ZIP contains the generated `dist/` directory. For Home Assistant, extract the ZIP and copy the contents of `dist/` into a directory under `config/www`, as described below. Do not create a release from a pull request or ordinary branch push.

## Deploy To Home Assistant

Home Assistant serves static files from its `www` directory. The URL is normally available under `/local/`.

### Option 1: Build locally

1. Install Node.js and npm on a development machine.
2. From the project root, run:

   ```bash
   npm ci
   npm run build
   ```

3. Copy the contents of `dist/` into a directory under Home Assistant's `config/www`, for example:

   ```text
   /config/www/sports-scoreboard/
   ```

4. Open the dashboard at:

   ```text
   http://HOME_ASSISTANT_HOST:8123/local/sports-scoreboard/
   ```

   The exact URL depends on your Home Assistant host and whether authentication or a reverse proxy is in use.

5. Add the URL to Home Assistant using a panel or webpage card, for example:

   ```yaml
   type: iframe
   url: /local/sports-scoreboard/index.html
   aspect_ratio: 75%
   ```

### Option 2: Use the GitHub Actions artifact

1. Open a successful Build workflow run in GitHub.
2. Download the `sports-scoreboard-dist` artifact.
3. Extract it into:

   ```text
   /config/www/sports-scoreboard/
   ```

4. Reload the browser and open `/local/sports-scoreboard/`.

Copy the contents of `dist/` rather than the `dist/` directory itself if you want `index.html` directly at the deployment path.

### Option 3: Use a GitHub Release

1. Open the desired release in the repository's **Releases** page.
2. Download the `sports-scoreboard-vX.Y.Z.zip` asset.
3. Extract the ZIP and copy the contents of its `dist/` directory into:

   ```text
   /config/www/sports-scoreboard/
   ```

4. Reload the browser and open `/local/sports-scoreboard/`.

### Home Assistant Notes

- Home Assistant does not need Node.js after the files are deployed.
- Copy the complete contents of `dist/`, including the `assets/` directory, into the deployment directory. The generated asset URLs are relative so the SPA works beneath `/local/`.
- When updating, replace the deployed files together so `index.html` does not refer to missing hashed assets; remove stale assets if needed and hard refresh the browser.
- The browser must be able to make requests to ESPN. Network restrictions, content blockers, DNS filtering, or a restrictive proxy can prevent scoreboard data from loading.
- After updating files, perform a hard refresh if the browser appears to show an older version.

## Adding A League

To add another ESPN league:

1. Confirm the ESPN sport and league identifiers used by the Site API.
2. Add the league to the typed plugin registry in `src/plugins/registry.ts`, reusing its sport-family defaults and overriding only behavior that differs. `src/app/leagues.ts` derives the supported league list from this registry.
3. Update the league UI or controls only where the new schedule mode or behavior requires it; avoid duplicating shared views and logic.
4. Check scoreboard, summary, team, schedule, and standings response shapes, including optional and missing fields.
5. Add representative JSON fixtures and TypeScript unit/integration tests for routing, plugin composition, presentation, and normalization before enabling the league.
6. Run `npm run typecheck`, deterministic tests with `npx vitest run tests/unit tests/integration`, review `npm run test:coverage`, then run `npm run build` (which also runs the live smoke test).

The API, plugin, and normalizer modules are intentionally separated from the UI so sport-specific payload differences can be handled without introducing a backend.

## Troubleshooting

### No games appear

Check the browser developer console and network panel. Confirm the ESPN request succeeds and that the selected league, week, season type, or MLB date has games available.

### Team details do not load

Confirm that the game response includes a team ID and that the team and schedule endpoints are reachable. The team detail view makes two requests: one for details and one for schedule.

### Standings do not load

Check the browser developer console and network panel for the ESPN v2 standings request. ESPN may return different grouping hierarchies by league; if the payload has no team entries, the dashboard reports that standings are unavailable.

### The page works locally but not in Home Assistant

Serve the built package through an HTTP server, confirm the complete `dist/` contents were copied, and check that the `/local/` URL maps to the directory under `config/www`.

### Live tests fail in GitHub Actions

A failure may indicate an ESPN outage, rate limiting, a changed payload shape, or a changed team configuration. Run the live test locally, inspect the response, and compare it with the fixture-backed tests before changing application logic.

## Data Source And Disclaimer

This project uses ESPN's publicly accessible site API endpoints. It is not affiliated with or endorsed by ESPN. API availability, response formats, schedules, branding, and data may change without notice. Use the application within the terms and policies that apply to the data source.

## License

See [LICENSE](LICENSE).
