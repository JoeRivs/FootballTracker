import { api } from "../lib/api.js";
import { useFetch, fmtDate } from "../lib/hooks.js";
import { Spinner, ErrorBox, Section, Pill, TeamLogo } from "../components/UI.jsx";

export default function Scores() {
  const { data, loading, error } = useFetch(() => api.scoreboard());
  if (loading) return <Spinner label="Loading scoreboard…" />;
  if (error) return <ErrorBox error={error} />;

  return (
    <Section title="Around the League">
      {!data?.length ? (
        <div className="card p-8 text-center text-ravens-gray">
          No games on the board right now — check back on game day.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((g) => (
            <div key={g.id} className="card p-4">
              <div className="mb-3 flex items-center justify-between">
                {g.state === "in" ? (
                  <Pill tone="live">LIVE</Pill>
                ) : (
                  <span className="text-xs text-ravens-gray">{g.status}</span>
                )}
                <span className="text-xs text-ravens-gray">{fmtDate(g.date, { month: "short", day: "numeric" })}</span>
              </div>
              <div className="space-y-2">
                {g.teams.map((tm, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <TeamLogo src={tm.logo} alt={tm.abbreviation} size={28} />
                    <span className={`flex-1 font-semibold ${tm.winner ? "text-white" : "text-white/60"}`}>
                      {tm.displayName}
                    </span>
                    <span className={`text-lg font-black tabular-nums ${tm.winner ? "text-ravens-gold" : "text-white/60"}`}>
                      {tm.score ?? "—"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}
