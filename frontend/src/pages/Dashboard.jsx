import { Link } from "react-router-dom";
import { api } from "../lib/api.js";
import { useApp } from "../lib/context.jsx";
import { useFetch, fmtDate, timeAgo } from "../lib/hooks.js";
import { Spinner, ErrorBox, Section, Stat, Pill, TeamLogo } from "../components/UI.jsx";

export default function Dashboard() {
  const { team: slug, season, isCurrent } = useApp();
  const team = useFetch(() => api.team(slug, season), [slug, season]);
  const sched = useFetch(() => api.schedule(slug, season), [slug, season]);
  const news = useFetch(() => api.teamNews(slug, 6), [slug]);

  if (team.loading) return <Spinner label="Loading team…" />;
  if (team.error) return <ErrorBox error={team.error} />;

  const t = team.data;
  const games = sched.data?.games || [];
  const lastGame = [...games].reverse().find((g) => g.completed);
  const next = t.nextEvent;

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div
        className="card overflow-hidden p-6 sm:p-8"
        style={{ background: `linear-gradient(120deg, ${t.color}cc, ${t.altColor}99)` }}
      >
        <div className="flex flex-wrap items-center gap-6">
          <TeamLogo src={t.logo} alt={t.displayName} size={96} />
          <div className="min-w-[12rem] flex-1">
            <div className="mb-1">
              <Pill tone="gold">{season} Season{!isCurrent ? "" : " · Live"}</Pill>
            </div>
            <h1 className="text-3xl font-black tracking-tight sm:text-4xl">{t.displayName}</h1>
            <p className="mt-1 text-white/80">{t.standingSummary || ""}</p>
          </div>
          <div className="text-right">
            <div className="text-5xl font-black leading-none">{t.record?.summary || "0-0"}</div>
            <div className="text-sm uppercase tracking-wide text-white/70">Record</div>
          </div>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Wins" value={t.record?.wins} />
        <Stat label="Losses" value={t.record?.losses} />
        <Stat label="Points / Game" value={t.record?.avgPointsFor?.toFixed?.(1)} />
        <Stat label="Allowed / Game" value={t.record?.avgPointsAgainst?.toFixed?.(1)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Next game (current season only) */}
        <Section title={isCurrent ? "Next Game" : "Season Opener"}>
          {next ? (
            <div className="card flex items-center gap-4 p-5">
              <TeamLogo src={next.opponent?.logo} alt={next.opponent?.displayName} size={56} />
              <div className="flex-1">
                <div className="text-xs uppercase tracking-wide text-ravens-gray">
                  {next.week} · {next.homeAway === "home" ? "vs" : "@"} {next.venue || ""}
                </div>
                <div className="text-lg font-bold">{next.opponent?.displayName}</div>
                <div className="text-sm text-ravens-gray">{fmtDate(next.date)}</div>
              </div>
            </div>
          ) : (
            <div className="card p-5 text-ravens-gray">
              {isCurrent ? "No upcoming game scheduled." : "Season complete — see the schedule for all results."}
            </div>
          )}
        </Section>

        {/* Last result */}
        <Section title={isCurrent ? "Last Result" : "Final Game"}>
          {lastGame ? (
            <div className="card flex items-center gap-4 p-5">
              <TeamLogo src={lastGame.opponent?.logo} alt={lastGame.opponent?.displayName} size={56} />
              <div className="flex-1">
                <div className="text-xs uppercase tracking-wide text-ravens-gray">
                  {lastGame.week} · {lastGame.homeAway === "home" ? "vs" : "@"} {lastGame.opponent?.shortName}
                </div>
                <div className="text-lg font-bold">{lastGame.name}</div>
                <div className="text-sm text-ravens-gray">{fmtDate(lastGame.date, { month: "short", day: "numeric" })}</div>
              </div>
              {lastGame.result && (
                <div className="text-right">
                  <Pill tone={lastGame.result.win ? "win" : "loss"}>
                    {lastGame.result.win ? "W" : "L"}
                  </Pill>
                  <div className="mt-1 text-2xl font-black">
                    {lastGame.result.us}–{lastGame.result.them}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="card p-5 text-ravens-gray">No completed games yet this season.</div>
          )}
        </Section>
      </div>

      {/* Latest news */}
      <Section
        title="Latest News"
        action={<Link to="/news" className="text-sm font-semibold text-ravens-gold hover:underline">View all →</Link>}
      >
        {news.loading ? (
          <Spinner label="Loading news…" />
        ) : news.error ? (
          <ErrorBox error={news.error} />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {(news.data || []).slice(0, 4).map((n, i) => (
              <a
                key={i}
                href={n.link}
                target="_blank"
                rel="noreferrer"
                className="card group flex gap-3 overflow-hidden p-3 transition hover:border-ravens-gold/40"
              >
                {n.image && (
                  <img src={n.image} alt="" className="h-20 w-28 shrink-0 rounded-lg object-cover" />
                )}
                <div className="min-w-0">
                  <div className="line-clamp-2 font-semibold group-hover:text-ravens-gold">{n.headline}</div>
                  <div className="mt-1 text-xs text-ravens-gray">{timeAgo(n.published)}</div>
                </div>
              </a>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}
