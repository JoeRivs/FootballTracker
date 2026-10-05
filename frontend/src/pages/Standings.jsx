import { api } from "../lib/api.js";
import { useApp } from "../lib/context.jsx";
import { useFetch } from "../lib/hooks.js";
import { Spinner, ErrorBox, Section, TeamLogo } from "../components/UI.jsx";

export default function Standings() {
  const { team: TEAM, season } = useApp();
  const { data, loading, error } = useFetch(() => api.standings(season), [season]);
  if (loading) return <Spinner label="Loading standings…" />;
  if (error) return <ErrorBox error={error} />;

  return (
    <Section title="NFL Standings">
      <div className="space-y-8">
        {(data || []).map((conf) => (
          <div key={conf.name}>
            <h3 className="mb-3 text-base font-black uppercase tracking-widest text-white/90">
              {conf.name}
            </h3>
            <div className="grid gap-4 md:grid-cols-2">
              {conf.divisions.map((div) => (
                <div key={div.name} className="card overflow-hidden">
                  <div className="bg-white/5 px-4 py-2 text-sm font-bold uppercase tracking-wide text-ravens-gold">
                    {div.name}
                  </div>
                  <table className="w-full text-sm">
                    <thead className="text-xs text-ravens-gray">
                      <tr className="border-b border-white/10">
                        <th className="px-4 py-2 text-left font-medium">Team</th>
                        <th className="px-2 py-2 text-center font-medium">W</th>
                        <th className="px-2 py-2 text-center font-medium">L</th>
                        <th className="px-2 py-2 text-center font-medium">T</th>
                        <th className="px-2 py-2 text-center font-medium">PF</th>
                        <th className="px-2 py-2 text-center font-medium">PA</th>
                        <th className="px-3 py-2 text-center font-medium">Strk</th>
                      </tr>
                    </thead>
                    <tbody>
                      {div.teams.map((row) => {
                        const mine = row.team.slug === TEAM;
                        return (
                          <tr
                            key={row.team.id}
                            className={`border-b border-white/5 ${mine ? "bg-ravens-gold/10" : ""}`}
                          >
                            <td className="px-4 py-2">
                              <div className="flex items-center gap-2">
                                <TeamLogo src={row.team.logo} alt={row.team.abbreviation} size={22} />
                                <span className={mine ? "font-bold text-ravens-gold" : ""}>
                                  {row.team.abbreviation}
                                </span>
                              </div>
                            </td>
                            <td className="px-2 py-2 text-center tabular-nums">{row.wins}</td>
                            <td className="px-2 py-2 text-center tabular-nums">{row.losses}</td>
                            <td className="px-2 py-2 text-center tabular-nums">{row.ties}</td>
                            <td className="px-2 py-2 text-center tabular-nums text-ravens-gray">{row.pointsFor}</td>
                            <td className="px-2 py-2 text-center tabular-nums text-ravens-gray">{row.pointsAgainst}</td>
                            <td className="px-3 py-2 text-center tabular-nums text-ravens-gray">{row.streak}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}
