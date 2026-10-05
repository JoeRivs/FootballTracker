import { useParams, Link } from "react-router-dom";
import { api } from "../lib/api.js";
import { useFetch, timeAgo } from "../lib/hooks.js";
import { Spinner, ErrorBox, Section, TeamLogo } from "../components/UI.jsx";

export default function Player() {
  const { id } = useParams();
  const { data, loading, error } = useFetch(() => api.player(id), [id]);

  if (loading) return <Spinner label="Loading player…" />;
  if (error) return <ErrorBox error={error} />;
  const p = data;

  const facts = [
    ["Position", p.position],
    ["Number", p.jersey ? `#${p.jersey}` : null],
    ["Height", p.height],
    ["Weight", p.weight],
    ["Age", p.age],
    ["Experience", p.experience != null ? `${p.experience} yr` : null],
    ["College", p.college],
    ["Birthplace", p.birthPlace],
  ].filter(([, v]) => v);

  return (
    <div className="space-y-6">
      <Link to="/roster" className="text-sm text-team-accent hover:underline">
        ← Back to roster
      </Link>

      <div className="card flex flex-wrap items-center gap-6 p-6">
        <TeamLogo src={p.headshot} alt={p.name} size={110} />
        <div>
          <h1 className="text-3xl font-black">{p.name}</h1>
          <p className="text-muted">
            {p.position} · {p.team}
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {facts.map(([label, value]) => (
          <div key={label} className="card p-4">
            <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
            <div className="text-lg font-bold">{value}</div>
          </div>
        ))}
      </div>

      {p.statistics?.length > 0 && (
        <Section title="Statistics">
          <div className="space-y-4">
            {p.statistics.map((block, i) => (
              <div key={i} className="card overflow-x-auto">
                <div className="px-4 py-2 text-sm font-bold text-team-accent">{block.name}</div>
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted">
                    <tr className="border-b border-white/10">
                      {block.labels?.map((l, j) => (
                        <th key={j} className="px-3 py-2 text-center font-medium">{l}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      {block.values?.map((v, j) => (
                        <td key={j} className="px-3 py-2 text-center tabular-nums">{v}</td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </Section>
      )}

      {p.news?.length > 0 && (
        <Section title="Player News">
          <div className="space-y-2">
            {p.news.map((n, i) => (
              <a
                key={i}
                href={n.link}
                target="_blank"
                rel="noreferrer"
                className="card flex items-center justify-between gap-4 p-4 transition hover:border-team-accent/40"
              >
                <span className="font-medium">{n.headline}</span>
                <span className="shrink-0 text-xs text-muted">{timeAgo(n.published)}</span>
              </a>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}
