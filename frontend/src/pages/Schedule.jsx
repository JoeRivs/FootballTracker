import { api } from "../lib/api.js";
import { useApp } from "../lib/context.jsx";
import { useFetch, fmtDate } from "../lib/hooks.js";
import { Spinner, ErrorBox, Section, Pill, TeamLogo } from "../components/UI.jsx";

export default function Schedule() {
  const { team: slug, season } = useApp();
  const { data, loading, error } = useFetch(() => api.schedule(slug, season), [slug, season]);
  if (loading) return <Spinner label="Loading schedule…" />;
  if (error) return <ErrorBox error={error} />;

  const games = data.games || [];
  const wins = games.filter((g) => g.result?.win).length;
  const losses = games.filter((g) => g.completed && !g.result?.win).length;

  return (
    <Section
      title={`${data.season || ""} Schedule`}
      action={<span className="text-sm text-muted">{wins}–{losses} so far</span>}
    >
      <div className="space-y-2">
        {games.map((g) => (
          <div key={g.id} className="card flex items-center gap-4 p-4">
            <div className="w-16 shrink-0 text-xs uppercase tracking-wide text-muted">
              {g.week}
            </div>
            <TeamLogo src={g.opponent?.logo} alt={g.opponent?.displayName} size={40} />
            <div className="min-w-0 flex-1">
              <div className="font-semibold">
                <span className="text-muted">{g.homeAway === "home" ? "vs" : "@"}</span>{" "}
                {g.opponent?.displayName || "TBD"}
              </div>
              <div className="text-xs text-muted">
                {fmtDate(g.date)} {g.broadcast ? `· ${g.broadcast}` : ""} {g.venue ? `· ${g.venue}` : ""}
              </div>
            </div>
            <div className="text-right">
              {g.completed && g.result ? (
                <div className="flex items-center gap-3">
                  <Pill tone={g.result.win ? "win" : "loss"}>{g.result.win ? "W" : "L"}</Pill>
                  <span className="w-16 text-right text-lg font-black tabular-nums">
                    {g.result.us}–{g.result.them}
                  </span>
                </div>
              ) : (
                <Pill>{g.status || "Scheduled"}</Pill>
              )}
            </div>
          </div>
        ))}
        {data.byeWeek && (
          <div className="card p-3 text-center text-sm text-muted">
            Bye week: Week {data.byeWeek}
          </div>
        )}
      </div>
    </Section>
  );
}
