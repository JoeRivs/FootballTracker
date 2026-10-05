// Re-skins the app in the active team's colors. Tailwind's `team-*` colors
// (tailwind.config.js) and the body gradient (index.css) read CSS variables,
// which this sets from the team's ESPN primary/alternate colors.
//
// ESPN colors aren't designed for a dark UI: backgrounds are the primary
// darkened until white text stays readable, and the accent (headings, active
// nav with black text) is the first sufficiently bright candidate.

// Official secondary colors for teams whose ESPN alternate is black/too dark.
const ACCENT_OVERRIDES = {
  bal: "#9e7c0c", // gold
  atl: "#a5acaf", // silver
  ne: "#b0b7bc", // silver
  phi: "#a5acaf", // silver
};

const MIN_ACCENT_LUMINANCE = 0.18; // black text on accent stays >= 4.5:1
const STORAGE_KEY = "ft_theme";

function hexToRgb(hex) {
  const h = (hex || "").replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(h)) return null;
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}

function luminance([r, g, b]) {
  const lin = (c) => {
    c /= 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

// Mix `rgb` toward `target` by t (0..1).
const mix = (rgb, target, t) => rgb.map((c, i) => Math.round(c + (target[i] - c) * t));

// Smallest darkening (toward black) that brings luminance down to `max`.
function darkenTo(rgb, max) {
  let lo = 0, hi = 1;
  if (luminance(rgb) <= max) return rgb;
  for (let i = 0; i < 20; i++) {
    const t = (lo + hi) / 2;
    if (luminance(mix(rgb, [0, 0, 0], t)) > max) lo = t;
    else hi = t;
  }
  return mix(rgb, [0, 0, 0], hi);
}

// Smallest lightening (toward white) that brings luminance up to `min`.
function lightenTo(rgb, min) {
  let lo = 0, hi = 1;
  if (luminance(rgb) >= min) return rgb;
  for (let i = 0; i < 20; i++) {
    const t = (lo + hi) / 2;
    if (luminance(mix(rgb, [255, 255, 255], t)) < min) lo = t;
    else hi = t;
  }
  return mix(rgb, [255, 255, 255], hi);
}

export function teamTheme(team) {
  const primary = hexToRgb(team?.color) || [36, 23, 115];
  const candidates = [ACCENT_OVERRIDES[team?.slug], team?.altColor, team?.color]
    .map(hexToRgb)
    .filter(Boolean);
  // No bright-enough color: lighten the brightest one (keeps e.g. red teams red).
  const brightest = [...candidates, primary].sort((a, b) => luminance(b) - luminance(a))[0];
  const accent =
    candidates.find((c) => luminance(c) >= MIN_ACCENT_LUMINANCE) ||
    lightenTo(brightest, MIN_ACCENT_LUMINANCE);

  // Black-primary teams (Raiders, Steelers) would get a flat black page, so
  // tint the background with the accent instead.
  const base = luminance(primary) < 0.002 ? accent : primary;

  const v = (rgb) => rgb.join(" ");
  return {
    "--team-primary": v(primary),
    "--team-accent": v(accent),
    "--team-deep": v(darkenTo(base, 0.007)),
    "--team-glow": v(darkenTo(base, 0.025)),
    "--team-shade": v(darkenTo(base, 0.003)),
  };
}

function apply(vars) {
  const root = document.documentElement.style;
  for (const [k, val] of Object.entries(vars)) root.setProperty(k, val);
}

export function applyTeamTheme(team) {
  const vars = teamTheme(team);
  apply(vars);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(vars));
  } catch {
    // storage unavailable; theme just won't be restored before first load
  }
}

// Called before first render so a returning visitor doesn't see the default
// (Ravens) colors flash while the team list loads.
export function restoreTeamTheme() {
  try {
    const vars = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (vars) apply(vars);
  } catch {
    // ignore
  }
}
