import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api.js";
import { useApp } from "../lib/context.jsx";
import { useFetch } from "../lib/hooks.js";
import { Spinner, ErrorBox, Section, TeamLogo } from "../components/UI.jsx";

function Board({ board }) {
  const [open, setOpen] = useState(false);
  const rows = open ? board.leaders : board.leaders.slice(0, 5);
  return (
    <div className="card flex flex-col overflow-hidden">
      <div className="flex items-baseline justify-between border-b border-white/10 px-4 py-3">
        <h3 className="font-bold text-white">{board.title}</h3>
        <span className="text-xs uppercase tracking-wide text-ravens-gray">{board.statLabel}</span>
      </div>
      <ol className="divide-y divide-white/5">
        {rows.map((p) => (
          <li key={p.rank}>
            <Link
              to={p.id ? `/player/${p.id}` : "#"}
              className="flex items-center gap-3 px-4 py-2 transition hover:bg-white/5"
            >
              <span className={`w-5 text-center text-sm font-black ${p.rank === 1 ? "text-ravens-gold" : "text-ravens-gray"}`}>
                {p.rank}
              </span>
              <TeamLogo src={p.headshot} alt={p.name} size={32} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{p.name}</div>
                <div className="flex items-center gap-1 text-xs text-ravens-gray">
                  {p.teamLogo && <img src={p.teamLogo} alt="" className="h-3.5 w-3.5" />}
                  {p.team} · {p.position}
                </div>
              </div>
              <span className="text-base font-black tabular-nums text-white">{p.value}</span>
            </Link>
          </li>
        ))}
      </ol>
      {board.leaders.length > 5 && (
        <button
          onClick={() => setOpen((o) => !o)}
          className="border-t border-white/10 py-2 text-xs font-semibold text-ravens-gold hover:bg-white/5"
        >
          {open ? "Show less" : `Show top ${board.leaders.length}`}
        </button>
      )}
    </div>
  );
}

export default function Leaders() {
  const { season } = useApp();
  const { data, loading, error } = useFetch(() => api.leaders(season), [season]);

  if (loading) return <Spinner label="Crunching league leaders…" />;
  if (error) return <ErrorBox error={error} />;

  const boards = data?.boards || [];
  const groups = [...new Set(boards.map((b) => b.group))];

  return (
    <div className="space-y-8">
      <Section title={`${data?.season || ""} League Leaders`}>
        <p className="text-sm text-ravens-gray">
          Every team, every position. Click any player for their profile.
        </p>
      </Section>

      {groups.map((g) => (
        <Section key={g} title={g}>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {boards.filter((b) => b.group === g).map((b) => (
              <Board key={b.key} board={b} />
            ))}
          </div>
        </Section>
      ))}

      {!boards.length && (
        <div className="card p-8 text-center text-ravens-gray">
          No leader data for {season} yet — the season may not have started.
        </div>
      )}
    </div>
  );
}
