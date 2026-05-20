import type { DayHours, DayKey } from "./api";

export const DAY_KEYS: DayKey[] = [
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
  "sun",
];

export const DAY_LABELS_LONG: Record<DayKey, string> = {
  mon: "Lundi",
  tue: "Mardi",
  wed: "Mercredi",
  thu: "Jeudi",
  fri: "Vendredi",
  sat: "Samedi",
  sun: "Dimanche",
};

export const DAY_LABELS_SHORT: Record<DayKey, string> = {
  mon: "LUN",
  tue: "MAR",
  wed: "MER",
  thu: "JEU",
  fri: "VEN",
  sat: "SAM",
  sun: "DIM",
};

const DEFAULT_DAY: DayHours = {
  closed: false,
  open: "11:00",
  close: "00:00",
};

export const DEFAULT_HOURS: Record<DayKey, DayHours> = {
  mon: { ...DEFAULT_DAY },
  tue: { ...DEFAULT_DAY },
  wed: { ...DEFAULT_DAY },
  thu: { ...DEFAULT_DAY },
  fri: { ...DEFAULT_DAY, close: "01:00" },
  sat: { ...DEFAULT_DAY, close: "01:00" },
  sun: { ...DEFAULT_DAY, open: "12:00" },
};

/** Normalise a remote `hours_by_day` payload, falling back to defaults. */
export function normalizeHours(
  remote: Partial<Record<DayKey, DayHours>> | undefined,
): Record<DayKey, DayHours> {
  const out: Record<DayKey, DayHours> = { ...DEFAULT_HOURS };
  if (!remote) return out;
  for (const key of DAY_KEYS) {
    const row = remote[key];
    if (row) out[key] = { ...out[key], ...row };
  }
  return out;
}

/** JS Date.getDay(): 0=Sun ... 6=Sat. Map to our keys. */
const JS_DAY_TO_KEY: Record<number, DayKey> = {
  0: "sun",
  1: "mon",
  2: "tue",
  3: "wed",
  4: "thu",
  5: "fri",
  6: "sat",
};

export function dayKeyFromDate(d: Date): DayKey {
  return JS_DAY_TO_KEY[d.getDay()];
}

function parseHHmm(hhmm: string): number {
  const [h, m] = hhmm.split(":").map((n) => parseInt(n, 10));
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return h * 60 + m;
}

/** Format `00:00` → `00h`, `11:30` → `11h30`. */
export function formatHHmm(hhmm: string): string {
  const [h, m] = hhmm.split(":");
  if (m === "00") return `${h}h`;
  return `${h}h${m}`;
}

export function formatDayRange(d: DayHours): string {
  if (d.closed) return "Fermé";
  return `${formatHHmm(d.open)} – ${formatHHmm(d.close)}`;
}

export type OpenState = {
  isOpen: boolean;
  /** Human-friendly secondary line, e.g. "Jusqu'à 23h" or "Réouvre demain à 11h". */
  hint: string;
  /** Current day key, useful to highlight a row. */
  today: DayKey;
};

/**
 * Decides whether the shop is open at `now`. Handles overnight ranges
 * (e.g. 11:00 → 01:00 spills into the next day): if the current minute is
 * before the open time on today, we look at yesterday and check whether its
 * range still applies.
 */
export function computeOpenState(
  hours: Record<DayKey, DayHours>,
  now: Date = new Date(),
): OpenState {
  const today = dayKeyFromDate(now);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const todays = hours[today];
  const yest = hours[previousDay(today)];

  // 1) Are we still inside yesterday's overnight range?
  if (!yest.closed) {
    const yOpen = parseHHmm(yest.open);
    const yClose = parseHHmm(yest.close);
    if (yClose < yOpen && nowMinutes < yClose) {
      return {
        isOpen: true,
        hint: `Ouvert · jusqu'à ${formatHHmm(yest.close)}`,
        today,
      };
    }
  }

  // 2) Today's window.
  if (!todays.closed) {
    const open = parseHHmm(todays.open);
    const close = parseHHmm(todays.close);
    const closesNextDay = close < open;
    const endOfDay = closesNextDay ? 24 * 60 : close;
    if (nowMinutes >= open && nowMinutes < endOfDay) {
      return {
        isOpen: true,
        hint: closesNextDay
          ? `Ouvert · jusqu'à ${formatHHmm(todays.close)}`
          : `Ouvert · ferme à ${formatHHmm(todays.close)}`,
        today,
      };
    }
    if (nowMinutes < open) {
      return {
        isOpen: false,
        hint: `Fermé · ouvre à ${formatHHmm(todays.open)}`,
        today,
      };
    }
  }

  // 3) Closed for the rest of today — point to the next open day.
  const nextOpen = findNextOpen(hours, today);
  if (!nextOpen) {
    return { isOpen: false, hint: "Fermé", today };
  }
  const isTomorrow = nextOpen.daysAhead === 1;
  return {
    isOpen: false,
    hint: isTomorrow
      ? `Fermé · ouvre demain à ${formatHHmm(nextOpen.hours.open)}`
      : `Fermé · réouvre ${DAY_LABELS_LONG[nextOpen.day].toLowerCase()} à ${formatHHmm(nextOpen.hours.open)}`,
    today,
  };
}

function previousDay(key: DayKey): DayKey {
  const idx = DAY_KEYS.indexOf(key);
  return DAY_KEYS[(idx + DAY_KEYS.length - 1) % DAY_KEYS.length];
}

function findNextOpen(
  hours: Record<DayKey, DayHours>,
  today: DayKey,
): { day: DayKey; daysAhead: number; hours: DayHours } | null {
  const startIdx = DAY_KEYS.indexOf(today);
  for (let offset = 1; offset <= 7; offset++) {
    const day = DAY_KEYS[(startIdx + offset) % DAY_KEYS.length];
    const row = hours[day];
    if (!row.closed) return { day, daysAhead: offset, hours: row };
  }
  return null;
}
