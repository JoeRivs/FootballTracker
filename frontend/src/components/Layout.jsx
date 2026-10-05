import { NavLink, Link } from "react-router-dom";
import { useApp } from "../lib/context.jsx";

const links = [
  ["/", "Dashboard", true],
  ["/schedule", "Schedule"],
  ["/roster", "Roster"],
  ["/standings", "Standings"],
  ["/leaders", "Leaders"],
  ["/teams", "Teams"],
  ["/news", "News"],
  ["/scores", "Scores"],
];

export default function Layout({ children }) {
  const { team, setTeam, teams, activeTeam, season, setSeason, seasons, currentSeason } = useApp();

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-team-deep/85 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-4 py-3">
          <div className="flex items-center gap-4">
            <Link to="/" className="flex items-center gap-3">
              <img
                src={activeTeam?.logo || "https://a.espncdn.com/i/teamlogos/nfl/500/bal.png"}
                alt={activeTeam?.displayName || "Team"}
                className="h-10 w-10"
              />
              <div className="leading-tight">
                <div className="text-[11px] font-black uppercase tracking-widest text-team-accent">
                  {activeTeam?.location || "NFL"}
                </div>
                <div className="-mt-0.5 text-lg font-black uppercase tracking-wide text-white">
                  {activeTeam?.shortName || "Tracker"}
                </div>
              </div>
            </Link>

            {/* Team + season pickers */}
            <div className="ml-auto flex items-center gap-2">
              <select
                value={team}
                onChange={(e) => setTeam(e.target.value)}
                className="max-w-[10rem] rounded-lg border border-white/15 bg-white/10 px-2 py-1.5 text-sm font-semibold outline-none focus:border-team-accent"
                title="Select team"
              >
                {[...teams]
                  .sort((a, b) => a.displayName.localeCompare(b.displayName))
                  .map((t) => (
                    <option key={t.slug} value={t.slug} className="bg-team-deep">
                      {t.displayName}
                    </option>
                  ))}
              </select>
              <select
                value={season || currentSeason || ""}
                onChange={(e) => setSeason(e.target.value)}
                className="rounded-lg border border-white/15 bg-white/10 px-2 py-1.5 text-sm font-semibold outline-none focus:border-team-accent"
                title="Select season"
              >
                {seasons.map((y) => (
                  <option key={y} value={y} className="bg-team-deep">
                    {y}
                    {y === currentSeason ? "  (current)" : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <nav className="mt-3 flex flex-wrap items-center gap-1">
            {links.map(([to, label, end]) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                    isActive
                      ? "bg-team-accent/90 text-black"
                      : "text-white/70 hover:bg-white/10 hover:text-white"
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>

      <footer className="mx-auto max-w-6xl px-4 py-10 text-center text-xs text-muted">
        Data via ESPN public endpoints · Built for fun · Not affiliated with the NFL or any team
      </footer>
    </div>
  );
}
