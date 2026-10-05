"""Football Tracker API — a thin, cached proxy over ESPN's public NFL data.

Default team is the Baltimore Ravens (slug `bal`), but every team endpoint
takes a `{team}` slug so other teams work today and can be surfaced in the UI
whenever we want.
"""
import datetime
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from . import espn
from .cache import cached, invalidate

DEFAULT_TEAM = "bal"

# slug -> espn_team_id, for teams we resolve without an extra lookup.
FEATURED = {"bal": "33"}

# Oldest season we expose in the picker. ESPN has data well before this, but
# headshots/rosters get patchy further back.
EARLIEST_SEASON = 2010


def current_season() -> int:
    """The latest NFL season with data. The new season's stats only become
    meaningful once games kick off (~September), so before then we stay on the
    prior year — e.g. in mid-2026 the 'current' season is still 2025."""
    today = datetime.date.today()
    return today.year if today.month >= 9 else today.year - 1


def _ttl(season: int | None) -> int:
    """Past seasons never change, so cache them hard; current season is live."""
    return 21600 if season and season < current_season() else 300


@asynccontextmanager
async def lifespan(_: FastAPI):
    yield
    await espn.close()


app = FastAPI(title="Football Tracker API", version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


async def _team_id(slug: str) -> str:
    if slug in FEATURED:
        return FEATURED[slug]
    t = await cached(f"teaminfo:{slug}", 86400, lambda: espn.team(slug))
    return t["id"]


@app.get("/api/health")
async def health():
    return {"status": "ok"}


@app.get("/api/seasons")
async def seasons():
    cur = current_season()
    return {"current": cur, "seasons": list(range(cur, EARLIEST_SEASON - 1, -1))}


@app.get("/api/teams")
async def teams():
    return await cached("teams", 86400, espn.all_teams)


@app.get("/api/teams/{team}")
async def team_detail(team: str = DEFAULT_TEAM, season: int | None = None):
    try:
        return await cached(f"team:{team}:{season}", _ttl(season), lambda: espn.team(team, season))
    except Exception as e:  # noqa: BLE001
        raise HTTPException(404, f"Team '{team}' not found: {e}")


@app.get("/api/teams/{team}/schedule")
async def team_schedule(team: str = DEFAULT_TEAM, season: int | None = None):
    return await cached(f"sched:{team}:{season}", _ttl(season), lambda: espn.schedule(team, season))


@app.get("/api/teams/{team}/roster")
async def team_roster(team: str = DEFAULT_TEAM, season: int | None = None):
    return await cached(f"roster:{team}:{season}", _ttl(season), lambda: espn.roster(team, season))


@app.get("/api/teams/{team}/news")
async def team_news(team: str = DEFAULT_TEAM, limit: int = 30):
    tid = await _team_id(team)
    return await cached(f"news:{team}:{limit}", 600, lambda: espn.news(tid, limit))


@app.get("/api/news")
async def league_news(limit: int = 30):
    return await cached(f"news:all:{limit}", 600, lambda: espn.news(None, limit))


@app.get("/api/standings")
async def league_standings(season: int | None = None):
    return await cached(f"standings:{season}", _ttl(season), lambda: espn.standings(season))


@app.get("/api/leaders")
async def league_leaders(season: int | None = None, top: int = 10):
    yr = season or current_season()
    return await cached(f"leaders:{yr}:{top}", _ttl(yr), lambda: espn.leaders(yr, top=top))


@app.get("/api/scoreboard")
async def league_scoreboard():
    return await cached("scoreboard", 60, espn.scoreboard)


@app.get("/api/players/{player_id}")
async def player_detail(player_id: str):
    try:
        return await cached(f"player:{player_id}", 600, lambda: espn.player(player_id))
    except Exception as e:  # noqa: BLE001
        raise HTTPException(404, f"Player '{player_id}' not found: {e}")


@app.post("/api/cache/clear")
async def clear_cache(prefix: str = ""):
    return {"cleared": invalidate(prefix)}
