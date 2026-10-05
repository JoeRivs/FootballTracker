// Browser-side port of backend/app/espn.py + main.py, used for the static
// GitHub Pages build (no backend there). ESPN's public endpoints send
// `Access-Control-Allow-Origin: *`, so the browser can call them directly.
// Keep the payload shapes in sync with the Python backend.

const SITE = "https://site.api.espn.com/apis/site/v2/sports/football/nfl";
const WEB = "https://site.web.api.espn.com/apis/common/v3/sports/football/nfl";
const CDN = "https://cdn.espn.com/core/nfl";

const DEFAULT_TEAM = "bal";
const FEATURED = { bal: "33" }; // slug -> espn team id, skips a lookup
const EARLIEST_SEASON = 2010;

// ESPN's full /teams list is the one endpoint without CORS headers, so the
// team list comes from /groups instead, which lacks colors. Colors are
// stable, so they live here.
const TEAM_COLORS = {
  ari: ["#a40227", "#ffffff"], atl: ["#a71930", "#000000"], bal: ["#29126f", "#000000"],
  buf: ["#00338d", "#d50a0a"], car: ["#0085ca", "#000000"], chi: ["#0b1c3a", "#e64100"],
  cin: ["#fb4f14", "#000000"], cle: ["#472a08", "#ff3c00"], dal: ["#002a5c", "#b0b7bc"],
  den: ["#0a2343", "#fc4c02"], det: ["#0076b6", "#bbbbbb"], gb: ["#204e32", "#ffb612"],
  hou: ["#021018", "#eb0028"], ind: ["#003b75", "#ffffff"], jax: ["#007487", "#d7a22a"],
  kc: ["#e31837", "#ffb612"], lv: ["#000000", "#a5acaf"], lac: ["#0080c6", "#ffc20e"],
  lar: ["#003594", "#ffd100"], mia: ["#008e97", "#fc4c02"], min: ["#4f2683", "#ffc62f"],
  ne: ["#002a5c", "#c60c30"], no: ["#d3bc8d", "#000000"], nyg: ["#003c7f", "#c9243f"],
  nyj: ["#115740", "#ffffff"], phi: ["#06424d", "#000000"], pit: ["#000000", "#ffb612"],
  sf: ["#aa0000", "#b3995d"], sea: ["#002a5c", "#69be28"], tb: ["#bd1c36", "#3e3a35"],
  ten: ["#4495d2", "#001532"], wsh: ["#5a1414", "#ffb612"],
};

// ---------------------------------------------------------------------------
// HTTP + cache
// ---------------------------------------------------------------------------
async function _get(url, params) {
  const pairs = Object.entries(params || {}).filter(([, v]) => v != null);
  const full = pairs.length ? `${url}?${new URLSearchParams(pairs)}` : url;
  const res = await fetch(full);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${full}`);
  return res.json();
}

// Tiny TTL cache (mirrors backend/app/cache.py). Stores the promise so
// concurrent callers share one request; failures are evicted.
const _store = new Map();

function cached(key, ttl, producer) {
  const hit = _store.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;
  const value = producer();
  _store.set(key, { expires: Date.now() + ttl * 1000, value });
  value.catch(() => _store.delete(key));
  return value;
}

function currentSeason() {
  // New season's stats only matter once games kick off (~September).
  const today = new Date();
  return today.getMonth() + 1 >= 9 ? today.getFullYear() : today.getFullYear() - 1;
}

function _ttl(season) {
  return season && season < currentSeason() ? 21600 : 300;
}

// ---------------------------------------------------------------------------
// Teams
// ---------------------------------------------------------------------------
function _logo(t) {
  const logos = t.logos || [];
  return logos.length ? logos[0].href : null;
}

function _teamBrief(t) {
  // Abbreviation is the canonical slug (long slugs 400 on season endpoints).
  const slug = (t.abbreviation || t.slug || "").toLowerCase();
  const [color, altColor] = TEAM_COLORS[slug] || [];
  return {
    id: t.id,
    slug,
    abbreviation: t.abbreviation,
    displayName: t.displayName,
    shortName: t.shortDisplayName || t.name,
    location: t.location,
    color: t.color ? "#" + t.color : color || "#222222",
    altColor: t.alternateColor ? "#" + t.alternateColor : altColor || "#000000",
    logo: _logo(t),
  };
}

async function allTeams() {
  const data = await _get(`${SITE}/groups`);
  const out = [];
  for (const conf of data.groups || []) {
    for (const div of conf.children || []) {
      for (const t of div.teams || []) out.push(_teamBrief(t));
    }
  }
  return out.sort((a, b) => (a.displayName || "").localeCompare(b.displayName || ""));
}

async function team(slug, season) {
  const data = await _get(`${SITE}/teams/${slug}`);
  const t = data.team;
  let rec = {};
  let standing = t.standingSummary;
  let nxt = null;

  // Current season: ESPN gives a live record + next event inline. Past seasons
  // (or the offseason) lack both, so derive them from the schedule instead.
  if (season == null) {
    for (const item of t.record?.items || []) {
      if (item.type === "total" || "summary" in item) {
        rec = Object.fromEntries((item.stats || []).map((s) => [s.name, s.value]));
        rec.summary = item.summary;
        break;
      }
    }
    const events = t.nextEvent || [];
    if (events.length) nxt = _shapeNextEvent(events[0], t.id);
  }

  if (!rec.summary || (season == null && nxt == null)) {
    try {
      const sched = await schedule(slug, season);
      if (!rec.summary) rec = { ..._recordFromSchedule(sched), ...rec };
      if (season != null) standing = `${sched.season} season`;
      if (nxt == null && season == null) nxt = _nextFromSchedule(sched);
    } catch {
      // schedule is best-effort here
    }
  }

  return { ..._teamBrief(t), record: rec, standingSummary: standing, nextEvent: nxt, season: season ?? null };
}

function _recordFromSchedule(sched) {
  let wins = 0, losses = 0, ties = 0, pf = 0, pa = 0;
  for (const g of sched.games || []) {
    const r = g.result;
    if (!r) continue;
    pf += r.us;
    pa += r.them;
    if (r.us === r.them) ties += 1;
    else if (r.win) wins += 1;
    else losses += 1;
  }
  const played = wins + losses + ties;
  const summary = `${wins}-${losses}` + (ties ? `-${ties}` : "");
  const round1 = (n) => Math.round(n * 10) / 10;
  return {
    wins,
    losses,
    ties,
    summary: played ? summary : null,
    avgPointsFor: played ? round1(pf / played) : null,
    avgPointsAgainst: played ? round1(pa / played) : null,
  };
}

function _nextFromSchedule(sched) {
  const g = (sched.games || []).find((x) => !x.completed);
  if (!g) return null;
  return {
    id: g.id,
    name: g.name,
    shortName: g.name,
    date: g.date,
    week: g.week,
    homeAway: g.homeAway,
    venue: g.venue,
    opponent: g.opponent,
  };
}

function _shapeNextEvent(ev, teamId) {
  const comp = (ev.competitions || [{}])[0];
  let opp = null, homeAway = null;
  for (const c of comp.competitors || []) {
    const ct = c.team || {};
    if (ct.id === teamId) homeAway = c.homeAway;
    else opp = ct;
  }
  return {
    id: ev.id,
    name: ev.name,
    shortName: ev.shortName,
    date: ev.date,
    week: ev.week?.text,
    homeAway,
    venue: comp.venue?.fullName,
    opponent: opp ? _teamBrief(opp) : null,
  };
}

// ---------------------------------------------------------------------------
// Schedule
// ---------------------------------------------------------------------------
function _score(c) {
  const s = c.score;
  const v = s && typeof s === "object" ? s.value : s;
  return parseInt(v || 0, 10) || 0;
}

async function schedule(slug, season) {
  const params = season ? { seasontype: 2, season } : null;
  const data = await _get(`${SITE}/teams/${slug}/schedule`, params);
  const teamId = data.team?.id;
  const games = (data.events || []).map((ev) => {
    const comp = (ev.competitions || [{}])[0];
    let us = null, opp = null;
    for (const c of comp.competitors || []) {
      if (c.team?.id === teamId) us = c;
      else opp = c;
    }
    const status = comp.status?.type || {};
    let result = null;
    if (status.completed && us && opp) {
      const usScore = _score(us);
      const oppScore = _score(opp);
      result = { us: usScore, them: oppScore, win: us.winner ?? usScore > oppScore };
    }
    return {
      id: ev.id,
      date: ev.date,
      week: ev.week?.text || `Week ${ev.week?.number ?? ""}`,
      name: ev.shortName,
      homeAway: us ? us.homeAway : null,
      venue: comp.venue?.fullName,
      opponent: opp?.team ? _teamBrief(opp.team) : null,
      status: status.description,
      completed: status.completed || false,
      result,
      broadcast: (comp.broadcasts || []).find((b) => b.name)?.name ?? null,
    };
  });
  const label = data.requestedSeason || data.season || {};
  return { season: label.displayName || label.year, byeWeek: data.byeWeek, games };
}

// ---------------------------------------------------------------------------
// Roster
// ---------------------------------------------------------------------------
const _OFFENSE = new Set(["QB", "RB", "FB", "HB", "WR", "TE", "OT", "OG", "C", "G", "T", "OL"]);
const _DEFENSE = new Set(["DE", "DT", "NT", "DL", "LB", "ILB", "OLB", "MLB", "EDGE", "CB", "S", "FS", "SS", "DB"]);
const _SPECIAL = new Set(["K", "P", "LS", "PK"]);

function _side(pos) {
  if (_OFFENSE.has(pos)) return "Offense";
  if (_DEFENSE.has(pos)) return "Defense";
  if (_SPECIAL.has(pos)) return "Special Teams";
  return "Other";
}

const _byPosThenName = (a, b) =>
  (a.position || "ZZ").localeCompare(b.position || "ZZ") || (a.name || "").localeCompare(b.name || "");

const _title = (s) => s.replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());

async function roster(slug, season) {
  let data;
  try {
    data = await _get(`${SITE}/teams/${slug}/roster`, season ? { season } : null);
  } catch {
    data = { athletes: [] }; // fall through to the historical rebuild below
  }
  let groups = (data.athletes || []).map((grp) => ({
    position: _title(grp.position || "squad"),
    players: (grp.items || [])
      .map((a) => ({
        id: a.id,
        name: a.displayName,
        jersey: a.jersey,
        position: a.position?.abbreviation,
        age: a.age,
        height: a.displayHeight,
        weight: a.displayWeight,
        experience: a.experience?.years,
        college: a.college?.name,
        headshot: a.headshot?.href,
        status: a.status?.name,
      }))
      .sort(_byPosThenName),
  }));

  // The live roster endpoint returns empty groups for past seasons.
  if (season && !groups.some((g) => g.players.length)) {
    groups = await _historicalRoster(slug, season);
  }
  return { groups };
}

// Union of each season's stat feeds covers everyone who recorded a stat.
const _ROSTER_SCAN = [
  ["passing", "passingAttempts"],
  ["rushing", "rushingAttempts"],
  ["receiving", "receivingTargets"],
  ["defensive", "totalTackles"],
  ["kicking", "fieldGoalAttempts"],
  ["punting", "punts"],
];

async function _historicalRoster(slug, season) {
  const tinfo = await _get(`${SITE}/teams/${slug}`);
  const tid = String(tinfo.team.id);

  const scan = (cat, stat) =>
    _get(`${WEB}/statistics/byathlete`, {
      season,
      seasontype: 2,
      limit: 1000,
      sort: `${cat}.${stat}:desc`,
    })
      .then((d) => d.athletes || [])
      .catch(() => []);

  const results = await Promise.all(_ROSTER_SCAN.map(([c, s]) => scan(c, s)));

  const seen = new Map();
  for (const athletes of results) {
    for (const a of athletes) {
      const ath = a.athlete || {};
      if (String(ath.teamId) !== tid) continue;
      if (ath.id && !seen.has(ath.id)) seen.set(ath.id, ath);
    }
  }

  const buckets = { Offense: [], Defense: [], "Special Teams": [], Other: [] };
  for (const ath of seen.values()) {
    const pos = ath.position?.abbreviation;
    buckets[_side(pos)].push({
      id: ath.id,
      name: ath.displayName,
      jersey: ath.jersey,
      position: pos,
      age: ath.age,
      height: null,
      weight: null,
      experience: null,
      college: null,
      headshot: ath.headshot?.href,
      status: null,
    });
  }
  return Object.entries(buckets)
    .filter(([, players]) => players.length)
    .map(([position, players]) => ({ position, players: players.sort(_byPosThenName) }));
}

// ---------------------------------------------------------------------------
// News
// ---------------------------------------------------------------------------
async function news(teamId, limit = 30) {
  const params = { limit };
  if (teamId) params.team = teamId;
  const data = await _get(`${SITE}/news`, params);
  return (data.articles || []).map((a) => ({
    headline: a.headline,
    description: a.description,
    published: a.published,
    type: a.type,
    image: a.images?.length ? a.images[0].url : null,
    link: a.links?.web?.href,
    byline: a.byline,
  }));
}

// ---------------------------------------------------------------------------
// Standings
// ---------------------------------------------------------------------------
async function standings(season) {
  const params = { xhr: 1 };
  if (season) params.season = season;
  const data = await _get(`${CDN}/standings`, params);
  return data.content.standings.groups.map((conf) => ({
    name: conf.name,
    divisions: (conf.groups || []).map((div) => ({
      name: div.name,
      teams: (div.standings?.entries || []).map((e) => {
        const t = e.team || {};
        const stats = Object.fromEntries((e.stats || []).map((s) => [s.name, s.displayValue]));
        return {
          team: {
            id: t.id,
            slug: (t.abbreviation || t.slug || "").toLowerCase(),
            abbreviation: t.abbreviation,
            displayName: t.displayName,
            logo: (t.logos || [{}])[0]?.href,
          },
          wins: stats.wins,
          losses: stats.losses,
          ties: stats.ties,
          winPercent: stats.winPercent,
          pointsFor: stats.pointsFor,
          pointsAgainst: stats.pointsAgainst,
          streak: stats.streak,
          record: stats.overall || stats.Overall,
        };
      }),
    })),
  }));
}

// ---------------------------------------------------------------------------
// Scoreboard
// ---------------------------------------------------------------------------
async function scoreboard() {
  const data = await _get(`${SITE}/scoreboard`);
  return (data.events || []).map((ev) => {
    const comp = (ev.competitions || [{}])[0];
    const status = comp.status?.type || {};
    return {
      id: ev.id,
      name: ev.shortName,
      date: ev.date,
      status: status.shortDetail,
      state: status.state,
      teams: (comp.competitors || []).map((c) => {
        const t = c.team || {};
        return {
          abbreviation: t.abbreviation,
          displayName: t.displayName,
          logo: t.logo,
          homeAway: c.homeAway,
          score: c.score,
          winner: c.winner,
        };
      }),
    };
  });
}

// ---------------------------------------------------------------------------
// Player
// ---------------------------------------------------------------------------
async function player(playerId) {
  const [bio, overview] = await Promise.all([
    _get(`${WEB}/athletes/${playerId}`),
    _get(`${WEB}/athletes/${playerId}/overview`),
  ]);
  const a = bio.athlete || bio;
  const stats = overview.statistics || {};
  const labels = stats.labels || stats.displayNames || [];
  return {
    id: a.id,
    name: a.displayName,
    jersey: a.jersey,
    position: a.position?.displayName,
    team: a.team?.displayName,
    height: a.displayHeight,
    weight: a.displayWeight,
    age: a.age,
    experience: a.experience?.years,
    college: a.college?.name,
    birthPlace: a.birthPlace?.city,
    headshot: a.headshot?.href,
    statistics: (stats.splits || []).map((row) => ({ name: row.displayName, labels, values: row.stats })),
    news: (overview.news || []).slice(0, 6).map((n) => ({
      headline: n.headline,
      published: n.published,
      link: n.links?.web?.href,
    })),
  };
}

// ---------------------------------------------------------------------------
// League leaders
// ---------------------------------------------------------------------------
const LEADER_BOARDS = [
  { key: "pass_yds", title: "Passing Yards", group: "Passing", category: "passing", stat: "passingYards" },
  { key: "pass_td", title: "Passing Touchdowns", group: "Passing", category: "passing", stat: "passingTouchdowns" },
  { key: "pass_rtg", title: "Passer Rating", group: "Passing", category: "passing", stat: "QBRating" },
  { key: "pass_cmp", title: "Completions", group: "Passing", category: "passing", stat: "completions" },
  { key: "rush_yds", title: "Rushing Yards", group: "Rushing", category: "rushing", stat: "rushingYards" },
  { key: "rush_td", title: "Rushing Touchdowns", group: "Rushing", category: "rushing", stat: "rushingTouchdowns" },
  { key: "rush_att", title: "Carries", group: "Rushing", category: "rushing", stat: "rushingAttempts" },
  { key: "rush_ypc", title: "Yards per Carry", group: "Rushing", category: "rushing", stat: "yardsPerRushAttempt" },
  { key: "rec_yds", title: "Receiving Yards", group: "Receiving", category: "receiving", stat: "receivingYards" },
  { key: "rec_rec", title: "Receptions", group: "Receiving", category: "receiving", stat: "receptions" },
  { key: "rec_td", title: "Receiving Touchdowns", group: "Receiving", category: "receiving", stat: "receivingTouchdowns" },
  { key: "def_tkl", title: "Total Tackles", group: "Defense", category: "defensive", stat: "totalTackles" },
  { key: "def_sack", title: "Sacks", group: "Defense", category: "defensive", stat: "sacks" },
  { key: "def_tfl", title: "Tackles for Loss", group: "Defense", category: "defensive", stat: "tacklesForLoss" },
  { key: "def_pd", title: "Passes Defended", group: "Defense", category: "defensive", stat: "passesDefended" },
  { key: "def_int", title: "Interceptions", group: "Defense", category: "defensiveinterceptions", stat: "interceptions" },
  { key: "score_pts", title: "Points", group: "Scoring", category: "scoring", stat: "totalPoints" },
  { key: "score_td", title: "Total Touchdowns", group: "Scoring", category: "scoring", stat: "totalTouchdowns" },
  { key: "kick_fgm", title: "Field Goals Made", group: "Special Teams", category: "kicking", stat: "fieldGoalsMade" },
  { key: "punt_avg", title: "Punting Average", group: "Special Teams", category: "punting", stat: "grossAvgPuntYards" },
  { key: "kr_yds", title: "Kick Return Yards", group: "Special Teams", category: "returning", stat: "kickReturnYards" },
  { key: "pr_yds", title: "Punt Return Yards", group: "Special Teams", category: "returning", stat: "puntReturnYards" },
];

async function _oneBoard(board, season, seasontype, top) {
  const data = await _get(`${WEB}/statistics/byathlete`, {
    season,
    seasontype,
    limit: top,
    isqualified: "true",
    sort: `${board.category}.${board.stat}:desc`,
  });
  const meta = (data.categories || []).find((c) => c.name === board.category) || {};
  const names = meta.names || [];
  const labels = meta.labels || [];
  const idx = names.indexOf(board.stat);
  const statLabel = idx >= 0 && idx < labels.length ? labels[idx] : board.stat;

  const leaders = (data.athletes || []).map((a, i) => {
    const ath = a.athlete || {};
    const cat = (a.categories || []).find((c) => c.name === board.category);
    const totals = cat?.totals || [];
    return {
      rank: i + 1,
      id: ath.id,
      name: ath.displayName,
      team: ath.teamShortName,
      teamLogo: (ath.teamLogos || [{}])[0]?.href,
      headshot: ath.headshot?.href,
      position: ath.position?.abbreviation,
      value: idx >= 0 && idx < totals.length ? totals[idx] : null,
    };
  });
  return { key: board.key, title: board.title, group: board.group, statLabel, leaders };
}

async function leaders(season, seasontype = 2, top = 10) {
  const results = await Promise.allSettled(LEADER_BOARDS.map((b) => _oneBoard(b, season, seasontype, top)));
  const boards = results
    .filter((r) => r.status === "fulfilled" && r.value.leaders.length)
    .map((r) => r.value);
  return { season, boards };
}

// ---------------------------------------------------------------------------
// Public API — same surface as the /api routes in backend/app/main.py
// ---------------------------------------------------------------------------
async function _teamId(slug) {
  if (FEATURED[slug]) return FEATURED[slug];
  const t = await cached(`teaminfo:${slug}`, 86400, () => team(slug));
  return t.id;
}

export const espnApi = {
  teams: () => cached("teams", 86400, allTeams),
  seasons: async () => {
    const cur = currentSeason();
    const seasons = [];
    for (let y = cur; y >= EARLIEST_SEASON; y--) seasons.push(y);
    return { current: cur, seasons };
  },
  team: (slug = DEFAULT_TEAM, season) =>
    cached(`team:${slug}:${season}`, _ttl(season), () => team(slug, season)),
  schedule: (slug = DEFAULT_TEAM, season) =>
    cached(`sched:${slug}:${season}`, _ttl(season), () => schedule(slug, season)),
  roster: (slug = DEFAULT_TEAM, season) =>
    cached(`roster:${slug}:${season}`, _ttl(season), () => roster(slug, season)),
  teamNews: async (slug = DEFAULT_TEAM, limit = 30) => {
    const tid = await _teamId(slug);
    return cached(`news:${slug}:${limit}`, 600, () => news(tid, limit));
  },
  news: (limit = 30) => cached(`news:all:${limit}`, 600, () => news(null, limit)),
  standings: (season) => cached(`standings:${season}`, _ttl(season), () => standings(season)),
  leaders: (season, top = 10) => {
    const yr = season || currentSeason();
    return cached(`leaders:${yr}:${top}`, _ttl(yr), () => leaders(yr, 2, top));
  },
  scoreboard: () => cached("scoreboard", 60, scoreboard),
  player: (id) => cached(`player:${id}`, 600, () => player(id)),
};
