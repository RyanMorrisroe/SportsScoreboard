export function resolveFixture(requestUrl, fixtures) {
  const url = new URL(requestUrl);
  if (url.protocol !== "https:" || url.hostname !== "site.api.espn.com") {
    throw new Error(`Unexpected ESPN request: ${requestUrl}`);
  }

  const match = fixtures.find(({ pathname, query = {} }) =>
    pathname === url.pathname &&
    Object.entries(query).every(([key, value]) => url.searchParams.get(key) === value),
  );
  if (!match) throw new Error(`No screenshot fixture for ${requestUrl}`);
  return structuredClone(match.payload);
}

export const captureTime = "2025-03-20T20:00:00Z";
export const captureScenarios = [
  "Scoreboard_CFB", "Scoreboard_NFL", "Scoreboard_MLB", "Scoreboard_NBA", "Scoreboard_CBB", "Scoreboard_CBB_Conference", "Scoreboard_NHL",
  "TV_Lineup", "Standings", "My_Teams", "Settings_Sports", "Settings_Favorites", "Game_Pregame",
  "Game_Stats", "Game_Flow", "Game_Timeline", "Game_Scoring", "Game_Box_Score", "Game_Matchup", "Team_Overview", "Team_Schedule", "Football_Drive", "Baseball_Stats", "Baseball_Pitching",
];

export function createCaptureFixtures(samples) {
  const extraTeams = {
    "college-football": [["333", "Alabama Crimson Tide", "ALA"], ["57", "Florida Gators", "FLA"], ["61", "Georgia Bulldogs", "UGA"], ["130", "Michigan Wolverines", "MICH"]],
    nfl: [["2", "Buffalo Bills", "BUF"], ["17", "New England Patriots", "NE"], ["12", "Kansas City Chiefs", "KC"], ["13", "Las Vegas Raiders", "LV"]],
    mlb: [["10", "New York Yankees", "NYY"], ["2", "Boston Red Sox", "BOS"], ["19", "Los Angeles Dodgers", "LAD"], ["25", "San Diego Padres", "SD"]],
    nba: [["2", "Boston Celtics", "BOS"], ["20", "Philadelphia 76ers", "PHI"], ["13", "Los Angeles Lakers", "LAL"], ["9", "Golden State Warriors", "GS"]],
    "mens-college-basketball": [["150", "Duke Blue Devils", "DUKE"], ["153", "North Carolina Tar Heels", "UNC"], ["2305", "Kansas Jayhawks", "KU"], ["96", "Kentucky Wildcats", "UK"]],
    nhl: [["10", "Toronto Maple Leafs", "TOR"], ["8", "Montreal Canadiens", "MTL"], ["22", "Edmonton Oilers", "EDM"], ["20", "Calgary Flames", "CGY"]],
  };
  const sports = {
    "college-football": "football",
    nfl: "football",
    mlb: "baseball",
    nba: "basketball",
    "mens-college-basketball": "basketball",
    nhl: "hockey",
  };
  const fixtures = [];
  const add = (pathname, payload, query) => fixtures.push({ pathname, payload, query });
  const favoriteTeams = {};

  for (const [league, sport] of Object.entries(sports)) {
    const sample = samples[league] ?? samples.players[league];
    const summary = structuredClone(sample.summary ?? sample);
    const competitors = summary.header.competitions[0].competitors;
    const logoLeague = league === "college-football" || league === "mens-college-basketball" ? "ncaa" : league;
    const logo = (id) => `https://a.espncdn.com/i/teamlogos/${logoLeague}/500/${id}.png`;
    for (const competitor of competitors) {
      const team = competitor.team;
      if (league === "mens-college-basketball" && team.abbreviation === "SIUE") {
        competitor.id = "2565";
        team.logo = logo(competitor.id);
      }
      team.id = competitor.id;
      team.logo ||= logo(competitor.id);
      const score = league === "mlb" ? (competitor.homeAway === "home" ? 5 : 6) : sport === "football" ? (competitor.homeAway === "home" ? 24 : 21) : sport === "hockey" ? (competitor.homeAway === "home" ? 2 : 3) : (competitor.homeAway === "home" ? 68 : 61);
      competitor.score = String(score);
      const periods = sport === "football" ? (competitor.homeAway === "home" ? [7, 10, 7] : [7, 7, 7]) : sport === "baseball" ? (competitor.homeAway === "home" ? [2, 1, 2] : [1, 2, 3]) : sport === "hockey" ? (competitor.homeAway === "home" ? [1, 1, 0] : [1, 1, 1]) : league === "mens-college-basketball" ? (competitor.homeAway === "home" ? [34, 34] : [27, 34]) : (competitor.homeAway === "home" ? [27, 27, 14] : [19, 25, 17]);
      competitor.linescores = periods.map((value) => ({ value, displayValue: String(value) }));
      competitor.record = [{ type: "total", summary: "12-6" }];
    }
    const eventId = sample.scoreboard?.events[0].id ?? ({ nfl: "401872996", "college-football": "401858274", mlb: "401697218" })[league];
    const status = { type: { state: "in", detail: "In Progress", shortDetail: "In Progress" } };
    summary.header.competitions[0].status = status;
    summary.header.competitions[0].date = "2025-03-20T19:00:00Z";
    if (sport === "football") {
      Object.assign(summary, structuredClone(samples.gameCenter.football));
      summary.drives.current.team = { id: competitors[0].id, abbreviation: competitors[0].team.abbreviation };
    }
    if (league === "nba") {
      Object.assign(summary, structuredClone(samples.gameCenter.basketball));
      summary.winprobability = [0.5, 0.6, 0.47, 0.55, 0.66].map((homeWinPercentage) => ({ homeWinPercentage }));
      summary.plays = [
        ["Opening basket", 0, 2, false], ["Three point basket", 3, 2, true],
        ["Jump shot", 22, 27, true], ["Layup", 44, 54, true], ["Three point basket", 61, 68, true],
      ].map(([text, awayScore, homeScore, scoringPlay], index) => ({ id: `play-${index}`, sequenceNumber: String(index + 1), text, awayScore, homeScore, scoringPlay, period: { number: Math.min(index + 1, 3) }, clock: { displayValue: "8:30" } }));
    }
    if (league === "mlb") summary.boxscore.teams = structuredClone(samples.mlbStats.boxscore?.teams ?? samples.mlbStats.teams ?? []);
    const baseEvent = {
      id: eventId,
      name: `${competitors.find((team) => team.homeAway === "away").team.displayName} at ${competitors.find((team) => team.homeAway === "home").team.displayName}`,
      date: "2025-03-20T19:00:00Z",
      status,
      competitions: [{ competitors: structuredClone(competitors), status, broadcasts: [{ names: ["ESPN"] }] }],
    };
    const events = [baseEvent, ...["pre", "post"].map((state, index) => {
      const event = structuredClone(baseEvent);
      event.id = `${eventId}${index + 1}`;
      event.date = state === "pre" ? "2025-03-20T23:00:00Z" : "2025-03-20T16:00:00Z";
      event.status = { type: { state, detail: state === "pre" ? "Scheduled" : "Final", shortDetail: state === "pre" ? "Scheduled" : "Final" } };
      event.competitions[0].status = event.status;
      event.competitions[0].broadcasts = [{ names: [state === "pre" ? "ABC" : "ESPN2"] }];
      event.competitions[0].competitors = extraTeams[league].slice(index * 2, index * 2 + 2).map(([id, displayName, abbreviation], teamIndex) => ({
        id, homeAway: teamIndex === 0 ? "away" : "home",
        ...(state === "post" ? { score: sport === "basketball" ? (teamIndex === 0 ? "101" : "108") : sport === "football" ? (teamIndex === 0 ? "21" : "28") : (teamIndex === 0 ? "3" : "7"), winner: teamIndex === 1 } : {}),
        record: [{ type: "total", summary: teamIndex === 0 ? "18-8" : "16-10" }],
        team: { id, displayName, abbreviation, logo: logo(id) },
      }));
      return event;
    })];
    const base = `/apis/site/v2/sports/${sport}/${league}`;
    if (league === "mens-college-basketball") add(`${base}/scoreboard`, { events: [events[1]] }, { groups: "2" });
    add(`${base}/scoreboard`, { events, week: { number: 12 }, season: { type: 2 } });
    for (const event of events) {
      const eventSummary = structuredClone(summary);
      eventSummary.header.competitions[0].status = event.status;
      eventSummary.header.competitions[0].date = event.date;
      eventSummary.header.competitions[0].competitors = event.competitions[0].competitors;
      add(`${base}/summary`, eventSummary, { event: event.id });
    }
    for (const event of events.slice(1)) {
      for (const competitor of event.competitions[0].competitors) {
        const previous = structuredClone(event);
        previous.id += "9";
        previous.date = "2025-03-16T19:00:00Z";
        previous.competitions[0].status = { type: { state: "post", shortDetail: "Final" } };
        previous.competitions[0].competitors.forEach((team, index) => {
          team.score = sport === "basketball" ? (index ? "99" : "104") : (index ? "17" : "24");
          team.winner = index === 0;
        });
        add(`${base}/teams/${competitor.id}/schedule`, { events: [event, previous] });
      }
    }
    for (const competitor of competitors) {
      const team = competitor.team;
      const teamDetails = { team: { ...team, logos: [{ href: team.logo }], record: { items: [{ description: "Overall Record", summary: "12-6", stats: [{ name: "wins", value: 12 }, { name: "losses", value: 6 }] }] } } };
      add(`${base}/teams/${competitor.id}`, teamDetails);
      const schedule = [baseEvent, ...events.slice(1).map((event) => {
        const scheduled = structuredClone(event);
        scheduled.date = event.status.type.state === "pre" ? "2025-03-22T23:00:00Z" : "2025-03-18T23:00:00Z";
        const ownIndex = competitor.homeAway === "away" ? 0 : 1;
        scheduled.competitions[0].competitors[ownIndex] = { ...structuredClone(competitor), ...(event.status.type.state === "pre" ? { score: undefined } : { score: sport === "basketball" ? "112" : sport === "football" ? "31" : "8", winner: true }) };
        return scheduled;
      })];
      add(`${base}/teams/${competitor.id}/schedule`, { events: schedule });
    }
    favoriteTeams[league] = [{ id: competitors[0].id, name: competitors[0].team.displayName, abbreviation: competitors[0].team.abbreviation, logo: competitors[0].team.logo }];
    const standingsBase = `/apis/v2/sports/${sport}/${league}/standings`;
    if (league === "nba") {
      const entry = ([id, displayName, abbreviation], index) => ({
        team: { id, displayName, abbreviation, logo: logo(id) },
        stats: [{ name: "wins", shortDisplayName: "W", displayValue: String(52 - index * 4) }, { name: "losses", shortDisplayName: "L", displayValue: String(16 + index * 4) }, { name: "winPercent", shortDisplayName: "PCT", displayValue: [".765", ".706", ".647", ".588"][index] }],
      });
      const east = [extraTeams.nba[0], ["18", "New York Knicks", "NY"], ["30", "Charlotte Hornets", "CHA"], extraTeams.nba[1]];
      const west = [extraTeams.nba[2], extraTeams.nba[3], ["7", "Denver Nuggets", "DEN"], ["6", "Dallas Mavericks", "DAL"]];
      add(standingsBase, { children: [{ name: "Eastern Conference", standings: { entries: east.map(entry) } }, { name: "Western Conference", standings: { entries: west.map(entry) } }] });
    }
  }
  return { fixtures, favoriteTeams };
}