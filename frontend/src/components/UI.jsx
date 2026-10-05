// Small reusable presentational bits used across pages.

export function Spinner({ label = "Loading…" }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-ravens-gray">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-ravens-gold" />
      <span>{label}</span>
    </div>
  );
}

export function ErrorBox({ error }) {
  return (
    <div className="card border-red-500/30 bg-red-500/10 p-6 text-red-200">
      <p className="font-semibold">Couldn't load data</p>
      <p className="mt-1 text-sm opacity-80">{String(error?.message || error)}</p>
      <p className="mt-2 text-xs opacity-60">
        The backend may still be warming up, or ESPN is briefly unreachable. Try refreshing.
      </p>
    </div>
  );
}

export function Section({ title, action, children }) {
  return (
    <section className="space-y-3">
      {(title || action) && (
        <div className="flex items-end justify-between">
          {title && (
            <h2 className="text-lg font-bold uppercase tracking-wide text-white/90">{title}</h2>
          )}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Pill({ children, tone = "default" }) {
  const tones = {
    default: "bg-white/10 text-white/80",
    win: "bg-emerald-500/20 text-emerald-300",
    loss: "bg-red-500/20 text-red-300",
    gold: "bg-ravens-gold/20 text-yellow-200",
    live: "bg-red-500/90 text-white animate-pulse",
  };
  return <span className={`pill ${tones[tone] || tones.default}`}>{children}</span>;
}

export function Stat({ label, value, sub }) {
  return (
    <div className="card flex flex-col gap-1 p-4">
      <span className="text-xs uppercase tracking-wide text-ravens-gray">{label}</span>
      <span className="text-2xl font-extrabold text-white">{value ?? "—"}</span>
      {sub && <span className="text-xs text-ravens-gray">{sub}</span>}
    </div>
  );
}

export function TeamLogo({ src, alt, size = 40 }) {
  if (!src) return <div style={{ width: size, height: size }} className="rounded-full bg-white/10" />;
  return (
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      className="object-contain drop-shadow"
      style={{ width: size, height: size }}
    />
  );
}
