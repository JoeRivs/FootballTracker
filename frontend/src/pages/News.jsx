import { useState } from "react";
import { api } from "../lib/api.js";
import { useApp } from "../lib/context.jsx";
import { useFetch, timeAgo } from "../lib/hooks.js";
import { Spinner, ErrorBox, Section, Pill } from "../components/UI.jsx";

export default function News() {
  const { team: slug, activeTeam } = useApp();
  const [scope, setScope] = useState("team"); // "team" | "league"
  const { data, loading, error } = useFetch(
    () => (scope === "team" ? api.teamNews(slug, 40) : api.news(40)),
    [scope, slug]
  );

  const toggle = (
    <div className="flex gap-1 rounded-lg bg-white/10 p-1">
      {[
        ["team", activeTeam?.shortName || "Team"],
        ["league", "League"],
      ].map(([key, label]) => (
        <button
          key={key}
          onClick={() => setScope(key)}
          className={`rounded-md px-3 py-1 text-sm font-semibold transition ${
            scope === key ? "bg-ravens-gold text-black" : "text-white/70 hover:text-white"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );

  return (
    <Section title="News" action={toggle}>
      {loading ? (
        <Spinner label="Loading news…" />
      ) : error ? (
        <ErrorBox error={error} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {(data || []).map((n, i) => (
            <a
              key={i}
              href={n.link}
              target="_blank"
              rel="noreferrer"
              className="card group flex flex-col overflow-hidden transition hover:border-ravens-gold/40"
            >
              {n.image && <img src={n.image} alt="" className="h-44 w-full object-cover" />}
              <div className="flex flex-1 flex-col gap-2 p-4">
                <div className="flex items-center gap-2">
                  {n.type && <Pill tone="gold">{n.type}</Pill>}
                  <span className="text-xs text-ravens-gray">{timeAgo(n.published)}</span>
                </div>
                <h3 className="font-bold leading-snug group-hover:text-ravens-gold">{n.headline}</h3>
                {n.description && (
                  <p className="line-clamp-3 text-sm text-ravens-gray">{n.description}</p>
                )}
                {n.byline && <span className="mt-auto text-xs text-ravens-gray">{n.byline}</span>}
              </div>
            </a>
          ))}
        </div>
      )}
    </Section>
  );
}
