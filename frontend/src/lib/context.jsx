import { createContext, useContext, useEffect, useState } from "react";
import { api } from "./api.js";
import { applyTeamTheme } from "./theme.js";

// Global app state: which team and which season the whole app is showing.
// Changing either re-renders every page (they read these from context).
const AppContext = createContext(null);

export const useApp = () => useContext(AppContext);

export function AppProvider({ children }) {
  const [team, setTeamState] = useState(() => localStorage.getItem("ft_team") || "bal");
  const [season, setSeasonState] = useState(() => {
    const s = localStorage.getItem("ft_season");
    return s ? Number(s) : null;
  });
  const [teams, setTeams] = useState([]);
  const [seasons, setSeasons] = useState([]);
  const [currentSeason, setCurrentSeason] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    Promise.all([api.teams().catch(() => []), api.seasons().catch(() => null)])
      .then(([t, s]) => {
        setTeams(t || []);
        // Drop any stale/invalid persisted team (e.g. an old long-form slug).
        if (t && t.length) {
          setTeamState((prev) => {
            if (t.some((x) => x.slug === prev)) return prev;
            localStorage.setItem("ft_team", "bal");
            return "bal";
          });
        }
        if (s) {
          setSeasons(s.seasons);
          setCurrentSeason(s.current);
          setSeasonState((prev) => prev || s.current);
        }
      })
      .finally(() => setReady(true));
  }, []);

  const setTeam = (t) => {
    setTeamState(t);
    localStorage.setItem("ft_team", t);
  };
  const setSeason = (s) => {
    const n = Number(s);
    setSeasonState(n);
    localStorage.setItem("ft_season", String(n));
  };

  const activeTeam = teams.find((t) => t.slug === team) || null;

  // Re-skin the whole app in the selected team's colors.
  useEffect(() => {
    if (activeTeam) applyTeamTheme(activeTeam);
  }, [activeTeam]);
  const isCurrent = !season || season === currentSeason;

  const value = {
    team,
    setTeam,
    season,
    setSeason,
    seasons,
    currentSeason,
    isCurrent,
    teams,
    activeTeam,
  };

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-team-accent" />
      </div>
    );
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
