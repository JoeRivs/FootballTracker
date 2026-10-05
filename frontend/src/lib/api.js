// Single place that talks to the backend. Everything goes through /api which is
// proxied to FastAPI (vite proxy in dev, nginx in the Docker image).
const BASE = "/api";

async function get(path) {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText} — ${text.slice(0, 120)}`);
  }
  return res.json();
}

// Build a query string, dropping null/undefined values.
function qs(params) {
  const pairs = Object.entries(params).filter(([, v]) => v != null && v !== "");
  return pairs.length
    ? "?" + pairs.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&")
    : "";
}

export const TEAM = "bal"; // default featured team

export const api = {
  teams: () => get(`/teams`),
  seasons: () => get(`/seasons`),
  team: (slug = TEAM, season) => get(`/teams/${slug}${qs({ season })}`),
  schedule: (slug = TEAM, season) => get(`/teams/${slug}/schedule${qs({ season })}`),
  roster: (slug = TEAM, season) => get(`/teams/${slug}/roster${qs({ season })}`),
  teamNews: (slug = TEAM, limit = 30) => get(`/teams/${slug}/news${qs({ limit })}`),
  news: (limit = 30) => get(`/news${qs({ limit })}`),
  standings: (season) => get(`/standings${qs({ season })}`),
  leaders: (season, top = 10) => get(`/leaders${qs({ season, top })}`),
  scoreboard: () => get(`/scoreboard`),
  player: (id) => get(`/players/${id}`),
};
