# Sports Scoreboard

A static, responsive sports scoreboard dashboard powered by ESPN's public site API. It is designed to run from a normal static web host, including Home Assistant's `config/www` directory, without a backend server or production Node.js runtime.

## Features

- College Football, NFL, and MLB scoreboard tabs
- Football week and season-type controls
- MLB date selection
- Live, upcoming, and completed game views
- Automatic scoreboard refresh every 15 seconds
- Game detail modal with scores, team statistics, scoring plays, drives, and win probability when supplied by ESPN
- Clickable team names that open team information, records, statistics, and schedule
- Favorite-team highlighting and game sorting
- Defensive handling for missing logos, scores, dates, records, and partial ESPN responses
- Static deployment with relative JavaScript module paths

## How It Works

The application is a single-page browser app defined in `index.html`.

- Vue 3 is loaded from the unpkg CDN.
- Tailwind CSS is loaded from its browser CDN.
- The browser calls ESPN directly using `fetch`.
- Shared API and data-normalization logic lives under `src/`.
- There is no backend, database, build server, or runtime configuration service.

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
```

Football leagues use the `football` sport path. MLB uses `baseball`.

## Project Structure

```text
index.html                         Browser application and Vue UI
src/api/espn.js                    ESPN URLs and fetch wrappers
src/domain/game.js                 Game summary normalization
src/domain/schedule.js             Team schedule normalization
src/domain/team.js                 Team record and stat normalization
src/app/scoreboard.js              Shared scoreboard helpers
scripts/build.mjs                  Static dist packaging script
tests/unit/                        Pure unit tests
tests/integration/                 Fixture-backed integration tests
tests/fixtures/espn/               Trimmed ESPN response fixtures
tests/live/                        Live ESPN smoke tests
.github/workflows/build.yml        Pull request and push build workflow
.github/workflows/espn-live.yml    Scheduled/manual live API workflow
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

Run the deterministic test suite:

```bash
npm test
```

This includes unit tests and fixture-backed integration tests. The fixture tests do not call ESPN.

Run tests with coverage:

```bash
npm run test:coverage
```

Start Vitest in watch mode while developing:

```bash
npm run test:watch
```

### Live ESPN Smoke Test

The live smoke test calls the real ESPN endpoints and validates the response shape and normalizer behavior. It uses NFL team `12` by default and can be configured with environment variables.

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

The build first runs `npm test`, then recreates `dist/` and copies:

- `index.html`
- `LICENSE`
- `src/`

`dist/` is ignored by Git because it is generated output.

To test the generated package locally, serve it over HTTP. Browser module imports should not be tested by opening `index.html` directly with a `file:` URL.

For example, with Python installed:

```bash
python -m http.server 8080 --directory dist
```

Then open `http://localhost:8080`.

## GitHub Actions

The repository includes two workflows.

### Build workflow

`.github/workflows/build.yml` runs on pushes and pull requests targeting `main`. It:

1. Installs the locked dependencies with `npm ci`.
2. Runs coverage.
3. Runs the test-gated static build.
4. Uploads `dist/` as a workflow artifact.

Configure the `Build / build` job as a required status check in branch protection for `main`.

### Live ESPN workflow

`.github/workflows/espn-live.yml` runs daily and supports manual dispatch from the Actions tab. It calls the real ESPN API using the configured default NFL team.

GitHub-hosted standard runners are free for public repositories. Artifact storage and retention are still subject to GitHub limits. The live workflow does not require secrets because the tested ESPN endpoints are public.

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

### Home Assistant Notes

- Home Assistant does not need Node.js after the files are deployed.
- Keep the entire `src/` directory beside `index.html`; the browser imports those modules at runtime.
- If the browser shows module or CORS errors, verify that the files are being served over HTTP and that the `src/` directory was copied.
- The browser must be able to make requests to ESPN. Network restrictions, content blockers, DNS filtering, or a restrictive proxy can prevent scoreboard data from loading.
- After updating files, perform a hard refresh if the browser appears to show an older version.

## Adding A League

To add another ESPN league:

1. Confirm the ESPN sport and league identifiers used by the site API.
2. Add the tab and league-specific controls in `index.html`.
3. Update sport-path handling in `src/api/espn.js` if the league is not football or baseball.
4. Check whether scoreboard, summary, team, and schedule payloads have sport-specific shapes.
5. Add representative fixtures and normalization tests before enabling the league in the UI.
6. Run the complete test and build commands.

The API and normalizer modules are intentionally separated from the UI so sport-specific payload differences can be handled without introducing a backend.

## Troubleshooting

### No games appear

Check the browser developer console and network panel. Confirm the ESPN request succeeds and that the selected league, week, season type, or MLB date has games available.

### Team details do not load

Confirm that the game response includes a team ID and that the team and schedule endpoints are reachable. The team detail view makes two requests: one for details and one for schedule.

### The page works locally but not in Home Assistant

Serve the built package through an HTTP server, confirm the complete `dist/` contents were copied, and check that the `/local/` URL maps to the directory under `config/www`.

### Live tests fail in GitHub Actions

A failure may indicate an ESPN outage, rate limiting, a changed payload shape, or a changed team configuration. Run the live test locally, inspect the response, and compare it with the fixture-backed tests before changing application logic.

## Data Source And Disclaimer

This project uses ESPN's publicly accessible site API endpoints. It is not affiliated with or endorsed by ESPN. API availability, response formats, schedules, branding, and data may change without notice. Use the application within the terms and policies that apply to the data source.

## License

See [LICENSE](LICENSE).
