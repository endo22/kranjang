const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000;

export function jakartaDayStart(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00.000+07:00`);
}

export function jakartaDayEndExclusive(isoDate: string): Date {
  const start = jakartaDayStart(isoDate);
  return new Date(start.getTime() + 24 * 60 * 60 * 1000);
}

export function todayJakartaIso(): string {
  const now = new Date(Date.now() + JAKARTA_OFFSET_MS);
  return now.toISOString().slice(0, 10);
}

/** Inclusive day count from `from` through `to` (Jakarta calendar dates). */
export function jakartaInclusiveDayCount(from: string, to: string): number {
  const start = jakartaDayStart(from).getTime();
  const end = jakartaDayStart(to).getTime();
  return Math.max(1, Math.round((end - start) / (24 * 60 * 60 * 1000)) + 1);
}

export function shiftJakartaDate(isoDate: string, dayDelta: number): string {
  const shifted = new Date(jakartaDayStart(isoDate).getTime() + dayDelta * 24 * 60 * 60 * 1000);
  return new Date(shifted.getTime() + JAKARTA_OFFSET_MS).toISOString().slice(0, 10);
}

/** Previous window of the same length ending the day before `from`. */
export function previousPeriodRange(from: string, to: string): { from: string; to: string } {
  const days = jakartaInclusiveDayCount(from, to);
  const prevTo = shiftJakartaDate(from, -1);
  const prevFrom = shiftJakartaDate(from, -days);
  return { from: prevFrom, to: prevTo };
}
