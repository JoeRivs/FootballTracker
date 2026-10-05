# 🏈 Ravens Tracker

A self-hosted web app for everything Baltimore Ravens — record, schedule, roster,
player stats, division standings, news, and live league scores. Data comes from
ESPN's free public NFL endpoints (no API key required). Built to add other teams
later with almost no code changes.

![stack](https://img.shields.io/badge/stack-FastAPI%20%2B%20React%20%2B%20Docker-241773)

## Stack

| Layer    | Tech                                             |
| -------- | ------------------------------------------------ |
| Backend  | FastAPI (Python) — cached proxy over ESPN's API  |
| Frontend | React + Vite + Tailwind (Ravens purple/gold)     |
| Serving  | nginx (static build + `/api` proxy)              |
| Orchestr | Docker Compose                                   |

## Run it (Docker — recommended)

```bash
docker compose up --build
```

Then open **http://localhost:3000**

- Frontend (nginx): http://localhost:3000
- Backend API (FastAPI): http://localhost:8000/api/health
- Interactive API docs: http://localhost:8000/docs

Stop with `Ctrl+C`, or `docker compose down`.

## Run it (local dev, no Docker)

Two terminals:

```bash
# 1) backend
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# 2) frontend
cd frontend
npm install
npm run dev      # http://localhost:5173 (proxies /api -> :8000)
```

## GitHub Pages (live site)

Hosted at **https://joerivs.github.io/FootballTracker/**. Every push to `main`
rebuilds and redeploys it via `.github/workflows/pages.yml`.

Pages only serves static files, so that build doesn't use the FastAPI backend:
it sets `VITE_DATA_SOURCE=espn` and the browser calls ESPN directly through
`frontend/src/lib/espn.js`, a JavaScript port of `backend/app/espn.py` (keep
the two in sync). Docker and local dev are unaffected and still use `/api`.

## Features

- **Any team, any season** — header pickers (and a Teams grid) switch the
  active team across all 32 franchises and the season back to 2010. Changing
  either re-renders the entire app — players, stats, records, standings, and
  leaders all reflect that team/season. Selection persists across reloads.
- **Dashboard** — team hero, record, next game (or season opener), last/final
  result, latest news. Defaults to the Baltimore Ravens.
- **Schedule** — full season with results, broadcast, venue, W/L
- **Roster** — players grouped by position, searchable, click through to profiles
- **League Leaders** — 20+ leaderboards (passing/rushing/receiving yards & TDs,
  tackles, sacks, INTs, scoring, kicking, returns…) for the selected season,
  each player clickable through to their profile
- **Player pages** — bio, season statistics, and player news
- **Standings** — full NFL standings, active team highlighted in its division
- **News** — toggle between team and league-wide
- **Scores** — live/around-the-league scoreboard

### Season notes & data limits

- Default season is the latest with data (**2025** until the 2026 season kicks
  off in September). Past seasons are cached hard since they never change.
- ESPN's roster feed only serves the *current* roster, so for past seasons the
  app reconstructs the roster from that season's stats (everyone who recorded a
  stat). That's season-accurate but can omit deep-bench players and linemen who
  post no stats — the Roster page notes this for past seasons.

## API endpoints

| Endpoint                         | Description                       |
| -------------------------------- | --------------------------------- |
| `GET /api/teams`                          | All 32 NFL teams                 |
| `GET /api/seasons`                        | Selectable seasons + current     |
| `GET /api/teams/{team}?season=`           | Team summary (default `bal`)     |
| `GET /api/teams/{team}/schedule?season=`  | Season schedule                  |
| `GET /api/teams/{team}/roster?season=`    | Roster by position               |
| `GET /api/teams/{team}/news`              | Team news                        |
| `GET /api/news`                           | League news                      |
| `GET /api/standings?season=`              | Full league standings            |
| `GET /api/leaders?season=`                | League statistical leaders       |
| `GET /api/scoreboard`                     | Current week's games             |
| `GET /api/players/{id}`                   | Player bio + stats + news        |

Every team/season endpoint accepts a `season` query param (e.g. `?season=2023`);
omit it for the current season. Responses are cached in-memory (60s for live
data, 6h for past seasons) so ESPN isn't hit on every page load.

## Team & season handling

The whole app is already team- and season-agnostic. Global state lives in
`frontend/src/lib/context.jsx` (persisted to `localStorage`); the header pickers
and the Teams page set it, and every page reads it. No per-team code exists —
all 32 teams and seasons back to 2010 work out of the box.

## Notes

Data is courtesy of ESPN's public endpoints and may change without notice. This
project is for personal/educational use and isn't affiliated with the NFL or the
Baltimore Ravens.
