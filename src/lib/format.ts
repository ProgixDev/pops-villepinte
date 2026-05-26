const EUR = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

export function formatPriceEUR(n: number): string {
  return EUR.format(n);
}

export function formatDistanceMeters(m: number): string {
  if (m <= 0) return "—";
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(m < 10000 ? 1 : 0)} km`;
}

export function formatDurationMinutes(min: number): string {
  if (min <= 0) return "—";
  if (min < 60) return `${Math.round(min)} min`;
  const h = Math.floor(min / 60);
  const r = Math.round(min % 60);
  return r === 0 ? `${h} h` : `${h} h ${r}`;
}

export function formatTimeFR(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
