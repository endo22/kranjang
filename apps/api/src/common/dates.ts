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
