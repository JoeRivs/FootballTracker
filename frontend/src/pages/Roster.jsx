import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api.js";
import { useApp } from "../lib/context.jsx";
import { useFetch } from "../lib/hooks.js";
import { Spinner, ErrorBox, Section, TeamLogo } from "../components/UI.jsx";

export default function Roster() {
  const { team: slug, season, isCurrent } = useApp();
  const { data, loading, error } = useFetch(() => api.roster(slug, season), [slug, season]);
  const [q, setQ] = useState("");

  if (loading) return <Spinner label="Loading roster…" />;
  if (error) return <ErrorBox error={error} />;

  const term = q.trim().toLowerCase();
  const groups = (data.groups || [])
    .map((g) => ({
      ...g,
      players: g.players.filter(
        (p) =>
          !term ||
          p.name?.toLowerCase().includes(term) ||
          p.position?.toLowerCase().includes(term) ||
          p.college?.toLowerCase().includes(term)
      ),
    }))
    .filter((g) => g.players.length);

  return (
    <Section
      title="Roster"
      action={
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search players…"
          className="rounded-lg border border-white/15 bg-white/10 px-3 py-1.5 text-sm outline-none placeholder:text-muted focus:border-team-accent"
        />
      }
    >
      {!isCurrent && (
        <div className="mb-4 rounded-xl border border-team-accent/30 bg-team-accent/10 px-4 py-2.5 text-xs text-yellow-100/90">
          Showing the <b>{season}</b> roster — players who recorded a stat that season.
          Historical rosters come from season stats, so deep-bench and linemen may be omitted.
        </div>
      )}
      <div className="space-y-8">
        {groups.map((g) => (
          <div key={g.position}>
            <h3 className="mb-3 text-sm font-bold uppercase tracking-widest text-team-accent">
              {g.position}
            </h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {g.players.map((p) => (
                <Link
                  key={p.id}
                  to={`/player/${p.id}`}
                  className="card flex items-center gap-3 p-3 transition hover:border-team-accent/40"
                >
                  <TeamLogo src={p.headshot} alt={p.name} size={48} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">
                      {p.jersey && <span className="text-muted">#{p.jersey} </span>}
                      {p.name}
                    </div>
                    <div className="truncate text-xs text-muted">
                      {p.position} · {p.height || "—"}, {p.weight || "—"} · {p.college || "—"}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))}
        {!groups.length && <div className="card p-8 text-center text-muted">No players match “{q}”.</div>}
      </div>
    </Section>
  );
}
