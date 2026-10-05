"""Thin client over ESPN's public (unofficial) NFL endpoints.

These require no API key. We fetch JSON, then shape it into compact payloads
the frontend can consume directly. Everything is parameterized by team so we
can add teams beyond the Ravens later with zero code changes.
"""
import asyncio

import httpx

SITE = "https://site.api.espn.com/apis/site/v2/sports/football/nfl"
WEB = "https://site.web.api.espn.com/apis/common/v3/sports/football/nfl"
CDN = "https://cdn.espn.com/core/nfl"

_client = httpx.AsyncClient(
    timeout=15,
    headers={"User-Agent": "Mozilla/5.0 (FootballTracker)"},
    follow_redirects=True,
)


async def _get(url: str, params: dict | None = None) -> dict:
    r = await _client.get(url, params=params)
    r.raise_for_status()
    return r.json()


async def close() -> None:
    await _client.aclose()


# ---------------------------------------------------------------------------
# Teams
# ---------------------------------------------------------------------------
async def all_teams() -> list[dict]:
    data = await _get(f"{SITE}/teams")
    out = []
    for entry in data["sports"][0]["leagues"][0]["teams"]:
        t = entry["team"]
        out.append(_team_brief(t))
    return out


def _logo(t: dict) -> str | None:
    logos = t.get("logos") or []
    return logos[0]["href"] if logos else None


def _team_brief(t: dict) -> dict:
    # Use the abbreviation (bal, kc, …) as the canonical slug everywhere: ESPN's
    # long slug (baltimore-ravens) 400s on season-scoped endpoints, whereas the
    # abbreviation works for every season.
    return {
        "id": t.get("id"),
        "slug": (t.get("abbreviation") or t.get("slug") or "").lower(),
        "abbreviation": t.get("abbreviation"),
        "displayName": t.get("displayName"),
        "shortName": t.get("shortDisplayName") or t.get("name"),
        "location": t.get("location"),
        "color": "#" + t["color"] if t.get("color") else "#222222",
        "altColor": "#" + t["alternateColor"] if t.get("alternateColor") else "#000000",
        "logo": _logo(t),
    }


async def team(slug: str, season: int | None = None) -> dict:
    data = await _get(f"{SITE}/teams/{slug}")
    t = data["team"]
    rec = {}
    standing = t.get("standingSummary")
    nxt = None

    # For the current season ESPN gives a live record + next event inline.
    # For a past season (or the offseason) those vanish, so we derive both from
    # that season's schedule instead.
    if season is None:
        for item in (t.get("record", {}).get("items") or []):
            if item.get("type") == "total" or "summary" in item:
                rec = {s["name"]: s["value"] for s in item.get("stats", [])}
                rec["summary"] = item.get("summary")
                break
        events = t.get("nextEvent") or []
        if events:
            nxt = _shape_next_event(events[0], t.get("id"))

    if not rec.get("summary") or (season is None and nxt is None):
        try:
            sched = await schedule(slug, season)
            if not rec.get("summary"):
                rec = {**_record_from_schedule(sched), **rec}
            if season is not None:
                standing = f"{sched.get('season')} season"
            if nxt is None and season is None:
                nxt = _next_from_schedule(sched)
        except Exception:  # noqa: BLE001 — schedule is best-effort here
            pass

    return {
        **_team_brief(t),
        "record": rec,
        "standingSummary": standing,
        "nextEvent": nxt,
        "season": season,
    }


def _record_from_schedule(sched: dict) -> dict:
    wins = losses = ties = pf = pa = 0
    for g in sched.get("games", []):
        r = g.get("result")
        if not r:
            continue
        pf += r["us"]
        pa += r["them"]
        if r["us"] == r["them"]:
            ties += 1
        elif r["win"]:
            wins += 1
        else:
            losses += 1
    played = wins + losses + ties
    summary = f"{wins}-{losses}" + (f"-{ties}" if ties else "")
    return {
        "wins": wins,
        "losses": losses,
        "ties": ties,
        "summary": summary if played else None,
        "avgPointsFor": round(pf / played, 1) if played else None,
        "avgPointsAgainst": round(pa / played, 1) if played else None,
    }


def _next_from_schedule(sched: dict) -> dict | None:
    for g in sched.get("games", []):
        if not g.get("completed"):
            opp = g.get("opponent")
            return {
                "id": g.get("id"),
                "name": g.get("name"),
                "shortName": g.get("name"),
                "date": g.get("date"),
                "week": g.get("week"),
                "homeAway": g.get("homeAway"),
                "venue": g.get("venue"),
                "opponent": opp,
            }
    return None


def _shape_next_event(ev: dict, team_id: str | None) -> dict:
    comp = (ev.get("competitions") or [{}])[0]
    competitors = comp.get("competitors") or []
    opp, us, home_away = None, None, None
    for c in competitors:
        ct = c.get("team", {})
        if ct.get("id") == team_id:
            us = ct
            home_away = c.get("homeAway")
        else:
            opp = ct
    venue = (comp.get("venue") or {}).get("fullName")
    return {
        "id": ev.get("id"),
        "name": ev.get("name"),
        "shortName": ev.get("shortName"),
        "date": ev.get("date"),
        "week": (ev.get("week") or {}).get("text"),
        "homeAway": home_away,
        "venue": venue,
        "opponent": _team_brief(opp) if opp else None,
    }


# ---------------------------------------------------------------------------
# Schedule
# ---------------------------------------------------------------------------
async def schedule(slug: str, season: int | None = None) -> dict:
    params = {"seasontype": 2, "season": season} if season else None
    data = await _get(f"{SITE}/teams/{slug}/schedule", params=params)
    team_id = (data.get("team") or {}).get("id")
    games = []
    for ev in data.get("events", []):
        comp = (ev.get("competitions") or [{}])[0]
        competitors = comp.get("competitors") or []
        us = opp = None
        for c in competitors:
            if (c.get("team") or {}).get("id") == team_id:
                us = c
            else:
                opp = c
        status = (comp.get("status") or {}).get("type", {})
        result = None
        if status.get("completed") and us and opp:
            us_score = int(us.get("score", {}).get("value", us.get("score", 0)) or 0)
            opp_score = int(opp.get("score", {}).get("value", opp.get("score", 0)) or 0)
            result = {
                "us": us_score,
                "them": opp_score,
                "win": us.get("winner", us_score > opp_score),
            }
        games.append({
            "id": ev.get("id"),
            "date": ev.get("date"),
            "week": (ev.get("week") or {}).get("text") or f"Week {(ev.get('week') or {}).get('number','')}",
            "name": ev.get("shortName"),
            "homeAway": us.get("homeAway") if us else None,
            "venue": (comp.get("venue") or {}).get("fullName"),
            "opponent": _team_brief(opp.get("team")) if opp and opp.get("team") else None,
            "status": status.get("description"),
            "completed": status.get("completed", False),
            "result": result,
            "broadcast": next((b.get("name") for b in (comp.get("broadcasts") or []) if b.get("name")), None),
        })
    label = (data.get("requestedSeason") or data.get("season") or {})
    return {
        "season": label.get("displayName") or label.get("year"),
        "byeWeek": data.get("byeWeek"),
        "games": games,
    }


# ---------------------------------------------------------------------------
# Roster
# ---------------------------------------------------------------------------
# Map position abbreviations to a side of the ball, for grouping historical
# rosters (the core API doesn't pre-group them like the live endpoint does).
_OFFENSE = {"QB", "RB", "FB", "HB", "WR", "TE", "OT", "OG", "C", "G", "T", "OL"}
_DEFENSE = {"DE", "DT", "NT", "DL", "LB", "ILB", "OLB", "MLB", "EDGE", "CB", "S", "FS", "SS", "DB"}
_SPECIAL = {"K", "P", "LS", "PK"}


def _side(pos: str | None) -> str:
    if pos in _OFFENSE:
        return "Offense"
    if pos in _DEFENSE:
        return "Defense"
    if pos in _SPECIAL:
        return "Special Teams"
    return "Other"


async def roster(slug: str, season: int | None = None) -> dict:
    try:
        data = await _get(f"{SITE}/teams/{slug}/roster", params={"season": season} if season else None)
    except Exception:  # noqa: BLE001 — fall through to the historical rebuild below
        data = {"athletes": []}
    groups = []
    for grp in data.get("athletes", []):
        players = []
        for a in grp.get("items", []):
            players.append({
                "id": a.get("id"),
                "name": a.get("displayName"),
                "jersey": a.get("jersey"),
                "position": (a.get("position") or {}).get("abbreviation"),
                "age": a.get("age"),
                "height": a.get("displayHeight"),
                "weight": a.get("displayWeight"),
                "experience": (a.get("experience") or {}).get("years"),
                "college": (a.get("college") or {}).get("name"),
                "headshot": (a.get("headshot") or {}).get("href"),
                "status": (a.get("status") or {}).get("name"),
            })
        players.sort(key=lambda p: (p["position"] or "ZZ", p["name"] or ""))
        groups.append({"position": grp.get("position", "squad").title(), "players": players})

    # ESPN's live roster endpoint returns empty groups for past seasons, so
    # rebuild that season's roster from the core API instead.
    if season and not any(g["players"] for g in groups):
        groups = await _historical_roster(slug, season)
    return {"groups": groups}


# Categories scanned to enumerate everyone who appeared for a team in a season.
# ESPN exposes no complete historical roster, but each season's stats feed is
# team-accurate, so the union of these covers every player who recorded a stat.
_ROSTER_SCAN = [
    ("passing", "passingAttempts"),     # QBs
    ("rushing", "rushingAttempts"),     # RBs (+ scrambling QBs)
    ("receiving", "receivingTargets"),  # WR / TE / pass-catching RBs
    ("defensive", "totalTackles"),      # entire front seven + secondary
    ("kicking", "fieldGoalAttempts"),   # kickers
    ("punting", "punts"),               # punters
]


async def _historical_roster(slug: str, season: int) -> list[dict]:
    tinfo = await _get(f"{SITE}/teams/{slug}")
    tid = str(tinfo["team"]["id"])

    async def scan(cat: str, stat: str) -> list[dict]:
        try:
            data = await _get(f"{WEB}/statistics/byathlete", params={
                "season": season,
                "seasontype": 2,
                "limit": 1000,
                "sort": f"{cat}.{stat}:desc",
            })
            return data.get("athletes", [])
        except Exception:  # noqa: BLE001
            return []

    results = await asyncio.gather(*[scan(c, s) for c, s in _ROSTER_SCAN])

    seen: dict[str, dict] = {}
    for athletes in results:
        for a in athletes:
            ath = a.get("athlete", {})
            if str(ath.get("teamId")) != tid:
                continue
            aid = ath.get("id")
            if aid and aid not in seen:
                seen[aid] = ath

    buckets: dict[str, list] = {"Offense": [], "Defense": [], "Special Teams": [], "Other": []}
    for ath in seen.values():
        pos = (ath.get("position") or {}).get("abbreviation")
        buckets[_side(pos)].append({
            "id": ath.get("id"),
            "name": ath.get("displayName"),
            "jersey": ath.get("jersey"),
            "position": pos,
            "age": ath.get("age"),
            "height": None,
            "weight": None,
            "experience": None,
            "college": None,
            "headshot": (ath.get("headshot") or {}).get("href"),
            "status": None,
        })
    for players in buckets.values():
        players.sort(key=lambda p: (p["position"] or "ZZ", p["name"] or ""))
    return [{"position": name, "players": players} for name, players in buckets.items() if players]


# ---------------------------------------------------------------------------
# News
# ---------------------------------------------------------------------------
async def news(team_id: str | None = None, limit: int = 30) -> list[dict]:
    params = {"limit": limit}
    if team_id:
        params["team"] = team_id
    data = await _get(f"{SITE}/news", params=params)
    out = []
    for a in data.get("articles", []):
        images = a.get("images") or []
        out.append({
            "headline": a.get("headline"),
            "description": a.get("description"),
            "published": a.get("published"),
            "type": a.get("type"),
            "image": images[0]["url"] if images else None,
            "link": (a.get("links", {}).get("web", {}) or {}).get("href"),
            "byline": a.get("byline"),
        })
    return out


# ---------------------------------------------------------------------------
# Standings (whole league, grouped by conference/division)
# ---------------------------------------------------------------------------
async def standings(season: int | None = None) -> list[dict]:
    params = {"xhr": 1}
    if season:
        params["season"] = season
    data = await _get(f"{CDN}/standings", params=params)
    root = data["content"]["standings"]["groups"]
    conferences = []
    for conf in root:
        divisions = []
        for div in conf.get("groups", []):
            rows = []
            entries = (div.get("standings") or {}).get("entries", [])
            for e in entries:
                t = e.get("team", {})
                stats = {s.get("name"): s.get("displayValue") for s in e.get("stats", [])}
                rows.append({
                    "team": {
                        "id": t.get("id"),
                        "slug": (t.get("abbreviation") or t.get("slug") or "").lower(),
                        "abbreviation": t.get("abbreviation"),
                        "displayName": t.get("displayName"),
                        "logo": (t.get("logos") or [{}])[0].get("href"),
                    },
                    "wins": stats.get("wins"),
                    "losses": stats.get("losses"),
                    "ties": stats.get("ties"),
                    "winPercent": stats.get("winPercent"),
                    "pointsFor": stats.get("pointsFor"),
                    "pointsAgainst": stats.get("pointsAgainst"),
                    "streak": stats.get("streak"),
                    "record": stats.get("overall") or stats.get("Overall"),
                })
            divisions.append({"name": div.get("name"), "teams": rows})
        conferences.append({"name": conf.get("name"), "divisions": divisions})
    return conferences


# ---------------------------------------------------------------------------
# Scoreboard (league-wide, current week)
# ---------------------------------------------------------------------------
async def scoreboard() -> list[dict]:
    data = await _get(f"{SITE}/scoreboard")
    games = []
    for ev in data.get("events", []):
        comp = (ev.get("competitions") or [{}])[0]
        competitors = comp.get("competitors") or []
        teams = []
        for c in competitors:
            t = c.get("team", {})
            teams.append({
                "abbreviation": t.get("abbreviation"),
                "displayName": t.get("displayName"),
                "logo": t.get("logo"),
                "homeAway": c.get("homeAway"),
                "score": c.get("score"),
                "winner": c.get("winner"),
            })
        status = (comp.get("status") or {}).get("type", {})
        games.append({
            "id": ev.get("id"),
            "name": ev.get("shortName"),
            "date": ev.get("date"),
            "status": status.get("shortDetail"),
            "state": status.get("state"),
            "teams": teams,
        })
    return games


# ---------------------------------------------------------------------------
# Player detail
# ---------------------------------------------------------------------------
async def player(player_id: str) -> dict:
    bio = await _get(f"{WEB}/athletes/{player_id}")
    overview = await _get(f"{WEB}/athletes/{player_id}/overview")
    a = bio.get("athlete", bio)
    stats_blocks = []
    stats = overview.get("statistics") or {}
    labels = stats.get("labels") or stats.get("displayNames") or []
    for row in (stats.get("splits") or []):
        stats_blocks.append({
            "name": row.get("displayName"),
            "labels": labels,
            "values": row.get("stats"),
        })
    return {
        "id": a.get("id"),
        "name": a.get("displayName"),
        "jersey": a.get("jersey"),
        "position": (a.get("position") or {}).get("displayName"),
        "team": (a.get("team") or {}).get("displayName"),
        "height": a.get("displayHeight"),
        "weight": a.get("displayWeight"),
        "age": a.get("age"),
        "experience": (a.get("experience") or {}).get("years"),
        "college": (a.get("college") or {}).get("name"),
        "birthPlace": (a.get("birthPlace") or {}).get("city"),
        "headshot": (a.get("headshot") or {}).get("href"),
        "statistics": stats_blocks,
        "news": [
            {
                "headline": n.get("headline"),
                "published": n.get("published"),
                "link": (n.get("links", {}).get("web", {}) or {}).get("href"),
            }
            for n in (overview.get("news") or [])[:6]
        ],
    }


# ---------------------------------------------------------------------------
# League statistical leaders (by season)
# ---------------------------------------------------------------------------
# Each board is one sorted query against ESPN's byathlete endpoint. `group` is
# used to section the UI; `category`/`stat` map to ESPN's stat keys.
LEADER_BOARDS = [
    {"key": "pass_yds", "title": "Passing Yards", "group": "Passing", "category": "passing", "stat": "passingYards"},
    {"key": "pass_td", "title": "Passing Touchdowns", "group": "Passing", "category": "passing", "stat": "passingTouchdowns"},
    {"key": "pass_rtg", "title": "Passer Rating", "group": "Passing", "category": "passing", "stat": "QBRating"},
    {"key": "pass_cmp", "title": "Completions", "group": "Passing", "category": "passing", "stat": "completions"},
    {"key": "rush_yds", "title": "Rushing Yards", "group": "Rushing", "category": "rushing", "stat": "rushingYards"},
    {"key": "rush_td", "title": "Rushing Touchdowns", "group": "Rushing", "category": "rushing", "stat": "rushingTouchdowns"},
    {"key": "rush_att", "title": "Carries", "group": "Rushing", "category": "rushing", "stat": "rushingAttempts"},
    {"key": "rush_ypc", "title": "Yards per Carry", "group": "Rushing", "category": "rushing", "stat": "yardsPerRushAttempt"},
    {"key": "rec_yds", "title": "Receiving Yards", "group": "Receiving", "category": "receiving", "stat": "receivingYards"},
    {"key": "rec_rec", "title": "Receptions", "group": "Receiving", "category": "receiving", "stat": "receptions"},
    {"key": "rec_td", "title": "Receiving Touchdowns", "group": "Receiving", "category": "receiving", "stat": "receivingTouchdowns"},
    {"key": "def_tkl", "title": "Total Tackles", "group": "Defense", "category": "defensive", "stat": "totalTackles"},
    {"key": "def_sack", "title": "Sacks", "group": "Defense", "category": "defensive", "stat": "sacks"},
    {"key": "def_tfl", "title": "Tackles for Loss", "group": "Defense", "category": "defensive", "stat": "tacklesForLoss"},
    {"key": "def_pd", "title": "Passes Defended", "group": "Defense", "category": "defensive", "stat": "passesDefended"},
    {"key": "def_int", "title": "Interceptions", "group": "Defense", "category": "defensiveinterceptions", "stat": "interceptions"},
    {"key": "score_pts", "title": "Points", "group": "Scoring", "category": "scoring", "stat": "totalPoints"},
    {"key": "score_td", "title": "Total Touchdowns", "group": "Scoring", "category": "scoring", "stat": "totalTouchdowns"},
    {"key": "kick_fgm", "title": "Field Goals Made", "group": "Special Teams", "category": "kicking", "stat": "fieldGoalsMade"},
    {"key": "punt_avg", "title": "Punting Average", "group": "Special Teams", "category": "punting", "stat": "grossAvgPuntYards"},
    {"key": "kr_yds", "title": "Kick Return Yards", "group": "Special Teams", "category": "returning", "stat": "kickReturnYards"},
    {"key": "pr_yds", "title": "Punt Return Yards", "group": "Special Teams", "category": "returning", "stat": "puntReturnYards"},
]


async def _one_board(board: dict, season: int, seasontype: int, top: int) -> dict:
    params = {
        "season": season,
        "seasontype": seasontype,
        "limit": top,
        "isqualified": "true",
        "sort": f"{board['category']}.{board['stat']}:desc",
    }
    data = await _get(f"{WEB}/statistics/byathlete", params=params)
    cat_meta = {c["name"]: c for c in data.get("categories", [])}
    meta = cat_meta.get(board["category"], {})
    names = meta.get("names", [])
    labels = meta.get("labels", [])
    idx = names.index(board["stat"]) if board["stat"] in names else None
    stat_label = labels[idx] if idx is not None and idx < len(labels) else board["stat"]

    rows = []
    for i, a in enumerate(data.get("athletes", [])):
        ath = a.get("athlete", {})
        cat = next((c for c in a.get("categories", []) if c["name"] == board["category"]), None)
        val = None
        if cat and idx is not None and idx < len(cat.get("totals", [])):
            val = cat["totals"][idx]
        rows.append({
            "rank": i + 1,
            "id": ath.get("id"),
            "name": ath.get("displayName"),
            "team": ath.get("teamShortName"),
            "teamLogo": (ath.get("teamLogos") or [{}])[0].get("href"),
            "headshot": (ath.get("headshot") or {}).get("href"),
            "position": (ath.get("position") or {}).get("abbreviation"),
            "value": val,
        })
    return {
        "key": board["key"],
        "title": board["title"],
        "group": board["group"],
        "statLabel": stat_label,
        "leaders": rows,
    }


async def leaders(season: int, seasontype: int = 2, top: int = 10) -> dict:
    results = await asyncio.gather(
        *[_one_board(b, season, seasontype, top) for b in LEADER_BOARDS],
        return_exceptions=True,
    )
    boards = [r for r in results if not isinstance(r, Exception) and r.get("leaders")]
    return {"season": season, "boards": boards}
