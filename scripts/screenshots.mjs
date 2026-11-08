import { createServer } from "vite";
import { chromium } from "playwright";
import { copyFile, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { captureScenarios, captureTime, createCaptureFixtures, resolveFixture } from "./screenshot-fixtures.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixtureDir = path.join(root, "tests", "fixtures", "espn");
const readFixture = async (name) => JSON.parse(await readFile(path.join(fixtureDir, `${name}.json`), "utf8"));
const samples = Object.fromEntries(await Promise.all([
  ["nba", "nba"], ["nhl", "nhl"], ["mens-college-basketball", "mens-college-basketball"],
  ["players", "player-boxscore-samples"], ["gameCenter", "game-center"],
  ["standings", "standings"], ["cfbStandings", "college-football-standings"], ["mlbStats", "mlb-boxscore-stats"],
].map(async ([key, filename]) => [key, await readFixture(filename)])));
const { fixtures, favoriteTeams } = createCaptureFixtures(samples);
const leagues = ["college-football", "nfl", "mlb", "nba", "mens-college-basketball", "nhl"];
const preferences = {
  version: 1, autoCheckForUpdates: false, showMyTeams: true,
  visibleLeagues: leagues, leagueOrder: leagues,
  favoriteTeams: Object.fromEntries(leagues.map((league) => [league, ["nfl", "nba"].includes(league) ? favoriteTeams[league] : []])),
};
const stage = await mkdtemp(path.join(tmpdir(), "scoreboard-screenshots-"));
let server;
let browser;
try {
  server = await createServer({ root, configFile: path.join(root, "vite.config.ts"), server: { host: "127.0.0.1", port: 18731, strictPort: true } });
  await server.listen();
  browser = await chromium.launch();
  for (const [label, viewport, deviceScaleFactor] of [
    ["Desktop", { width: 1280, height: 800 }, 1],
    ["Mobile", { width: 412, height: 916 }, 2],
  ]) {
    const errors = [];
    const captured = new Set();
    const context = await browser.newContext({ viewport, deviceScaleFactor, locale: "en-US", timezoneId: "America/New_York", reducedMotion: "reduce" });
    await context.addInitScript(({ preferences, captureTime }) => {
      const RealDate = Date;
      const fixedTime = RealDate.parse(captureTime);
      globalThis.Date = class extends RealDate {
        constructor(...args) { super(...(args.length ? args : [fixedTime])); }
        static now() { return fixedTime; }
      };
      localStorage.setItem("sports-scoreboard.preferences", JSON.stringify(preferences));
    }, { preferences, captureTime });
    await context.route("https://site.api.espn.com/**", async (route) => {
      try {
        await route.fulfill({ json: resolveFixture(route.request().url(), fixtures), headers: { "Access-Control-Allow-Origin": "*" } });
      } catch (error) {
        errors.push(error.message);
        await route.abort();
      }
    });
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("http://127.0.0.1:18731/", { waitUntil: "networkidle" });
    await page.addStyleTag({ content: "*, *::before, *::after { animation: none !important; transition: none !important; caret-color: transparent !important; }" });
    const sports = page.getByRole("tablist", { name: "Sports" });
    const dashboard = page.getByLabel("Dashboard view");
    const leagueIds = { CFB: "college-football", NFL: "nfl", MLB: "mlb", NBA: "nba", CBB: "mens-college-basketball", NHL: "nhl" };
    const selectLeague = async (name) => {
      await sports.getByRole("tab", { name, exact: true }).click();
      const league = leagueIds[name];
      const event = fixtures.find(({ pathname, query }) => pathname.endsWith(`/${league}/scoreboard`) && !query).payload.events[0];
      await page.getByRole("button", { name: event.name, exact: true }).waitFor();
    };
    const capture = async (name, focus) => {
      if (!captureScenarios.includes(name) || captured.has(name)) throw new Error(`Unexpected or duplicate screenshot: ${name}`);
      if (focus) await focus.scrollIntoViewIfNeeded();
      await page.waitForLoadState("networkidle");
      await page.waitForFunction(() => {
        const indicator = document.querySelector('[aria-label="Refreshing data"]');
        return !indicator || indicator.getAttribute("aria-hidden") === "true";
      });
      await page.evaluate(async () => {
        await document.fonts.ready;
        for (const image of document.images) image.loading = "eager";
        await Promise.all([...document.images].map((image) => image.decode().catch(() => {})));
      });
      const brokenImages = await page.locator("img").evaluateAll((images) => images.filter((image) => !image.naturalWidth).map((image) => image.currentSrc || image.src));
      if (brokenImages.length) throw new Error(`Broken images in ${name}: ${brokenImages.join(", ")}`);
      if (errors.length) throw new Error(errors.join("\n"));
      await page.screenshot({ path: path.join(stage, `${label}_${name}.png`), fullPage: true, animations: "disabled" });
      captured.add(name);
      console.log(`${label}: ${name}`);
    };

    for (const [tab, name] of [["CFB", "Scoreboard_CFB"], ["NFL", "Scoreboard_NFL"], ["MLB", "Scoreboard_MLB"], ["NBA", "Scoreboard_NBA"], ["CBB", "Scoreboard_CBB"], ["NHL", "Scoreboard_NHL"]]) {
      await selectLeague(tab);
      await capture(name);
      if (tab === "CBB") {
        await Promise.all([
          page.waitForResponse((response) => response.url().includes("mens-college-basketball/scoreboard") && new URL(response.url()).searchParams.get("groups") === "2"),
          page.locator("select").first().selectOption("2"),
        ]);
        await page.getByRole("button", { name: "Duke Blue Devils at North Carolina Tar Heels" }).waitFor();
        await page.getByRole("button", { name: /SIU Edwardsville Cougars at Houston Cougars/ }).waitFor({ state: "hidden" });
        await capture("Scoreboard_CBB_Conference");
      }
    }
    await selectLeague("NBA");
    await dashboard.getByRole("button", { name: "TV Lineup" }).click();
    await page.getByText("ESPN", { exact: true }).first().waitFor();
    await capture("TV_Lineup");
    await dashboard.getByRole("button", { name: "Standings" }).click();
    await page.getByText("Eastern Conference", { exact: true }).first().waitFor();
    await capture("Standings");
    await sports.getByRole("tab", { name: "My Teams" }).click();
    await page.getByText("Loading favorite team schedules...").waitFor({ state: "hidden" });
    await page.getByText("Jacksonville Jaguars", { exact: false }).first().waitFor();
    await capture("My_Teams");
    await selectLeague("NBA");
    await page.getByRole("button", { name: "Settings" }).click();
    const settings = page.getByRole("dialog", { name: "Settings" });
    await settings.getByText("Sports", { exact: true }).waitFor();
    await capture("Settings_Sports");
    await settings.getByRole("heading", { name: "Favorite teams" }).evaluate((heading) => heading.scrollIntoView({ block: "start" }));
    await settings.getByLabel("Find a team").waitFor();
    await capture("Settings_Favorites");
    await settings.getByRole("button", { name: "Close" }).click();
    await page.getByRole("button", { name: "Boston Celtics at Philadelphia 76ers" }).click();
    await page.getByRole("tablist", { name: "Game center views" }).getByRole("tab", { name: "MATCHUP" }).waitFor();
    await capture("Game_Pregame");
    await page.getByRole("button", { name: /CLOSE WINDOW/ }).click();
    await page.getByRole("button", { name: / at / }).first().click();
    const tabs = page.getByRole("tablist", { name: "Game center views" });
    await tabs.waitFor();
    for (const [tab, name] of [["TEAM STATS", "Game_Stats"], ["FLOW", "Game_Flow"], ["TIMELINE", "Game_Timeline"], ["BOX SCORE", "Game_Box_Score"], ["MATCHUP", "Game_Matchup"]]) {
      await tabs.getByRole("tab", { name: tab }).click();
      await capture(name, tabs);
      if (tab === "TIMELINE") {
        await page.getByRole("switch", { name: "Show scoring plays only" }).click();
        await capture("Game_Scoring", tabs);
      }
    }
    await page.getByRole("button", { name: /Charlotte Hornets|CHA/ }).last().click();
    const teamTabs = page.getByRole("tablist", { name: "Team details" });
    await teamTabs.waitFor();
    await capture("Team_Overview", teamTabs);
    await teamTabs.getByRole("tab", { name: /Schedule/ }).click();
    await capture("Team_Schedule", teamTabs);
    await page.getByRole("button", { name: /CLOSE WINDOW/ }).click();
    await selectLeague("NFL");
    await page.getByRole("button", { name: / at / }).first().click();
    await page.getByText("Live Drive", { exact: true }).waitFor();
    await capture("Football_Drive", page.getByText("Live Drive", { exact: true }));
    await page.getByRole("button", { name: /CLOSE WINDOW/ }).click();
    await selectLeague("MLB");
    await page.getByRole("button", { name: / at / }).first().click();
    await page.getByRole("tablist", { name: "Game center views" }).waitFor();
    await capture("Baseball_Stats", page.getByRole("tablist", { name: "Game center views" }));
    await page.getByLabel("MLB stat category").selectOption("pitching");
    await capture("Baseball_Pitching");
    if (captured.size !== captureScenarios.length) throw new Error(`Missing ${label} scenarios: ${captureScenarios.filter((name) => !captured.has(name)).join(", ")}`);
    await context.close();
  }
  const destination = path.join(root, "docs", "screenshots");
  await mkdir(destination, { recursive: true });
  for (const label of ["Desktop", "Mobile"]) {
    for (const name of captureScenarios) await copyFile(path.join(stage, `${label}_${name}.png`), path.join(destination, `${label}_${name}.png`));
  }
  console.log(`Saved ${captureScenarios.length * 2} screenshots to ${destination}`);
} finally {
  await browser?.close();
  await server?.close();
  await rm(stage, { recursive: true, force: true });
}