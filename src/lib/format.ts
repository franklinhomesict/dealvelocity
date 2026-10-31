const usd0 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export function money(n: number | null | undefined, opts: { compact?: boolean; sign?: boolean } = {}): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const v = Math.round(n);
  if (opts.compact && Math.abs(v) >= 1000) {
    const abs = Math.abs(v);
    const s = abs >= 1e6 ? `${(abs / 1e6).toFixed(abs >= 1e7 ? 1 : 2)}M` : `${(abs / 1e3).toFixed(abs >= 1e5 ? 0 : 1)}K`;
    return `${v < 0 ? "−" : opts.sign ? "+" : ""}$${s.replace(/\.0(?=[KM])/, "")}`;
  }
  const s = usd0.format(Math.abs(v));
  return v < 0 ? `−${s}` : opts.sign && v > 0 ? `+${s}` : s;
}

export const percent = (n: number | null | undefined, digits = 1) =>
  n == null || !Number.isFinite(n) ? "—" : `${(n * 100).toFixed(digits)}%`;

export const ratio = (n: number | null | undefined, digits = 2) =>
  n == null ? "—" : !Number.isFinite(n) ? "∞" : `${n.toFixed(digits)}x`;

export const num = (n: number | null | undefined) => (n == null ? "—" : n.toLocaleString("en-US"));

export function relTime(d: Date | string | null | undefined, now = new Date()): string {
  if (!d) return "—";
  const t = typeof d === "string" ? new Date(d) : d;
  const diff = (t.getTime() - now.getTime()) / 1000;
  const abs = Math.abs(diff);
  const fmt = (v: number, u: string) => (diff < 0 ? `${v}${u} ago` : `in ${v}${u}`);
  if (abs < 60) return diff < 0 ? "just now" : "now";
  if (abs < 3600) return fmt(Math.round(abs / 60), "m");
  if (abs < 86400) return fmt(Math.round(abs / 3600), "h");
  if (abs < 86400 * 30) return fmt(Math.round(abs / 86400), "d");
  return t.toLocaleDateString("en-US", { month: "short", day: "numeric", year: t.getFullYear() === now.getFullYear() ? undefined : "numeric" });
}

export const shortDate = (d: Date | string | null | undefined) =>
  !d ? "—" : new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });

export const dateTime = (d: Date | string | null | undefined) =>
  !d
    ? "—"
    : new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export function normalizeAddress(street: string, city: string, state: string, zip: string, unit?: string | null) {
  const abbrev: Record<string, string> = {
    street: "st", avenue: "ave", road: "rd", drive: "dr", lane: "ln", court: "ct", boulevard: "blvd",
    place: "pl", circle: "cir", terrace: "ter", parkway: "pkwy", north: "n", south: "s", east: "e", west: "w",
  };
  const clean = (s: string) =>
    s.toLowerCase().replace(/[.,#]/g, " ").split(/\s+/).filter(Boolean).map((w) => abbrev[w] ?? w).join(" ");
  return [clean(street), unit ? `unit ${clean(unit)}` : "", clean(city), state.toLowerCase().trim(), zip.trim().slice(0, 5)]
    .filter(Boolean)
    .join("|");
}

export function toE164(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const d = phone.replace(/\D/g, "");
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith("1")) return `+${d}`;
  return null;
}

export const formatPhone = (e164: string | null | undefined) => {
  if (!e164) return "—";
  const d = e164.replace(/\D/g, "").slice(-10);
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : e164;
};
