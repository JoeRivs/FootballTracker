import { useNavigate } from "react-router-dom";
import { useApp } from "../lib/context.jsx";
import { Section, TeamLogo } from "../components/UI.jsx";

export default function Teams() {
  const { teams, team, setTeam } = useApp();
  const navigate = useNavigate();

  const pick = (slug) => {
    setTeam(slug);
    navigate("/");
  };

  const sorted = [...teams].sort((a, b) => a.displayName.localeCompare(b.displayName));

  return (
    <Section title="Select a Team">
      <p className="mb-2 text-sm text-ravens-gray">
        Pick any of the 32 NFL teams — it becomes the focus across every page.
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {sorted.map((t) => {
          const active = t.slug === team;
          return (
            <button
              key={t.slug}
              onClick={() => pick(t.slug)}
              className={`card flex items-center gap-3 p-4 text-left transition hover:border-ravens-gold/50 ${
                active ? "border-ravens-gold ring-1 ring-ravens-gold" : ""
              }`}
              style={active ? { background: `linear-gradient(120deg, ${t.color}55, transparent)` } : undefined}
            >
              <TeamLogo src={t.logo} alt={t.displayName} size={44} />
              <div className="min-w-0">
                <div className="truncate font-bold leading-tight">{t.shortName}</div>
                <div className="truncate text-xs text-ravens-gray">{t.location}</div>
              </div>
            </button>
          );
        })}
      </div>
    </Section>
  );
}
