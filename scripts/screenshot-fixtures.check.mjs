import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { captureScenarios, createCaptureFixtures, resolveFixture } from "./screenshot-fixtures.mjs";

const fixtures = [
  { pathname: "/summary", query: { event: "123" }, payload: { score: 7 } },
];

test("matches a fixture and returns an isolated payload", () => {
  const url = "https://site.api.espn.com/summary?event=123";
  const result = resolveFixture(url, fixtures);
  result.score = 0;
  assert.equal(resolveFixture(url, fixtures).score, 7);
});

test("rejects unmatched requests and other hosts", () => {
  assert.throws(() => resolveFixture("https://site.api.espn.com/summary?event=456", fixtures), /No screenshot fixture/);
  assert.throws(() => resolveFixture("https://example.com/summary?event=123", fixtures), /Unexpected ESPN request/);
});

test("capture scenarios have unique, portable names", () => {
  assert.equal(new Set(captureScenarios).size, captureScenarios.length);
  assert.ok(captureScenarios.every((name) => /^[A-Za-z0-9_]+$/.test(name)));
});

test("every league has coherent scoreboard, summary, and favorite schedule fixtures", async () => {
  const names = {
    nba: "nba", nhl: "nhl", "mens-college-basketball": "mens-college-basketball",
    players: "player-boxscore-samples", gameCenter: "game-center", mlbStats: "mlb-boxscore-stats",
  };
  const samples = Object.fromEntries(await Promise.all(Object.entries(names).map(async ([key, name]) => [
    key, JSON.parse(await readFile(new URL(`../tests/fixtures/espn/${name}.json`, import.meta.url), "utf8")),
  ])));
  const { fixtures: captureFixtures, favoriteTeams } = createCaptureFixtures(samples);
  const sports = { "college-football": "football", nfl: "football", mlb: "baseball", nba: "basketball", "mens-college-basketball": "basketball", nhl: "hockey" };
  for (const [league, sport] of Object.entries(sports)) {
    const base = `https://site.api.espn.com/apis/site/v2/sports/${sport}/${league}`;
    const scoreboard = resolveFixture(`${base}/scoreboard?dates=20250320`, captureFixtures);
    assert.deepEqual(scoreboard.events.map((event) => event.status.type.state), ["in", "pre", "post"]);
    assert.equal(new Set(scoreboard.events.map((event) => event.competitions[0].competitors.map((team) => team.id).join("-"))).size, 3);
    for (const event of scoreboard.events) {
      const summary = resolveFixture(`${base}/summary?event=${event.id}`, captureFixtures);
      assert.deepEqual(summary.header.competitions[0].competitors, event.competitions[0].competitors);
    }
    const schedule = resolveFixture(`${base}/teams/${favoriteTeams[league][0].id}/schedule`, captureFixtures);
    assert.equal(schedule.events.length, 3);
    assert.throws(() => resolveFixture(`${base}/summary?event=unknown`, captureFixtures), /No screenshot fixture/);
  }
  const cbbBase = "https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball";
  const acc = resolveFixture(`${cbbBase}/scoreboard?groups=2`, captureFixtures);
  assert.equal(acc.events.length, 1);
  assert.deepEqual(acc.events[0].competitions[0].competitors.map((team) => team.id), ["150", "153"]);
});